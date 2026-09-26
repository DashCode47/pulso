# Reservas, cancelación y lista de espera

## Reglas

| Regla | Valor | Dónde se cambia |
|---|---|---|
| Costo de una reserva | 1 crédito | `book_class()` |
| Plazo para cancelar | 12 h antes de la clase (default) | `studio_settings.cancellation_cutoff_hours` |
| Lista de espera | Cierra junto con el plazo de cancelación | Mismo setting |
| Cupos | `min(classes.capacity, bicis activas)` | Admin (clase / bicis) |
| Requisito | Membresía `active` con `cycle_end >= hoy` | — |

Cambiar el plazo (0–168 h), como admin desde el SQL editor de Supabase:

```sql
update studio_settings set cancellation_cutoff_hours = 24;
```

## Ver disponibilidad

La app llama a `class_availability()`. Por cada clase futura devuelve: bicis ocupadas, cantidad de reservas, mi reserva/bici, mi posición en la lista de espera y `cancel_deadline`.

> ⚠️ **No calcular la ocupación leyendo `reservations` desde el cliente.** La RLS solo deja al miembro ver *sus* reservas, así que todo se vería libre. Este fue el origen de los "choques" entre usuarios.

La lista se refresca cada 30 s y también después de cada acción (con éxito o con error).

## Reservar — `book_class(class_id, bike_id)`

En una sola transacción:

1. Valida la membresía y bloquea la fila de la membresía. Así un doble tap no gasta el mismo crédito dos veces.
2. Bloquea la fila de la clase (`FOR UPDATE`). Las reservas concurrentes a la misma clase se atienden de a una.
3. Verifica que la clase esté `scheduled`, no haya empezado y tenga cupo (`capacity`).
4. Verifica que haya saldo ≥ 1.
5. Inserta la reserva. Los índices únicos parciales `one_bike_per_class` y `one_booking_per_user_per_class` son la garantía final. Si dos personas eligen la misma bici, una gana y la otra recibe `bike_or_class_unavailable`.
6. Descuenta 1 crédito y crea las notificaciones.
7. Un trigger (`clear_waitlist_on_booking`) saca al usuario de la lista de espera de esa clase.

## Cancelar — `cancel_reservation(reservation_id)`

1. Bloquea la reserva (`FOR UPDATE`). Un segundo cancel concurrente recibe `reservation_not_active` y no reembolsa dos veces.
2. Si ya pasó `starts_at - cutoff`, devuelve `cancellation_window_closed`.
3. Marca la reserva `cancelled` y devuelve 1 crédito.
4. Llama a `promote_from_waitlist()` con la bici liberada.

El admin cancela clases enteras con `admin_cancel_class()`, que reembolsa y notifica a todos.

## Lista de espera (auto-reserva)

- `join_waitlist(class_id)` y `leave_waitlist(entry_id)`. No se puede entrar si ya pasó el plazo (`waitlist_closed`) ni si ya tienes reserva (`already_booked`).
- Cuando alguien cancela, `promote_from_waitlist` recorre la lista por orden de llegada. **Reserva automáticamente** la bici liberada para el primero que tenga membresía activa y ≥ 1 crédito: descuenta el crédito y le crea una notificación `waitlist_promoted`.
- A quien no tiene créditos se le salta, pero conserva su lugar para el próximo cupo.
- Como los cupos solo se liberan antes del plazo de cancelación, quien entra desde la lista siempre puede cancelar después.
- Estados de `waitlist_entries`: `waiting` → `claimed` (reservado) | `cancelled`. Los estados `offered`/`expired` son del flujo anterior (oferta de 15 min), que ya no se usa.

Limitación: si el admin *aumenta* la capacidad de una clase, la lista no se promueve sola.

## Errores → mensajes

Las RPCs lanzan `RAISE EXCEPTION '<codigo>'`. El cliente los traduce en `mobile/features/bookings/errorMessages.ts`. Un código desconocido (p. ej. un error de red) muestra un mensaje genérico y se registra con `console.warn('[bookings]', ...)`.

| Código | Origen |
|---|---|
| `no_active_membership` | reservar, lista de espera |
| `class_not_available` | reservar (clase llena o cancelada), lista de espera |
| `class_already_started` | reservar |
| `insufficient_credits` | reservar |
| `bike_or_class_unavailable` | reservar (otro tomó la bici) |
| `reservation_not_found` / `reservation_not_active` | cancelar |
| `cancellation_window_closed` | cancelar |
| `waitlist_closed` / `already_booked` / `already_on_waitlist` / `waitlist_entry_not_found` | lista de espera |

Si agregas un código nuevo, agrégalo también a `errorMessages.ts`.

## UX en la app (`app/(tabs)/bookings.tsx`, `components/ClassCard.tsx`)

- Una acción a la vez por clase: el botón muestra un spinner y se ignoran taps repetidos.
- Banner verde en éxito y rojo en error.
- Se pide confirmación antes de cancelar.
- La tarjeta muestra "Puedes cancelar hasta …". Si ya pasó el plazo, avisa que la reserva no se podrá cancelar.
- Si la bici elegida aparece ocupada tras un refresco, se deselecciona.
- Clase llena: botón "Unirme a la lista de espera". En la lista: badge "En espera #N" y botón "Salir de la lista".

## Notificaciones

Las RPCs insertan filas en `notifications` (`sent_at = null`), pero **todavía no hay nada que las envíe como push**. Por eso la lista de espera reserva automáticamente en lugar de ofrecer el cupo.

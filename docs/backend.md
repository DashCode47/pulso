# Backend (Supabase / Postgres)

Todo está en `supabase/migrations/`, que se aplican en orden. Cada migración explica en su cabecera por qué existe.

## Seguridad

- RLS está activa en todas las tablas. Los miembros leen solo sus filas; los admins leen todo.
- Admin = tener una fila en `admins`. Se chequea con `is_admin()`. No existe una columna de rol editable desde el cliente.
- Ledgers, reservas y lista de espera **no aceptan escrituras directas** del cliente; solo se modifican vía RPC `SECURITY DEFINER`.
- Supabase da `EXECUTE` a `PUBLIC`/`anon`/`authenticated` en cada función nueva. Cada migración que crea funciones debe:
  - revocar el permiso en las funciones internas (`from public, anon, authenticated`);
  - en las RPCs de cliente, revocar para `public, anon` y hacer `grant` a `authenticated`.

  Ver `20260826035105_harden-function-grants.sql`.

## Tablas principales

| Tabla | Para qué |
|---|---|
| `profiles` | Nombre/avatar (1:1 con `auth.users`, se crea por trigger) |
| `admins` | Quién es admin |
| `memberships` | Plan, créditos por ciclo, `cycle_start`/`cycle_end`, estado (`active`, `paused`, `cancelled`, `expired`) |
| `credit_transactions` | **Ledger de créditos.** El saldo = `sum(amount)` |
| `xp_transactions` | Ledger de XP |
| `user_stats` | Caché de lectura (XP, nivel, racha, saldo), la reconstruyen triggers |
| `instructors`, `bikes` | Catálogos |
| `class_templates` | Horario semanal recurrente |
| `classes` | Ocurrencias concretas (`scheduled` → `completed` \| `cancelled`) |
| `reservations` | `booked` → `cancelled` \| `attended` \| `no_show` |
| `waitlist_entries` | Lista de espera ([reservas.md](reservas.md)) |
| `studio_settings` | Fila única de configuración (`cancellation_cutoff_hours`) |
| `achievements`, `user_achievements` | Logros |
| `notifications` | Log de notificaciones (todavía no se envían como push) |
| `news` | Banners del carrusel del Home ([ui.md](ui.md)). Los miembros leen las `active`; solo el admin escribe |

## RPCs

**Miembros:** `class_availability`, `book_class`, `cancel_reservation`, `join_waitlist`, `leave_waitlist`.

**Admin** (chequean `is_admin()`):

| RPC | Hace |
|---|---|
| `admin_create_membership` | Crea la membresía y otorga los créditos del primer ciclo |
| `admin_grant_credits_bulk` | Renovación manual: otorga créditos y mueve `cycle_start` a hoy |
| `admin_adjust_credits` | Ajuste manual (+/-) con nota |
| `admin_update_class` | Edita una clase; si cambia el horario, notifica a los reservados |
| `admin_cancel_class` | Cancela la clase, reembolsa y notifica |
| `mark_no_show` | Marca una reserva como no-show |
| `admin_save_class_template` | Crea/edita/desactiva una plantilla y re-sincroniza sus clases futuras |
| `search_members` | Lista de miembros con saldo y estado de membresía |

El CRUD simple de `classes`, `instructors` y `bikes` va directo por tabla (la RLS lo permite solo a admins). Las plantillas se escriben solo con `admin_save_class_template` (ver [clases.md](clases.md)).

## Créditos y membresías

- **No hay cobro automático.** El admin renueva a mano (`admin_grant_credits_bulk`) cuando el miembro paga.
- Una membresía vence sola cuando pasa `cycle_end` (cron diario). `book_class` también verifica `cycle_end`.
- Cualquier movimiento de créditos es una fila nueva en `credit_transactions` (`grant`, `booking`, `cancel_refund`, `admin_adjustment`…). Nunca se editan saldos directamente.

## Asistencia y gamificación

- No hay check-in. Al terminar la clase, toda reserva `booked` pasa a `attended` automáticamente y otorga 100 XP. El admin solo marca las excepciones (`mark_no_show`).
- Nivel = 500 XP por nivel (`xp_to_level`).
- Rachas semanales: se cumplen al alcanzar el `weekly_goal` de la membresía. Hay logros por cantidad de clases, rachas y horario.

## Cron jobs (pg_cron)

| Job | Frecuencia | Función |
|---|---|---|
| `close-finished-classes` | cada 15 min | Marca `attended` + XP, cierra la clase |
| `queue-class-reminders` | cada 5 min | Recordatorio 1 h antes |
| `generate-classes-daily` | 03:00 UTC | Genera `classes` desde las plantillas (28 días) |
| `expire-lapsed-memberships` | 03:30 UTC | Vence membresías pasadas de `cycle_end` |
| `update-weekly-streaks` | lunes 00:05 UTC | Rachas y XP semanal |

Horas del estudio: las plantillas se interpretan en `America/Bogota` (ver `20260829050000_studio-timezone.sql`).

## Tests

`tests/smoke.sql` cubre el camino del dinero y la seguridad: doble reserva, RLS, ledger bloqueado, disponibilidad, doble cancelación, promoción desde la lista de espera, plazo de cancelación, XP/logros y RPCs de admin. Todo corre dentro de una transacción con `ROLLBACK`:

```bash
npx supabase db query --linked --file tests/smoke.sql
```

Para probar una migración **antes** de aplicarla, arma un archivo con `BEGIN;` + la migración + el cuerpo del smoke test + `ROLLBACK;` y córrelo con el mismo comando.

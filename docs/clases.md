# Clases, horario semanal e instructores

> **Desde 2026-10-01 el horario se arma semana a semana**, no desde plantillas recurrentes: el estudio sube cada domingo el horario de la semana siguiente y cambia de una semana a otra. En `/admin/schedule` el admin elige la semana (por defecto, la siguiente), agrega/edita/quita clases concretas y puede **Copiar semana anterior** como punto de partida; luego publica. El cron `generate-classes-daily` se desactivó (`20261001020000_weekly-schedule-editor.sql`). Las plantillas y su RPC siguen en la base, sin uso desde la web; lo que sigue sobre plantillas queda como referencia histórica.

Hay dos tipos de filas:

| Tabla | Qué es |
|---|---|
| `class_templates` | El **horario semanal**: "Cycling, lunes 07:00, 60 min, cupo 12, instructor X". No se reserva. |
| `classes` | Cada **ocurrencia concreta** con fecha y hora (`starts_at`). Es lo que ven y reservan los miembros. |

Una clase generada desde una plantilla guarda `template_id`. Una clase suelta (creada a mano) tiene `template_id = null`.

## Generación de clases desde el horario

`generate_classes_from_templates(28)` corre por cron todos los días a las **03:00 UTC (22:00 Bogotá)**. Para cada plantilla activa crea las clases de los próximos 28 días:

- La hora de la plantilla se interpreta en **America/Bogota** y se guarda en UTC. Bogotá no tiene horario de verano, así que no hay saltos.
- Nunca crea clases que ya empezaron.
- Es idempotente: el índice único `(template_id, starts_at)` hace que regenerar el mismo día no duplique nada. Se puede correr a mano cuantas veces se quiera:

  ```sql
  select generate_classes_from_templates(28);
  ```

- `day_of_week`: 0 = domingo … 6 = sábado (igual que `extract(dow)` de Postgres).

```
plantilla (lun 07:00) ──cron diario──▶ classes: lun 5, lun 12, lun 19, lun 26 … (ventana de 28 días)
```

## Publicación semanal

El horario de la semana siguiente se sube los domingos (la hora varía). Las clases se generan igual con 28 días de anticipación, pero los miembros **solo ven y reservan hasta `studio_settings.schedule_published_until`** (fecha de Bogotá, siempre un domingo). El admin ve todo.

- El admin publica con **Publicar semana siguiente** en `/admin/schedule` (`admin_publish_next_week()`). De jueves a domingo publica la semana siguiente; de lunes a miércoles, la actual (subida tarde). Es idempotente.
- Cuando la fecha de publicación avanza, se manda una push `schedule_published` ("Horario publicado") a los miembros activos cuyo periodo pagado cubre esa semana (`20261005175947_notify-schedule-published.sql`). Volver a publicar la misma semana no reenvía nada.
- La RLS de `classes` oculta lo no publicado y un trigger en `reservations` y `waitlist_entries` bloquea reservar/entrar a la lista (`class_not_available`).
- La app explica en **Reservar** y en Home cuándo no hay nada que reservar (`features/bookings/scheduleStatus.ts`): si la semana actual aún no se publica, o si ya terminaron sus clases (o es domingo). En ese caso **Reservar** pasa a la semana siguiente y avisa si ya se puede reservar o si el horario se publica el domingo.

## Guardar una plantilla — `admin_save_class_template()`

Es la **única** forma de escribir plantillas: los inserts y updates directos a `class_templates` están revocados, porque se saltarían la sincronización. Crear, editar y activar/desactivar pasan todos por aquí. En una transacción:

1. Guarda la plantilla.
2. Si es una edición, reconstruye sus clases futuras:
   - **Sin ninguna reserva** → se borran.
   - **Solo con reservas canceladas** → se marcan `cancelled` y se desvinculan (`template_id = null`) para conservar el historial.
   - **Con reservas activas** → no se tocan (hay gente que reservó ese horario).
3. Genera de inmediato las clases de los próximos 28 días (si la plantilla está activa).
4. Devuelve cuántas clases con reservas quedaron **distintas** de la plantilla (otro día u hora, título, instructor, duración o cupo, o plantilla desactivada). El admin web muestra un aviso con ese número para que el admin las revise en **Clases** y decida si mantenerlas, editarlas o cancelarlas (con reembolso).

| Acción | Resultado |
|---|---|
| Crear | Las clases aparecen al instante |
| Editar cualquier campo | Las clases futuras sin reservas se regeneran con los valores nuevos |
| Cambiar día u hora | Igual; sobreviven solo las clases reservadas en el horario viejo, y se avisa |
| Desactivar | Desaparecen las clases futuras sin reservas; las reservadas se mantienen, y se avisa |

No hay borrado de plantillas: se desactivan (soft delete), para no romper el `template_id` de clases pasadas.

## Clases sueltas y excepciones

Una ocurrencia se trata como fila independiente. Editarla o cancelarla nunca toca la plantilla.

| Acción | Cómo | Efecto |
|---|---|---|
| Crear clase suelta | Insert directo en `classes` (RLS: solo admin) | Clase sin plantilla |
| Editar | `admin_update_class()` | Si cambia la hora o la duración, notifica a los que reservaron |
| Cancelar | `admin_cancel_class()` | Cancela las reservas, devuelve el crédito y notifica |

Detalles:
- Bajar el cupo por debajo de las reservas existentes no cancela a nadie; solo impide nuevas reservas.
- Subir el cupo no promueve a la lista de espera: los cupos nuevos quedan libres para cualquiera.

## Ciclo de vida de una clase

```
scheduled ──(termina: starts_at + duración)──▶ completed   (cron cada 15 min)
    │
    └──(admin_cancel_class)──────────────────▶ cancelled
```

Al pasar a `completed`, las reservas `booked` se marcan como `attended` y dan XP (ver [backend.md](backend.md#asistencia-y-gamificación)). Los miembros solo ven clases `scheduled` que aún no empiezan. Las reglas de reserva están en [reservas.md](reservas.md).

## Instructores

Tabla `instructors`: nombre único y `active`. Clases y plantillas referencian `instructor_id` con una FK obligatoria. Antes era texto libre, lo que generaba duplicados ("Andre ojiva" vs "Andre Ojiva").

## Dónde se administra

| Qué | Web admin | App mobile (tab Admin) |
|---|---|---|
| Horario semanal | `/admin/schedule`: grilla por semana con clases concretas: agregar (insert directo), editar (`admin_update_class`), quitar (`admin_cancel_class`), copiar semana anterior y publicar | Tab Admin: misma lógica por semana (navegar semanas, crear/editar/cancelar, copiar semana anterior, publicar) |
| Próximas clases | `/admin/classes`: lista, ocupación, lista de inscritos y cancelar | Crear clase suelta, editar, cancelar |
| Instructores | Se crean desde el formulario de la plantilla | Desde el formulario de la clase |

La primera carga de datos de prueba (`20260829010000_seed-class-templates.sql`) creó "Cycling" de lunes a viernes a las 07, 08, 09 y 10 h con cupo 12.

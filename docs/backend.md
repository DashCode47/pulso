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
| `memberships` | Plan, créditos por ciclo, `cycle_start`/`cycle_end`, estado (`active`, `expired`, `cancelled`) |
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
| `admin_grant_credits_bulk` | Renovación manual: reinicia el saldo a los créditos del plan (no se acumulan) y mueve `cycle_start` a la fecha elegida (por defecto hoy). Renovar dos veces a la misma fecha no hace nada |
| `admin_cancel_membership` | Cancela la membresía, sus reservas futuras y su lista de espera, y deja el saldo en 0 |
| `admin_adjust_credits` | Ajuste manual (+/-) con nota; el saldo no puede quedar negativo |
| `admin_update_class` | Edita una clase; si cambia el horario, notifica a los reservados |
| `admin_cancel_class` | Cancela la clase, reembolsa y notifica |
| `mark_no_show` | Marca no-show (también sobre una reserva ya auto-marcada como asistida; revierte su XP) |
| `admin_save_class_template` | Crea/edita/desactiva una plantilla y re-sincroniza sus clases futuras |
| `search_members` | Lista de miembros con saldo y estado de membresía |

El CRUD simple de `classes`, `instructors` y `bikes` va directo por tabla (la RLS lo permite solo a admins). Las plantillas se escriben solo con `admin_save_class_template` (ver [clases.md](clases.md)).

## Créditos y membresías

- **No hay cobro automático.** El admin renueva a mano (`admin_grant_credits_bulk`) cuando el miembro paga.
- El ciclo dura `cycle_start` + 1 mes − 1 día (`cycle_end` lo calcula un trigger; ambos días incluidos). Fechas en hora de Bogotá (`studio_today()`).
- Solo se puede reservar (o entrar a lista de espera) una clase cuya fecha cae dentro de `cycle_start..cycle_end`.
- Los créditos **no se acumulan**: asignar o renovar deja el saldo exactamente en los créditos del plan (`cycle_reset`).
- Al vencer (cron 00:10 Bogotá) o cancelar, se anulan las reservas futuras y la lista de espera del miembro, y el saldo queda en 0. No hay pausas.
- Cualquier movimiento de créditos es una fila nueva en `credit_transactions` (`grant`, `booking`, `cancel_refund`, `admin_adjustment`…). Nunca se editan saldos directamente.

## Asistencia y gamificación

- No hay check-in. Al terminar la clase, toda reserva `booked` pasa a `attended` automáticamente y otorga 100 XP. El admin solo marca las excepciones (`mark_no_show`).
- Nivel = 500 XP por nivel (`xp_to_level`).
- Ranking (`leaderboard`): uno solo, histórico, ordenado por XP total (el mismo que define el nivel; cuentan clases, bonos y logros). Solo miembros con membresía activa y XP > 0; los empatados comparten puesto. Quien baja de puesto sin haber perdido XP recibe la notificación "Te superaron en el ranking" (`notify_overtaken`, compara contra `leaderboard_snapshot`).
- Rachas semanales: se cumplen al alcanzar el `weekly_goal` de la membresía. Hay logros por cantidad de clases, rachas y horario.

## Cron jobs (pg_cron)

| Job | Frecuencia | Función |
|---|---|---|
| `close-finished-classes` | cada 15 min | Marca `attended` + XP, cierra la clase |
| `queue-class-reminders` | cada 5 min | Recordatorio 1 h antes |
| `generate-classes-daily` | 03:00 UTC | Genera `classes` desde las plantillas (28 días) |
| `expire-lapsed-memberships` | 05:10 UTC (00:10 Bogotá) | Vence membresías pasadas de `cycle_end`, libera sus reservas futuras y deja el saldo en 0 |
| `update-weekly-streaks` | lunes 05:05 UTC (00:05 Bogotá) | Rachas y XP semanal (semanas de Bogotá; vencidos rompen racha) |
| `notify-overtaken` | :07, :22, :37, :52 | Notifica a quien bajó de puesto en el ranking |
| `purge-cron-history` | 09:00 UTC (04:00 Bogotá) | Borra el historial de ejecuciones de cron de más de 7 días |

Horas del estudio: las plantillas se interpretan en `America/Bogota` (ver `20260829050000_studio-timezone.sql`).

## Tests

`tests/smoke.sql` cubre el camino del dinero y la seguridad: doble reserva, RLS, ledger bloqueado, disponibilidad, doble cancelación, promoción desde la lista de espera, plazo de cancelación, XP/logros y RPCs de admin. Todo corre dentro de una transacción con `ROLLBACK`:

```bash
npx supabase db query --linked --file tests/smoke.sql
```

`tests/memberships.sql` cubre las reglas de membresías: reservas solo dentro del período pagado (fechas de Bogotá), créditos que no se acumulan, doble renovación, cancelación y vencimiento liberando reservas, no-show que revierte XP y logros, y la limpieza de reservas heredadas.

Para correr todo localmente (Docker) sin tocar producción:

```bash
npx supabase start
npx supabase db reset --local   # aplica todas las migraciones a la base local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/smoke.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/memberships.sql
```

Para probar una migración **antes** de aplicarla, arma un archivo con `BEGIN;` + la migración + el cuerpo del smoke test + `ROLLBACK;` y córrelo con el mismo comando.

## Backups

> **Estado: no configurado todavía.** El workflow existe pero, mientras falte el secret `SUPABASE_DB_URL`, cada lunes termina con un aviso ("Backups not configured") sin hacer nada. Hasta configurarlo **no hay ninguna copia de la base**: el plan Free de Supabase no guarda backups descargables. Para activarlo, sigue los pasos de abajo.

El plan Free no incluye backups descargables. `.github/workflows/db-backup.yml` corre cada lunes (03:00 Bogotá, o a mano desde la pestaña **Actions** > *DB backup* > *Run workflow*): hace `supabase db dump` de roles, esquema y datos (incluye `auth.users`), lo cifra con GPG y lo sube como artifact por 90 días. El repo es público: el dump nunca se commitea y sin la passphrase el artifact no se puede leer.

No incluye los archivos de Storage (imágenes de noticias y avatares), solo sus URLs.

**Activarlo** (una vez):

1. Supabase Dashboard > proyecto > **Connect** > **Session pooler**: copia la URL (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`) y reemplaza `[YOUR-PASSWORD]` por la contraseña de la base (se puede cambiar en Database > Settings). Tiene que ser el pooler: la conexión directa es solo IPv6 y los runners de GitHub son IPv4.
2. Inventa una passphrase larga y aleatoria (mínimo 16 caracteres) y guárdala **fuera de GitHub** (gestor de contraseñas): sin ella los backups no se pueden descifrar.
3. GitHub > repo > **Settings > Secrets and variables > Actions > New repository secret**: crea `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` con esos valores.
4. **Actions > DB backup > Run workflow** para probarlo: si termina en verde, el archivo `.tar.gz.gpg` aparece en la sección *Artifacts* de esa ejecución.

**Restaurar** (en un proyecto Supabase nuevo, o el mismo tras un desastre):

```bash
gpg -d pulso-db-AAAA-MM-DD.tar.gz.gpg | tar xz          # pide la passphrase
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<connection string del proyecto destino>"
```

`session_replication_role = replica` evita que los triggers (XP, stats, notificaciones) se disparen otra vez al reinsertar los datos.

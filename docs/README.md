# Pulso — cómo funciona la app

App para un estudio de cycling (un solo local, ~60-80 miembros, zona horaria America/Bogota).

| Documento | Contenido |
|---|---|
| [clases.md](clases.md) | Horario recurrente (plantillas), generación de clases, clases sueltas, instructores |
| [reservas.md](reservas.md) | Reservar, cancelar, lista de espera, concurrencia, mensajes de error |
| [backend.md](backend.md) | Tablas, RPCs, seguridad, créditos/membresías, cron jobs, tests |
| [ui.md](ui.md) | Sistema de diseño mobile (paleta, tipografía, patrones), noticias del Home, animación de pulso |

## Arquitectura

```
mobile/   App Expo (React Native) para miembros (y accesos rápidos de admin)
web/      Panel admin en Next.js (clases, horario, miembros)
supabase/ Migraciones SQL: esquema, RLS y toda la lógica de negocio
tests/    smoke.sql: test de regresión del backend
```

- **Toda la lógica de negocio vive en Postgres.** Los clientes leen tablas (filtradas por RLS) y escriben solo vía funciones RPC `SECURITY DEFINER`. No hay servidor propio ni Edge Functions.
- **Mobile:** acceso al backend solo desde `mobile/services/backend/` (nunca importar `@supabase/supabase-js` fuera de ahí). Estado del servidor con React Query (`features/*/use*.ts`).
- **Web:** `web/src/lib/*.ts` envuelve las consultas/RPCs; las páginas están en `web/src/app/admin/`.

## Estado de las pantallas mobile

| Pantalla | Datos |
|---|---|
| Reservar (`bookings`) | Reales |
| Perfil (`profile`) | Reales (historial, cancelar) |
| Admin / Miembros | Reales |
| Noticias (carrusel del Home) | Reales (tabla `news`) |
| Home, Progreso, Leaderboard | Parcialmente **mock** (`features/*/mockData.ts`) |

## Correr y probar

```bash
cd mobile && npm start          # app móvil
cd web && npm run dev           # panel admin
npx supabase db push            # aplicar migraciones pendientes al proyecto enlazado
npx supabase db query --linked --file tests/smoke.sql   # test backend (hace ROLLBACK)
```

## Mantener estos docs

Si un cambio altera un flujo descrito aquí (reglas de reserva, RPCs, crons, settings), actualiza el doc en el mismo PR. El *por qué* de cada cambio de base de datos está en el comentario de cabecera de su migración.

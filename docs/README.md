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
tests/    smoke.sql + memberships.sql: tests de regresión del backend
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
| Leaderboard | Datos reales (vista `leaderboard`) |
| Home, Progreso | Reales (`user_stats`, ranking, logros; `features/progress/useMyProgress.ts`) |

## Correr y probar

```bash
cd mobile && npm start          # app móvil
cd web && npm run dev           # panel admin
npx supabase db push            # aplicar migraciones pendientes al proyecto enlazado
npx supabase db query --linked --file tests/smoke.sql        # test backend (hace ROLLBACK)
npx supabase db query --linked --file tests/memberships.sql  # reglas de membresías
```

## Compilar la app Android

La app usa un **development build** (`expo-dev-client`), no Expo Go: trae módulos nativos (`expo-image-manipulator`, notificaciones push) y Fast Refresh contra Metro.

```bash
cd mobile
npm run android    # expo run:android: compila, instala en el emulador/dispositivo y arranca Metro
npm start          # día a día, con el build ya instalado
```

Hay que **recompilar** (`npm run android`) cada vez que se agrega o actualiza una dependencia nativa o se cambia `app.json`; los cambios de JS/TSX llegan solos por Fast Refresh. Si Android rechaza la instalación por firma distinta (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, p. ej. venías de una APK de EAS), desinstala primero: `adb uninstall com.pulso.mobile`.

### `google-services.json` (Firebase, push en Android)

`app.json` > `android.googleServicesFile` apunta a `mobile/google-services.json`. El archivo está en `.gitignore` porque el repo es público: **no se commitea**, cada máquina lo tiene en disco (se descarga desde la consola de Firebase > configuración del proyecto > app Android).

- **Build local** (`npm run android`): lo lee del disco, no hay que hacer nada.
- **Build en la nube con EAS** (`eas build`): EAS no sube archivos ignorados por git, así que el build fallaría. Antes del primer build en EAS:
  1. Súbelo como variable de tipo archivo: `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production` (repetir para `development`/`preview` si se usan esos perfiles).
  2. Pasa `app.json` a `app.config.js` para leerlo de ahí: `android.googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`.

## Pendientes de configuración

- **Backups de la base: no configurados.** El workflow semanal existe, pero hasta cargar sus dos secrets en GitHub no se guarda ninguna copia (el plan Free de Supabase no tiene backups descargables). Pasos en [backend.md](backend.md#backups).
- **`google-services.json` en EAS**: solo hace falta el día que se compile en la nube (ver arriba).
- **SMTP propio para Auth** (p. ej. Resend): sin él Supabase solo envía emails de Auth a los miembros del equipo y con un límite bajo por hora. Hoy no se usa (sin confirmación de email ni "olvidé mi contraseña"); necesario antes de agregar recuperación de contraseña.

## Mantener estos docs

Si un cambio altera un flujo descrito aquí (reglas de reserva, RPCs, crons, settings), actualiza el doc en el mismo PR. El *por qué* de cada cambio de base de datos está en el comentario de cabecera de su migración.

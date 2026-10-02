# UI mobile: diseño, noticias y animación de pulso

## Sistema de diseño

Todo sale de `mobile/theme/index.ts`. No uses hex sueltos en los componentes: si falta un color, agrégalo como token.

La paleta es monocromática, sacada del logo (negro + blanco marfil):

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#000000` | Fondo de todas las pantallas (el mismo negro del logo) |
| `surface` / `surfaceAlt` | `#111111` / `#1A1A1A` | Tarjetas / elementos dentro de tarjetas, pista de las barras de progreso |
| `border` | `#262626` | Borde fino (`StyleSheet.hairlineWidth`) de las tarjetas |
| `ink` / `inkSoft` / `inkMuted` | marfil / gris / gris oscuro | Texto principal / secundario / etiquetas |
| `accent` + `onAccent` | `#F5F3EE` + `#000000` | Botones principales y lo destacado: fondo marfil, texto negro |
| `success`, `danger` (+ `successSoft`, `dangerSoft`) | verde / rojo apagados | **Solo estados** (libre, completa, no-show, errores). `*Soft` es el fondo del badge |

Reglas:

- El acento es el marfil, no un color. El color solo aparece para comunicar un estado.
- Máximo un bloque "invertido" (fondo marfil) por pantalla. Ejemplo: la tarjeta "Tu próxima clase" del Home.
- Botón deshabilitado = `opacity: 0.3`, no un gris.

Patrones:

- **Tarjeta:** `surface` + borde hairline `border` + `radius.md` o `radius.lg`.
- **Botón principal:** fondo `accent`, `radius.pill`, texto `onAccent` en peso 700.
- **Al presionar:** `style={({ pressed }) => [styles.x, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}`.
- **Título de sección:** `type.eyebrow` en `inkMuted` (mayúsculas con espaciado), en vez de un `h2`.

**Diálogos:** usa `showAlert` (`components/Dialog.tsx`), nunca `Alert.alert`: el `Alert` nativo no se puede estilizar. Tiene la misma firma, así que se usa igual:

```ts
showAlert('Cancelar reserva', 'Se te devolverá el crédito.', [
  { text: 'No', style: 'cancel' },
  { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancel() },
]);
showAlert('Error', 'No se pudo cancelar.'); // sin botones = un solo "Entendido"
```

Estilos de botón: `default` es marfil, `cancel` es gris y `destructive` va con borde rojo. Tocar afuera o el botón atrás de Android equivale al botón `cancel`. Hay un solo diálogo a la vez: `<DialogHost />` está montado en `app/_layout.tsx`, y un diálogo nuevo reemplaza al que esté abierto.

Tipografía (`type`): `display` 34 · `title` 28 · `h2` 18 · `body` 15 · `label` 13 · `caption` 12 · `eyebrow` 11 en mayúsculas. Usa la fuente del sistema; no hay fuentes custom.

Tema oscuro global: `app/_layout.tsx` envuelve la app en `ThemeProvider` (el `DarkTheme` de expo-router con la paleta) y `app.json` usa `userInterfaceStyle: "dark"`. Así las escenas, la tab bar y las transiciones no hacen flash blanco. `StatusBar` va en `light`.

## Noticias (banners del Home)

- **Carrusel:** `components/NewsCarousel.tsx`, solo en el Home de miembros. Se detiene en cada banner, el siguiente asoma por la derecha y los puntos se animan. No avanza solo.
- **Detalle:** `app/news/[id].tsx`, en el Stack raíz y protegido por sesión. Tiene una imagen grande con parallax que se funde al negro, el cuerpo en párrafos y un botón opcional (`cta`).
- **Datos:** tabla `news` en Supabase (migración `20260926174019_news.sql`). La app la lee con `listNews()` (`services/backend/news.ts`) a través del hook `useNews()` (`features/home/useNews.ts`). Home y detalle comparten la misma caché, así que al abrir un banner el detalle ya está cargado.
- Mientras carga, el Home muestra un placeholder del mismo alto con el pulso. Si falla o no hay noticias activas, el carrusel no aparece.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid | Va en la URL: `/news/<id>` |
| `tag` | text | Etiqueta corta ("Reto", "Nuevo") |
| `title`, `subtitle` | text | En el detalle, el `subtitle` es la bajada |
| `body` | text[] | Un párrafo por elemento |
| `image_url` | text | Hoy son fotos de relleno de Unsplash en B/N (parámetro `sat=-100`) |
| `cta_label`, `cta_href` | text | Botón opcional: van los dos o ninguno. `cta_href` solo acepta `/bookings`, `/progress` o `/leaderboard` (check en la tabla) |
| `published_at` | timestamptz | Fecha que se muestra y orden del carrusel (más nueva primero) |
| `active` | boolean | `false` la oculta sin borrarla |

Las RLS: los miembros leen solo las filas `active`; solo el admin (`is_admin()`) inserta, edita o borra.

Publicar una noticia (hoy desde el SQL editor de Supabase; todavía no hay pantalla en el panel web):

```sql
insert into news (tag, title, subtitle, body, image_url, cta_label, cta_href)
values ('Nuevo', 'Título', 'Bajada corta', array['Párrafo 1', 'Párrafo 2'],
        'https://…', 'Reservar', '/bookings');

update news set active = false where title = 'Título';  -- ocultarla
```

## Animación de pulso — `PulseLine`

`mobile/components/PulseLine.tsx` dibuja la línea de electrocardiograma del logo (onda P, complejo QRS, onda T).

**Cómo funciona:** la línea es un SVG estático (`react-native-svg`). Lo único que se anima es una máscara del color del fondo, con un degradado, que se desliza encima (`translateX` con `useNativeDriver: true`). Como la línea siempre avanza hacia la derecha, deslizar la máscara equivale a trazarla. La animación corre en el hilo nativo y no gasta JS en cada cuadro, igual que un `ActivityIndicator`. Por eso no se traba aunque JS esté ocupado cargando datos.

> ⚠️ **`bg` tiene que ser el color sólido que hay detrás**, en hex `#RRGGBB` (el componente le agrega `00` para la parte transparente). Si no coincide, se ve un rectángulo del color equivocado. No funciona sobre fotos ni degradados.

| Prop | Default | |
|---|---|---|
| `width`, `height` | 64, 24 | El tamaño de loader |
| `color` | `colors.ink` | Color de la línea |
| `bg` | `colors.bg` | Color de lo que hay detrás (ver aviso) |
| `strokeWidth` | 2 | |
| `mode` | `loop` | `loop`: monitor continuo con estela. `once`: se dibuja una vez y queda fija |
| `duration` | 1400 ms | Duración de cada barrido |
| `style` | — | Para posicionarla, p. ej. `alignSelf: 'center'` |

Si el usuario tiene activado "reducir movimiento" en el teléfono, se muestra la línea quieta.

Dónde se usa:

| Lugar | Modo | Nota |
|---|---|---|
| Carga inicial (`app/_layout.tsx`) | `loop` | Mientras se carga la sesión |
| Login y registro (`components/Wordmark.tsx`) | `once` | El logo "PULSO" está hecho en código; la línea se dibuja al entrar |
| Home, tarjeta "Tu próxima clase" | `loop` | Solo si la clase es hoy. Lleva `bg={colors.accent}` |
| Cargas de contenido: Reservar, Perfil, Admin, Miembros | `loop` | En lugar del spinner. Dentro de la tarjeta de un miembro lleva `bg={colors.surface}` |

**¿Pulso o spinner?**

- **Cargando contenido** (una pantalla, una lista, una sección): `<PulseLine style={{ alignSelf: 'center' }} />`.
- **Dentro de un botón** mientras se procesa una acción: `ActivityIndicator`. En unos 20 px de alto la línea no se lee, y el spinner es la señal estándar de "procesando tu toque".

## Pendientes

- Logo en alta resolución (PNG o SVG con fondo transparente) para el ícono de la app y el splash, que hoy son los de Expo por defecto. El `Wordmark` aproxima el logo con la fuente del sistema.
- Pantalla en el panel web para publicar noticias (hoy se hace por SQL).

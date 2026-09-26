-- Pulso: news (banners del carrusel del Home)
-- Reemplaza el mock mockNews de la app. Los miembros leen las noticias
-- activas; solo el admin escribe (por ahora desde el SQL editor, todavía no
-- hay pantalla en el panel web).

create table news (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  title text not null,
  subtitle text not null,
  body text[] not null default '{}', -- un párrafo por elemento
  image_url text not null,
  -- Botón opcional del detalle. href solo puede ser una pestaña que la app
  -- sabe abrir (tipo NewsItem['cta']['href'] en mobile/services/backend/news.ts).
  cta_label text,
  cta_href text check (cta_href in ('/bookings', '/progress', '/leaderboard')),
  published_at timestamptz not null default now(), -- fecha visible y orden del carrusel
  active boolean not null default true, -- false = oculta sin borrarla
  created_at timestamptz not null default now(),
  constraint news_cta_complete check ((cta_label is null) = (cta_href is null))
);

alter table news enable row level security;
create policy "read active news" on news for select to authenticated using (active);
create policy "admin write news" on news for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on news to authenticated;

-- Seed: las mismas 4 noticias que tenía el mock. Fotos de relleno de Unsplash
-- en B/N (sat=-100).
insert into news (tag, title, subtitle, body, image_url, cta_label, cta_href, published_at) values
(
  'Reto',
  'Reto Octubre',
  '12 clases en 30 días. Completa el reto y gana un mes de membresía.',
  array[
    'Este octubre subimos la intensidad. El reto es simple: completa 12 clases entre el 1 y el 31 de octubre.',
    'Cada clase que termines suma a tu progreso en la app. Quienes lleguen a 12 entran al sorteo de un mes de membresía ilimitada, y el top 3 del ranking mensual se lleva un kit Pulso.',
    'No necesitas inscribirte: el reto empieza a contar automáticamente con tu primera reserva del mes.'
  ],
  'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=1200&q=80&sat=-100&auto=format&fit=crop',
  'Reservar mi clase',
  '/bookings',
  '2026-10-01 12:00-05'
),
(
  'Nuevo',
  'Ride & Stretch',
  '45 minutos de ride + 15 de movilidad. Estreno este viernes.',
  array[
    'Presentamos Ride & Stretch: una sesión que combina 45 minutos de ride a ritmo alto con 15 minutos guiados de movilidad y estiramiento.',
    'Ideal para cerrar la semana, recuperar mejor y evitar lesiones. Cupos limitados en el horario de estreno.'
  ],
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80&sat=-100&auto=format&fit=crop',
  'Ver horarios',
  '/bookings',
  '2026-09-24 12:00-05'
),
(
  'Comunidad',
  'Pulso Run Club',
  'Salida grupal cada domingo a las 7:00. Todos los niveles.',
  array[
    'La comunidad Pulso sale del estudio. Cada domingo a las 7:00 nos encontramos en la puerta para una salida grupal de 5K.',
    'Hay grupos por ritmo, así que nadie corre solo. Al volver, café para todos.'
  ],
  'https://images.unsplash.com/photo-1594882645126-14020914d58d?w=1200&q=80&sat=-100&auto=format&fit=crop',
  null,
  null,
  '2026-09-20 12:00-05'
),
(
  'Horarios',
  'Más clases el fin de semana',
  'Sumamos turnos sábados y domingos desde las 8:00.',
  array[
    'Escuchamos sus pedidos: a partir de octubre abrimos turnos adicionales los sábados y domingos, desde las 8:00 hasta las 12:00.',
    'Las reservas se habilitan como siempre, con 7 días de anticipación.'
  ],
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80&sat=-100&auto=format&fit=crop',
  'Reservar',
  '/bookings',
  '2026-09-15 12:00-05'
);

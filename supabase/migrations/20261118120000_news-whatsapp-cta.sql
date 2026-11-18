-- Botón del detalle de noticia: además de las pestañas, puede abrir un chat de
-- WhatsApp (https://wa.me/<solo dígitos, con indicativo>).
alter table news drop constraint news_cta_href_check;
alter table news add constraint news_cta_href_check
  check (cta_href in ('/bookings', '/progress', '/leaderboard') or cta_href ~ '^https://wa\.me/[0-9]{8,15}$');

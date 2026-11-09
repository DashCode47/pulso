-- WhatsApp number behind the app's "Soporte" button. International format,
-- digits only (e.g. 573001234567). Null: the app falls back to the web
-- support page. Existing RLS covers it (members read, admins write).
alter table public.studio_settings
  add column support_whatsapp text check (support_whatsapp ~ '^[0-9]{8,15}$');

// Public pages served by web/src/app/(legal). Required by the stores.
// ponytail: Vercel default domain, swap for the custom domain once there is one
const WEB_URL = 'https://pulso-web-mu.vercel.app';

// Number comes from studio_settings.support_whatsapp; null → web page.
export function supportUrl(whatsapp: string | null | undefined) {
  return whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, necesito ayuda con Pulso')}`
    : `${WEB_URL}/soporte`;
}

export const LEGAL_LINKS = {
  terms: `${WEB_URL}/terminos`,
  privacy: `${WEB_URL}/privacidad`,
};

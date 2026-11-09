// Public pages served by web/src/app/(legal). Required by the stores.
// ponytail: Vercel default domain, swap for the custom domain once there is one
const WEB_URL = 'https://pulso-web-mu.vercel.app';

// Number comes from studio_settings.support_whatsapp (set in admin settings).
export const whatsappUrl = (number: string) =>
  `https://wa.me/${number}?text=${encodeURIComponent('Hola, tengo una duda')}`;

export const LEGAL_LINKS = {
  support: `${WEB_URL}/soporte`,
  terms: `${WEB_URL}/terminos`,
  privacy: `${WEB_URL}/privacidad`,
};

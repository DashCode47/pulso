// Live mocks of the two places a news image renders in the app --
// mobile/components/NewsCarousel.tsx (Home) and mobile/app/news/[id].tsx
// (detail hero). Values below are copied 1:1 from those files (not a
// screenshot pipeline) so the preview updates instantly as the admin types
// and stays a plain CSS box, no separate rendering step to keep in sync.
//
// Same image, two very different crops: the carousel card is short and wide,
// the detail hero is tall (full device width) -- that mismatch is exactly
// why both need to be shown, not just one.
//
// Both boxes use `object-fit: cover` (RN's default Image resizeMode), which
// crops from the center to fill the box -- so the box's exact aspect ratio
// determines how much gets cropped, and that ratio varies by real device
// (phones range ~360-430pt wide). No single width previews every device
// exactly; 428 (iPhone 14 Plus/13 Pro Max -- one of the widest common
// phones) is used deliberately as the *worst case* for the card: a wider
// screen crops more off the top/bottom of the card image, so if it looks
// right here, narrower phones will show strictly more of the image, never
// less. Getting the two boxes' widths right matters too: the card subtracts
// the app's horizontal padding (spacing.xxl * 2 = 48) but the detail hero
// does not (it spans the full screen), so reusing one width for both
// under-crops one of them.
const REFERENCE_DEVICE_WIDTH = 428;
const CARD_GUTTER = 24; // spacing.xxl in mobile/theme
const CARD_WIDTH = REFERENCE_DEVICE_WIDTH - CARD_GUTTER * 2;
const DETAIL_WIDTH = REFERENCE_DEVICE_WIDTH;

// ponytail: plain <img>, not next/image -- admins paste arbitrary external
// URLs (any host), and next/image requires each remote host allow-listed in
// next.config.ts. Revisit if uploads ever move behind one known domain
// (e.g. Supabase Storage), then next/image + remotePatterns becomes worth it.

// Approximates each platform's system font instead of the admin panel's own
// Geist brand font, since that's what the app itself actually renders with.
const systemFontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

type PreviewProps = {
  tag: string;
  title: string;
  subtitle: string;
  imageUrl: string;
};

export function CardPreview({ tag, title, subtitle, imageUrl }: PreviewProps) {
  return (
    <div
      className="relative overflow-hidden bg-surface-alt"
      style={{
        width: CARD_WIDTH,
        height: 210,
        borderRadius: 20,
        fontFamily: systemFontStack,
      }}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-0 rounded-[20px]"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.88) 100%)',
          border: '1px solid rgba(245,243,238,0.14)',
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <span
          className="self-start rounded-full px-3 py-1"
          style={{
            border: '1px solid rgba(245,243,238,0.4)',
            background: 'rgba(0,0,0,0.35)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: '#F5F3EE',
          }}
        >
          {tag || 'Tag'}
        </span>
        <div className="space-y-1">
          <p
            className="line-clamp-2"
            style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: '#F5F3EE' }}
          >
            {title || 'Título de la noticia'}
          </p>
          <p className="line-clamp-2" style={{ fontSize: 13, lineHeight: '18px', color: '#A1A09C' }}>
            {subtitle || 'Subtítulo breve que resume la noticia.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DetailPreview({ tag, title, imageUrl, publishedAt }: PreviewProps & { publishedAt: string }) {
  const dateLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Fecha';

  return (
    <div className="relative overflow-hidden bg-black" style={{ width: DETAIL_WIDTH, height: 460, fontFamily: systemFontStack }}>
      {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 60%, #000000 100%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-4">
        <span
          className="self-start rounded-full px-3 py-1"
          style={{ background: '#F5F3EE', fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: '#000000' }}
        >
          {tag || 'Tag'}
        </span>
        <p style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: '#F5F3EE', lineHeight: 1.05 }}>
          {title || 'Título de la noticia'}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: '#A1A09C' }}>{dateLabel}</p>
      </div>
    </div>
  );
}

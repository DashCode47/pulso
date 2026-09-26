import { backend } from './client';

export type NewsItem = {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  date: string; // ISO (published_at)
  image: string;
  body: string[];
  // href: mismas pestañas que permite el check de news.cta_href.
  cta?: { label: string; href: '/bookings' | '/progress' | '/leaderboard' };
};

// RLS ("read active news") ya filtra las inactivas.
export async function listNews(): Promise<NewsItem[]> {
  const { data, error } = await backend
    .from('news')
    .select('id, tag, title, subtitle, body, image_url, cta_label, cta_href, published_at')
    .order('published_at', { ascending: false });
  if (error) throw error;

  return data.map((n) => ({
    id: n.id,
    tag: n.tag,
    title: n.title,
    subtitle: n.subtitle,
    date: n.published_at,
    image: n.image_url,
    body: n.body,
    cta: n.cta_label && n.cta_href ? { label: n.cta_label, href: n.cta_href as NonNullable<NewsItem['cta']>['href'] } : undefined,
  }));
}

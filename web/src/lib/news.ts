import { createClient } from '@/lib/supabase/client';

export type NewsCtaHref = '/bookings' | '/progress' | '/leaderboard';

export type NewsItem = {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  body: string[];
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: NewsCtaHref | null;
  publishedAt: string; // ISO
  active: boolean;
};

export type NewsInput = {
  tag: string;
  title: string;
  subtitle: string;
  body: string[];
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: NewsCtaHref | null;
  publishedAt: string; // ISO
  active: boolean;
};

function fromRow(n: {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  body: string[];
  image_url: string;
  cta_label: string | null;
  cta_href: string | null;
  published_at: string;
  active: boolean;
}): NewsItem {
  return {
    id: n.id,
    tag: n.tag,
    title: n.title,
    subtitle: n.subtitle,
    body: n.body,
    imageUrl: n.image_url,
    ctaLabel: n.cta_label,
    ctaHref: n.cta_href as NewsCtaHref | null,
    publishedAt: n.published_at,
    active: n.active,
  };
}

function toRow(input: NewsInput) {
  return {
    tag: input.tag,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    image_url: input.imageUrl,
    cta_label: input.ctaLabel,
    cta_href: input.ctaHref,
    published_at: input.publishedAt,
    active: input.active,
  };
}

// "admin write news" is declared FOR ALL, which covers select too -- so this
// already returns inactive rows for an admin, no separate policy needed.
export async function listAllNews(): Promise<NewsItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('news')
    .select('id, tag, title, subtitle, body, image_url, cta_label, cta_href, published_at, active')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createNews(input: NewsInput) {
  const supabase = createClient();
  const { error } = await supabase.from('news').insert(toRow(input));
  return { error };
}

export async function updateNews(id: string, input: NewsInput) {
  const supabase = createClient();
  const { error } = await supabase.from('news').update(toRow(input)).eq('id', id);
  return { error };
}

export async function setNewsActive(id: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from('news').update({ active }).eq('id', id);
  return { error };
}

export async function deleteNews(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('news').delete().eq('id', id);
  return { error };
}

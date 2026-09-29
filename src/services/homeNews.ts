/**
 * Carte « Actu de ta box » de l'Accueil (refonte R3a) : dernier article récent
 * de la box active, avec ses nombres de likes et de commentaires, en une
 * seule requête.
 */
import { supabase } from '../lib/supabase';
import { readRows } from '../lib/db';

export const NEWS_MAX_AGE_DAYS = 14;
export const NEWS_FRESH_HOURS = 48;

const HOUR = 3_600_000;

export type HomeNews = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  likes: number;
  comments: number;
};

/** Dernier article publié il y a moins de 14 jours dans la box, ou null (aucune requête sans box). */
export async function fetchHomeNews(boxId: string | undefined, now: Date = new Date()): Promise<HomeNews | null> {
  if (!boxId) return null;
  const since = new Date(now.getTime() - NEWS_MAX_AGE_DAYS * 24 * HOUR).toISOString();
  const rows = await readRows(
    supabase
      .from('box_articles')
      .select('id, title, body, image_url, created_at, box_article_likes(count), box_article_comments(count)')
      .eq('box_id', boxId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1),
    { screen: 'Home', action: 'news' },
  );
  const row = rows?.[0];
  if (!row || !isRecentNews(row.created_at, now)) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    image_url: row.image_url,
    created_at: row.created_at,
    likes: row.box_article_likes?.[0]?.count ?? 0,
    comments: row.box_article_comments?.[0]?.count ?? 0,
  };
}

const ageMs = (createdAt: string, now: Date) => now.getTime() - new Date(createdAt).getTime();

/** Publié il y a moins de 14 jours. */
export function isRecentNews(createdAt: string, now: Date = new Date()): boolean {
  return ageMs(createdAt, now) < NEWS_MAX_AGE_DAYS * 24 * HOUR;
}

/** Publié il y a moins de 48 heures : étiquette « Nouveau ». */
export function isFreshNews(createdAt: string, now: Date = new Date()): boolean {
  return ageMs(createdAt, now) < NEWS_FRESH_HOURS * HOUR;
}

/** Âge de l'article en clé de traduction relative (`home.news.ago.*`). */
export function newsAge(createdAt: string, now: Date = new Date()): { key: string; count: number } {
  const minutes = Math.max(0, Math.floor(ageMs(createdAt, now) / 60_000));
  if (minutes < 1) return { key: 'home.news.ago.now', count: 0 };
  if (minutes < 60) return { key: 'home.news.ago.minutes', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: 'home.news.ago.hours', count: hours };
  return { key: 'home.news.ago.days', count: Math.floor(hours / 24) };
}

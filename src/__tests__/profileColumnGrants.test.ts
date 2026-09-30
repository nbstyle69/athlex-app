/**
 * Garde structurelle des droits de colonne de `profiles` (Lot 0-bis et suivants).
 *
 * `authenticated` n'a pas SELECT sur la table, seulement sur une liste de
 * colonnes. Un `select` qui en mentionne une autre échoue en 42501 — et il fait
 * échouer TOUTE la requête, y compris la partie légitime : un classement ou une
 * liste de membres disparaît en silence pour une seule colonne de trop
 * (WODDetailScreen, puis la liste « Membres » de Ma Box au build 1.0.58).
 *
 * Liste BLANCHE : toute colonne lue sur `profiles` — par `from('profiles')` ou
 * par une jointure `profiles(…)`, `profiles:fk(…)`, `profiles!fk(…)` — doit y
 * figurer. Les colonnes privées (`full_name`, `gender`, `personal_records`,
 * `email`, `onboarding_completed_at`) se lisent par RPC (`get_my_profile`,
 * `get_athlete_private_profile`, `get_box_members_private_profiles`).
 */
import fs from 'fs';
import path from 'path';

/**
 * Colonnes de `public.profiles` lisibles par `authenticated`, relevées en prod le
 * 30/09/2026 en lecture seule (`has_column_privilege('authenticated', …, 'SELECT')`).
 * Non accordées ce jour-là : email, full_name, gender, onboarding_completed_at,
 * personal_records. Une colonne ajoutée ici doit d'abord être accordée en base.
 */
const GRANTED = new Set([
  'avatar_url', 'bio', 'created_at', 'elo', 'featured_badges', 'id', 'level', 'losses',
  'referral_code', 'referred_by', 'role', 'total_friends', 'total_matches',
  'total_messages_sent', 'total_scores_submitted', 'total_timer_sessions',
  'total_tournament_wins', 'total_tournaments', 'total_wods_generated', 'username', 'wins',
]);
const SRC = path.join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Contenu entre la parenthèse ouvrante `open` et sa fermante. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** Colonnes de premier niveau d'une liste PostgREST ; les jointures imbriquées sont ignorées. */
function topLevelColumns(list: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of list + ',') {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  return out
    .filter(item => item && !item.includes('('))
    .map(item => item.split(':').pop()!.split('->')[0].trim());
}

/**
 * Listes de colonnes lues sur `profiles` dans un fichier source.
 * ponytail: un embed nommé seulement par sa clé étrangère (`author:author_id(…)`,
 * sans le mot `profiles`) n'est pas reconnu ; aucun n'existe au 30/09/2026.
 */
function profileSelections(code: string): string[] {
  const lists: string[] = [];
  const selects = [...code.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g)].map(m => m[2]);
  for (const sel of selects) {
    for (const m of sel.matchAll(/\bprofiles(?:\s*[:!]\s*\w+)*\s*\(/g)) {
      lists.push(balanced(sel, m.index! + m[0].length - 1));
    }
  }
  for (const m of code.matchAll(/\.from\(\s*['"`]profiles['"`]\s*\)/g)) {
    const chain = code.slice(m.index! + m[0].length).split(/;|\.from\(/)[0];
    const sel = chain.match(/\.select\(\s*(?:(['"`])([\s\S]*?)\1)?/);
    if (sel) lists.push(sel[1] ? sel[2].replace(/\$\{[^}]*\}/g, '') : '*');
  }
  return lists;
}

function forbiddenColumns(code: string): string[] {
  return profileSelections(code).flatMap(topLevelColumns).filter(col => !GRANTED.has(col));
}

describe('colonnes de profiles accordées à authenticated', () => {
  const files = walk(SRC);

  it('trouve bien les fichiers source et leurs lectures de profiles', () => {
    expect(files.length).toBeGreaterThan(50);
    const total = files.reduce((n, f) => n + profileSelections(fs.readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(40);
  });

  it('reconnaît les trois formes de jointure et la lecture directe', () => {
    expect(forbiddenColumns(`.select('id, profiles(username, full_name)')`)).toEqual(['full_name']);
    expect(forbiddenColumns(`.select('role, profiles:member_id(id, full_name, elo)')`)).toEqual(['full_name']);
    expect(forbiddenColumns(`.select('x, author:profiles!fk_author(username, gender)')`)).toEqual(['gender']);
    expect(forbiddenColumns(`.from('profiles')\n  .select('id, email')`)).toEqual(['email']);
    expect(forbiddenColumns(`.from('profiles').select('*')`)).toEqual(['*']);
    expect(forbiddenColumns(`.from('profiles').update({ a: 1 }).select()`)).toEqual(['*']);
    expect(forbiddenColumns(`.from('profiles').select('id, box_members(box:boxes(name))')`)).toEqual([]);
    expect(forbiddenColumns(`.from('profiles').update({ personal_records: x }).eq('id', u);`)).toEqual([]);
    expect(forbiddenColumns(`.from('boxes').select('email, owner:profiles!owner_id(username)')`)).toEqual([]);
  });

  it('aucune lecture de profiles ne demande une colonne non accordée', () => {
    const faults: string[] = [];
    for (const file of files) {
      for (const col of forbiddenColumns(fs.readFileSync(file, 'utf8'))) {
        faults.push(`${path.relative(SRC, file)} → ${col}`);
      }
    }
    expect(faults).toEqual([]);
  });
});

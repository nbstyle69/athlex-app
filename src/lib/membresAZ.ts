/**
 * Liste des membres de A à Z pour la feuille « Choisir un membre » (D4b) :
 * comparaison sans accents ni casse, regroupement sous la lettre, filtre.
 */

export type MembreAZ = { user_id: string; username: string };
export type SectionAZ = { lettre: string; membres: MembreAZ[] };

/** Lettres de l'index, dans l'ordre ; « # » regroupe ce qui ne commence pas par une lettre. */
export const LETTRES_AZ = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

/** Forme de comparaison : sans accents (é → e, Œ → oe…), en minuscules, espaces bordants retirés. */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .trim();
}

/** Lettre d'un pseudo : sa première lettre sans accent, ou « # ». */
export function lettreDe(username: string): string {
  const c = normaliser(username).charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

/** Tri de A à Z sans accents ni casse ; « # » en dernier ; à égalité, ordre stable par identifiant. */
export function trierMembres(membres: MembreAZ[]): MembreAZ[] {
  const rang = (m: MembreAZ) => (lettreDe(m.username) === '#' ? 1 : 0);
  return [...membres].sort((a, b) =>
    rang(a) - rang(b)
    || (normaliser(a.username) < normaliser(b.username) ? -1 : normaliser(a.username) > normaliser(b.username) ? 1 : 0)
    || (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
}

/** Sections par lettre, dans l'ordre de l'index ; seules les lettres présentes. */
export function grouperParLettre(membres: MembreAZ[]): SectionAZ[] {
  const sections: SectionAZ[] = [];
  for (const m of trierMembres(membres)) {
    const l = lettreDe(m.username);
    const der = sections[sections.length - 1];
    if (der && der.lettre === l) der.membres.push(m);
    else sections.push({ lettre: l, membres: [m] });
  }
  return sections;
}

/** Membres dont le pseudo contient la saisie (sans accents ni casse), triés ; saisie vide → tous. */
export function filtrerMembres(membres: MembreAZ[], saisie: string): MembreAZ[] {
  const q = normaliser(saisie);
  return trierMembres(q ? membres.filter((m) => normaliser(m.username).includes(q)) : membres);
}

/** Section où mène une lettre de l'index : la sienne, sinon la suivante présente, sinon la dernière. */
export function sectionPourLettre(sections: SectionAZ[], lettre: string): string | null {
  if (sections.length === 0) return null;
  const i = LETTRES_AZ.indexOf(lettre);
  for (const l of LETTRES_AZ.slice(i)) if (sections.some((s) => s.lettre === l)) return l;
  return sections[sections.length - 1].lettre;
}

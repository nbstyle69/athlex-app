/**
 * Texte des blocs d'une séance de box (étude i18n « Moteur », M3).
 *
 * `generateSession` construit pour chaque bloc une charge utile `RenduBlocSeance`, rangée
 * dans `wod_json.rendu` : tout ce que le texte du bloc contient, calculé à partir de
 * valeurs DÉJÀ tirées (noms du catalogue, charges, ordre des postes, échauffement…),
 * sans aucun tirage. Le texte du bloc est produit par `rendreBlocSeance` à partir de
 * cette seule charge utile : à la génération (français, texte enregistré) comme au
 * réaffichage (`renderFromWodJson`, dans la langue de l'athlète). Les textes venus de la
 * banque y restent en français et se traduisent au rendu (`banqueVers`).
 */
import { fr } from './i18n/fr';
import { banqueVers, nomMouvement, textes } from './i18n';
import type { Langue, Textes } from './i18n';
import type { StrengthStep } from './types';

/** Un poste de station, d'enchaînement ou de course compromise. */
export interface PosteRendu {
  id: string;
  qty: number;
  unit: string;
  /** nom affiché propre à la banque (sinon le nom du catalogue, dans `noms`) */
  name?: string;
  /** hauteur de box (cm), hommes / femmes */
  box?: [number, number];
  /** charge du poste, hommes / femmes / unité */
  charge?: [number, number, string];
  /** charge portée en plus (`load_from`), hommes / femmes / unité */
  extra?: [number, number, string];
}

/** Charge Pro d'un poste chargé. */
export interface ProRendu { id: string; name?: string; men: number; women: number; unit: string }

/** Contenu d'un bloc A ou d'un bloc de travail écrit. */
export type ContenuBloc =
  | { kind: 'weightlifting'; movement: string; complex: string[]; variante: 'A' | 'B'; steps: StrengthStep[] }
  | { kind: 'strength'; movement: string; steps: StrengthStep[]; tempo: string | null }
  | {
    kind: 'skill'; movement: string;
    skill: { reps: number; rounds: number; every_s: number; progression: { a: string; b: string }; substitutions: Record<string, string> };
  }
  | { kind: 'station'; movement: string; every_s: number; rounds: number; postes: PosteRendu[]; pro: ProRendu[]; lourd: boolean }
  | { kind: 'run'; movement: string; variante: { label: string; target: string; rest_s: number }; autres: string[] }
  | {
    kind: 'compromised'; movement: string; rounds: number; work_s: number; target: string;
    tours: Array<{ poste: PosteRendu; run_m: number }>; pro: ProRendu[]; total_m: number;
  }
  | { kind: 'race'; movement: string; rounds: number; run_m: number; postes: PosteRendu[]; pro: ProRendu[]; score: string };

export type RenduBlocSeance =
  /** bloc A : porte toujours l'échauffement */
  | { bloc: 'a'; label: string; echauffement: string[]; timed: boolean; contenu: ContenuBloc; noms: Record<string, string> }
  /** bloc de travail écrit (Hybrid) : porte l'échauffement quand la séance n'a pas de bloc A */
  | { bloc: 'work'; label: string; echauffement: string[] | null; timed: boolean; contenu: ContenuBloc; noms: Record<string, string> }
  | { bloc: 'b'; movement: string; name?: string; tempo: string | null; steps: StrengthStep[]; noms: Record<string, string> }
  | { bloc: 'finisher'; rounds: number; movements: Array<{ id: string; qty: number; unit: string; name?: string }>; noms: Record<string, string> }
  | { bloc: 'cooldown'; lignes: string[] };

/** Bloc C d'une séance (`GeneratedWod`) : l'échauffement le précède quand la séance n'a pas de bloc A. */
export interface RenduBlocC { bloc: 'c'; echauffement: string[] | null }

export interface TexteBloc { title: string; description: string; notes: string | null }

// ─── Formats ─────────────────────────────────────────────────────────────────

/** durée des étapes A et B d'un skill (secondes) */
export const SKILL_STEP_S = 180;

export function fmtRest(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

export function fmtEvery(s: number, d: Textes['duree'] = fr.duree): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? d.minutesSecondes(m, String(r).padStart(2, '0')) : d.minutes(m);
}

/** `Back Squat — 5 × 5 @ 75 %1RM — repos 2:30 — tempo 3-1-X-1 — charge …` */
export function stepLine(name: string, st: StrengthStep, tempo?: string | null, langue: Langue = 'fr'): string {
  const T = textes(langue).seance;
  const tb = banqueVers(langue);
  let out = `${name} — ${st.sets} × ${st.reps}`;
  if (st.percent !== null) out += T.serie.pourcent(st.percent);
  out += T.serie.repos(fmtRest(st.rest_s));
  // la note lue est celle de la banque (français) : c'est elle qui décide du tempo
  if (tempo && !st.note?.startsWith('montée')) out += T.serie.tempo(tempo);
  if (st.note) out += T.serie.charge(tb(st.note));
  return out;
}

const NL = '\n';

// ─── Rendu ───────────────────────────────────────────────────────────────────

interface Ctx { t: Textes; tb: (texte: string) => string; nom: (id: string) => string }

/** `noms` : noms du catalogue (français) des mouvements du bloc, par id ; hors français, l'entrée de l'id. */
function contexte(langue: Langue, noms: Record<string, string> = {}): Ctx {
  return { t: textes(langue), tb: banqueVers(langue), nom: (id) => nomMouvement(id, noms[id] ?? id, langue) };
}

/** « 25 m Sled Push @ 125/100 kg », « 60 s Row », « 10 Box Step-ups (box 60/50 cm) @ 24/16 kg ». */
function ligneDePoste(p: PosteRendu, { t, tb, nom }: Ctx): string {
  const name = p.name ? tb(p.name) : nom(p.id);
  const qty = p.unit === 'reps' ? `${p.qty}` : `${p.qty} ${p.unit}`;
  const parts: string[] = [];
  if (p.box) parts.push(t.seance.stationBox(p.box[0], p.box[1]));
  else if (p.charge) parts.push(`@ ${p.charge[0]}/${p.charge[1]} ${p.charge[2]}`);
  if (p.extra) parts.push(`@ ${p.extra[0]}/${p.extra[1]} ${p.extra[2]}`);
  return `${qty} ${name}${parts.length ? ` ${parts.join(' ')}` : ''}`;
}

function lignePro(pro: ProRendu[], { t, tb, nom }: Ctx): string | null {
  const parts = pro.map((p) => `${p.name ? tb(p.name) : nom(p.id)} ${p.men}/${p.women} ${p.unit}`);
  return parts.length ? t.seance.pro(parts.join(' · ')) : null;
}

/** Bloc A haltéro, force ou skill. */
function lignesForce(c: ContenuBloc, langue: Langue, x: Ctx): string[] {
  const { t, tb, nom } = x;
  const T = t.seance;
  const name = nom(c.movement);
  const lines: string[] = [];
  if (c.kind === 'weightlifting') {
    lines.push(T.halteroComplexe(name, c.variante, c.complex.map(nom).join(' + ')));
    lines.push(T.halteroConsigne);
    for (const st of c.steps) lines.push(stepLine(name, st, undefined, langue));
  } else if (c.kind === 'strength') {
    lines.push(T.force(name));
    for (const st of c.steps) lines.push(stepLine(name, st, c.tempo, langue));
    if (c.tempo) lines.push(T.forceTempo(c.tempo));
  } else if (c.kind === 'skill') {
    const sk = c.skill;
    lines.push(T.skill(name));
    lines.push(T.etapeA(tb(sk.progression.a), fmtEvery(SKILL_STEP_S, t.duree)));
    lines.push(T.etapeB(tb(sk.progression.b), fmtEvery(SKILL_STEP_S, t.duree)));
    lines.push(T.etapeC(fmtEvery(sk.every_s, t.duree), sk.rounds));
    lines.push(`${sk.reps} ${name}`);
    const subs = Object.entries(sk.substitutions).map(([cat, s]) => t.rendu.substitution(fr.categories[cat as keyof typeof fr.categories] ?? cat, tb(s)));
    if (subs.length) lines.push(`→ ${subs.join(' · ')}`);
  }
  return lines;
}

/** Bloc Hybrid : station `Every X'`, intervalles de course, course compromise ou enchaînement chronométré. */
function lignesHybrid(c: ContenuBloc, x: Ctx): string[] {
  const { t, tb } = x;
  const T = t.seance;
  const lines: string[] = [];
  if (c.kind === 'station') {
    const n = c.postes.length;
    lines.push(n > 1 ? T.stationRotation(fmtEvery(c.every_s, t.duree), c.rounds) : T.stationEvery(fmtEvery(c.every_s, t.duree), c.rounds));
    // deux postes s'alternent (impair / pair), au-delà ils tournent et se numérotent
    c.postes.forEach((p, i) => lines.push(`${n === 2 ? (i === 0 ? T.impair : T.pair) : n > 2 ? T.poste(i + 1) : ''}${ligneDePoste(p, x)}`));
    const pro = lignePro(c.pro, x);
    if (pro) lines.push(pro);
    if (c.lourd) lines.push(T.chargeLourde);
  } else if (c.kind === 'run') {
    lines.push(T.intervallesCourse(tb(c.variante.label), fmtRest(c.variante.rest_s)));
    lines.push(T.allureCible(tb(c.variante.target)));
    lines.push(T.autresVariantes(c.autres.map(tb).join(' · ')));
  } else if (c.kind === 'compromised') {
    lines.push(T.compromiseRounds(c.rounds));
    c.tours.forEach((tour, i) => {
      lines.push(T.compromiseStation(i + 1, c.work_s, ligneDePoste(tour.poste, x)));
      lines.push(T.compromiseCourse(tour.run_m, tb(c.target)));
    });
    const pro = lignePro(c.pro, x);
    if (pro) lines.push(pro);
    lines.push(T.compromiseTotal(c.total_m));
  } else if (c.kind === 'race') {
    lines.push(T.enchainement(c.rounds));
    c.postes.forEach((p, i) => lines.push(T.enchainementLigne(i + 1, c.run_m, ligneDePoste(p, x))));
    const pro = lignePro(c.pro, x);
    if (pro) lines.push(pro);
    lines.push(T.enchainementScore(tb(c.score)));
  }
  return lines;
}

const HYBRID_A = new Set(['station', 'run', 'race']);

/** Titre, description et notes d'un bloc de séance, dans la langue demandée (défaut `fr`, le texte enregistré). */
export function rendreBlocSeance(p: RenduBlocSeance, langue: Langue = 'fr'): TexteBloc {
  const x = contexte(langue, 'noms' in p ? p.noms : {});
  const { t, tb, nom } = x;
  const T = t.seance;
  const warm = (lignes: string[]) => [...lignes.map(tb), ''];
  switch (p.bloc) {
    case 'a': {
      const c = p.contenu;
      const lines = HYBRID_A.has(c.kind) ? lignesHybrid(c, x) : lignesForce(c, langue, x);
      return {
        title: c.kind === 'race' ? tb(p.label) : `${T.type[c.kind as keyof typeof T.type]} · ${nom(c.movement)}`,
        description: [...warm(p.echauffement), ...lines].join('\n'),
        notes: c.kind === 'weightlifting' ? T.notePourcentages : p.timed ? T.noteChronometree : null,
      };
    }
    case 'work': {
      const c = p.contenu;
      return {
        title: c.kind === 'race' ? tb(p.label) : `${tb(p.label)} · ${nom(c.movement)}`,
        description: [...(p.echauffement ? warm(p.echauffement) : []), ...lignesHybrid(c, x)].join(NL),
        notes: p.timed ? T.noteChronometree : null,
      };
    }
    case 'b': {
      const name = p.name ? tb(p.name) : nom(p.movement);
      return {
        title: T.titreBuilding(name),
        description: [T.building(name, p.tempo ?? '').trim(), ...p.steps.map((st) => stepLine(name, st, p.tempo, langue))].join('\n'),
        notes: null,
      };
    }
    case 'finisher': {
      const lines = [T.finisher(p.rounds)];
      for (const m of p.movements) {
        const name = m.name ? tb(m.name) : nom(m.id);
        lines.push(m.unit === 's' ? `${m.qty} s ${name}` : m.unit === 'm' ? `${m.qty} m ${name}` : `${m.qty} ${name}`);
      }
      return { title: T.titreFinisher, description: lines.join('\n'), notes: null };
    }
    case 'cooldown':
      return { title: T.titreRetourAuCalme, description: p.lignes.map(tb).join(NL), notes: null };
  }
}

/** Description du bloc C dans une séance : l'échauffement le précède quand la séance n'a pas de bloc A. */
export function descriptionBlocC(description: string, echauffement: string[] | null, langue: Langue = 'fr'): string {
  if (!echauffement) return description;
  const tb = banqueVers(langue);
  return [...echauffement.map(tb), '', description].join('\n');
}

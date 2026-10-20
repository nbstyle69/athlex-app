/**
 * Box vitrine (#523) — logique pure : comptes, scores, séries de musculation,
 * répartition des tournois, quotas de réservation, sélection de la purge.
 * Aucune entrée/sortie ici : tout est testé par __tests__/logique.test.ts.
 * Les tirages sont déterministes (hash des identifiants) : relancer une
 * commande retombe sur les mêmes choix, ce qui la rend idempotente.
 */
import { weightliftingPrLabel } from '../../src/screens/profile/prStorage';

export const BOX_ATHLEX = 'd3d0b0a0-0000-4000-a000-000000000001';
export const EMAIL_COACH = 'demo.vitrine+coach@athlexapp.eu';
export const PSEUDO_COACH = 'CoachAthleX';
export const MOTIF_MEMBRE = /^demo\.vitrine\+(0[1-9]|[1-4][0-9]|50)@athlexapp\.eu$/;
export const FORMULE_DEMO = 'Accès démo';

export type Genre = 'female' | 'male';
export type Niveau = 'scaled' | 'inter' | 'rx' | 'rx+';

export interface Membre {
  nn: number;
  email: string;
  pseudo: string;
  prenom: string;
  genre: Genre;
  niveau: Niveau;
  /** 0 (débutant) à 1 (meilleur de la box) : pilote tous les résultats. */
  force: number;
}

const FEMMES: [string, string][] = [
  ['Lola_Burpee', 'Lola'], ['Ines_Rx', 'Inès'], ['ChloeKettle', 'Chloé'], ['ManonAmrap', 'Manon'],
  ['LeaWod', 'Léa'], ['CamThruster', 'Camille'], ['JadeBox', 'Jade'], ['SarahSnatch', 'Sarah'],
  ['EmmaRope', 'Emma'], ['LouiseRow', 'Louise'], ['ZoeEmom', 'Zoé'], ['ClaraClean', 'Clara'],
  ['LinaPullUp', 'Lina'], ['MaelysRun', 'Maëlys'], ['NinaTabata', 'Nina'], ['EvaSquat', 'Eva'],
  ['JulieJerk', 'Julie'], ['MargauxDL', 'Margaux'], ['AnaisWallBall', 'Anaïs'], ['LucieStep', 'Lucie'],
  ['YasLift', 'Yasmine'], ['OceaneGo', 'Océane'], ['RomaneFit', 'Romane'], ['ElsaPR', 'Elsa'],
  ['MiaStrong', 'Mia'],
];
const HOMMES: [string, string][] = [
  ['PauloLift', 'Paulo'], ['HugoRx', 'Hugo'], ['LucasThrust', 'Lucas'], ['TheoSnatch', 'Théo'],
  ['NathanWod', 'Nathan'], ['EnzoBurpee', 'Enzo'], ['MaxDeadlift', 'Max'], ['RayanAmrap', 'Rayan'],
  ['TomRow', 'Tom'], ['JulesClean', 'Jules'], ['AdamBox', 'Adam'], ['BastienPR', 'Bastien'],
  ['KarimKB', 'Karim'], ['LeoMuscleUp', 'Léo'], ['MathisRun', 'Mathis'], ['YanisJerk', 'Yanis'],
  ['AntoineEmom', 'Antoine'], ['KylianFast', 'Kylian'], ['NoahSquat', 'Noah'], ['SamiPullUp', 'Sami'],
  ['RomainRope', 'Romain'], ['AxelStrong', 'Axel'], ['FloLift', 'Florian'], ['MalikTabata', 'Malik'],
  ['GabinGo', 'Gabin'],
];
// Par genre, rang 1..25 : 5 scaled, 8 inter, 8 rx, 4 rx+, mélangés pour que
// l'ordre de la liste ne soit pas l'ordre des niveaux.
const NIVEAUX: Niveau[] = [
  'rx', 'inter', 'rx+', 'scaled', 'inter', 'rx', 'inter', 'rx', 'scaled', 'inter',
  'rx', 'rx+', 'inter', 'scaled', 'rx', 'inter', 'rx', 'scaled', 'inter', 'rx+',
  'rx', 'inter', 'scaled', 'rx', 'rx+',
];
const BASE_FORCE: Record<Niveau, number> = { scaled: 0.15, inter: 0.4, rx: 0.62, 'rx+': 0.82 };

/** Uniforme déterministe dans [0, 1) (FNV-1a 32 bits). */
export function tirage(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const c of parts.join('|')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

export function emailMembre(nn: number): string {
  return `demo.vitrine+${String(nn).padStart(2, '0')}@athlexapp.eu`;
}

export const MEMBRES: Membre[] = [...FEMMES, ...HOMMES].map(([pseudo, prenom], i) => {
  const nn = i + 1;
  const niveau = NIVEAUX[i % 25];
  return {
    nn, email: emailMembre(nn), pseudo, prenom,
    genre: i < 25 ? 'female' : 'male',
    niveau,
    force: Math.min(0.98, BASE_FORCE[niveau] + (tirage('force', nn) - 0.5) * 0.16),
  };
});

/**
 * Pseudo réellement demandé : la règle de prod n'impose rien (étape 1), mais le
 * repli reste prêt si elle change. Caractère refusé → retiré ; pseudo pris
 * (insensible à la casse, comme le trigger d'inscription) → chiffre ajouté.
 */
export function adapterPseudo(
  voulu: string,
  pris: Set<string>,
  regle: { caracteres: RegExp; longueurMax: number } = { caracteres: /[A-Za-z0-9_]/, longueurMax: 24 },
): { pseudo: string; caractere: boolean; chiffre: boolean } {
  const nettoye = [...voulu].filter(c => regle.caracteres.test(c)).join('').slice(0, regle.longueurMax);
  const caractere = nettoye !== voulu;
  if (!pris.has(nettoye.toLowerCase())) return { pseudo: nettoye, caractere, chiffre: false };
  for (let n = 2; n < 1000; n++) {
    const s = String(n);
    const essai = nettoye.slice(0, regle.longueurMax - s.length) + s;
    if (!pris.has(essai.toLowerCase())) return { pseudo: essai, caractere, chiffre: true };
  }
  throw new Error(`PSEUDO_EPUISE: ${voulu}`);
}

// ── Scores du Whiteboard ─────────────────────────────────────────────────────

export interface WodBox {
  id: string;
  wod_type: string | null;
  description: string | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  leaderboard_enabled: boolean | null;
}

export interface ScoreWod {
  score_type: 'time' | 'reps' | 'rounds' | 'weight';
  score_value: number;
  capped: boolean;
  rx: boolean;
}

export const TAUX_SCORE = 0.6;

/** Environ 60 % des membres scorent un WOD donné ; toujours les mêmes. */
export function scoreLe(wodId: string, m: Membre): boolean {
  return tirage('score', wodId, m.nn) < TAUX_SCORE;
}

/** RX pour les rx/rx+, Scaled pour les scaled, un inter sur trois en RX. */
export function enRx(m: Membre, wodId: string): boolean {
  if (m.niveau === 'scaled') return false;
  if (m.niveau === 'inter') return tirage('rx', wodId, m.nn) < 0.33;
  return true;
}

/**
 * Score crédible pour un WOD, sous les plafonds de l'app
 * (src/utils/computeMaxScore.ts) : AMRAP ≤ 1,5 rep/s, EMOM en rounds ≤ minutes,
 * Tabata ≤ 280. `null` : type que l'app ne score pas ici (musculation à part).
 */
export function scorePour(w: WodBox, m: Membre): ScoreWod | null {
  const t = (w.wod_type ?? '').toLowerCase();
  const alea = tirage('valeur', w.id, m.nn);
  const perf = Math.max(0, Math.min(1, m.force + (alea - 0.5) * 0.25)); // 0 = lent, 1 = rapide
  const rx = enRx(m, w.id);
  const cap = w.time_cap_seconds && w.time_cap_seconds > 0 ? w.time_cap_seconds : null;
  switch (t) {
    case 'for-time': {
      const capS = cap ?? 20 * 60;
      // Les plus faibles du jour finissent au cap (DNF) : reps faites, capped.
      if (perf < 0.12) return { score_type: 'time', score_value: 40 + Math.round(alea * 80), capped: true, rx };
      return { score_type: 'time', score_value: Math.round(capS * (0.95 - 0.4 * perf)), capped: false, rx };
    }
    case 'amrap': {
      const min = (cap ?? 12 * 60) / 60;
      return { score_type: 'reps', score_value: Math.max(1, Math.round(min * (6 + 12 * perf))), capped: false, rx };
    }
    case 'emom': {
      const min = w.rounds ?? (cap ? Math.ceil(cap / 60) : 12);
      return { score_type: 'rounds', score_value: Math.max(1, min - Math.floor((1 - perf) * 3)), capped: false, rx };
    }
    case 'tabata':
      return { score_type: 'reps', score_value: Math.round(60 + 140 * perf), capped: false, rx };
    case 'custom':
      // Seulement s'il a un classement ; l'app y propose les reps par défaut.
      if (!w.leaderboard_enabled) return null;
      return { score_type: 'reps', score_value: Math.round(30 + 120 * perf), capped: false, rx };
    default:
      return null;
  }
}

/**
 * Règle de contact (étape 2d) : un fictif ne score jamais un WOD où un compte
 * réel protégé a déjà un score. Sinon compute_wod_elo / compute_box_elo
 * classeraient ce compte parmi les fictifs, et la purge ne le défait pas.
 */
export function wodsSansContact<W extends { id: string }>(wods: W[], avecScoreProtege: Set<string>): { gardes: W[]; sautes: number } {
  const gardes = wods.filter(w => !avecScoreProtege.has(w.id));
  return { gardes, sautes: wods.length - gardes.length };
}

// ── Musculation : séries et 1RM (validate_strength_session) ─────────────────

export interface SerieMuscu {
  movement: string;
  movement_label: string | null;
  set_index: number;
  reps: number;
  load_kg: number | null;
  prescribed_reps: number;
  prescribed_load_kg: null;
  is_added: false;
  load_required: boolean;
}
export interface RecordMuscu { label: string; kg: number; movement: string; set_index: number }

// 1RM de référence d'un athlète RX homme ; pondéré par genre et force.
const REF_1RM: Record<string, number> = {
  'back squat': 140, 'front squat': 120, deadlift: 170, 'bench press': 100, 'strict press': 65,
  'push press': 85, 'push jerk': 95, 'split jerk': 100, 'squat clean': 105, 'power clean': 95,
  'hang power clean': 90, 'hang squat clean': 100, 'squat snatch': 80, 'power snatch': 72,
  'hang power snatch': 68, 'hang squat snatch': 75, 'clean & jerk': 100, 'overhead squat': 85,
  thruster: 85, 'hip thrust': 160,
};
const LIGNE_MUSCU = /^(.+?) — (\d+) × (\d+)(?: \/ \S+)?(.*)$/;

export function estimation1rm(kg: number, reps: number): number | null {
  if (reps < 1 || reps > 10) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/**
 * Séries réalisées pour un bloc de musculation (format « Back Squat — 5 × 3 @
 * 80 %1RM — … », src/utils/strengthBlock.ts) et 1RM à transmettre. Charge
 * donnée si la ligne en prescrit une (%1RM, kg, RPE) ; sinon série sans charge.
 * Le 1RM envoyé est l'estimation Epley arrondie au demi-kilo inférieur : il ne
 * dépasse jamais l'estimation du serveur (RECORD_NON_PROUVE).
 */
export function seriesPour(description: string, m: Membre): { sets: SerieMuscu[]; records: RecordMuscu[] } {
  const sets: SerieMuscu[] = [];
  const index = new Map<string, number>();
  for (const brute of description.split('\n')) {
    const r = LIGNE_MUSCU.exec(brute.trim());
    if (!r) continue;
    const [, nom, nbSeries, nbReps, reste] = r;
    const movement = nom.trim();
    const pct = /@ (\d+) ?%1RM/.exec(reste) ?? /≈ (\d+) ?% du 1RM/.exec(reste);
    const kg = /@ (\d+(?:[.,]\d+)?) kg/.exec(reste);
    const avecCharge = !!(pct || kg || /RPE/.test(reste)) && !/poids du corps/.test(reste);
    const ref = (REF_1RM[movement.toLowerCase()] ?? 60) * (m.genre === 'female' ? 0.65 : 1) * (0.55 + 0.6 * m.force);
    const charge = !avecCharge ? null
      : kg ? parseFloat(kg[1].replace(',', '.'))
      : Math.max(5, Math.round((ref * (pct ? Number(pct[1]) / 100 : 0.7)) / 2.5) * 2.5);
    for (let s = 0; s < Number(nbSeries); s++) {
      const i = (index.get(movement) ?? 0) + 1;
      index.set(movement, i);
      sets.push({
        movement, movement_label: weightliftingPrLabel(movement), set_index: i,
        reps: Number(nbReps), load_kg: charge, prescribed_reps: Number(nbReps),
        prescribed_load_kg: null, is_added: false, load_required: !!(pct || kg),
      });
    }
  }
  const meilleurs = new Map<string, RecordMuscu>();
  for (const s of sets) {
    if (!s.movement_label || s.load_kg == null) continue;
    const est = estimation1rm(s.load_kg, s.reps);
    if (est == null) continue;
    const kgRec = Math.floor(est * 2) / 2;
    const cur = meilleurs.get(s.movement_label);
    if (!cur || kgRec > cur.kg) meilleurs.set(s.movement_label, { label: s.movement_label, kg: kgRec, movement: s.movement, set_index: s.set_index });
  }
  return { sets, records: [...meilleurs.values()] };
}

// ── Tournois ─────────────────────────────────────────────────────────────────

export type RefTournoi = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'E1';
export interface SpecTournoi {
  ref: RefTournoi;
  nom: string;
  format: 'simple' | 'bracket' | 'swiss' | 'league_div';
  niveau: 'scaled' | 'inter' | 'rx';
  places: number;
  inscrits: number;
  /** Démarre à J+1 00:00 Paris ; sinon start_date NULL, reste « à venir ». */
  demarre: boolean;
  petiteFinale?: boolean;
}

export const TOURNOIS: SpecTournoi[] = [
  { ref: 'T1', nom: 'Open d’automne', format: 'simple', niveau: 'rx', places: 24, inscrits: 24, demarre: true },
  { ref: 'T2', nom: 'Battle Kettlebell', format: 'bracket', niveau: 'rx', places: 16, inscrits: 16, demarre: true, petiteFinale: true },
  { ref: 'T3', nom: 'Duel de la Box', format: 'swiss', niveau: 'scaled', places: 8, inscrits: 8, demarre: true },
  { ref: 'T4', nom: 'Ligue Hybrid', format: 'league_div', niveau: 'inter', places: 24, inscrits: 24, demarre: true },
  { ref: 'T5', nom: 'Challenge Burpee', format: 'simple', niveau: 'scaled', places: 32, inscrits: 12, demarre: false },
  { ref: 'T6', nom: 'Coupe d’hiver', format: 'bracket', niveau: 'rx', places: 16, inscrits: 8, demarre: false },
];

const ADEQUATION: Record<SpecTournoi['niveau'], Record<Niveau, number>> = {
  rx: { 'rx+': 3, rx: 3, inter: 1, scaled: 0 },
  inter: { inter: 3, rx: 2, scaled: 2, 'rx+': 1 },
  scaled: { scaled: 3, inter: 3, rx: 1, 'rx+': 0 },
};

/**
 * Inscrits de chaque tournoi : d'abord ceux qui n'ont encore aucun tournoi,
 * puis le niveau le plus adapté, en alternant femmes et hommes. Plafond de
 * 3 tournois par membre.
 */
export function repartirInscrits(membres: Membre[] = MEMBRES, tournois: SpecTournoi[] = TOURNOIS): Record<RefTournoi, number[]> {
  const compte = new Map<number, number>(membres.map(m => [m.nn, 0]));
  const out = {} as Record<RefTournoi, number[]>;
  for (const t of tournois) {
    const tri = (g: Genre) => membres
      .filter(m => m.genre === g && (compte.get(m.nn) ?? 0) < 3)
      .sort((a, b) => (compte.get(a.nn)! - compte.get(b.nn)!)
        || (ADEQUATION[t.niveau][b.niveau] - ADEQUATION[t.niveau][a.niveau])
        || (tirage(t.ref, a.nn) - tirage(t.ref, b.nn)));
    const f = tri('female');
    const h = tri('male');
    const choisis: number[] = [];
    while (choisis.length < t.inscrits) {
      const suivant = (choisis.length % 2 === 0 ? f.shift() ?? h.shift() : h.shift() ?? f.shift());
      if (!suivant) throw new Error(`INSCRITS_INSUFFISANTS: ${t.ref}`);
      choisis.push(suivant.nn);
      compte.set(suivant.nn, compte.get(suivant.nn)! + 1);
    }
    out[t.ref] = choisis.sort((a, b) => a - b);
  }
  return out;
}

/** Score de tournoi (texte canonique de l'app) : secondes en For Time, reps sinon. */
export function scoreTournoi(type: string, wodId: string, m: Membre): string {
  const perf = Math.max(0, Math.min(1, m.force + (tirage('tournoi', wodId, m.nn) - 0.5) * 0.3));
  if (type === 'For Time') return String(Math.round(900 - 420 * perf));
  return String(Math.round(80 + 160 * perf));
}

/** Mini-tournoi de l'essai (étape 3) : tableau à 4, ids sous la clé `essai`. */
export const TOURNOI_ESSAI: SpecTournoi = { ref: 'E1', nom: 'Essai vitrine', format: 'bracket', niveau: 'rx', places: 4, inscrits: 4, demarre: true };

// ── Clés Supabase ────────────────────────────────────────────────────────────

/**
 * Première variable définie parmi `noms`, au préfixe exigé (nouvelles clés,
 * #521 : les anciennes seront désactivées pendant la revue). Le message d'erreur
 * nomme la variable, jamais sa valeur.
 */
export function lireCle(env: Record<string, string | undefined>, noms: string[], prefixe: string): { valeur: string; nom: string } | { erreur: string } {
  const nom = noms.find(n => env[n]);
  if (!nom) return { erreur: `variable manquante : ${noms.join(' ou ')}` };
  const valeur = env[nom]!;
  if (!valeur.startsWith(prefixe)) return { erreur: `${nom} ne commence pas par ${prefixe}` };
  return { valeur, nom };
}

// ── Réservations ─────────────────────────────────────────────────────────────

export const FENETRE_RESERVATION_JOURS = 14;

/** Places que les fictifs peuvent encore prendre : au plus 60 % de la capacité, et toujours 3 libres. */
export function quotaReservation(capacite: number, confirmes: number): number {
  return Math.max(0, Math.min(Math.floor(capacite * 0.6), capacite - 3) - confirmes);
}

/** Les fictifs d'un créneau, dans un ordre fixe : un seul créneau par membre et par jour. */
export function reservantsPour(creneauId: string, candidats: Membre[], dejaCeJour: Set<number>, n: number): Membre[] {
  return candidats
    .filter(m => !dejaCeJour.has(m.nn))
    .sort((a, b) => tirage('resa', creneauId, a.nn) - tirage('resa', creneauId, b.nn))
    .slice(0, n);
}

// ── Purge : sélection stricte ────────────────────────────────────────────────

export interface CompteLu {
  id: string;
  email: string;
  box_id: string | null;
  role: string | null;
  formule: string | null;
  demo_account: boolean;
}

export const DOMAINE_DEMO_HISTORIQUE = '@demo.athlexapp.eu';

/**
 * Comptes à purger : motif d'adresse ET box ; formule « Accès démo » pour les
 * membres ; coach à l'adresse exacte. Avec `legacy`, en plus les comptes de
 * internal.demo_accounts rattachés à AthleX Fitness ET dont l'adresse est en
 * @demo.athlexapp.eu, reviewer exclu : un compte réel ne peut jamais être pris,
 * même s'il figurait par erreur dans internal.demo_accounts.
 */
export function comptesAPurger(lus: CompteLu[], box: string, opts: { legacy?: boolean; reviewerId?: string } = {}): string[] {
  const ids = new Set<string>();
  for (const c of lus) {
    if (c.box_id !== box) continue;
    const email = c.email.toLowerCase();
    if (MOTIF_MEMBRE.test(email) && c.formule === FORMULE_DEMO && c.role === 'member') ids.add(c.id);
    else if (email === EMAIL_COACH) ids.add(c.id);
    else if (opts.legacy && box === BOX_ATHLEX && c.demo_account && email.endsWith(DOMAINE_DEMO_HISTORIQUE)) {
      if (!opts.reviewerId) throw new Error('REVIEWER_INCONNU: la purge élargie exige l’identifiant du reviewer');
      if (c.id !== opts.reviewerId) ids.add(c.id);
    }
  }
  return [...ids].sort();
}

/** Tournois à purger : ceux d'un groupe de vitrine.ids.json, et seulement s'ils sont dans la box. */
export function tournoisAPurger(ids: Partial<Record<string, string>>, lus: { id: string; box_id: string }[], box: string): string[] {
  const voulus = new Set(Object.values(ids).filter((v): v is string => !!v));
  return lus.filter(t => voulus.has(t.id) && t.box_id === box).map(t => t.id).sort();
}

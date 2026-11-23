/**
 * Musculation de box en plusieurs cartes (#620), PR 1 « affichage » : textes de la spec, rendu des
 * cartes Échauffement / Retour au calme et des cartes de musculation partielles, fonctions de
 * construction. La génération ne change pas (instantanés M0/M2 inchangés) : ici, seulement le rendu.
 */
import {
  fr, en, banqueVers, generateMuscuWeek, renderFromWodJson, rendreBlocSeance, renderMuscu, exerciseLine,
  cartesJourMuscu, partiesMuscu, lignesSeanceMuscu, ROLES_PRINCIPAL, MUSCU_WEEK_DAYS, CATALOG_SNAPSHOT, BANK_V1, weekSeed,
} from '../src';
import type { MuscuWod, RenduBlocSeance, MuscuTarget, SessionStructuredBlock } from '../src';
import { avecJournal } from './instantane/chemins';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isFrench, strictAllowed } = require('../../../scripts/i18n/scanner') as {
  isFrench: (s: string) => boolean; strictAllowed: (s: string) => boolean;
};

const C = CATALOG_SNAPSHOT;
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

/** Textes de la spec validée par Nab (commentaire « Spec validée par Nab le 23/11 » de #620), recopiés octet pour octet. */
const SPEC: Record<'push' | 'jambes' | 'pull' | 'fessiers_ischios' | 'tronc', [string, string]> = {
  push: [
    "Échauffement (10') — rameur ou vélo facile, mobilité épaules et thoracique, Push-Ups, Band Pull-Aparts, puis 2 séries légères du premier exercice.",
    "Retour au calme (5') — étirements : pectoraux au mur 45 s / bras · épaule en travers 45 s / bras · triceps au-dessus de la tête 30 s / bras, respiration lente.",
  ],
  jambes: [
    "Échauffement (10') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Lunges, puis 2 séries légères du premier exercice.",
    "Retour au calme (5') — étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · fessiers en pigeon 45 s / côté.",
  ],
  pull: [
    "Échauffement (10') — rameur facile, mobilité épaules, Scap Pull-Ups, Ring Rows, Band Pull-Aparts, puis 2 séries légères du premier exercice.",
    "Retour au calme (5') — étirements : dorsaux à la barre ou au mur 45 s · biceps au mur 30 s / bras · ouverture thoracique 45 s, respiration lente.",
  ],
  fessiers_ischios: [
    "Échauffement (10') — vélo facile, mobilité hanches, Glute Bridges, Good Mornings à vide, puis 2 séries légères du premier exercice.",
    "Retour au calme (5') — étirements : ischios debout 45 s / jambe · pigeon 45 s / côté · fléchisseurs de hanche en fente 45 s / côté.",
  ],
  tronc: [
    "Échauffement (5') — rameur ou vélo facile, Dead Bugs, Bird Dogs, planche 20 s.",
    "Retour au calme (5') — posture de l'enfant 1' · cobra 45 s · rotation thoracique allongé 45 s / côté, respiration 4-6.",
  ],
};
const CIBLES = Object.keys(SPEC) as Array<keyof typeof SPEC>;

/** Une semaine Musculation de box par objectif : semaine 1 Prise de muscle, 3 Tonification, 5 Force. */
const semaine = (iso_week: number, box = 'box-0') =>
  generateMuscuWeek({ iso_year: 2027, iso_week }, C, BANK_V1, weekSeed(box, 'musculation', 2027, iso_week, 0));
const SEMAINES = [1, 3, 5].map((w) => semaine(w));
const FORCE = SEMAINES[2];

/** Une ligne affichée en anglais qui reste française (méthode des instantanés M2). */
const resteFrancais = (l: string) => ACCENT.test(l) || (isFrench(l) && !strictAllowed(l));

describe('textes de la spec (#620)', () => {
  it('cibles de la semaine = cibles qui ont un échauffement et un retour au calme', () => {
    expect([...new Set(MUSCU_WEEK_DAYS.map((d) => d.target))].sort()).toEqual([...CIBLES].sort());
  });

  it.each(CIBLES)('%s : échauffement et retour au calme français octet pour octet', (c) => {
    expect(fr.banque.musculation.echauffement[c]).toBe(SPEC[c][0]);
    expect(fr.banque.musculation.retourAuCalme[c]).toBe(SPEC[c][1]);
    expect(Buffer.from(fr.banque.musculation.echauffement[c], 'utf8')).toEqual(Buffer.from(SPEC[c][0], 'utf8'));
    expect(Buffer.from(fr.banque.musculation.retourAuCalme[c], 'utf8')).toEqual(Buffer.from(SPEC[c][1], 'utf8'));
  });

  it('libellés des parties', () => {
    expect(fr.musculation.partie).toEqual({ principal: 'Bloc principal', accessoires: 'Accessoires' });
    expect(en.musculation.partie).toEqual({ principal: 'Main block', accessoires: 'Accessories' });
    expect([fr.seance.titreEchauffement, en.seance.titreEchauffement]).toEqual(['Échauffement', 'Warm-up']);
  });

  it.each(CIBLES)('%s : anglais sans français ni marque', (c) => {
    for (const t of [en.banque.musculation.echauffement[c], en.banque.musculation.retourAuCalme[c]]) {
      expect(resteFrancais(t)).toBe(false);
      expect(t).not.toMatch(/crossfit|hyrox|musculation/i);
    }
    for (const t of SPEC[c]) expect(t).not.toMatch(/crossfit|hyrox/i);
  });
});

describe('cartes Échauffement et Retour au calme', () => {
  it.each(CIBLES)('%s : rendu français = texte de la spec, anglais traduit sans français', (c) => {
    const ech = rendreBlocSeance({ bloc: 'echauffement', lignes: [SPEC[c][0]] });
    const rac = rendreBlocSeance({ bloc: 'cooldown', lignes: [SPEC[c][1]] });
    expect(ech).toEqual({ title: 'Échauffement', description: SPEC[c][0], notes: null });
    expect(rac).toEqual({ title: 'Retour au calme', description: SPEC[c][1], notes: null });
    const echEn = rendreBlocSeance({ bloc: 'echauffement', lignes: [SPEC[c][0]] }, 'en');
    const racEn = rendreBlocSeance({ bloc: 'cooldown', lignes: [SPEC[c][1]] }, 'en');
    expect(echEn).toEqual({ title: 'Warm-up', description: en.banque.musculation.echauffement[c], notes: null });
    expect(racEn).toEqual({ title: 'Cool-down', description: en.banque.musculation.retourAuCalme[c], notes: null });
    expect(banqueVers('en')(SPEC[c][0])).not.toBe(SPEC[c][0]);
  });

  it('variante inconnue → null (rendreBlocSeance et renderFromWodJson), sans exception', () => {
    const inconnue = { bloc: 'etirements_v9', lignes: ['x'] } as unknown as RenduBlocSeance;
    expect(rendreBlocSeance(inconnue)).toBeNull();
    expect(rendreBlocSeance(inconnue, 'en')).toBeNull();
    expect(rendreBlocSeance('texte' as unknown)).toBeNull();
    expect(rendreBlocSeance(null as unknown)).toBeNull();
    const json = { source: 'generator', discipline: 'session', v: 2, kind: 'cooldown', rendu: inconnue };
    expect(renderFromWodJson(json, 'fr')).toBeNull();
    expect(renderFromWodJson(json, 'en')).toBeNull();
    expect(renderFromWodJson({ ...json, rendu: 'x' }, 'en')).toBeNull();
  });
});

describe('cartes de musculation partielles (rendu.partie)', () => {
  const jours = SEMAINES.flatMap((s) => s.days);

  it('wod_json sans rendu.partie : rendu inchangé (= texte enregistré)', () => {
    for (const d of jours) {
      expect(d.wod.rendu?.partie).toBeUndefined();
      expect(renderFromWodJson(d.wod, 'fr')).toEqual({ title: d.wod.title, description: d.wod.description, notes: d.wod.notes });
      expect(renderMuscu(d.wod)).toBe(d.wod.description);
    }
  });

  it('Bloc principal et Accessoires : titre, exercices du sous-ensemble dans l\'ordre, durée, stimulus sur la première', () => {
    for (const d of jours.filter((x) => x.target !== 'tronc')) {
      const parts = partiesMuscu(d.wod, C);
      expect(parts.map((p) => p.rendu?.partie)).toEqual(['principal', 'accessoires']);
      const [p, a] = parts;
      const tous = d.wod.blocks[0].exercises;
      expect(p.blocks[0].exercises).toEqual(tous.filter((e) => ROLES_PRINCIPAL.includes(e.role)));
      expect(a.blocks[0].exercises).toEqual(tous.filter((e) => !ROLES_PRINCIPAL.includes(e.role)));
      expect(p.estimate.seconds + a.estimate.seconds).toBe(d.wod.estimate.seconds);
      // tout le reste de la séance est inchangé (signature, générateur, stimulus…)
      const sansCarte = (w: MuscuWod) => ({ ...w, blocks: null, estimate: null, rendu: { ...w.rendu, partie: null }, title: null, description: null, notes: null });
      expect(sansCarte(p)).toEqual(sansCarte(d.wod));
      expect(sansCarte(a)).toEqual(sansCarte(d.wod));

      const tp = renderFromWodJson(p, 'fr')!;
      const ta = renderFromWodJson(a, 'fr')!;
      expect(tp.title).toBe(`${d.wod.title} · Bloc principal`);
      expect(ta.title).toBe(`${d.wod.title} · Accessoires`);
      expect(tp.notes).toBe(d.wod.notes);
      expect(ta.notes).toBeNull();
      expect(tp.description).toContain(`Stimulus : ${d.wod.stimulus.note}`);
      expect(ta.description).not.toContain('Stimulus');
      for (const [w, t] of [[p, tp], [a, ta]] as const) {
        const lignes = t.description.split('\n');
        for (const e of tous) expect(lignes.includes(exerciseLine(e))).toBe(w.blocks[0].exercises.includes(e));
        expect(t.description).toContain(`Durée estimée ${w.estimate.minutes}'`);
        // colonnes d'éditeur du JSON = celles de la carte
        expect({ title: w.title, description: w.description, notes: w.notes }).toEqual(t);
      }
      // anglais : sans français
      for (const w of parts) {
        const t = renderFromWodJson(w, 'en')!;
        expect(t.title).toMatch(/ · (Main block|Accessories)$/);
        for (const l of [t.title, ...t.description.split('\n')].filter(Boolean)) expect([l, resteFrancais(l)]).toEqual([l, false]);
      }
    }
  });

  it('Tronc, groupe vide (dont semaine Force) → la séance entière seule, inchangée', () => {
    for (const s of SEMAINES) expect(partiesMuscu(s.days.find((d) => d.target === 'tronc')!.wod, C)).toEqual([s.days.find((d) => d.target === 'tronc')!.wod]);
    for (const d of FORCE.days.filter((x) => x.target !== 'tronc')) {
      for (const garder of [(r: string) => ROLES_PRINCIPAL.includes(r as never), (r: string) => !ROLES_PRINCIPAL.includes(r as never)]) {
        const w: MuscuWod = { ...d.wod, blocks: [{ kind: 'strength_session', exercises: d.wod.blocks[0].exercises.filter((e) => garder(e.role)) }] };
        expect(w.blocks[0].exercises.length).toBeGreaterThan(0);
        expect(partiesMuscu(w, C)).toEqual([w]);
      }
    }
  });
});

describe('cartesJourMuscu (construction, sans tirage)', () => {
  it('Push, Jambes, Pull, Fessiers & ischios : 4 cartes ; Tronc : 3 cartes', () => {
    for (const s of SEMAINES) for (const d of s.days) {
      const cartes = cartesJourMuscu(d, C);
      const forme = cartes.map((c) => `${c.block_name}/${c.wod_type}/${c.leaderboard_enabled}`);
      expect(forme).toEqual(d.target === 'tronc'
        ? ['warmup/custom/false', 'strength/strength/false', 'cooldown/custom/false']
        : ['warmup/custom/false', 'strength/strength/false', 'strength/strength/false', 'cooldown/custom/false']);
      expect(cartes[0].description).toBe(SPEC[d.target as keyof typeof SPEC][0]);
      expect(cartes[cartes.length - 1].description).toBe(SPEC[d.target as keyof typeof SPEC][1]);
      // Tronc : la carte est la séance entière, texte et JSON identiques à aujourd'hui
      if (d.target === 'tronc') expect(cartes[1]).toMatchObject({ title: d.wod.title, description: d.wod.description, notes: d.wod.notes, wod_json: d.wod });
      // échauffement et retour au calme : v2 de séance, sans grille ni score
      for (const c of [cartes[0], cartes[cartes.length - 1]]) {
        const j = c.wod_json as SessionStructuredBlock;
        expect(j).toMatchObject({ source: 'generator', discipline: 'session', v: 2, steps: null, finisher: null, gym_reps_rx: {} });
        expect(renderFromWodJson(j, 'fr')).toEqual({ title: c.title, description: c.description, notes: c.notes });
      }
      for (const c of cartes.filter((x) => x.block_name === 'strength')) {
        expect((c.wod_json as MuscuWod).blocks).toHaveLength(1);
        expect((c.wod_json as MuscuWod).blocks[0].kind).toBe('strength_session');
        expect(renderFromWodJson(c.wod_json, 'fr')).toEqual({ title: c.title, description: c.description, notes: c.notes });
      }
    }
  });

  it('groupe vide : 3 cartes', () => {
    const d = FORCE.days[0];
    const w: MuscuWod = { ...d.wod, blocks: [{ kind: 'strength_session', exercises: d.wod.blocks[0].exercises.filter((e) => ROLES_PRINCIPAL.includes(e.role)) }] };
    expect(cartesJourMuscu({ target: d.target, wod: w }, C).map((c) => c.block_name)).toEqual(['warmup', 'strength', 'cooldown']);
  });

  it('anglais : mêmes cartes, texte sans français', () => {
    for (const d of SEMAINES[0].days) {
      const frc = cartesJourMuscu(d, C);
      const enc = cartesJourMuscu(d, C, 'en');
      expect(enc.map((c) => c.wod_json)).toEqual(frc.map((c) => c.wod_json));
      for (const c of enc) for (const l of [c.title, ...c.description.split('\n')].filter(Boolean)) expect([l, resteFrancais(l)]).toEqual([l, false]);
    }
  });

  it('cible hors semaine de box : pas d\'échauffement ni de retour au calme inventés', () => {
    expect(lignesSeanceMuscu('bras' as MuscuTarget, 'echauffement')).toBeNull();
    expect(lignesSeanceMuscu('constructor' as MuscuTarget, 'retourAuCalme')).toBeNull();
    const d = SEMAINES[0].days[0];
    expect(cartesJourMuscu({ target: 'bras', wod: d.wod }, C).map((c) => c.block_name)).toEqual(['strength', 'strength']);
  });

  it('aucun appel au RNG', async () => {
    const { tirages } = await avecJournal(() => {
      for (const s of SEMAINES) for (const d of s.days) { cartesJourMuscu(d, C); cartesJourMuscu(d, C, 'en'); }
      return { texte: [], sortie: null };
    });
    expect(tirages).toEqual([]);
  });
});

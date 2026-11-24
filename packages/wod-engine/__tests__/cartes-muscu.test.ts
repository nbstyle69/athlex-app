/**
 * Musculation de box en plusieurs cartes (#620, #635) : textes de la spec, rendu des cartes
 * Échauffement / Retour au calme et des cartes d'un exercice, compatibilité des cartes #620,
 * fonctions de construction (sans tirage).
 */
import {
  fr, en, banqueVers, generateMuscuWeek, renderFromWodJson, rendreBlocSeance, renderMuscu, exerciseLine,
  cartesJourMuscu, partiesMuscu, lignesSeanceMuscu, nomExercice, ROLES_PRINCIPAL, MUSCU_WEEK_DAYS, CATALOG_SNAPSHOT, BANK_V1, weekSeed,
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
    expect(fr.musculation.partie).toEqual(LIBELLE.fr);
    expect(en.musculation.partie).toEqual(LIBELLE.en);
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

/** Ce qui fait une carte : sans lui, la carte doit redonner la séance du jour. */
const sansCarte = (w: MuscuWod) => ({ ...w, blocks: null, estimate: null, rendu: { ...w.rendu, partie: null, premiere: null }, title: null, description: null, notes: null });
const LIBELLE = {
  fr: { principal: 'Bloc principal', accessoires: 'Accessoires', tronc: 'Tronc' },
  en: { principal: 'Main block', accessoires: 'Accessories', tronc: 'Core' },
} as const;
const partieAttendue = (target: MuscuTarget, role: string) =>
  (target === 'tronc' ? 'tronc' : ROLES_PRINCIPAL.includes(role as never) ? 'principal' : 'accessoires');
const STIMULUS = /^Stimulus ?:/;

describe('cartes d\'un exercice (#635)', () => {
  const jours = SEMAINES.flatMap((s) => s.days);

  it('wod_json sans rendu.partie : rendu inchangé (= texte enregistré)', () => {
    for (const d of jours) {
      expect(d.wod.rendu?.partie).toBeUndefined();
      expect(renderFromWodJson(d.wod, 'fr')).toEqual({ title: d.wod.title, description: d.wod.description, notes: d.wod.notes });
      expect(renderMuscu(d.wod)).toBe(d.wod.description);
      // séance entière : la note du stimulus reste dans la description (texte de #510)
      expect(d.wod.description.split('\n')).toContain(`Stimulus : ${d.wod.stimulus.note}`);
      expect(d.wod.title).not.toMatch(/Bloc principal|Accessoires/);
    }
  });

  it('une séance par exercice, dans l\'ordre ; partie par rôle (Tronc le samedi) ; durées additives ; reste de la séance inchangé', () => {
    for (const d of jours) {
      const parts = partiesMuscu(d.wod, C);
      const tous = d.wod.blocks[0].exercises;
      expect(parts.map((p) => p.blocks)).toEqual(tous.map((e) => [{ kind: 'strength_session', exercises: [e] }]));
      expect(parts.map((p) => p.rendu?.partie)).toEqual(tous.map((e) => partieAttendue(d.target, e.role)));
      expect(parts.map((p) => p.rendu?.premiere)).toEqual(tous.map((_, i) => i === 0));
      expect(parts.reduce((s, p) => s + p.estimate.seconds, 0)).toBe(d.wod.estimate.seconds);
      for (const p of parts) {
        expect(p.estimate.minutes).toBe(Math.round(p.estimate.seconds / 60));
        expect(sansCarte(p)).toEqual(sansCarte(d.wod));
      }
    }
    // les trois parties sont représentées
    const vues = new Set(jours.flatMap((d) => partiesMuscu(d.wod, C).map((p) => p.rendu!.partie)));
    expect([...vues].sort()).toEqual(['accessoires', 'principal', 'tronc']);
  });

  it.each(['fr', 'en'] as const)('%s : titre « <partie> · <exercice> », description de l\'exercice seul, stimulus sur la première carte seulement', (langue) => {
    for (const d of jours) {
      const entiere = renderFromWodJson(d.wod, langue)!;
      partiesMuscu(d.wod, C).forEach((p, i) => {
        const e = p.blocks[0].exercises[0];
        const t = renderFromWodJson(p, langue)!;
        expect(t.title).toBe(`${LIBELLE[langue][partieAttendue(d.target, e.role)]} · ${nomExercice(e.id, e.name, langue)}`);
        const lignes = t.description.split('\n');
        // en-tête de la séance gardé, puis la ligne de cet exercice seul
        expect(lignes[0]).toBe(entiere.description.split('\n')[0]);
        expect(lignes).toContain(exerciseLine(e, langue));
        for (const x of d.wod.blocks[0].exercises.filter((y) => y !== e)) expect(lignes).not.toContain(exerciseLine(x, langue));
        expect(t.notes).toBe(i === 0 ? entiere.notes : null);
        expect(lignes.filter((l) => STIMULUS.test(l))).toHaveLength(i === 0 ? 1 : 0);
        if (langue === 'fr') expect({ title: p.title, description: p.description, notes: p.notes }).toEqual(t);
        else for (const l of [t.title, ...lignes].filter(Boolean)) expect([l, resteFrancais(l)]).toEqual([l, false]);
      });
    }
  });

  it('carte #620 (rendu.partie sans premiere, plusieurs exercices ou un seul) : rendu de #620 inchangé', () => {
    for (const d of jours.filter((x) => x.target !== 'tronc')) {
      const exs = d.wod.blocks[0].exercises;
      const principal = exs.filter((e) => ROLES_PRINCIPAL.includes(e.role));
      const accessoires = exs.filter((e) => !ROLES_PRINCIPAL.includes(e.role));
      const carte620 = (partie: 'principal' | 'accessoires', exercises: typeof exs): MuscuWod =>
        ({ ...d.wod, blocks: [{ kind: 'strength_session', exercises }], rendu: { ...d.wod.rendu!, partie } });
      const cas: Array<[MuscuWod, 'principal' | 'accessoires']> = [
        [carte620('principal', principal), 'principal'], [carte620('accessoires', accessoires), 'accessoires'],
        [carte620('principal', principal.slice(0, 1)), 'principal'], [carte620('accessoires', accessoires.slice(0, 1)), 'accessoires'],
      ];
      for (const [w, partie] of cas) {
        if (!w.blocks[0].exercises.length) continue;
        for (const langue of ['fr', 'en'] as const) {
          const t = renderFromWodJson(w, langue)!;
          const entiere = renderFromWodJson(d.wod, langue)!;
          expect(t.title).toBe(`${entiere.title} · ${LIBELLE[langue][partie]}`);
          expect(t.notes).toBe(partie === 'accessoires' ? null : entiere.notes);
          expect(t.description.split('\n').some((l) => STIMULUS.test(l))).toBe(partie !== 'accessoires');
        }
      }
    }
  });
});

describe('cartesJourMuscu (construction, sans tirage)', () => {
  it('Échauffement · une carte par exercice · Retour au calme, tous les jours (Tronc compris)', () => {
    for (const s of SEMAINES) for (const d of s.days) {
      const cartes = cartesJourMuscu(d, C);
      const n = d.wod.blocks[0].exercises.length;
      expect(cartes).toHaveLength(n + 2);
      expect(cartes.map((c) => `${c.block_name}/${c.wod_type}/${c.leaderboard_enabled}`))
        .toEqual(['warmup/custom/false', ...Array(n).fill('strength/strength/false'), 'cooldown/custom/false']);
      expect(cartes[0].description).toBe(SPEC[d.target as keyof typeof SPEC][0]);
      expect(cartes[cartes.length - 1].description).toBe(SPEC[d.target as keyof typeof SPEC][1]);
      const exos = cartes.slice(1, -1);
      expect(exos.map((c) => c.wod_json)).toEqual(partiesMuscu(d.wod, C));
      expect(exos.map((c) => c.notes)).toEqual(exos.map((_, i) => (i === 0 ? d.wod.notes : null)));
      // échauffement et retour au calme : v2 de séance, sans grille ni score
      for (const c of [cartes[0], cartes[cartes.length - 1]]) {
        const j = c.wod_json as SessionStructuredBlock;
        expect(j).toMatchObject({ source: 'generator', discipline: 'session', v: 2, steps: null, finisher: null, gym_reps_rx: {} });
        expect(renderFromWodJson(j, 'fr')).toEqual({ title: c.title, description: c.description, notes: c.notes });
      }
      for (const c of exos) expect(renderFromWodJson(c.wod_json, 'fr')).toEqual({ title: c.title, description: c.description, notes: c.notes });
    }
  });

  it('anglais : mêmes cartes, texte sans français', () => {
    for (const d of SEMAINES[0].days) {
      const frc = cartesJourMuscu(d, C);
      const enc = cartesJourMuscu(d, C, 'en');
      expect(enc.map((c) => c.wod_json)).toEqual(frc.map((c) => c.wod_json));
      for (const c of enc) for (const l of [c.title, ...c.description.split('\n')].filter(Boolean)) expect([l, resteFrancais(l)]).toEqual([l, false]);
    }
  });

  it('séance sans rendu (pas réaffichable) : la séance entière, seule', () => {
    const { rendu: _r, ...sans } = SEMAINES[0].days[0].wod;
    expect(partiesMuscu(sans as MuscuWod, C)).toEqual([sans]);
  });

  it('cible hors semaine de box : pas d\'échauffement ni de retour au calme inventés', () => {
    expect(lignesSeanceMuscu('bras' as MuscuTarget, 'echauffement')).toBeNull();
    expect(lignesSeanceMuscu('constructor' as MuscuTarget, 'retourAuCalme')).toBeNull();
    const d = SEMAINES[0].days[0];
    expect(cartesJourMuscu({ target: 'bras', wod: d.wod }, C).map((c) => c.block_name)).toEqual(d.wod.blocks[0].exercises.map(() => 'strength'));
  });

  it('aucun appel au RNG', async () => {
    const { tirages } = await avecJournal(() => {
      for (const s of SEMAINES) for (const d of s.days) { cartesJourMuscu(d, C); cartesJourMuscu(d, C, 'en'); }
      return { texte: [], sortie: null };
    });
    expect(tirages).toEqual([]);
  });
});

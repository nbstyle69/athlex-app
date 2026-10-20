import {
  MEMBRES, PSEUDO_COACH, EMAIL_COACH, MOTIF_MEMBRE, BOX_ATHLEX, TOURNOIS,
  adapterPseudo, scorePour, seriesPour, estimation1rm, repartirInscrits,
  quotaReservation, reservantsPour, comptesAPurger, tournoisAPurger, scoreTournoi, lireCle, wodsSansContact, WodBox, CompteLu,
} from '../logique';

describe('pseudos', () => {
  it('51 pseudos uniques (insensible à la casse), dans l’ordre du brief', () => {
    const tous = [...MEMBRES.map(m => m.pseudo), PSEUDO_COACH];
    expect(tous).toHaveLength(51);
    expect(new Set(tous.map(p => p.toLowerCase())).size).toBe(51);
    expect(MEMBRES[0]).toMatchObject({ nn: 1, pseudo: 'Lola_Burpee', genre: 'female', email: 'demo.vitrine+01@athlexapp.eu' });
    expect(MEMBRES[24]).toMatchObject({ pseudo: 'MiaStrong', genre: 'female' });
    expect(MEMBRES[25]).toMatchObject({ nn: 26, pseudo: 'PauloLift', genre: 'male' });
    expect(MEMBRES[49]).toMatchObject({ nn: 50, pseudo: 'GabinGo', email: 'demo.vitrine+50@athlexapp.eu' });
  });
  it('adresses : 50 au motif membre, coach hors motif', () => {
    expect(MEMBRES.every(m => MOTIF_MEMBRE.test(m.email))).toBe(true);
    expect(MOTIF_MEMBRE.test(EMAIL_COACH)).toBe(false);
    for (const faux of ['demo.vitrine+00@athlexapp.eu', 'demo.vitrine+51@athlexapp.eu', 'demo.vitrine+1@athlexapp.eu', 'xdemo.vitrine+01@athlexapp.eu', 'demo.vitrine+01@athlexapp.eu.evil'])
      expect(MOTIF_MEMBRE.test(faux)).toBe(false);
  });
  it('libre : inchangé', () => {
    expect(adapterPseudo('Lola_Burpee', new Set())).toEqual({ pseudo: 'Lola_Burpee', caractere: false, chiffre: false });
  });
  it('repli caractère : underscore refusé → retiré', () => {
    expect(adapterPseudo('Lola_Burpee', new Set(), { caracteres: /[A-Za-z0-9]/, longueurMax: 24 }))
      .toEqual({ pseudo: 'LolaBurpee', caractere: true, chiffre: false });
  });
  it('repli chiffre : pris (même casse différente) → chiffre ajouté, sans reprendre un pris', () => {
    expect(adapterPseudo('PauloLift', new Set(['paulolift', 'paulolift2']))).toEqual({ pseudo: 'PauloLift3', caractere: false, chiffre: true });
  });
  it('longueur : tronqué, chiffre compris', () => {
    const r = adapterPseudo('AnaisWallBall', new Set(['anaiswa']), { caracteres: /./, longueurMax: 7 });
    expect(r.pseudo).toBe('AnaisW2');
    expect(r.pseudo.length).toBeLessThanOrEqual(7);
  });
});

describe('scores du Whiteboard', () => {
  const wod = (wod_type: string, extra: Partial<WodBox> = {}): WodBox =>
    ({ id: `w-${wod_type}`, wod_type, description: '21-15-9 Thruster', time_cap_seconds: 15 * 60, rounds: null, leaderboard_enabled: true, ...extra });
  const tous = (w: WodBox) => MEMBRES.map(m => scorePour(w, m)!);

  it('For Time : secondes sous le cap, ou reps au cap (capped), et quelques DNF', () => {
    const s = tous(wod('for-time'));
    for (const x of s) {
      expect(x.score_type).toBe('time');
      expect(Number.isInteger(x.score_value) && x.score_value > 0).toBe(true);
      if (!x.capped) expect(x.score_value).toBeLessThan(15 * 60);
    }
    const dnf = s.filter(x => x.capped).length;
    expect(dnf).toBeGreaterThan(0);
    expect(dnf).toBeLessThan(10);
  });
  it('AMRAP : reps, ≤ 1,5 rep/s (plafond de l’app)', () => {
    for (const x of tous(wod('amrap'))) {
      expect(x).toMatchObject({ score_type: 'reps', capped: false });
      expect(x.score_value).toBeGreaterThan(0);
      expect(x.score_value).toBeLessThanOrEqual(Math.ceil(15 * 60 * 1.5));
    }
  });
  it('EMOM : rounds, ≤ nombre de minutes', () => {
    for (const x of tous(wod('emom', { rounds: 15 }))) {
      expect(x.score_type).toBe('rounds');
      expect(x.score_value).toBeGreaterThanOrEqual(1);
      expect(x.score_value).toBeLessThanOrEqual(15);
    }
  });
  it('Tabata : reps, ≤ 280', () => {
    for (const x of tous(wod('tabata'))) {
      expect(x.score_type).toBe('reps');
      expect(x.score_value).toBeGreaterThan(0);
      expect(x.score_value).toBeLessThanOrEqual(280);
    }
  });
  it('RX et Scaled mêlés ; scaled toujours Scaled', () => {
    const s = tous(wod('amrap'));
    expect(s.some(x => x.rx) && s.some(x => !x.rx)).toBe(true);
    MEMBRES.forEach((m, i) => { if (m.niveau === 'scaled') expect(s[i].rx).toBe(false); });
  });
  it('custom sans classement, musculation : pas de score ici', () => {
    expect(scorePour(wod('custom', { leaderboard_enabled: false }), MEMBRES[0])).toBeNull();
    expect(scorePour(wod('strength'), MEMBRES[0])).toBeNull();
  });
  it('les meilleurs vont plus vite que les plus faibles', () => {
    const w = wod('for-time');
    const fort = MEMBRES.reduce((a, b) => (a.force > b.force ? a : b));
    const faible = MEMBRES.reduce((a, b) => (a.force < b.force ? a : b));
    const f = scorePour(w, fort)!;
    const d = scorePour(w, faible)!;
    expect(f.capped).toBe(false);
    expect(d.capped || d.score_value > f.score_value).toBe(true);
  });
});

describe('règle de contact avec les comptes réels protégés', () => {
  it('un WOD déjà scoré par un compte protégé est sauté, les autres gardés', () => {
    const wods = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }];
    const r = wodsSansContact(wods, new Set(['w2']));
    expect(r.gardes.map(w => w.id)).toEqual(['w1', 'w3']);
    expect(r.sautes).toBe(1);
    expect(wodsSansContact(wods, new Set()).sautes).toBe(0);
  });
});

describe('musculation', () => {
  const desc = [
    'Musculation · Push',
    'Bench Press — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:30',
    'Squat Snatch — 2 × 2 @ 50 %1RM — repos 1:00',
    'Strict Pull-Ups — 3 × 5 — repos 1:30',
    'Ab Wheel Rollout — 3 × 10 — charge poids du corps — repos 1:00',
    'Landmine Press — 3 × 10 / bras — charge RPE 8 — repos 1:15',
  ].join('\n');
  it('séries valides pour validate_strength_session', () => {
    const { sets } = seriesPour(desc, MEMBRES[30]);
    expect(sets).toHaveLength(4 + 2 + 3 + 3 + 3);
    const cles = new Set(sets.map(s => `${s.movement}#${s.set_index}`));
    expect(cles.size).toBe(sets.length); // SERIES_EN_DOUBLE impossible
    for (const s of sets) {
      expect(s.reps).toBeGreaterThanOrEqual(1);
      expect(s.reps).toBeLessThanOrEqual(500);
      if (s.load_kg != null) { expect(s.load_kg).toBeGreaterThan(0); expect(s.load_kg).toBeLessThanOrEqual(500); }
      else expect(s.load_required).toBe(false);
    }
    expect(sets.find(s => s.movement === 'Strict Pull-Ups')!.load_kg).toBeNull();
    expect(sets.find(s => s.movement === 'Ab Wheel Rollout')!.load_kg).toBeNull();
    expect(sets.find(s => s.movement === 'Squat Snatch')!.load_required).toBe(true);
  });
  it('1RM : libellé de la page Records, jamais au-dessus de l’estimation de la série', () => {
    const { sets, records } = seriesPour(desc, MEMBRES[30]);
    expect(records.map(r => r.label).sort()).toEqual(['Bench Press', 'Squat Snatch']);
    for (const r of records) {
      const s = sets.find(x => x.movement === r.movement && x.set_index === r.set_index)!;
      expect(r.kg).toBeLessThanOrEqual(estimation1rm(s.load_kg!, s.reps)!);
      expect(r.kg * 2).toBe(Math.round(r.kg * 2));
    }
  });
  it('bloc sans ligne de musculation : rien', () => {
    expect(seriesPour('Every 2\' × 8, en rotation :\n12 Goblet Squat @ 24/16 kg', MEMBRES[0]).sets).toHaveLength(0);
  });
});

describe('répartition des tournois', () => {
  const r = repartirInscrits();
  it('effectifs exacts de T1 à T6, places libres en T5 et T6', () => {
    for (const t of TOURNOIS) {
      expect(r[t.ref]).toHaveLength(t.inscrits);
      expect(new Set(r[t.ref]).size).toBe(t.inscrits);
      expect(t.inscrits).toBeLessThanOrEqual(t.places);
    }
    expect(TOURNOIS.find(t => t.ref === 'T5')!.places - r.T5.length).toBe(20);
    expect(TOURNOIS.find(t => t.ref === 'T6')!.places - r.T6.length).toBe(8);
  });
  it('chaque membre dans 1 à 3 tournois', () => {
    const n = new Map<number, number>();
    Object.values(r).flat().forEach(nn => n.set(nn, (n.get(nn) ?? 0) + 1));
    for (const m of MEMBRES) {
      expect(n.get(m.nn) ?? 0).toBeGreaterThanOrEqual(1);
      expect(n.get(m.nn) ?? 0).toBeLessThanOrEqual(3);
    }
  });
  it('femmes et hommes dans chaque tournoi ; RX et Scaled parmi les tournois', () => {
    for (const t of TOURNOIS) {
      const g = r[t.ref].map(nn => MEMBRES[nn - 1].genre);
      expect(Math.abs(g.filter(x => x === 'female').length - g.filter(x => x === 'male').length)).toBeLessThanOrEqual(1);
    }
    expect(new Set(TOURNOIS.map(t => t.niveau))).toEqual(new Set(['rx', 'scaled', 'inter']));
  });
  it('état visé (décision B) : T1 à T4 en cours, un seul tour joué ; T5 et T6 à venir', () => {
    const etat = Object.fromEntries(TOURNOIS.map(t => [t.ref, `${t.demarre ? 'demarre' : 'a-venir'}:${t.toursJoues}`]));
    expect(etat).toEqual({ T1: 'demarre:1', T2: 'demarre:1', T3: 'demarre:1', T4: 'demarre:1', T5: 'a-venir:0', T6: 'a-venir:0' });
    expect(TOURNOIS.map(t => [t.ref, t.places, t.inscrits])).toEqual([
      ['T1', 24, 24], ['T2', 16, 16], ['T3', 8, 8], ['T4', 24, 24], ['T5', 32, 12], ['T6', 16, 8]]);
  });
  it('T2 : tableau à 16 avec petite finale, T3 en double élimination', () => {
    expect(TOURNOIS.find(t => t.ref === 'T2')).toMatchObject({ format: 'bracket', places: 16, petiteFinale: true });
    expect(TOURNOIS.find(t => t.ref === 'T3')).toMatchObject({ format: 'swiss', places: 8 });
  });
  it('score de tournoi : texte numérique positif', () => {
    for (const m of MEMBRES) {
      expect(Number(scoreTournoi('For Time', 'w', m))).toBeGreaterThan(0);
      expect(scoreTournoi('AMRAP', 'w', m)).toMatch(/^\d+$/);
    }
  });
});

describe('réservations', () => {
  it('au plus 60 % de la capacité, toujours au moins 3 places libres', () => {
    for (let cap = 0; cap <= 40; cap++) {
      for (let pris = 0; pris <= cap; pris++) {
        const q = quotaReservation(cap, pris);
        expect(q).toBeGreaterThanOrEqual(0);
        if (q > 0) {
          expect(pris + q).toBeLessThanOrEqual(Math.floor(cap * 0.6));
          expect(cap - (pris + q)).toBeGreaterThanOrEqual(3);
        }
      }
    }
    expect(quotaReservation(15, 0)).toBe(9);
    expect(quotaReservation(15, 9)).toBe(0);
    expect(quotaReservation(5, 0)).toBe(2);
    expect(quotaReservation(3, 0)).toBe(0);
  });
  it('un créneau par membre et par jour, choix stable', () => {
    const deja = new Set([1, 2, 3]);
    const a = reservantsPour('c1', MEMBRES, deja, 9);
    expect(a).toHaveLength(9);
    expect(a.some(m => deja.has(m.nn))).toBe(false);
    expect(reservantsPour('c1', MEMBRES, deja, 9)).toEqual(a);
    // Presque tous ont déjà un créneau ce jour-là : seuls les 5 autres restent.
    const presqueTous = new Set(MEMBRES.map(m => m.nn).filter(nn => nn > 5));
    expect(reservantsPour('c2', MEMBRES, presqueTous, 9).map(m => m.nn).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('clés Supabase', () => {
  const SECRET = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  it('ordre des variables, préfixe exigé', () => {
    expect(lireCle({ SUPABASE_SECRET_KEY: 'sb_secret_a', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_b' }, SECRET, 'sb_secret_'))
      .toEqual({ valeur: 'sb_secret_a', nom: 'SUPABASE_SECRET_KEY' });
    expect(lireCle({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_b' }, SECRET, 'sb_secret_'))
      .toEqual({ valeur: 'sb_secret_b', nom: 'SUPABASE_SERVICE_ROLE_KEY' });
  });
  it('ancienne clé refusée, sans jamais citer la valeur', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.ancienne-cle-service';
    const r = lireCle({ SUPABASE_SERVICE_ROLE_KEY: jwt }, SECRET, 'sb_secret_') as { erreur: string };
    expect(r.erreur).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(r.erreur).not.toContain(jwt);
    expect(r.erreur).not.toContain('eyJ');
    const pub = lireCle({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_x' }, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'], 'sb_publishable_') as { erreur: string };
    expect(pub.erreur).toBe('EXPO_PUBLIC_SUPABASE_ANON_KEY ne commence pas par sb_publishable_');
    expect(lireCle({}, SECRET, 'sb_secret_')).toEqual({ erreur: 'variable manquante : SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY' });
  });
});

describe('sélection de la purge', () => {
  const AUTRE = '00000000-0000-4000-b523-00000000000b';
  const REV = 'rev';
  const c = (id: string, email: string, extra: Partial<CompteLu> = {}): CompteLu =>
    ({ id, email, box_id: BOX_ATHLEX, role: 'member', formule: 'Accès démo', demo_account: false, ...extra });
  const lus: CompteLu[] = [
    c('m01', 'demo.vitrine+01@athlexapp.eu', { demo_account: true }),
    c('m50', 'Demo.Vitrine+50@AthleXapp.eu'),
    c('coach', EMAIL_COACH, { role: 'coach', formule: null, demo_account: true }),
    c('autre-box', 'demo.vitrine+02@athlexapp.eu', { box_id: AUTRE }),
    c('sans-formule', 'demo.vitrine+03@athlexapp.eu', { formule: 'Illimité' }),
    c('motif-voisin', 'demo.vitrine+51@athlexapp.eu'),
    c('motif-suffixe', 'demo.vitrine+04@athlexapp.eu.fr'),
    c('reel', 'nab@example.com', { formule: 'Illimité' }),
    c('legacy', 'cad-1@demo.athlexapp.eu', { demo_account: true }),
    c(REV, 'reviewer@demo.athlexapp.eu', { demo_account: true }), // même au domaine démo, le reviewer reste exclu
    c('legacy-autre-box', 'cad-2@demo.athlexapp.eu', { demo_account: true, box_id: AUTRE }),
  ];
  it('par défaut : motif + box (+ formule pour les membres), rien d’autre', () => {
    expect(comptesAPurger(lus, BOX_ATHLEX)).toEqual(['coach', 'm01', 'm50']);
  });
  it('box jetable : seulement ses propres comptes vitrine', () => {
    expect(comptesAPurger(lus, AUTRE)).toEqual(['autre-box']);
  });
  it('--include-legacy-demo : un compte réel n’est jamais pris, même marqué démo', () => {
    const avecReel = [...lus, c('reel-marque', 'membre.reel@example.com', { demo_account: true, formule: 'Illimité' })];
    expect(comptesAPurger(avecReel, BOX_ATHLEX, { legacy: true, reviewerId: REV })).not.toContain('reel-marque');
    expect(comptesAPurger(avecReel, BOX_ATHLEX, { legacy: true, reviewerId: REV })).not.toContain('reel');
  });
  it('--include-legacy-demo : comptes de démo d’AthleX Fitness, reviewer exclu', () => {
    expect(comptesAPurger(lus, BOX_ATHLEX, { legacy: true, reviewerId: REV })).toEqual(['coach', 'legacy', 'm01', 'm50']);
    expect(comptesAPurger(lus, AUTRE, { legacy: true, reviewerId: REV })).toEqual(['autre-box']);
    expect(() => comptesAPurger(lus, BOX_ATHLEX, { legacy: true })).toThrow(/REVIEWER_INCONNU/);
  });
  it('tournois : ceux du fichier ET de la box', () => {
    const lusT = [{ id: 't1', box_id: BOX_ATHLEX }, { id: 't2', box_id: AUTRE }, { id: 'tx', box_id: BOX_ATHLEX }];
    expect(tournoisAPurger({ T1: 't1', T2: 't2' }, lusT, BOX_ATHLEX)).toEqual(['t1']);
    expect(tournoisAPurger({}, lusT, BOX_ATHLEX)).toEqual([]);
  });
});

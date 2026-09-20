import {
  TOLERANCE,
  generateBlocC, estimateDuration, signature, CATALOG_SNAPSHOT, BANK_V1, NoValidWod, movementById,
  profileCategory, VEST_LOAD_KG, HYBRID_CATEGORIES, FUNCTIONAL_CATEGORIES, movementLines,
  cadenceFor, movementCapFor, forceBand, isSlowSkill, carriesIntention, EQUIPMENT_FALLBACK, render,
  heavyAllowed, rackAllowed, engineShare, CARDIO_EXCLUDED_IDS, RACK_ONLY_IDS, ENGINE_MIN_SHARE, RUN_MIN_M,
} from '../src';
import type { GenerateParams, GeneratedWod } from '../src';
import { conformityGrid, violations, countByCause, CAUSES } from './conformity';
import { parseMovementLine } from '../../../src/utils/movementParser';
import { normalizeMovement } from '../../../src/utils/tournamentUtils';

const gen = (p: GenerateParams, seed: number): GeneratedWod => generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed);
const F: GenerateParams = { entry: 'express', discipline: 'functional', budget_min: 12, intention: 'mixed', format: 'surprise' };
const H: GenerateParams = { entry: 'express', discipline: 'hybrid', budget_min: 20, intention: 'interval', format: 'surprise', vest: 'none' };
// 200 seeds par combinaison (§9) ; WOD_ENGINE_SEEDS=20 pour une boucle locale rapide.
const SEEDS = Number(process.env.WOD_ENGINE_SEEDS ?? 200);

describe('generateBlocC — déterminisme', () => {
  it('même entrée + même seed ⇒ sortie identique', () => {
    for (const p of [F, H]) for (const seed of [1, 42, 123456]) {
      expect(gen(p, seed)).toEqual(gen(p, seed));
    }
  });

  it('seeds différentes ⇒ signatures différentes (sur un panel de 30 seeds, au moins 20 signatures)', () => {
    const sigs = new Set<string>();
    for (let s = 1; s <= 30; s++) sigs.add(gen(F, s).signature);
    expect(sigs.size).toBeGreaterThanOrEqual(20);
  });

  it('la signature dérive de la sortie structurée', () => {
    const w = gen(F, 7);
    expect(signature(w)).toBe(w.signature);
    expect(w.signature).toContain(w.generator.skeleton_id.split(':')[0]);
    expect(w.signature).toContain(w.blocks[0].movements[0].id);
  });

  it('aucune signature identique sur deux seeds consécutives quand l’historique est transmis', () => {
    for (const p of [F, H, { ...H, intention: 'run' as const, budget_min: 10 }]) {
      const recent: string[] = [];
      for (let s = 1; s <= 40; s++) {
        const w = gen({ ...p, recent_signatures: recent.slice(-10) }, s);
        expect(recent.slice(-10)).not.toContain(w.signature);
        recent.push(w.signature);
      }
    }
  });
});

describe('generateBlocC — conformité §5 sur toutes les combinaisons', () => {
  const grid = conformityGrid();

  it(`aucun NoValidWod et aucune violation sur ${grid.length} combinaisons × ${SEEDS} seeds`, () => {
    const failures: string[] = [];
    const byCause = countByCause([]);
    let generated = 0;
    for (const p of grid) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        let w: GeneratedWod;
        try { w = gen(p, seed); } catch (e) {
          failures.push(`${JSON.stringify(p)} seed ${seed} : ${e instanceof NoValidWod ? JSON.stringify(e.reasons) : String(e)}`);
          continue;
        }
        generated++;
        const v = violations(w, p);
        const c = countByCause(v);
        for (const k of CAUSES) byCause[k] += c[k];
        if (v.length && failures.length <= 20) failures.push(`${JSON.stringify(p)} seed ${seed} (${w.generator.skeleton_id}) : ${v.join(' ; ')}`);
      }
    }
    // compteur par cause (A–K) de la relecture des samples : tout doit être à zéro
    // eslint-disable-next-line no-console
    console.log(`conformité : ${generated} WODs · violations par cause ${CAUSES.map((k) => `${k}=${byCause[k]}`).join(' ')}`);
    expect(byCause).toEqual(countByCause([]));
    expect(failures).toEqual([]);
  }, 600_000);

  it('la sortie structurée porte les champs §6', () => {
    const w = gen(H, 3);
    expect(w.source).toBe('generator');
    expect(w.generator).toMatchObject({ seed: 3, catalog_version: CATALOG_SNAPSHOT.version, bank_version: BANK_V1.version });
    expect(w.blocks).toHaveLength(1);
    expect(w.blocks[0].kind).toBe('wod');
    for (const m of w.blocks[0].movements) {
      expect(m).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), unit: expect.any(String), qty: expect.any(Number) }));
      expect(Object.keys(m.loads_by_category).sort()).toEqual([...HYBRID_CATEGORIES].sort());
      expect(Object.keys(m.substitutions_by_category).sort()).toEqual([...HYBRID_CATEGORIES].sort());
      expect(Object.keys(m.cadence_by_category).sort()).toEqual([...HYBRID_CATEGORIES].sort());
    }
    expect(w.estimate.by_category.men).toBeDefined();
    expect(w.stimulus.rpe).toBeGreaterThan(0);
    expect(w.title.length).toBeGreaterThan(0);
    expect(w.description.length).toBeGreaterThan(0);
  });
});

describe('estimateDuration', () => {
  it('estime toutes les catégories de la discipline et reste dans la tolérance du moteur pour la référence', () => {
    for (const [p, cats] of [[F, FUNCTIONAL_CATEGORIES], [H, HYBRID_CATEGORIES]] as const) {
      for (let s = 1; s <= 10; s++) {
        const w = gen(p, s);
        for (const c of cats) {
          const e = estimateDuration(w, c);
          expect(e.by_category[c]!.minutes).toBeGreaterThan(0);
        }
        expect(Math.abs(w.estimate.reference_minutes - p.budget_min) / p.budget_min).toBeLessThanOrEqual(TOLERANCE + 1e-9);
        const scaledOrWomen = w.estimate.by_category[p.discipline === 'functional' ? 'scaled' : 'women']!.minutes;
        const ref = w.estimate.reference_minutes;
        if (w.time_cap_seconds !== null) expect(scaledOrWomen).toBeGreaterThanOrEqual(ref);
      }
    }
  });

  it('un for time porte un cap = estimation × cap_factor arrondi à 30 s ; un AMRAP n’en a pas', () => {
    const ft = gen({ ...F, format: 'for_time' }, 5);
    expect(ft.time_cap_seconds).not.toBeNull();
    expect(ft.time_cap_seconds! % 30).toBe(0);
    expect(ft.time_cap_seconds!).toBeGreaterThan(ft.estimate.reference_minutes * 60);
    const am = gen({ ...F, format: 'amrap' }, 5);
    expect(am.format).toBe('amrap');
    expect(am.blocks[0].timecap).toBeNull();
    expect(am.time_cap_seconds).toBe(F.budget_min * 60);
  });
});

describe('exclusions et après-classe', () => {
  it('exclude: ["rower"] n’emploie jamais Row', () => {
    for (let s = 1; s <= 60; s++) {
      const w = gen({ ...F, intention: 'cardio', exclude: ['rower'] }, s);
      expect(w.blocks[0].movements.map((m) => m.id)).not.toContain('row');
    }
  });

  it('exclude par nom ou famille', () => {
    for (let s = 1; s <= 30; s++) {
      const w = gen({ ...F, exclude: ['barbell', 'Wall Balls'] }, s);
      for (const m of w.blocks[0].movements) {
        expect(movementById(CATALOG_SNAPSHOT, m.id)!.family).not.toBe('barbell');
        expect(m.id).not.toBe('wall_ball');
      }
    }
  });

  it('après-classe squat + thrusters : aucun squat / lunge / barre, bande light, durée 10-20', () => {
    const p: GenerateParams = {
      entry: 'after_class', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'surprise',
      after_class: { day_movements: ['Back Squat', 'Thruster'] },
    };
    for (let s = 1; s <= 60; s++) {
      const w = gen(p, s);
      expect(w.after_class!.excluded_patterns).toEqual(expect.arrayContaining(['squat', 'lunge']));
      expect(w.after_class!.excluded_families).toContain('barbell');
      for (const gm of w.blocks[0].movements) {
        const m = movementById(CATALOG_SNAPSHOT, gm.id)!;
        expect(m.pattern).not.toContain('squat');
        expect(m.pattern).not.toContain('lunge');
        expect(m.family).not.toBe('barbell');
        if (m.loads) expect(gm.load_band).toBe('light');
      }
    }
  });

  it('après-classe : les noms affichés du jour (pre-wod / post-wod compris) sont résolus vers le catalogue', () => {
    const w = gen({
      entry: 'after_class', discipline: 'hybrid', budget_min: 15, intention: 'engine', format: 'surprise',
      after_class: { day_movements: ['20 cal Row', 'Wall Balls', 'Burpees Over the Bar'] },
    }, 1);
    expect(w.after_class!.excluded_families).toEqual(expect.arrayContaining(['erg', 'wallball']));
    expect(w.blocks[0].movements.map((m) => m.id)).not.toContain('wall_ball');
  });
});

describe('gilet lesté (Hybrid)', () => {
  it('required / optional portent les charges 9/6 kg par catégorie ; none et Functional n’en portent pas', () => {
    const req = gen({ ...H, vest: 'required' }, 2);
    expect(req.vest).toEqual({ mode: 'required', load_kg_by_category: { women: 6, men: 9, women_pro: 6, men_pro: 9 } });
    expect(req.description).toMatch(/Gilet lesté/);
    const opt = gen({ ...H, vest: 'optional' }, 2);
    expect(opt.vest!.mode).toBe('optional');
    expect(opt.description).toMatch(/Gilet lesté optionnel/);
    expect(gen({ ...H, vest: 'none' }, 2).vest).toBeNull();
    expect(gen({ ...F, vest: 'required' }, 2).vest).toBeNull();
    expect(VEST_LOAD_KG.women).toBe(6);
    expect(VEST_LOAD_KG.men_pro).toBe(9);
  });

  it('le gilet est un paramètre, jamais un mouvement', () => {
    for (let s = 1; s <= 20; s++) {
      const w = gen({ ...H, vest: 'required' }, s);
      expect(w.blocks[0].movements.some((m) => /vest|gilet/i.test(m.name))).toBe(false);
    }
  });
});

describe('profil → catégorie', () => {
  it('Functional : niveaux app, rx+ → rxplus, inconnu → rx', () => {
    expect(profileCategory('functional', 'scaled', 'male')).toBe('scaled');
    expect(profileCategory('functional', 'inter', 'female')).toBe('inter');
    expect(profileCategory('functional', 'rx', null)).toBe('rx');
    expect(profileCategory('functional', 'rx+', 'male')).toBe('rxplus');
    expect(profileCategory('functional', 'elite', 'male')).toBe('elite');
    expect(profileCategory('functional', 'pro', 'male')).toBe('pro');
    expect(profileCategory('functional', undefined, undefined)).toBe('rx');
  });

  it('Hybrid : genre + niveau, gender null ⇒ Men', () => {
    expect(profileCategory('hybrid', 'rx', 'female')).toBe('women');
    expect(profileCategory('hybrid', 'rx', 'male')).toBe('men');
    expect(profileCategory('hybrid', 'rx+', 'female')).toBe('women_pro');
    expect(profileCategory('hybrid', 'pro', 'male')).toBe('men_pro');
    expect(profileCategory('hybrid', 'rx', null)).toBe('men');
    expect(profileCategory('hybrid', 'Women Pro', null)).toBe('women_pro');
  });

  it('profile_category cible l’estimation ; une catégorie hors discipline retombe sur la référence', () => {
    const w = gen({ ...F, profile_category: 'scaled' }, 9);
    expect(Math.abs(w.estimate.by_category.scaled!.minutes - F.budget_min) / F.budget_min).toBeLessThanOrEqual(TOLERANCE + 1e-9);
    expect(gen({ ...F, profile_category: 'men' }, 9)).toEqual(gen({ ...F, profile_category: 'rx' }, 9));
  });
});

describe('rendu texte ↔ parser app', () => {
  const creditable = (w: GeneratedWod) => w.blocks[0].movements.filter((m) => m.unit !== 's' && !m.scheme && !m.per_minute && w.format !== 'stations' && w.format !== 'tabata');

  it('chaque ligne de mouvement créditable se relit avec la quantité, l’unité et le nom du catalogue', () => {
    for (const p of [F, H, { ...F, intention: 'cardio' as const }, { ...H, intention: 'engine' as const }]) {
      for (let s = 1; s <= 25; s++) {
        const w = gen(p, s);
        const lines = movementLines(w);
        const movs = creditable(w);
        if (!movs.length) continue;
        const parsed = lines.map((l) => parseMovementLine(l.replace(/^(R\d+|Min \d+) · /, '')));
        for (const m of movs) {
          const hit = parsed.find((x) => x && normalizeMovement(x.name).key === normalizeMovement(m.name).key && x.reps === m.qty);
          expect({ line: lines.join(' | '), id: m.id, qty: m.qty, unit: m.unit, hit: !!hit }).toMatchObject({ hit: true });
          if (m.unit !== 'reps') expect(hit!.unit).toBe(m.unit);
          if (m.load_unit === 'cm') expect(hit!.weight_kg).toBeUndefined();
        }
      }
    }
  });

  it('les secondes ne créditent rien et les cm ne sont pas une charge', () => {
    expect(parseMovementLine('30 s Plank Hold')).toBeNull();
    const box = parseMovementLine('12 Box Jumps (60/50 cm)');
    expect(box).toEqual({ name: 'Box Jumps', reps: 12, weight_kg: undefined });
  });

  it('les lignes d’entête (rounds, AMRAP, EMOM, schéma) ne sont pas lues comme des mouvements', () => {
    for (const p of [F, H]) for (let s = 1; s <= 10; s++) {
      const w = gen(p, s);
      const head = w.description.split('\n')[0];
      expect(parseMovementLine(head)).toBeNull();
    }
  });
});

describe('corrections A–K des relectures des samples', () => {
  const every = (pred: (w: GeneratedWod) => boolean, params: GenerateParams, seeds = 40) => {
    for (let seed = 1; seed <= seeds; seed++) expect({ seed, ok: pred(gen(params, seed)) }).toEqual({ seed, ok: true });
  };
  const m = (id: string) => movementById(CATALOG_SNAPSHOT, id)!;

  it('A — un for time à schéma garde 21-15-9 (ou 9-7-5 en lourd), jamais gonflé', () => {
    every((w) => {
      const b = w.blocks[0];
      if (b.format !== 'for_time' || !b.scheme) return true;
      return ['21,15,9', '9,7,5'].includes(b.scheme.join(','));
    }, { ...F, budget_min: 8, format: 'for_time' });
  });

  it('B — plafonds §5.4 : table RX, × 0,7 Scaled/Inter, × 1,3 Elite/Pro, barre par bande', () => {
    expect(movementCapFor(BANK_V1, m('toes_to_bar'), 'light', 'reps', 'rx')).toBe(60);
    expect(movementCapFor(BANK_V1, m('toes_to_bar'), 'light', 'reps', 'scaled')).toBe(42);
    expect(movementCapFor(BANK_V1, m('toes_to_bar'), 'light', 'reps', 'pro')).toBe(78);
    expect(movementCapFor(BANK_V1, m('handstand_walk'), 'light', 'm', 'rx')).toBe(60);
    expect(movementCapFor(BANK_V1, m('deadlift'), 'heavy', 'reps', 'rx')).toBe(25);
    expect(movementCapFor(BANK_V1, m('deadlift'), 'medium', 'reps', 'rx')).toBe(60);
    expect(movementCapFor(BANK_V1, m('deadlift'), 'light', 'reps', 'rx')).toBe(90);
    expect(movementCapFor(BANK_V1, m('bar_facing_burpee'), 'light', 'reps', 'rx')).toBe(60);
    expect(movementCapFor(BANK_V1, m('row'), 'light', 'cal', 'rx')).toBeNull();
  });

  const skOf = (w: GeneratedWod) => ({ id: w.generator.skeleton_id.split(':')[0], format: w.blocks[0].format });
  const amrap = { id: 'couplet_amrap_short', format: 'amrap' as const };
  const emom = { id: 'emom_alternating', format: 'emom' as const };

  it('C — Force porte une charge lourde, Core un pattern core, Cardio aucun skill de la liste', () => {
    expect(forceBand({ budget_min: 12, entry: 'express' }, amrap)).toBe('heavy');
    for (const format of ['chipper', 'stations', 'amrap'] as const) {
      every((w) => w.blocks[0].movements.some((gm) => carriesIntention({ intention: 'force', budget_min: 12, entry: 'express' }, m(gm.id), gm.load_band ?? 'light', skOf(w))), { ...F, intention: 'force', format }, 20);
      every((w) => w.blocks[0].movements.every((gm) => !isSlowSkill(m(gm.id))), { ...F, intention: 'cardio', format }, 20);
    }
    every((w) => w.blocks[0].movements.some((gm) => m(gm.id).pattern.includes('core')), { ...H, intention: 'core', budget_min: 30 }, 20);
  });

  it('Cardio — liste d\'exclusion fermée, pas de seuil de cadence', () => {
    const excluded = ['bar_muscle_up', 'ring_muscle_up', 'rope_climb', 'legless_rope_climb', 'wall_walk', 'handstand_walk', 'strict_handstand_push_up', 'squat_snatch', 'squat_clean', 'cluster'];
    expect([...CARDIO_EXCLUDED_IDS].sort()).toEqual([...excluded].sort());
    for (const id of excluded) expect({ id, slow: isSlowSkill(m(id)) }).toEqual({ id, slow: true });
    for (const id of ['burpee', 'devil_press', 'handstand_push_up', 'wall_ball']) expect({ id, slow: isSlowSkill(m(id)) }).toEqual({ id, slow: false });
  });

  it('Force > 15\' — heavy interdit seulement en format continu ; EMOM, intervalles, stations, heavy_couplet gardent heavy', () => {
    expect(heavyAllowed(amrap, 20)).toBe(false);
    expect(heavyAllowed({ id: 'chipper_descending', format: 'chipper' }, 20)).toBe(false);
    expect(heavyAllowed({ id: 'ladder_ascending', format: 'ladder' }, 20)).toBe(false);
    expect(heavyAllowed(amrap, 15)).toBe(true);
    expect(heavyAllowed(emom, 30)).toBe(true);
    expect(heavyAllowed({ id: 'interval_work_rest', format: 'interval' }, 30)).toBe(true);
    expect(heavyAllowed({ id: 'stations_rotation', format: 'stations' }, 30)).toBe(true);
    expect(heavyAllowed({ id: 'heavy_couplet', format: 'rounds_for_time' }, 20)).toBe(true);
    expect(forceBand({ budget_min: 20, entry: 'express' }, amrap)).toBe('medium');
    expect(forceBand({ budget_min: 20, entry: 'express' }, emom)).toBe('heavy');
    for (const format of ['emom', 'stations', 'interval'] as const) {
      // ±20 % : un format relâché vers du continu (rounds for time à 16' pour 20') ne porte pas de heavy — c'est la règle du continu
      every((w) => (heavyAllowed(skOf(w), 20)
        ? w.blocks[0].movements.some((gm) => gm.load_band === 'heavy')
        : w.blocks[0].movements.every((gm) => gm.load_band !== 'heavy')), { ...F, intention: 'force', budget_min: 20, format }, 20);
    }
    // aucun squelette Force continu à 20' : le format se relâche vers EMOM/intervalles (heavy légitime) ;
    // si un format continu sort malgré tout, il ne porte jamais de heavy
    every((w) => heavyAllowed(skOf(w), 20) || w.blocks[0].movements.every((gm) => gm.load_band !== 'heavy'), { ...F, intention: 'force', budget_min: 20, format: 'amrap' }, 20);
    every((w) => heavyAllowed(skOf(w), 30) || w.blocks[0].movements.every((gm) => gm.load_band !== 'heavy'), { ...F, intention: 'force', budget_min: 30 }, 20);
  });

  it('I — chipper à schéma fixe 50-40-30-20-10, 15/20 min seulement, plafonds devil press / BBJO / BJO / DB snatch', () => {
    const cd = BANK_V1.skeletons.find((s) => s.id === 'chipper_descending')!;
    expect(cd.durations).toEqual([15, 20]);
    expect(cd.scheme).toEqual([50, 40, 30, 20, 10]);
    every((w) => {
      const b = w.blocks[0];
      if (skOf(w).id !== 'chipper_descending') return true;
      return b.movements.map((gm) => gm.qty).join(',') === '50,40,30,20,10';
    }, { ...F, budget_min: 20, format: 'chipper' });
    every((w) => skOf(w).id !== 'chipper_descending', { ...F, budget_min: 30, format: 'chipper' });
    expect(movementCapFor(BANK_V1, m('devil_press'), 'light', 'reps', 'rx')).toBe(30);
    expect(movementCapFor(BANK_V1, m('burpee_box_jump_over'), 'light', 'reps', 'rx')).toBe(40);
    expect(movementCapFor(BANK_V1, m('box_jump_over'), 'light', 'reps', 'rx')).toBe(60);
    expect(movementCapFor(BANK_V1, m('db_snatch'), 'light', 'reps', 'rx')).toBe(60);
  });

  it('J — Gym = famille gym pull_v/push_v ; Engine ≥ 40 % du temps ; Run ≥ 200 m par round', () => {
    const gym = { intention: 'gym' as const, budget_min: 12, entry: 'express' as const };
    for (const id of ['ghd_sit_up', 'plank_hold', 'push_up', 'burpee']) expect({ id, gym: carriesIntention(gym, m(id), 'light', amrap) }).toEqual({ id, gym: false });
    for (const id of ['toes_to_bar', 'pull_up', 'handstand_push_up', 'ring_dip']) expect({ id, gym: carriesIntention(gym, m(id), 'light', amrap) }).toEqual({ id, gym: true });
    const isGym = (w: GeneratedWod) => w.blocks[0].movements.some((gm) => m(gm.id).family === 'gym' && m(gm.id).pattern.some((p) => p === 'pull_v' || p === 'push_v'));
    for (const format of ['amrap', 'stations', 'chipper'] as const) every(isGym, { ...F, intention: 'gym', budget_min: 30, format }, 20);
    every(isGym, { entry: 'after_class', discipline: 'functional', budget_min: 10, intention: 'gym', format: 'surprise', after_class: { day_movements: ['Back Squat'] } }, 20);
    for (const budget of [15, 30, 45]) every((w) => engineShare(CATALOG_SNAPSHOT, w.blocks[0], 'men') >= ENGINE_MIN_SHARE, { ...H, intention: 'engine', budget_min: budget }, 20);
    every((w) => engineShare(CATALOG_SNAPSHOT, w.blocks[0], 'men') >= ENGINE_MIN_SHARE, { entry: 'after_class', discipline: 'hybrid', budget_min: 10, intention: 'engine', format: 'surprise', after_class: { day_movements: ['Thrusters'] } }, 20);
    const hasRun = (w: GeneratedWod) => w.blocks[0].movements.some((gm) => m(gm.id).family === 'run' && gm.unit === 'm' && gm.qty >= RUN_MIN_M);
    for (const budget of [15, 30, 45]) every(hasRun, { ...H, intention: 'run', budget_min: budget }, 20);
    every(hasRun, { entry: 'after_class', discipline: 'hybrid', budget_min: 10, intention: 'run', format: 'surprise', after_class: { day_movements: ['Thrusters'] } }, 20);
  });

  it('K — back squat / bench press seulement en EMOM, intervalles, stations, heavy_couplet', () => {
    expect([...RACK_ONLY_IDS].sort()).toEqual(['back_squat', 'bench_press']);
    expect(rackAllowed(amrap)).toBe(false);
    expect(rackAllowed({ id: 'couplet_for_time_21_15_9', format: 'for_time' })).toBe(false);
    expect(rackAllowed({ id: 'chipper_descending', format: 'chipper' })).toBe(false);
    expect(rackAllowed(emom)).toBe(true);
    expect(rackAllowed({ id: 'interval_work_rest', format: 'interval' })).toBe(true);
    expect(rackAllowed({ id: 'heavy_couplet', format: 'rounds_for_time' })).toBe(true);
    for (const format of ['amrap', 'for_time', 'chipper'] as const) {
      for (const intention of ['cardio', 'force', 'mixed'] as const) {
        every((w) => rackAllowed(skOf(w)) || w.blocks[0].movements.every((gm) => !RACK_ONLY_IDS.has(gm.id)), { ...F, intention, format }, 20);
      }
    }
  });

  it('D — un chipper est un seul passage, run ≤ 800 m, rendu sans « rounds »', () => {
    every((w) => {
      const b = w.blocks[0];
      if (b.format !== 'chipper') return true;
      const runOk = b.movements.every((gm) => m(gm.id).family !== 'run' || gm.unit !== 'm' || gm.qty <= 800);
      return b.rounds === null && runOk && !/rounds .*chipper/.test(render(w).description);
    }, { ...F, budget_min: 30, format: 'chipper' });
  });

  it('E — ladder ouverte : paliers start/step, palier différent entre Scaled et Pro', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const w = gen({ ...F, budget_min: 10, format: 'for_time' }, seed);
      const b = w.blocks[0];
      if (b.format !== 'ladder') continue;
      seen++;
      expect(b.ladder).toEqual({ start: 3, step: 3 });
      expect(b.scheme![b.scheme!.length - 1]).toBeGreaterThan(9);
      expect(w.estimate.by_category.scaled!.target).not.toBe(w.estimate.by_category.pro!.target);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('F — rounds × intervalle ≤ budget pour interval, EMOM, stations', () => {
    for (const format of ['interval', 'emom', 'stations'] as const) {
      every((w) => {
        const b = w.blocks[0];
        const rounds = b.rounds ?? 1;
        const budgetS = w.budget_min * 60;
        if (b.rest?.every_s) return rounds * b.rest.every_s * (b.format === 'emom' ? b.movements.length : 1) <= budgetS;
        if (b.format === 'stations') return rounds * b.movements.length * ((b.rest?.work_s ?? 0) + (b.rest?.rest_s ?? 0)) <= budgetS;
        return true;
      }, { ...F, budget_min: 20, format }, 30);
    }
  });

  it('G — matériel exclu ⇒ version sans matériel (Bar Facing Burpees → Burpees), jamais conservé', () => {
    expect(EQUIPMENT_FALLBACK.bar_facing_burpee).toBe('burpee');
    const p: GenerateParams = { entry: 'after_class', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'surprise', after_class: { day_movements: ['Back Squat', 'Thrusters'] } };
    every((w) => w.blocks[0].movements.every((gm) => !m(gm.id).equipment.some((e) => e.toLowerCase() === 'barbell')), p, 60);
    every((w) => w.blocks[0].movements.every((gm) => !m(gm.id).equipment.some((e) => e.toLowerCase() === 'barbell')), { ...F, exclude: ['barbell'] }, 60);
  });

  it('H — cadences RX du catalogue v2 (version 2)', () => {
    expect(CATALOG_SNAPSHOT.version).toBe(2);
    expect(cadenceFor(m('sled_push'), 'rx', 'm')).toBe(2.2);
    expect(cadenceFor(m('sled_pull'), 'rx', 'm')).toBe(2.6);
    expect(cadenceFor(m('sandbag_lunge'), 'rx', 'm')).toBe(2.0);
    expect(cadenceFor(m('burpee_broad_jump'), 'rx', 'm')).toBe(2.6);
    expect(cadenceFor(m('sandbag_carry'), 'rx', 'm')).toBe(0.7);
    expect(cadenceFor(m('handstand_walk'), 'rx', 'm')).toBe(3.0);
  });
});

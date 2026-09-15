import {
  generateBlocC, estimateDuration, signature, CATALOG_SNAPSHOT, BANK_V1, NoValidWod, movementById,
  profileCategory, VEST_LOAD_KG, HYBRID_CATEGORIES, FUNCTIONAL_CATEGORIES, movementLines,
} from '../src';
import type { GenerateParams, GeneratedWod } from '../src';
import { conformityGrid, violations } from './conformity';
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
    for (const p of grid) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        let w: GeneratedWod;
        try { w = gen(p, seed); } catch (e) {
          failures.push(`${JSON.stringify(p)} seed ${seed} : ${e instanceof NoValidWod ? JSON.stringify(e.reasons) : String(e)}`);
          continue;
        }
        const v = violations(w, p);
        if (v.length) failures.push(`${JSON.stringify(p)} seed ${seed} (${w.generator.skeleton_id}) : ${v.join(' ; ')}`);
        if (failures.length > 20) break;
      }
    }
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
  it('estime toutes les catégories de la discipline et reste dans ±10 % pour la référence', () => {
    for (const [p, cats] of [[F, FUNCTIONAL_CATEGORIES], [H, HYBRID_CATEGORIES]] as const) {
      for (let s = 1; s <= 10; s++) {
        const w = gen(p, s);
        for (const c of cats) {
          const e = estimateDuration(w, c);
          expect(e.by_category[c]!.minutes).toBeGreaterThan(0);
        }
        expect(Math.abs(w.estimate.reference_minutes - p.budget_min) / p.budget_min).toBeLessThanOrEqual(0.1 + 1e-9);
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
    expect(Math.abs(w.estimate.by_category.scaled!.minutes - F.budget_min) / F.budget_min).toBeLessThanOrEqual(0.1 + 1e-9);
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

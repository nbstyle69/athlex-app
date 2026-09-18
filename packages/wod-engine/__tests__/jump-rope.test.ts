/**
 * A3 — la corde à sauter dans le générateur Functional.
 *
 * Constat du 17/09/2026 : `double_under` ne sortait JAMAIS, 0 sur 3 000 tirages.
 * La cause n'était ni son poids (9, le plus élevé de son slot), ni les
 * squelettes, ni le filtre d'équipement, mais le plafond GÉNÉRIQUE de volume :
 * 100 reps en RX, le même pour un thruster et un double under. Ses plages
 * partent de 25 à 50 reps par round ; au-delà de deux rounds le minimum dépasse
 * 100, la quantité ne peut pas descendre sous son plancher, et la tentative
 * entière est rejetée.
 *
 * Deux corrections mesurées ici : un facteur de plafond par famille, et un
 * plafond de classe qui REMPLACE le générique au lieu de s'y minimiser.
 */
import {
  generateBlocC, CATALOG_SNAPSHOT, BANK_V1, FAMILY_CAP_FACTOR, genericCapFor, movementCapFor,
  movementById, FUNCTIONAL_SKELETONS,
} from '../src';
import type { GenerateParams, Intention, FormatChoice } from '../src';

const DUREES = [8, 12, 15, 20, 30];
const INTENTIONS: Intention[] = ['mixed', 'cardio', 'force', 'gym'];
const FORMATS: FormatChoice[] = ['surprise', 'amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval'];

/** `n` tirages Functional sans aucune exclusion, comme un athlète qui ne touche à rien. */
function tirages(n: number, seed0 = 123000) {
  const wods = [];
  for (let i = 0; i < n; i++) {
    const params: GenerateParams = {
      entry: 'express', discipline: 'functional',
      budget_min: DUREES[i % DUREES.length],
      intention: INTENTIONS[i % INTENTIONS.length],
      format: FORMATS[i % FORMATS.length],
      profile_category: 'rx',
    };
    try { wods.push(generateBlocC(params, CATALOG_SNAPSHOT, BANK_V1, seed0 + i)); } catch { /* rejeté */ }
  }
  return wods;
}

const contient = (w: ReturnType<typeof tirages>[number], id: string) =>
  w.blocks.flatMap((b) => b.movements ?? []).some((m) => m.id === id);

describe('plafond de volume : facteur par famille', () => {
  it("le poids de tirage de la corde est relevé à 10, le haut de l'échelle 0–10 du catalogue", () => {
    expect(movementById(CATALOG_SNAPSHOT, 'double_under')!.weight_functional).toBe(10);
  });

  it('jump_rope est la seule famille modulée, à 4', () => {
    expect(FAMILY_CAP_FACTOR).toEqual({ jump_rope: 4 });
  });

  it('une famille sans facteur garde son plafond générique', () => {
    const caps = { reps: 100 };
    expect(genericCapFor(caps, 'barbell', 'reps')).toBe(100);
    expect(genericCapFor(caps, 'wallball', 'reps')).toBe(100);
  });

  it('la corde à sauter monte à 400 reps en RX', () => {
    expect(genericCapFor({ reps: 100 }, 'jump_rope', 'reps')).toBe(400);
  });

  it('une unité sans plafond générique reste sans plafond', () => {
    expect(genericCapFor({ reps: 100 }, 'jump_rope', 'cal')).toBeUndefined();
  });

  it('erg et run ne sont pas modulés : leurs unités propres les régissent', () => {
    expect(FAMILY_CAP_FACTOR.erg).toBeUndefined();
    expect(FAMILY_CAP_FACTOR.run).toBeUndefined();
  });
});

describe('plafond de classe : il remplace le générique, il ne s\'y minimise pas', () => {
  const wallBall = movementById(CATALOG_SNAPSHOT, 'wall_ball')!;
  const genRx = BANK_V1.volume_caps.functional.rx!.reps!;

  it('la corde à sauter est plafonnée à 200 en RX, sous son générique modulé de 400', () => {
    const du = movementById(CATALOG_SNAPSHOT, 'double_under')!;
    expect(movementCapFor(BANK_V1, du, 'light', 'reps', 'rx')).toBe(200);
    expect(genericCapFor({ reps: 100 }, 'jump_rope', 'reps')).toBe(400);
  });

  it('et déclinée par catégorie comme les autres plafonds', () => {
    const du = movementById(CATALOG_SNAPSHOT, 'double_under')!;
    expect(movementCapFor(BANK_V1, du, 'light', 'reps', 'scaled')).toBe(140);
    expect(movementCapFor(BANK_V1, du, 'light', 'reps', 'elite')).toBe(260);
  });

  it('les wall balls sont plafonnés à 150 en RX, au-dessus du générique de 100', () => {
    // C'est ce que la table dit depuis toujours ; le `Math.min` l'ignorait.
    expect(movementCapFor(BANK_V1, wallBall, 'medium', 'reps', 'rx')).toBe(150);
    expect(genRx).toBe(100);
  });

  it('un plafond de classe plus bas resserre toujours', () => {
    const barreLourde = movementById(CATALOG_SNAPSHOT, 'deadlift')!;
    const cap = movementCapFor(BANK_V1, barreLourde, 'heavy', 'reps', 'rx');
    expect(cap).not.toBeNull();
    expect(cap!).toBeLessThan(genRx);
  });
});

describe('la corde à sauter sort du générateur Functional', () => {
  const N = 500;
  const wods = tirages(N);

  it('les 500 tirages aboutissent', () => {
    expect(wods).toHaveLength(N);
  });

  it('les double unders apparaissent sur 500 tirages, plancher à 3,5 %', () => {
    const n = wods.filter((w) => contient(w, 'double_under')).length;
    // Le brief visait 15 %, ramené à 8 %, puis assumé à 5,9 % : arbitrage de Nab
    // du 17/09/2026, « le plafond de volume valait plus que le point et demi de
    // fréquence ». Borner la corde à 200 reps coûte environ 1,4 point
    // d'apparition ; un WOD à 300 double unders discrédite plus sûrement le
    // générateur que leur rareté. Le poids voulu (13) est hors de l'échelle 0–10
    // bornée par contrainte ; à 10 et plafond 200 : 4,83 % en moyenne sur huit
    // blocs de 500, dispersés de 4,0 à 6,2 %. Le plancher est posé sous le
    // minimum observé pour ne pas être capricieux.
    expect(n / N).toBeGreaterThanOrEqual(0.035);
  });

  it('sur 2 000 tirages, le taux se stabilise au-dessus de 4 %', () => {
    const grand = tirages(2000, 500000);
    const n = grand.filter((w) => contient(w, 'double_under')).length;
    expect(n / grand.length).toBeGreaterThanOrEqual(0.04);
  });

  it('… sans devenir omniprésente', () => {
    const n = wods.filter((w) => contient(w, 'double_under')).length;
    expect(n / N).toBeLessThan(0.20);
  });

  it('et sans volume déraisonnable : 200 reps au plus en RX', () => {
    // Le facteur de famille seul laissait passer 300 à 400 reps sur 9 % des
    // tirages. Le plafond de classe les ramène sous 200 ; c'est lui qui décide,
    // et il ne le pourrait pas sans le correctif du `Math.min`.
    const volumes = wods.flatMap((w) => {
      const b = w.blocks[0];
      const mult = b.format === 'rounds_for_time' ? (b.rounds ?? 1) : 1;
      return b.movements.filter((m) => m.id === 'double_under')
        .map((m) => m.qty * (m.round !== undefined ? 1 : mult));
    });
    expect(volumes.length).toBeGreaterThan(0);
    expect(Math.max(...volumes)).toBeLessThanOrEqual(200);
  });

  it('elle est répartie sur plusieurs squelettes, pas concentrée sur un seul', () => {
    const parSk: Record<string, number> = {};
    for (const w of wods) if (contient(w, 'double_under')) {
      parSk[w.generator.skeleton_id] = (parSk[w.generator.skeleton_id] ?? 0) + 1;
    }
    const total = Object.values(parSk).reduce((a, b) => a + b, 0);
    expect(Object.keys(parSk).length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...Object.values(parSk)) / total).toBeLessThan(0.6);
  });

  it('le contrôle sait échouer : ramené à 100 reps, la corde disparaît', () => {
    // On reproduit l'état d'avant le lot : pas de plafond de classe pour la
    // famille, et pas de facteur — la corde retombe sous le générique de 100.
    // Retirer le seul facteur ne suffirait plus : le plafond de classe à 200
    // décide désormais à sa place, et c'est le comportement voulu.
    const avant = FAMILY_CAP_FACTOR.jump_rope;
    const i = BANK_V1.movement_caps.findIndex((c) => c.family === 'jump_rope');
    const [retire] = BANK_V1.movement_caps.splice(i, 1);
    FAMILY_CAP_FACTOR.jump_rope = 1;
    try {
      const n = tirages(500).filter((w) => contient(w, 'double_under')).length;
      expect(n / 500).toBeLessThan(0.01);
    } finally {
      FAMILY_CAP_FACTOR.jump_rope = avant;
      BANK_V1.movement_caps.splice(i, 0, retire);
    }
  });

  it('… et le plafond de classe seul suffit à la borner, facteur ou pas', () => {
    const avant = FAMILY_CAP_FACTOR.jump_rope;
    FAMILY_CAP_FACTOR.jump_rope = 1;
    try {
      const n = tirages(500).filter((w) => contient(w, 'double_under')).length;
      expect(n / 500).toBeGreaterThan(0.01);
    } finally {
      FAMILY_CAP_FACTOR.jump_rope = avant;
    }
  });

  it('single_under reste absent : atteignable par substitution seulement, inchangé', () => {
    expect(wods.some((w) => contient(w, 'single_under'))).toBe(false);
  });
});

describe('les trois squelettes élargis', () => {
  const accepte = (id: string) => {
    const sk = FUNCTIONAL_SKELETONS.find((s) => s.id === id)!;
    return (sk.slots ?? []).some((s) => (s.pick.family ?? []).includes('jump_rope'));
  };

  it.each(['interval_work_rest', 'triplet_amrap_mid', 'emom_alternating'])(
    '%s a désormais un slot ouvert à la corde', (id) => expect(accepte(id)).toBe(true),
  );

  it('l\'élargissement s\'arrête là : six squelettes Functional au plus la nomment', () => {
    const n = FUNCTIONAL_SKELETONS.filter((sk) => accepte(sk.id)).length;
    expect(n).toBe(6);
  });
});

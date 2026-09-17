/**
 * Les seeds SQL de `wod_skeletons` / `wod_volume_caps` sont commités : ils doivent rester
 * identiques au snapshot embarqué (`BANK_V1`), sinon la prod lit une banque que les tests
 * n'ont jamais vue — c'est ce qui a cassé la piste functional le 16/09/2026 (seed 20261217
 * sans les progressions de skills, snapshot avec). Même logique que edge-bundle.test.ts.
 *
 * On rejoue les seeds dans l'ordre des migrations : une ligne UPDATE / ON CONFLICT
 * postérieure écrase la précédente, comme en base.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  BANK_V1, BANK_VERSION, MUSCU_BANK_VERSION, SESSION_BANK_VERSION, SESSION_SKELETONS,
  skeletonToRow, movementCapToRow, muscuSkeletonToRow, sessionSkeletonToRow,
} from '../src';
import { withSkillProgression } from '../src/session';

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');
const read = (name: string) => fs.readFileSync(path.join(MIGRATIONS, name), 'utf8');
const unq = (s: string) => s.replace(/''/g, "'");
const STR = "'((?:[^']+|'')*)'";  // boucle déroulée : la forme ambiguë part en backtracking exponentiel sur les gros seeds

interface SeedSkeleton { id: string; discipline: string; format: string; definition: unknown; active: boolean; version: number }
interface SeedCap { label: string; ids: string[] | null; family: string | null; band: string | null; unit: string; rx_total: number; active: boolean; version: number }

/** Lignes `wod_skeletons` d'un seed : VALUES (…) d'un INSERT puis UPDATE … WHERE id = …, dans l'ordre du fichier. */
export function skeletonsFromSeed(sql: string, into = new Map<string, SeedSkeleton>()): Map<string, SeedSkeleton> {
  const insert = new RegExp(`\\(${STR}, ${STR}, ${STR}, ${STR}::jsonb, (true|false), (\\d+)\\)`, 'g');
  const update = new RegExp(`UPDATE public\\.wod_skeletons SET definition = ${STR}::jsonb, version = (\\d+)[^;]*?WHERE id = ${STR}`, 'g');
  for (const m of sql.matchAll(insert)) {
    into.set(unq(m[1]), { id: unq(m[1]), discipline: unq(m[2]), format: unq(m[3]), definition: JSON.parse(unq(m[4])), active: m[5] === 'true', version: Number(m[6]) });
  }
  for (const m of sql.matchAll(update)) {
    const prev = into.get(unq(m[3]));
    if (!prev) throw new Error(`UPDATE d'une ligne absente des seeds précédents : ${unq(m[3])}`);
    into.set(prev.id, { ...prev, definition: JSON.parse(unq(m[1])), version: Number(m[2]) });
  }
  return into;
}

/** Lignes `wod_volume_caps` d'un seed (INSERT VALUES). */
export function capsFromSeed(sql: string): Map<string, SeedCap> {
  const arr = "(NULL|ARRAY\\[[^\\]]*\\]::text\\[\\])";
  const nul = `(NULL|${STR})`;
  const row = new RegExp(`\\(${STR}, ${arr}, ${nul}, ${nul}, ${STR}, (\\d+(?:\\.\\d+)?), (true|false), (\\d+)\\)`, 'g');
  const out = new Map<string, SeedCap>();
  for (const m of sql.matchAll(row)) {
    const ids = m[2] === 'NULL' ? null : [...m[2].matchAll(new RegExp(STR, 'g'))].map((x) => unq(x[1]));
    out.set(unq(m[1]), {
      label: unq(m[1]), ids, family: m[3] === 'NULL' ? null : unq(m[4]), band: m[5] === 'NULL' ? null : unq(m[6]),
      unit: unq(m[7]), rx_total: Number(m[8]), active: m[9] === 'true', version: Number(m[10]),
    });
  }
  return out;
}

const seeded = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

describe('seeds SQL ↔ snapshot embarqué', () => {
  it('squelettes de séance : 20261217 + 20261219 + 20261222 = les 13 squelettes du snapshot', () => {
    const seed = skeletonsFromSeed(
      read('20261222000000_auto_programming_tracks_hybrid.sql'),
      skeletonsFromSeed(read('20261219000000_wod_skeletons_session_sync.sql'), skeletonsFromSeed(read('20261217000000_wod_skeletons_session.sql'))),
    );
    const session = [...seed.values()].filter((r) => r.discipline === 'session');
    const expected = BANK_V1.session_skeletons.map((sk) => sessionSkeletonToRow(sk, SESSION_BANK_VERSION));
    expect(session).toHaveLength(13);
    expect(seeded(session)).toEqual(seeded(JSON.parse(JSON.stringify(expected))));
    const skills = session.flatMap((r) => ((r.definition as { block_a: { skill?: { progression?: unknown } }[] | null }).block_a ?? []).filter((o) => o.skill));
    expect(skills.length).toBeGreaterThan(0);
    for (const o of skills) expect(o.skill?.progression).toBeDefined();
  });

  it('le seed 20261217 seul est bien celui qui manquait de progressions (le contrôle sait échouer)', () => {
    const only17 = [...skeletonsFromSeed(read('20261217000000_wod_skeletons_session.sql')).values()];
    const expected = BANK_V1.session_skeletons.map((sk) => sessionSkeletonToRow(sk, SESSION_BANK_VERSION));
    expect(seeded(only17)).not.toEqual(seeded(JSON.parse(JSON.stringify(expected))));
  });

  it('squelettes musculation : 20261215 + 20261220 = MUSCU_SKELETONS', () => {
    const seed = skeletonsFromSeed(read('20261220000000_wod_skeletons_musculation_sync.sql'), skeletonsFromSeed(read('20261215000000_wod_skeletons_musculation.sql')));
    const muscu = [...seed.values()].filter((r) => r.discipline === 'musculation');
    const expected = BANK_V1.muscu_skeletons.map((sk) => muscuSkeletonToRow(sk, MUSCU_BANK_VERSION));
    expect(seeded(muscu)).toEqual(seeded(JSON.parse(JSON.stringify(expected))));
  });

  it('le seed 20261215 seul est antérieur aux règles M1–M10 / M2 (le contrôle sait échouer)', () => {
    const only15 = [...skeletonsFromSeed(read('20261215000000_wod_skeletons_musculation.sql')).values()];
    const expected = BANK_V1.muscu_skeletons.map((sk) => muscuSkeletonToRow(sk, MUSCU_BANK_VERSION));
    expect(seeded(only15)).not.toEqual(seeded(JSON.parse(JSON.stringify(expected))));
  });

  it('squelettes metcon et plafonds : 20261212 = BANK_V1', () => {
    const sql = read('20261212000000_wod_skeletons_volume_caps.sql');
    const seed = [...skeletonsFromSeed(sql).values()].filter((r) => r.discipline === 'functional' || r.discipline === 'hybrid');
    const expected = BANK_V1.skeletons.map((sk) => skeletonToRow(sk, BANK_VERSION));
    expect(seeded(seed)).toEqual(seeded(JSON.parse(JSON.stringify(expected))));
    const caps = Object.fromEntries(capsFromSeed(sql));
    const expectedCaps = Object.fromEntries(BANK_V1.movement_caps.map((c) => [c.label, movementCapToRow(c, BANK_VERSION)]));
    expect(caps).toEqual(JSON.parse(JSON.stringify(expectedCaps)));
  });
});

describe('withSkillProgression : skill lu depuis une base sans progression', () => {
  const s3 = SESSION_SKELETONS.find((s) => s.id === 'S3_gym')!;
  const c2b = (s3.block_a ?? []).find((o) => o.id === 'skill_c2b')!;
  const stripped = { ...c2b, skill: { ...c2b.skill!, progression: undefined as unknown as { a: string; b: string } } };

  it('complète depuis le snapshot embarqué', () => {
    expect(withSkillProgression(stripped)).toEqual(c2b);
  });

  it('rend l\'option inchangée quand la progression est déjà là', () => {
    expect(withSkillProgression(c2b)).toBe(c2b);
  });

  it('refuse explicitement un skill inconnu, en le nommant', () => {
    expect(() => withSkillProgression({ ...stripped, id: 'skill_inconnu', movement: 'pegboard' }))
      .toThrow(/skill_inconnu.*pegboard.*sans progression/);
  });
});

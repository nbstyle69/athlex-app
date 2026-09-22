/**
 * `movement_stats_keys` dit-elle exactement ce que dit le client ?
 *
 * Les WOD de tournoi structurés nomment leurs mouvements par l'id de
 * `movement_catalog` ; les cumuls et les badges comptent des clés canoniques.
 * Le pont entre les deux est versionné dans `supabase/seed/movement_stats_keys.json`
 * et inséré tel quel par la migration `20270102`. Ce test le REDÉRIVE avec le
 * `normalizeMovement` du client appliqué aux noms du catalogue, et échoue à la
 * moindre divergence : si le dictionnaire du client change, le serveur ne peut
 * pas continuer à créditer selon l'ancien.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { normalizeMovement, isKnownMovementKey } from '../utils/tournamentUtils';
import { badgePrefixFor, MovementUnit } from '../utils/movementBadgeKeys';
import { CATALOG_SNAPSHOT } from '../../packages/wod-engine/src';

const RACINE = path.resolve(__dirname, '..', '..');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const FICHIER: { correspondances: Record<string, string>; sans_correspondance: string[] } =
  JSON.parse(lire('supabase/seed/movement_stats_keys.json'));

const catalogue = CATALOG_SNAPSHOT.movements as ReadonlyArray<{
  id: string; name: string; unit_default?: string; badge_key?: string | null;
}>;

describe('movement_stats_keys ≡ normalizeMovement du client sur le catalogue', () => {
  it('le catalogue a bien été lu (contre-exemple)', () => {
    expect(catalogue.length).toBeGreaterThan(300);
  });

  it('chaque id du catalogue est rangé exactement comme le client le résout', () => {
    const correspondances: Record<string, string> = {};
    const sans: string[] = [];
    for (const m of catalogue) {
      const cle = normalizeMovement(m.name).key;
      if (isKnownMovementKey(cle)) correspondances[m.id] = cle;
      else sans.push(m.id);
    }
    expect(correspondances).toEqual(FICHIER.correspondances);
    expect(sans.sort()).toEqual([...FICHIER.sans_correspondance].sort());
  });

  it('la correspondance recouvre exactement les familles à badge du catalogue', () => {
    // Deux sources indépendantes : le dictionnaire du client et le `badge_key`
    // tenu à la main dans le catalogue. Elles doivent désigner les mêmes ids, et
    // pour chacun la même famille. Un désaccord veut dire qu'une variante
    // créditerait une autre famille que celle que le catalogue annonce.
    const avecBadge = catalogue.filter(m => m.badge_key);
    expect(avecBadge.map(m => m.id).sort()).toEqual(Object.keys(FICHIER.correspondances).sort());

    const desaccords = avecBadge.filter(m => {
      const cle = FICHIER.correspondances[m.id];
      const unite = (m.unit_default === 'm' || m.unit_default === 'cal' ? m.unit_default : 'reps') as MovementUnit;
      const prefixe = badgePrefixFor(cle, unite) ?? badgePrefixFor(cle, 'cal') ?? badgePrefixFor(cle, 'm');
      return prefixe !== m.badge_key;
    }).map(m => `${m.id} : catalogue ${m.badge_key}, client ${FICHIER.correspondances[m.id]}`);
    expect(desaccords).toEqual([]);
  });

  it('la migration insère exactement ces correspondances', () => {
    const sql = lire('supabase/migrations/20270102000000_credit_tournois_serveur.sql');
    const bloc = sql.slice(sql.indexOf('INSERT INTO public.movement_stats_keys'));
    const dansSql = Object.fromEntries(
      [...bloc.slice(0, bloc.indexOf('ON CONFLICT')).matchAll(/\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)]
        .map(([, id, cle]) => [id, cle]),
    );
    expect(dansSql).toEqual(FICHIER.correspondances);
  });

  it('le fichier est à jour vis-à-vis de son générateur', () => {
    execFileSync('node', ['scripts/generate-movement-stats-keys.mjs', '--check'], { cwd: RACINE });
  });
});

describe('cas partagés du crédit des tournois : cohérents avec la correspondance', () => {
  const CAS = JSON.parse(lire('supabase/seed/tournament_credit_cases.json')).cas as Array<{
    nom: string;
    wod: { movement_lines: Array<{ movement: string; unit: string }> };
    attendus: Array<{ movement: string; unit: string; quantite: number }>;
  }>;
  const connus = new Set([...Object.keys(FICHIER.correspondances), ...FICHIER.sans_correspondance]);
  const canoniques = new Set(Object.values(FICHIER.correspondances));

  it('chaque ligne nomme un id du catalogue, chaque crédit une clé canonique atteignable', () => {
    for (const c of CAS) {
      for (const l of c.wod.movement_lines) expect({ cas: c.nom, id: l.movement, connu: connus.has(l.movement) })
        .toEqual({ cas: c.nom, id: l.movement, connu: true });
      for (const a of c.attendus) expect({ cas: c.nom, cle: a.movement, canonique: canoniques.has(a.movement) })
        .toEqual({ cas: c.nom, cle: a.movement, canonique: true });
    }
  });

  it('les formats, le CAP, le split ♂/♀ et les cas sans crédit sont tous couverts', () => {
    const types = new Set(CAS.map(c => (c as any).wod.type));
    for (const t of ['For Time', 'AMRAP', 'EMOM', 'Tabata', 'Max Reps', 'Strength']) expect(types).toContain(t);
    expect(CAS.some(c => (c as any).score.capped)).toBe(true);
    expect(new Set(CAS.map(c => (c as any).genre))).toEqual(new Set(['male', 'female', null]));
    expect(CAS.filter(c => c.attendus.length === 0).length).toBeGreaterThanOrEqual(5);
  });
});

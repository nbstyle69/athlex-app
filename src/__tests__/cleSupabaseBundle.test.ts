/**
 * Garde-fous de livraison et transition des clés d'API Supabase.
 *
 * `scripts/lib/cle-supabase-bundle.mjs` est partagé par `ota-`, `ipa-` et
 * `aab-verify-bundle.mjs`. Pendant la transition, un bundle passe avec la
 * nouvelle clé publique (`sb_publishable_…`) comme avec l'ancien JWT `anon` ;
 * il échoue TOUJOURS s'il embarque une clé secrète, sous l'une ou l'autre forme.
 *
 * Les clés ci-dessous sont fabriquées ici, jamais réelles, et assemblées à
 * l'exécution pour qu'aucun motif de clé n'apparaisse en clair dans le dépôt.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LIB = path.join(ROOT, 'scripts', 'lib', 'cle-supabase-bundle.mjs');

type Check = { name: string; ok: boolean; detail: string };

/** Exécute la vraie fonction (module ESM) sur chaque bundle fabriqué. */
function verifier(bundles: string[]): Check[][] {
  const code = `
    import { verifierCleSupabase } from ${JSON.stringify('file:///' + LIB.replace(/\\/g, '/'))};
    let entree = '';
    process.stdin.on('data', (d) => { entree += d; });
    process.stdin.on('end', () => {
      process.stdout.write(JSON.stringify(JSON.parse(entree).map((b) => verifierCleSupabase(b))));
    });`;
  return JSON.parse(execFileSync('node', ['--input-type=module', '-e', code], {
    input: JSON.stringify(bundles), encoding: 'utf8',
  }));
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string, ref: string) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref, role })}.${'s'.repeat(43)}`;
const REF = 'abcdefghijklmnopqrst';
const URL = `https://${REF}.supabase.co`;
const PUBLISHABLE = ['sb', 'publishable', 'Fx7kQ2mPz9LwR4tYb8NcVd_1a2b3c4d'].join('_');
const SECRET = ['sb', 'secret', 'Hq3nW8pLx2KzT6vRy1MbCe_9f8e7d6c'].join('_');
const ANON = jwt('anon', REF);
const SERVICE = jwt('service_role', REF);
// Un bundle Hermes : des chaînes séparées par du bruit binaire.
const bundle = (...cles: string[]) => ['\u0000', URL, ...cles, 'get_my_profile', '\u0001'].join('\u0000');

const echecs = (checks: Check[]) => checks.filter((c) => !c.ok).map((c) => c.name);

describe('clé Supabase embarquée : transition anon → sb_publishable_', () => {
  const [
    publishableSeule, anonSeul, lesDeux, anonAutreProjet, aucune,
    publishablePlusSecret, anonPlusServiceApres, serviceSeul, secretSeul,
  ] = verifier([
    bundle(PUBLISHABLE),
    bundle(ANON),
    bundle(PUBLISHABLE, ANON),
    bundle(jwt('anon', 'zzzzzzzzzzzzzzzzzzzz')),
    bundle(),
    bundle(PUBLISHABLE, SECRET),
    bundle(ANON, 'autre chaîne', SERVICE),
    bundle(SERVICE),
    bundle(SECRET),
  ]);

  it('accepte la nouvelle clé publique seule', () => {
    expect(echecs(publishableSeule)).toEqual([]);
  });

  it("accepte l'ancien JWT anon seul, et contrôle son projet", () => {
    expect(echecs(anonSeul)).toEqual([]);
    expect(anonSeul.map((c) => c.name)).toContain('le JWT anon embarqué pointe le même projet que l’URL');
    expect(echecs(anonAutreProjet)).toEqual(['le JWT anon embarqué pointe le même projet que l’URL']);
  });

  it('accepte les deux ensemble (transition)', () => {
    expect(echecs(lesDeux)).toEqual([]);
  });

  it('refuse un bundle sans clé publique', () => {
    expect(echecs(aucune)).toEqual(['clé publique Supabase embarquée (sb_publishable_ ou JWT anon)']);
  });

  it('refuse toujours une clé secrète sb_secret_, même à côté de la clé publique', () => {
    expect(echecs(publishablePlusSecret)).toEqual(['aucune clé secrète sb_secret_ embarquée']);
    expect(echecs(secretSeul)).toEqual([
      'clé publique Supabase embarquée (sb_publishable_ ou JWT anon)',
      'aucune clé secrète sb_secret_ embarquée',
    ]);
  });

  it('refuse toujours un JWT service_role, même placé après le JWT anon', () => {
    expect(echecs(anonPlusServiceApres)).toEqual(['aucun JWT service_role embarqué']);
    expect(echecs(serviceSeul)).toEqual([
      'clé publique Supabase embarquée (sb_publishable_ ou JWT anon)',
      'aucun JWT service_role embarqué',
    ]);
  });

  it("n'écrit jamais une clé, même partiellement, dans ses messages", () => {
    const sortie = JSON.stringify([publishableSeule, anonSeul, publishablePlusSecret, anonPlusServiceApres]);
    for (const cle of [PUBLISHABLE, SECRET, ANON, SERVICE]) {
      expect(sortie).not.toContain(cle.slice(-12));
      expect(sortie).not.toContain(cle.slice(0, 24));
    }
  });
});

describe('les trois garde-fous de livraison passent par ce contrôle', () => {
  for (const s of ['scripts/ota-verify-bundle.mjs', 'scripts/ipa-verify-bundle.mjs', 'scripts/aab-verify-bundle.mjs']) {
    it(`${s} importe verifierCleSupabase et n'exige plus un JWT`, () => {
      const src = read(s);
      expect(src).toContain("import { verifierCleSupabase } from './lib/cle-supabase-bundle.mjs';");
      expect(src).toMatch(/verifierCleSupabase\((js|bundle)\)/);
      expect(src).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });
  }

  it('ota-verify-bundle.mjs échoue si un contrôle de clé échoue', () => {
    const ota = read('scripts/ota-verify-bundle.mjs');
    expect(ota).toContain('const hasKey = cle.every((c) => c.ok);');
    expect(ota).toContain('if (!hasUrl || !hasKey) failures.push(platform);');
  });
});

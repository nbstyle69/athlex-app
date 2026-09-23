/**
 * Fonctions edge et transition des clés d'API Supabase.
 *
 * La clé secrète ne se lit qu'à un endroit (`_shared/cle-secrete.ts` :
 * `SUPABASE_SECRET_KEYS.default`, sinon `SUPABASE_SERVICE_ROLE_KEY`), aucune
 * fonction ne l'envoie en `Authorization: Bearer`, et `verify_jwt = false` est
 * versionné pour chacune — la vérification de la plateforme refuserait les
 * nouvelles clés. Le comportement réel (les deux clés, les refus sans
 * authentification) se prouve sur la pile locale : `scripts/_cles_edge_proto.mjs`.
 */
import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..', '..');
const DOSSIER = path.join(RACINE, 'supabase', 'functions');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');
const FONCTIONS = fs.readdirSync(DOSSIER, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .sort();

describe('clé secrète des fonctions edge', () => {
  it('les huit fonctions sont bien lues (contre-exemple)', () => {
    expect(FONCTIONS).toEqual([
      'analyze-tournament-score', 'generate-box-week', 'parse-wod-pdf', 'send-box-notification',
      'send-push', 'session-followup-cron', 'tournament-notifications-cron', 'weekly-owner-digest',
    ]);
  });

  for (const fn of FONCTIONS) {
    it(`${fn} lit la clé par cleSecrete(), jamais SUPABASE_SERVICE_ROLE_KEY directement`, () => {
      const src = lire(`supabase/functions/${fn}/index.ts`);
      expect(src).toContain("import { cleSecrete } from '../_shared/cle-secrete.ts';");
      expect(src).toMatch(/cleSecrete\(\)/);
      expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it(`${fn} n'envoie aucune clé en Authorization: Bearer`, () => {
      const src = lire(`supabase/functions/${fn}/index.ts`);
      expect(src).not.toMatch(/Authorization:\s*`Bearer \$\{SERVICE_KEY\}`/);
    });
  }

  it('le helper prend SUPABASE_SECRET_KEYS.default, sinon SUPABASE_SERVICE_ROLE_KEY, sinon échoue', () => {
    const src = lire('supabase/functions/_shared/cle-secrete.ts');
    const nouvelle = src.indexOf("Deno.env.get('SUPABASE_SECRET_KEYS')");
    const ancienne = src.indexOf("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(nouvelle).toBeGreaterThan(-1);
    expect(ancienne).toBeGreaterThan(nouvelle);
    expect(src).toContain('JSON.parse(brut)?.default');
    expect(src).toMatch(/throw new Error\('Aucune clé secrète/);
    // Une seule lecture de chaque : le protocole local force les modes en la remplaçant.
    expect(src.split("Deno.env.get('SUPABASE_SECRET_KEYS')").length).toBe(2);
  });
});

describe('verify_jwt versionné', () => {
  const config = lire('supabase/config.toml');
  const sections = [...config.matchAll(/^\[functions\.([a-z0-9-]+)\]\nverify_jwt = (true|false)$/gm)]
    .map(([, nom, valeur]) => [nom, valeur]);

  it('une section par fonction, toutes à false, ni plus ni moins', () => {
    expect(sections.map(([nom]) => nom).sort()).toEqual(FONCTIONS);
    expect(sections.every(([, valeur]) => valeur === 'false')).toBe(true);
  });

  it('chaque fonction refuse elle-même un appel sans authentification', () => {
    // x-cron-secret comparé à CRON_SECRET, refus si l'un manque…
    for (const fn of ['generate-box-week', 'session-followup-cron', 'tournament-notifications-cron', 'weekly-owner-digest']) {
      expect(lire(`supabase/functions/${fn}/index.ts`))
        .toMatch(/if \(!cronSecret \|\| provided !== cronSecret\) return json\(\{ error: 'unauthorized' \}, 401\);/);
    }
    // … ou jeton d'utilisateur vérifié par auth.getUser, refus si absent ou invalide.
    for (const fn of ['analyze-tournament-score', 'parse-wod-pdf', 'send-box-notification', 'send-push']) {
      const src = lire(`supabase/functions/${fn}/index.ts`);
      expect(src).toMatch(/admin\.auth\.getUser\(jwt\)/);
      expect(src).toMatch(/if \(userErr \|\| !userData\?\.user\)/);
    }
    expect(lire('supabase/functions/send-push/index.ts'))
      .toContain('const isMachine = !!cronSecret && !!providedSecret && providedSecret === cronSecret;');
  });
});

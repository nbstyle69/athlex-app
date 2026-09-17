/**
 * Migration 20261223 — `box_wods.track` (brief §1.2 / §1.4).
 *
 * Le rétroactif écrit dans une table de production : ce qui est mesuré ici,
 * c'est que ses garde-fous sont là. Une ligne `manual` n'a pas de piste et ne
 * doit jamais en recevoir — le jour où quelqu'un retire `source = 'auto'` de la
 * clause `WHERE`, c'est ce test qui tombe, pas un athlète qui perd ses WODs de
 * coach dans un onglet.
 */
import fs from 'fs';
import path from 'path';

const racine = path.join(__dirname, '../..');
const sql = fs.readFileSync(
  path.join(racine, 'supabase/migrations/20261223000000_box_wods_track.sql'), 'utf8',
);

/** Corps du seul `UPDATE` de la migration, jusqu'au point-virgule. */
const majPiste = sql.slice(sql.indexOf('UPDATE public.box_wods'));

describe('colonne box_wods.track', () => {
  it('est nullable : une carte de coach n\'a pas de piste', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS track text NULL/);
    expect(sql).not.toMatch(/track text NOT NULL/);
  });

  it('le CHECK admet les trois pistes et NULL', () => {
    expect(sql).toMatch(/CHECK \(track IS NULL OR track IN \('functional','hybrid','musculation'\)\)/);
  });

  it('porte un commentaire SQL qui dit ce que vaut NULL', () => {
    expect(sql).toMatch(/COMMENT ON COLUMN public\.box_wods\.track IS/);
    expect(sql).toMatch(/COMMENT ON COLUMN public\.box_wods\.track IS[\s\S]*?NULL/);
  });

  it('l\'index est sur (box_id, scheduled_date, track) et partiel', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_box_wods_track\s*\n?\s*ON public\.box_wods \(box_id, scheduled_date, track\) WHERE track IS NOT NULL/,
    );
  });

  it('est rejouable : rien qui casse au second passage', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS box_wods_track_check');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
  });
});

describe('rétroactif — les cartes déjà posées reçoivent leur piste', () => {
  it('la piste vient de la run, par auto_run_id', () => {
    expect(majPiste).toMatch(/SET track = r\.track/);
    expect(majPiste).toMatch(/FROM public\.box_auto_programming_runs AS r/);
    expect(majPiste).toMatch(/w\.auto_run_id = r\.id/);
  });

  it('aucune ligne manual n\'est touchée', () => {
    expect(majPiste).toMatch(/AND w\.source = 'auto'/);
  });

  it('les lignes déjà renseignées sont laissées telles quelles', () => {
    expect(majPiste).toMatch(/AND w\.track IS NULL/);
  });

  it('c\'est le seul UPDATE de la migration, et il ne touche que track', () => {
    expect(sql.match(/UPDATE /g)).toHaveLength(1);
    expect(majPiste.match(/SET /g)).toHaveLength(1);
  });
});

describe('repli de generate-box-week quand la colonne manque', () => {
  const fonction = fs.readFileSync(
    path.join(racine, 'supabase/functions/generate-box-week/index.ts'), 'utf8',
  );
  const insertion = fonction.slice(
    fonction.indexOf('async insertRows'), fonction.indexOf('async ensureGroup'),
  );

  it('la fonction écrit track sur chaque ligne posée', () => {
    const moteur = fs.readFileSync(path.join(racine, 'packages/wod-engine/src/programming.ts'), 'utf8');
    expect(moteur).toMatch(/track: week\.track,/);
    expect(moteur).toMatch(/track: 'musculation',/);
  });

  it('une insertion refusée en 42703 / PGRST204 est rejouée sans track', () => {
    expect(insertion).toMatch(/error\.code === '42703' \|\| error\.code === 'PGRST204'/);
    expect(insertion).toMatch(/track: _track, \.\.\.rest/);
  });

  it('… et seulement dans ce cas : toute autre erreur fait tomber la run', () => {
    expect(insertion).toMatch(/fail\('box_wods\.insert', error\)/);
  });
});

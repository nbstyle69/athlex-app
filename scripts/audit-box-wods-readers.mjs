#!/usr/bin/env node
/**
 * Inventaire des objets SQL (fonctions/RPC, vues, triggers, policies) qui
 * lisent `box_wods`, à partir de `supabase/migrations/` (baseline prod +
 * migrations, ordre lexicographique ; la DERNIÈRE définition d'un objet
 * l'emporte). Pour chacun : mentionne-t-il `scheduled_date` ? est-il filtré
 * par un id de WOD (donc neutre vis-à-vis de l'ancrage) ?
 *
 *   node scripts/audit-box-wods-readers.mjs            # tableau markdown
 *   node scripts/audit-box-wods-readers.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('supabase/migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const objets = new Map(); // key: kind:name -> { kind, name, file, body }

const reFn = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+("?[\w.]+"?(?:\."?\w+"?)?)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s+(\$[\w]*\$)([\s\S]*?)\3/gi;
const reView = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+("?[\w.]+"?(?:\."?\w+"?)?)[\s\S]*?\sAS\s+([\s\S]*?);/gi;
const reTrig = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+("?\w+"?)\s+([\s\S]*?)\s+ON\s+("?[\w.]+"?(?:\."?\w+"?)?)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+("?[\w.]+"?(?:\."?\w+"?)?)\s*\(/gi;
const rePol = /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+("?[\w.]+"?(?:\."?\w+"?)?)([\s\S]*?);/gi;
const reDropFn = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?(?:\."?\w+"?)?)/gi;
const reDropView = /DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?(?:\."?\w+"?)?)/gi;

const norm = n => n.replace(/"/g, '').replace(/^public\./, '');

for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  let m;
  for (const [re, kind] of [[reDropFn, 'function'], [reDropView, 'view']]) {
    while ((m = re.exec(sql))) objets.delete(`${kind}:${norm(m[1])}`);
  }
  while ((m = reFn.exec(sql))) {
    objets.set(`function:${norm(m[1])}`, { kind: 'function', name: norm(m[1]), file: f, body: m[4], args: m[2].replace(/\s+/g, ' ').trim() });
  }
  while ((m = reView.exec(sql))) {
    objets.set(`view:${norm(m[1])}`, { kind: 'view', name: norm(m[1]), file: f, body: m[2] });
  }
  while ((m = reTrig.exec(sql))) {
    objets.set(`trigger:${norm(m[1])}@${norm(m[3])}`, { kind: 'trigger', name: `${norm(m[1])} ON ${norm(m[3])}`, file: f, body: `${m[2]} -> ${norm(m[4])}()`, fn: norm(m[4]) });
  }
  while ((m = rePol.exec(sql))) {
    objets.set(`policy:${norm(m[1])}@${norm(m[2])}`, { kind: 'policy', name: `${norm(m[1])} ON ${norm(m[2])}`, file: f, body: m[3] });
  }
}

const lit = o => /\bbox_wods\b/i.test(o.body) || (o.kind === 'trigger' && (o.name.endsWith(' ON box_wods') || /\bbox_wods\b/.test(objets.get(`function:${o.fn}`)?.body ?? '')));
const lecteurs = [...objets.values()].filter(lit).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

const rows = lecteurs.map(o => {
  const body = o.kind === 'trigger' ? (objets.get(`function:${o.fn}`)?.body ?? '') : o.body;
  const dateFilter = /scheduled_date/i.test(body);
  const byId = /\bbox_wods\b[^;]*?\b(?:id|wod_id)\s*=\s*(?:new\.|old\.|p_|v_|_)?\w*(?:wod_id|id)\b/i.test(body.replace(/\s+/g, ' ')) || /where\s+(?:w\.|bw\.)?id\s*=\s*(?:p_|v_)?wod_id/i.test(body);
  const programCols = /program_week|program_day/i.test(body);
  return { kind: o.kind, name: o.name, file: o.file, dateFilter, byId, programCols };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| Objet | Type | Défini dans | Filtre `scheduled_date` | Accès par id de WOD |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) console.log(`| \`${r.name}\` | ${r.kind} | \`${r.file}\` | ${r.dateFilter ? 'oui' : '—'} | ${r.byId ? 'oui' : '—'} |`);
  console.log(`\n${rows.length} objet(s) lisant box_wods.`);
}

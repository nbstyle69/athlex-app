// Scanner des chaînes françaises affichées hors t() (inventaire i18n, chantier
// anglais). Analyse l'AST TypeScript : texte JSX, littéraux et gabarits qui
// contiennent un accent ou un mot français courant, sauf ceux passés à t() /
// i18n.t(), les imports, les comparaisons, les clés d'objet, les arguments
// Supabase et de navigation, console.* et les props techniques (testID…).
// Une ligne peut être exemptée par un commentaire `i18n-ignore` (message
// technique jamais montré, texte attendu de la base…).
//
// Usage : node scripts/i18n/scanner.js [fichier ou dossier…]  (défaut : src)
// Module : scanSource(nom, texte) → [{ line, text, type, ctx }]
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ACC = /[àâäçéèêëîïôöùûüÿœæÀÂÇÉÈÊËÎÏÔÖÙÛÜŒ«»]/;
const WORDS = /\b(de|du|des|le|la|les|une?|et|ou|pour|avec|sans|sur|dans|par|ton|ta|tes|votre|vos|ce|cette|ces|aucune?|pas|tous|toutes?|est|sont|ne|nous|vous|qui|que|au|aux|mon|ma|mes|son|sa|ses|leurs?|jours?|semaines?|mois|ans?|annuler|valider|enregistrer|supprimer|modifier|ajouter|fermer|retour|suivant|terminer|confirmer|oui|non|erreur|chargement|rechercher|membres?|s[ée]ances?|musculation|cr[ée]er|choisir|voir|nouveau|nouvelle|envoyer|partager|quitter|rejoindre|inscrire|inscrits?|places?|libres?|complet|aujourd|demain|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|minutes?|secondes?|heures?|tours?|repos|charge|niveau|objectif|mat[ée]riel|halt[eè]res?|barre|corde|rameur|v[ée]lo|course|abdos|jambes|dos|bras|[ée]paules|pectoraux|fessiers|d[ée]butant|interm[ée]diaire|avanc[ée]|tranquille|intense|mod[ée]r[ée]|r[ée]servation|r[ée]server|abonnement|offre|paiement|gratuit|essai|compte|profil|accueil|entra[iî]nement|comp[ée]tition|classement|d[ée]fis?|r[ée]sultats?|chrono|minuteur|terminé|bienvenue|merci|bravo|r[ée]essayer|connexion|d[ée]connexion|mot|passe|courriel|adresse|t[ée]l[ée]phone|nom|pr[ée]nom|ville|salle|g[ée]rant|athl[eè]tes?|cours|cr[ée]neaux?|horaires?|actualit[ée]s?|annonces?|r[ée]glages?|param[eè]tres?|aide|nouveaut[ée]s|historique|statistiques?|progression|semaine|ajout[ée]|supprim[ée]|enregistr[ée]|lun|mar|mer|jeu|ven|sam|dim|individuel|termin[ée]|ouvert|brouillon|temps|poids|douches|casiers|boutique|garderie|autres?|logiciel|gymnastique|boxe|hypertrophie|puissance|vitesse|suisse|ligue|poules|confirm[ée]|bronze|argent|platine|diamant)\b/i;

function isFrench(s) {
  const t = s.trim();
  if (!t || t.length < 2) return false;
  if (/^[a-z0-9_.\-/:]+$/.test(t)) return ACC.test(t); // identifiants, chemins
  if (/^[a-z]+(\.[A-Za-z_]+)+$/.test(t)) return false; // clé i18n
  if (/^(https?:|#|rgba?\(|\d)/.test(t) && !ACC.test(t)) return false;
  return ACC.test(t) || WORDS.test(t);
}

const SKIP_ATTR = new Set(['testID', 'name', 'key', 'style', 'nativeID', 'icon', 'color', 'source', 'id', 'route', 'variant', 'size', 'type', 'mode', 'href', 'uri', 'keyboardType', 'autoComplete', 'textContentType', 'autoCapitalize', 'returnKeyType', 'pointerEvents', 'resizeMode', 'iconName']);
const SKIP_CALLEE = /^(track\w*|console\.\w+|require|captureError|Sentry\.\w+|.*\.(from|eq|neq|select|rpc|order|in|is|match|ilike|like|not|or|filter|channel|on|invoke|upload|getPublicUrl|getItem|setItem|removeItem|navigate|push|replace|reset|addListener|emit|getParam|contains|gte|lte|gt|lt|single|maybeSingle|track|log|warn|error|info|debug))$/;
const T_CALL = /^(t|i18n\.t|i18next\.t)$/;
const LABEL_CONST = /LABEL|TEXT|NAME|TAB|META|ZONE|STEP|REASON|TYPE|DAY|MONTH|CATEGOR|TIER|OPTION/i;

function scanSource(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = source.split('\n');
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const callee = n => { try { return n.expression.getText(sf); } catch { return ''; } };
  const found = [];

  function context(n) {
    let kind = null, p = n.parent, child = n;
    while (p) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || (ts.isTypeNode(p) && !ts.isTypeLiteralNode(p))) return { skip: true };
      if (ts.isCaseClause(p) && p.expression === child) return { skip: true };
      if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText(sf))) return { skip: true };
      if (ts.isPropertyAssignment(p) && p.name === child) return { skip: true };
      if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return { skip: true };
      if (ts.isJsxAttribute(p)) {
        const nm = p.name.getText(sf);
        return SKIP_ATTR.has(nm) ? { skip: true } : { type: 'texte', ctx: `prop ${nm}=` };
      }
      if (ts.isCallExpression(p)) {
        const c = callee(p);
        if (T_CALL.test(c)) return { skip: true };
        if (c === 'Alert.alert' || c === 'Alert.prompt') return { type: 'alerte', ctx: c };
        if (SKIP_CALLEE.test(c)) return { skip: true };
      }
      if (ts.isNewExpression(p) && /Error/.test(p.expression.getText(sf))) return { type: 'texte', ctx: 'new Error' };
      if (ts.isJsxExpression(p) && !kind) kind = { type: 'texte', ctx: 'JSX {…}' };
      if (ts.isVariableDeclaration(p) && !kind) {
        const st = p.parent && p.parent.parent;
        if (st && ts.isVariableStatement(st) && ts.isSourceFile(st.parent)) kind = { type: 'constante', ctx: `const ${p.name.getText(sf)}` };
      }
      if ((ts.isObjectLiteralExpression(p) || ts.isArrayLiteralExpression(p)) && !kind) {
        let q = p; while (q && !ts.isSourceFile(q) && !ts.isFunctionLike(q)) q = q.parent;
        if (q && ts.isSourceFile(q)) {
          let v = p; while (v && !ts.isVariableDeclaration(v)) v = v.parent;
          kind = { type: 'constante', ctx: v ? `const ${v.name.getText(sf)}` : 'objet module' };
        }
      }
      child = p; p = p.parent;
    }
    return kind || { type: 'texte', ctx: 'expression' };
  }

  function visit(n) {
    let text = null, isTpl = false;
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, ' ').trim();
      if (t && isFrench(t)) found.push({ line: line(n), text: t, type: 'texte', ctx: '<Text>' });
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateExpression(n)) { text = n.getText(sf).slice(1, -1); isTpl = true; }
    if (text !== null) {
      const plain = isTpl ? text.replace(/\$\{[^}]*\}/g, ' ') : text;
      const isSelect = /(select|\w+:\w+\()/.test(plain) && /,/.test(plain) && /\(/.test(plain);
      let c = null;
      // libellé sans mot français dans une constante de libellés (ex. 'LUN') : relevé « faible »
      const weak = !isFrench(plain) && /^[A-ZÀ-Ý][A-Za-zÀ-ÿ' .\-/]{1,40}$/.test(plain.trim())
        && (c = context(n)).type === 'constante' && LABEL_CONST.test(c.ctx || '');
      if (!isSelect && (weak || isFrench(plain))) {
        c = c || context(n);
        if (!c.skip) found.push({ weak, line: line(n), text: text.replace(/\s+/g, ' ').slice(0, 160), type: isTpl && c.type !== 'alerte' ? 'gabarit' : c.type, ctx: c.ctx });
      }
    }
    if (ts.isTemplateExpression(n)) { n.templateSpans.forEach(s => visit(s.expression)); return; }
    ts.forEachChild(n, visit);
  }
  visit(sf);

  // un libellé « faible » ne compte que si sa constante contient du français
  const strong = new Set(found.filter(f => !f.weak).map(f => f.ctx));
  return found
    .filter(f => !f.weak || strong.has(f.ctx))
    .filter(f => !/i18n-ignore/.test(lines[f.line - 1] || '') && !/i18n-ignore/.test(lines[f.line - 2] || ''))
    .map(({ weak, ...f }) => f);
}

function scanFile(file) {
  return scanSource(file, fs.readFileSync(file, 'utf8'));
}

function listFiles(target) {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap(e => {
    const p = path.join(target, e.name);
    if (e.isDirectory()) return /^(__tests__|__mocks__|node_modules|dev)$/.test(e.name) ? [] : listFiles(p);
    // analytics.ts : noms d'événements, jamais affichés
    return /\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name) && e.name !== 'analytics.ts' ? [p] : [];
  });
}

module.exports = { scanSource, scanFile, isFrench };

if (require.main === module) {
  const targets = process.argv.slice(2);
  let total = 0;
  for (const f of (targets.length ? targets : ['src']).flatMap(listFiles)) {
    for (const r of scanFile(f)) {
      total++;
      console.log(`${f.replace(/\\/g, '/')}:${r.line}\t${r.type}\t${r.text}`);
    }
  }
  console.log(`${total} chaîne(s) française(s) hors t()`);
}

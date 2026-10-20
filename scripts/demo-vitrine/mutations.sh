#!/usr/bin/env bash
# Preuve des tests de la box vitrine : chaque mutation de logique.ts doit faire
# échouer `npx jest scripts/demo-vitrine`. Le fichier d'origine est rétabli à la fin.
#   bash scripts/demo-vitrine/mutations.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
F=scripts/demo-vitrine/logique.ts
SAUVE=$(mktemp)
cp "$F" "$SAUVE"
trap 'cp "$SAUVE" "$F"; rm -f "$SAUVE"' EXIT
survivantes=0

muter() { # <libellé> <expression perl>
  cp "$SAUVE" "$F"
  perl -0pi -e "$2" "$F"
  if cmp -s "$SAUVE" "$F"; then echo "INTROUVABLE $1"; survivantes=1; return; fi
  if npx jest scripts/demo-vitrine --silent >/dev/null 2>&1; then echo "SURVIVANTE  $1"; survivantes=1
  else echo "tuée        $1"; fi
}

muter "pseudo en double"                    "s/\['HugoRx', 'Hugo'\]/['Lola_Burpee', 'Hugo']/"
muter "pseudos : ordre femmes/hommes"       "s/genre: i < 25 \? 'female' : 'male'/genre: i < 26 ? 'female' : 'male'/"
muter "repli caractère absent"              "s/const nettoye = \[\.\.\.voulu\]\.filter\(c => regle\.caracteres\.test\(c\)\)\.join\(''\)/const nettoye = voulu/"
muter "repli chiffre absent"                "s/if \(!pris\.has\(nettoye\.toLowerCase\(\)\)\) return/if (true) return/"
muter "chiffre déjà pris accepté"           "s/if \(!pris\.has\(essai\.toLowerCase\(\)\)\) return/return/"
muter "For Time : plus de DNF"              "s/if \(perf < 0\.12\)/if (perf < 0)/"
muter "For Time : au-delà du cap"           "s/capS \* \(0\.95 - 0\.4 \* perf\)/capS * (1.2 - 0.4 * perf)/"
muter "AMRAP : au-delà de 1,5 rep par s""s/min \* \(6 \+ 12 \* perf\)/min * (6 + 120 * perf)/"
muter "EMOM : plus de rounds que de minutes" "s/min - Math\.floor\(\(1 - perf\) \* 3\)/min + 1/"
muter "Tabata : au-delà de 280"             "s/60 \+ 140 \* perf/60 + 400 * perf/"
muter "scaled en RX"                        "s/if \(m\.niveau === 'scaled'\) return false;/if (m.niveau === 'scaled') return true;/"
muter "custom sans classement scoré"        "s/if \(!w\.leaderboard_enabled\) return null;//"
muter "série sans charge exigée"            "s/load_required: !!\(pct \|\| kg\)/load_required: true/"
muter "1RM au-dessus de l'estimation"       "s/const kgRec = Math\.floor\(est \* 2\) \/ 2;/const kgRec = Math.floor(est * 2) \/ 2 + 0.5;/"
muter "séries en double"                    "s/const i = \(index\.get\(movement\) \?\? 0\) \+ 1;/const i = 1;/"
muter "plafond de 3 tournois levé"          "s/\(compte\.get\(m\.nn\) \?\? 0\) < 3/true/; s/\(compte\.get\(a\.nn\)! - compte\.get\(b\.nn\)!\)/0/"
muter "effectif T5 faux"                    "s/places: 32, inscrits: 12/places: 32, inscrits: 13/"
muter "T6 complet"                          "s/places: 16, inscrits: 8/places: 16, inscrits: 16/"
muter "genres non alternés"                 "s/choisis\.length % 2 === 0 \? f\.shift\(\) \?\? h\.shift\(\)/true ? f.shift() ?? h.shift()/"
muter "quota sans les 3 places libres"      "s/Math\.min\(Math\.floor\(capacite \* 0\.6\), capacite - 3\)/Math.floor(capacite * 0.6)/"
muter "quota sans les 60 %"                 "s/Math\.min\(Math\.floor\(capacite \* 0\.6\), capacite - 3\)/capacite - 3/"
muter "deux créneaux le même jour"          "s/\.filter\(m => !dejaCeJour\.has\(m\.nn\)\)//"
muter "purge sans la box"                   "s/if \(c\.box_id !== box\) continue;//"
muter "purge sans la formule"               "s/ && c\.formule === FORMULE_DEMO//"
muter "purge : motif élargi"                "s/\(0\[1-9\]\|\[1-4\]\[0-9\]\|50\)/[0-9]+/"
muter "purge : reviewer non exclu"          "s/if \(c\.id !== opts\.reviewerId\) ids\.add\(c\.id\);/ids.add(c.id);/"
muter "purge : legacy par défaut"           "s/else if \(opts\.legacy && box === BOX_ATHLEX && c\.demo_account\)/else if (c.demo_account \&\& opts.reviewerId !== c.id)/"
muter "tournois hors box purgés"            "s/voulus\.has\(t\.id\) && t\.box_id === box/voulus.has(t.id)/"

[ $survivantes -eq 0 ] && echo "TOUTES LES MUTATIONS TUÉES" || { echo "DES MUTATIONS SURVIVENT"; exit 1; }

/**
 * Textes français du moteur (étude i18n « Moteur », PR M1).
 *
 * Tout texte que le moteur affiche ou enregistre vient d'ici : rendu des WODs
 * (`render.ts`), cibles d'estimation (`estimate.ts`), Musculation (`muscu.ts`),
 * séances de box (`session.ts`), programmation (`programming.ts`), messages de
 * `generate.ts`, et textes de la banque de squelettes (`bank/**`), rangés par id.
 *
 * Le texte enregistré (`box_wods`, `generated_wods`, sortie de `generate-box-week`)
 * est produit avec CE dictionnaire, octet pour octet comme avant son extraction :
 * l'instantané `__tests__/instantane-fr.test.ts` le vérifie. Les analyseurs de
 * l'app, du Manager et de la base relisent ce texte : en-têtes metcon en anglais
 * (`5 rounds for time`), lignes de force en français (`— repos`, `/ jambe`).
 *
 * Restent hors d'ici, parce que ce sont des clés et non du texte affiché :
 * libellés des plafonds (`bank/index.ts`), `TRACK_SEED_KEY`, raisons de refus
 * d'un tirage, étiquettes de relâchement, rôles de slot, et les noms du
 * catalogue (comparés par `nameKey`). Aucune dépendance : le module part tel
 * quel dans le bundle de la fonction edge.
 */

const prime = (m: number | string) => `${m}'`;

export const fr = {
  /** Catégories de scaling (termes techniques, identiques dans toutes les langues). */
  categories: {
    scaled: 'Scaled', inter: 'Inter', rx: 'RX', rxplus: 'RX+', elite: 'Elite', pro: 'Pro',
    women: 'Women', men: 'Men', women_pro: 'Women Pro', men_pro: 'Men Pro',
  },

  /** Durées : `12'` (minutes), `1'30` (minutes et secondes, séances). */
  duree: {
    minutes: prime,
    minutesSecondes: (m: number, ss: string) => `${m}'${ss}`,
  },

  /** WOD metcon (`render.ts`). */
  rendu: {
    cap: (t: string) => ` (cap ${t})`,
    amrap: (min: number) => `AMRAP ${min}`,
    forTime: (cap: string) => `For time${cap}`,
    forTimeSchema: (schema: string, cap: string) => `For time · ${schema}${cap}`,
    roundsForTime: (rounds: number, cap: string) => `${rounds} rounds for time${cap}`,
    chipper: (cap: string) => `Chipper · for time${cap}`,
    ladderOuverte: (a: number, b: number, c: number, min: number) => `Ladder ${a}-${b}-${c}… · AMRAP ${min}`,
    ladderOuverteConsigne: (pas: number) => `Monter les paliers (+${pas} à chaque palier) jusqu'au temps, score = reps totales`,
    ladderFinie: (schema: string, cap: string) => `Ladder ${schema} · for time${cap}`,
    ladderFinieConsigne: 'Effectuer une fois tous les paliers indiqués',
    emom: (min: number, every: string, stations: number) => `EMOM ${min}${every} · ${stations} stations en alternance`,
    emomEvery: (t: string) => ` · every ${t}`,
    deathBy: (min: number) => `EMOM ${min} · Death by : +1 rep par minute jusqu'à l'échec`,
    tabata: (transition: string) => `Tabata × 2 blocs · 8 × 20 s / 10 s${transition}`,
    tabataTransition: (s: number) => `, transition ${s} s`,
    intervalEvery: (rounds: number, t: string) => `${rounds} rounds · every ${t}`,
    intervalRepos: (rounds: number, t: string) => `${rounds} rounds · repos ${t} entre les répétitions`,
    stations: (rounds: number, n: number, work: number, rest: number) => `${rounds} rounds × ${n} stations · ${work} s on / ${rest} s off`,
    continu: (min: number) => `En continu ${prime(min)} · rotation sans repos, score = distance totale`,

    ligneTabata: (i: number, nom: string, tenue: boolean) => `Tabata ${i} · ${nom} (${tenue ? 'tenue 20 s' : 'max reps'})`,
    ligneStationTenue: (i: number, nom: string) => `Station ${i} · ${nom} (tenue)`,
    ligneStation: (i: number, nom: string, unite: string, cible: string) => `Station ${i} · ${nom} (max ${unite}, cible ${cible})`,
    ligneRound: (round: number, ligne: string) => `R${round} · ${ligne}`,
    lignePalier: (ligne: string) => `${ligne} (entre chaque palier)`,
    ligneParMinute: (nom: string) => `${nom} · min 1 : 1 rep, +1 rep par minute`,
    ligneAvantSerie: (ligne: string) => `${ligne} (avant chaque série)`,
    ligneMinute: (i: number, ligne: string) => `Min ${i} · ${ligne}`,

    /** `Scaled/Inter : Pull-ups` (substitutions et variantes par catégorie) */
    substitution: (categories: string, nom: string) => `${categories} : ${nom}`,
    gilet: (h: number, f: number) => `Gilet lesté ${h}/${f} kg`,
    giletOptionnel: (h: number, f: number) => `Gilet lesté optionnel ${h}/${f} kg`,
    stimulus: (rpe: string, note: string, cible: string) => `Stimulus : RPE ${rpe} — ${note}${cible}`,
    stimulusCible: (cat: string, cible: string, cap: string) => ` Cible ${cat} : ${cible}${cap}.`,
    stimulusCap: (t: string) => `, cap ${t}`,
    notes: (note: string, score: string) => `${note} Score : ${score}.`,
    titreEmom: (min: number) => `EMOM ${min}`,

    titre: {
      for_time: 'For time', rounds_for_time: (rounds: number | null) => `${rounds} rounds`, chipper: 'Chipper', ladder: 'Ladder',
      death_by: 'Death by', tabata: 'Tabata', interval: 'Intervalles', stations: 'Stations', continuous: 'Continu',
    },
  },

  /** Cibles de score par catégorie (`estimate.ts`), enregistrées dans `wod_json.estimate`. */
  estimation: {
    rounds: (n: number) => `≈ ${n} rounds`,
    temps: (t: string) => `≈ ${t}`,
    palierPartiel: (palier: number, pct: number, suivant: number) => `palier ${palier} + ${pct} % du palier ${suivant}`,
    palier: (palier: number) => `palier ${palier}`,
    premierPalier: 'palier 1 partiel',
    minuteComplete: (min: number) => `minute ${min} complétée`,
    minute: (min: number) => `minute ${min}`,
    emom: (cycles: number, min: number, max: number, every: number) => `${cycles} passages, travail ${min}-${max} s / ${every} s`,
    tabata: 'reps min sur 8 × 20 s par bloc',
    stations: (rounds: number, n: number, work: number, rest: number) => `${rounds} tours × ${n} stations, ${work} s on / ${rest} s off`,
    distance: (m: number) => `≈ ${m} m`,
    parIntervalle: (t: string) => `travail ≈ ${t} par intervalle`,
    parRepetition: (t: string) => `≈ ${t} par répétition`,
  },

  /** Messages de `generate.ts` (`NoValidWod`). */
  generation: {
    aucunSquelette: 'Aucun squelette compatible',
    aucunWod: (tirages: number) => `Aucun WOD valide après ${tirages} tirages`,
  },

  /** Musculation (`muscu.ts`). */
  musculation: {
    cible: {
      fessiers: 'Fessiers', fessiers_ischios: 'Fessiers & ischios', bas: 'Bas du corps', full_body: 'Full body', tronc: 'Tronc',
      haut: 'Haut du corps', dos: 'Dos', epaules: 'Épaules', bras: 'Bras', pecs: 'Pectoraux', push: 'Push', pull: 'Pull', jambes: 'Jambes',
    },
    objectif: { hypertrophie: 'Prise de muscle', force: 'Force', endurance: 'Tonification' },
    materiel: { none: 'Sans matériel', box: 'Box', gym: 'Salle' },
    niveau: { debutant: 'Débutant', inter: 'Intermédiaire', avance: 'Avancé' },
    rir: {
      hypertrophie: 'dernière série à 1-2 reps de l\'échec',
      force: 'RIR 2, dernière série RPE 9',
      endurance: 'rythme continu, aucune série à l\'échec',
    },
    /** côté d'un exercice unilatéral, relu par `parseStrengthLine` (`/ jambe`) */
    cote: { jambe: 'jambe', bras: 'bras', cote: 'côté' },
    note: {
      schemaHypertrophie: 'schéma hypertrophie',
      chargePropre: 'monter jusqu\'à une charge propre',
      troisiemeCompound: '3e compound : 70-75 % × 6-8',
      debutantBanded: 'Débutant : banded',
      tempo: (t: string) => `tempo ${t}`,
    },
    refus: {
      forceApresClasse: 'Après ma classe : la Force n\'est pas proposée (hypertrophie ou endurance)',
      forceSansMateriel: 'Sans matériel : la Force est indisponible',
      forceTronc: 'Tronc : la Force n\'est pas proposée (Prise de muscle ou Tonification)',
      cibleIndisponible: (cible: string, materiel: string) => `${cible} : aucun exercice ${materiel} pour ce niveau`,
    },
    monteeEnCharge: (nom: string) => `Montée en charge sur ${nom} : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail`,
    renseigne1rm: 'Renseigne tes 1RM dans le calculateur pour avoir des charges en kg',
    charge: {
      kgPourcent: (kg: number | undefined, pct: number | undefined) => `${kg} kg (${pct} %)`,
      pourcent1rm: (pct: number | undefined) => `${pct} % 1RM`,
      leste: (kg: number, rpe: number | undefined) => `lesté ${kg} kg, RPE ${rpe}`,
      lesteLeger: (rpe: number | undefined) => `lesté léger, RPE ${rpe}`,
      elastique: 'élastique',
      poidsDuCorps: 'poids du corps',
      rpePourcent: (rpe: number | undefined, pct: number) => `RPE ${rpe} (≈ ${pct} % du 1RM)`,
      rpe: (rpe: number | undefined) => `RPE ${rpe}`,
    },
    /** segments de la ligne d'exercice, relus par `parseStrengthLine` */
    ligne: {
      kg: (kg: number, pct: number | undefined) => ` @ ${kg} kg — charge ${pct} % 1RM`,
      pourcent: (rpe: number | undefined, pct: number | undefined) => ` — RPE ${rpe} (≈ ${pct} % du 1RM)`,
      leste: (kg: number, rpe: number | undefined) => ` — lesté ${kg} kg (10 % du poids de corps), RPE ${rpe}`,
      lesteLeger: (rpe: number | undefined) => ` — lesté léger, RPE ${rpe}`,
      rpePourcent: (rpe: number | undefined, pct: number) => ` — charge RPE ${rpe} (≈ ${pct} % du 1RM)`,
      rpe: (rpe: number | undefined) => ` — charge RPE ${rpe}`,
      elastique: ' — charge élastique',
      poidsDuCorps: ' — charge poids du corps',
      repos: (t: string) => ` — repos ${t}`,
    },
    titre: (cible: string, objectif: string) => `${cible} · ${objectif}`,
    entete: (cible: string, objectif: string, min: number, materiel: string) => `Musculation · ${cible} · ${objectif} · ${prime(min)} · ${materiel}`,
    dureeEstimee: (min: number) => `Durée estimée ${prime(min)}`,
    stimulus: (note: string) => `Stimulus : ${note}`,
    musclesEvites: (muscles: string) => `Après ma classe : muscles évités ${muscles}`,
  },

  /** Séances de box Functional / Hybrid (`session.ts`). */
  seance: {
    /** segments de `stepLine`, relus par `parseStrengthLine` */
    serie: {
      pourcent: (pct: number) => ` @ ${pct} %1RM`,
      repos: (t: string) => ` — repos ${t}`,
      tempo: (t: string) => ` — tempo ${t}`,
      charge: (note: string) => ` — charge ${note}`,
    },
    halteroComplexe: (nom: string, variante: string, complexe: string) => `Haltéro — complexe ${nom} (${variante}) : ${complexe}`,
    halteroConsigne: 'Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu\'à une charge propre.',
    force: (nom: string) => `Force — ${nom}`,
    forceTempo: (t: string) => `Tempo ${t} sur les séries de travail. Sans 1RM connu : dernière série RPE 8.`,
    skill: (nom: string) => `Skill — ${nom} : progression en 3 étapes`,
    etapeA: (texte: string, duree: string) => `Étape A : ${texte} — ${duree}`,
    etapeB: (texte: string, duree: string) => `Étape B : ${texte} — ${duree}`,
    etapeC: (every: string, rounds: number) => `Étape C : Every ${every} × ${rounds}`,
    building: (nom: string, tempo: string) => `Building — ${nom} tempo ${tempo}`,
    finisher: (rounds: number) => `Finisher — ${rounds} rounds, rythme continu :`,
    stationBox: (h: number, f: number) => `(box ${h}/${f} cm)`,
    pro: (lignes: string) => `Women Pro / Men Pro : ${lignes}`,
    stationEvery: (every: string, rounds: number) => `Every ${every} × ${rounds} :`,
    stationRotation: (every: string, rounds: number) => `Every ${every} × ${rounds}, en rotation :`,
    impair: 'Impair · ',
    pair: 'Pair · ',
    poste: (i: number) => `Poste ${i} · `,
    chargeLourde: 'Seule charge lourde de la semaine. Poussée continue, jamais en saccades.',
    intervallesCourse: (label: string, repos: string) => `Intervalles course — ${label}, repos ${repos}`,
    allureCible: (cible: string) => `Allure cible : ${cible}. L'écart entre le premier et le dernier intervalle reste sous 5 s.`,
    autresVariantes: (labels: string) => `Autres variantes du cycle : ${labels}`,
    compromiseRounds: (rounds: number) => `${rounds} rounds :`,
    compromiseStation: (i: number, work: number, ligne: string) => `${i}. ${work} s de station — ${ligne}`,
    compromiseCourse: (m: number, cible: string) => `   puis ${m} m Run à allure cible (${cible})`,
    compromiseTotal: (m: number) => `Total de course : ${m} m. Tenir l'allure avec les jambes chargées, ne pas sprinter la station.`,
    enchainement: (tours: number) => `Enchaînement chronométré — ${tours} tours, dans l'ordre :`,
    enchainementLigne: (i: number, m: number, ligne: string) => `${i}. ${m} m Run puis ${ligne}`,
    enchainementScore: (score: string) => `Score : ${score}. Note le temps de chaque segment.`,
    type: {
      weightlifting: 'Haltéro', strength: 'Force', skill: 'Skill',
      station: 'Force sur station', run: 'Course', race: 'Simulation', compromised: 'Course compromise',
    },
    titreBuilding: (nom: string) => `Building · ${nom}`,
    titreFinisher: 'Finisher',
    titreRetourAuCalme: 'Retour au calme',
    notePourcentages: 'Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre.',
    noteChronometree: 'Séance chronométrée de bout en bout : compare avec ta dernière simulation.',
  },

  /** Jours de la semaine de séance (journal des relâchements de la programmation). */
  jours: { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' },

  /** Programmation automatique (`programming.ts`). */
  programmation: {
    piste: { functional: 'Functional', hybrid: 'Hybrid', musculation: 'Musculation' },
    /** groupes créés dans la box : contenu de box, écrit une fois */
    groupe: { functional: 'Functional', hybrid: 'Hybrid', musculation: 'Musculation' },
  },

  /** Textes de la banque de squelettes (`bank/**`), rangés par id de squelette ou d'option. */
  banque: {
    /** `stimulus.note` des squelettes metcon, par id */
    stimulus: {
      chipper_descending: 'Gestion, pas de sprint avant le dernier tiers.',
      chipper_stations_erg: 'Stations enchaînées, ergs à 85 %.',
      couplet_amrap_short: 'Allure constante, pas de set cassé avant la mi-temps.',
      couplet_for_time_21_15_9: 'Sprint, sets courts dès le round 1.',
      death_by: "S'arrête quand la minute n'est plus tenue.",
      emom_alternating: 'Garder au moins un tiers de chaque intervalle pour récupérer.',
      engine_long_amrap: 'Zone 3, respiration contrôlée du début à la fin.',
      gym_density: 'Technique, aucun échec musculaire.',
      heavy_couplet: 'Charge lourde, sets non cassés, le mono sert de récupération active.',
      interval_work_rest: 'Chaque intervalle est un sprint, repos complet.',
      ladder_ascending: 'Les premiers paliers se font sans poser la barre.',
      ladder_finite: 'Rythme progressif, garder des séries propres sur le sommet.',
      stations_rotation: 'Max effort sur chaque station, repos incomplet voulu.',
      tabata_pair: 'Score = somme des reps min de chaque bloc.',
      triplet_amrap_mid: 'Tenable 20 min, transitions rapides.',
      triplet_for_time_classics: 'Transitions courtes et séries fractionnées avant l’échec.',
      triplet_rounds_for_time: 'Rounds réguliers, la barre ne se pose pas avant la fin du set.',
      amrap_distances: 'Allure constante, chaque round dans les 15 s du précédent.',
      chipper_hybrid: 'Course en ouverture et fermeture, stations enchaînées à allure régulière.',
      compromised_run: 'Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km.',
      core_carry_finisher: "Posture et gainage, jamais à l'échec.",
      emom_hybrid: 'Erg, course et charge en alternance ; garder un tiers de chaque départ pour récupérer.',
      engine_continuous: 'Zone 3, conversation difficile mais possible. Rotation sans repos jusqu\'au budget.',
      engine_negative_split: 'Zone 3, respiration nasale tenable. Seconde moitié un cran plus vite que la première, sans jamais passer en zone 4.',
      erg_pyramid: 'Pyramide à allure régulière, la station courte relance sans casser le rythme.',
      half_sim: 'Demi-course, gérer comme un jour de compétition.',
      run_intervals: 'Allure 5 km ou plus vite, régularité entre répétitions.',
      run_into_station: 'Allure course à 90 % du 5 km, stations sans pause.',
      sled_repeats: 'Lourd et court, repos réel entre les tours.',
      stations_interval: 'Alternance jambes / épaules / mono, 90 s de travail max effort.',
    },

    /** séances : libellé du jour et échauffement, par id de squelette de séance */
    seance: {
      S1_snatch: { label: 'Haltéro · Snatch', echauffement: 'Échauffement (10\') — mobilité épaules et hanches, barre à vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en série de 5.' },
      S2_squat: { label: 'Force · Squat', echauffement: 'Échauffement (10\') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Goblet Squats légers, activation fessiers.' },
      S3_gym: { label: 'Gym · Skill', echauffement: 'Échauffement (10\') — mobilité épaules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur.' },
      S4_cj: { label: 'Haltéro · Clean & Jerk', echauffement: 'Échauffement (10\') — mobilité poignets et hanches, barre à vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en série de 5.' },
      S5_hinge: { label: 'Force · Hinge', echauffement: 'Échauffement (10\') — rameur facile, mobilité ischios et hanches, Good Mornings barre à vide, Glute Bridges, Kettlebell Swings légers.' },
      S6_long: { label: 'Long · Engine', echauffement: 'Échauffement long (18\') — 3 tours faciles : 2\' d\'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon à vide.' },
      H1_intervals: { label: 'Intervalles', echauffement: "Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping." },
      H2_strength_stations: { label: 'Force & stations', echauffement: "Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours." },
      H3_run: { label: 'Course', echauffement: "Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations." },
      H4_engine: { label: 'Engine', echauffement: "Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms." },
      H5_compromised: { label: 'Course compromise', echauffement: "Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères." },
      H6_simulation: { label: 'Simulation', echauffement: "Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide." },
      H6_simulation_full: { label: 'Simulation · test de bloc', echauffement: "Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide. Prépare ton matériel : la séance s'enchaîne sans arrêt." },
    },

    /** notes des séries de force (`montée` est relue par `stepLine` : ne pas la changer) */
    serie: {
      montee: 'montée',
      e3mom6070: 'E3MOM · 60-70 %',
      e3mom7075: 'E3MOM · 70-75 %',
      pct8085: '80-85 %',
      strict: 'strict, qualité avant quantité',
      buildingTempo: 'building tempo',
    },

    /** noms affichés des blocs B qui ne reprennent pas le nom du catalogue, par id d'option */
    building: { b_snatch_balance: 'Snatch Balance' },

    /** progressions A / B et substitutions par catégorie des skills S3, par id d'option */
    skill: {
      skill_c2b: {
        a: 'Kip Swings amples + Scap Pull-Ups (3 × 8), fermeture des hanches vers la barre',
        b: 'Chest-to-Bar assistés élastique ou Jumping C2B avec pause poitrine à la barre (3 × 5)',
        substitutions: { scaled: 'Banded Pull-Ups', inter: 'Pull-ups', rxplus: 'Chest-to-Bar', elite: 'Bar Muscle-ups', pro: 'Bar Muscle-ups' },
      },
      skill_hspu: {
        a: 'Handstand Hold face au mur (3 × 30 s), gainage et coudes verrouillés',
        b: 'Descentes négatives 5 s en Handstand Push-Up ou Pike Push-Ups pieds sur box (3 × 5)',
        substitutions: { scaled: 'Pike Push-Ups', inter: 'Half Wall Walks', rxplus: 'Strict Handstand Push-Ups', elite: 'Strict Handstand Push-Ups', pro: 'Strict Handstand Push-Ups' },
      },
      skill_bmu: {
        a: 'Kip Swings avec hanches hautes + Chest-to-Bar explosifs (3 × 5), trajet vers la barre',
        b: 'Bar Muscle-Ups élastique ou sautés depuis une box basse, transition et dip (3 × 3)',
        substitutions: { scaled: 'Banded Pull-Ups', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' },
      },
      skill_rmu: {
        a: 'False grip Hang + Ring Rows en false grip (3 × 8), anneaux vers le sternum',
        b: 'Transitions pieds au sol sur anneaux bas puis Ring Dips profonds (3 × 4)',
        substitutions: { scaled: 'Ring Rows false grip', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' },
      },
      skill_rope: {
        a: 'Verrouillage de pieds au sol (J-hook / S-wrap) et Rope Pulls assis → debout (3 × 5)',
        b: 'Montées basses en 3 accroches avec pause à chaque verrouillage (3 × 2)',
        substitutions: { scaled: 'Rope Pulls From Floor', inter: 'Rope Climbs', rxplus: 'Rope Climbs', elite: 'Legless Rope Climbs', pro: 'Legless Rope Climbs' },
      },
      skill_wall_walk: {
        a: 'Plank Hold pieds au mur + Bear Crawl (3 × 20 s), bassin rentré',
        b: 'Half Wall Walks avec pause 3 s en haut (3 × 3)',
        substitutions: { scaled: 'Half Wall Walks', inter: 'Wall Walks', rxplus: 'Wall Walks', elite: 'Wall Walks + 5 Shoulder Taps', pro: 'Wall Walks + 5 Shoulder Taps' },
      },
      skill_hs_walk: {
        a: 'Handstand Hold dos au mur (3 × 30 s) puis Shoulder Taps (3 × 10), doigts qui agrippent le sol',
        b: 'Décollages du mur : Handstand Walk 2-3 pas puis retour (3 × 4 tentatives)',
        substitutions: { scaled: 'Handstand Shoulder Taps', inter: 'Half Wall Walks', rxplus: 'Handstand Walk', elite: 'Handstand Walk', pro: 'Handstand Walk' },
      },
    },

    /** noms affichés des mouvements de finisher qui ne reprennent pas le nom du catalogue, par id de finisher puis de mouvement */
    finisher: {
      core_dead_bug_side_plank: { dead_bug: 'Dead Bug (par côté)', side_plank: 'Side Plank (par côté)' },
      core_t2b_l_sit: { l_sit: 'L-Sit sur parallettes' },
      carry_sandbag_bear_hug: { sandbag_carry: 'Sandbag Bear Hug Carry' },
      carry_suitcase_plank: { suitcase_carry: 'Suitcase Carry (par côté)', side_plank: 'Side Plank (par côté)' },
      carry_overhead_kb: { kb_overhead_carry: 'KB Overhead Carry (par bras)' },
      carry_front_rack_db: { db_front_rack_carry: 'DB Front Rack Carry' },
      shoulders_face_pull_raise: { face_pull: 'Face Pull élastique', lateral_raise: 'Lateral Raise léger' },
      shoulders_band_pull_apart_y: { band_pull_apart: 'Band Pull-Aparts', db_y_raise: 'DB Y-Raise' },
      shoulders_cuban_press_hold: { cuban_press: 'Cuban Press léger' },
      glutes_bridge_clam: { banded_clamshell: 'Banded Clamshells (par côté)' },
      glutes_hip_thrust_monster: { monster_walk: 'Monster Walk élastique' },
      glutes_kickback_swing: { glute_kickback: 'Glute Kickback élastique (par côté)' },
      glutes_single_leg_bridge_step_up: { single_leg_glute_bridge: 'Single-Leg Glute Bridge (par côté)' },
      calves_raise_jump: { bodyweight_calf_raise: 'Calf Raises sur marche' },
      calves_single_leg_hold: { single_leg_calf_raise: 'Single-Leg Calf Raise (par côté)', calf_raise_hold: 'Calf Raise Hold en haut' },
      breathing_row_nasal: { row: 'Row respiration nasale', box_breathing: 'Box Breathing 4-4-4-4' },
      breathing_bike_exhale: { bike_erg: 'Bike Erg facile', slow_exhale: 'Respiration 4 s inspir / 8 s expir' },
      h_core_deadbug_side: { plank_hold: 'Side Plank (par côté)' },
      h_core_pallof: { plank_hold: 'Pallof Press tenu (par côté)' },
      h_post_rdl_bridge: { bodyweight_single_leg_rdl: 'Single-Leg RDL poids du corps (par jambe)' },
      h_breath_row: { row: 'Row en respiration nasale' },
      h_breath_ski: { ski_erg: 'SkiErg facile, respiration nasale' },
      h_breath_bike: { bike_erg: 'Bike Erg facile, respiration nasale' },
      h_shoulders_carry: { suitcase_carry: 'Overhead Carry (par côté)' },
      h_breath_row_long: { row: 'Row facile, respiration nasale' },
    },

    /** noms affichés des postes Hybrid qui ne reprennent pas le nom du catalogue */
    poste: {
      stepUpsLestes: 'Box Step-ups lestés (2 × DB)',
      rowTenable: 'Row — allure tenable, ni sprint ni promenade',
      skiTenable: 'SkiErg — allure tenable',
      bikeTenable: 'Bike Erg — allure tenable',
    },

    /** retours au calme Hybrid, dans l'ordre de la banque */
    retourAuCalme: [
      [
        "Retour au calme (8') — 600 m de footing très lent ou 5' de vélo facile, respiration nasale.",
        'Étirements : ischios debout 45 s / jambe · fléchisseurs de hanche en fente 45 s / côté · mollets au mur 45 s / jambe.',
      ],
      [
        "Retour au calme (8') — 5' de rameur très facile, épaules relâchées.",
        'Étirements : chaîne postérieure assis 45 s · pigeon 45 s / côté · ouverture thoracique au mur 45 s / bras.',
      ],
      [
        "Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.",
        'Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.',
      ],
    ],

    /** course du mercredi Hybrid (variantes en rotation), course compromise et simulations */
    course: {
      variantes: [
        { label: '8 × 400 m', cible: 'allure 5 km' },
        { label: '5 × 800 m', cible: 'allure 10 km − 10 s/km' },
        { label: '3 × 1 600 m', cible: 'allure 10 km' },
        { label: '12 × 200 m shuttle', cible: 'allure rapide et régulière' },
      ],
      compromiseCible: 'allure 5 km + 15 s/km',
      scoreSimulation: 'temps total',
    },
  },
};

export type Textes = typeof fr;

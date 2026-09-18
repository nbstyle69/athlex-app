# État du projet AthleX

Dernière mise à jour : **15 septembre 2026**.

Ce fichier est écrit pour être lu en deux minutes, sans être développeur. Il dit ce qui
marche aujourd'hui, ce qui est en train de se faire, ce qui vient ensuite, et ce qui est
connu mais volontairement laissé de côté.

**La règle qui rend ce fichier fiable : il se met à jour dans la même PR que ce qu'il
décrit. Un lot qui se ferme sans sa ligne dans l'état du projet est un lot incomplet — même
statut que les types régénérés.** Le contrôle qui le vérifie est décrit tout en bas.

Deux dépôts, deux noms :

- **l'app mobile** — `athlex-app` (iOS et Android), c'est ce que voient les athlètes ;
- **le back-office web** — `AthleX-Manager` sur `athlexapp.eu`, c'est ce que voient les
  gérants et les coachs.

L'historique ci-dessous est reconstruit depuis les PRs mergées et
[`REGLES_DE_VERIFICATION.md`](./REGLES_DE_VERIFICATION.md). Les dates avant le 16 août 2026
sont donc approximatives : la précision fine commence aujourd'hui.

---

## En production aujourd'hui

Une ligne par capacité, avec la date du lot qui l'a fermée.

### Tournois et compétitions

| Capacité | Fermé le |
| --- | --- |
| Tournois de box : classique, bracket, poules, suisse — avec classement final et distribution d'ELO | 16 août 2026 |
| Compétitions entre box (inter-box) : divisions, ELO de départ, notifications aux participants | 16 août 2026 |
| Un WOD fermé ou non encore révélé n'accepte plus de score (refus prononcé par le serveur) | 19 août 2026 |
| Fin de tournoi en deux temps : on termine les WODs, on révise les scores contestés, puis on distribue l'ELO | 16 août 2026 |
| La clôture d'un tournoi (web et mobile) est une seule opération serveur, tous formats : classement, historique ELO, profils et statut écrits ensemble ou pas du tout ; une seconde clôture est refusée par son nom ; l'écran ne calcule ni n'écrit plus d'ELO | 4 septembre 2026 |
| L'historique ELO survit à la suppression de son événement : les sept clés d'historique (`elo_history.wod_id`, `box_elo_history.wod_id`, `tournament_elo_history.tournament_id`, `tournament_match_elo_history.match_id`, `tournament_wod_elo_history.tournament_wod_id`, `daily_tournament_elo_history.tournament_id`, `inter_elo_history.competition_id`) passent d'`ON DELETE CASCADE` à `ON DELETE SET NULL` ; l'écran d'historique affiche « Tournoi supprimé » / « WOD supprimé » / « Mini-tournoi supprimé » ; suite `elo` : supprimer un tournoi clôturé laisse l'historique, `profiles.elo` inchangé, égalité profil = dernier `elo_after` vraie. `profiles.losses` est déclarée **colonne morte** (jamais incrémentée par aucune fonction ni aucun écran ; commentaire SQL posé) : les défaites affichées restent `total_matches − wins`, la colonne ne doit plus être lue | 5 septembre 2026 |
| Réalignement des deux profils dont l'historique avait été supprimé par notre purge : JCVD 1039 → 1064 (compteurs 12 → 8, 5 → 4), in the bar 1057 → 1032, en une transaction gardée ; Samir intact (historique jamais écrit → le profil est le seul témoin) ; relecture : les six profils à historique ont `profiles.elo` = dernier `elo_after` | 4 septembre 2026 |
| La courbe d'historique ELO intègre les matchs de bracket : l'écran lit aussi `tournament_match_elo_history` (écrite par `trg_bracket_match_elo`), une ligne « Tournoi · vs adversaire » par match, « Match supprimé » si le match a disparu ; pour un joueur de bracket, le dernier point de la courbe retombe sur l'ELO du profil, ce qui n'était pas le cas avant. Test unitaire `eloHistoryBracketMatches` | 6 septembre 2026 |
| Le classement affiché suit exactement l'ordre du serveur : secondes, sens du tri, scores au time cap, ex aequo signalés | 23 août 2026 |
| Le vainqueur d'un match de bracket est calculé par une seule règle, partagée avec le reste de l'app | 23 août 2026 |
| Preuve vidéo disponible sur tous les formats de tournoi | 16 août 2026 |

### Musculation et records

| Capacité | Fermé le |
| --- | --- |
| Un seul catalogue de mouvements : une clé par exercice, donc les badges sont réellement atteignables | 19 août 2026 |
| Blocs de force dans les WODs (séries × reps × charge), écrits depuis le back-office | 19 août 2026 |
| Journal des séries réellement réalisées : le 1RM se calcule sur les reps faites et les charges utilisées, pas sur le prévu | 20 août 2026 |
| Fiche athlète dans le back-office : 1RM, séries réalisées, et la provenance de chaque record | 20 août 2026 |
| Le time cap se décompte à la seconde exacte (côté app et dans les deux éditeurs web) | 19 août 2026 |

### Semaines types et programmation

| Capacité | Fermé le |
| --- | --- |
| Semaines types : enregistrer une semaine du Whiteboard et la reposer plus tard | 19 août 2026 |
| Un remplacement de semaine n'efface plus un WOD déjà scoré — les conflits sont montrés jour par jour, avec leur provenance | 19 août 2026 |
| Marketplace de programmation entre box : catalogue, offres, abonnement, révélation le dimanche 18h | 18 août 2026 |
| « Appliquer une programmation » sur le Whiteboard, avec option d'application automatique | 18 août 2026 |
| Import d'une programmation depuis un fichier CSV, JSON ou PDF | 18 août 2026 |
| Un seul éditeur de WOD pour deux contextes (Whiteboard et programmation) | 18 août 2026 |
| Libellés « Functional » / « Hybrid » partout où le gérant voyait « CrossFit » / « Hyrox » comme catégorie ou filtre (catalogue de programmation mobile `BOProgrammingScreen` et web `programming/page.tsx`, annuaire des box `BoxDirectory*`) — libellés seuls, les valeurs internes `crossfit`/`hyrox`/`functional`/`hybrid` et les noms de box sont inchangés ; test `disciplineLabels.test.ts` dans chaque dépôt | 5 septembre 2026 |
| Marques côté utilisateur (règle transverse) : piste et groupe de programmation « Functional / Hybrid » (clé interne `functional`), squelettes de séance et fonction `generate-box-week` nettoyés, test `packages/wod-engine/__tests__/brands.test.ts` qui échoue si « CrossFit » ou « Hyrox » sort d’un `title`, d’une `description`, d’un libellé de piste, d’un nom de groupe ou d’un `samples*.md` | 16 septembre 2026 |

### Adhérents, argent et programmes

| Capacité | Fermé le |
| --- | --- |
| Abonnements de salle Stripe : formules, quotas, accès aux cours, prorata et changement de formule | 16 août 2026 |
| Offres ponctuelles : séance d'essai, Drop-in, carnet de séances — crédits révoqués au remboursement | 16 août 2026 |
| Contrats d'abonnement : engagement, gel, résiliation sur justificatif, CGV en PDF par box, codes promo | 16 août 2026 |
| Vente de programmes aux athlètes via Stripe Connect, et assignation directe à un membre | 23 août 2026 |
| « Payé au comptoir » : un euro encaissé hors Stripe est écrit dans un journal en ajout seul, et compté une seule fois | 23 août 2026 |
| Invitations nominatives : création, relance, QR code, révocation, import CSV, paiement lié | 16 août 2026 |
| Statistiques du gérant : argent (MRR, impayés), assiduité (à risque, remplissage, pointage), croissance (funnel) | 16 août 2026 |
| Récapitulatif hebdomadaire par e-mail, avec possibilité de s'en désinscrire | 16 août 2026 |
| Espace athlète web `/compte` : profil, abonnement, crédits, programmes | 16 août 2026 |
| Annuaire public des box et page publique de box (`/box`, `/box/[slug]`) | 16 août 2026 |
| Facturation du gérant : Solo, puis Multi à +29 €/box au-delà de la première | 16 août 2026 |
| Suivi des prospects après une séance d'essai : feedback, RDV, relances push et e-mail | 16 août 2026 |
| Socle serveur de l'offre Essai : un visiteur sans compte réserve un cours, l'essai est gratuit parce que la base refuse un essai payant, un cours complet est refusé au lieu de faire espérer | 24 août 2026 |
| Tunnel Essai complet : le visiteur réserve depuis la page publique de la box, la place se décompte réellement, le doublon est refusé, le prospect arrive dans Prospects et en liste de présence — constaté en production le 30 août | 30 août 2026 |
| Récapitulatif hebdomadaire du gérant : un essai ne compte plus comme une présence d'adhérent, et les essais réservés ont leur propre ligne | 30 août 2026 |

### Sécurité et rôles

| Capacité | Fermé le |
| --- | --- |
| Séparation gérant / co-gérant / coach : l'argent et les invitations restent au gérant, le coach programme | 23 août 2026 |
| Le titre « gérant » ou « coach » est prononcé par le serveur, pas déduit par l'app | 21 août 2026 |
| Le coach a un périmètre nommé (Whiteboard, Horaires, Créneaux types, Messages) et les refus le disent | 23 août 2026 |
| Un WOD payant ne se lit plus sans y avoir droit — la garde est côté serveur, y compris sur les lectures dérivées | 21 août 2026 |
| Une programmation payante ne s'obtient plus sans payer | 23 août 2026 |
| Un gérant n'agit que sur sa propre box (étanchéité entre box) | 19 août 2026 |
| La clé publique de l'app n'a plus aucun droit d'écriture, et les profils privés sont fermés | 23 août 2026 |
| Notifications : préférences réellement respectées, rappels annulés quand on les désactive, tournoi notifié aux seuls participants | 17 août 2026 |
| Audit nocturne des droits sur la vraie base de production, en lecture seule, qui compte ses propres contrôles | 21 août 2026 |
| Les heures sont écrites au format `HH:MM` et le serveur refuse le reste — le tri reste juste demain | 23 août 2026 |
| Les coordonnées d'un prospect sont hors de la table que tout adhérent de la box peut lire, et la clé publique n'y a aucun droit — même en lecture | 24 août 2026 |
| Validation d'e-mail à l'inscription activée en production (Confirm email + SMTP Resend `noreply@athlexapp.eu`, port 465, username `resend` en minuscules) ; première inscription confirmée constatée par Nab | 4 septembre 2026 |
| Le lien « Confirm signup » atterrit sur la page publique `athlexapp.eu/email-confirme` (sans session ni formulaire) ; seul un lien `recovery` ouvre le formulaire de mot de passe ; l'app passe `emailRedirectTo` (OTA) | 4 septembre 2026 |
| Chaque flux e-mail porte sa page, aucun routage par `type` : `signUp` → `emailRedirectTo` `/email-confirme`, `resetPasswordForEmail` → `redirectTo` `athlexapp.eu/update-password` (sans lui GoTrue renvoie vers le Site URL = `/email-confirme`, sans formulaire — régression 1.0.52 A4). Suite `auth-links` : vrai lien GoTrue généré puis 303 suivi, pour les deux flux et pour l'absence de `redirectTo` | 5 septembre 2026 |
| Le jeton de notification s'efface **avant** la fermeture de session (sinon 401 et l'ancien compte garde ses notifications sur le téléphone) ; un échec d'effacement est remonté dans Sentry | 4 septembre 2026 |
| Les erreurs Supabase Auth connues (« Error sending confirmation email », « Email not confirmed », « User already registered », « Invalid login credentials »…) sont traduites FR/EN, repli générique en français — plus de message brut en anglais | 4 septembre 2026 |
| **Compte reviewer Apple `nbstylz+apple@gmail.com` — ne pas supprimer, ne jamais promouvoir.** Athlète `member` rattaché à Crossfit NBS2 avec la formule « Illimité » attribuée par le chemin staff (`box_members.plan_id`, 0 €, aucun abonnement Stripe, aucune ligne `box_cash_payments`) pour pouvoir réserver des cours, e-mail confirmé à la création, aucun mot de passe transmis (Nab passe par « mot de passe oublié »). Frontière prouvée depuis son JWT : `is_box_owner_admin` = false, `get_my_admin_boxes()` vide, tables d'argent vides ou refusées, promotion de rôle sans effet, réservation puis annulation d'un cours NBS2 OK, `program_members` en écriture refusé (403). Créé le 4 septembre 2026 après la purge des 11 comptes jetables (`@athlex-test.local`, `@e2e.local`, `@audit.athlex.io`, `zz.design@athlex.test`) et du tournoi de démo « Test Bracket 16 » | 4 septembre 2026 |

### Mises à jour de l'app (OTA) et livraison

| Capacité | Fermé le |
| --- | --- |
| Publication automatique d'une mise à jour à chaque push, avec garde-fou sur la version cible | 19 août 2026 |
| Une mise à jour ne peut plus partir sans les clés d'accès à la base (l'app arrivait intacte mais inerte) | 19 août 2026 |
| Rejeu du schéma de base de données en CI à chaque PR | 16 août 2026 |
| Version `1.0.51` construite pour iOS et Android, IPA envoyé sur App Store Connect | 24 août 2026 |
| Version `1.0.52` (49) iOS construite depuis `master`, IPA vérifié 17/17, traitée par Apple et installable depuis TestFlight (groupe interne) — **obsolète, non soumise** : la revue 1.0.52 (A4, I4, I5, L1, I6, C4, tunnel d'invitation) part dans `1.0.53` (50), nouveau runtime OTA | 3 septembre 2026 |
| Version `1.0.53` (50) : `app.json` `version`/`buildNumber` posés ; build iOS depuis `master` mergé, `verify:ipa`, `eas submit` — rien vers App Review | 5 septembre 2026 |
| Build de test `1.0.53` iOS (53) / Android (68) depuis `master` (2f6f63f : générateur de WOD v1 #284/#285, cardio #273, douze mouvements haltéro) — `verify:ipa` 21/21, `verify:aab` 23/23, bundle Hermes contenant `WodGenerator`/`WodResult`, `wod_skeletons`, `wod_volume_caps`, `movement_catalog` ; IPA soumis à App Store Connect (TestFlight interne), AAB non envoyé. Migrations `20261211` + `20261212` appliquées en prod le même jour (`pg_dump` `20260915T125815Z` déposé dans le bucket privé `db-dumps`) : `movement_catalog` 109 lignes, `wod_skeletons` 25, `wod_volume_caps` 19. `app.json` aligné (53/68) | 15 septembre 2026 |
| Build de test `1.0.54` iOS (54) / Android (69) depuis `master` (c31ed53 : Musculation M1 #289 + J1 #292 + M2 #293, repli snapshot muscu #294, carte Séance alignée metcon #295, contraste « Série suivante » #296) — `verify:ipa` 21/21, `verify:aab` 23/23, bundle Hermes contenant `WodGenerator`, `WodResult` et la discipline `musculation`, `engineCrossFit` absent ; IPA soumis à App Store Connect (TestFlight interne, submission `db8aa3a3`), AAB non envoyé sur Play. Builds EAS `2b624c46` (iOS) / `6b1c3430` (Android). **Migrations `20261214`–`20261217` appliquées en prod le 16/09/2026 à 19:41 UTC**, après « 1.0.54 installé » et `pg_dump` custom du schéma `public` (`athlex-prod-public-20260916T194119Z.dump`, sha256 `684ccc79…2c0e21`, bucket privé `db-dumps/2026-09-16/`), chaque fichier en `--single-transaction`, audit prod des grants 26/26. `app.json` 1.0.54 / 54 / 69 commité | 16 septembre 2026 |
| Build de test `1.0.53` iOS (52) / Android (66) depuis `master` (99c8287 : cardio m/cal ♂/♀, bloc Cardio, charge libre, douze mouvements haltéro, Strict Press séparé) — `verify:ipa` 21/21, `verify:aab` 25/25, IPA soumis à App Store Connect (TestFlight interne), AAB non envoyé. Migrations #271/#274/#275 appliquées en prod le même jour (dump logique préalable). `app.json` aligné sur les numéros réels (52/66) : le build 51 avait été produit sans commit du bump, d'où une collision évitée de justesse | 8 septembre 2026 |
| GIF dans Messages : Tenor (API fermée le 30 juin 2026) remplacé par GIPHY (`api.giphy.com/v1/gifs/search` et `/trending`, `rating=pg-13`, clé `EXPO_PUBLIC_GIPHY_KEY` posée dans GitHub Actions et EAS). Clé absente du bundle → « GIF indisponibles » lisible ; « Powered by GIPHY » dans le sélecteur (CGU GIPHY). Garde-fous : `ota.yml` (bundle servi), `verify:ipa`, `verify:aab` échouent si la clé n'est pas embarquée, via le marqueur `giphy-key:<clé>:giphy-end` plié au bundle. Plus aucune référence à Tenor (test qui échoue si une réapparaît) | 5 septembre 2026 |
| `verify:aab` (`scripts/aab-verify-bundle.mjs`) : pendant Android de `verify:ipa` sur l'AAB réel (bundle Hermes, URL/clé anon Supabase, `versionName`/`versionCode`/runtime/canal OTA via bundletool, aucune permission de localisation) — 16/16 sur l'AAB 1.0.51 (64) hors les deux écarts de version attendus | 5 septembre 2026 |
| Minimisation avant le build 50 : Sentry sans capture d'écran (`attachScreenshot: false`) et `setUser({ id })` seul ; Mixpanel sans géolocalisation IP (`setUseIpAddressForGeolocation(false)`) et sans e-mail dans `people.set` ; à la suppression du compte, `people.deleteUser()` + `flush()` avant `reset()` et `signOut` (échec → Sentry, la suppression ne dépend pas de Mixpanel). Test `dataMinimisation.test.ts`, mutation inverse (ordre inversé) rouge | 5 septembre 2026 |
| Crash de la présentation (carrousel `OnboardingTutorialScreen`) au premier lancement : cause prouvée en montage réel (`npm run test:rn`, preset jest react-native + react-test-renderer) — « C'est parti » appelle `scrollToIndex` sur une cellule pas encore mesurée, sans `getItemLayout` ni `onScrollToIndexFailed` : RN 0.81 lève `Invariant Violation: scrollToIndex should be used in conjunction with getItemLayout or onScrollToIndexFailed…` dans un gestionnaire d'événement, hors de tout ErrorBoundary → exception JS fatale. Correctif : `getItemLayout` (slides de largeur `width`) + `onScrollToIndexFailed` → `scrollToOffset`. Mutation inverse (retirer les deux props) : rouge. Confettis/`Math.random`, `Animated.loop` non natif, `badgeScale`, `awardLevelBadge`, `trackOnboardingStep`, `Dimensions` au chargement : lus, montés iOS/Android, aucun ne lève. `OnboardingErrorBoundary` autour de la présentation : exception de rendu → Sentry + repli sur l'accueil (clé locale posée), jamais d'écran mort. Sentry sans trace : voir ligne DSN | 5 septembre 2026 |
| « Présentation vue » côté compte : `profiles.onboarding_completed_at` (timestamptz nullable, migration `20261201`), écrite par `onDone` via la RPC idempotente `mark_onboarding_completed()` (SECURITY DEFINER, `auth.uid()`, EXECUTE authenticated seulement), relue à la connexion par `get_my_profile` (SETOF profiles). `@athlex:onboardingDone` n'est plus qu'un cache de session (porte l'id du compte, purgé au signOut) ; `@athlex:tourDone` inchangé (appareil). **Appliquée en prod le 5 septembre** : colonne présente, 35 profils / 0 marqué, empreinte des lignes hors colonne identique avant/après, compte reviewer `nbstylz+apple` à NULL (Apple verra la présentation une fois). Suites : `onboardingStatus.test.ts` (signOut→signIn même compte, compte neuf, autre appareil, mutation inverse « retirer la lecture serveur » → rouge), `test-onboarding-completed.mjs` sur pile jetable 7/7 (suite `onboarding` d'`integration.yml`) | 5 septembre 2026 |
| Sentry vide sur 14 jours : cause prouvée — `EXPO_PUBLIC_SENTRY_DSN` absente de l'environnement EAS `production` (`eas env:list`), donc `Sentry.init({ dsn: '' })` : aucun DSN dans l'OTA servie 1.0.52 (ios/android, updates `01a071ac…`) ni dans l'IPA 1.0.52 (49) (`verify:ipa`) ; seule l'URL de télémétrie du SDK (`o447951.ingest.sentry.io`) y figure. `enableNative`/`enableNativeCrashHandling` sont aux valeurs par défaut du SDK 7.2 (vrai) : les crashs natifs remonteraient avec un DSN. Garde-fous : `ota.yml` (`ota-verify-bundle.mjs`), `verify:ipa`, `verify:aab` échouent désormais sans DSN, comme pour Supabase et GIPHY (règle 11). Test `sentryDsnGuards.test.ts`. **Nab : poser `EXPO_PUBLIC_SENTRY_DSN` dans EAS (`production`)**, valeur lue dans Sentry → Settings → Projects → athlex-mobile → Client Keys (DSN) ; preuve de réception à faire sur la première OTA/build qui l'embarque | 5 septembre 2026 |
| Preuve de réception Sentry (règle 20) : `EXPO_PUBLIC_SENTRY_SMOKE=1` sur une seule publication → `captureMessage('sentry-smoke <version · update>')` au démarrage (`src/lib/sentrySmoke.ts`, après `Sentry.init`) ; sans le flag, rien ne part (tests `sentrySmoke.test.ts`). **À faire par Nab** sur la première OTA/build qui embarque `EXPO_PUBLIC_SENTRY_DSN` : poser le flag dans l'env EAS `production`, publier, voir l'événement dans Sentry dans la minute, retirer le flag. Tant que ce n'est pas vu, « Sentry vide » ne conclut rien | 5 septembre 2026 |
| Libellés athlète : les 3 occurrences laissées par #250 passent en Functional (« Benchmarks Functional » FR/EN, exemple de nom de box « Functional Lyon », prompt d'analyse vidéo) + hashtag d'exemple de bio `#functional`. Clé de stockage historique des PR `'Benchmarks CrossFit'` conservée (donnée, pas libellé). Aucun nom de box touché. Embarqué dans le build 50 | 5 septembre 2026 |
| Compétitions physiques « crossfit » : 7 `physical_competitions` importées supprimées en prod (une transaction, garde : 0 `physical_wods` dépendant, 13 → 6), 5 compétitions passées encore `open` clôturées (HOOKGRIP SHOWDOWN III, 07/11/2026, reste `open`). Vue `physical_competitions_served` (`security_invoker`, lecture seule) : `status` = `closed` dès que la date est passée ; HomeScreen et PhysicalCompetitionScreen lisent la vue. Suite `phys-served` 5/5, mutation inverse (vue sans recalcul) 2/5. Appliquée en prod avant merge | 5 septembre 2026 |
| Clé Google Maps Android : le dépôt est public, aucune clé n'y entre. `app.config.js` lit `GOOGLE_MAPS_ANDROID_API_KEY` (variable Sensitive de l'env EAS `production`, clé restreinte à `com.athlex.app` + SHA-1) ; plus aucune lecture de l'ancienne `GOOGLE_MAPS_API_KEY` (clé du 15 juin, 33 API, sans restriction — ne doit plus être embarquée). `verify:aab` exige `com.google.android.geo.API_KEY` dans le manifeste et, avec `MAPS_KEY_FORBIDDEN_SUFFIX` / `MAPS_KEY_EXPECTED_SUFFIX` (fins de clé fournies par Nab : `…vIwnw` attendue, `…rZMEE` interdite), refuse l'ancienne clé. Test `mapsKeyNotInRepo.test.ts` | 5 septembre 2026 |
| Mixpanel « NBS Innovation » vide (règle 20, deuxième cas) : cause prouvée — le projet est en résidence **EU** (Project Settings) et `analytics.ts` faisait `init()` sans URL, donc le SDK visait `https://api.mixpanel.com` (US, seule URL présente dans l'IPA 51 et son `main.jsbundle`) : les événements partaient vers un serveur qui ne connaît pas le projet. Le token `EXPO_PUBLIC_MIXPANEL_TOKEN` est bien dans l'env EAS `production` et inliné dans le bundle du build 51 (ce n'est pas la cause). Correctif : `init(false, {}, 'https://api-eu.mixpanel.com')` ; `track('Login')` part désormais **après** `identify` (armé dans `signIn`, émis dans `fetchProfile`) au lieu d'arriver anonyme. Garde-fous : token encadré `mixpanel-token:…:mixpanel-end` + URL EU exigés par `ota-verify-bundle.mjs`, `verify:ipa`, `verify:aab` (sur l'IPA 51 réel : 19/21, les deux nouvelles assertions rouges comme attendu). Test `mixpanelEuLoginOrder.test.ts`. **Nab : comparer le Project Token Mixpanel à `6a12…233b`** ; preuve de réception : un `Login` de Nab dans Events dans la minute après l'OTA, pas de smoke permanent | 5 septembre 2026 |

### Soumission — App Privacy (Apple) et Data Safety (Google Play)

Inventaire lu dans le code (fichier-preuve par ligne), état du build `1.0.53` (50). Ce qui n'est pas
visible dans le code (réglages des consoles Sentry/Mixpanel/GIPHY) est **non vérifié** et dit tel quel.
Réponses globales : collecte = oui ; **suivi (ATT) = non** (pas d'IDFA, pas de courtier de données,
aucune régie) ; chiffrement en transit = oui (HTTPS partout) ; suppression dans l'app = oui.

| Donnée | Part vers | Apple — catégorie · usage · liée à l'identité | Google Play — type · usage | Preuve |
| --- | --- | --- | --- | --- |
| E-mail | Supabase Auth + `profiles.email` uniquement (plus Sentry ni Mixpanel) | Contact Info → Email Address · Fonctionnement · **liée** | Personal info → Email address · App functionality | `src/context/AuthContext.tsx` (`auth.signUp`, `setUserContext(profile.id)`, `identifyUser` sans `email`) |
| Nom / pseudo (`username`, `full_name`) | Supabase `profiles` ; Mixpanel (`username`) | Contact Info → Name · Fonctionnement, Analytics · liée | Personal info → Name · App functionality, Analytics | `AuthContext.tsx`, `src/screens/profile/ProfileScreen.tsx`, `src/lib/analytics.ts` |
| Genre, bio | Supabase `profiles` | Other Data Types / Other User Content · Fonctionnement · liée | Personal info → Other info · App functionality | `ProfileScreen.tsx` |
| Photo de profil, images de messages/articles/logo | Supabase Storage (`avatars`, `message-attachments`, `box-assets`, `box-logos`) | User Content → Photos or Videos · Fonctionnement · liée | Photos and videos → Photos · App functionality | `ProfileScreen.tsx`, `MessagesScreen.tsx`, `BOArticlesScreen.tsx`, `BOBoxInfoScreen.tsx` |
| Vidéos de performance | **Jamais envoyées** : galerie locale ; seule une URL saisie est stockée (`*.video_url`) | Vidéo : rien ; URL : Other User Content · liée | Photos and videos → non collecté | `TimerRunScreen.tsx` (`MediaLibrary.saveToLibraryAsync`), `InterScoreSubmitScreen.tsx` ; aucun `upload` de vidéo dans `src/` |
| Documents (PDF) | Storage `documents` | User Content → Other User Content · Fonctionnement · liée | Files and docs · App functionality | `DocumentsScreen.tsx` |
| Performance sportive (scores, temps, charges, PR, ELO, séances) | Supabase | **Health & Fitness → Fitness** · Fonctionnement · liée | Health and fitness → Fitness info · App functionality | `src/services/strengthPR.ts`, `strengthSets.ts`, `myProfile.ts`, `gamification.ts` |
| Messages (privés, groupes, commentaires) | Supabase | User Content → Other User Content · Fonctionnement · liée | Messages → Other in-app messages · App functionality | `MessagesScreen.tsx` |
| Identifiant utilisateur | Supabase ; Sentry `user.id` ; Mixpanel `distinct_id` | Identifiers → User ID · Fonctionnement, Analytics · liée | Personal info → User IDs · App functionality, Analytics | `src/lib/sentry.ts`, `src/lib/analytics.ts` |
| Jeton push (Expo) | Supabase `push_tokens` ; serveur Expo via `send-push` | Identifiers → Device ID · Fonctionnement · liée | Device or other IDs · App functionality | `src/services/notifications.ts`, `supabase/functions/send-push` |
| IDFA / Advertising ID | **Non** (pas d'ATT, pas d'`AD_ID`) | — | non collecté | `app.json`, manifeste AAB (`verify:aab`) |
| Identifiant d'installation généré par les SDK | Sentry, Mixpanel | Identifiers → Device ID · Analytics · liée | Device or other IDs · Analytics | `App.tsx`, `analytics.ts` (défaut SDK) |
| Crash et performance | Sentry (`@sentry/react-native`) — **sans capture d'écran** | Diagnostics → Crash Data, Performance Data · Fonctionnement · liée (`id` seul) | App activity → Crash logs, Diagnostics · App functionality | `App.tsx` (`attachScreenshot: false`), `src/lib/sentry.ts` |
| Événements d'usage (liste exhaustive dans `src/lib/analytics.ts`, identifiants techniques et catégories, jamais de contenu libre) | Mixpanel — **sans géolocalisation IP** | Usage Data → Product Interaction · Analytics · liée (`identify` + `people.set` username/role/level) | App activity → App interactions · Analytics | `src/lib/analytics.ts` |
| Localisation | **Non demandée** : aucune permission iOS/Android, pas d'`expo-location` ; `showsUserLocation` inopérant ; la carte se centre sur la moyenne des box | — | Location → non collecté | `app.json`, `BoxDirectoryMapScreen.tsx`, `verify:aab` |
| Recherche de GIF (termes saisis, IP) | GIPHY (`api.giphy.com`) — Tenor fermé | Usage Data → Search History · Fonctionnement · **non liée** (pas d'identifiant transmis) | App activity → In-app search history · App functionality | `MessagesScreen.tsx` |
| Données saisies par le gérant sur des tiers (prospects, invitations) | Supabase | Contact Info → Email, Phone · Fonctionnement · liée | Personal info → Email, Phone · App functionality | `src/screens/backoffice/` |
| Côté serveur : analyse d'un score par IA (pseudo, valeur, notes), texte de PDF de programmation ; e-mails transactionnels | Anthropic ; Resend | Processeurs, déclarés avec les données ci-dessus | Processeurs (« partagé » ou exemption service provider selon DPA) | `supabase/functions/analyze-tournament-score`, `parse-wod-pdf`, `weekly-owner-digest`, `session-followup-cron` |

Suppression de compte (`delete_user_account`, définition lue en prod) : compte Auth, profil et
90 tables en `ON DELETE CASCADE` supprimés, Storage (`avatars`, `documents`, `message-attachments`)
purgé ; 44 clés `ON DELETE SET NULL` anonymisent les références dans le contenu des autres (matchs,
`created_by`, journal comptoir de la box) ; profil Mixpanel effacé par `people.deleteUser()` ;
`group_messages.sender_id` passe en `SET NULL` par migration (lot du 5 septembre). Reste hors de
portée de l'app : événements Sentry déjà envoyés (rétention du plan, non vérifiée) et journaux
Supabase/Resend.

### Site public et lisibilité

| Capacité | Fermé le |
| --- | --- |
| Bascule complète sur le domaine `athlexapp.eu` (liens, e-mails, redirections) | 16 août 2026 |
| Site public bilingue FR/EN : accueil, tunnel d'inscription, annuaire, page de box | 17 août 2026 |
| Mentions légales, confidentialité et entité juridique NBS Innovation | 17 août 2026 |
| Classement ELO public (`/classement`) avec recherche par pseudo | 16 août 2026 |
| Phase 1 design mobile : quatre écrans lisibles en clair et en sombre, encre mesurée, couleurs de domaine préservées | 24 août 2026 |
| Marketplace et Programmes athlètes portent enfin deux noms distincts (renommage d'affichage) | 24 août 2026 |
| Les programmes d'une box redeviennent visibles — et vendables — sur sa page publique | 24 août 2026 |
| Toute box créée reçoit un identifiant d'URL : plus aucune box active absente de l'annuaire | 24 août 2026 |
| `/compte` montre l'adhésion même sans abonnement en ligne (formule attribuée ou payée à la box) | 24 août 2026 |
| Une lecture publique refusée se voit : elle ne se rend plus en liste vide plausible | 24 août 2026 |
| Une relance de prospect fautive ne coupe plus les relances de toutes les box | 24 août 2026 |
| Fiche adhérent du back-office mobile (`BOMembers`) : fiche opaque (`modalCard`, encre atténuée 2,77:1 → 5,36:1 en clair), formule, statut et échéance servis par `get_box_billing` au gérant/co-gérant (le coach n'y voit pas de bloc formule) — 1.0.52 I4 | 5 septembre 2026 |
| Accueil, section Tournois : « Tous les tournois » ouvre l'onglet Tournois de Compétitions (le bouton ne faisait rien), libellé et statuts des cartes via i18n FR/EN (plus de chaînes en dur) — 1.0.52 L1 | 5 septembre 2026 |
| Accueil sans box sélectionnée : plus de requête `tournaments` avec `box_id=eq.` (400 PostgREST avalé, vu en logs pendant la recon B1) — pas de box, pas de requête ; avec box, la lecture passe par `readRows` et l'erreur remonte à Sentry. Test qui échoue si le filtre vide revient. | 5 septembre 2026 |
| Tunnel d'invitation, confirmation visible (cas `nbstylz+r2`, `email_not_confirmed` à la connexion) : web `/rejoindre` lit `needsConfirmation` et annonce le mail « Confirme ton adresse » avec l'adresse, avant « télécharge l'app », `accept` passe `emailRedirectTo` `/email-confirme` explicite (AthleX-Manager #308) ; app, écran de connexion : sur `email_not_confirmed` seulement, « Confirme d'abord ton e-mail » + « Renvoyer le mail » (`auth.resend({ type: 'signup' })`), retour « Mail renvoyé à <e-mail> » ou erreur traduite dont la limite 60 s de GoTrue. Test : bouton présent pour cette erreur, absent pour un mauvais mot de passe, `resend` appelé avec l'e-mail saisi. | 5 septembre 2026 |
| Profil gérant mobile : bloc « Abonnement AthleX » (Solo/Multi depuis `owner_subscriptions`, état de la box) avec bouton vers `BOSubscription` — jusque-là joignable seulement depuis le Dashboard — 1.0.52 I5 | 5 septembre 2026 |
| Pile Dashboard gérant : chevron retour standard (`ChevronLeft`, `goBack`) sur les 15 écrans empilés — ajouté sur Stats, Rapport, Notifications, Gamification, Articles, Inter-box ; harmonisé sur Réglages, Infos box, Abonnement (flèche) et Tournoi (« ← » texte) ; test qui énumère la pile — 1.0.52 I6 | 5 septembre 2026 |
| Écran de connexion : `v1.0.53` seul au rendu, l'identifiant OTA (`· 01a01acc` ou `· embarqué`) apparaît au toucher du texte de version (`versionDisplay`). Test : masqué au rendu, visible après appui. | 5 septembre 2026 |
| Historique d'entraînement, deux points d'entrée vers `WodHistory` : « Mes entraînements » dans le Profil (athlète et gérant — `WodHistory` ajouté à `BOProfileStack`), et après l'enregistrement d'un score dans le générateur, confirmation avec « Voir mon historique ». Test : les deux points d'entrée naviguent vers `WodHistory`. | 5 septembre 2026 |
| Messagerie de groupe : `group_messages.sender_id` reçoit sa clé étrangère vers `profiles` en `ON DELETE SET NULL` (migration `20261130_group_messages_sender_set_null.sql`, appliquée en prod avant merge, preuve `pg_constraint` `confdeltype='n'`) — la suppression d'un compte laissait ses messages orphelins (24 sur 39 purgés le 4 septembre), elle les anonymise désormais ; `MessagesScreen` affiche « Compte supprimé » pour un expéditeur `NULL`. Suite `group-messages` d'`integration.yml` : `delete_user_account()` sous l'identité de l'athlète → ses messages restent avec `sender_id NULL`, ceux des autres intacts (7/7) ; mutation inverse (clé retirée) rouge sur `GM_ORPHELIN` | 5 septembre 2026 |

---

## En cours

**Générateur de WOD v1 — PR 1/3 (`athlex-app`, migration `20261211`).** Le générateur est
refait de zéro en moteur déterministe (`packages/wod-engine`, TypeScript pur, aucune IA ni
réseau à l'exécution) ; on garde seulement le RNG à graine et la signature anti-répétition.
Le serveur porte `movement_catalog` (95 mouvements actifs tirés du CSV validé + 14 mouvements
historiques de l'app en `active = false`, lecture `authenticated` seulement) et
`generated_wods.wod_json` (le WOD structuré, rounds et signature compris ; l'anti-répétition
lit les 10 dernières signatures de l'athlète). Deux disciplines (Functional, Hybrid), deux
entrées (express, après-classe), 15 + 10 squelettes, charges par catégorie, gilet lesté en
paramètre, `s` et `cm` acceptés par `movementParser` sans créditer de badge ni de charge.
Tests §9 : conformité sur 587 combinaisons × 200 graines. **Migration appliquée en prod : oui**
(15/09/2026, `pg_dump` `20260915T125815Z` déposé avant dans le bucket privé `db-dumps` ;
109 lignes importées). Aucun écran ne change : la PR 2 (écran) attend la relecture de
`packages/wod-engine/samples.md`, la PR 3 (Manager) suit.

**Générateur de WOD v1 — PR 2/3 (`athlex-app`, migration `20261212`).** L'écran
« Générateur de WOD » (`WodGenerator`) et la page résultat (`WodResult`) remplacent l'ancien
générateur, supprimé et non masqué (`WODGeneratorScreen`, `WODGenProScreen`,
`WODSuggestionsScreen`, `engineCrossFit`, `engineHyrox`, `ranker`, `adapter`, flag
`wodGenV2`). Pas de ligne Catégorie : la catégorie du profil (`rx+ → rxplus`, `gender` null ⇒
Men) ne sert qu'à l'estimation, le WOD affiche toutes les catégories ; le texte n'est rendu
que par « Copier ». Exclusions persistées dans `user_generation_settings.last_params`.
Enregistrer / Favori / Saisir mon score (catégorie demandée) conservent `generated_wods`
(+ `wod_json`), `generated_wod_scores` et le crédit de badges. Le serveur porte la banque de
squelettes (`wod_skeletons`, 25 lignes) et la table §5.4 (`wod_volume_caps`, 19 lignes),
lecture `authenticated` seulement, écriture `service_role` ; `src/services/wodEngineData.ts`
les charge avec le catalogue et retombe indépendamment sur les snapshots embarqués
(hors ligne). **Migration appliquée en prod : oui** (15/09/2026, même dump `20260915T125815Z` ;
25 squelettes, 19 plafonds). La PR 3 (Manager) suit.

**Générateur de WOD v1 — page résultat `WodResult` (`athlex-app`, sans migration).** Après
les tests réels du moteur, la page résultat est remise au niveau de l'app : en tête la carte WOD
du Whiteboard (badge `GÉNÉRÉ`, titre en capitales, minuteur rond), ligne « Affiché pour : Inter ·
d'après ton profil — modifier », mouvements en liste aérée repliée par défaut (chevron → charges
et substitutions de toutes les catégories), durée en ligne compacte + tableau dépliable,
texte secondaire au contraste des tuiles Outils, barre d'actions fixe au-dessus de la tab bar.
Deux actions nouvelles : **Minuteur** (le minuteur vidéo existant, préconfiguré depuis le
format du WOD — EMOM 15 → 1'/15, AMRAP 12 → 12', For time → chrono + cap ; `WodTypeBadge` et
`TimerLaunchModal` sont sortis du Whiteboard en composants partagés) et **Ajouter au
Whiteboard** (WOD perso `box_wods` avec `box_id` null, `created_by` l'athlète, date du jour,
rendu texte en `description`, lien structuré dans `generated_wods.wod_json.box_wod_id` ; un
score déjà saisi est rattaché, pas dupliqué). Les cartes perso du Whiteboard ouvrent désormais
`WODDetail` et un WOD sans box accepte un score (`wod_scores.box_id` null, policy
`member_own_scores`) : badges, historique et compteurs comme un WOD de box, sans ELO ni
classement. `profiles.level` n'était modifiable nulle part : sélecteur « Niveau » (Scaled → Pro)
ajouté dans Profil → Modifier, cible du lien « modifier » ; la synchro par l'ELO reste. Copier
passe dans le menu ⋯. Vérifié en clair et sombre sous RLS réelle ; tsc/jest/lint verts.

**`movement_totals` refermée (migration `20261218`).** La vue recréée par `20261204` (un total par
unité) était repartie avec `GRANT ALL TO anon / authenticated` et sans `security_invoker`, annulant le
lot 5e : le volume de répétitions de tous les athlètes se lisait à la clé anon avec les droits du
propriétaire. `security_invoker = true` (chaque lecteur ne voit que ses `movement_logs`), `anon`
révoqué, `authenticated` en SELECT seul. `test-grants` 31/31 (T1 / T2 / T8 rouges avant, mutation
inverse vérifiée). **Appliquée en prod : oui** (dump horodaté dans la description de la PR).

**Écran Musculation — PR M2 (`athlex-app`, aucune migration).** Troisième discipline du
générateur (haltère, bleu `#3B82F6`) : Séance / Après ma classe, objectif Prise de muscle · Force ·
Tonification (Force grisée en Tronc, Après ma classe et Sans matériel), cibles ordonnées d'après le
genre du profil (Full body en tête sans genre, lien « modifier »), durées filtrées par
`availableDurations` (jamais de `budget_short` proposé), matériel Sans matériel · Box · Salle
persisté dans `user_generation_settings.last_params.muscu_equipment`, exclusions réutilisées, niveau
déduit de `profiles.level` (`muscuLevelFor` : Scaled → Débutant, Inter / RX → Intermédiaire, RX+ et
au-delà → Avancé), ligne 1RM (`personal_records`, clés `weightlifting_<Label>`) ou renvoi au
calculateur. Service `generateForUser` sur une union discriminée `ScreenParams` → `generateMuscu`
(1RM, poids du corps `personal_records._bodyweight_kg` — champ de profil temporaire, éditable dans
Profil → Modifier —, classe du jour). Page résultat : `MuscuSessionCard` (une ligne par exercice,
séries × reps, charge kg ou « RPE 7 (≈ 52 % du 1RM) », repos, note dépliable), durée estimée sans
plafond, minuteur libre (compte à rebours de la durée estimée, **pas de mode Split**), repos +
« Série suivante », saisie reps / kg réalisés → tonnage = Σ charge × reps en `score_type = 'weight'`,
badges crédités depuis les reps réalisées via `logMovementReps` (verrou `strengthJournalSeparation`,
jamais `strength_set_logs`). Quatre retouches moteur sans régénération des samples : bonus ≤ 1 tronc
hors cible Tronc et sans Mountain Climber / Vacuum / Russian Twist en Prise de muscle / Force
(isolation d'un muscle secondaire d'abord) ; piste box au niveau intermédiaire pour M5 ;
`weekly_cap` → isolation d'un autre muscle au lieu de raccourcir ; finishers « Marche » retirés
(respiratoires sur rameur / vélo seulement). Samples inchangés. **Appliquée en prod : sans objet**
(aucune migration).

**Repli Musculation avant M1 en prod — PR M2b (`athlex-app`, aucune migration).** Tant que la
migration `20261214` n'est pas appliquée, `movement_catalog` en prod n'a pas les colonnes muscu :
`loadEngineData()` acceptait ce catalogue (Functional / Hybrid valide) et l'écran Musculation
tournait sur un catalogue sans aucun exercice muscu. `withSnapshotMuscu()` greffe alors la part
Musculation du snapshot embarqué sur le catalogue distant (métadonnées muscu sur les mouvements
partagés, exercices muscu seuls ajoutés), source tracée `supabase+snapshot_muscu` ; les squelettes
suivaient déjà cette logique dans `bankFromRows`. Devient sans effet une fois M1 appliquée.
**Appliquée en prod : sans objet** (aucune migration).

**Archivage réversible d'une box — PR archivage ([`athlex-app` #311](https://github.com/nbstyle69/athlex-app/pull/311), migration `20261224`).**
`boxes.archived_at` / `archived_by` : une box archivée sort des annuaires, des recherches
et des listes, ses membres perdent l'accès, et le cron ne la génère plus — sans qu'aucune
ligne ne soit supprimée, `archived_at = NULL` la réveillant telle quelle. Le masquage passe
par une policy **RESTRICTIVE** et non par un filtre ajouté aux policies existantes : `boxes`
en porte sept, toutes PERMISSIVE, dont deux `USING (true)` ; les permissives se combinent par
OU, donc un filtre ajouté à l'une d'elles n'aurait rien refusé et il aurait fallu réécrire
les sept. Une restrictive se combine par ET : une ligne suffit, les sept ne bougent pas, et
le masquage couvre l'app mobile — annuaire, fiche de box, sélecteur de box du classement, qui
n'avait aucun filtre — **sans livrer de nouvelle version**. `FOR ALL` et pas `FOR SELECT` :
une restriction en lecture ne borne pas les policies d'écriture, et une box archivée ne doit
pas rester modifiable par son gérant. `service_role` contourne la RLS, donc le back-office
continue de la voir, ce qui est nécessaire pour la rouvrir. Les deux fonctions SECURITY
DEFINER qui listent des box (`get_my_admin_boxes()`, `get_user_box_ids()`) échappent à toute
policy et filtrent donc dans leur corps. `listEnabledBoxes` de `generate-box-week` tourne
aussi en service role : elle ajoute `archived_at is null`, avec repli si la colonne manque.
Contrôle `scripts/test-box-archivage.mjs` : 18 assertions sous de vraies identités (gérant,
membre, anonyme, service role), dont la **mutation inverse** — policy retirée, le membre
revoit la box archivée ; migration rejouée, il ne la voit plus — et la réactivation, qui rend
tout à l'identique. Les écrans sont côté Manager ([#341](https://github.com/nbstyle69/AthleX-Manager/pull/341)) :
archiver, réactiver, filtre « Archivées », et suppression définitive d'une box vide dont le
décompte porte sur les 35 tables en cascade. **Appliquée en prod : oui** (17/09/2026 20:44 UTC, dump `athlex-prod-public-20260917T204118Z.dump` dans `db-dumps/2026-09-17` ; après application : colonnes et index en place, policy RESTRICTIVE active sur `anon, authenticated`, les deux fonctions filtrées, **aucune box archivée** — 4 box, `archived_at` nul partout, et le gérant d'AthleX Fitness voit toujours sa box).

**Pilotage de la programmation automatique — PR J2 ([`AthleX-Manager` #338](https://github.com/nbstyle69/AthleX-Manager/pull/338), aucune migration ici).**
Les trois écrans qui manquaient à J1, côté Manager : ni le moteur, ni la fonction edge, ni le cron
ne sont touchés. `/admin/boxes` porte l'interrupteur par box (pistes Functional / Hybrid et
Musculation) et le réglage de révélation de `20261221`, via `PATCH /api/admin/boxes/[id]/auto-programming` —
rôle `admin` / `super_admin` revérifié, écriture en service role, refus du trigger
`boxes_auto_programming_guard` rendu tel quel plutôt que contourné. Le Whiteboard d'une box flaguée
gagne un bandeau (« générée le samedi 8h · visible par les athlètes *selon le réglage* ») avec
**Générer maintenant** (corps `{ box_id }`, désactivé quand chaque piste active a déjà sa semaine
suivante) et **Régénérer la semaine** (confirmation disant que les jours scorés ou édités sont
conservés, puis un appel par piste, agrégé) ; les deux passent par
`POST /api/box/[id]/auto-programming/run`, garde owner/coach explicite et `CRON_SECRET` côté
serveur, jamais depuis le client. Badges `AUTO` / `AUTO · modifiée` (`box_wods.source`,
`edited_at`) dans le Manager seul — le trigger marquant toute main humaine, un simple déplacement
de jour suffit à afficher « modifiée », ce qui est la promesse voulue : ce jour sera conservé.
`/admin/auto-programming` journalise en lecture seule les runs des 8 dernières semaines
(`cardinality(wod_ids)` pour le nombre de lignes). Écart E12 fermé : familles `machine` et `cable`
ajoutées à `CATALOG_FAMILIES` et à la validation de la route — les 55 exercices de musculation du
catalogue étaient inéditables — et colonnes muscu affichées en lecture seule.
`createServiceClient` n'a plus de repli sur la clé anon : un client « service » portant la clé anon
faisait passer une variable d'environnement absente pour un refus RLS. Le Manager garde le repli
`42703` de `20261221`, désormais appliquée en prod (17/09/2026) : la route enregistre interrupteur
et pistes, et le réglage de révélation est pris en compte. Le repli reste en place pour une base
antérieure à la migration ; le défaut montré (dimanche 18:00) est le comportement en vigueur. Reste ouvert : `CRON_SECRET` à
ajouter aux variables Vercel du Manager (sans elle les deux boutons rendent un 500 explicite, et
rien n'est appelé). Tests : 749 jest verts, `tsc` et `check:elo-writes` verts.
**Validation navigateur et captures non faites** : la pile jetable exige `psql`, absent de la
machine de développement. **Appliquée en prod : sans objet** (aucune migration dans ce lot).

**Programmation automatique AthleX Fitness — PR J1 (`athlex-app`, migrations `20261216` + `20261217`).**
Une box `auto_programming` reçoit chaque semaine ISO suivante, par piste (`auto_programming_tracks`
⊆ {`functional`, `musculation`}), ses séances posées dans `box_wods` (`source = 'auto'`, `audience = 'all'`,
`publish_at` dimanche 18:00 Paris). Piste Functional / Hybrid (clé interne `functional`, seed figé sur l’ancienne clé) : `generateSession` (`packages/wod-engine/src/session.ts`)
assemble six séances lundi → samedi autour de 60 min depuis six squelettes de séance
(`S1_snatch` … `S6_long`, exportés dans `wod_skeletons` en `discipline = 'session'`) : Block A haltéro /
force (%1RM, tempo), Block C tiré par `generateBlocC` avec le pattern lourd du jour interdit
(jamais relâché), squelette du jour précédent évité, plafonds Gym hebdo (150 tractions / 80 HSPU)
avec remplacement tracé `weekly_gym_cap`. Piste Musculation : `generateMuscuWeek` réutilise
`generateMuscu` (M1) sur cinq jours, objectif par cycle de six semaines ISO (Prise de muscle →
Tonification → Force, Tronc jamais en Force), bloc B par squelette (≠ A, pattern ≠ lourd de A, unique dans la
semaine), 26 finishers anti-répétition semaine + 4 semaines, progressions propres aux 7 skills S3, compteurs
P1–P3 et M1–M10 à zéro, ≤ 16 séries hebdo par muscle, `leaderboard_enabled = false`. Orchestration
pure dans `programming.ts` (`runWeekGeneration`) : seed = `box + piste + année + semaine +
regen_counter`, idempotence sur `box_auto_programming_runs` (`box_id, track, iso_year, iso_week`),
régénération qui garde les jours édités (`box_wods.edited_at`, trigger) ou scorés. Edge Function
`generate-box-week` (bundle ESM commité, `CRON_SECRET` fail-closed, catalogue et banque lus en
base avec snapshot en repli), **cron désactivé par défaut** (`docs/RUNBOOK_CRONS.md`). Flags de box
réservés admin / backend par trigger (message « Accès refusé : programmation automatique réservée à
un administrateur »), journal en lecture propriétaire seule. Tests §8 : `session.test.ts`,
`programming.test.ts`, `edge-bundle.test.ts`, suite serveur `scripts/test-auto-programming.mjs`
(27 contrôles, mutation inverse). **Migrations `20261216` + `20261217` appliquées en prod : oui** (16/09/2026 19:41 UTC, dump `20260916T194119Z` dans `db-dumps` ; `boxes.auto_programming` à `false` partout, `box_auto_programming_runs` vide, 887 `box_wods` toutes `manual`). **Premier appel prod (16/09/2026 20:26 UTC, AthleX Fitness, semaine 39) : piste musculation `done` (5 cartes), piste functional en `TypeError`** : le seed `20261217` datait d'avant les progressions A / B des skills S3 (a265d33), la prod lisait des options skill sans `progression`. Correctif : migration `20261219` (UPDATE des 6 squelettes `session` = snapshot, version 2, **appliquée en prod : oui**, 16/09/2026 22:41 UTC), `withSkillProgression` (repli sur le snapshot, erreur nommant le skill sinon), test `seed-sync.test.ts` qui rejoue les seeds SQL et les compare au snapshot pour séance, musculation, metcon et plafonds. **Révélation par box** (migration `20261221`, **appliquée en prod : oui**, 17/09/2026, fonction redéployée dans la foulée) : `boxes.auto_programming_reveal_mode` (`weekly` / `daily`), `_dow` (0 = dimanche) et `_time` (heure locale Paris) remplacent le dimanche 18:00 codé en dur ; `weekly` pose toutes les cartes au jour `dow` précédant le lundi ciblé (le lundi même si `dow = 1`), `daily` pose chaque carte le jour de sa séance ; défauts identiques au comportement J1, repli `42703` si les colonnes manquent. **Trois pistes** (migration `20261222`, **appliquée en prod : oui**, 17/09/2026 15:08 UTC, dump `20260917T150804Z` dans `db-dumps/2026-09-17` ; contraintes à `{functional, hybrid, musculation}`, 13 squelettes de séance avec leur piste, groupe renommé « Functional », aucune box modifiée). Banque Hybrid partagée élargie au passage, ce qui profite aussi au générateur athlète : `engine_negative_split` (30, 35 et 40 minutes, consigne d'accélération sur la seconde moitié) et durées de `engine_continuous` portées à 35 et 40. Sans cela le jeudi de la piste n'avait qu'une combinaison possible, et aucune durée n'existait entre 30 et 45 minutes : J1 avait livré deux pistes dont une nommée « Functional / Hybrid » ; Functional et Hybrid sont deux disciplines distinctes du générateur athlète, elles le deviennent dans la programmation de box, activables séparément (`{functional, hybrid, musculation}`). La piste Hybrid a ses sept squelettes de semaine (`H1_intervals` … `H6_simulation`, plus `H6_simulation_full` une semaine sur huit, seule séance à 75') ; son bloc de travail est tiré dans les dix squelettes `discipline = 'hybrid'` déjà en base, restreints par jour ; ses blocs A (stations `Every X'`, intervalles de course en rotation sur quatre semaines, enchaînement chronométré) vivent dans les squelettes. Règles testées sur 52 semaines : aucun haltéro technique ni gymnique avancé, bandes légère et moyenne sauf le sled du vendredi, ≥ 12 km de course ou d'erg par semaine, jeudi facile, plafond de 60 sauts, un mouvement fonctionnel par semaine, classement sur le seul bloc `wod`. Aucune box n'est migrée : AthleX Fitness garde `{functional, musculation}`. Ni Manager ni écran :
J2 / J3 attendent la relecture de `packages/wod-engine/samples-programmation.md`. **Pistes en onglets sur le Whiteboard** (migration `20261223`, **appliquée en prod : oui**, 17/09/2026 17:38 UTC, dump `20260917T173726Z` dans `db-dumps/2026-09-17` ; `UPDATE 52`, les 890 lignes `manual` inchangées, même empreinte md5 avant et après, fonction redéployée en version 5) : les trois programmations coexistent, visibles de tous, et l'athlète bascule par onglets **Functional · Hybrid · Musculation · Box · Tout**, posés sous les raccourcis et au-dessus du sélecteur de jours — la piste est un filtre global de la partie basse de l'écran, choisie avant le jour. `box_wods.track` (nullable, CHECK `{functional, hybrid, musculation}`, index partiel `(box_id, scheduled_date, track)` sur les seules lignes auto) porte la piste ; `null` n'est pas un défaut en attente mais la valeur des WODs saisis par un coach, qui forment l'onglet « Box ». `generate-box-week` l'écrit sur chaque ligne posée, avec repli `42703` / `PGRST204` à l'insertion — le repli est sur l'écriture, une lecture `select('*')` ne pouvant pas lever `42703`. Rétroactif par `auto_run_id` → `box_auto_programming_runs.track`, garde `source = 'auto'` : aucune ligne `manual` touchée. Onglets restreints aux pistes qui ont du contenu sur la semaine (requête à deux colonnes sur les sept jours, le chargement des cartes reste au jour) ; aucune piste → pas de barre et écran d'avant. Défaut Functional, choix mémorisé par box (`@athlex:whiteboardTrack:<box_id>`), repli Functional puis « Tout » si l'onglet mémorisé est vide. Puce identique à celle du générateur de WOD, teinte d'accent prise dans `HUES` et non dans les constantes d'écran : `#F97316` tombe à 2,1:1 sur carte claire, les deux thèmes sont mesurés au ratio WCAG. Nettoyage préalable : les 42 cartes auto de la semaine 38 sur AthleX Fitness (générées avec les trois pistes avant les onglets, aucune éditée ni scorée) supprimées le 17/09/2026 par les conditions de la régénération, runs repassées en `skipped` pour que la semaine reste regénérable ; semaines 39 et 40 intactes. Lot 2 (Manager) à suivre. **Déploiement de la fonction : `node scripts/deploy-edge.mjs generate-box-week`, jamais `supabase functions deploy` en direct** — la CLI collecte les sources depuis l'entrée, suit `@deno-types` et l'`import type` vers `packages/wod-engine/src/index.ts`, puis ouvre les spécificateurs de ce fichier sans ajouter `.ts` ; `src/bank` étant un répertoire, elle échoue en `EISDIR` avant même de téléverser le bundle. Le script déploie depuis une copie privée de ces deux lignes type-only, effacées à l'exécution : la fonction déployée est identique au dépôt, qui garde son type-check. `--check` refuse un import de **valeur** hors du dossier de la fonction (vraie dépendance, que le script ne peut pas retirer sans la casser) ; `src/__tests__/deployEdge.test.ts` le rejoue sur la source et sur deux mutations. Procédure dans `docs/RUNBOOK_CRONS.md`.
**Lot A — corrections du générateur après tests réels** (migrations `20261225`, `20261226`, `20261227`, **non appliquées en prod**, PR en attente de merge). A3 : la corde à sauter ne sortait jamais en Functional (0 sur 3 000 tirages) — cause : le plafond générique de volume, 100 reps en RX, le même pour un thruster et un double under ; correctif `FAMILY_CAP_FACTOR` (jump_rope × 4), plafond de classe qui REMPLACE le générique au lieu de s'y minimiser (les wall balls passent à 150 comme la table le disait), trois squelettes de plus ouverts à la corde, poids 10 (le haut de l'échelle 0–10 des poids de tirage, bornée par contrainte — 13 avait été retenu avant de le savoir), plafond de classe 200 reps ; 4,8 % d'apparition, arbitrage volume contre fréquence assumé. A1 : 55 exercices sans matériel (dos, biceps, trapèzes, avant-bras, coiffe étaient à zéro), colonne `priority_bodyweight` pour un ordre propre au mode, trois rangs de priorité en concurrence (puis dans tous les modes : `bench_press` sortait dans 100 % des séances Push), pénalité de répétition. A2 : anti-répétition hebdomadaire sur la piste box, relâchement tracé qui nomme l'exercice, sur les deux chemins de tirage. Tests réels G1–G5 : le format demandé était relâché en silence (budget de palier 200 quand il est explicite, relâchement affiché, table de faisabilité générée depuis la banque qui grise les combinaisons infaisables et retire EMOM / Chipper de Hybrid), titre qui dit sa troncature, « Durée » et non « Cap » sur les formats bornés, cadence par bande de charge (+5,9 % de travail estimé en Functional). Six squelettes jamais tirés et trois contrôles qui recopient le moteur : issue #313.
**Suite du lot A — relecture de l'échantillon et tests réels** (migration `20261228`, avec les trois du lot A ; à appliquer en prod AVANT le merge, l'OTA suivant chaque push sur master). S1 : une séance Push ne contient aucun tirage, une séance Pull aucune poussée — filtre sur le geste (`push_h`/`push_v` contre `pull_h`/`pull_v`) et non sur le muscle ; « Écartés à l'élastique » devient « Pull-apart à l'élastique » (tirage) ; conséquence assumée : les quatre isolations d'arrière d'épaule du catalogue (`face_pull`, `rear_delt_fly`, `bent_over_lateral_raise`, `rear_delt_machine`), toutes en `pull_h`, ne sortent plus en Push — sauf exception nominative (`REAR_DELT_PUSH_IDS`) : admises en rôle isolation uniquement, jamais en principal ni en secondaire, l'accessoire d'équilibre de fin de séance Push. S2 : les 55 ajouts sans matériel sont des replis en Box et en Salle (priorité 4 ou 5, `priority_bodyweight` inchangée) ; la priorité ne jouait que sur le slot principal, ils entraient par les slots accessoires au poids de tirage — désormais un poids du corps de priorité 4–5 ne sort en Box / Salle qu'après toute l'échelle de relâchement. S3 : M5 se compte mollets compris et la place unique est réservée quand un muscle de la cible n'a rien de chargé (mollets en box) — sur la piste box, 52 semaines sans un jour à deux poids du corps hors tronc. S4 : libellé « charge élastique ». E1 : en Force, un mouvement en bande lourde fait 3 à 5 reps par station sur EMOM, intervalles et stations, quelle que soit la cadence (7 front squats lourds dans la minute ne sortent plus) ; les formats relâchés (rounds for time, death by) ne sont pas des stations et gardent leur logique. E2 : le relâchement de durée est annoncé comme celui du format (« Demandé 20 min, généré 24 min »). Mémoire des tirages Musculation : lot B.
**`generate-box-week` accepte `tracks`** (PR séparée, empilée sur le lot A) : tableau parmi `functional | hybrid | musculation`, intersecté avec les pistes actives de la box, valable aussi en régénération ; absent = toutes les pistes actives, inchangé ; une ligne de journal par piste traitée. Prérequis du lot 2 Manager (un appel par piste cochée). Redéploiement par `node scripts/deploy-edge.mjs generate-box-week` après merge.

**Générateur Musculation V1 — PR M1 (`athlex-app`, migrations `20261214` + `20261215`).**
Troisième discipline du moteur (`packages/wod-engine/src/muscu.ts`, `generateMuscu`, RNG à
graine, aucun réseau) : 13 cibles × 3 objectifs (hypertrophie / force / endurance) = 39
squelettes `strength_session` embarqués et exportés dans `wod_skeletons`
(`discipline = 'musculation'`, repli hors ligne comme le metcon). Le catalogue reçoit les 178
exercices du CSV Musculation v1 (173 + 5 variantes faciles sans matériel : Incline / Wall
Push-Ups, Bird Dog, Reverse Lunge sans charge, Squat Hold ; Glute Bridge ouvert à l'hypertrophie) en colonnes sur `movement_catalog` (familles `machine` /
`cable`, muscles, `level_min`, `load_mode`, `rm_reference` / `rm_factor`, cadences, plages par
objectif, poids `none` / `box` / `gym`) : 18 exercices déjà présents (13 annoncés + 5 alignés
par nom, écart signalé) gardent leur ligne, 160 sont créés avec poids metcon à 0, les 14
legacy inactifs le restent. Charges : 1RM du calculateur (`profiles.personal_records`, passés
en paramètre) × facteur × % de l'objectif arrondi à 2,5 kg, sinon RPE 7 / 8 ; lest des tractions /
dips en Force = 10 % de `bodyweight_kg` arrondi à 2,5 kg, sinon « lesté léger » ; Après ma classe
exclut les muscles du WOD du jour et interdit Force ; débutant sans unilatéral ni lesté, 4
exercices max ; jamais deux exercices consécutifs sur le même muscle ; règles M1–M10 de relecture : `priority` (1-5) et `movement_group` au catalogue, exercice principal par priorité, un seul exercice par geste, ≤ 2 lourds en Force (3e compound rétrogradé 70-75 % × 6-8), Pull / Dos avec tirage vertical + horizontal, ≤ 1 poids du corps hors tronc en box / salle, tractions remplacées en Tonification, remplissage sans repos ni 5 × 20, Tronc sans Force ni compound jambes (15 · 20 · 30'), libellés Prise de muscle / Force / Tonification et « RPE 7 (≈ 52 % du 1RM) », Hip Thrust obligatoire en Fessiers + ischios ; compteurs M1–M10 à zéro en conformité ; durée ±10 % (trop long :
slots optionnels → séries → squelette ; trop court : reps → une série de plus (≤ 5) → exercice
optionnel sur un muscle secondaire de la cible → tempo 3-1-1 compté dans la durée → repos → 5e
exercice optionnel en débutant, `budget_short` tracé sur 0,17 % des tirages, tous débutant 60') ; signature `musculation|<squelette>|<exercices>` sur les 10
dernières. Grammaire `strength` étendue (`s`, `m`, `/ jambe`, `/ bras`, `/ côté`) rétro-compatible.
Tests §7 : 1 152 combinaisons × 200 graines (230 400 séances) sans échec, 1RM connu / inconnu, fixture
Back Squat + Thrusters. **Migrations `20261214` + `20261215` appliquées en prod : oui** (16/09/2026
19:41 UTC, après « 1.0.54 installé », dump `20260916T194119Z` dans `db-dumps` : `movement_catalog`
269 lignes dont 179 `discipline_muscu`, `wod_skeletons` 15 / 10 / 39 / 6, générateur Functional,
Hybrid et Musculation vérifié par Nab dans l'app 1.0.54). **Écart révélé par `seed-sync.test.ts` le 16/09/2026 : le seed `20261215` (c2f88b1) est antérieur aux règles M1–M10 (91b3854 : `groups`, `pair`, listes `ids`) et à M2, la prod lisait donc 39 squelettes musculation jamais testés** ; migration `20261220` (UPDATE des 39 squelettes = snapshot, `MUSCU_BANK_VERSION` 2, **appliquée en prod : oui**, 16/09/2026 22:41 UTC). Aucun écran : M2 attend la relecture de
`packages/wod-engine/samples-musculation.md`. Dépendances tranchées pour M2 : badges
Musculation crédités depuis les séries réalisées saisies par l'athlète (`logMovementReps`,
reps × séries par mouvement, verrou `strengthJournalSeparation`, jamais depuis
`strength_set_logs`) ; mode Split du minuteur vidéo (`SeqBlock.type = 'split'`, chrono global,
« Série terminée » → split + compte à rebours `rest_s`, exercice suivant quand ses séries sont
faites, liste des splits en fin de séance, réutilisable pour splitter un metcon par round ;
`wod_json` porte déjà `sets` et `rest_s`) ; `bodyweight_kg`, genre et niveau en champs de profil.

**Générateur de WOD v1 — PR 3 (`AthleX-Manager` + migration `20261213` ici).** Le Manager lit
`movement_catalog` à la place de son tableau statique `lib/movements.ts` (snapshot embarqué en
repli, les 14 mouvements `active = false` restent proposés aux coachs, seul le générateur les
ignore) ; l'admin Mouvements gagne un onglet Catalogue (édition, réactivation, création) et une
page sœur `/admin/volume-caps` (19 plafonds éditables, squelettes en lecture seule), écriture
par routes serveur `service_role` gardées par le rôle admin. `box_wods.wod_json jsonb`
(migration `20261213`, **appliquée en prod : oui**, 15/09/2026, `pg_dump` `20260915T230607Z`
déposé avant dans `db-dumps`, 886 WODs intacts, écriture par le Manager déployé vérifiée sur
AthleX Fitness) reçoit le WOD structuré à chaque création / modification depuis l'éditeur,
derrière un garde `42703` / `PGRST204` à retirer dans un lot ultérieur ; `description` reste
la source de vérité côté athlète.

**Désabonnement d'une programmation Marketplace (`athlex-app`, migration `20261210`).**
Aucun désabonnement n'existait. RPC `unsubscribe_programming(p_subscription_id,
p_remove_future)` SECURITY DEFINER, gardée par `is_box_owner_admin` de la box abonnée :
gratuit → statut `canceled` immédiat (ignoré par `materialize_box_programming`), `color`
conservée pour un réabonnement (`subscribe_free_programming` réactive la même ligne) ;
payant → demande mémorisée (`cancel_requested_at`, `remove_future_on_cancel`), conclue par
le backend au webhook Stripe de fin de période. Les cartes reçues futures ne partent qu'à
partir du lundi suivant (Paris) et seulement si demandé ; le passé et la semaine en cours
restent toujours (scores, ELO). Suite `desabonnement-programmation` (31 assertions, JWT
réels, garde validée par mutation inverse). **Migration appliquée en prod** (10/09/2026, dump avant).
Le Manager (#329) suit : lien « Se désabonner », confirmation, `cancel_at_period_end`.

**Marketplace ↔ Whiteboard — PR 1/2 (`athlex-app`, migration `20261209`).** Constat de
recon : l'offre publiée « ATHX BLOC 2 Building » (RAW) comptait 0 WOD, le contenu était
dans une semaine type privée, et le cron du dimanche visait toujours la semaine 2 — le
Whiteboard de NBS2 restait vide. Le serveur porte maintenant : une visibilité explicite
`box_wods.audience` (`all` / `groups` / `none`, défaut `all` pour ne pas imposer de build
store au back-office mobile ; triggers de cohérence avec `wod_group_access` ; la branche
programme de `wod_access_allowed` est conservée) ; un ancrage d'abonnement déterministe
(lundi suivant au gratuit, recalé par la pose manuelle) ; une pose automatique gardée à
18 h Paris et journalisée (`box_programming_runs`, `empty_week` quand l'offre est vide) ;
les cartes reçues d'une autre box verrouillées en contenu mais déplaçables et supprimables ;
le remplissage d'une offre depuis le Whiteboard ou une semaine type (`sync_wod_to_offer`,
`copy_week_to_offer`, provenance `origin_box_wod_id`, propagation des retouches maison sans
toucher aux snapshots des abonnés) ; `publish_programming` refuse une offre sans objectif,
sans public ou avec une semaine vide. Suite `marketplace-whiteboard` (71 assertions, JWT
réels). **Migration non appliquée en prod** (dump logique à faire avant ; elle recale
l'ancrage NBS2 au 14 septembre, voulu). Le choix explicite d'audience côté back-office
mobile ira dans le prochain build store. PR 2 (`AthleX-Manager`) suit.

**Séances de programme athlète relatives (semaine × jour) — lot a/c.** Une séance de
programme payant (« Prog Muscu — 13 semaines · 5j/sem ») n'a plus de date : elle a une
position (`program_week`, `program_day`) sur `box_wods`, exclusive de `scheduled_date` par
contrainte de base. Le Whiteboard de la box lit toujours par date : une séance de programme
n'y entre jamais, et un WOD de box n'est jamais requalifié en séance de programme (13 tests
`programSchedule`). L'athlète abonné la reçoit le jour où elle tombe pour lui, à partir de
SA date de début, en plus des blocs de la box. **Migration `20261207` non appliquée en
prod** (dump logique à faire avant) ; la page « Séances » du Manager et l'import PDF qui
écrivent ce format arrivent dans deux PR séparées côté `AthleX-Manager`. **Rien n'est
constaté à l'écran** : la ligne ne monte qu'après validation de Nab sur la preview et une
séance réelle vue dans l'app.

**Offre Essai (tunnel d'acquisition de prospects).** Le socle serveur est en production
depuis le 24 août, et il y est constaté sur la vraie base : le type d'offre « Essai » est
accepté à 0 €, refusé à 30 € ; une réservation sans adhérent et sans prospect est refusée ;
la table des prospects est fermée à la clé publique, en lecture comme en écriture.

**Les écrans sont écrits et livrés côté web** (le 4e type d'offre « Essai », le bouton et le
calendrier public sur la page de la box, les prospects sans compte dans Prospects, la
mention « Essai » en liste de présence, l'e-mail de confirmation, et l'essai qui ne compte
plus comme un adhérent actif dans les statistiques).

**Le chemin heureux est constaté en production le 30 août**, au clic et sur la vraie base :
offre Essai créée sur Crossfit NBS2, réservation anonyme sur le cours du dimanche 10:00, le
créneau passe de 15 à 14 places restantes, la réservation est écrite en `confirmed` (jamais
en liste d'attente), le même e-mail sur le même cours est refusé par son message nommé, le
prospect apparaît dans Prospects et en liste de présence, et le pointage « présent » le fait
passer à « venu ». Cette ligne monte donc dans « En production ».

**Le récapitulatif hebdomadaire est corrigé et appliqué à la production le 30 août**, avec
la mesure qui distingue : sur Crossfit NBS2, la seule présence pointée de la semaine est un
essai, et le récapitulatif affiche désormais 0 présence d'adhérent et 2 essais réservés —
avant l'application, cette même semaine aurait affiché 1 présence d'adhérent qui n'existe
pas. Le pipeline de relance historique refuse explicitement les essais au lieu de tenir par
accident de schéma.

**Ce qui bloque :** rien.

**Ce qui n'est pas constaté, et je ne le compte pas :** le refus d'un cours complet en
production (le provoquer demanderait de remplir un vrai cours ou d'en créer un factice sur
le planning), les plafonds anti-abus par IP et par e-mail sur la vraie base, et la réception
effective de l'e-mail de confirmation — seule la phrase affichée à l'écran est constatée.

**Une limite nommée plutôt que supposée :** le plafond par adresse e-mail est tenu par la
base (donc prouvable). Le plafond par adresse Internet du visiteur sera tenu par le site
web : la base n'a pas accès à cette information, et une limite supposée n'est pas une
limite.

**Phase 1 design, deuxième passe mobile (Notifications, détail tournoi, minuteur).** Les
défauts sont mesurés, pas supposés : blanc sur la surface du bouton d'appel à l'action à
1,23:1 en clair, l'accent employé en texte sur une carte blanche à 2,56:1, la couleur de la
carte prise pour encre sur un aplat d'accent, l'heure de rappel réduite à 2,06:1 par une
opacité posée sur tout le conteneur, et deux teintes de domaine pensées pour le sombre
posées sur une carte claire (2,17:1 et 2,23:1). Deux cas sont ajoutés au contrôle mécanique
et échouent sur l'état d'avant. **Ce n'est pas constaté à l'écran** : la lisibilité se
prouve à l'œil, sur un vrai appareil, dans les deux thèmes — la ligne ne montera qu'après
ce constat, et après un binaire qui porte le correctif.

**Coque de verre étendue aux écrans denses (21 écrans).** Les 18 écrans de back-office,
les préférences de notification, le détail de programme et la carte des box posaient leur
fond à plat — blanc pur en mode clair — pendant que l'accueil, Ma Box et le Compte
montaient le dégradé argenté. Une mesure a contredit une justification déjà écrite dans le
code : le contrôle interdisait le verre sur Notifications au motif que l'encre atténuée n'y
tient pas 4,5:1, ce qui est vrai **à même le dégradé** et faux **sur une carte** posée
dessus (4,89 à 5,25:1 en clair). Le même contrôle, réécrit sur la règle réelle, a trouvé un
défaut **déjà en production** sur l'accueil et Ma Box : sur le troisième arrêt émeraude,
l'encre atténuée sur carte tombait à 3,03:1 — l'arrêt est assombri, elle remonte à 4,85:1.
Deux appels à l'action du Compte écrivaient la couleur du fond sur la surface translucide
du bouton (1,23:1). **Ce n'est pas constaté à l'écran** : la coque et l'encre se prouvent à
l'œil, dans les deux thèmes, et la ligne ne montera qu'après ce constat.

**Phase 1 design, troisième passe : les deux écrans que la charte n'avait pas atteints
(détail tournoi, minuteur).** Le détail tournoi montait déjà la coque, mais son en-tête
était un dégradé bleu-noir écrit en dur, orphelin de la charte, et ses trois pastilles
(inscrit, complet, prix) prenaient leurs teintes au thème **clair** alors que l'en-tête est
sombre dans les deux thèmes : 3,12:1, 3,55:1 et 3,48:1 mesurés sur son arrêt le plus clair.
Les arrêts viennent maintenant de la famille du dégradé de la coque, et l'encre des
pastilles du thème sombre (6,76:1, 6,19:1, 12,22:1). L'en-tête **reste** un panneau sombre :
son encre blanche y est mesurée haut (titre 17,14:1, métadonnées 7,82:1, glyphes 5,15:1), ce
qu'une carte translucide posée sous le blob du coin haut-gauche ne garantit pas.
L'écran de réglage du minuteur, lui, était resté hors de toutes les passes : blanc en dur
sur l'aplat d'accent (2,56:1), blanc sur l'appel à l'action translucide (1,23:1), libellé et
poignée de modale en blanc translucide sur fond clair (1,05:1 et 1,00:1), et l'accent
employé onze fois comme encre ou glyphe (2,46:1 sur carte). Le minuteur **en course** n'est
pas touché : son fond est choisi par l'athlète. Neuf contrôles mécaniques ajoutés, qui échouent tous sur
l'état d'avant. **Ce n'est pas constaté à l'écran** : la ligne ne montera qu'après le
constat dans les deux thèmes.

**Build de soumission 1.0.51 (47) et vérification de l'artefact réel.** Le binaire iOS de
soumission est produit par EAS depuis `master` et **téléversé** sur App Store Connect ; son
traitement par Apple n'est pas constaté (voir résiduels). Ce qui est constaté, c'est
l'artefact lui-même, pas ce que la machine locale sait bundler : l'IPA publié par EAS est
téléchargé, ouvert, et son JS embarqué lu — 17 assertions vraies sur 17
(`npm run verify:ipa`). Le contrôle est **discriminant**, et c'est ce qui le rend
utilisable : rejoué sur l'IPA du build 43, il tombe à 10/17 et nomme exactement les cinq
défauts de la fenêtre d'avant-OTA — la RPC `get_my_profile` absente du bundle et les trois
colonnes révoquées encore demandées dans des listes de colonnes. Le bytecode Hermes ne
contient plus de source : les assertions portent sur sa table de chaînes (nom de RPC,
messages d'erreur de la branche, listes de colonnes littérales), et le nombre de listes
lisibles est compté avant de conclure à une absence. La clé Supabase embarquée est décodée
sans être affichée : rôle `anon`, même référence de projet que l'URL embarquée.

**Caméra avant couchée et zoomée sur iPhone 17 Pro Max (minuteur vidéo, bascule selfie).**
Constaté par Nab en vidéo sur le 17 Pro Max (iOS 26.6.1), absent sur le 16 Pro (26.6) : même
OS, comportement différent, donc montage du capteur et non version d'iOS. Cause lue dans le
module natif : deux tables en dur (orientation de l'appareil → angle, avec les valeurs
paysage inversées pour la face avant) qui encodaient le montage des iPhones ≤ 16 ; le
nouveau capteur avant du 17 livre une autre orientation native, l'image prend 90° de trop
et `resizeAspectFill` la zoome pour remplir le portrait. Le même angle était posé sur la
sortie vidéo : le fichier enregistré en selfie était couché aussi. Correctif : les tables
sont supprimées, l'angle est **demandé à iOS** (`AVCaptureDevice.RotationCoordinator`,
preview et capture séparées, coordinator recréé à chaque changement de caméra, gel pendant
l'enregistrement conservé) ; la géométrie du writer (1080×1920 / 1920×1080) se déduit de
l'angle réellement appliqué, plus de `UIDeviceOrientation` seul. Un contrôle mécanique
échoue si une table réapparaît dans le fichier Swift. **Non constaté sur appareil** : c'est
natif, il faut un nouveau build — le correctif part dans **1.0.52 (49)** ; **1.0.51 (47) et
(48) : non soumis, obsolètes** (le 48 embarquait le correctif mais sous le runtime 1.0.51,
que les appareils déjà installés partagent : un changement natif impose une nouvelle
version, donc un nouveau runtime OTA, `runtimeVersion.policy = appVersion`). Un journal de
diagnostic derrière un flag affiche nom du device, angle preview et angle capture pour
comparer les deux téléphones, et une liste de 16 cas à cliquer (2 téléphones ×
avant/arrière × portrait/paysage) est dans la PR. **Constaté par Nab (revue 1.0.52, C4) :
les 16 cas passent.** Suite : `orientationDebugLog` repassé à `false`, et la géométrie du
writer suit désormais l'angle **relu** sur `conn.videoRotationAngle` après affectation (un
angle non supporté n'est pas appliqué en silence) plutôt que l'angle demandé ; le log
affiche les deux (`captureAngle` demandé, `appliedAngle` relu). Le chemin
iOS < 17 (cible 15.1) est gardé sous sa forme standard, non vérifié : aucun appareil sous
iOS 17 dans le parc.

**WOD GEN retiré de l'app par un interrupteur, pas supprimé.** La carte « WOD GEN — 3
séances adaptées à ton profil » des Outils de l'accueil (route `WODGenPro`) était le seul
point d'accès ; `FEATURES.wodGen = false` (`src/lib/features.ts`) la masque. L'écran, la
route, l'écran de suggestions et les services restent dans le code, inchangés. Le contrôle
prouve les deux sens : la carte absente à `false`, présente à `true` à sa place historique ;
et qu'aucun autre fichier (Explorer, recherche, deep link, notifications) ne mène à la route.
Le premier générateur (« Générateur WOD — For Time · AMRAP · Tabata ») reste.

**Onglet gérant « Dashboard » → « Suivi », à merger après la soumission Apple.** Le premier
des 6 onglets de la barre gérant était tronqué ; libellé seulement, via i18n
(`tabs.boTracking` : « Suivi » / « Tracking »), route `BODashboard` et écran `Dashboard`
inchangés. Les cinq autres libellés restent en dur comme avant. Test `boTabTrackingLabel.test.ts`
(mutation inverse : `tabBarLabel: 'Dashboard'` rétabli est rouge).



**Bloc « Abonnement AthleX » du profil gérant (#241), à merger après la soumission Apple.**
Chemin : barre gérant → onglet **Profil** → onglet interne **Compte** (4e) → carte après
« Mes amis », avant « Mes entraînements ». Il n'apparaissait que sous
`isOwnerAdmin && currentBox`, et la lecture de `owner_subscriptions` exigeait aussi une box
courante : un gérant sans box courante ne le voyait pas. Désormais visible pour tout gérant
(`boxRole === 'owner'` ou `role === 'box_owner'`) ; avec abonnement (box ou Multi actif) :
formule + statut + « Gérer » ; sans : « Aucun abonnement actif » + « S'abonner ». Les deux
états ouvrent `BOSubscription`. Test `profileAthlexSubscriptionBlock.test.ts` (position,
condition, deux états ; mutation inverse : le `&& currentBox` rétabli est rouge). Non fait :
un compte `admin`/`super_admin` voit `AdminScreen` à la place du Profil (`navigation/index.tsx`),
donc jamais ce bloc — dit, non changé.

**Historique unifié « Mes entraînements » (`WodHistory`), à merger après la soumission
Apple.** Recon : l'écran ne lisait que `generated_wods` + `generated_wod_scores` ; les scores
saisis sur les WOD de box (`wod_scores`) et les WOD marqués « réalisés » par le bouton du
bloc (`wod_completions`) n'y étaient pas. Désormais trois lectures (toutes `member_id` /
`user_id` = soi), fusionnées côté client (`src/lib/wodHistoryEntries.ts`) en une seule liste
chronologique : une ligne de box ouvre `WODDetail`, porte le score ou la mention « Réalisé,
sans score » ; un score sur un WOD déjà marqué réalisé remplace la ligne « réalisé » (le
détail supprime d'ailleurs la completion à la saisie du score). Les filtres Favoris /
Benchmark restent propres aux WOD générés. Limite assumée : les policies serveur
(`box_members_see_scores`, `box_member_see_completions`) ne rendent lisibles que les lignes
des box dont on est encore membre actif. **Séances du minuteur : rien n'est persisté**
(`TimerRunScreen` ne garde que les options d'affichage en AsyncStorage, aucune table) ;
les inclure demande une table + RLS, chantier à part, non fait ici. Test
`wodHistoryUnified.test.ts` : un WOD réalisé sans score apparaît ; mutation inverse (sans
`wod_completions`) il disparaît.

**Analyse de PDF de plus de 100 pages.** Cause établie le 24 août : le prestataire d'IA
refuse au-delà de 100 pages, et le message affiché dit « service indisponible » alors que le
service a répondu. Le correctif (compter les pages avant l'envoi, dire la vraie cause) est
écrit nulle part encore — chantier séparé, non planifié dans la fournée.

**Importateur PDF de programmation par profil de source (TheHub).** Le socle base est posé
par la migration `20261203_box_wods_source_pdf.sql` : trois colonnes nullables sur
`box_wods` (`source_pdf_url`, `source_page`, `source_profile`) et un bucket privé
`wod-sources` (PDF rangé par box, lecture et écriture réservées au staff de la box par
`is_box_staff`). Aucun écran ne les lit encore ; l'app n'est pas concernée. Le cœur
d'analyse (profil « K+ Perf » puis profil générique par IA), la preview et l'insertion en
lot arrivent dans une PR TheHub séparée, à merger après celle-ci.

**Cardio dans « Créer un WOD » — étape 1, compteurs par unité.** Recon : le crédit de badges
est calculé entièrement côté app (`parseMovementLine` → `logMovementReps` → RPC
`increment_movement_stats`), sans trigger ni edge function, et les trois tables de compteurs
(`movement_logs`, `user_movement_stats`, `movement_rep_counts`) portaient un seul entier par
mouvement : un « 20 cal Row » s'ajoutait aux reps, un « 500m Run » valait 1. La migration
`20261204_movement_stats_unit.sql` ajoute `unit` (`reps` par défaut, `m`, `cal`) aux trois
tables, étend PK / UNIQUE avec l'unité, regroupe la vue `movement_totals` par unité et
ajoute une surcharge `increment_movement_stats(…, p_unit)` — l'ancienne signature reste en
wrapper vers `reps`, l'app en place ne change pas de comportement. Les badges
`mv_row/bike/ski_*` existants sont requalifiés en calories (clés et libellés conservés) ;
`20261204_badges_cardio_paliers.sql` ajoute les paliers en mètres (`mv_row_m_*`,
`mv_bike_m_*`, `mv_ski_m_*`), les compléments en calories et le nouveau préfixe `mv_run_*`
(42 195 m = « Marathon »). Compteurs cardio à zéro en prod : aucune donnée à migrer. Suite :
PR app (parseurs avec unité et choix ♂/♀, bloc `~` cardio, badges par unité, méta-badges sur
`reps` seulement), puis PR TheHub (catalogue `unit`, bloc Cardio, charge libre des lignes force).

**Cardio — étape 2, l'app lit et crédite par unité.** `parseMovementLine` porte désormais
l'unité : `20 cal Row` → 20 cal, `500 m Run` / `400m Course` → des mètres (plus « 1 rep »),
une ligne sans unité reste des reps à l'identique. Les splits `20/15 cal Row`, `21/15 Pull-ups`
et `(43/30 kg)` choisissent la valeur ♀ quand le profil est féminin (`user.gender` passé par
tous les écrans qui créditent ; le back-office, qui ne lit pas le genre d'un autre athlète,
crédite en ♂). Nouveau bloc cardio `src/utils/cardioBlock.ts` (`Row ~ 2 × 500 m ~ 250 W ~
repos 2:00`, cible watts OU allure, RPE), crédité `séries × qté` sans multiplication par les
rounds, affiché réécrit dans le détail de WOD / programme. `logMovementReps` écrit `unit` dans
`movement_logs`, appelle la surcharge `increment_movement_stats(…, p_unit)` et cumule les
badges par `(mouvement, unité)` : `mv_row/bike/ski` = calories, `mv_row_m/bike_m/ski_m/run`
= mètres, une rep de Row ne donne rien ; `mv_polyvalent_*` et `mv_total_*` ne lisent que
`reps`. Lignes force : segment libre `charge <texte>` (`RPE 8`, `RM du jour`) sérialisé,
relu, affiché, et jamais pris pour un mouvement metcon. Dépend de la migration étape 1
(colonne `unit`, surcharge RPC) — à merger après elle. Suite : PR TheHub.

**Cardio — étape 2 bis, défaut d'unité et genre côté owner.** Une ligne sans unité sur un
mouvement cardio prend l'unité par défaut du catalogue (`MOVEMENT_CATALOG.unit`, résolu via
la clé `normalizeMovement` : `20 Row` / `20 rameur` → 20 cal, `800 Run` / `400 Course` →
800 / 400 m, `500m Ski` = `500 m Ski`) ; tout autre mouvement reste en reps. Même règle et
mêmes cas de test côté TheHub (#322). La validation d'un score au back-office
(`BOTournamentScreen`) lit le genre de l'athlète via `get_athlete_private_profile` et crédite
la valeur ♀ ou ♂ du split ; genre absent → ♂ avec mention explicite dans l'alerte.

**Catalogue haltéro élargi + libellés Assault Bike.** Douze mouvements ajoutés au
`MOVEMENT_CATALOG` en `unit: 'reps'` (Snatch Balance, Snatch High Pull, Clean Pull, Tall
Clean, Power Jerk, Split Jerk, Back Rack Split Jerk, Strict Press, DB Strict Press, Bench
Press, Zercher Squat, Wall Walk), avec clés canoniques et alias dans `normalizeMovement`
(`bench`, `shoulder press`, `WW`, `jerk`, `snatch pull`…). Les variantes d'une famille
existante créditent les compteurs et badges de la famille (`mv_clean`, `mv_press`,
`mv_squat`, `mv_wallwalk`) ; cinq nouvelles clés (`bench_press`, `snatch_balance`,
`snatch_high_pull`, `clean_pull`, `db_strict_press`) reçoivent les paliers du schéma
existant (100/500/1000/5000 barre, 100/500/1000 DB), aucun palier nouveau. Migration
`20261205_badges_haltero_catalogue.sql` : renomme les badges mètres du bike en « Assault
Bike 25K / Centurion / Légende » (mise à jour sur place, pas de nouveau seed) et ajoute
les 19 badges ci-dessus. Miroir catalogue + synonymes d'import PDF côté TheHub.

**Strict Press, clé propre.** `strict press` / `shoulder press` / `military press` ne créditent
plus la famille `press` (Push Press / Push Jerk / S2OH) mais une clé `strict_press` avec ses
badges `mv_strict_press_100/500/1000/5000` (schéma barre, migration
`20261206_badges_strict_press.sql`). Wall Walk reste sa propre clé (`mv_wallwalk`) ; Tall
Clean → Clean, Jerks → famille `press` (où vit `push jerk`), Zercher → Squat, validés.

---

## À venir, dans l'ordre

L'ordre est décidé ; il ne se réarbitre pas au fil de l'eau.

1. **Offre Essai** — le tunnel d'acquisition décrit ci-dessus (web uniquement).
2. **Phase 1 design** — terminée côté mobile ; reste la même passe côté web.
3. **Build + soumission Apple** — un binaire qui porte les correctifs de la fournée, puis
   soumission.
4. **Phase 2 design** — les trois graphies du même noir en mode clair web, le doré résiduel
   (17 occurrences web, 25 mobile), et le balayage des 56 fichiers avec le contrôle qui
   refuse une couleur décorative écrite en dur.

---

## Backlog à déclencheur

Ces chantiers ne se font pas « quand on aura le temps ». Chacun attend une condition
précise ; le faire avant casse quelque chose. Le détail technique est dans
[`BACKLOG_INFRA.md`](./BACKLOG_INFRA.md).

| Chantier | Déclencheur |
| --- | --- |
| Contrôler en CI que l'en-tête « Appliquée en prod » de chaque fichier de `supabase/migrations/` dit vrai. Pour un fichier qui déclare **oui**, vérifier en base qu'un marqueur de son effet existe (colonne, contrainte ou ligne de seed) ; pour un fichier qui déclare **non**, vérifier que cet effet est absent. Rouge dans les deux sens : un fichier qui dit oui sans effet constaté, ou qui dit non alors que l'effet est là. L'en-tête est la seule trace dans le dépôt de ce qui est réellement en base, et le 17/09/2026 quatre migrations appliquées disaient encore non. | Le prochain lot qui touche `.github/workflows/grants-prod.yml` ou `scripts/audit-grants-prod.mjs` : l'audit a déjà les accès base en lecture seule, et rouvrir ces fichiers pour ce seul contrôle coûterait plus qu'il ne rapporte. |
| Restreindre la clé Google « Maps Platform API Key » du 15 juin (33 API, aucune restriction d'application) : recon de ses usages (site web, annuaire des box), puis restriction aux domaines `athlexapp.eu` et aux seules API nécessaires, faite par Nab dans la console Google Cloud sur indications | Dès que le build Android 1.0.53 (50) embarque la clé restreinte `GOOGLE_MAPS_ANDROID_API_KEY` (preuve `verify:aab`) : l'ancienne clé n'est alors plus lue par aucun binaire mobile et peut être fermée sans casser la carte |
| Renommer le projet Vercel `the-hub` → `athlex-manager` | Quand plus aucun lien vivant ne pointe sur `the-hub-rho.vercel.app` : parc mobile à jour, webhooks Stripe migrés, invitations déjà envoyées expirées. Renommer avant transforme des liens vivants en 404 sans trace. |
| Renommer l'identifiant Expo (« slug ») du projet mobile | Quand un build est prêt à repartir de zéro côté stores : le slug est inscrit dans les builds déjà distribués. |
| Relier les formats de tournoi au plan payé (`plan_tier`) | Quand la grille tarifaire des formats est arrêtée. Aujourd'hui les formats verrouillés affichent « Contacte-nous pour l'activer ». |
| Traduction anglaise des CGU | Quand un premier client hors France signe. Les CGU sont un contrat de droit français ; la version FR reste la version qui engage. |
| Langue rendue côté serveur | Quand le référencement en anglais devient un objectif. Aujourd'hui la langue est choisie dans le navigateur, ce qui suffit à l'usage mais pas aux moteurs de recherche. |
| Gamification en événements (event-sourcing) | Quand un badge devra être recalculé après coup, ou quand une contestation exigera de rejouer l'historique. |
| Dette de vocabulaire `member` / `athlete` | Quand une table ou une API devra être ouverte à l'extérieur. Les deux mots désignent la même personne dans le code, ce qui se paie à chaque relecture. |
| Provenance des encaissements au comptoir | Quand un gérant devra justifier un chiffre auprès de son comptable : le journal existe et compte juste, mais il ne dit pas encore qui a saisi la ligne ni sur quelle pièce. |
| Bouton d'offre payante resté en français dans l'interface anglaise (« S'abonner — 59.00 €/month ») | Le prochain lot web qui touche la page publique de box. Un bouton mi-français mi-anglais sur une page de vente se corrige vite, mais pas en urgence. |
| WOD GEN retiré de l'app (flag), à retravailler | Quand le contenu des « 3 séances adaptées à ton profil » sera revu : remettre `FEATURES.wodGen` à `true` suffit, l'écran et la route n'ont pas bougé. |
| Soumission automatique sur Google Play | Quand une clé de compte de service Google Play est fournie. Aujourd'hui le fichier Android est produit signé, et téléversé à la main. |
| Aligner les 18 routes Stripe du web encore épinglées sur l'API `2023-10-16` (Connect, checkouts, portail, dunning…) sur la version du compte (`2026-03-25.dahlia`, déjà en place sur le webhook plateforme et `verify-subscription` depuis AthleX-Manager #315) | Après la PR `billing_source` du cycle de vie des abonnements. Changer la version change la forme des réponses `retrieve`/`list` (période désormais portée par `items.data[]`) : une passe dédiée avec tests, pas au fil des correctifs. |

---

## Résiduels connus et assumés

Ce qui n'est **pas prouvé**, ou accepté tel quel, avec la raison. Cette section existe pour
qu'aucune de ces limites ne soit découverte par surprise.

| Résiduel | Pourquoi |
| --- | --- |
| **Le rendu natif n'est pas simulé.** Les écrans mobiles sont vérifiés dans un navigateur et par la mesure des contrastes, pas sur un iPhone. | Aucun simulateur iOS n'est disponible sur la machine de vérification. Ce qui se constate reste vrai (couleurs, textes, chemins de données) ; le rendu final sur appareil ne l'est pas. |
| **Le traitement Apple du build 1.0.51 n'est pas constaté.** L'envoi est confirmé par Apple, le traitement ne l'est pas. | L'accès passe par une clé serveur, qui ne voit pas l'état de traitement. C'est là que se manifestent les refus tardifs (permissions, conformité export). Visible sur App Store Connect. |
| **Le fichier Android n'est pas soumis.** Il est produit et signé, il se téléverse à la main. | Aucune clé de compte de service Google Play (voir backlog). |
| **Un défaut de droits `supabase_admin` reste sous surveillance.** | Il est constaté par l'audit nocturne des droits sur la production, jugé sans conséquence exploitable en l'état, et surveillé plutôt que corrigé à l'aveugle. |
| **La cause première de la perte de session navigateur du 24 août n'est pas établie.** | Le symptôme est réparé (la session se réaligne, et un échec se nomme au lieu de rendre un écran vide), mais ce qui a tué la session ce jour-là n'est pas connu. Si le cas revient, il se nommera. |
| **Le message d'erreur d'un écran de refus d'hydratation n'a pas été vu à l'écran.** | En production, ce chemin renvoie vers la page de connexion avant que l'écran se monte. Seul son code est vérifié. |
| **Le refus d'un cours complet à l'essai n'est pas rejoué en production.** | Décision assumée du 30 août : la garde est la même fonction, mesurée sur pile jetable avec le trigger réel. Le provoquer en production demanderait de remplir un vrai cours ou d'en créer un factice sur le planning — plus cher que ce que ça prouve. |
| **Les plafonds anti-abus par e-mail et par adresse Internet ne sont pas rejoués en production.** | Même décision : prouvés sur pile jetable. Provoquer un blocage anti-abus sur la vraie base fabriquerait du bruit pour confirmer du déjà-mesuré. |
| **La réception effective de l'e-mail de confirmation d'essai n'est pas constatée.** | Seule la phrase affichée à l'écran l'est. La preuve appartient à un test de bout en bout avec une vraie adresse de réception ; déclencher un envoi de masse depuis la production toucherait des gérants qui n'ont rien demandé. |
| **Un compte créé à la demande de Nab (test, reviewer, démo) suit une règle fixe.** | Création par l'API admin Supabase avec `email_confirm: true` (aucun e-mail de confirmation envoyé), adresse toujours de la forme `nbstylz+…@gmail.com`, mot de passe jamais transmis par écrit (Nab le pose lui-même via « Mot de passe oublié » ou le choisit), et annonce préalable avant toute création — jamais de compte créé sans accord. |
| **Deux profils affichent encore un ELO qui ne correspond plus à leur historique** (JCVD 1039 pour un dernier `elo_after` de 1064, in the bar 1057 pour 1032). | Cause connue et fermée : l'ancien bouton web écrivait l'historique sans pouvoir écrire le profil (RLS, 204 et 0 ligne — règle 19). Le chemin n'existe plus ; le réalignement est au backlog à déclencheur, il attend un GO. |
| **Le format suisse (double élimination) ne converge qu'à 4 joueurs.** À 8, `advance_bracket_round` apparie les vainqueurs du tableau des perdants avec les perdants du tableau principal en une seule passe par tour, sans tour où les vainqueurs du LB se rencontrent : au tour 3, deux vainqueurs de LB pour un seul perdant de finale, l'un des deux n'a plus jamais d'adversaire ni de défaite. À 5, 6 ou 7, un vainqueur impair est oublié (pas de bye). La clôture refuse alors, à raison (« 1 athlète encore en lice »), et rien n'est écrit. | Aucun tournoi suisse n'existe en production (formats présents : 4 classiques, 1 bracket). Le défaut est affirmé par un test **attendu-rouge** (`test-finalize-elo.mjs`, suite « swiss à 8 ») qui rougira le jour où la fonction est corrigée. **Déclencheur : avant le premier tournoi suisse réel.** |
| **Les dates de fermeture antérieures au 16 août 2026 sont approximatives.** | Elles sont reconstruites depuis les PRs mergées, pas depuis un journal tenu à l'époque. |
| **Une capacité serveur n'est pas toujours atteignable depuis l'interface.** | C'est une distinction assumée et documentée : le serveur sait faire, l'écran ne l'expose pas encore. Chaque cas connu porte cette mention dans son en-tête. |

---

## Comment ce fichier reste vrai

La règle du haut n'est pas un vœu : elle est contrôlée en CI.

- Le contrôle `.github/workflows/etat-projet.yml` regarde chaque PR qui touche le code de
  l'app ou la base de données. Si `docs/ETAT_DU_PROJET.md` n'est pas dans la même PR, le
  contrôle est **rouge**.
- La seule sortie est explicite et nommée : écrire dans la description de la PR une ligne
  `État du projet : sans objet — <raison>`. Une raison vide ne passe pas. La sortie laisse
  donc une trace lisible, au lieu d'un oubli silencieux.
- Le miroir dans `AthleX-Manager` (`docs/ETAT_DU_PROJET.md`) est un **renvoi**, pas une
  copie : il ne contient aucun contenu d'état, donc il ne peut pas diverger discrètement de
  celui-ci. Un contrôle mécanique du dépôt web refuse qu'on y recopie les sections.

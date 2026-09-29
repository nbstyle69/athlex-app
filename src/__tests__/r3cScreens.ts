/**
 * Refonte R3c : écrans secondaires de l'athlète passés à AxScreenHeader.
 * `titles` : titre(s) passé(s) à l'en-tête, tels qu'écrits dans le fichier ;
 * `right` : action(s) de droite conservée(s) ; `onBack` : retour propre gardé.
 */
export interface R3cScreen {
  file: string;
  titles: string[];
  right?: string[];
  onBack?: string[];
}

export const R3C_SCREENS: R3cScreen[] = [
  { file: 'home/BoxInfoScreen.tsx', titles: ['title="Informations"'] },
  { file: 'home/ChangelogScreen.tsx', titles: ['title="Nouveautés"'] },
  { file: 'home/FriendsScreen.tsx', titles: ['title="Amis"'] },
  { file: 'home/OneRMCalculatorScreen.tsx', titles: ['title="Calculateur 1RM"'] },
  { file: 'wod/WodGeneratorScreen.tsx', titles: ['title="Générateur de WOD"'] },
  { file: 'wod/WodResultScreen.tsx', titles: ['title="Ton WOD"'] },
  { file: 'wod/WodHistoryScreen.tsx', titles: ["title={t('wodHistory.title')}"] },
  { file: 'timer/TimerScreen.tsx', titles: ['title="Minuteur"'] },
  { file: 'leaderboard/LeaderboardScreen.tsx', titles: ['title="Classement"'] },
  { file: 'leaderboard/BoxRankingScreen.tsx', titles: ['title="Classement de la box"'] },
  { file: 'settings/NotificationSettingsScreen.tsx', titles: ['title="Notifications"'] },
  { file: 'profile/BlockedUsersScreen.tsx', titles: ['title="Utilisateurs bloqués"'] },
  { file: 'profile/EloHistoryScreen.tsx', titles: ['title="Historique ELO"'], onBack: ['onBack={() => nav.goBack()}'] },
  {
    file: 'profile/PublicProfileScreen.tsx', titles: ['title="Profil"'],
    right: ['testID="header-share"', 'athlex://profile/${route.params.userId}', '<ReportMenu'],
  },
  {
    file: 'tournament/DailyTournamentsScreen.tsx', titles: ['title="Mini-Tournois"'],
    right: ['icon={Plus} onPress={() => setCreateModal(true)}'],
  },
  {
    file: 'tournament/DailyTournamentDetailScreen.tsx', titles: ['title={tournament.wod_name}'],
    right: ['testID="header-share"', 'athlex://daily/${tournamentId}'],
  },
  { file: 'competition/CompetitionDetailScreen.tsx', titles: ['title={competition.name}'] },
  {
    file: 'competition/PhysicalCompetitionScreen.tsx',
    titles: ["title={isQualifList ? t('phys.qualifTitle') : t('phys.noQualifTitle')}", 'title={selected.name}'],
    right: ['testID="header-share"', "t('phys.shareMessage'"],
    onBack: ['onBack={() => setSelected(null)}'],
  },
  {
    file: 'competition/TournamentScreen.tsx', titles: ['title={tournament.name}'],
    right: ['testID="header-share"', "t('tournament.shareMessage'"],
  },
  {
    file: 'competition/TournamentWODScreen.tsx', titles: ['title={wod.title}'],
    onBack: ["onBack={() => setPhase('detail')}"],
  },
  { file: 'competition/InterCompetitionListScreen.tsx', titles: ["title={t('interComp.title')}"] },
  { file: 'competition/InterCompetitionDetailScreen.tsx', titles: ['title={comp.title}'] },
  { file: 'competition/InterScoreSubmitScreen.tsx', titles: ["title={t('interScore.title')}"] },
  { file: 'competition/InterTeamScreen.tsx', titles: ["title={team ? team.name : t('interTeam.myTeam')}"] },
  {
    file: 'whiteboard/WODDetailScreen.tsx', titles: ['title={wod.title}', 'title="WOD introuvable"'],
    right: ['testID="header-share"', 'athlex://wod/${wodId}'],
  },
  {
    file: 'whiteboard/ArticlesScreen.tsx', titles: ['title="Actualités"', 'title={selectedArticle.title}'],
    onBack: ['onBack={() => { setSelectedArticle(null); setComments([]); }}'],
  },
  {
    file: 'whiteboard/PersonalWODFormScreen.tsx', titles: ["title={editId ? 'Modifier mon WOD' : 'Créer un WOD'}"],
    right: ['icon={Trash2} onPress={remove}'],
  },
  { file: 'reservation/MyReservationsScreen.tsx', titles: ["title={t('myReservations.title')}"] },
  { file: 'documents/LegalScreen.tsx', titles: ['title="Mentions légales"'], onBack: ['onBack={() => nav.goBack()}'] },
  { file: 'programs/ProgramDetailScreen.tsx', titles: ['title={programTitle}'], right: ['style={S.dateBtn}'] },
  { file: 'explorer/ProgrammationScreen.tsx', titles: ['title="Programmes"'] },
  {
    file: 'explorer/BoxDirectoryScreen.tsx', titles: ['title="Annuaire des Boxs"'],
    right: ["icon={Map} onPress={() => navigation.navigate('BoxDirectoryMap'"],
  },
  { file: 'explorer/BoxDirectoryDetailScreen.tsx', titles: ['title={box.name}', "title={t('boxAccess.notFoundTitle')}"] },
  { file: 'explorer/PartnersScreen.tsx', titles: ['title="Partenaires"'] },
  { file: 'explorer/PartnerDetailScreen.tsx', titles: ['title={partner.name}'] },
  { file: 'explorer/BoxProgramsScreen.tsx', titles: ['title="Programmes des Boxs"'] },
  { file: 'messages/MessagesScreen.tsx', titles: ['title="Messages"'] },
];

/** Écrans racine des 5 onglets de l'athlète : jamais de Retour. */
export const ATHLETE_ROOT_SCREENS = [
  'competition/CompetitionScreen.tsx',
  'training/TrainingScreen.tsx',
  'home/HomeScreen.tsx',
  'whiteboard/WhiteboardScreen.tsx',
  'reservation/ReservationScreen.tsx',
];

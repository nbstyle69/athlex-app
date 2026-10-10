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
  { file: 'home/BoxInfoScreen.tsx', titles: ["title={t('boxInfo.title')}"] },
  { file: 'home/ChangelogScreen.tsx', titles: ['title="Nouveautés"'] },
  { file: 'home/FriendsScreen.tsx', titles: ['title="Amis"'] },
  { file: 'home/OneRMCalculatorScreen.tsx', titles: ["title={t('oneRm.title')}"] },
  { file: 'wod/WodGeneratorScreen.tsx', titles: ["title={t('wodGen.title')}"] },
  { file: 'wod/WodResultScreen.tsx', titles: ["title={t('wodResult.title')}"] },
  { file: 'wod/WodHistoryScreen.tsx', titles: ["title={t('wodHistory.title')}"] },
  { file: 'timer/TimerScreen.tsx', titles: ["title={t('training.tools.timer')}"] },
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
    file: 'tournament/DailyTournamentDetailScreen.tsx', titles: ["title={i18n.t('screenTitles.miniTournament')}"],
    right: ['testID="header-share"', 'athlex://daily/${tournamentId}'],
  },
  { file: 'competition/CompetitionDetailScreen.tsx', titles: ["title={t('screenTitles.competition')}"] },
  {
    file: 'competition/PhysicalCompetitionScreen.tsx',
    titles: ["title={isQualifList ? t('phys.qualifTitle') : t('phys.noQualifTitle')}", "title={t('screenTitles.competition')}"],
    right: ['testID="header-share"', "t('phys.shareMessage'"],
    onBack: ['onBack={() => setSelected(null)}'],
  },
  {
    file: 'competition/TournamentScreen.tsx', titles: ["title={t('screenTitles.tournament')}"],
    right: ['testID="header-share"', "t('tournament.shareMessage'"],
  },
  {
    file: 'competition/TournamentWODScreen.tsx', titles: ["title={t('screenTitles.tournamentWod')}"],
    onBack: ["onBack={() => setPhase('detail')}"],
  },
  { file: 'competition/InterCompetitionListScreen.tsx', titles: ["title={t('interComp.title')}"] },
  { file: 'competition/InterCompetitionDetailScreen.tsx', titles: ["title={t('screenTitles.competition')}"] },
  { file: 'competition/InterScoreSubmitScreen.tsx', titles: ["title={t('interScore.title')}"] },
  { file: 'competition/InterTeamScreen.tsx', titles: ["title={t('interTeam.myTeam')}"] },
  {
    file: 'whiteboard/WODDetailScreen.tsx', titles: ["title={wod.scheduled_date ? i18n.t('screenTitles.wodOfDay') : i18n.t('screenTitles.wod')}", "title={i18n.t('wodDetail.notFound')}"],
    right: ['testID="header-share"', 'athlex://wod/${wodId}'],
  },
  {
    file: 'whiteboard/ArticlesScreen.tsx', titles: ["title={t('whiteboard.news')}", "title={t('screenTitles.article')}"],
    onBack: ['onBack={() => { setSelectedArticle(null); setComments([]); }}'],
  },
  {
    file: 'whiteboard/PersonalWODFormScreen.tsx', titles: ["title={editId ? t('personalWod.editTitle') : t('bo.wods.createWod')}"],
    right: ['icon={Trash2} onPress={remove}'],
  },
  { file: 'reservation/MyReservationsScreen.tsx', titles: ["title={t('myReservations.title')}"] },
  { file: 'documents/LegalScreen.tsx', titles: ['title="Mentions légales"'], onBack: ['onBack={() => nav.goBack()}'] },
  { file: 'programs/ProgramDetailScreen.tsx', titles: ["title={t('screenTitles.program')}"], right: ['style={S.dateBtn}'] },
  { file: 'explorer/ProgrammationScreen.tsx', titles: ["title={t('home.explorer.programs')}"] },
  {
    file: 'explorer/BoxDirectoryScreen.tsx', titles: ["title={i18n.t('explorer.directory.title')}"],
    right: ["icon={Map} onPress={() => navigation.navigate('BoxDirectoryMap'"],
  },
  { file: 'explorer/BoxDirectoryDetailScreen.tsx', titles: ["title={t('screenTitles.box')}", "title={t('boxAccess.notFoundTitle')}"] },
  { file: 'explorer/PartnersScreen.tsx', titles: ["title={t('home.explorer.partners')}"] },
  { file: 'explorer/PartnerDetailScreen.tsx', titles: ["title={i18n.t('screenTitles.partner')}"] },
  { file: 'explorer/BoxProgramsScreen.tsx', titles: ["title={t('explorer.programs.title')}"] },
  { file: 'messages/MessagesScreen.tsx', titles: ["title={i18n.t('whiteboard.messages')}"] },
];

/** Écrans racine des 5 onglets de l'athlète : jamais de Retour. */
export const ATHLETE_ROOT_SCREENS = [
  'competition/CompetitionScreen.tsx',
  'training/TrainingScreen.tsx',
  'home/HomeScreen.tsx',
  'whiteboard/WhiteboardScreen.tsx',
  'reservation/ReservationScreen.tsx',
];

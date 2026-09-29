/**
 * Carte « Actu de ta box » de l'Accueil (refonte R3a). Rien n'est affiché sans
 * article récent : `HomeScreen` passe `news = null`.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heart, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxCard, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { isFreshNews, newsAge, type HomeNews } from '../../services/homeNews';

type Props = { news: HomeNews | null; onOpen: () => void; now?: Date };

export default function HomeNewsCard({ news, onOpen, now = new Date() }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  if (!news) return null;
  const age = newsAge(news.created_at, now);
  return (
    <View testID="home-news" style={styles.section}>
      <Text style={[axTypography.titleM, { color: c.text }]}>{t('home.news.title')}</Text>
      <AxCard onPress={onOpen} accessibilityLabel={t('home.news.open', { title: news.title })} testID="home-news-card">
        {isFreshNews(news.created_at, now) && <AxTag label={t('home.news.new')} tone="accent" testID="home-news-new" />}
        {news.image_url ? (
          <Image testID="home-news-image" source={{ uri: news.image_url }} style={[styles.image, { backgroundColor: c.border }]} />
        ) : null}
        <Text style={[axTypography.label, { color: c.text }]} numberOfLines={2}>{news.title}</Text>
        <Text testID="home-news-body" style={[axTypography.bodySmall, { color: c.textMuted }]} numberOfLines={2}>{news.body}</Text>
        <View style={styles.meta}>
          <Text testID="home-news-age" style={[axTypography.caption, styles.age, { color: c.textMuted }]}>
            {t(age.key, { count: age.count })}
          </Text>
          <View style={styles.counter} accessibilityLabel={t('home.news.likes', { count: news.likes })}>
            <Heart size={14} color={c.textMuted} />
            <Text testID="home-news-likes" style={[axTypography.caption, { color: c.textMuted }]}>{news.likes}</Text>
          </View>
          <View style={styles.counter} accessibilityLabel={t('home.news.comments', { count: news.comments })}>
            <MessageCircle size={14} color={c.textMuted} />
            <Text testID="home-news-comments" style={[axTypography.caption, { color: c.textMuted }]}>{news.comments}</Text>
          </View>
        </View>
      </AxCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: axSpacing.lg, gap: axSpacing.sm },
  image: { width: '100%', height: 140, borderRadius: axRadius.control },
  meta: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  age: { flex: 1 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
});

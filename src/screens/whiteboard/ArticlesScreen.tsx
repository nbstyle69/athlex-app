import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
  TouchableOpacity, Image, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { AxCard, AxGlass, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { ChevronRight, Heart, MessageCircle, Send, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarFootprint, useTabBarScrollSpace } from '../../navigation/tabBarLayout';

interface Article {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  author_username: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export default function ArticlesScreen() {
  const { t } = useTranslation();
  const tabSpace = useTabBarScrollSpace();
  const tabFootprint = useTabBarFootprint();
  const navigation = useNavigation();
  const { currentBox, user } = useAuth();
  const { theme } = useTheme();
  const S = styles(theme);
  const c = theme.ax;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);

  // Detail view
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const load = useCallback(async () => {
    if (!currentBox || !user) { setLoading(false); return; }
    try {
    const { data } = await supabase
      .from('box_articles')
      .select('id, title, body, image_url, created_at, author:profiles!author_id(username)')
      .eq('box_id', currentBox.id)
      .order('created_at', { ascending: false });

    const enriched: Article[] = [];
    for (const a of (data ?? [])) {
      const { count: lc } = await supabase
        .from('box_article_likes').select('*', { count: 'exact', head: true })
        .eq('article_id', a.id);
      const { count: cc } = await supabase
        .from('box_article_comments').select('*', { count: 'exact', head: true })
        .eq('article_id', a.id);
      const { data: myLike } = await supabase
        .from('box_article_likes').select('article_id')
        .eq('article_id', a.id).eq('user_id', user.id).maybeSingle();

      enriched.push({
        ...a,
        author_username: (a as any).author?.username ?? '?',
        likes_count: lc ?? 0,
        comments_count: cc ?? 0,
        liked_by_me: !!myLike,
      });
    }

    setArticles(enriched);
    } catch (e) { captureError(e, { screen: 'Articles', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [currentBox, user]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    load();
    if (user && currentBox) {
      AsyncStorage.setItem(`lastSeenArticles_${user.id}_${currentBox.id}`, new Date().toISOString());
    }
  }, [load, user, currentBox]));

  async function toggleLike(article: Article) {
    if (!user) return;
    if (article.liked_by_me) {
      await supabase.from('box_article_likes')
        .delete().eq('article_id', article.id).eq('user_id', user.id);
    } else {
      await supabase.from('box_article_likes')
        .insert({ article_id: article.id, user_id: user.id });
    }
    // Update local state immediately
    setArticles(prev => prev.map(a =>
      a.id === article.id
        ? { ...a, liked_by_me: !a.liked_by_me, likes_count: a.likes_count + (a.liked_by_me ? -1 : 1) }
        : a
    ));
    if (selectedArticle?.id === article.id) {
      setSelectedArticle(prev => prev ? {
        ...prev, liked_by_me: !prev.liked_by_me,
        likes_count: prev.likes_count + (prev.liked_by_me ? -1 : 1),
      } : null);
    }
  }

  async function openArticle(article: Article) {
    setSelectedArticle(article);
    setLoadingComments(true);
    const { data } = await supabase
      .from('box_article_comments')
      .select('id, user_id, content, created_at, profile:profiles!user_id(username)')
      .eq('article_id', article.id)
      .order('created_at', { ascending: true });

    setComments((data ?? []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      username: c.profile?.username ?? '?',
      content: c.content,
      created_at: c.created_at,
    })));
    setLoadingComments(false);
  }

  async function sendComment() {
    if (!commentText.trim() || !selectedArticle || !user) return;
    const { data, error } = await supabase
      .from('box_article_comments')
      .insert({
        article_id: selectedArticle.id,
        user_id: user.id,
        content: commentText.trim(),
      })
      .select('id, created_at')
      .single();

    if (!error && data) {
      setComments(prev => [...prev, {
        id: data.id,
        user_id: user.id,
        username: user.username ?? '?',
        content: commentText.trim(),
        created_at: data.created_at,
      }]);
      setCommentText('');
      // Update count
      setArticles(prev => prev.map(a =>
        a.id === selectedArticle.id ? { ...a, comments_count: a.comments_count + 1 } : a
      ));
      setSelectedArticle(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
    }
  }

  async function deleteComment(commentId: string) {
    await supabase.from('box_article_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    if (selectedArticle) {
      setArticles(prev => prev.map(a =>
        a.id === selectedArticle.id ? { ...a, comments_count: a.comments_count - 1 } : a
      ));
      setSelectedArticle(prev => prev ? { ...prev, comments_count: prev.comments_count - 1 } : null);
    }
  }

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  // ── Detail view ──
  if (selectedArticle) {
    return (
      <KeyboardAvoidingView style={S.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <GlassBackground />
        <AxScreenHeader title={selectedArticle.title} onBack={() => { setSelectedArticle(null); setComments([]); }} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 + tabFootprint }}>
          {selectedArticle.image_url && (
            <Image source={{ uri: selectedArticle.image_url }} style={S.detailImage} resizeMode="cover" />
          )}
          <View style={S.detailBodyWrap}>
            <Text testID="article-detail-title" style={S.detailTitle}>{selectedArticle.title}</Text>
            <Text testID="article-detail-meta" style={S.detailMeta}>
              Par {selectedArticle.author_username} · {new Date(selectedArticle.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            {selectedArticle.body ? <Text style={S.detailBody}>{selectedArticle.body}</Text> : null}

            <Pressable
              testID="article-detail-like"
              style={[S.likeBtn, selectedArticle.liked_by_me && S.likeBtnActive]}
              onPress={() => toggleLike(selectedArticle)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedArticle.liked_by_me }}
            >
              {selectedArticle.liked_by_me && <AxGlass color={c.accent} opacity={0.88} radius={axRadius.control} />}
              <Heart
                color={selectedArticle.liked_by_me ? c.onAccent : c.accentText}
                fill={selectedArticle.liked_by_me ? c.onAccent : 'transparent'}
                size={16}
              />
              <Text style={[S.likeBtnText, selectedArticle.liked_by_me && { color: c.onAccent }]}>
                {selectedArticle.likes_count} J'aime
              </Text>
            </Pressable>

            <Text testID="article-comments-title" style={S.commentsTitle}>Commentaires ({selectedArticle.comments_count})</Text>
            {loadingComments ? (
              <ActivityIndicator color={c.accentText} />
            ) : comments.length === 0 ? (
              <Text style={S.emptyText}>Aucun commentaire</Text>
            ) : comments.map(cm => (
              <AxCard key={cm.id} testID={`article-comment-${cm.id}`} style={S.commentCard}>
                <View style={S.shrink}>
                  <Text style={S.commentUser} numberOfLines={1}>{cm.username}</Text>
                  <Text style={S.commentContent}>{cm.content}</Text>
                  <Text style={S.commentDate}>
                    {new Date(cm.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {cm.user_id === user?.id && (
                  <TouchableOpacity testID={`article-comment-delete-${cm.id}`} onPress={() => deleteComment(cm.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Supprimer le commentaire">
                    <Trash2 color={c.danger} size={14} />
                  </TouchableOpacity>
                )}
              </AxCard>
            ))}
          </View>
        </ScrollView>

        <View style={[S.commentInput, tabFootprint > 0 && { bottom: tabFootprint, paddingBottom: 10 }]}>
          <View style={S.shrink}>
            <AxTextField
              testID="article-comment-input"
              placeholder="Écrire un commentaire..."
              value={commentText}
              onChangeText={setCommentText}
            />
          </View>
          <TouchableOpacity testID="article-comment-send" onPress={sendComment} disabled={!commentText.trim()} activeOpacity={0.8} accessibilityLabel="Envoyer">
            <Send color={commentText.trim() ? c.accentText : c.textMuted} size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── List view ──
  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Actualités" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {articles.length === 0 ? (
          <Text style={S.emptyText}>Aucune actualité pour le moment</Text>
        ) : articles.map(a => (
          <AxCard key={a.id} testID={`article-${a.id}`} onPress={() => openArticle(a)} accessibilityLabel={a.title} style={S.articleCard}>
            {a.image_url && (
              <Image source={{ uri: a.image_url }} style={S.articleImage} resizeMode="cover" />
            )}
            <View style={S.articleContent}>
              <Text testID={`article-title-${a.id}`} style={S.articleTitle} numberOfLines={2}>{a.title}</Text>
              <Text testID={`article-author-${a.id}`} style={S.articleAuthor} numberOfLines={1}>Par {a.author_username}</Text>
              {a.body ? <Text testID={`article-body-${a.id}`} style={S.articleBody} numberOfLines={2}>{a.body}</Text> : null}
              <View style={S.articleMeta}>
                <Text testID={`article-date-${a.id}`} style={S.dateText}>
                  {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </Text>
                <TouchableOpacity
                  testID={`article-like-${a.id}`}
                  style={S.counter}
                  onPress={(e) => { e.stopPropagation?.(); toggleLike(a); }}
                  activeOpacity={0.7}
                  accessibilityLabel={`${a.likes_count} J'aime`}
                >
                  <Heart
                    color={a.liked_by_me ? c.accentText : c.textMuted}
                    fill={a.liked_by_me ? c.accentText : 'transparent'}
                    size={14}
                  />
                  <Text testID={`article-likes-${a.id}`} style={[S.metaText, a.liked_by_me && { color: c.accentText }]}>{a.likes_count}</Text>
                </TouchableOpacity>
                <View style={S.counter}>
                  <MessageCircle color={c.textMuted} size={14} />
                  <Text testID={`article-comments-${a.id}`} style={S.metaText}>{a.comments_count}</Text>
                </View>
              </View>
              <Pressable
                testID={`article-read-${a.id}`}
                style={S.readLink}
                onPress={() => openArticle(a)}
                accessibilityRole="link"
                accessibilityLabel={`${t('whiteboard.readArticle')} : ${a.title}`}
                hitSlop={8}
              >
                <Text testID={`article-read-label-${a.id}`} style={S.readText}>{t('whiteboard.readArticle')}</Text>
                <ChevronRight color={c.accentText} size={14} strokeWidth={2} />
              </Pressable>
            </View>
          </AxCard>
        ))}
      </ScrollView>
    </View>
  );
}

function styles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { padding: axSpacing.lg, gap: axSpacing.md },
  emptyText: { ...axTypography.bodySmall, textAlign: 'center', color: c.textMuted, marginTop: 60 },
  shrink: { flex: 1, minWidth: 0 },
  articleCard: { padding: 0, gap: 0 },
  articleImage: { width: '100%', height: 180 },
  articleContent: { padding: axSpacing.lg, gap: axSpacing.xs },
  articleTitle: { ...axTypography.titleM, color: c.text },
  articleAuthor: { ...axTypography.caption, color: c.textMuted },
  articleBody: { ...axTypography.bodySmall, color: c.textMuted },
  articleMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: axSpacing.md, marginTop: axSpacing.sm },
  dateText: { ...axTypography.overline, color: c.textMuted },
  counter: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  readLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginTop: axSpacing.sm },
  readText: { ...axTypography.labelSmall, color: c.accentText },
  metaText: { ...axTypography.caption, color: c.textMuted },
  // Detail
  detailImage: { width: '100%', height: 220 },
  detailBodyWrap: { padding: axSpacing.lg, gap: axSpacing.md },
  detailTitle: { ...axTypography.titleM, color: c.text },
  detailMeta: { ...axTypography.caption, color: c.textMuted },
  detailBody: { ...axTypography.body, color: c.text },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: axRadius.control,
    borderWidth: 1, borderColor: c.accentText, overflow: 'hidden',
  },
  likeBtnActive: { borderColor: 'transparent' },
  likeBtnText: { ...axTypography.label, color: c.accentText },
  commentsTitle: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.sm },
  commentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md, padding: axSpacing.md },
  commentUser: { ...axTypography.labelSmall, color: c.accentText },
  commentContent: { ...axTypography.bodySmall, color: c.text, marginTop: 2 },
  commentDate: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  commentInput: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.md,
    backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border,
    paddingHorizontal: axSpacing.lg, paddingVertical: 10, paddingBottom: 30,
  },
  });
}

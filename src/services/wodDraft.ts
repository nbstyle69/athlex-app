/**
 * B6 (lot B) — brouillon local de la séance générée.
 *
 * L'athlète qui lance le minuteur sans avoir enregistré perdait le WOD généré
 * dès que la page résultat quittait la pile. Le brouillon est écrit dès la
 * génération, mis à jour avec les charges saisies et le score, remplacé au
 * tirage suivant, effacé à l'enregistrement. Clé par utilisateur, préfixe
 * `@athlex:` donc purgée à la déconnexion (appareil partagé).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '../lib/sentry';
import type { GenerateResult, PerformedExercise, ScoreSubmission, ScreenParams } from './wodGenerator';

export interface WodDraft {
  screen: ScreenParams;
  result: GenerateResult;
  performed?: PerformedExercise[];
  submittedScore?: ScoreSubmission | null;
  savedAt: string;
}

const draftKey = (userId: string) => `@athlex:wodDraft:${userId}`;

export async function saveWodDraft(userId: string, draft: Omit<WodDraft, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch (e) { captureError(e, { action: 'saveWodDraft' }); }
}

export async function loadWodDraft(userId: string): Promise<WodDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<WodDraft>;
    return d && d.screen && d.result && d.result.wod ? (d as WodDraft) : null;
  } catch { return null; }
}

export async function clearWodDraft(userId: string): Promise<void> {
  try { await AsyncStorage.removeItem(draftKey(userId)); } catch (e) { captureError(e, { action: 'clearWodDraft' }); }
}

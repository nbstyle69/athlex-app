/**
 * AthleX — Déclaration Gymnastique de l'athlète (page de records)
 * ==============================================================
 * Lecture / écriture de `user_generation_settings.gym_declaration`.
 * Best-effort en lecture : toute erreur réseau est loggée, jamais bloquante.
 */

import { supabase } from '../lib/supabase';
import { GymDeclaration } from '../utils/wod/athleteLevels';

/** Lecture seule de la déclaration Gymnastique (page de records). */
export async function loadGymDeclaration(userId: string): Promise<GymDeclaration> {
  try {
    const { data } = await supabase
      .from('user_generation_settings').select('gym_declaration').eq('user_id', userId).maybeSingle();
    return (data?.gym_declaration ?? {}) as GymDeclaration;
  } catch (e) {
    console.warn('[wodPersonalization] loadGymDeclaration:', e);
    return {};
  }
}

/** Section « Gymnastique » (page de records) : palier max déclaré par famille → gymLevel(). */
export async function saveGymDeclaration(userId: string, gymDeclaration: GymDeclaration) {
  await supabase.from('user_generation_settings').upsert(
    { user_id: userId, gym_declaration: gymDeclaration, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
}

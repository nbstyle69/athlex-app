import { supabase } from '../lib/supabase';
import { readRows } from '../lib/db';

/**
 * Rang ELO de l'athlète : profils au-dessus de son ELO, comptes de démo exclus
 * (#565), plus un. `null` si la RPC échoue : jamais de rang par défaut, l'écran
 * n'en affiche aucun.
 */
export async function fetchEloRank(elo: number): Promise<number | null> {
  return readRows(
    supabase.rpc('global_elo_rank', { p_elo: elo }),
    { screen: 'EloRank', action: 'fetchEloRank' },
  );
}

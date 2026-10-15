import { supabase } from '../lib/supabase';
import { readRows } from '../lib/db';

/** Rang ELO de l'athlète : profils au-dessus de son ELO, comptes de démo exclus (#565), plus un. */
export async function fetchEloRank(elo: number): Promise<number> {
  const rang = await readRows(
    supabase.rpc('global_elo_rank', { p_elo: elo }),
    { screen: 'EloRank', action: 'fetchEloRank' },
  );
  return rang ?? 1;
}

import { supabase } from '../lib/supabase';

/** Rang ELO de l'athlète : nombre de profils au-dessus de son ELO, plus un. */
export async function fetchEloRank(elo: number): Promise<number> {
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('elo', elo);
  return (count ?? 0) + 1;
}

import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyPlanStatus, type MyPlanStatus } from '../services/membership';

/**
 * État de la formule de l'appelant dans chaque box, relu quand l'écran reprend
 * le focus et quand l'app revient au premier plan (retour du site après le
 * paiement). Une box absente : appel échoué ou pas membre actif.
 */
export function usePlanStatuses(boxIds: string[]): Record<string, MyPlanStatus> {
  const [statuses, setStatuses] = useState<Record<string, MyPlanStatus>>({});
  const key = boxIds.join(',');

  useFocusEffect(useCallback(() => {
    let vivant = true;
    const ids = key ? key.split(',') : [];
    const load = () => {
      Promise.all(ids.map(id => getMyPlanStatus(id).then(s => [id, s] as const))).then(rows => {
        if (!vivant) return;
        const next: Record<string, MyPlanStatus> = {};
        rows.forEach(([id, s]) => { if (s) next[id] = s; });
        setStatuses(next);
      });
    };
    load();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load(); });
    return () => { vivant = false; sub.remove(); };
  }, [key]));

  return statuses;
}

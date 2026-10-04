import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMyPersonalRecords } from '../services/myProfile';
import { parsePersonalRecords, oneRepMaxForMovement } from '../utils/wod/movementLoadability';
import { readPr } from '../screens/profile/prStorage';
import { gymPrLabel } from '../screens/home/gymZones';

/** Record de gymnastique (reps) d'un nom de mouvement rapproché, sinon `null`. */
export function gymRecordForMovement(name: string, records: Record<string, unknown>): number | null {
  const label = gymPrLabel(name);
  if (!label) return null;
  const raw = readPr(records as Record<string, string>, 'gymnastics', label);
  const n = raw == null ? NaN : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/**
 * Résolveurs « nom de mouvement → mon 1RM (kg) » et « → mon record de
 * gymnastique (reps) », pour afficher la charge ou les reps d'un bloc prescrit
 * en %. Une seule lecture des records.
 *
 * La lecture passe par `get_my_profile()` (`fetchMyPersonalRecords`) : depuis le
 * Lot 0-bis, `profiles.personal_records` n'est plus lisible en colonne. Tant que
 * les records ne sont pas chargés, les résolveurs rendent `null` et l'affichage
 * garde le pourcentage nu — jamais une charge ni des reps inventées.
 */
export function useMyRecords(): {
  oneRepMaxFor: (movementName: string) => number | null;
  gymRecordFor: (movementName: string) => number | null;
  /** Relit les records (retour sur l'écran après « Renseigner mon record »). Les anciens restent jusqu'à la réponse. */
  reload: () => void;
} {
  const [records, setRecords] = useState<Record<string, unknown>>({});
  const alive = useRef(true);

  const reload = useCallback(() => {
    fetchMyPersonalRecords().then(r => {
      if (alive.current) setRecords(r);
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, [reload]);

  const prs = useMemo(() => parsePersonalRecords(records), [records]);

  return {
    oneRepMaxFor: useCallback((name: string) => oneRepMaxForMovement(name, prs), [prs]),
    gymRecordFor: useCallback((name: string) => gymRecordForMovement(name, records), [records]),
    reload,
  };
}

export function useMyOneRepMax(): (movementName: string) => number | null {
  return useMyRecords().oneRepMaxFor;
}

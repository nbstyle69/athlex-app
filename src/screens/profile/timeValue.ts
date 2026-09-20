/**
 * B11 (lot B) — records exprimés en temps (unité `min`) : saisie en minutes ET
 * secondes (`mm:ss`), valeur stockée en minutes décimales comme avant (un
 * record déjà saisi « 4.5 » reste valide et s'affiche « 4:30 »).
 */
export function isTimeUnit(unit: string): boolean {
  return unit === 'min';
}

/** `'1:42'` → `'1.7'` ; `'1.7'` ou `'1,7'` → `'1.7'` ; `'12'` → `'12'` ; invalide → `null`. */
export function parseTimeInput(text: string): string | null {
  const t = text.trim().replace(',', '.').replace(/[’']/g, ':');
  if (!t) return '';
  const mmss = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (mmss) {
    const minutes = Number(mmss[1]) + Number(mmss[2]) / 60;
    return String(Math.round(minutes * 1000) / 1000);
  }
  if (/^\d{1,3}(\.\d{1,3})?$/.test(t)) return String(Number(t));
  return null;
}

/** `'1.7'` → `'1:42'` ; `'4:30'` → `'4:30'` ; autre chose → tel quel. */
export function formatTimeValue(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{1,3}:[0-5]\d$/.test(value)) return value;
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return value;
  const total = Math.round(n * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

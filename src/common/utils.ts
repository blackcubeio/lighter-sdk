/** Durée (ms) d'un intervalle de bougie unifié (`1m`, `5m`, `1h`, `1d`, `1w`…). */
const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/**
 * Convertit un intervalle unifié (`<n><unit>`) en millisecondes. Sert à calculer le `close time`
 * d'une bougie (le wire Lighter ne donne que l'`open time`). Renvoie `0` si non reconnu.
 */
export function intervalToMs(interval: string): number {
  const match = /^(\d+)\s*([mhdw])$/.exec(interval.trim().toLowerCase());
  if (match === null) {
    return 0;
  }
  const count = Number(match[1]);
  const unit = UNIT_MS[match[2] as string] ?? 0;
  return count * unit;
}

/**
 * Convertit une valeur décimale (chaîne ou nombre) en **entier natif Lighter** scalé par
 * `decimals` (`value * 10^decimals`, arrondi). Ex. prix `73969.4` à `price_decimals=1` → `739694`.
 */
export function scaleToInt(value: string | number, decimals: number): number {
  return Math.round(Number(value) * 10 ** decimals);
}

/** Pas décimal `10^-decimals` sous forme de chaîne (ex. `5` → `"0.00001"`). */
export function decimalStep(decimals: number): string {
  if (decimals <= 0) {
    return '1';
  }
  return `0.${'0'.repeat(decimals - 1)}1`;
}

/** Convertit un datetime unifié `YYYY-MM-DD HH:MM:SS` (UTC, C7) en millisecondes epoch. */
export function dateToMs(date: string): number {
  return new Date(`${date.replace(' ', 'T')}Z`).getTime();
}

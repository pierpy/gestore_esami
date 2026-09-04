/**
 * Media tra scritto e orale: se manca uno dei due, la media coincide con
 * l'altro voto (esame con solo scritto o solo orale); se mancano entrambi,
 * null. Arrotondata a 2 decimali.
 */
export function computeMedia(scritto: number | null, orale: number | null): number | null {
  if (scritto == null && orale == null) return null
  if (scritto == null) return orale
  if (orale == null) return scritto
  return Math.round(((scritto + orale) / 2) * 100) / 100
}

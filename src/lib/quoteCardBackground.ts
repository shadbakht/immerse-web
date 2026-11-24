/**
 * Which of the 20 Daily Reading photos (public/daily-backgrounds, copied from
 * mobile assets/dailyReadings) backs a quote card on a given day: the Badí'
 * month (1–19), or 20 during Ayyám-i-Há. Same fixed approximation as mobile
 * `src/reminders/dailyReadings.ts` badiDate/badiBackgroundImageIndex
 * (Naw-Rúz = 21 March; Ayyám-i-Há 5 days when the next February has a
 * 29th) — change both.
 */

const FILES = [
  'bg-01-baha', 'bg-02-jalal', 'bg-03-jamal', 'bg-04-azamat', 'bg-05-nur',
  'bg-06-rahmat', 'bg-07-kalimat', 'bg-08-kamal', 'bg-09-asma', 'bg-10-izzat',
  'bg-11-mashiyyat', 'bg-12-ilm', 'bg-13-qudrat', 'bg-14-qawl', 'bg-15-masail',
  'bg-16-sharaf', 'bg-17-sultan', 'bg-18-mulk', 'bg-19-ala', 'bg-20-ayyamiha',
];

const MONTHS_BEFORE_AYYAM = 18 * 19;

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 1–19 for an ordinary Badí' month, 20 for Ayyám-i-Há. */
export function badiBackgroundImageIndex(date: Date): number {
  const y = date.getFullYear();
  const startYear = date >= new Date(y, 2, 21) ? y : y - 1;
  const ordinal = Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(startYear, 2, 21)) / 86400000,
  ) + 1;
  const ayyam = isGregorianLeapYear(startYear + 1) ? 5 : 4;
  if (ordinal <= MONTHS_BEFORE_AYYAM) return Math.floor((ordinal - 1) / 19) + 1;
  if (ordinal <= MONTHS_BEFORE_AYYAM + ayyam) return 20;
  return 19;
}

export function quoteCardBackgroundUrl(date: Date): string {
  return `/daily-backgrounds/${FILES[badiBackgroundImageIndex(date) - 1]}.jpeg`;
}

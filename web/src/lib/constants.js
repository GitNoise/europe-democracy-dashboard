// Settings shared by the whole page. The detection thresholds live in pipeline/config.json;
// these are the ones applied when drawing (see pipeline/RULES.md).

export const DEFAULT_COUNTRY = 'HUN';
export const FIRST_YEAR = 1945;

/** Moves since this year count as "recent" for headlines. */
export const RECENT_YEAR = 2018;

/** Bands are drawn only for moves at least this big. */
export const BAND_MIN = 0.1;

/** A rise or fall is shaded over the shortest run of years carrying this share of its change. */
export const CORE_SHARE = 0.8;

/** A government is shaded if at least this share of a move happened while it was in power. */
export const GOVERNMENT_SHARE = 0.25;

/** A party is named in a headline if it held power for at least this share of the move. */
export const HEADLINE_PARTY_SHARE = 0.6;

/** Colour for coalitions, caretakers and parties without a confirmed colour. */
export const GREY = '#9aa0a6';

/** V-Dem's Regimes of the World classes, 0–3. */
export const REGIME = ['a closed autocracy', 'an electoral autocracy', 'an electoral democracy', 'a liberal democracy'];

export const REGIME_EXPLAINED = [
  'no meaningful multiparty elections',
  'elections are held, but they are not free and fair',
  'free and fair elections, but weaker checks on the government',
  'free elections, plus courts, parliament and civil liberties that check the government',
];

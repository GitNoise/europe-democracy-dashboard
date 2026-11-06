// Measuring chart text before drawing it, so labels and notes can be laid out without overlaps.

// Sizes and weights match the classes in Chart.svelte; each family is read from a page CSS variable
// (--font-chart unless named), so measuring and drawing always use the same font, whichever one actually loads.
const family = (name = '--font-chart') => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'sans-serif';
export const FONTS = {
  axis: ['400', 11.2],
  partyName: ['800', 15, '--font-display'],   // the focal labels: bigger, in the heading face
  partyYears: ['400', 10.56],
  note: ['500', 12],
  endValue: ['700', 12],
};

let context = null;

/** Width in pixels of `text` set in one of FONTS. */
export function textWidth(text, [weight, size, name]) {
  context ??= document.createElement('canvas').getContext('2d');
  context.font = `${weight} ${size}px ${family(name)}`;
  return context.measureText(String(text)).width;
}

/** Break `text` into lines of at most `maxChars` characters, at spaces. */
export function wrapText(text, maxChars) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

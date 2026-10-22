/**
 * Homoglyph substitution: a word written mostly in one script with a few
 * look-alike letters from another (Latin `paypal` with a Cyrillic `a`) is a
 * classic way to mark or disguise text. Only letters that are visually
 * identical in common fonts are listed, so a fix never changes what a reader
 * sees.
 */

/** Cyrillic letters and the Latin letters they impersonate. */
const CYRILLIC_TO_LATIN = [
  [0x0430, 'a'],
  [0x0435, 'e'],
  [0x043e, 'o'],
  [0x0440, 'p'],
  [0x0441, 'c'],
  [0x0443, 'y'],
  [0x0445, 'x'],
  [0x0455, 's'],
  [0x0456, 'i'],
  [0x0458, 'j'],
  [0x0501, 'd'],
  [0x04bb, 'h'],
  [0x051b, 'q'],
  [0x051d, 'w'],
  [0x04cf, 'l'],
  [0x0410, 'A'],
  [0x0412, 'B'],
  [0x0415, 'E'],
  [0x041a, 'K'],
  [0x041c, 'M'],
  [0x041d, 'H'],
  [0x041e, 'O'],
  [0x0420, 'P'],
  [0x0421, 'C'],
  [0x0422, 'T'],
  [0x0423, 'Y'],
  [0x0425, 'X'],
  [0x0405, 'S'],
  [0x0406, 'I'],
  [0x0408, 'J'],
  [0x051a, 'Q'],
  [0x051c, 'W'],
  [0x04c0, 'I'],
];

/** Greek letters and the Latin letters they impersonate. */
const GREEK_TO_LATIN = [
  [0x0391, 'A'],
  [0x0392, 'B'],
  [0x0395, 'E'],
  [0x0396, 'Z'],
  [0x0397, 'H'],
  [0x0399, 'I'],
  [0x039a, 'K'],
  [0x039c, 'M'],
  [0x039d, 'N'],
  [0x039f, 'O'],
  [0x03a1, 'P'],
  [0x03a4, 'T'],
  [0x03a5, 'Y'],
  [0x03a7, 'X'],
  [0x03b1, 'a'],
  [0x03b9, 'i'],
  [0x03bd, 'v'],
  [0x03bf, 'o'],
  [0x03c1, 'p'],
];

/**
 * @param {Array<[number, string]>} pairs
 * @returns {{ forward: Map<string, string>, backward: Map<string, string> }}
 */
function bidirectional(pairs) {
  const forward = new Map();
  const backward = new Map();
  for (const [codePoint, latin] of pairs) {
    const char = String.fromCodePoint(codePoint);
    forward.set(char, latin);
    if (!backward.has(latin)) {
      backward.set(latin, char);
    }
  }
  return { forward, backward };
}

const cyrillic = bidirectional(CYRILLIC_TO_LATIN);
const greek = bidirectional(GREEK_TO_LATIN);

/** For a word written in `target`, the look-alikes borrowed from `source`. */
const MAPPINGS = {
  Latin: { Cyrillic: cyrillic.forward, Greek: greek.forward },
  Cyrillic: { Latin: cyrillic.backward },
  Greek: { Latin: greek.backward },
};

const SCRIPTS = [
  ['Latin', /^\p{Script=Latin}$/u],
  ['Cyrillic', /^\p{Script=Cyrillic}$/u],
  ['Greek', /^\p{Script=Greek}$/u],
];

const WORD = /[\p{L}\p{M}]+/gu;

/**
 * @param {string} char
 * @returns {string|null} Latin, Cyrillic, Greek, or null for anything else
 */
function scriptOf(char) {
  const match = SCRIPTS.find(([, pattern]) => pattern.test(char));
  return match ? match[0] : null;
}

/**
 * @param {string[]} letters
 * @param {string} target script the word should be written in
 * @returns {string|null} the word rewritten in `target`, or null when some
 *   foreign letter has no look-alike there
 */
function rewriteInto(letters, target) {
  let rewritten = '';
  for (const letter of letters) {
    const script = scriptOf(letter);
    if (script === null || script === target) {
      rewritten += letter;
      continue;
    }
    const replacement = MAPPINGS[target][script]?.get(letter);
    if (!replacement) {
      return null;
    }
    rewritten += replacement;
  }
  return rewritten;
}

/**
 * @param {string[]} letters
 * @returns {string[]} candidate scripts, most frequent first
 */
function rankScripts(letters) {
  const counts = new Map();
  for (const letter of letters) {
    const script = scriptOf(letter);
    if (script) {
      counts.set(script, (counts.get(script) ?? 0) + 1);
    }
  }
  const order = SCRIPTS.map(([name]) => name);
  return [...counts.keys()].sort(
    (left, right) =>
      counts.get(right) - counts.get(left) ||
      order.indexOf(left) - order.indexOf(right)
  );
}

/**
 * Find words that mix Latin, Cyrillic and Greek look-alikes.
 *
 * @param {string} text
 * @returns {Array<{ index: number, original: string, replacement: string }>}
 */
export function findConfusableWords(text) {
  const results = [];
  for (const match of text.matchAll(WORD)) {
    const letters = [...match[0]];
    const ranked = rankScripts(letters);
    if (ranked.length < 2) {
      continue;
    }
    for (const target of ranked) {
      const replacement = rewriteInto(letters, target);
      if (replacement !== null) {
        results.push({ index: match.index, original: match[0], replacement });
        break;
      }
    }
  }
  return results;
}

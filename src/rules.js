/**
 * The catalogue of rules. Each rule has an id used in configuration, a
 * default severity, and says whether `--fix` can repair what it finds.
 *
 * Severities: `error` fails the check, `warn` is reported without failing,
 * `off` disables the rule. `--fix` repairs findings of both reported levels.
 */

/**
 * @typedef {'error'|'warn'|'off'} Severity
 * @typedef {object} RuleInfo
 * @property {string} id
 * @property {Severity} severity default severity
 * @property {boolean} fixable
 * @property {string} summary one-line description
 */

/** @type {RuleInfo[]} */
export const RULES = [
  {
    id: 'provenance-manifest',
    severity: 'error',
    fixable: true,
    summary:
      'C2PA text manifests: armoured comment blocks and U+FEFF plus variation selector wrappers',
  },
  {
    id: 'zero-width',
    severity: 'error',
    fixable: true,
    summary:
      'Zero-width spaces, joiners and word joiners outside emoji and joining scripts',
  },
  {
    id: 'bidi-control',
    severity: 'error',
    fixable: true,
    summary:
      'Bidirectional overrides, embeddings and isolates (Trojan Source) outside right-to-left text',
  },
  {
    id: 'tag-character',
    severity: 'error',
    fixable: true,
    summary:
      'Unicode tag characters (ASCII smuggling) outside emoji flag sequences',
  },
  {
    id: 'variation-selector',
    severity: 'error',
    fixable: true,
    summary:
      'Variation selectors in runs or after characters they cannot modify (byte smuggling)',
  },
  {
    id: 'invisible-format',
    severity: 'error',
    fixable: true,
    summary:
      'Soft hyphens, invisible operators, Hangul fillers and other invisible format characters',
  },
  {
    id: 'private-use',
    severity: 'error',
    fixable: true,
    summary: 'Private-use code points, which have no public meaning',
  },
  {
    id: 'noncharacter',
    severity: 'error',
    fixable: true,
    summary: 'Unicode noncharacters such as U+FFFE and U+FDD0',
  },
  {
    id: 'unassigned',
    severity: 'warn',
    fixable: true,
    summary: 'Code points unassigned in the Unicode version of the runtime',
  },
  {
    id: 'replacement-character',
    severity: 'warn',
    fixable: false,
    summary:
      'U+FFFD left behind by an earlier lossy decoding; the original text is lost',
  },
  {
    id: 'unusual-space',
    severity: 'error',
    fixable: true,
    summary: 'No-break, thin, em and other look-alike spaces',
  },
  {
    id: 'line-separator',
    severity: 'error',
    fixable: true,
    summary: 'U+2028, U+2029 and NEL line breaks',
  },
  {
    id: 'control-character',
    severity: 'error',
    fixable: true,
    summary: 'C0 and C1 control characters other than tab, LF and CR',
  },
  {
    id: 'compatibility-character',
    severity: 'error',
    fixable: true,
    summary:
      'Fullwidth Latin outside CJK text, mathematical alphanumerics and Latin ligatures',
  },
  {
    id: 'confusable',
    severity: 'error',
    fixable: true,
    summary:
      'Words mixing Latin, Cyrillic and Greek look-alike letters (homoglyphs)',
  },
  {
    id: 'combining-marks',
    severity: 'error',
    fixable: true,
    summary: 'Excessive stacks of combining marks on one character',
  },
  {
    id: 'unicode-normalization',
    severity: 'error',
    fixable: true,
    summary: 'Text that is not in Unicode Normalization Form C',
  },
  {
    id: 'ai-artifact',
    severity: 'error',
    fixable: true,
    summary:
      'Leftover chatbot citation markers and tracking parameters such as utm_source=chatgpt.com',
  },
  {
    id: 'mojibake',
    severity: 'error',
    fixable: true,
    summary:
      'UTF-8 text that was decoded as Windows-1252 and saved again, such as "\u00C3\u00A9" for "\u00E9"',
  },
  {
    id: 'escaped-character',
    severity: 'warn',
    fixable: false,
    summary:
      'Escapes such as \\u200B, &#x200B; or %E2%80%8B that write invisible characters in ASCII',
  },
  {
    id: 'typographic-punctuation',
    severity: 'off',
    fixable: true,
    summary: 'Curly quotes, dashes and ellipses, rewritten as plain ASCII',
  },
  {
    id: 'unexpected-script',
    severity: 'error',
    fixable: false,
    summary: 'Letters from scripts outside the configured allowed-scripts',
  },
  {
    id: 'trailing-whitespace',
    severity: 'error',
    fixable: true,
    summary:
      'Spaces and tabs at line ends (whitespace steganography); Markdown hard breaks are kept',
  },
  {
    id: 'line-endings',
    severity: 'error',
    fixable: true,
    summary: 'Line endings that differ from the configured style',
  },
  {
    id: 'final-newline',
    severity: 'error',
    fixable: true,
    summary: 'Missing final newline or trailing blank lines',
  },
  {
    id: 'encoding',
    severity: 'error',
    fixable: true,
    summary: 'Text files not encoded as UTF-8',
  },
  {
    id: 'bom',
    severity: 'error',
    fixable: true,
    summary: 'Byte order mark presence that differs from the configured policy',
  },
  {
    id: 'file-name',
    severity: 'error',
    fixable: false,
    summary:
      'Invisible, look-alike or unnormalized characters in file and directory names',
  },
  {
    id: 'image-metadata',
    severity: 'error',
    fixable: true,
    summary:
      'C2PA manifests, XMP, IPTC, comments and text chunks in PNG and JPEG images; EXIF is kept',
  },
];

export const RULE_IDS = RULES.map((rule) => rule.id);

const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

/**
 * @param {string} id
 * @returns {RuleInfo|undefined}
 */
export const getRule = (id) => RULES_BY_ID.get(id);

export const SEVERITIES = ['error', 'warn', 'off'];

/** @returns {Record<string, Severity>} */
export const defaultSeverities = () =>
  Object.fromEntries(RULES.map((rule) => [rule.id, rule.severity]));

// Prints findings and fixes of the pattern based rules.
import { defaultSeverities } from '../src/rules.js';
import { fixText, scanText } from '../src/text-rules.js';

const options = { severities: defaultSeverities() };
const selectors = [...'C2PATXT\0\x01manifest']
  .map((char) => {
    const byte = char.charCodeAt(0);
    return String.fromCodePoint(
      byte < 16 ? 0xfe00 + byte : 0xe0100 + byte - 16
    );
  })
  .join('');
const samples = {
  cite: 'Paris is big.\u{E200}cite\u{E202}turn0search0\u{E201}\n',
  html: '<p data-start="0" data-end="12">Hello</p>\n',
  utm: 'See https://a.b/c?utm_source=chatgpt.com&x=1\n',
  c2paBlock:
    '# -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AAA -----END C2PA MANIFEST-----\nprint(1)\n',
  c2paWrapper: `Text.\u{FEFF}${selectors}\n`,
  escapes:
    'const a = "\\u200B"; b = "&#x202E;" + "&zwj;" + "%E2%80%8B" + "\\uDB40\\uDC41";\n',
  mojibake:
    'Caf\u{C3}\u{A9} \u{E2}\u{20AC}\u{2122}quoted\u{E2}\u{20AC}\u{2122} \u{C2}\u{B0}C\n',
  legit: 'Fran\u{E7}ais \u{C0} la carte, \u{C2}ge\n',
};
for (const [name, text] of Object.entries(samples)) {
  const found = scanText(text, options).map(
    (edit) => `${edit.rule}: ${edit.message}`
  );
  console.log(name, found, '->', JSON.stringify(fixText(text, options)));
}

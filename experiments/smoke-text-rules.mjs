// Quick manual probe of scanText/fixText on hand-made carrier samples.
import { scanText, fixText } from '../src/text-rules.js';
import { defaultSeverities } from '../src/rules.js';

const options = { severities: defaultSeverities() };
const samples = {
  zwsp: 'Hello\u{200B}world\n',
  emoji: 'Dev \u{1F468}\u{200D}\u{1F4BB} ok \u{2764}\u{FE0F}\n',
  persian: '\u{645}\u{6CC}\u{200C}\u{62E}\u{648}\u{627}\u{647}\u{645}\n',
  tags: 'hi\u{E0068}\u{E0069}\n',
  flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}\n',
  vsRun: 'a\u{1F600}\u{FE0F}\u{E0101}\u{E0102}\n',
  trojan: 'x = 1; // \u{202E} } \u{2066} \n',
  hebrew: '\u{5E9}\u{5DC}\u{5D5}\u{5DD} \u{200F}(1)\n',
  nbsp: 'a\u{A0}b\u{202F}c\n',
  confusable: 'p\u{430}ypal \u{43A}\u{43E}d\n',
  fullwidth:
    '\u{FF21}\u{FF22} \u{65E5}\u{672C}\u{FF12}\u{FF10}\u{FF12}\u{FF14}\u{5E74}\n',
  artifact:
    'See citeturn0search3 and https://x.io/a?utm_source=chatgpt.com&b=1\n',
  nfd: 'e\u{301}\n',
  crlf: 'a\r\nb\n\n\n',
  trailing: 'a  \nb\t\n',
};
for (const [name, text] of Object.entries(samples)) {
  const found = scanText(text, options).map((e) => `${e.rule}:${e.message}`);
  console.log(
    name,
    JSON.stringify(found),
    '->',
    JSON.stringify(fixText(text, options))
  );
}

const tags = [...'secret']
  .map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0)))
  .join('');
const bytes = new TextEncoder().encode('hi!');
const vs = [...bytes]
  .map((b) => String.fromCodePoint(b < 16 ? 0xfe00 + b : 0xe0100 + b - 16))
  .join('');
const sneaky = [...'A'.charCodeAt(0).toString(2).padStart(8, '0')]
  .map((b) => (b === '1' ? '\u{2064}' : '\u{2062}'))
  .join('');
for (const text of [`x${tags}y\n`, `\u{1F600}${vs}\n`, `a${sneaky}b\n`]) {
  console.log(scanText(text, options).map((e) => e.message));
}

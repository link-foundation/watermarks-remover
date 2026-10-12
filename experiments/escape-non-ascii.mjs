// Rewrites every non-ASCII character of the given files as a \u{...}
// escape. Only safe where those characters sit in string literals,
// regular expressions or comments.
import { readFileSync, writeFileSync } from 'node:fs';

for (const path of process.argv.slice(2)) {
  const text = readFileSync(path, 'utf8');
  const escaped = text.replace(
    /[^\0-\x7f]/gu,
    (char) => `\\u{${char.codePointAt(0).toString(16).toUpperCase()}}`
  );
  writeFileSync(path, escaped);
}

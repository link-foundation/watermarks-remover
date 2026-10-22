// Times compiling glob patterns made of many slashes, which CodeQL
// flagged as a polynomial regular expression in src/glob.js.
import { matchesGlob } from '../src/index.js';

for (const length of [5000, 10000, 20000]) {
  const pattern = `${'/'.repeat(length)}a`;
  const start = Date.now();
  matchesGlob('a', pattern);
  console.log(length, `${Date.now() - start} ms`);
}

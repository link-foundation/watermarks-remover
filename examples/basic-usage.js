/**
 * Basic usage example: find hidden characters in a piece of text, show
 * them, and print the cleaned text.
 *
 * Run with any runtime:
 * - Bun: bun examples/basic-usage.js
 * - Node.js: node examples/basic-usage.js
 * - Deno: deno run examples/basic-usage.js
 */

import {
  createLocator,
  escapeInvisible,
  fixText,
  scanText,
} from '../src/index.js';

// Escapes keep this file free of the characters it demonstrates.
const text = [
  'The report\u{200B} is ready\u{00A0}for review.',
  'Our\u{E0054}\u{E0045}\u{E0058}\u{E0054} plan is final.  ',
].join('\n');

console.log('Original text, hidden characters revealed:');
for (const line of text.split('\n')) {
  console.log(`  ${escapeInvisible(line)}`);
}

console.log('\nProblems:');
const locate = createLocator(text);
for (const finding of scanText(text)) {
  const { line, column } = locate(finding.index);
  console.log(
    `  ${line}:${column} ${finding.rule}: ${escapeInvisible(finding.message)}`
  );
}

console.log('\nCleaned text:');
console.log(fixText(text));

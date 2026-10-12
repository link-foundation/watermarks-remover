# claude-artifact-detector

Find and remove the invisible junk that AI chat interfaces leave in text you copy out of them — Claude's HTML class attributes, provider `data-*` flags, zero-width characters, exotic Unicode spaces — and, flagged separately because they are style rather than evidence, smart punctuation and em dashes.

Zero dependencies. TypeScript. Runs in Node and in the browser. MIT.

```bash
npm install claude-artifact-detector
```

```ts
import { detect, clean } from "claude-artifact-detector";

const pasted = '<p class="font-claude-response-body">The results were unambiguous​ — revenue rose 20%.</p>';

detect(pasted);
// [
//   { kind: "claude-html-class", label: "Claude HTML class attributes", count: 1, deterministic: true,  why: "…" },
//   { kind: "zero-width",        label: "Zero-width characters",       count: 1, deterministic: true,  why: "…" },
//   { kind: "em-dash",           label: "Em dashes",                   count: 1, deterministic: false, why: "…" },
// ]

clean(pasted).text;
// '<p>The results were unambiguous - revenue rose 20%.</p>'
```

Or from a terminal, with no install:

```bash
npx claude-artifact-detector essay.md
npx claude-artifact-detector essay.md --json
cat essay.md | npx claude-artifact-detector --clean > essay.clean.md
```

---

## What this does not do

**It does not detect Anthropic's statistical watermark. It cannot remove it either, and neither can anything else you can buy today.**

That is the honest position, and it is worth spelling out because the market around this term is full of products claiming otherwise.

- **Anthropic's mark is distributional, not textual.** In a SynthID-Text-style scheme, a secret key biases the choice between near-equivalent next tokens. The watermark *is* the word choice. There is no character to find and no byte to delete — stripping zero-width characters or swapping em dashes for hyphens has exactly zero effect on it, in the same way repainting a car does not change its VIN.
- **No public detector exists.** Detection requires the key, and Anthropic has not released it. Any product or website that tells you your text "contains a Claude watermark" is guessing, because the check they would need to run is not available to them. So is any product that tells you it *removed* one.
- **What this library finds is real and is what actually gets people caught today.** A paragraph pasted straight out of Claude's web UI into a rich-text editor carries `class="font-claude-response-body"` in the markup. The AO3 "AI detector" site skin that caused a wave of accusations is one CSS selector looking for exactly that. It survives copy-paste, it is trivially greppable, and it has no false positives.

If you want the longer version, with sources: [How does Anthropic's watermarking work](https://claudewatermark.xyz/guides/how-does-anthropic-watermarking-work) and [Why most Claude watermark removers cannot work](https://claudewatermark.xyz/guides/why-most-claude-watermark-removers-cannot-work).

---

## Artifact classes

`deterministic: true` means presence is a fact about the bytes: the characters or attributes are either there or they are not, and there is no judgement call. `deterministic: false` means it is a stylistic tell — real, widely believed, and also something plenty of humans produce on purpose. The library keeps the two apart everywhere: in `Finding.deterministic`, in the CLI report, and in the CLI's exit code, which only fails on the deterministic ones.

| Kind | What it matches | Deterministic |
| --- | --- | --- |
| `claude-html-class` | `class="…claude…"` attributes, single or double quoted, e.g. `font-claude-response-body` | **Yes** |
| `ai-html-attr` | Provider `data-*` attributes: `data-claude-*`, `data-anthropic-*`, `data-gpt-*`, `data-openai-*`, `data-chatgpt-*`, `data-gemini-*`, `data-start`, `data-end`, the whole `data-is-*` family (`data-is-streaming`, `data-is-last-node`, …), `data-message-author-role`, `data-testid` | **Yes** |
| `zero-width` | U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 word joiner, U+FEFF BOM | **Yes** |
| `nbsp` | U+00A0 non-breaking space | **Yes** |
| `exotic-space` | U+2000–U+200A (en/em/thin/hair/figure spaces), U+202F narrow NBSP, U+205F medium math space, U+3000 ideographic space | **Yes** |
| `smart-punctuation` | Curly quotes `‘ ’ ‚ ‛ “ ” „ ‟`, ellipsis `…`, non-breaking hyphen `‑` | No — stylistic |
| `em-dash` | `—` | No — stylistic |

A deterministic finding means the text passed through something that stamps markup or invisible characters into it. A stylistic finding means somebody, possibly a person with taste, used an em dash.

---

## API

### `detect(text: string): Finding[]`

Non-destructive scan. Returns one `Finding` per class that is actually present; classes with a count of zero are omitted.

```ts
interface Finding {
  kind: ArtifactKind;      // "claude-html-class" | "ai-html-attr" | "zero-width" | …
  label: string;           // "Claude HTML class attributes"
  count: number;           // how many characters/attributes matched
  deterministic: boolean;  // fact about the bytes vs stylistic tell
  why: string;             // one-paragraph explanation, safe to show a user
}
```

Cheap enough to run on every keystroke — around 11ms on 200KB of prose — so you can wire it straight into a `<textarea>` handler without debouncing for correctness.

### `clean(text: string, options?: CleanOptions): { text: string; removed: Finding[] }`

Removes the artifacts and returns the cleaned text alongside the findings it **actually acted on**. If you disable a class, it does not appear in `removed`; a cleaner that reports work it did not do is worse than one that does nothing.

```ts
interface CleanOptions {
  stripHtmlArtifacts?: boolean; // default true — class/data-* attributes
  stripZeroWidth?: boolean;     // default true
  normalizeSpaces?: boolean;    // default true — NBSP and exotic spaces → " "
  normalizeQuotes?: boolean;    // default true — curly → straight, … → ...
  replaceEmDashes?: boolean;    // default true — "a — b" → "a - b"
}
```

Cleaning is idempotent, and `detect(clean(text).text)` returns `[]` — there is a test for exactly that.

```ts
const { text, removed } = clean(input, { replaceEmDashes: false });
```

### Also exported

- `ARTIFACT_CLASSES` — the full static table above, for documentation and settings UIs that need every class, not just the ones a given document happens to contain.
- `describe(kind)` — the static description of one class, without running a scan.
- `total(findings)` — sum of counts, for callers that just want a number.
- `DEFAULT_CLEAN_OPTIONS`, and the `ArtifactKind`, `Finding`, `CleanOptions`, `CleanResult` types.

---

## CLI

```
artifact-detector <file>            Report artifacts found in <file>
cat file.txt | artifact-detector    Read from stdin
artifact-detector <file> --clean    Print the cleaned text to stdout
artifact-detector <file> --json     Machine-readable report

Options:
  --json              Emit JSON instead of a human report
  --clean             Output cleaned text (stdout) instead of a report
  --keep-em-dashes    Do not replace em dashes when cleaning
  --keep-quotes       Do not normalise curly quotes and ellipses when cleaning
  -h, --help
  -v, --version
```

```
$ npx claude-artifact-detector essay.md
essay.md: 7 artifact(s) found

     1  Claude HTML class attributes  [deterministic]
     1  AI editor data-attributes  [deterministic]
     1  Zero-width characters  [deterministic]
     1  Non-breaking spaces  [deterministic]
     2  Typographic punctuation  [stylistic]
     1  Em dashes  [stylistic]
```

**Exit codes** — `0` no deterministic artifacts, `1` at least one deterministic artifact, `2` usage or I/O error. Stylistic findings never fail the run: failing somebody's pipeline over an em dash is an opinion masquerading as a check.

With `--clean`, the cleaned text goes to stdout on its own and the summary goes to stderr, so `--clean > out.txt` produces a file with nothing but the text in it.

Use it as a pre-commit hook or a CI step to keep pasted markup out of a repo:

```yaml
- run: git ls-files '*.md' | xargs -n1 npx claude-artifact-detector
```

---

## Browser use

There are no Node built-ins in the library entry point, so it works unchanged in a paste handler. The text never leaves the page:

```ts
textarea.addEventListener("paste", (e) => {
  const pasted = e.clipboardData?.getData("text/plain") ?? "";
  const findings = detect(pasted);
  if (findings.some((f) => f.deterministic)) warn(findings);
});
```

---

## Where this comes from

This is the deterministic engine behind **[claudewatermark.xyz](https://claudewatermark.xyz)**, a free checker that runs the same code in your browser and never uploads your text. Extracted so you can run it in CI, in an editor plugin, or from a shell pipe.

Background reading, all straight answers with no removal claims attached:

- [claudewatermark.xyz](https://claudewatermark.xyz) — the free checker
- [What Anthropic's Claude watermark actually is](https://claudewatermark.xyz/claude-watermark)
- [How to check for the Claude watermark](https://claudewatermark.xyz/guides/how-to-check-for-claude-watermark)
- [Is there an AI checker for Claude?](https://claudewatermark.xyz/guides/is-there-an-ai-checker-for-claude)
- [How does Anthropic's watermarking work?](https://claudewatermark.xyz/guides/how-does-anthropic-watermarking-work)
- [Why most Claude watermark removers cannot work](https://claudewatermark.xyz/guides/why-most-claude-watermark-removers-cannot-work)

## Development

```bash
npm run build   # tsc → dist/
npm test        # compiles and runs node:test against the compiled output
```

Tests run against the built JavaScript rather than the TypeScript source, so what is tested is exactly what ships.

## License

MIT — see [LICENSE](./LICENSE).

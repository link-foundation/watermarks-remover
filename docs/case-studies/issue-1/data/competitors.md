# Competitor and Prior-Art Survey: Text-Hygiene / Invisible-Unicode / Normalization Tools

Research date: 2026-10-12. Scope: tools, services and libraries related to an open-source, CI/CD-first Node/npm CLI that detects and fixes (`--fix`) AI-watermark / invisible Unicode (zero-width, bidi controls, tag characters, variation selectors, exotic spaces such as U+202F, soft hyphen, homoglyphs), BOM, line endings, encoding, trailing whitespace and final newline.

Reference project: https://github.com/guillaumemeyer/watermarks-remover

Conventions:
- "CI" = has a non-interactive check mode with meaningful exit codes and/or machine-readable output (JSON/SARIF/annotations), or ships a GitHub Action / pre-commit hook.
- "Fix" = can rewrite input (in place or to a new file).
- **[UNVERIFIED]** = stated from general knowledge or a secondary source; the primary page was not fetched or did not confirm it.
- Licenses are as shown on the repo/registry page at research time. NOASSERTION = GitHub could not detect a license.

---

## Category 1: AI-watermark and invisible-character removers/detectors

### 1.1 guillaumemeyer/watermarks-remover (reference project)
- URL: https://github.com/guillaumemeyer/watermarks-remover
- Ecosystem: Python 3.10+, standard library only. License: MIT. About 23.9k stars.
- Detects/fixes:
  - Layer A (deterministic character work):
    - invisible Unicode, exotic spaces, bidi controls, tag characters
    - reserved Default_Ignorable code points (U+2065, U+FFF0-FFF8, U+E0000, U+E0080-E00FF, U+E01F0-E0FFF) and noncharacters
    - "blank carrier" letters U+180F, U+3164 and U+FFA0
    - a general-category Cf catch-all
  - Layer B: LLM paraphrase / masked-LM rewrite to weaken statistical watermarks such as SynthID-Text and KGW.
  - File metadata: C2PA, EXIF and XMP across many file formats.
- Context-aware preservation:
  - Egyptian hieroglyph quadrat, Duployan and musical-notation format controls are kept when adjacent to their own script; `--strip-emoji-glue` removes them.
  - VS16 is kept after emoji, script joiners (ZWJ/ZWNJ in Indic/Persian) are preserved, and Arabic Cf characters are flagged rather than silently removed.
  - French NBSP typography is preserved.
- CI: yes.
  - `audit_dir.py` runs a multi-worker directory audit with SARIF 2.1.0 output; `audit_website.py --sarif` audits a website.
  - pre-commit hooks: a check hook, plus an opt-in clean hook that exits 1 so the user must re-stage.
  - Claude Code plugin, agent skills, and a PostToolUse hook (check mode exits 2).
  - Exit code 3 when the cleaner crashes.
- Fix: yes. `--in-place` with a `.bak` backup, `--only-changed`, `-q`.
- Notable features to copy:
  - Refuses binary input and never auto-cleans unknown formats.
  - Fail-soft detectors report `available: false` instead of crashing.
  - Distinct exit code for internal crash versus findings.
  - Context-preserving rules (emoji VS16, script joiners, French NBSP).
  - SARIF output; HTTP service with an OpenAPI spec; Docker image.

### 1.2 sageuntethered/chatgpt-watermark-remover
- URL: https://github.com/sageuntethered/chatgpt-watermark-remover
- Ecosystem: JavaScript CLI and library with zero dependencies, plus a Python port. License: MIT.
- Detects/fixes:
  - Removed: U+200B, U+200C, U+FEFF, U+2060-2064, U+180E, U+00AD; bidi controls (U+200E/F, U+202A-202E, U+2066-2069); tag characters; variation selectors.
  - Replaced with a normal space: U+00A0, U+202F, U+2000-200A, U+205F, U+3000, U+1680.
  - Keeps ZWJ and U+FE0F inside emoji sequences (`--keep-emoji=false` disables this).
  - Optional `--smart-punctuation` normalization.
- CI: `--scan` exits 1 when something is found. The scan report lists each character's code point, name and count. No JSON output.
- Fix: `--write`.
- Copy: separate classes for "remove" and "replace with space"; emoji-aware keep rule; per-character counts.

### 1.3 spencermountain/out-of-character
- URL: https://github.com/spencermountain/out-of-character
- Ecosystem: npm (`out-of-character`, v2.3.0). License: MIT.
- Detects/fixes: characters typed as Invisible, Whitespace, Bidi, Variation, Tag, Separator, Line Break and Visible.
- API:
  - `detect()` returns `{name, code, type, offset, replacement}`.
  - `replace(str, {exclude: ['Bidi', 'U+200B']})` excludes by type or by code point.
  - Preserves emoji, keycap, CJK and Mongolian sequences.
- CLI: `--replace` or `--remove`, `--recursive`, glob arguments. CI: no dedicated mode.
- Fix: yes.
- Copy: each detection carries its own suggested replacement; exclusions can name a type or a code point.

### 1.4 OfirYC/claude-watermark-checker (npm `claude-artifact-detector`)
- URL: https://github.com/OfirYC/claude-watermark-checker
- Ecosystem: TypeScript, zero dependencies. License: MIT.
- Detects:
  - `claude-html-class` (`font-claude-response-body`)
  - `ai-html-attr` (`data-claude-*`, `data-openai-*`, `data-start`/`data-end`, `data-is-*`)
  - zero-width, NBSP, exotic-space
  - smart punctuation and em-dash, both flagged as stylistic (`deterministic: false`)
- Options: `stripHtmlArtifacts`, `stripZeroWidth`, `normalizeSpaces`, `normalizeQuotes`, `replaceEmDashes`.
- CLI: `--json`, `--clean`, `--keep-em-dashes`, stdin.
- CI: JSON output. Fix: `--clean`.
- Copy:
  - A `deterministic` flag separates proof from heuristic.
  - An idempotency test asserts `detect(clean(x)) == []`.
  - States plainly that statistical watermarks cannot be detected this way.
  - Detects HTML provenance attributes left behind by copy/paste.

### 1.5 haidrrrry/claude-watermark-remover
- URL: https://github.com/haidrrrry/claude-watermark-remover
- Ecosystem: Python. License: NOASSERTION. Fork or derivative of the reference project.
- Claims detection of C2PA and generator tags from 30+ AI tools.
- Findings carry confidence labels such as "[probable]".
- Copy: confidence labels on each finding.

### 1.6 mohityadav8/ai-watermark-remover
- URL: https://github.com/mohityadav8/ai-watermark-remover
- Ecosystem: Python. License: NOASSERTION. Fork-like derivative.
- Adds a web UI with nginx and Docker deployment, and a Claude Code PostToolUse hook.
- Copy: a hosted web UI built from the same core.

### 1.7 Dhirenderchoudhary/unmarkk (`unmark`)
- URL: https://github.com/Dhirenderchoudhary/unmarkk
- Ecosystem: TypeScript. License: MIT.
- Design: the core engine performs no I/O (bytes in, bytes out). No config files, cache or telemetry.
- Commands:
  - `inspect --stylometry`
  - `clean --in-place` (writes a `.bak` backup)
  - `scan --quiet --json`
  - `audit-site <sitemap>`
  - `rewrite` (local LLM through ollama)
- Removes: `data-ai-*` attributes, JSON-LD provenance, Private Use Area characters, exotic spaces.
- CI: `scan --json`. Fix: `clean --in-place`.
- Copy: a pure, I/O-free core; sitemap auditing; JSON-LD provenance stripping; a stylometry report.

### 1.8 ivanusto/unmark-web
- URL: https://github.com/ivanusto/unmark-web
- Ecosystem: browser JavaScript port of the upstream project, with a parity test suite. License: MIT.
- Features:
  - A "Watermark Inspector" shows results before and after cleaning.
  - Each detector reports `detected`, `clean`, `uncertain` or `unavailable`; heuristic detectors can never report more than "uncertain".
  - Optional NFKC normalization.
- Copy: four-state detector status; heuristic results capped at "uncertain"; cross-implementation parity tests (useful if we ship CLI and web builds).

### 1.9 Embrace The Red - ASCII Smuggler
- URLs:
  - https://embracethered.com/blog/ascii-smuggler.html
  - https://embracethered.com/blog/posts/2025/sneaky-bits-and-ascii-smuggler/
- Ecosystem: web tool. License: not stated.
- Encodes and decodes three hidden-text schemes:
  - Unicode Tags (U+E0000-E007F, with optional BEGIN/END markers)
  - Variation Selectors
  - "Sneaky Bits" (U+2062 = 0, U+2064 = 1)
- Also detects other invisible characters.
- Features: highlight mode, automatic decoding, URL decoding, and a debug view in binary, hex and Unicode with counts per type.
- Copy: decode and show the hidden payload, not just its presence; support Sneaky Bits.

### 1.10 Originality.ai Invisible Text Detector and Remover
- URL: https://originality.ai/blog/invisible-text-detector-remover
- Ecosystem: web service, runs locally in the browser. Proprietary.
- Covers 87 characters, split into "visible special" (em dashes, smart quotes, special spaces) and invisible.
- Fixing options: fix all, remove all invisible, or fix selectively.
  - Tabs become 4 spaces.
  - Line separators become line breaks.
- States that removing these characters does not change AI-detection results.
- Copy: selective per-class fixing; mapping U+2028/U+2029 to newlines rather than deleting them.

### 1.11 GPTCleanup - ChatGPT watermark remover
- URL: https://www.gptcleanup.com/chatgpt-watermark-remover
- Ecosystem: web service. Proprietary.
- Covers 421 characters and shows each code point with its count.
- Each dash type (en, em, 2-em, 3-em) gets its own policy: convert to hyphen, remove, or keep.
- Changes are reviewed and accepted before they apply. A paid "phrase" pass is also offered.
- Copy: a configurable policy per dash type; an interactive review mode, which in a CLI could be `--interactive` or a diff preview.

### 1.12 everychar.com Invisible Character Remover
- URL: https://everychar.com/invisible-character-remover/
- Web tool that removes the entire Unicode Format (Cf) category and shows character counts.
- Copy: an option to remove a whole general category.

### 1.13 ChatGPT o3/o4-mini U+202F reports (context, not a tool)
- In April 2025, newer OpenAI models were reported to emit U+202F (NARROW NO-BREAK SPACE). OpenAI described it as a bug, not a watermark.
  - https://www.indiehackers.com/post/what-is-the-narrow-no-break-space-in-chatgpt-KyFE9bkiCLENinayEno8
  - https://itc.ua/en/news/the-new-chatgpt-models-leave-extra-characters-in-the-text-they-can-be-detected-through-word/amp/
- A Chrome extension targets the same issue: https://chromewebstore.google.com/detail/flncongohpenkneficileknmhdibcepf
- Relevance: U+202F must be treated as a first-class exotic space, with an exception for French typography.

### 1.14 LeonardSEO/chatgpt-watermark-remover
- URL: https://github.com/LeonardSEO/chatgpt-watermark-remover
- Chrome extension in TypeScript that cleans text in the browser. No CI.

### 1.15 umpox/zero-width-detection
- URL: https://github.com/umpox/zero-width-detection
- About 1.2k stars. Demonstrates fingerprinting a username into text with zero-width characters, then detecting it.
- Use as a threat reference and a test-corpus source.

### 1.16 trubitsyn/go-zero-width
- URL: https://github.com/trubitsyn/go-zero-width
- Go library. License: Apache-2.0.
- Removes only U+200B, U+FEFF, U+200D and U+200C. Narrow in scope; useful as a baseline.

### 1.17 DavidJacobson/SafeText
- URL: https://github.com/DavidJacobson/SafeText
- Python. License: MIT.
- Detects and removes homoglyphs, zero-width characters and unusual spaces. Also warns on regional spellings (for example "colour") as a leak/anti-fingerprinting measure.
- Writes cleaned output to a `.safe` file.
- Copy: an optional "fingerprint risk" warning class.

### 1.18 flopp/invisible-characters
- URL: https://github.com/flopp/invisible-characters
- Static reference website that lists invisible characters.
- Copy: use it to cross-check our character list.

### 1.19 nisconder/paste-xray
- URL: https://github.com/nisconder/paste-xray
- Web app plus a Chrome/Edge extension. License: MIT.
- Detects:
  - invisible characters and bidi controls
  - homoglyphs, with logic to avoid flagging ordinary foreign-language text
  - special spaces and abnormal line breaks
  - hidden HTML in the clipboard
  - U+FFFD replacement characters
- Three risk tiers. Cleaning options are off by default.
- Exports a standalone HTML report. Input limit is 5 MB.
- Copy: flag U+FFFD (evidence of earlier encoding damage); an HTML report format; homoglyph detection that avoids false positives on foreign text.

### 1.20 didrod205/unspook
- URL: https://github.com/didrod205/unspook
- npm package plus a web app. License: MIT.
- API: `scan`, `clean`, `reveal` (renders "a[U+200B]b"), `report` (with line and caret), `stats`.
- CLI flags:
  - `-w` rewrites in place.
  - `--reveal` prints the escaped form.
  - `--scan` exits 1 on findings.
  - `--report` prints compiler-style DANGER diagnostics with a caret.
  - `--aggressive` also normalizes smart quotes, homoglyphs and whitespace.
- Line and column positions are counted in code points.
- Copy: a reveal/escape view; compiler-style caret diagnostics; an `--aggressive` tier; explicit column semantics.

### 1.21 Ayubjon/glyphguard
- URL: https://github.com/Ayubjon/glyphguard
- npm, zero dependencies. License: MIT.
- Categories and severities:
  - tag: critical
  - bidi, including U+200E/F and U+061C: critical
  - zero-width: high
  - variation-selector: high
  - invisible: medium
  - private-use: medium
  - homoglyph: opt-in
- Commands: `scan`, `clean`, `decode` (reveals tag and variation-selector payloads).
- Flags: `--json`, `--homoglyphs`, `-o`, `-q`, stdin input.
- API: `scan`, `decodeHidden`, `sanitize({replacement})`, `detectHomoglyphs`.
- Copy: a severity per category; a `decode` subcommand; a configurable replacement character.

### 1.22 jinwovo/secondsight
- URL: https://github.com/jinwovo/secondsight
- License: MIT.
- Decodes hidden payloads and flags their intent: instruction override, exfiltration, credential paths.
- Also detects hidden CSS text, machine-addressed comments, base64-encoded instructions, deceptive links and image-based exfiltration.
- `--compare a b` diffs two copies of a document to isolate per-recipient fingerprints.
- Leaves Korean, Russian, Arabic and emoji text untouched.
- Flags: `--fix`, `--json`, `--no-gitignore` (gitignore is respected by default).
- Copy: compare mode for fingerprint isolation; payload intent classification; gitignore awareness.

### 1.23 antonsoo/ghostchars
- URL: https://github.com/antonsoo/ghostchars
- TypeScript. License: MIT.
- Rules:
  - `bidi-control`, `bidi-mark`, `bidi-unbalanced`
  - `tag-smuggling` (valid emoji tag sequences are allowed)
  - `variation-selector-smuggling`, `variation-selector-stray`
  - `unusual-whitespace` (allows French NBSP before ; : ! ? and inside « »)
  - `control-character`
  - `styled-text` (mathematical alphanumeric and fullwidth alphabets)
- Output formats: pretty, json, sarif, github, summary.
- Fix: `--fix` and `--dry-run`. Config file `.ghostcharsrc.json`; `reveal` subcommand; GitHub Action; pre-commit hook.
- Reports finding hidden payloads in 3 of 83,494 prompts in its own study.
- The closest feature-for-feature competitor in the npm space. Copy: the unbalanced-bidi rule; styled-text detection; the French NBSP exception; valid-flag-sequence allowance; the five output formats.

### 1.24 ByteBunny777/Docguard
- URL: https://github.com/ByteBunny777/Docguard
- Go. License: MIT.
- Detects tag smuggling (and decodes it), invisible-character clusters, Latin/Cyrillic homoglyphs, hidden HTML/CSS, prompt-injection phrases and base64 blobs.
- Severity levels and a CI mode.

### 1.25 ngmisl/vibe-condom
- URL: https://github.com/ngmisl/vibe-condom
- Go. License: MIT.
- Detects control characters, zero-width, bidi, tags, base64 (heuristic, with optional decoding via `-decode-base64`) and mixed-script text.
- Can scan a remote git repository. Flags: `-exts` (extension filter), `-skip-check`. Ships a GitHub Action.
- Copy: scanning a remote repository URL.

### 1.26 raulkivi/unicode-smuggling-guard
- URL: https://github.com/raulkivi/unicode-smuggling-guard
- Python, zero dependencies. License: MIT.
- Categories:
  - tag and variation-selector payloads (decoded)
  - bidi, zero-width, control
  - invisible: Hangul fillers, Khmer U+17B4-17B5, U+2800 braille blank, U+FFFC, line/paragraph separators
  - control-token: chat-template tokens such as `<|im_start|>` and `[INST]`
- `--preset agent-files` targets CLAUDE.md, SKILL.md, AGENTS.md, `.cursor/`, copilot-instructions, mcp.json and similar files.
- Output: `--format text|github`; `--summary` writes to `$GITHUB_STEP_SUMMARY`. Exit codes 0, 1 and 2.
- Allowlist rules:
  - a single FE0E/FE0F after an emoji or keycap
  - one ideographic variation selector after a CJK ideograph
  - ZWJ in emoji and in Persian/Indic text
  - the England, Scotland and Wales flag tag sequences
  - a BOM at the start of a file
- Output is escaped for the terminal, for GitHub annotations (encoding %, CR and LF) and for Markdown.
- Reads UTF-16/32 files when a BOM is present. Unreadable files count as errors (fail-closed).
- Copy: the agent-files preset; chat-template token detection; GitHub step summary; injection-safe output escaping; fail-closed reading; a precise allowlist.

### 1.27 000wq123/boundaryguard
- URL: https://github.com/000wq123/boundaryguard
- Python. License: MIT.
- Commands: `scan`, `check` (exits 0/1/2), `inspect "string"`, `sanitize -o`.
- Policies:
  - `security`
  - `preserve_rtl`: keeps LRM/RLM/ALM and ZWNJ/ZWJ.
- JSON output carries a `schemaVersion`. SARIF output.
- Skipped files are listed explicitly (fail-closed). Hostile filenames are escaped in output.
- Copy: named policies; a versioned JSON schema; an explicit skipped-files list; inspecting an inline string.

### 1.28 wppoland/hidden-text-detector
- URL: https://github.com/wppoland/hidden-text-detector
- Finds hidden text in PDF and DOCX documents: white-on-white text, tiny fonts, off-page text and invisible render mode.
- Out of scope for plain text, but a possible future document mode.

### 1.29 Minor and related tools (seen, briefly reviewed)
- Morfasco/search-sanitizer, FerrowAI/text-sanitizer, canonicalmg/reverse-captcha-eval. Small sanitizers and evaluation harnesses with no unique features beyond those listed above.
  - https://github.com/Morfasco/search-sanitizer
  - https://github.com/FerrowAI/text-sanitizer
  - https://github.com/canonicalmg/reverse-captcha-eval
- Encoders and steganography tools. These are threat references and test-fixture generators, not competitors:
  - https://github.com/dwisiswant0/unch
  - https://github.com/foobuzz/ium
  - https://github.com/LynnColeArt/emoji-encoder (variation-selector byte smuggling)
  - https://github.com/SurceBeats/GhostInk
  - https://github.com/chinmay29hub/stegmoji
  - https://github.com/redshoga/zero-width-watermark

---

## Category 2: Source-code security scanners (Trojan Source, bidi, invisible characters, GlassWorm)

### 2.1 nickboucher/trojan-source
- URLs: https://github.com/nickboucher/trojan-source and https://trojansource.codes
- License: MIT. About 1.3k stars.
- Proof-of-concept code from the Trojan Source paper (CVE-2021-42574 for bidi, CVE-2021-42694 for homoglyphs) in many languages.
- Copy: use the PoC files as a regression corpus.

### 2.2 lirantal/anti-trojan-source
- URL: https://github.com/lirantal/anti-trojan-source
- npm (`anti-trojan-source`, v1.13.0). License: Apache-2.0.
- Detects:
  - bidi controls
  - every Cf character, and every Cc character except TAB, LF and CR. Detection is by category, so new Unicode versions are covered automatically.
  - tag characters and variation selectors (high severity)
  - 285 explicit confusable characters
  - low-severity homoglyphs with `--extended` or `--all`
- Input: `--files` globs, explicit paths, or stdin.
- Output: `--verbose` prints line, column, code point, name, category and a snippet; `--json`.
- Exit codes 0/1. No fix mode.
- API: `hasConfusables({sourceText, detailed, extended})`, `hasConfusablesInFiles`.
- Ships a pre-commit hook.
- Copy: category-based detection; rich verbose diagnostics. Its missing `--fix` is a gap we can fill.

### 2.3 eslint-plugin-anti-trojan-source
- URL: https://github.com/lirantal/eslint-plugin-anti-trojan-source
- npm, v1.1.7. License: Apache-2.0.
- ESLint rule wrapping the scanner above.
- Copy: ship an ESLint plugin built from our core.

### 2.4 eslint-plugin-security: `detect-bidi-characters`
- URL: https://github.com/eslint-community/eslint-plugin-security
- npm, v4.2.0. License: Apache-2.0.
- Flags Trojan Source bidi characters in JavaScript source.

### 2.5 GitHub bidirectional-text warning
- URL: https://github.blog/changelog/2021-10-31-warning-about-bidirectional-unicode-text/
- Since 2021-10-31, GitHub shows a warning banner when a viewed file contains bidi Unicode text. It does not list the code points.
- Copy: produce a similar banner-style message in PR comments and job summaries, but one that lists the code points.

### 2.6 VS Code `editor.unicodeHighlight`
- URL: https://code.visualstudio.com/updates/v1_63
- Built-in since VS Code 1.63.
- Settings:
  - `invisibleCharacters`
  - `ambiguousCharacters` (depends on locale and font)
  - `nonBasicASCII`
  - `allowedCharacters`, `allowedLocales`
  - `includeComments`, `includeStrings`
- Restricted Mode highlights all non-ASCII characters. Highlighting is off by default in Markdown.
- Copy: a locale-aware ambiguous-character allowlist; separate toggles for comments and strings.

### 2.7 Gremlins tracker (VS Code)
- URL: https://marketplace.visualstudio.com/items?itemName=nhoizey.gremlins
- License: MIT.
- Color-coded severity, hover hints and gutter icons. `gremlins.showInProblemPane` sends findings to the Problems panel.
- Custom entries in `gremlins.characters` accept `zeroWidth`, `description`, `level` and `hideGutterIcon`. Per-language overrides are supported. No fix.
- Copy: user-defined characters with their own description and severity; per-language overrides.

### 2.8 yusufdanis/hidden-character-detector (VS Code)
- URL: https://github.com/yusufdanis/hidden-character-detector
- License: MIT.
- Detects binary-encoded payloads in runs of 8 or more zero-width characters.
- Scans the workspace in the background and on save, with exclude globs.
- Copy: a heuristic for zero-width binary encoding.

### 2.9 Other editor extensions
- shaneray InvisibleCharacterVisualizer (Visual Studio, C#). **[UNVERIFIED details]**
- resatcaner-sp/reveal-unicode-poisoning (VS Code): https://github.com/resatcaner-sp/reveal-unicode-poisoning **[UNVERIFIED details]**

### 2.10 ESLint core and @stylistic rules
- Rule docs: https://eslint.org/docs/latest/rules/no-irregular-whitespace , https://eslint.org/docs/latest/rules/no-misleading-character-class , https://eslint.org/docs/latest/rules/unicode-bom , https://eslint.style/rules
- `no-irregular-whitespace`
  - Flags: VT, FF, NEL, NBSP, U+1680, U+180E, U+2000-200B, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF.
  - Options: `skipStrings` (default true), `skipComments`, `skipRegExps`, `skipTemplates`, `skipJSXText`.
  - Not auto-fixable.
- `no-misleading-character-class`: flags multi-code-point characters inside regex character classes. Fixes are manual or offered as suggestions.
- `unicode-bom`: `always` or `never`; auto-fixable.
- @stylistic rules:
  - `linebreak-style` (`unix` or `windows`; also applies to CSS, Markdown and JSON through ESLint language plugins)
  - `no-trailing-spaces` (`skipBlankLines`, `ignoreComments`)
  - `eol-last`
  - `no-multiple-empty-lines` (`max`, `maxEOF`, `maxBOF`)
  - `no-tabs`
- Copy: per-context skipping (strings, comments, regex, templates); a cap on blank lines at EOF and BOF.

### 2.11 rustc lints
- URL: https://doc.rust-lang.org/rustc/lints/listing/deny-by-default.html
- `text_direction_codepoint_in_literal` and `text_direction_codepoint_in_comment` are deny-by-default. They cover U+202A-202E and U+2066-2069. The suggested fix is to escape the character, e.g. `\u{202e}`.
- `confusable_idents`, `mixed_script_confusables` and `uncommon_codepoints` also exist. **[UNVERIFIED in this session; from general knowledge]**
- Copy: an "escape instead of delete" fix mode for string literals.

### 2.12 Clippy
- Source: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/unicode.rs
- `invisible_characters` (correctness): zero-width characters and soft hyphen in literals.
- `non_ascii_literal` (restriction): suggests an escape such as `\u{20ac}`.
- `unicode_not_nfc` (pedantic): flags string literals that are not NFC.
- Copy: an NFC check and an escape-style fix.

### 2.13 GCC `-Wbidi-chars`
- URL: https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html
- Values: `none`, `unpaired` (the default), `any`, `ucn`. `ucn` also checks escaped forms (`‮`).
- Copy: an "unpaired only" mode and detection of escaped forms.

### 2.14 clang-tidy
- URL: https://clang.llvm.org/extra/clang-tidy/checks/misc/misleading-bidirectional.html
- `misc-misleading-bidirectional` flags unterminated bidi sequences.
- Related checks: `misc-misleading-identifier` and `misc-confusable-identifiers` (UTS #39 skeletons).

### 2.15 Go: breml/bidichk
- URL: https://github.com/breml/bidichk
- License: MIT.
- Checks the 9 bidi control characters; `--disallowed-runes` selects which. Runs as part of golangci-lint.
- No equivalent `go vet` check was found. **[UNVERIFIED that none exists]**

### 2.16 Semgrep rule `contains-bidirectional-characters`
- URL: https://registry.semgrep.dev/rule/generic.unicode.security.bidi.contains-bidirectional-characters
- Rule ID `generic.unicode.security.bidi.contains-bidirectional-characters`. CWE-94, LOW confidence, WARNING severity.
- Language-agnostic; part of the supply-chain ruleset. Rule license: Commons Clause / LGPL-2.1.
- Copy: CWE tags in SARIF results.

### 2.17 Ruff
- URL: https://docs.astral.sh/ruff/rules/
- Rules:
  - RUF001, RUF002, RUF003: ambiguous Unicode characters in strings, docstrings and comments. Covers characters confusable with ASCII; preview mode adds non-preferred forms such as OHM SIGN. Configured with `lint.allowed-confusables`. No fix.
  - PLE2502: bidirectional Unicode.
  - PLE2510-PLE2515: invalid-character-backspace, -sub, -esc, -nul and -zero-width-space. "Fix is sometimes available."
  - W291 trailing whitespace, W292 missing newline at end of file, W293 whitespace on a blank line. Fix always available.
- Copy: a per-context split (string, docstring/comment, code); a confusables allowlist.

### 2.18 Pylint
- URL: https://pylint.readthedocs.io/en/latest/user_guide/messages/
- Messages:
  - E2501 invalid-unicode-codec
  - E2502 bidirectional-unicode
  - E2510-E2515 invalid-character-* (backspace, carriage-return, esc, nul, sub, zero-width-space)
  - C2503 bad-file-encoding (non-UTF-8 encoding declaration)

### 2.19 ShellCheck
- URLs:
  - https://www.shellcheck.net/wiki/SC1018
  - wiki pages under https://github.com/koalaman/shellcheck/wiki
- Checks:
  - SC1018: Unicode non-breaking space.
  - SC1017: literal carriage return ("Run script through `tr -d '\r'`").
  - SC1082: UTF-8 BOM.
  - SC1100: Unicode dash ("Delete and retype as ASCII minus").
  - SC1015 and SC1016: Unicode double and single quote.
  - SC1110 and SC1111: Unicode quote.
- Copy: treat Unicode dashes and quotes in shell scripts and code blocks as errors, not just style issues.

### 2.20 GlassWorm and variation-selector supply-chain scanners
- **afine-com/glassworm-hunter**
  - URL: https://github.com/afine-com/glassworm-hunter
  - Python. License: MIT.
  - Detects:
    - variation-selector runs, U+3164 and bidi controls
    - decoder patterns (`codePointAt` combined with variation-selector arithmetic)
    - `eval`, credential access, and C2 channels (Solana RPC, Google Calendar, WebRTC)
  - Ships an IOC database: 21 extensions, 4 npm packages, 14 IPs and 3 wallets.
  - Severities from CRITICAL to LOW. Output: console, JSON or SARIF. Exit codes 0/1/2. Config file `.glassworm.yml`.
  - Works offline except for the `update` command.
  - Scans VS Code, Cursor and Codium extension folders, node_modules, site-packages and git repositories.
  - Copy: detecting the decoder code next to the payload; scan targets for installed extensions and node_modules.
- **tkm112345/invisible-unicode-check** (GitHub Action)
  - URL: https://github.com/tkm112345/invisible-unicode-check
  - License: MIT; zero npm dependencies.
  - Critical rules:
    - IUC001 bidi
    - IUC002 tag
    - IUC003 variation-selector runs of 3 or more per line
    - IUC004 Private Use Area
    - IUC007 U+2028/U+2029
    - IUC008 Cc controls, including ESC
    - IUC009 noncharacters
  - Warning rules:
    - IUC005 invisible format character
    - IUC006 misplaced BOM
    - IUC010 deceptive space, including U+2800
    - IUC011 runs of 5 or more combining marks (Zalgo)
    - IUC012 mixed-script word
  - Diff-aware: critical rules run on every line, warning rules only on changed lines.
  - `exclude` globs and per-path `ignore-rules` (`glob:RULE_ID`); unknown rule IDs trigger a warning.
  - Also scans file paths. Falls back to a full scan rather than silently skipping.
  - Copy: stable rule IDs; diff-aware severity; per-path rule ignores; filename scanning; Zalgo detection; misplaced-BOM detection.
- **ShaneBreazeale/invisible-unicode-scan** (GitHub Action)
  - URL: https://github.com/ShaneBreazeale/invisible-unicode-scan
  - Inputs: `paths`, `include-extensions`, `fail-on-detection`, `categories`. Outputs: `found`, `matches`.
  - Cites Aikido's March 2026 report of more than 151 affected packages.
  - Copy: Action outputs that later workflow steps can consume.
- **mjay1304/ghostcars**
  - URL: https://github.com/mjay1304/ghostcars
  - Python. License: MIT. Detects Cf and Cc characters; `--json`; pre-commit hook.
- **homeofe/supply-chain-guard**
  - URL: https://github.com/homeofe/supply-chain-guard
  - License: Apache-2.0. Covers 15 package ecosystems. **[UNVERIFIED details]**
- **iron-mukakin/glassworm_scanner** (Rust) and **westackai/glassworm-scanner**. Small, single-purpose scanners. **[UNVERIFIED details]**
  - https://github.com/iron-mukakin/glassworm_scanner
  - https://github.com/westackai/glassworm-scanner

### 2.21 Other Trojan Source scanners
- **ariary/TrojanSourceFinder**
  - URL: https://github.com/ariary/TrojanSourceFinder
  - Go (`tsfinder`). License: MIT. CI-friendly.
- **avisi-cloud/trojansourcedetector**
  - URL: https://github.com/avisi-cloud/trojansourcedetector
  - Go, GitHub Action. License: Unlicense.
  - Config file `.trojansourcedetector.json` with `detect_unicode` (flags all non-ASCII), `detect_bidi`, `parallelism`, and include/exclude lists.
- **maweil/bidi_char_detector**
  - URL: https://github.com/maweil/bidi_char_detector
  - Rust. License: MIT. Docker image under 3 MB.
  - Includes and excludes come from `bidi_config.toml`. Fails on files that are not UTF-8.
- **bytehide/TrojanSourceDetector4Dotnet** (C#): https://github.com/bytehide/TrojanSourceDetector4Dotnet
- **burberius/trojan-source-maven-plugin** (Java/Maven): https://github.com/burberius/trojan-source-maven-plugin
- **Moshe-ship/bidi-guard** (Python): https://github.com/Moshe-ship/bidi-guard **[UNVERIFIED details]**
- Copy: an option to flag all non-ASCII; a tiny Docker image; Maven and .NET integration as a future option.

### 2.22 LLM red-teaming references
- promptfoo `ascii-smuggling` plugin
  - URL: https://www.promptfoo.dev/docs/red-team/plugins/ascii-smuggling/
  - Tests whether a model follows instructions hidden in Unicode Tags. Recommended mitigation: filter Tags at the API layer.
- garak encoding probes
  - URL: https://reference.garak.ai/en/latest/probes/encoding.html
  - `InjectUnicodeTagChars` (active by default)
  - `InjectUnicodeVariantSelectors` and `InjectSneakyBits` (inactive by default)
  - `InjectZalgo`, `InjectEcoji`
- Copy: use the probe generators as fixture sources.

---

## Category 3: Encoding, BOM, line-ending and whitespace normalizers; confusables libraries; meta-linters

### 3.1 editorconfig-checker
- URL: https://github.com/editorconfig-checker/editorconfig-checker
- Go. License: MIT. Wrappers on npm (`editorconfig-checker`, v7.0.0), PyPI and Composer.
- Checks: `end_of_line`, `insert_final_newline`, `trim_trailing_whitespace`, `indent_style`, `indent_size`, `max_line_length`, `charset`.
- Output formats: default, gcc, github-actions, codeclimate.
- `--fix` repairs trailing whitespace, line endings and the final newline only.
- Default exclude list. Inline disables for a whole file, a line, the next line or a block.
- `.editorconfig-checker.json` config with a JSON schema; supports pinning the tool version.
- Embedded in MegaLinter and super-linter.
- Copy: honor `.editorconfig`; gcc and codeclimate output formats; the four inline-disable forms; a JSON schema for the config.

### 3.2 eclint
- URL: https://github.com/jedmao/eclint
- npm. License: MIT. Archived in October 2020.
- Commands: `check`, `fix`, and `infer` (generates an `.editorconfig` from existing code).
- Copy: an `infer` command that proposes a config.

### 3.3 dos2unix / unix2dos
- URL: https://manpages.debian.org/testing/dos2unix/dos2unix.1.en.html
- C, open source (FreeBSD-style license). **[UNVERIFIED license detail]**
- Conversion modes: ascii, 7bit, iso (CP437, 850, 860, 863, 865, 1252), mac.
- BOM: `-b` keep, `-r` remove, `-m` add.
- UTF-16 input: `-ul`, `-ub`, `-u`. GB18030 support.
- `-i` info mode:
  - Reports counts of DOS, Unix and Mac line breaks, plus BOM and text/binary status.
  - Flag characters such as `c` (file would change), `e` and `0`.
- Skips binary files unless `-f` is given.
- Other flags: `-n` (write to a new file), `-k` (keep timestamp), `-e` (add a final EOL); symlink handling options.
- Copy: an info mode with line-ending counts; a `would change` listing; timestamp preservation; symlink policy; add/remove/keep BOM.

### 3.4 pre-commit/pre-commit-hooks
- URL: https://github.com/pre-commit/pre-commit-hooks
- Python. License: MIT.
- Text-hygiene hooks:
  - `fix-byte-order-marker`
  - `mixed-line-ending --fix=auto|crlf|lf|no`
  - `end-of-file-fixer`
  - `trailing-whitespace` (`--markdown-linebreak-ext`, `--chars`)
  - `check-merge-conflict` (`--assume-in-merge`)
  - `check-case-conflict`, `check-illegal-windows-names`
- Other hooks:
  - `check-executables-have-shebangs`, `check-shebang-scripts-are-executable`
  - `check-json`, `check-yaml`, `check-toml`, `check-xml`
  - `check-added-large-files --maxkb`
  - `detect-private-key`, `destroyed-symlinks`
  - `fix-encoding-pragma` (deprecated)
- Copy: Markdown hard-break preservation (two trailing spaces); the `auto` line-ending mode (majority wins); merge-marker check; case-conflict and Windows-illegal filename checks.

### 3.5 git
- URLs: https://git-scm.com/docs/gitattributes , https://git-scm.com/docs/git-config , https://git-scm.com/docs/git-ls-files
- Line endings:
  - Attributes `text`, `text=auto` and `eol=lf|crlf`.
  - `git add --renormalize .` re-applies them to tracked files.
  - `git ls-files --eol` reports index and working-tree state (`i/lf`, `w/crlf`, `mixed`, `-text`).
- Encoding: the `working-tree-encoding` attribute (e.g. UTF-16LE-BOM) with `core.checkRoundtripEncoding`.
- Whitespace: the `whitespace` attribute and `core.whitespace` classes:
  - `blank-at-eol`, `blank-at-eof`, `space-before-tab`, `indent-with-non-tab`, `tab-in-indent`, `cr-at-eol`, `tabwidth`
- `git diff --check` and `git apply --whitespace=fix`.
- Copy: honor `.gitattributes` (`eol`, `-text`, binary, `working-tree-encoding`); the `git ls-files --eol` style report; a `blank-at-eof` check.

### 3.6 Prettier `endOfLine`
- URL: https://prettier.io/docs/options#end-of-line
- Values: `lf` (the default since v2), `crlf`, `cr`, `auto`. `auto` keeps the existing style, using the first line ending to normalize mixed files.

### 3.7 lintspaces (node-lintspaces)
- URL: https://github.com/schorfES/node-lintspaces
- npm, v3.0.1. License: MIT.
- Options:
  - `newline`, `newlineMaximum`
  - `trailingspaces`, `trailingspacesSkipBlanks`, `trailingspacesToIgnores`
  - `indentation`, `spaces`, `indentationGuess`
  - `allowsBOM`, `endOfLine` (LF, CRLF or CR)
  - `editorconfig`, `ignores` (named regex ignores such as JS comments), `rcconfig`
- No fix.
- Copy: named ignore patterns (e.g. skip trailing spaces inside comments); a cap on consecutive newlines.

### 3.8 camsaul/whitespace-linter
- URL: https://github.com/camsaul/whitespace-linter
- Clojure. License: EPL-2.0. Multithreaded.
- Checks trailing whitespace, tabs, CR characters, missing final newline, trailing blank lines, ASCII-lookalike Unicode and invisible Unicode.
- Include/exclude patterns and `max-file-size-kb`. No fix.
- Copy: a file-size ceiling.

### 3.9 markdownlint
- URL: https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md
- Rules, all auto-fixable:
  - MD009 trailing spaces (`br_spaces`, `strict`)
  - MD010 hard tabs (`spaces_per_tab`)
  - MD012 multiple consecutive blank lines
  - MD047 file should end with a single newline
- Copy: Markdown-aware trailing-space handling.

### 3.10 textlint rules
- textlint-rule-no-zero-width-spaces: https://github.com/textlint-rule/textlint-rule-no-zero-width-spaces
- @textlint-rule/textlint-rule-no-invalid-control-character: https://github.com/textlint-rule/textlint-rule-no-invalid-control-character
- textlint-rule-no-nfd: https://github.com/azu/textlint-rule-no-nfd
- All MIT and fixable through `textlint --fix`. **[UNVERIFIED that every rule is fixable]**
- Copy: an NFD-to-NFC check, which matters for macOS-produced Japanese/Korean text; a textlint plugin as an integration target.

### 3.11 charset-normalizer
- URL: https://github.com/jawah/charset_normalizer
- Python. License: MIT.
- CLI `normalizer`:
  - `-n` normalize (writes UTF-8 output)
  - `-r` replace the original
  - `-f` force
  - `-m` minimal output
  - `-a` show alternatives
- JSON output includes the encoding, language, and "chaos" and "coherence" scores.
- Supports 99 encodings and detects BOMs.
- Copy: report detection confidence; list alternative encodings; a convert-to-UTF-8 fix that requires confirmation (`--force`).

### 3.12 Encoding-detection libraries
- chardet (Python): https://github.com/chardet/chardet . Licensing has been disputed (0BSD vs LGPL lineage) according to the charset-normalizer README. **[UNVERIFIED current license]**
- jschardet (npm, v4.0.0, 0BSD): https://github.com/aadsm/jschardet
- chardet (npm, by runk; v2.2.0; MIT): https://github.com/runk/node-chardet
- chardetng (Rust, v1.0.0, by Henri Sivonen; the detector Firefox uses) and encoding_rs (Rust, WHATWG Encoding Standard): https://github.com/hsivonen/chardetng , https://github.com/hsivonen/encoding_rs
- iconv-lite (npm, MIT; pure-JS conversion): https://github.com/ashtuchkin/iconv-lite
- uchardet, enca, GNU iconv and `file --mime-encoding`. **[UNVERIFIED in this session; from general knowledge]**
- encoding-checker (npm, v1.3.0, MIT; "investigate files with different encoding than passed"): https://github.com/piecioshka/encoding-checker
- Copy: for a zero-dependency Node tool, iconv-lite plus jschardet or node chardet is the practical stack. `TextDecoder` with `fatal: true` gives strict UTF-8 validation.

### 3.13 ftfy ("fixes text for you")
- URLs: https://github.com/rspeer/python-ftfy , https://ftfy.readthedocs.io/en/latest/config.html
- Python. License: Apache-2.0 with an attribution clause.
- Config options:
  - `unescape_html`, `remove_terminal_escapes`
  - `fix_encoding` (mojibake repair), `restore_byte_a0`, `replace_lossy_sequences`, `decode_inconsistent_utf8`
  - `fix_c1_controls` (decoded as cp1252)
  - `fix_latin_ligatures`, `fix_character_width`
  - `uncurl_quotes`, `fix_line_breaks`, `fix_surrogates`, `remove_control_chars`
  - `normalization` (NFC by default)
  - `explain` (reports the steps it applied)
- Copy: mojibake detection and repair; C1-control repair; ligature and fullwidth folding; ANSI terminal-escape removal; lone-surrogate repair; an `explain` trace of applied transforms.

### 3.14 Confusables and homoglyph libraries
- unicode-security (Rust crate): https://docs.rs/unicode-security
  - Implements UTS #39: General Security Profile (`identifier_allowed`), `skeleton`, `MixedScript`, `RestrictionLevel`.
- confusables (Rust crate). **[UNVERIFIED details]**
- confusable_homoglyphs (Python, MIT)
  - URL: https://github.com/vhf/confusable_homoglyphs
  - Archived; development moved to sr.ht. Built from `confusables.txt` and `Scripts.txt`.
  - Provides `is_mixed_script` and `is_dangerous`. **[function names UNVERIFIED]**
- unhomoglyph (npm, v1.0.6, MIT)
  - URL: https://github.com/nodeca/unhomoglyph
  - Uses `confusables.txt` from Unicode 13.0.0. Meant for comparing strings, not for display.
- confusables (npm, gc/confusables) and unicode-confusables (npm). **[UNVERIFIED details]**
- ICU SpoofChecker (USpoofChecker)
  - Base URL: https://unicode-org.github.io/icu/userguide/ (the specific page returned 404).
  - Checks: SINGLE_SCRIPT_CONFUSABLE, MIXED_SCRIPT_CONFUSABLE, WHOLE_SCRIPT_CONFUSABLE, RESTRICTION_LEVEL, INVISIBLE, CHAR_LIMIT, MIXED_NUMBERS, HIDDEN_OVERLAY; `getSkeleton`. **[UNVERIFIED in this session]**
- MoonSpoof (MoonBit, UTS #39). **[UNVERIFIED details]**
- Copy: base homoglyph detection on UTS #39 data (skeleton plus mixed-script, restriction levels, MIXED_NUMBERS, HIDDEN_OVERLAY) rather than a hand-made list; pin and report the Unicode data version.

### 3.15 Transliteration, normalization and newline utilities (npm)
- any-ascii (ISC): https://anyascii.com
- unidecode (npm, by FGRibreau). The Python Unidecode library is noted from general knowledge. **[UNVERIFIED]**
- unorm: NFC/NFD/NFKC/NFKD polyfill; `String.prototype.normalize` is built in now.
- sindresorhus-style single-purpose packages, all MIT: strip-bom, detect-newline, normalize-newline, crlf (kolodny).
- The npm names `normalize-unicode` and `unicode-lint` do not exist as packages (checked on the registry). They may be free to claim.
- Copy: an optional ASCII-fold mode for "aggressive" cleaning; newline detection by majority.

### 3.16 MegaLinter
- URL: https://megalinter.io/latest/descriptors/editorconfig_editorconfig_checker/
- Embeds editorconfig-checker in project mode (requires a `.editorconfig` file), along with cspell, proselint, vale, lychee, codespell, secretlint, git_diff, trivy and jscpd.
- Has a SARIF reporter and can apply fixes.
- Copy: get our tool added as a MegaLinter descriptor (a distribution channel).

### 3.17 super-linter
- URL: https://github.com/super-linter/super-linter
- License: MIT.
- Variables: `VALIDATE_EDITORCONFIG`, `FIX_EDITORCONFIG`, `VALIDATE_GIT_MERGE_CONFLICT_MARKERS`, `VALIDATE_NATURAL_LANGUAGE` (textlint). Fixing is opt-in through `FIX_*` variables.
- Copy: get included as a super-linter linter (another distribution channel).

---

## Positioning notes (what nobody does in one tool)

- Closest npm competitors:
  - ghostchars (bidi, tags, variation selectors, whitespace, styled text; `--fix`; SARIF; Action; pre-commit)
  - anti-trojan-source (category-based detection; no fix)
  - glyphguard and unspook (decode/reveal)
  - out-of-character (library)
- None of them also handles BOM, line endings, encoding conversion, trailing whitespace or the final newline. Those live in editorconfig-checker, dos2unix, pre-commit-hooks, lintspaces and git.
- The reference project covers Unicode and metadata very thoroughly, but it is Python and is not a single npm CLI with editorconfig/gitattributes awareness.
- Gaps no surveyed tool combines in one place:
  1. Unicode security cleaning together with file-format hygiene (BOM, EOL, encoding, whitespace).
  2. Honoring both `.editorconfig` and `.gitattributes`.
  3. Diff-aware scanning (only tkm112345 has it).
  4. Mojibake repair (only ftfy).
  5. Decode/reveal of hidden payloads alongside SARIF and GitHub output.
  6. Context-aware allowlists (emoji, CJK IVS, Indic/Persian ZWJ, French NBSP, RTL marks) available as named policies.

---

## Feature union matrix (deduplicated)

Legend for "Seen in": short tool names from the sections above. Statistical-watermark rewriting, image metadata and PDF/DOCX analysis are listed for completeness but are outside the core text-hygiene scope.

### A. Character classes detected or fixed

| # | Feature | Seen in |
|---|---------|---------|
| A1 | Zero-width characters (U+200B, U+200C, U+200D, U+2060, U+FEFF mid-file) | nearly all (1.1-1.26, 2.2, 2.10, 2.17) |
| A2 | Invisible math operators U+2061-2064 | 1.1, 1.2 |
| A3 | Bidi embedding/override/isolate controls (U+202A-202E, U+2066-2069) | 1.1, 1.2, 2.2-2.21 |
| A4 | Bidi marks (LRM/RLM U+200E/F, ALM U+061C) as a separate class | 1.21, 1.23, 1.27 |
| A5 | Unbalanced or unterminated bidi detection (versus any bidi) | 1.23, 2.13, 2.14 |
| A6 | Escaped bidi detection in source (`‮`, UCNs) | 2.13 |
| A7 | Unicode Tag characters U+E0000-E007F | 1.1, 1.2, 1.9, 1.21-1.26, 2.2, 2.20 |
| A8 | Decoding of tag payloads into readable ASCII | 1.9, 1.21, 1.22, 1.24, 1.26 |
| A9 | Variation selectors U+FE00-FE0F and U+E0100-E01EF | 1.1, 1.2, 1.3, 1.21, 1.23, 2.2, 2.20 |
| A10 | Decoding of variation-selector byte payloads (emoji smuggling / GlassWorm) | 1.9, 1.21, 1.26, 2.20 |
| A11 | Variation-selector run-length threshold (e.g. 3 or more per line) | 2.20 (tkm112345) |
| A12 | Stray variation selector (VS not after a valid base) | 1.23 |
| A13 | Sneaky Bits (U+2062/U+2064 binary) encoding and decoding | 1.9, 2.22 |
| A14 | Zero-width binary-encoding heuristic (8 or more consecutive ZW) | 2.8 |
| A15 | Whole general-category detection: Cf | 1.1, 1.12, 2.2, 2.20 |
| A16 | Cc control characters except TAB/LF/CR (NUL, BS, ESC, SUB, etc.) | 1.23, 1.25, 1.26, 2.2, 2.17, 2.18, 2.20 |
| A17 | C1 controls (U+0080-009F), including repair as cp1252 | 3.13, 2.10 (NEL) |
| A18 | ANSI terminal escape sequences | 3.13 |
| A19 | Private Use Area characters | 1.7, 1.21, 2.20 |
| A20 | Noncharacters (U+FDD0-FDEF, U+xFFFE/xFFFF) | 1.1, 2.20 |
| A21 | Reserved Default_Ignorable code points (U+2065, U+FFF0-FFF8, U+E0080-E00FF, etc.) | 1.1 |
| A22 | Blank-looking letters: Hangul fillers U+3164/U+115F/U+1160/U+FFA0, U+180F, Khmer U+17B4/5, Braille blank U+2800 | 1.1, 1.26, 2.20 |
| A23 | Object replacement character U+FFFC | 1.26 |
| A24 | Replacement character U+FFFD (evidence of earlier encoding damage) | 1.19 |
| A25 | Line/paragraph separators U+2028/U+2029 (flag, or convert to newline) | 1.10, 1.26, 2.10, 2.20 |
| A26 | Exotic spaces (U+00A0, U+202F, U+2000-200A, U+205F, U+3000, U+1680, U+180E) replaced with an ASCII space | 1.1-1.4, 1.10, 1.19, 1.23, 2.10 |
| A27 | NEL, VT and FF as irregular whitespace | 2.10 |
| A28 | Soft hyphen U+00AD | 1.1, 1.2, 2.12 |
| A29 | Homoglyphs / confusables (UTS #39 `confusables.txt`) | 1.17, 1.19-1.21, 1.24, 2.2, 2.6, 2.17, 3.14 |
| A30 | UTS #39 skeleton comparison and mixed-script / whole-script confusable detection | 1.25, 2.11, 2.14, 2.20, 3.14 |
| A31 | Mixed-script word detection (e.g. Latin plus Cyrillic within one word) | 1.24, 1.25, 2.20 |
| A32 | Mixed numbers / hidden overlay (ICU) | 3.14 |
| A33 | Styled text: mathematical alphanumerics and fullwidth forms (fold to ASCII) | 1.23, 3.13 |
| A34 | Latin ligatures (U+FB00-FB06) folded | 3.13 |
| A35 | Combining-mark runs (Zalgo) | 2.20, 2.22 |
| A36 | Smart quotes normalized to ASCII | 1.2, 1.4, 1.10, 1.20, 2.19, 3.13 |
| A37 | Dashes (en, em, 2-em, 3-em, Unicode minus) with a policy per type | 1.4, 1.10, 1.11, 2.19 |
| A38 | Ellipsis and other "visible special" typography | 1.10, 1.11 |
| A39 | Chat-template / control tokens (`<\|im_start\|>`, `[INST]`) | 1.26 |
| A40 | Prompt-injection phrases and intent classification (override, exfiltration, credentials) | 1.22, 1.24 |
| A41 | Base64 blobs (with optional decoding) | 1.22, 1.24, 1.25 |
| A42 | AI HTML provenance attributes and classes (`data-start`, `data-claude-*`, `font-claude-response-body`, `data-ai-*`) | 1.4, 1.7 |
| A43 | JSON-LD / generator-tag provenance | 1.5, 1.7 |
| A44 | Hidden HTML/CSS text (display:none, white-on-white), deceptive links, image exfiltration | 1.19, 1.22, 1.24, 1.28 |
| A45 | Non-ASCII literal (flag all non-ASCII; optionally escape it) | 2.6, 2.12, 2.21 |
| A46 | Unicode normalization checks/fixes: NFC (default), NFD to NFC, optional NFKC | 1.8, 2.12, 3.10, 3.13 |
| A47 | Lone surrogates / invalid UTF-16 | 3.13 |
| A48 | Mojibake detection and repair (UTF-8 decoded as cp1252/latin-1, etc.) | 3.13 |
| A49 | Regional-spelling fingerprint warning | 1.17 |
| A50 | Statistical-watermark mitigation via paraphrase (out of scope for deterministic fixing) | 1.1, 1.7 |
| A51 | File metadata (C2PA/EXIF/XMP) stripping (out of scope for text files) | 1.1, 1.5 |

### B. Context-aware preservation and allowlists

| # | Feature | Seen in |
|---|---------|---------|
| B1 | Keep ZWJ and VS16 (U+FE0F) inside emoji sequences; keep keycaps | 1.1, 1.2, 1.3, 1.26 |
| B2 | Keep valid emoji tag sequences (England/Scotland/Wales flags) | 1.23, 1.26 |
| B3 | Keep one ideographic variation selector after a CJK ideograph | 1.3, 1.26 |
| B4 | Keep ZWJ/ZWNJ in Indic, Persian and Arabic scripts | 1.1, 1.26, 1.27 |
| B5 | Keep Mongolian and other script-specific format characters near their script (FVS, Egyptian quadrat, Duployan, musical notation) | 1.1, 1.3 |
| B6 | French NBSP/NNBSP typography (before ; : ! ? and inside « ») | 1.1, 1.23 |
| B7 | RTL-preserving policy that keeps LRM/RLM/ALM | 1.27 |
| B8 | Allow a BOM only at the start of a file; flag a misplaced BOM | 1.26, 2.20 |
| B9 | Avoid homoglyph false positives on genuine foreign-language text | 1.19, 1.22 |
| B10 | Allowlists by character, code point, type or locale (`allowedCharacters`, `allowed-confusables`, exclude) | 1.3, 2.6, 2.17 |
| B11 | Skip by syntactic context (strings, comments, regex, templates, JSX text) | 2.6, 2.10, 2.17 |
| B12 | Markdown hard-break preservation (two trailing spaces) | 3.4, 3.9 |

### C. File-level hygiene

| # | Feature | Seen in |
|---|---------|---------|
| C1 | BOM: detect, remove, add, or keep as policy | 2.10, 3.3, 3.4, 3.7 |
| C2 | Line endings: LF, CRLF or CR target; `auto` (majority or first line) mode | 2.10, 3.1, 3.3, 3.4, 3.6, 3.7 |
| C3 | Mixed line-ending detection with per-type counts | 3.3, 3.4, 3.5 |
| C4 | Classic-Mac CR-only line endings | 3.3, 3.6, 3.7 |
| C5 | Encoding detection with confidence and alternative candidates | 3.11, 3.12 |
| C6 | Encoding conversion to UTF-8 (from UTF-16/32, legacy code pages, GB18030) | 3.3, 3.5, 3.11 |
| C7 | Strict UTF-8 validation (fail on invalid bytes) | 2.21, 3.12 |
| C8 | Read UTF-16/32 files that carry a BOM | 1.26, 3.3 |
| C9 | Trailing whitespace (option to skip blank lines; configurable character set) | 2.10, 2.17, 3.1, 3.4, 3.7, 3.8, 3.9 |
| C10 | Whitespace-only blank lines | 2.17 |
| C11 | Final newline: insert or require exactly one | 2.10, 2.17, 3.1, 3.3, 3.4, 3.9 |
| C12 | Trailing blank lines at EOF; limits on BOF/EOF and consecutive blank lines | 2.10, 3.5, 3.7, 3.8, 3.9 |
| C13 | Tabs versus spaces; indent style and size; space-before-tab | 2.10, 3.1, 3.5, 3.7, 3.8, 3.9 |
| C14 | Maximum line length | 3.1 |
| C15 | Merge-conflict markers | 3.4, 3.17 |
| C16 | Filename checks: invisible or confusable characters in paths, case conflicts, Windows-illegal names | 2.20, 3.4 |
| C17 | Binary-file detection and skipping (with a force option) | 1.1, 3.3 |
| C18 | Large-file ceiling (`max-file-size`, `maxkb`) | 1.19, 3.4, 3.8 |
| C19 | Preserve file timestamp, permissions and symlink policy when rewriting | 3.3 |
| C20 | Write to a new file instead of in place (`-n`, `-o`, `.safe`) | 1.17, 1.21, 1.27, 3.3 |

### D. Configuration sources

| # | Feature | Seen in |
|---|---------|---------|
| D1 | Honor `.editorconfig` (charset, end_of_line, trim_trailing_whitespace, insert_final_newline, indent) | 3.1, 3.2, 3.7 |
| D2 | Honor `.gitattributes` (text/eol/-text/binary, working-tree-encoding, whitespace) | 3.5 |
| D3 | Infer or generate a config from the existing codebase | 3.2 |
| D4 | Own config file (`.ghostcharsrc.json`, `.glassworm.yml`, `.editorconfig-checker.json`, `bidi_config.toml`) with a JSON schema | 1.23, 2.20, 2.21, 3.1 |
| D5 | Presets / named policies (`agent-files`, `security`, `preserve_rtl`, `--aggressive`, `--extended`) | 1.20, 1.26, 1.27, 2.2 |
| D6 | Per-path rule ignores (`glob:RULE_ID`) and per-language overrides | 2.7, 2.20 |
| D7 | Inline disable comments (file, line, next-line, block) | 3.1, ESLint/Ruff generally |
| D8 | User-defined characters with their own description and severity | 2.7 |
| D9 | Include/exclude globs, extension filters, default excludes | 1.25, 2.20, 2.21, 3.1, 3.8 |
| D10 | Respect `.gitignore` (with an opt-out) | 1.22 |
| D11 | Warn on unknown rule IDs in config | 2.20 |

### E. CLI modes and behavior

| # | Feature | Seen in |
|---|---------|---------|
| E1 | Check (report-only) mode with a non-zero exit on findings | 1.2, 1.20, 1.21, 1.26, 1.27, 2.2, 3.1 |
| E2 | `--fix` / `--write` / `-w` in place | 1.1-1.3, 1.20, 1.22, 1.23, 3.1, 3.3, 3.4 |
| E3 | `--dry-run` / "would change" listing | 1.23, 3.3 (`-i c`) |
| E4 | Backup files (`.bak`) on in-place writes | 1.1, 1.7 |
| E5 | Fix-mode exit code that forces re-staging (pre-commit convention) | 1.1, 3.4 |
| E6 | Distinct exit codes: 0 clean, 1 findings, 2 usage/IO error, 3 internal crash | 1.1, 1.26, 1.27, 2.20 |
| E7 | Idempotency guarantee (`detect(clean(x)) == []`) | 1.4 |
| E8 | stdin/stdout filter mode | 1.4, 1.21, 2.2 |
| E9 | Inline string inspection (`inspect "text"`) | 1.27 |
| E10 | Globs and recursive directory scan; multi-worker / parallel scan | 1.1, 1.3, 2.2, 2.21, 3.8 |
| E11 | Only changed files / diff-aware scanning (strict on changed lines, critical everywhere) | 1.1 (`--only-changed`), 2.20 |
| E12 | Remote git repository, website or sitemap scanning | 1.1, 1.7, 1.25 |
| E13 | Scan installed IDE extensions, node_modules and site-packages | 2.20 |
| E14 | Reveal/escape view (`a[U+200B]b`) and a `decode` subcommand | 1.9, 1.20, 1.21, 1.23 |
| E15 | Explain trace of applied transformations | 3.13 |
| E16 | Info mode: per-file stats (line-ending counts, BOM, encoding, binary) | 1.20, 3.3, 3.5 |
| E17 | Compare two copies to isolate fingerprint differences | 1.22 |
| E18 | Interactive review (accept or reject each change) | 1.11 |
| E19 | Selective fixing per category (fix some classes, report others) | 1.4, 1.10, 1.11 |
| E20 | Replacement character option (remove, space, custom, or escape as `\u{...}`) | 1.3, 1.21, 2.11, 2.12 |
| E21 | Quiet mode (`-q`) | 1.1, 1.7, 1.21 |
| E22 | Fail-closed: unreadable or skipped files are reported as errors, never silently skipped | 1.26, 1.27, 2.20 |
| E23 | Refuse to clean binary or unknown formats | 1.1 |
| E24 | Offline by default; zero runtime dependencies | 1.2, 1.4, 1.21, 1.26, 2.20 |
| E25 | Pure core library with no I/O (bytes in, bytes out); separate CLI shell | 1.7 |

### F. Diagnostics and output formats

| # | Feature | Seen in |
|---|---------|---------|
| F1 | Human output with line, column, code point, Unicode name, category and snippet with caret | 1.20, 2.2 |
| F2 | Column units defined explicitly (code points versus UTF-16 units versus bytes) | 1.20 |
| F3 | Per-character and per-category counts and stats | 1.2, 1.9, 1.11, 1.20 |
| F4 | JSON output with a versioned schema (`schemaVersion`) | 1.4, 1.7, 1.21, 1.27, 2.2 |
| F5 | SARIF 2.1.0 output (with CWE tags and stable rule IDs) | 1.1, 1.23, 1.27, 2.16, 2.20 |
| F6 | GitHub Actions workflow annotations | 1.23, 1.26, 3.1 |
| F7 | GitHub step summary (`$GITHUB_STEP_SUMMARY`) / summary format | 1.23, 1.26 |
| F8 | gcc-style output | 3.1 |
| F9 | Code Climate (GitLab Code Quality) output | 3.1 |
| F10 | Standalone HTML report | 1.19 |
| F11 | Severity tiers (critical/high/medium/low) per category | 1.19, 1.21, 1.24, 2.2, 2.20 |
| F12 | Deterministic-versus-heuristic flag and confidence labels; heuristic results capped at "uncertain" | 1.4, 1.5, 1.8 |
| F13 | Detector availability status (`available: false` / `unavailable`) | 1.1, 1.8 |
| F14 | Stable rule IDs (e.g. IUC001...) | 2.17, 2.18, 2.20 |
| F15 | Injection-safe output escaping (terminal, GitHub annotations %/CR/LF, Markdown, hostile filenames) | 1.26, 1.27 |
| F16 | Report the Unicode data version used | 3.14 |

### G. Integrations and distribution

| # | Feature | Seen in |
|---|---------|---------|
| G1 | npm CLI and programmatic API | 1.2-1.4, 1.20, 1.21, 2.2 |
| G2 | GitHub Action (with outputs such as `found` / `matches`) | 1.23, 1.25, 2.20, 2.21 |
| G3 | pre-commit hook (check, plus opt-in fix) | 1.1, 1.23, 2.2, 2.20, 3.4 |
| G4 | ESLint plugin / rule | 2.3, 2.4, 2.10 |
| G5 | textlint rule | 3.10 |
| G6 | Editor extension (VS Code) with gutter, hover and Problems-panel output | 2.6-2.9 |
| G7 | Agent hooks (Claude Code PostToolUse) and agent skills | 1.1, 1.6 |
| G8 | Browser extension / web app built from the same core, with parity tests | 1.8, 1.14, 1.19, 1.20 |
| G9 | HTTP service with OpenAPI; Docker image (small) | 1.1, 1.6, 2.21 |
| G10 | Inclusion in MegaLinter and super-linter | 3.16, 3.17 |
| G11 | Language-native lint parity (rustc, Clippy, GCC, clang-tidy, Ruff, Pylint, ShellCheck, Semgrep) as reference rule sets | 2.11-2.19 |
| G12 | IOC database / updatable threat signatures (GlassWorm) | 2.20 |
| G13 | Detection of decoder code next to payloads (e.g. `codePointAt` with VS arithmetic) | 2.20 |
| G14 | Test corpora from PoCs and red-team probe generators (trojan-source, garak, promptfoo, stego encoders) | 1.29, 2.1, 2.22 |

---

## Unverified items (consolidated)
- ICU SpoofChecker check names (the user-guide page returned 404; listed from general knowledge).
- uchardet, enca, GNU iconv, `file --mime-encoding`, Python Unidecode: from general knowledge.
- rustc `confusable_idents`, `mixed_script_confusables`, `uncommon_codepoints`: from general knowledge.
- No `go vet` bidi analyzer was found. bidichk via golangci-lint is the Go answer; the absence is not proven.
- chardet's current license (disputed per the charset-normalizer README).
- The dos2unix license wording.
- The minor tools marked [UNVERIFIED details]: their READMEs were not reviewed in depth.
- Star counts and versions are as observed on 2026-10-12 and will drift.

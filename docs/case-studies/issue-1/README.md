# Case Study: Issue #1 - Keep Source Code and Docs Free of Text Watermarks

## Issue Overview

- Issue: https://github.com/link-foundation/watermarks-remover/issues/1
- Pull request: https://github.com/link-foundation/watermarks-remover/pull/2
- Raw issue data: [data/issue-1.json](data/issue-1.json)

### Problem Statement

AI assistants, copy and paste from chat interfaces, web pages and old
editors leave characters in text that a reader cannot see: zero-width
spaces, bidirectional controls, Unicode tag characters, variation selector
runs, look-alike spaces and letters, byte order marks, mixed line endings
and files in legacy encodings. Some of these are deliberate watermarks or
hidden payloads, others are accidents. All of them make source code behave
differently from what a reviewer reads.

The issue asks for a CI/CD tool that finds every such character in a
repository, fails the build, and tells the author to run the same tool with
`--fix`. The tool has to beat every known competitor, be configured in
Links Notation, stay out of the way of legitimate work, and the research
behind it has to be collected in this folder.

## Requirements

Every requirement below is taken from the issue text. The "Solution" column
points to where it is implemented in this pull request.

| #   | Requirement                                                                                         | Solution                                                                                                                                                                                                                         | Status                    |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| R1  | A CI/CD tool that detects watermarking, fails, and asks to run the same tool with `--fix`           | `watermarks-remover` exits with 1 and prints `npx @link-foundation/watermarks-remover --fix` with the same paths and `--config`; `--format github` adds annotations and a step summary                                           | Done                      |
| R2  | Simple source code                                                                                  | Plain ES modules, one runtime dependency (`links-notation`), no build step; rules are data in `src/rules.js` and `src/patterns.js`                                                                                               | Done                      |
| R3  | Study https://github.com/guillaumemeyer/watermarks-remover and all competitors                      | [Competitors](#competitors), [data/competitors.md](data/competitors.md), [data/reference-project](data/reference-project), [data/competitor-readmes](data/competitor-readmes)                                                    | Done                      |
| R4  | Remove all watermarking of all AI systems known to date                                             | 29 rules covering every character-level carrier of [data/watermark-techniques.md](data/watermark-techniques.md); statistical watermarks are explained in [What cannot be removed](#what-cannot-be-removed-by-editing-characters) | Done, with a stated limit |
| R5  | Line break normalization                                                                            | `line-endings` (lf, crlf or keep, per path), `line-separator` (U+2028, U+2029, NEL), `final-newline`                                                                                                                             | Done                      |
| R6  | BOM normalization: all files with or all files without                                              | `bom: remove`, `bom: require` or `bom: keep`, per path through `overrides`                                                                                                                                                       | Done                      |
| R7  | Convert every file to UTF-8, except files that must stay as they are                                | `encoding: utf-8` converts UTF-16, UTF-32 and the `fallback-encoding` (Windows-1252 by default); exceptions use `encoding: keep` or `files exclude`                                                                              | Done                      |
| R8  | Propose 10-20 names with a more general meaning                                                     | [Name proposals](#name-proposals)                                                                                                                                                                                                | Done                      |
| R9  | Find all related services so that the tool has every feature; CI/CD instead of skills/hooks/plugins | [Competitors](#competitors); the tool is a CLI with exit codes, GitHub annotations, JSON and SARIF, and the repository checks itself in `.github/workflows/release.yml`                                                          | Done                      |
| R10 | Use the associative tech stack; prefer Links Notation over JSON; readable configuration             | `.watermarks-remover.lino` parsed with `links-notation`; `--init` writes a commented starter file; see [Associative tech stack](#associative-tech-stack)                                                                         | Done                      |
| R11 | Highest quality, no unexpected behaviour, never get in the way of legitimate work                   | Context-aware rules (emoji, flags, joining scripts, right-to-left text), warnings for escapes, idempotent fixes, binary and oversized files skipped, per-path overrides; see [Design decisions](#design-decisions)               | Done                      |
| R12 | Strip invisible characters that are not part of allowed languages                                   | Characters are kept only in the script context that needs them; `allowed-scripts` reports letters of other scripts                                                                                                               | Done                      |
| R13 | Collect data in `docs/case-studies/issue-1`, analyse it, list requirements, propose solutions       | This document and [data](data)                                                                                                                                                                                                   | Done                      |
| R14 | Plan and execute everything in a single pull request                                                | Pull request #2                                                                                                                                                                                                                  | Done                      |

## Timeline of Events

All times are UTC on 2026-10-12.

| Time  | Event                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------- |
| 17:11 | Issue #1 opened                                                                                |
| 17:14 | Draft pull request #2 opened from `issue-1-db3eab1768a1`                                       |
| 17:15 | Research started: reference project, associative tech stack, watermark techniques, competitors |
| 17:31 | Research notes finished ([data](data))                                                         |
| 17:52 | Engine, CLI and Links Notation configuration committed                                         |
| 17:56 | Tests for configuration, encodings, images, engine and CLI committed                           |
| 18:24 | Example app, CI self-check, README and changeset committed                                     |
| 18:50 | This case study committed                                                                      |

## Data Collection

| File                                                             | Content                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [data/issue-1.json](data/issue-1.json)                           | The issue as returned by the GitHub API                                                         |
| [data/pr-2.json](data/pr-2.json)                                 | The pull request metadata                                                                       |
| [data/watermark-techniques.md](data/watermark-techniques.md)     | Every known text watermark and steganography technique, with sources and a 47-row carrier table |
| [data/competitors.md](data/competitors.md)                       | Survey of about 70 tools, services and libraries, with a deduplicated feature matrix            |
| [data/associative-tech-stack.md](data/associative-tech-stack.md) | The associative tech stack document referenced by the issue                                     |
| [data/reference-project](data/reference-project)                 | README, configuration and the text-cleaning scripts of guillaumemeyer/watermarks-remover        |
| [data/competitor-readmes](data/competitor-readmes)               | READMEs of 25 competing projects, as fetched                                                    |

The research notes tag every claim with how it was checked: `[V]` against
the primary source, `[S]` through secondary sources only, `[M]` from
background knowledge, `[U]` unverifiable. Unicode property claims were
checked against the Unicode Character Database files.

The data folder keeps the sources byte for byte, so it is excluded from
Prettier, the line limits and the self-check (see
`.watermarks-remover.lino`). Some of those files contain the very
characters this tool removes.

## Research: How Text Is Watermarked

The full catalogue is [data/watermark-techniques.md](data/watermark-techniques.md).
It sorts every technique into three families, and only two of them can be
handled by a tool that edits characters.

### Character-level carriers

These hide bits in which code points appear. Removing or replacing the
code points removes the information. The rule column names the rule of
this tool that removes them.

| Carrier                                                                                    | Known uses                                                                    | Rule                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Zero-width space, joiners, word joiner (U+200B..U+200D, U+2060, U+FEFF inside text)        | Fingerprinting, zwsp-steg, StegCloak, "Rules File Backdoor" prompt injection  | `zero-width`                                |
| Invisible operators U+2061..U+2064, soft hyphen, Hangul fillers, Mongolian vowel separator | StegCloak, Sneaky Bits, Certitude invisible JavaScript backdoor               | `invisible-format`                          |
| Tag characters U+E0000..U+E007F                                                            | ASCII smuggling into LLM prompts (Goodside, Rehberger 2024)                   | `tag-character`                             |
| Variation selector runs U+FE00..U+FE0F, U+E0100..U+E01EF                                   | Emoji byte smuggling (Butler 2025), GlassWorm and os-info-checker-es6 malware | `variation-selector`                        |
| Bidirectional controls                                                                     | Trojan Source, CVE-2021-42574                                                 | `bidi-control`                              |
| C2PA text manifests (Appendix A.8 wrapper and A.9 armoured block)                          | C2PA 2.3 and 2.4, EncypherAI                                                  | `provenance-manifest`                       |
| No-break, narrow no-break, em, thin and other spaces                                       | OpenAI o3 and o4-mini U+202F reports, EasyMark WhiteMark, Genius apostrophes  | `unusual-space`                             |
| Line and paragraph separators, NEL, form feed, C0 and C1 controls                          | Line-ending steganography, terminal escape injection                          | `line-separator`, `control-character`       |
| Trailing spaces and tabs, CR/LF mixtures                                                   | SNOW and stegsnow whitespace steganography                                    | `trailing-whitespace`, `line-endings`       |
| Homoglyphs (Cyrillic and Greek letters inside Latin words)                                 | Homoglyph watermarks, Trojan Source CVE-2021-42694, SilverSpeak               | `confusable`                                |
| Mathematical, fullwidth and ligature letters                                               | Filter evasion, "styled text"                                                 | `compatibility-character`                   |
| Stacked combining marks                                                                    | Zalgo text, carrier                                                           | `combining-marks`                           |
| Private use, noncharacters, unassigned code points                                         | GlassWorm (reported), generic carriers                                        | `private-use`, `noncharacter`, `unassigned` |
| Text that is not in NFC                                                                    | Decomposed letters as a two-way choice that can carry bits                    | `unicode-normalization`                     |
| Chatbot citation markers and `utm_source=chatgpt.com` style parameters                     | ChatGPT `contentReference[oaicite:N]` and private-use citation markers        | `ai-artifact`                               |
| Escapes that spell invisible characters in ASCII (`\u200B`, `&#x200B;`, `%E2%80%8B`)       | GlassWorm-style payloads hidden in source                                     | `escaped-character` (warning)               |
| Curly quotes, dashes and ellipses                                                          | Genius apostrophe watermark (2019), "AI tells"                                | `typographic-punctuation` (off by default)  |
| C2PA, XMP, IPTC and text chunks in PNG and JPEG images                                     | C2PA Content Credentials on generated images                                  | `image-metadata`                            |

When a hidden payload is found, the message shows what it says. Tag
characters, variation selector bytes and Sneaky Bits are decoded, so a
reviewer sees `hidden text "..."` and not only a code point.

### What cannot be removed by editing characters

Statistical watermarks bias which words a model chooses. The text contains
only ordinary characters, so no character filter can find or remove them.

- Kirchenbauer et al. green-list watermark (arXiv 2301.10226, ICML 2023).
- Aaronson / OpenAI Gumbel-max sampling watermark (2022).
- Google DeepMind SynthID-Text (Nature 634, 2024), used in Gemini.
- OpenAI textGrain (announced around 2026-10-05 for ChatGPT and Codex
  output in the EU). Secondary sources report that it adds no hidden
  symbols.
- Anthropic's Claude text watermark (2026-08-14), a version of SynthID-Text.
  Anthropic states that "nothing is added to the text and there are no
  hidden characters".

Only paraphrasing weakens them, and paraphrasing is not something a CI
check should do to a codebase. The tool therefore covers the character
level completely and the documentation says plainly that statistical
watermarks are out of reach. This is the only part of R4 that cannot be
met, and no competitor meets it either: the reference project's "Layer B"
paraphrases text with an LLM, which changes the meaning of code.

### Regulation

- EU AI Act Article 50(2) and the Code of Practice on transparency of
  AI-generated content: obligations apply from 2026-08-02, with
  multi-layer marking (metadata plus an imperceptible watermark).
- China's AIGC labelling measures and GB 45438-2025, in force since
  2025-09-01, prohibit removing labels.

The tool is meant for keeping a repository's own source code and
documentation clean. The `provenance-manifest` rule can be set to `warn` or
`off` by projects that publish C2PA-signed text on purpose. This is not
legal advice.

### Unicode guidance followed

- UTS #55 (Unicode Source Code Handling): flag invisible and bidirectional
  characters, keep them where a script needs them.
- UTS #39 (Unicode Security Mechanisms): mixed-script and confusable
  detection.
- UTR #36 (Unicode Security Considerations): replace noncharacters,
  report U+FFFD as evidence of earlier data loss.
- UTS #51 (Unicode Emoji): emoji ZWJ, keycap and tag flag sequences are
  legitimate.

## Competitors

The survey in [data/competitors.md](data/competitors.md) covers about 70
tools. The 40 most relevant are compared below. "Hidden" means invisible
and look-alike characters, "Files" means BOM, line endings, encoding and
whitespace, "Fix" means the tool can rewrite input, and "CI" means a
non-interactive check with exit codes or machine-readable output.

| #   | Tool                                     | Kind                | Hidden                   | Files                | Fix | CI                   |
| --- | ---------------------------------------- | ------------------- | ------------------------ | -------------------- | --- | -------------------- |
| 1   | guillaumemeyer/watermarks-remover        | Python CLI, plugin  | Yes, plus image metadata | No                   | Yes | SARIF, pre-commit    |
| 2   | sageuntethered/chatgpt-watermark-remover | JavaScript CLI      | Yes                      | No                   | Yes | Exit code            |
| 3   | out-of-character                         | npm library         | Yes                      | No                   | Yes | Via super-linter     |
| 4   | claude-artifact-detector                 | TypeScript CLI      | Some, plus HTML markers  | No                   | Yes | JSON                 |
| 5   | haidrrrry/claude-watermark-remover       | Python fork         | Yes                      | No                   | Yes | Inherited            |
| 6   | mohityadav8/ai-watermark-remover         | Python fork, web UI | Yes                      | No                   | Yes | Plugin hook          |
| 7   | unmarkk                                  | TypeScript CLI      | Some, plus HTML markers  | No                   | Yes | JSON                 |
| 8   | unmark-web                               | Browser app         | Yes                      | No                   | Yes | No                   |
| 9   | ASCII Smuggler                           | Web tool            | Tags, selectors, decode  | No                   | No  | No                   |
| 10  | Originality.ai invisible text remover    | Web service         | 87 characters            | No                   | Yes | No                   |
| 11  | GPTCleanup                               | Web service         | 421 characters           | No                   | Yes | No                   |
| 12  | everychar.com remover                    | Web tool            | Format category          | No                   | Yes | No                   |
| 13  | LeonardSEO/chatgpt-watermark-remover     | Browser extension   | Some                     | No                   | Yes | No                   |
| 14  | trubitsyn/go-zero-width                  | Go library          | 4 characters             | No                   | Yes | No                   |
| 15  | DavidJacobson/SafeText                   | Python CLI          | Some, homoglyphs         | No                   | Yes | No                   |
| 16  | nisconder/paste-xray                     | Web app, extension  | Yes, homoglyphs          | No                   | Yes | No                   |
| 17  | unspook                                  | npm CLI             | Yes                      | No                   | Yes | Exit code            |
| 18  | glyphguard                               | npm CLI             | Yes, decode              | No                   | Yes | JSON                 |
| 19  | secondsight                              | CLI                 | Yes, decode              | No                   | Yes | JSON                 |
| 20  | ghostchars                               | TypeScript CLI      | Yes                      | No                   | Yes | SARIF, Action        |
| 21  | Docguard                                 | Go CLI              | Some, decode             | No                   | No  | Exit code            |
| 22  | vibe-condom                              | Go CLI              | Some                     | No                   | No  | Action               |
| 23  | unicode-smuggling-guard                  | Python CLI          | Yes, decode              | No                   | No  | Annotations, summary |
| 24  | boundaryguard                            | Python CLI          | Yes                      | No                   | Yes | JSON, SARIF          |
| 25  | trojan-source                            | Reference corpus    | Bidi, homoglyphs         | No                   | No  | No                   |
| 26  | anti-trojan-source                       | npm CLI             | Format and control       | No                   | No  | Exit code            |
| 27  | eslint-plugin-anti-trojan-source         | ESLint plugin       | Bidi                     | No                   | No  | ESLint               |
| 28  | eslint-plugin-security bidi rule         | ESLint plugin       | Bidi                     | No                   | No  | ESLint               |
| 29  | GitHub bidirectional-text warning        | Platform feature    | Bidi                     | No                   | No  | No                   |
| 30  | VS Code `editor.unicodeHighlight`        | Editor feature      | Yes                      | No                   | No  | No                   |
| 31  | Gremlins tracker                         | VS Code extension   | Yes                      | No                   | No  | No                   |
| 32  | rustc and Clippy lints                   | Compiler lints      | Bidi, confusables        | No                   | No  | Compiler             |
| 33  | GCC `-Wbidi-chars` and clang-tidy        | Compiler warnings   | Bidi                     | No                   | No  | Compiler             |
| 34  | Semgrep bidi rule                        | Static analysis     | Bidi                     | No                   | No  | SARIF                |
| 35  | Ruff and Pylint                          | Python linters      | Bidi, confusables        | No                   | No  | Linter               |
| 36  | glassworm-hunter                         | Python scanner      | Selector runs, decoders  | No                   | No  | Exit code            |
| 37  | editorconfig-checker                     | Go CLI              | No                       | EOL, newline, spaces | Yes | GitHub, Code Climate |
| 38  | dos2unix                                 | CLI                 | No                       | EOL, BOM, UTF-16     | Yes | No                   |
| 39  | pre-commit/pre-commit-hooks              | Hooks               | No                       | BOM, EOL, newline    | Yes | pre-commit           |
| 40  | ftfy                                     | Python library      | Some                     | Mojibake             | Yes | No                   |

### What nobody combined before

1. Hidden-character security and file hygiene (BOM, line endings,
   encoding, trailing whitespace, final newline) in one tool. Tools 1-36
   do the first, tools 37-39 do the second.
2. Mojibake repair, which only ftfy has, in a CI tool.
3. Decoded hidden payloads together with GitHub annotations, a step
   summary, JSON and SARIF.
4. Context rules for emoji, flags, joining scripts, right-to-left text and
   CJK variation sequences in a JavaScript CLI.
5. Configuration in Links Notation.

`watermarks-remover` does all five. The features adopted from each tool
are listed in the "Copy" lines of [data/competitors.md](data/competitors.md).
The ones implemented in this pull request are:

- from the reference project: context preservation for emoji and joining
  scripts, refusing binary files, a separate exit code (2) for usage and
  configuration errors, SARIF;
- from ghostchars: the GitHub format, emoji flag tag sequences, styled
  text detection;
- from ASCII Smuggler, glyphguard and unicode-smuggling-guard: decoding
  tag, variation selector and Sneaky Bits payloads, and the GitHub step
  summary;
- from boundaryguard: a `schemaVersion` in JSON output, escaping file
  names in annotations;
- from paste-xray: reporting U+FFFD;
- from unspook: escaped (`U+200B`) display of every hidden character;
- from editorconfig-checker, dos2unix and pre-commit-hooks: line endings,
  BOM, final newline and trailing whitespace with Markdown hard breaks;
- from ftfy: mojibake repair;
- from claude-artifact-detector and unmarkk: chatbot artifacts.

### Plugins and hooks versus CI

The reference project and several competitors ship editor plugins, agent
skills and post-tool hooks. The issue asks for CI/CD instead. A CI check
runs for every contributor and every tool that wrote the change, cannot be
skipped by a missing local setup, and reports in the pull request. The
same command runs locally with `--fix`, and a `--stdin` mode lets an
editor or hook call it if a team wants one.

## Existing Components and Libraries

| Component                              | Use in this pull request                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `links-notation`                       | Parses `.watermarks-remover.lino`                                                                 |
| JavaScript `\p{...}` property escapes  | General category, script and Default_Ignorable checks follow the Unicode version of the runtime   |
| `String.prototype.normalize`           | NFC normalization                                                                                 |
| `TextDecoder`                          | UTF-16, UTF-32 and legacy encodings                                                               |
| `git ls-files`                         | File discovery that respects `.gitignore`                                                         |
| Unicode `confusables.txt` (UTS #39)    | The Latin, Cyrillic and Greek look-alike table in `src/confusables.js`                            |
| `lino-arguments`                       | Considered for argument parsing; not used, so that the CLI keeps a single dependency              |
| `lino-objects-codec`, `lino-i18n`      | Not needed yet; candidates for a Links Notation report format and translated messages             |
| charset-normalizer, chardet, jschardet | Not used: guessing encodings is unreliable on short files, so the tool uses a configured fallback |
| ftfy                                   | Not used (Python); its Windows-1252 mojibake detection was reimplemented                          |

## Associative Tech Stack

The associative tech stack ([data/associative-tech-stack.md](data/associative-tech-stack.md))
recommends Links Notation for data and configuration. The tool follows it:

- The configuration file is `.watermarks-remover.lino`, parsed by
  `links-notation`. JSON configuration is not supported, so there is one
  format to learn.
- Indentation expresses nesting and `#` starts a comment, so the file
  reads like a list:

```lino
encoding: utf-8
bom: remove
line-endings: lf

files
  exclude
    'vendor'

rules
  typographic-punctuation: off

overrides
  '*.bat' '*.cmd'
    line-endings: crlf
```

- `--init` writes a starter file in which every setting is commented.
- Unknown settings and invalid values stop the run with exit code 2 and
  name the file and the setting, so typos are not silently ignored.

## Design Decisions

### Never get in the way of legitimate work

- Characters that a script or emoji needs are kept: ZWJ in emoji
  sequences, ZWJ and ZWNJ between letters of Arabic, Persian and Indic
  scripts, LRM and RLM next to right-to-left letters, one variation
  selector after a base it can modify, tag sequences that form a flag.
- Escapes such as `\u200B` are a warning, not an error, and are never
  rewritten: tests and documentation need them, and rewriting them could
  change program behaviour.
- `unexpected-script` and `file-name` are reported but never fixed,
  because only a person can decide what the right text is.
- Binary files and files above `max-file-size` are skipped. Images are
  only touched by `image-metadata`, which keeps EXIF.
- Every fix is idempotent: running `--fix` twice changes nothing the
  second time, which the tests check.
- `overrides` let a project relax any rule or setting for a path, for
  example `line-endings: crlf` for Windows batch files or
  `encoding: keep` for a file that must stay in a legacy encoding.

### One fix command

The failure message repeats the exact command with the same paths and
`--config`, so the author can copy it. In GitHub Actions each problem is
also an annotation on the changed line, and the step summary has a table.

### Known limits

- Statistical watermarks cannot be detected or removed (see above).
- A no-break space before `:` in French typography is reported by
  `unusual-space`. Projects with French prose can set the rule to `warn`
  or `off` for those paths.
- `.editorconfig` and `.gitattributes` are not read; line endings, BOM and
  encoding come from `.watermarks-remover.lino`.
- The whole file is checked, not only the changed lines.
- There are no inline disable comments; exceptions are per path.

## Name Proposals

The issue asks for 10-20 names with a more general meaning, because the
tool does much more than remove watermarks. Twenty-three were collected,
grouped by what they emphasise. On 2026-10-12 the npm registry returned
"404 Not Found" for `text-hygiene`, so the recommended name is free.

**Hygiene of text and source**

1. `text-hygiene` (recommended: general, descriptive, and matches how the
   tool is used, as a routine check)
2. `unicode-hygiene`
3. `source-hygiene`
4. `byte-hygiene`
5. `clean-bytes`
6. `clear-source`

**Guarding against hidden content**

7. `plaintext-guard`
8. `glyph-guard`
9. `charguard`
10. `codepoint-guard`
11. `invisible-guard`
12. `textguard`
13. `encoding-guard`
14. `cleartext-guard`

**What you see is what you get**

15. `visible-text`
16. `wysiwyg-text`
17. `honest-text`
18. `pure-text`

**Short tool names**

19. `textsan`
20. `sanitext`
21. `normtext`
22. `unicop`
23. `clean-text-ci`

`glyphguard` and `ghostchars` are taken by competitors, so names close to
them were avoided. Renaming the package is a decision for the maintainers;
the code refers to the name in `package.json`, the README and the
configuration file name only.

## Verification

- `npm test` runs the unit tests for configuration, encodings, images, the
  rule engine, hidden payload decoding, the CLI and the example app.
- `node bin/watermarks-remover.js` checks this repository in the lint job
  of `.github/workflows/release.yml`; a test pins that step.
- `examples/basic-usage.js` shows the library API, and the example app
  (`npm run example:web:build`) shows the same checks in a browser.

## Future Work

- Read `.editorconfig` (`end_of_line`, `charset`, `insert_final_newline`,
  `trim_trailing_whitespace`) and `.gitattributes` (`eol`,
  `working-tree-encoding`) as defaults.
- A `--changed` mode that checks only lines changed against a base branch.
- A published GitHub Action wrapping the CLI.
- Inline disable comments for single lines.
- Named policies such as `french-typography` and `agent-files`, and
  detection of chat-template tokens such as `<|im_start|>` in agent
  instruction files.
- PDF and DOCX metadata.

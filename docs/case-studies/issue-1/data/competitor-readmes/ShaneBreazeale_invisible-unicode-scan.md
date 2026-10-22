# Invisible Unicode Scan

A GitHub Action that detects invisible Unicode characters used in supply-chain attacks — variation selectors (Glassworm), bidi overrides (Trojan Source), zero-width characters, and more.

## Background

In March 2026, [Aikido Security discovered](https://www.aikido.dev/blog/catching-invisible-malware-in-open-source) the Glassworm campaign: 151+ malicious packages on GitHub, npm, and Open VSX using invisible Unicode characters to conceal malicious code. The attack encodes payloads using Unicode variation selectors (U+FE00–U+FE0F, U+E0100–U+E01EF), which render as invisible whitespace in every editor, terminal, and code review interface — but decode to executable code at runtime.

This action scans your source files for these invisible characters and fails the build if any are found.

## Usage

### Basic

```yaml
- uses: your-org/invisible-unicode-scan@v1
```

Scans `src/` for all file types. Fails the workflow on detection.

### Custom paths and extensions

```yaml
- uses: your-org/invisible-unicode-scan@v1
  with:
    paths: 'src/ lib/ scripts/'
    include-extensions: 'ts,tsx,js,jsx,json'
```

### Warn without failing

```yaml
- uses: your-org/invisible-unicode-scan@v1
  id: unicode-scan
  with:
    fail-on-detection: 'false'

- if: steps.unicode-scan.outputs.found == 'true'
  run: echo "Warning: found invisible Unicode in ${{ steps.unicode-scan.outputs.matches }} location(s)"
```

## Inputs

| Input | Description | Default |
|---|---|---|
| `paths` | Space-separated list of paths to scan | `src/` |
| `include-extensions` | Comma-separated file extensions (e.g. `ts,tsx,js`). Empty = all files | `''` |
| `fail-on-detection` | Fail the workflow if invisible Unicode is detected | `true` |
| `categories` | Comma-separated categories to scan (see below) | all categories |

## Outputs

| Output | Description |
|---|---|
| `found` | `true` if invisible Unicode was detected, `false` otherwise |
| `matches` | Number of locations containing invisible Unicode characters |

## Detection categories

All categories are enabled by default. Disable specific categories if they produce false positives in your codebase (e.g. `zero-width` in multilingual projects).

| Category | Codepoints | Attack |
|---|---|---|
| `variation-selectors` | U+FE00–FE0F, U+E0100–E01EF | Glassworm — invisible payload encoding via variation selectors |
| `bidi` | U+202A–202E, U+2066–2069 | [Trojan Source](https://trojansource.codes) (CVE-2021-42574) — bidi overrides reorder displayed code |
| `zero-width` | U+200B–200D, U+FEFF | Zero-width joiners/spaces — hide content in strings and identifiers |
| `tags` | U+E0001–E007F | Tag characters — invisible encoding similar to variation selectors |
| `other` | U+00AD, U+034F, U+2060–2064, U+180E, U+2800 | Soft hyphens, invisible operators, braille blank, etc. |

### Scan only specific categories

```yaml
- uses: your-org/invisible-unicode-scan@v1
  with:
    categories: 'variation-selectors,bidi'
```

## What it does NOT cover

- **Dependencies in `node_modules/`** — use `npm audit`, lockfile integrity checks, and tools like [Socket](https://socket.dev) for dependency scanning.

## License

MIT

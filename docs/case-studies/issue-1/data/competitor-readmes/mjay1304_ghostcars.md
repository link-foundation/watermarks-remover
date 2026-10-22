# 👻 ghostchars

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![CI](https://github.com/mjay1304/ghostchars/actions/workflows/scan-ghostchars.yml/badge.svg)
![Security](https://img.shields.io/badge/security-supply--chain--safe-orange)

**Detect invisible Unicode hiding in your source code before attackers do.**  
`ghostchars` finds zero-width spaces, BOMs, bidi overrides, and other ghost characters that can hide malicious logic or mislead reviewers.

---

## 🚀 Why it matters

Invisible Unicode characters are increasingly used in **supply chain attacks** to:
- Inject logic that changes how code executes but *looks* normal.
- Obfuscate scripts, configuration files, or commit diffs.
- Leak credentials or run hidden payloads (see “Glassworm”, 2025).

`ghostchars` helps you **see the unseen** — directly in CI, pre-commit hooks, or local dev scans.

---

## 🧭 What it flags

- **Zero-width characters**: `U+200B`, `U+200C`, `U+200D`
- **BOM**: `U+FEFF`
- **Variation selectors**: `U+FE00–U+FE0F`, `U+E0100–U+E01EF`
- **Bidirectional overrides**: `U+202A..U+202E`, `U+2066..U+2069`
- **No-break space**: `U+00A0`
- Anything in Unicode category **Cf** (Format) or most **Cc** (Control), except TAB/LF/CR.

---

## ⚡ Quick start

```bash
# 1) Install or clone
curl -O https://raw.githubusercontent.com/your-org/ghostchars/main/ghostchars.py
chmod +x ghostchars.py

# 2) Scan your project
./ghostchars.py

# Optional: JSON output
./ghostchars.py --json > findings.json
```

It auto-walks your repo and scans common text/code files.  
Use `--include` / `--exclude` to fine-tune globs.

---

## 🧱 Pre-commit hook

Add this to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: ghostchars
        name: ghostchars
        entry: python3 ghostchars.py --ci --include '*'
        language: system
        pass_filenames: false
```

Then:

```bash
pre-commit install
```

---

## 🧪 GitHub Actions (CI)

`.github/workflows/scan-ghostchars.yml`:

```yaml
name: Ghostchars Scan
on:
  pull_request:
  push:
    branches: [ main, master ]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      - name: Run ghostchars
        run: python3 ghostchars.py --ci
```

This workflow fails the build if any invisible Unicode is found.

---

## ⚙️ CLI options

```
usage: ghostchars.py [PATH ...]

optional arguments:
  --include GLOB        include glob (repeatable)
  --exclude GLOB        exclude glob (repeatable)
  --exclude-dir NAME    directory to exclude (repeatable)
  --json                output JSON
  --ci                  exit 1 if findings exist
```

---

## 🕵️‍♀️ How it works

- Walks files recursively, skipping binaries.
- Detects any Unicode from categories **Cf** and **Cc** (except common whitespace).
- Prints findings with line and column numbers, plus a short snippet.

Example output:

```
⚠️  Found 2 suspicious character(s):
src/utils.js:12:17 U+200B ZERO WIDTH SPACE
    if (user == "admin")​return True
```

---

## 📜 License

MIT — see [LICENSE](./LICENSE)

---

**`ghostchars` — see the unseen. Stop Unicode-based supply-chain attacks before they start.**

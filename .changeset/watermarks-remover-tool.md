---
'@link-foundation/watermarks-remover': minor
---

Add the watermarks-remover command line tool and library. It finds and removes hidden characters and AI text watermarks (zero-width and bidirectional controls, Unicode tag and variation selector payloads, invisible operators, private use characters, look-alike letters, combining mark floods, ChatGPT citation artifacts and C2PA text manifests), normalizes line endings, byte order marks and file encodings to UTF-8, repairs mojibake, and strips text metadata chunks from PNG and JPEG files. It fails CI with the exact `--fix` command to run, reads its settings from a readable Links Notation file (`.watermarks-remover.lino`), and reports as text, GitHub annotations with a step summary, JSON or SARIF.

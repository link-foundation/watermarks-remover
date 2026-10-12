# Text watermarking and text steganography: a catalogue for a CI stripping tool

Compiled 2026-10-12. Scope: every known technique that hides information in, or marks, text, both AI-specific and general. The goal is to let a CI tool detect and strip every character-level carrier from source code and docs.

## Verification legend

Each claim is tagged with how it was checked.

- **[V]**: verified in this session against the primary source, or against primary data such as the Unicode Character Database (UCD) files.
- **[S]**: verified only through secondary sources such as press, blogs or reviews. The primary source was unavailable.
- **[M]**: from background knowledge, not re-fetched in this session. Treat it as unverified until checked.
- **[U]**: unverifiable or contradictory. Kept only so the gap is visible.

## Unicode data used

All code-point property claims below come from the Unicode Character Database. The `latest` files are Unicode 18.0.0; DerivedCoreProperties-18.0.0.txt is dated 2026-08-07. [V]

- https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt (Default_Ignorable_Code_Point)
- https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt (White_Space, Bidi_Control, Join_Control, Variation_Selector, Noncharacter_Code_Point, Pattern_White_Space)
- https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt (general category and decomposition mappings)

## The key distinction for a CI tool

There are two families of technique, and a CI tool can only remove one of them.

1. **Character-level carriers.** These hide bits in which code points appear, such as invisible characters, alternative spaces, look-alike letters, line endings or trailing whitespace. Detecting and stripping or replacing those code points removes the information.
   - Ordinary Unicode normalization (NFC/NFD) does **not** remove most of them. NFC leaves ZWSP, tag characters, variation selectors and bidi controls unchanged.
   - NFKC/NFKD folds only the "compatibility" ones: NBSP, the U+2000..U+200A spaces, U+202F, U+205F, U+3000, fullwidth and mathematical letters, and the ellipsis. It still leaves every Default_Ignorable code point intact.
   - A dedicated stripping or replacement pass is therefore required. [V] (from UnicodeData.txt decomposition fields, for example `202F;...;<noBreak> 0020`, `1D400;...;<font> 0041`, `2026;...;<compat> 002E 002E 002E`, while `200B`, `FE0F` and `E0041` have no decomposition)
2. **Statistical token-level watermarks.** Examples are Kirchenbauer green lists, Aaronson/Gumbel sampling, SynthID-Text, OpenAI textGrain and Anthropic's Claude text watermark. The signal lives in *which words and tokens were chosen*, and the text contains only ordinary characters.
   - Stripping characters cannot remove these watermarks. Only paraphrasing or rewriting weakens them.
   - A CI tool can at most document that they exist. It cannot detect them without the vendor's key or detector.

A third family sits on top of both: **provenance metadata (C2PA)**. In text it is carried either as a run of invisible variation selectors, which is character-level and strippable, or as an ASCII-armoured comment block in structured text, which is visible and removable by deleting the block.

---

## Part A. Invisible-character binary encodings

### A1. Zero-width fingerprinting and steganography (generic)

- **How it works:** Bits are encoded as a sequence of zero-width characters inserted between visible characters, usually after the first character or between words. Each recipient gets a different invisible pattern, so a leak can be traced to its source.
- **Code points:**
  - The usual set is U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 WJ and U+FEFF ZWNBSP/BOM.
  - Some tools also use U+200E and U+200F, or U+202C.
  - All of these are Default_Ignorable_Code_Point. [V]
- **People and dates:**
  - Zach Aysan's 2018 write-up on zero-width fingerprinting popularised the leak-tracing idea, as reported by Tripwire/Security Boulevard in April 2018. Tom Ross is credited in the same piece with tracing message-board leaks this way. [S] The original Aysan post was not re-fetched. [M]
  - Steganographr is a web tool by Neatnik that hides a message in a zero-width string. [S]
- **Removable by character stripping:** Yes.
- **Sources:**
  - https://securityboulevard.com/2018/04/find-out-who-is-leaking-your-secrets-with-help-from-invisible-zero-width-characters/
  - https://neatnik.net/steganographr

### A2. zwsp-steg (zwsp-steg-js / zwsp-steg-py)

- **How it works:** The library encodes a message using a small alphabet of zero-width characters.
  - `MODE_ZWSP` uses U+200B, U+200C and U+200D.
  - `MODE_FULL` adds further invisible characters. The exact extra set was not re-verified, but it is reported to include U+200E, U+200F and U+202A–U+202E. [M]
- **People and dates:** The original JS library is attributed to "offdev" on GitHub; the original repository was not verified in this session [U]. The Python port is zwsp-steg-py. [S]
- **Removable by character stripping:** Yes.
- **Source:** https://libraries.io/pypi/zwsp-steg-py

### A3. StegCloak

- **How it works:** The secret is compressed with LZ and Huffman coding, optionally encrypted with AES-256-CTR and authenticated with HMAC. The resulting bits are mapped to invisible characters, 2 bits per character, and inserted between the first two words of an innocuous cover text.
- **Code points:** These were verified in `stegcloak.js` [V]:
  ```
  const zwc = ["‌", "‍", "⁡", "⁢", "⁣", "⁤"];
  ```
  That is ZWNJ, ZWJ, FUNCTION APPLICATION, INVISIBLE TIMES, INVISIBLE SEPARATOR and INVISIBLE PLUS.
- **People and dates:** KuroLabs; the repository was created 2020-04-28. [V]
- **Removable by character stripping:** Yes. Stripping must cover U+2061..U+2064 as well as the usual ZW characters.
- **Source:** https://github.com/KuroLabs/stegcloak

### A4. "Unicode Steganography with Zero-Width Characters" (330k / "Holloway" attribution)

- **How it works:** A web tool that encodes text into zero-width characters.
  - The default alphabet is U+200C, U+200D, U+202C and U+FEFF, configurable via `setUseChars`.
  - The page says U+200B is avoided by default because Gmail strips it.
  - The tool also offers a homoglyph mode, which is visible-character steganography. [V for the page content]
- **People and dates:** Hosted at 330k.github.io. The page attributed it to Kei Nakagawa in the original research notes, but the author's name is not shown on the tool page itself. The attribution to "Holloway" in the task brief could not be verified. [U]
- **Removable by character stripping:** Yes for the zero-width mode. The homoglyph mode needs confusable detection (see C3).
- **Source:** https://330k.github.io/misc_tools/unicode_steganography.html

### A5. Unicode Tags block "ASCII smuggling"

- **How it works:** Each ASCII character is shifted into the Tags block by adding 0xE0000, so `A` (U+0041) becomes U+E0041.
  - Tag characters are Default_Ignorable, so most renderers show nothing.
  - Many LLM tokenizers still decode them, so models read hidden instructions (prompt injection) or emit hidden data (exfiltration or watermark-like marking).
- **Code points:**
  - The main payload range is U+E0020..U+E007E.
  - Also used: U+E0001 LANGUAGE TAG (deprecated) and U+E007F CANCEL TAG.
  - The whole block U+E0000..U+E007F is Default_Ignorable. U+E0001 and U+E0020..U+E007F are general category Cf. [V]
- **People and dates:**
  - Riley Goodside demonstrated it on X on 2024-01-11. [S]
  - Johann Rehberger (Embrace The Red) published the analysis on 2024-01-14, released the "ASCII Smuggler" tool, and recommended filtering tag code points both in prompts and in responses. [V]
  - Microsoft fixed an ASCII-smuggling exfiltration chain in Microsoft 365 Copilot in August 2024. [S]
  - FireTail (Viktor Markopoulos, 2025) reported that Gemini, Grok and DeepSeek were susceptible; Google reportedly declined to fix. ChatGPT, Claude and Copilot reportedly filtered the characters. [S]
  - A Cloud Security Alliance research note dated 2026-03-10, labelled AI-assisted and not officially reviewed, makes two claims. These are single-source. [U]
    - Rehberger demonstrated tag injection against Claude on 2024-02-08.
    - On 2026-02-11 Rehberger showed invisible instructions in agent "skill" Markdown files being executed by Claude Code, Copilot and Gemini CLI.
- **Legitimate use:** Emoji tag sequences (UTS #51) for subdivision flags: U+1F3F4, then tag characters in U+E0020..U+E007E, then U+E007F. England is `1F3F4 E0067 E0062 E0065 E006E E0067 E007F` ("gbeng"). [S] This was checked against Wikipedia and CLDR-derived pages; the UTS #51 text was not fetched.
- **Removable by character stripping:** Yes. A tool should strip every tag character that is not part of a well-formed emoji tag sequence after U+1F3F4.
- **Sources:**
  - https://embracethered.com/blog/posts/2024/hiding-and-finding-text-with-unicode-tags/
  - https://languagelog.ldc.upenn.edu/nll/?p=66513
  - https://www.theregister.com/2024/08/28/microsoft_copilot_copirate
  - https://thehackernews.com/2024/08/microsoft-fixes-ascii-smuggling-flaw.html
  - https://www.techradar.com/pro/security/google-says-it-wont-fix-this-potentially-concerning-gemini-security-issue
  - https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/CSA_research_note_unicode_instruction_injection_ai_skills_20260310-csa-styled.pdf
  - https://en.wikipedia.org/wiki/Tags_(Unicode_block)

### A6. Variation-selector byte encoding ("emoji smuggling", Paul Butler)

- **How it works:** Each byte of an arbitrary payload maps to one of the 256 variation selectors, and the whole run is appended after any base character, often an emoji.
  - Byte 0..15 maps to U+FE00..U+FE0F (VS1..VS16).
  - Byte 16..255 maps to U+E0100..U+E01EF (VS17..VS256).
  - Renderers display only the base character. Copy and paste preserves the selectors, and LLM tokenizers see them.
- **Code points:** U+FE00..U+FE0F and U+E0100..U+E01EF. Both ranges are Default_Ignorable and have the Variation_Selector property. Also related: U+180B..U+180D and U+180F (the Mongolian free variation selectors). [V]
- **People and dates:**
  - Paul Butler published this on 2025-02-08. He explicitly mentions watermarking as a use and calls the technique an abuse of Unicode. [V]
  - FireTail's "emoji smuggling" research (January 2026) applied it to LLM prompt injection. [S]
- **Legitimate use:**
  - VS15 (U+FE0E) and VS16 (U+FE0F) directly after an emoji or text-capable base.
  - Standardized variation sequences (StandardizedVariants.txt).
  - Ideographic Variation Sequences (CJK base followed by U+E0100..U+E01EF, registered in the IVD).
  - Mongolian FVS after Mongolian letters.
  - Legitimate use is always **one** selector after an appropriate base. Runs of two or more are anomalous.
- **Removable by character stripping:** Yes. Strip selector runs longer than one, and selectors after a base that has no registered sequence.
- **Sources:**
  - https://paulbutler.org/2025/smuggling-arbitrary-data-through-an-emoji/
  - https://securityboulevard.com/2026/01/peek-a-boo-%F0%9F%AB%A3-emoji-smuggling-and-modern-llms-firetail-blog/

### A7. Sneaky Bits

- **How it works:** A binary encoding that uses two invisible math operators: bit 0 is U+2062 INVISIBLE TIMES and bit 1 is U+2064 INVISIBLE PLUS. The pair is configurable. The same post also covers variation-selector byte encoding and credits Butler.
- **Code points:** U+2062 and U+2064, with U+2061 and U+2063 as possible alternatives. All are Cf and Default_Ignorable. [V]
- **People and dates:** Johann Rehberger, 2025-03-12. The technique was added to the ASCII Smuggler tool. [V]
- **Removable by character stripping:** Yes.
- **Source:** https://embracethered.com/blog/posts/2025/sneaky-bits-and-ascii-smuggler/

### A8. Invisible-Unicode code payloads in malware (os-info-checker-es6, GlassWorm, MITRE T1027.018)

- **os-info-checker-es6 (npm, May 2025):** A JavaScript payload was hidden after a `|` character as Variation Selectors Supplement characters (U+E0100..U+E01EF). These decode to Base64, and the decoded stage uses Google Calendar as command-and-control. [S]
  - https://www.veracode.com/resources/sophisticated-npm-attack-leveraging-unicode-steganography-and-google-calendar-c2
  - https://www.bleepingcomputer.com/news/security/malicious-npm-package-uses-unicode-steganography-to-evade-detection/
- **GlassWorm (Koi Security, found 2025-10-17, disclosed 2025-10-18 to 10-20):** A self-propagating worm in OpenVSX and VS Code extensions.
  - The malicious JavaScript is encoded as invisible characters inside an empty-looking template literal. The decoder maps U+FE00..U+FE0F to 0..15 and U+E0100..U+E01EF to `cp - 0xE0100 + 16` (16..255), then calls `eval(Buffer.from(s(``)).toString('utf-8'))`. [S]
  - Some reports (MITRE, BleepingComputer quoting Koi) describe the characters as "Private Use Area". Others (Endor Labs, the bearblog decoder analysis) show they are variation selectors. Treat both ranges as carriers. [U regarding the exact characters per wave]
  - Later waves in November 2025 reached GitHub repositories and MCP-related packages. [S]
  - Sources:
    - https://koi.ai/blog/glassworm-first-self-propagating-worm-using-invisible-code-hits-openvsx-marketplace (now redirects; not readable in this session)
    - https://www.bleepingcomputer.com/news/security/self-spreading-glassworm-malware-hits-openvsx-vs-code-registries/
    - https://jpcouture.bearblog.dev/glassworm-when-source-code-lies-to-your-eyes/
    - https://labs.cloudsecurityalliance.org/research/csa-research-note-glassworm-supply-chain/
    - https://mondoo.com/blog/glassworm-proves-it-supply-chain-worm-era-no-longer-theoretical
- **MITRE ATT&CK T1027.018 "Obfuscated Files or Information: Invisible Unicode"** (created 2026-04-22):
  - Covers zero-width characters, variation selectors, bidi controls and PUA.
  - GlassWorm is listed as S9010.
  - The suggested detection is a low ratio of printable to total characters in a string that is then passed to eval or a decoder. [S]
  - https://attack.mitre.org/techniques/T1027/018
- **Removable by character stripping:** Yes. A CI tool should treat any run of selectors, tags or PUA characters inside a string literal as high severity and fail, not silently strip it, because stripping changes program behaviour.

### A9. Certitude "invisible backdoor" (Hangul filler as identifier)

- **How it works:** U+3164 HANGUL FILLER is general category Lo, so it is a valid identifier character in JavaScript and other languages, yet it renders as blank.
  - The proof of concept destructures `req.query` into an invisible variable, `const { timeout,ㅤ } = req.query;`.
  - It then includes that variable in a `child_process` command array, `[ 'ping -c 1 google.com', 'curl -s http://example.com/',ㅤ ]`, which allows remote command execution.
  - The same post also covers homoglyph function names.
- **Code points:**
  - The Hangul fillers are U+115F (CHOSEONG FILLER), U+1160 (JUNGSEONG FILLER), U+3164 (HANGUL FILLER) and U+FFA0 (HALFWIDTH HANGUL FILLER).
  - All four are Lo **and** Default_Ignorable. NFKC maps U+3164 to U+1160 and U+FFA0 to U+3164, so NFKC does not remove them. [V]
  - Related: U+17B4 and U+17B5 (Khmer inherent vowels, Mn, Default_Ignorable).
- **People and dates:** Wolfgang Ettlinger (Certitude), 2021-11-09. [S] The INVISIBLE.js demo (aem1k) showed invisible JS identifiers. [S]
- **Legitimate use:** U+115F and U+1160 appear in archaic or decomposed Korean jamo text. They almost never appear in code or English docs.
- **Removable by character stripping:** Yes, but inside identifiers stripping changes semantics. Report and fail.
- **Sources:**
  - https://certitude.consulting/blog/en/invisible-backdoor/
  - https://www.bleepingcomputer.com/news/security/invisible-characters-could-be-hiding-backdoors-in-your-javascript-code/
  - https://aem1k.com/invisible

### A10. Trojan Source (bidi reordering), plus related invisible/homoglyph attacks

- **How it works:** Bidirectional override and isolate controls reorder how source code *renders* without changing the logical order the compiler sees. Comments can appear to contain code, code can appear commented out, and string literals can appear to end early.
  - CVE-2021-42574 covers the bidi attack.
  - CVE-2021-42694 covers homoglyph identifiers, for example Cyrillic letters.
- **Code points:**
  - U+202A LRE, U+202B RLE, U+202C PDF, U+202D LRO, U+202E RLO.
  - U+2066 LRI, U+2067 RLI, U+2068 FSI, U+2069 PDI.
  - Also U+200E LRM, U+200F RLM and U+061C ALM. All of these have the Bidi_Control property. [V]
- **People and dates:** Nicholas Boucher and Ross Anderson (Cambridge), 2021-11-01. [S]
- **Platform responses:**
  - GitHub began warning on bidi text on 2021-10-31. [V]
  - VS Code 1.63 (November 2021) added Unicode highlighting of invisible and ambiguous characters. [S]
  - Rust, GCC (`-Wbidi-chars`) and others added lints. [M]
  - GitHub added a "hidden Unicode text" warning on 2025-05-01, citing abuse "especially by AI". [V]
- **Removable by character stripping:** Yes for the controls. Homoglyphs need confusable checks (C3). UTS #55 says not to forbid bidi controls outright in strings and comments, but to make them visible and check that they are balanced (see Part F).
- **Sources:**
  - https://trojansource.codes [M]
  - https://lwn.net/Articles/874951
  - https://thehackernews.com/2021/11/new-trojan-source-technique-lets.html
  - https://github.blog/changelog/2021-10-31-warning-about-bidirectional-unicode-text/
  - https://github.blog/changelog/2025-05-01-github-now-provides-a-warning-about-hidden-unicode-text
  - https://code.visualstudio.com/updates/v1_63

### A11. "Rules File Backdoor" (hidden instructions for AI coding assistants)

- **How it works:** Hidden Unicode (zero-width joiners and bidi markers) is placed in Cursor and GitHub Copilot rules and configuration files. The assistant reads the hidden instructions and emits backdoored code, while a human reviewer sees nothing.
- **Code points:** ZW characters (U+200B..U+200D, U+2060) and bidi controls. Tags and selectors could be used in the same way.
- **People and dates:** Pillar Security, 2025-03-18. [S]
- **Removable by character stripping:** Yes.
- **Source:** https://thehackernews.com/2025/03/new-rules-file-backdoor-attack-lets.html

### A12. "Bad Characters: Imperceptible NLP Attacks"

- **How it works:** Adversarial text for NLP models built from four perturbation types:
  - invisible characters (ZWSP, ZWNJ, ZWJ);
  - homoglyphs;
  - reorderings via bidi controls;
  - deletions via control characters U+0008 BACKSPACE and U+007F DELETE (and carriage return), which make text render differently from its encoding.
- **People and dates:** Boucher, Shumailov, Anderson and Papernot. arXiv 2106.09898, June 2021; IEEE S&P 2022. [S]
- **Removable by character stripping:** Yes. C0 and C1 controls other than TAB, LF and CR must also be flagged.
- **Sources:** https://arxiv.org/abs/2106.09898 and https://github.com/nickboucher/imperceptible

### A13. Other Default_Ignorable or invisible format characters usable as carriers

None of these has a widely reported named technique. Each is invisible or zero-width in common renderers and therefore usable in any of the A1–A7 encodings. Properties come from UCD 18.0.0. [V]

| Code point(s) | Name | Notes |
|---|---|---|
| U+00AD | SOFT HYPHEN | Cf, Default_Ignorable. Invisible except at a line break. Used in hyphenation; reported in zero-width-style fingerprinting tools. [M] |
| U+034F | COMBINING GRAPHEME JOINER (CGJ) | Mn, Default_Ignorable. Legitimate only to block canonical reordering (Hebrew, some sorting). |
| U+061C | ARABIC LETTER MARK | Cf, Bidi_Control. |
| U+115F, U+1160, U+3164, U+FFA0 | Hangul fillers | See A9. |
| U+17B4, U+17B5 | KHMER VOWEL INHERENT AQ/AA | Default_Ignorable; Unicode discourages their use. |
| U+180B..U+180D, U+180F | MONGOLIAN FREE VARIATION SELECTORS 1–4 | Variation_Selector. |
| U+180E | MONGOLIAN VOWEL SEPARATOR | Cf, Default_Ignorable. It was Zs (whitespace) until Unicode 6.3 [M], so older regexes treat it as a space. |
| U+200B..U+200F | ZWSP, ZWNJ, ZWJ, LRM, RLM | See A1 and A10. |
| U+2060..U+2064 | WJ, FUNCTION APPLICATION, INVISIBLE TIMES, INVISIBLE SEPARATOR, INVISIBLE PLUS | Default_Ignorable. Used by StegCloak and Sneaky Bits. |
| U+2065 | (unassigned) | Default_Ignorable reserved. |
| U+206A..U+206F | Deprecated format characters (ISS, ASS, IAFS, AAFS, NADS, NODS) | Cf, Default_Ignorable, deprecated. |
| U+FEFF | ZERO WIDTH NO-BREAK SPACE / BOM | Legitimate only as a BOM at offset 0. Also the prefix of the C2PA text wrapper (D7). |
| U+FFF0..U+FFF8 | (unassigned) | Default_Ignorable reserved. |
| U+FFF9..U+FFFB | INTERLINEAR ANNOTATION ANCHOR / SEPARATOR / TERMINATOR | Cf, not Default_Ignorable. Internal use only per the standard. They can hide an "annotation" segment that some renderers drop. [M on rendering behaviour] |
| U+1BCA0..U+1BCA3 | SHORTHAND FORMAT CONTROLS (Duployan) | Cf, Default_Ignorable. |
| U+1D173..U+1D17A | MUSICAL SYMBOL BEGIN/END BEAM, TIE, SLUR, PHRASE | Cf, Default_Ignorable. |
| U+E0000..U+E0FFF | Tags, VS supplement and reserved | Default_Ignorable (see A5, A6). |

Visible-but-blank look-alikes that are **not** Default_Ignorable but render as blank or nearly blank [V for properties]:

- U+2800 BRAILLE PATTERN BLANK (So)
- U+3000 IDEOGRAPHIC SPACE
- U+1D159 MUSICAL SYMBOL NULL NOTEHEAD (So)
- U+FFFC OBJECT REPLACEMENT CHARACTER
- U+1680 OGHAM SPACE MARK, which is Zs but renders as a dash in most fonts

Format characters that are Cf but **visible** (prepended concatenation marks):

- U+0600..U+0605, U+06DD, U+070F, U+0890..U+0891, U+08E2, U+110BD, U+110CD
- U+13430..U+1343F (Egyptian hieroglyph format controls)

These are low risk and should be report-only in non-Arabic, non-Syriac and non-Kaithi contexts.

---

## Part B. Alternative-space, punctuation and line-ending carriers (visible-ish)

### B1. OpenAI o3 / o4-mini "watermark" report (U+202F) and OpenAI's response

- **How it works:** Rumi (rumidocs.com) reported that ChatGPT output from the new o3 and o4-mini models contained special characters, chiefly U+202F NARROW NO-BREAK SPACE, in places where a normal space was expected. Rumi speculated these were a watermark. The characters were not seen in GPT-4o output.
- **Code points:** Mainly U+202F, which NFKC maps to U+0020 and which is White_Space. Some secondary coverage also mentions other special spaces. [S]
- **Date and response:**
  - Rumi posted on 2025-04-20.
  - In an update on 2025-04-22, Rumi relayed OpenAI's statement that this was **not a watermark** but "a quirk of large-scale reinforcement learning".
  - By an update on 2025-04-23 the characters were no longer appearing. [V via the Rumi post; OpenAI did not publish a primary statement that could be located]
- **Removable by character stripping:** Yes, by replacing U+202F with U+0020. Note that U+202F is correct French typography before `;:!?` and inside guillemets, so this replacement is keep-in-context in French prose.
- **Sources:**
  - https://www.rumidocs.com/newsroom/new-chatgpt-models-seem-to-leave-watermarks-on-text
  - https://itc.ua/en/news/the-new-chatgpt-models-leave-extra-characters-in-the-text-they-can-be-detected-through-word/

### B2. Typographic "AI tells": em dash, en dash, smart quotes, ellipsis, special spaces

- **What it is:** These are **not** watermarks. Some LLMs, by style, emit:
  - U+2014 EM DASH and U+2013 EN DASH;
  - U+2018/U+2019 and U+201C/U+201D curly quotes;
  - U+2026 HORIZONTAL ELLIPSIS;
  - U+00A0 NBSP, U+2009 THIN SPACE, U+2003 EM SPACE and U+202F.

  People use these as heuristic tells. No vendor has stated that they are an intentional mark.
- **Evidence:**
  - On 2025-11-14 Sam Altman said ChatGPT would now honour custom instructions to avoid em dashes, which confirms they are a style artefact that can be steered. [S]
  - Plagiarism Today and Shady Characters argue that em dashes are not proof of AI authorship. [S]
  - No evidence was found that U+2011 NON-BREAKING HYPHEN is a documented AI tell. [U]
- **Code points and normalization:**
  - NFKC maps U+00A0, U+2003, U+2009 and U+202F to U+0020, and U+2026 to `...`.
  - NFKC does **not** change U+2013, U+2014, U+2018, U+2019, U+201C, U+201D or U+2212, which have no decomposition.
  - NFKC maps U+2011 to U+2010, not to an ASCII hyphen. [V]
- **Removable by character stripping:** Yes, by replacing with ASCII. In source code this is reasonable: smart quotes in code are bugs anyway. In prose it is a style choice, so the default should be report-only.
- **Sources:**
  - https://www.techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/
  - https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/
  - https://shadycharacters.co.uk/2025/08/the-dash-for-ai

### B3. Apostrophe and space watermarks (Genius vs Google, 2019)

- **How it works:**
  - Genius alternated straight (U+0027) and curly (U+2019) apostrophes in lyrics so that the pattern spelled "REDHANDED" in Morse code. It used this to show Google was copying its lyrics (June 2019).
  - A later variant used U+2005 FOUR-PER-EM SPACE to spell "GENIUS" (reported December 2019 in Genius's lawsuit).
- **Code points:** U+0027 versus U+2019, and U+0020 versus U+2005. A binary choice between two visually similar characters works with any such pair.
- **Removable by character stripping:** Yes, by normalizing quotes and spaces to one canonical form.
- **Sources:**
  - https://bgr.com/2019/06/17/genius-vs-google-lyrics-results-on-search-copied-from-lyrics-site/
  - https://bgr.com/2019/12/03/genius-sues-google-another-secret-code-proves-lyrics-copied/

### B4. Whitespace steganography: SNOW / stegsnow

- **How it works:** Data is hidden in trailing spaces and tabs at the ends of lines.
  - Roughly 3 bits are encoded per 8 columns of whitespace.
  - A tab marks the start of the data.
  - The payload is optionally compressed with Huffman coding and encrypted with ICE.
  - Trailing whitespace is invisible in most viewers.
- **Code points:** U+0020 and U+0009 at line end. Generalizations also use any White_Space character.
- **People and dates:** Matthew Kwan (darkside.com.au), 1990s. Released under Apache 2.0 since 2013. Packaged in Debian and other distributions as `stegsnow`. [S]
- **Removable by character stripping:** Yes. Strip trailing whitespace, except in Markdown, where two trailing spaces are a hard line break; report those or convert them to `\` or `<br>`.
- **Sources:**
  - https://darkside.com.au/snow/
  - https://darkside.com.au/snow/description.html
  - https://manpages.debian.org/bookworm/stegsnow/stegsnow.1

### B5. Inter-word space substitution and alternative-space watermarks

- **How it works:** Selected U+0020 spaces are replaced with visually similar spaces, each carrying one or more bits.
  - The alternative spaces include U+2000..U+200A, U+202F, U+205F, U+3000, U+00A0 and U+2007.
  - Examples are EasyMark's WhiteMark (U+2004, see B7) and the Genius U+2005 mark.
  - A 2019 EURASIP paper combined homoglyphs with whitespace characters (see C2).
- **Code points:** All Zs characters except U+0020, plus U+0009. NFKC folds every one of them except U+1680 to U+0020. [V]
- **Removable by character stripping:** Yes, by replacing with U+0020. Keep U+00A0 and U+202F in context in French and other typographically correct prose.

### B6. Line-ending steganography

- **How it works:** Bits are encoded in the choice of line terminator per line (CRLF versus LF, or CR LF order), or in data placed after an end-of-file marker.
- **Code points:**
  - U+000D and U+000A.
  - Also U+0085 NEL, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR, which are Pattern_White_Space line breaks per UAX #31 and UTS #55.
  - Also U+000B VT and U+000C FF.
- **People and dates:** The sources are weak. [U as a named, widely used technique]
  - A Ukrainian thesis on CR/LF ordering.
  - Lee and Tsai (2008), who used email line-end control codes.
  - Dr. Dobb's (1997), on hiding data after the DOS EOF marker.
- **Removable by character stripping:** Yes. Normalize all files to a single EOL convention (via `.gitattributes`) and report mixed endings, U+0085, U+2028 and U+2029.
- **Sources:**
  - https://omp.diit.edu.ua/items/c5ad7d42-c281-4a70-950e-e48295a581c9
  - https://people.cs.nycu.edu.tw/~whtsai/Journal%20Paper%20PDFs/Lee_&_Tsai_JITA_2008.pdf
  - https://www.drdobbs.com/security/steganography-for-dos-programmers/184410110

### B7. EasyMark ("Embarrassingly Simple Text Watermarks")

- **How it works:** Three variants:
  - **WhiteMark** replaces ordinary spaces (U+0020) with U+2004 THREE-PER-EM SPACE. Detection counts U+2004 occurrences.
  - **VariantMark** appends an Ideographic Variation Selector to every other occurrence of a CJK character that has a registered variant, for example U+9BD6 followed by U+E0101.
  - **PrintMark** is designed to survive printing and OCR. It uses ligatures, alternating U+2004 spaces, and U+E0100-variant glyph forms.

  The authors note the methods are not robust to normalization, but argue this is acceptable for their threat model.
- **Code points:** U+2004 and U+E0100..U+E01EF (IVS). [V via arXiv HTML]
- **People and dates:** Ryoma Sato, Yuki Takezawa, Han Bao, Kenta Niwa and Makoto Yamada. arXiv 2310.08920, submitted 2023-10-13.
- **Removable by character stripping:** Yes. Map U+2004 to U+0020. For IVS, strip unless the base is CJK and the sequence is registered in the IVD (keep-in-context).
- **Source:** https://arxiv.org/html/2310.08920v1 (also https://arxiv.org/abs/2310.08920)

---

## Part C. Visible-glyph substitution carriers

### C1. Mathematical alphanumerics, fullwidth forms and other compatibility letters

- **How it works:** ASCII letters and digits are replaced with styled look-alikes, either per character as bits or wholesale to evade filters and keyword detectors.
- **Code points:** [V; NFKC maps all of these to ASCII or near-ASCII]
  - U+1D400..U+1D7FF Mathematical Alphanumeric Symbols, for example `1D400;MATHEMATICAL BOLD CAPITAL A;...;<font> 0041`.
  - U+FF01..U+FF5E fullwidth ASCII, in the Halfwidth and Fullwidth Forms block U+FF00..U+FFEF.
  - U+2100..U+214F Letterlike Symbols.
  - U+2460..U+24FF Enclosed Alphanumerics and U+1F100..U+1F1FF Enclosed Alphanumeric Supplement.
  - U+2070..U+209F Superscripts and Subscripts.
- **Removable by character stripping:** Yes, by NFKC or by replacing with ASCII. Outside mathematical notation in docs, these are almost never legitimate in code.

### C2. Homoglyph substitution watermarks

- **How it works:** Selected Latin characters are replaced with confusable characters from other scripts, for example Cyrillic а (U+0430) for Latin a (U+0061), or Greek ο (U+03BF) for o. Whether each substitution is made encodes one bit.
- **People and dates:**
  - Stefano Giovanni Rizzo, Flavio Bertini and Danilo Montesi, "Content-preserving Text Watermarking through Unicode Homoglyph Substitution", IDEAS 2016 (DOI 10.1145/2938503.2938510). It embeds a 64-bit mark in about 101 characters. [S; author first names M]
  - A 2019 EURASIP Journal on Information Security follow-up extended the method with whitespace characters. [S]
  - 330k's tool (A4) has a homoglyph mode.
  - Trojan Source CVE-2021-42694 covers homoglyph identifiers.
- **Code points:** Any code point that UTS #39 `confusables.txt` maps to a prototype that differs from itself. The key ranges are Cyrillic U+0400..U+04FF, Greek U+0370..U+03FF, Armenian, Cherokee and Latin extensions.
- **Removable by character stripping:** Partly. NFKC does **not** fold Cyrillic to Latin. A tool needs a UTS #39 skeleton or confusable check, plus mixed-script detection per identifier and token. It can replace with the prototype only when the surrounding token is unambiguously Latin.
- **Sources:**
  - https://doi.org/10.1145/2938503.2938510 [M for the DOI resolution]
  - https://link.springer.com/article/10.1186/s13635-019-0094-2
  - https://www.unicode.org/reports/tr39/

### C3. Homoglyph attacks on AI-text detectors (SilverSpeak)

- **How it works:** A percentage of Latin characters (5–20%, chosen randomly or greedily) is replaced with Cyrillic homoglyphs. This changes tokenization, which breaks perplexity-based detectors and weakens statistical watermark detection.
  - Evaluated on 7 detectors, including Binoculars, DetectGPT, Fast-DetectGPT, Ghostbuster, the OpenAI detector and watermark detectors, across 5 datasets.
  - The mean MCC fell from 0.64 to -0.01.
- **People and dates:** Aldan Creo and Shushanta Pudasaini. arXiv 2406.11239 (June 2024), published at the 1st GenAIDetect workshop, 2025 (ACL Anthology 2025.genaidetect-1.1; co-location with COLING 2025 is [M]). [S]
- **Relevance:** Homoglyph injection is both an attack on watermarks and a carrier. A CI tool should treat mixed-script tokens as suspicious.
- **Sources:**
  - https://arxiv.org/abs/2406.11239
  - https://aclanthology.org/2025.genaidetect-1.1

### C4. Combining marks and diacritic stacking

- **How it works:** Combining marks (U+0300..U+036F and others) are inserted that are invisible or nearly invisible on some bases. Examples are U+0332 under a letter that already has an underline, U+0335 overstrike, or zero-width marks such as U+034F CGJ. "Zalgo" stacking is the visible extreme.
- **Code points:** U+0300..U+036F, U+1AB0..U+1AFF, U+1DC0..U+1DFF, U+20D0..U+20FF and U+FE20..U+FE2F.
- **Status:** Reported as a general obfuscation and adversarial technique. No named watermark scheme was found. [U]
- **Removable by character stripping:** Partly. Report combining marks on ASCII bases in code. Do not strip them in natural-language text.

---

## Part D. Statistical token-level watermarks and provenance (NOT removable by character stripping)

These are listed for context. A CI tool **cannot** remove them by stripping characters, because the output contains only ordinary characters.

### D1. Kirchenbauer et al., green-list / red-list watermark

- **How it works:**
  - At each step, a hash of the previous token(s) seeds a pseudo-random partition of the vocabulary into a "green" list (fraction γ) and a red list.
  - A bias δ is added to green-token logits.
  - Detection counts green tokens and computes a z-score. It needs no model access, only the hash key.
- **People and dates:** John Kirchenbauer, Jonas Geiping, Yuxin Wen, Jonathan Katz, Ian Miers and Tom Goldstein. arXiv 2301.10226, submitted 2023-01-24. ICML 2023, PMLR 202:17061–17084. [V]
- **Removable by character stripping:** No. Paraphrasing weakens it; homoglyph injection (C3) disrupts detection.
- **Sources:**
  - https://arxiv.org/abs/2301.10226
  - https://github.com/jwkirchenbauer/lm-watermarking

### D2. Aaronson / OpenAI Gumbel-max (exponential) sampling watermark

- **How it works:** A keyed pseudo-random function of recent tokens produces per-token values r. Sampling picks the token that maximizes r_i^(1/p_i), which is equivalent to Gumbel-max sampling. The output distribution is unchanged in expectation. Detection sums -log(1-r) over the chosen tokens.
- **People and dates:** Scott Aaronson, during his 2022 visit to OpenAI, described it in a November 2022 lecture and blog post. A prototype was built by Hendrik Kirchner. [S/M]
- **Removable by character stripping:** No.
- **Sources:**
  - https://scottaaronson.blog/?p=6823 [M]
  - https://techcrunch.com/?p=2455945 [S]

### D3. Google DeepMind SynthID-Text

- **How it works:** "Tournament sampling" uses keyed g-functions over a sliding context window to bias token selection. Detection uses a Bayesian or weighted-mean scoring function.
  - Tested in a live experiment on about 20 million Gemini responses with no measurable quality loss.
  - Open-sourced, and available in Hugging Face Transformers 4.46 and later.
- **People and dates:** Sumanth Dathathri et al., "Scalable watermarking for identifying large language model outputs", Nature 634, published 2024-10-23. Deployed in Gemini. [V for Nature and GitHub]
- **Removable by character stripping:** No.
- **Sources:**
  - https://www.nature.com/articles/s41586-024-08025-4
  - https://github.com/google-deepmind/synthid-text

### D4. OpenAI: 2024 decision not to ship, then textGrain (2026)

- **2024:** The Wall Street Journal reported in August 2024 that OpenAI had a text watermark about 99.9% effective and had not released it. OpenAI then updated its May 2024 provenance post on 2024-08-04. Reasons cited:
  - a survey in which about 30% of users said they would use ChatGPT less;
  - the risk of stigmatizing non-native English speakers;
  - easy circumvention by translation or paraphrase, or by asking the model to insert and then delete characters.

  The openai.com primary page returned HTTP 403 in this session, so these details come from secondary reports. [S]
  - https://openai.com/index/understanding-the-source-of-what-we-see-and-hear-online/ (403) [U as fetched]
  - https://aibusiness.com/nlp/openai-develops-ai-text-detector-debates-public-release
  - https://www.searchenginejournal.com/openai-scraps-chatgpt-watermarking-plans/523780/
- **2026 (textGrain):** Announced around 2026-10-05.
  - A statistical word-choice watermark, applied to ChatGPT and Codex output for EU users over the following weeks.
  - Opt-in for the API worldwide and off by default. Detector access is limited.
  - Reported robustness: detection fell from about 92% to about 66% with 10% synonym substitution, and to about 17% at 25%.
  - Dexerto reports it adds no hidden symbols or extra tokens. [S]
  - The primary page https://openai.com/index/eu-text-provenance/ returned 403. [U as fetched]
  - https://bleepingcomputer.com/news/artificial-intelligence/openai-is-adding-invisible-watermarks-to-chatgpt-and-codex-text-in-the-eu
  - https://www.dexerto.com/entertainment/chatgpt-text-is-about-to-become-detectable-with-invisible-watermark-to-comply-with-eu-ai-law-3416147/
- **Removable by character stripping:** No. The o3/o4-mini U+202F episode (B1) was explicitly *not* a watermark according to OpenAI.

### D5. Anthropic: Claude text watermark and content marking (EU AI Act Art. 50)

- **Claude text watermark:** "How Claude's text watermarking works", Anthropic, 2026-08-14. [V]
  - A version of SynthID-Text.
  - "Nothing is added to the text and there are no hidden characters".
  - The watermark is sparser on factual text and code.
  - A detection API is in private preview.
  - It is applied globally.
- **Support article, "How Claude marks AI-generated content":** [V]
  - Anthropic signed the EU Code of Practice under Art. 50(2).
  - Models launched on or after 2026-08-02 are marked; the article lists which models.
  - The Amazon Bedrock rollout completes by 2026-10-17.
  - Generated files (PNG, JPEG, SVG) carry C2PA Content Credentials, which users can check with the Claude Content Checker at claude.com/check-content.
  - Text detection is in private preview, and the article documents its limitations, including paraphrasing and short texts.
- **Removable by character stripping:** No for text, because the watermark is statistical. The C2PA credentials on *files* are metadata (removable by metadata stripping, out of scope for text CI).
- **Sources:**
  - https://www.anthropic.com/news/claude-text-watermark
  - https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content
  - https://platform.claude.com/docs/en/release-notes/overview

### D6. Meta and Mistral

- **Meta:**
  - "Three Bricks to Consolidate Watermarks for Large Language Models" (Pierre Fernandez et al., Meta AI and Inria). arXiv 2308.00113, 2023. [S]
  - "TextSeal" (Sander, Fernandez et al., arXiv 2605.12456, May 2026) is a Gumbel-max localized watermark. Its Meta affiliation was not confirmed on the page fetched. [U]
  - No confirmed production text watermark in Llama or Meta AI products was found. [U]
  - https://arxiv.org/abs/2308.00113
  - https://arxiv.org/abs/2605.12456
- **Mistral:** Reportedly a signatory of the EU transparency Code of Practice. No public description of a Mistral text watermark was found. [U]
- **Removable by character stripping:** No, for any statistical scheme these vendors may deploy.

### D7. C2PA text provenance (character-level and comment-level)

- **Unstructured text (C2PA spec 2.4, Appendix A.8, introduced in v2.3):** [V]
  - The manifest is wrapped in a `C2PATextManifestWrapper`: magic `0x4332504154585400` ("C2PATXT\0"), version 1, a uint32 `manifestLength`, then the JUMBF manifest store.
  - Each byte is encoded as a variation selector: bytes 0..15 become U+FE00..U+FE0F, and bytes 16..255 become U+E0100..U+E01EF. This is the same mapping as Butler and GlassWorm.
  - The run is prefixed with a single U+FEFF and placed as one contiguous block, normally at the end of the text.
  - The spec says to use this only "where no other embedding method is feasible" and notes that it "remains under review".
  - The content hash is computed over the NFC-normalized text with the wrapper excluded.
  - Failure codes are `manifest.text.corruptedWrapper` and `manifest.text.multipleWrappers`.
- **Structured text (Appendix A.9):** Applies to source code, YAML, TOML, Markdown and similar formats. [V]
  - A comment or front-matter line between `-----BEGIN C2PA MANIFEST-----` and `-----END C2PA MANIFEST-----` holds either a URL or `data:application/c2pa;base64,...`.
  - At most one block is allowed per file, placed first or last. With a shebang or XML declaration it goes last.
  - Failure code: `manifest.structuredText.multipleReferences`.
- **Implementations:**
  - EncypherAI (encypher-ai on GitHub) embeds signed metadata using U+FE00..U+FE0F and U+E0100..U+E01EF and implements C2PA text. Integrations with OpenAI, Gemini and Claude client SDKs are provided. Its maintainers state they co-chair the C2PA Text Task Force. [S]
  - The Rust crate `c2pa-unstructured-text`. [S]
- **Removable by character stripping:** Yes for A.8: strip U+FEFF plus the following selector run. Yes for A.9: delete the armoured block, which is visible, so report it. Removing a C2PA manifest the author put there deliberately may be undesirable, so a CI tool should report rather than silently strip A.9 blocks.
- **Sources:**
  - https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html
  - https://github.com/encypherai/encypher-ai
  - https://docs.rs/crate/c2pa-unstructured-text/latest/source/README.md

### D8. Regulatory context

- **EU AI Act Art. 50(2) and the Code of Practice on Transparency of AI-Generated Content:**
  - The final Code was published 2026-06-10 and found adequate on 2026-07-08.
  - Obligations apply from 2026-08-02. Legacy systems have until 2026-12-02, and the interoperability deadline is 2027-02-02.
  - The Code requires multi-layer marking (metadata plus an imperceptible watermark) and detection tools.
  - Around 190 signatories joined in the first month, including Google, Anthropic and Cohere. [S]
  - One secondary source claims text under 200 tokens is exempt. [U]
  - https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content
  - https://www.mofo.com/pdf/resources/insights/260911-full-transparency-organizations-sign-eu-code
  - https://digital-strategy.ec.europa.eu/en/library/how-sign-code-practice-transparency-ai-generated-content
- **China's AIGC labelling measures and GB 45438-2025** (effective 2025-09-01):
  - Explicit labels: visible text notices.
  - Implicit labels: metadata.
  - Removing labels is prohibited. [S]
  - https://www.loeb.com/en/insights/publications/2025/03/chinas-ai-labeling-measures-and-mandatory-national-standards-take-effect-september-1
- **Implication for a CI tool:** Stripping *invisible character carriers* from your own repository is ordinary hygiene. However, deliberately removing a provenance mark (a C2PA wrapper or block) from content you redistribute may conflict with these regimes. The tool should therefore **report** C2PA blocks and wrappers by default and make stripping them an explicit opt-in. This is a policy suggestion, not legal advice.

---

## Part E. Encoded and escaped carriers (HTML entities, escapes)

Invisible characters can also hide in source code as **escapes**, which the raw-byte scanner will not see. A CI tool must decode or pattern-match:

- **HTML named entities.** The following names come from the WHATWG list, https://html.spec.whatwg.org/entities.json. [V]
  - `&nbsp;` and `&NonBreakingSpace;` (U+00A0); `&shy;` (U+00AD).
  - `&ensp;` (U+2002), `&emsp;` (U+2003), `&emsp13;` (U+2004), `&emsp14;` (U+2005), `&numsp;` (U+2007), `&puncsp;` (U+2008).
  - `&thinsp;` and `&ThinSpace;` (U+2009); `&hairsp;` and `&VeryThinSpace;` (U+200A).
  - `&ZeroWidthSpace;`, `&NegativeThinSpace;`, `&NegativeMediumSpace;`, `&NegativeThickSpace;` and `&NegativeVeryThinSpace;` (all U+200B).
  - `&zwnj;` (U+200C), `&zwj;` (U+200D), `&lrm;` (U+200E), `&rlm;` (U+200F).
  - `&MediumSpace;` (U+205F); `&ThickSpace;` (U+205F U+200A) [M for the exact expansion].
  - `&NoBreak;` (U+2060); `&af;` and `&ApplyFunction;` (U+2061); `&it;` and `&InvisibleTimes;` (U+2062); `&ic;` and `&InvisibleComma;` (U+2063).
  - Punctuation:
    - `&hyphen;` and `&dash;` (U+2010)
    - `&ndash;` (U+2013), `&mdash;` (U+2014)
    - `&lsquo;`, `&rsquo;`, `&ldquo;` and `&rdquo;` (U+2018/2019/201C/201D)
    - `&hellip;` and `&mldr;` (U+2026)
    - `&minus;` (U+2212)
- **Numeric character references:**
  - Decimal or hex in HTML and XML: `&#8203;` and `&#x200B;`, `&#x200b;` and `&#X200B;`, and leading-zero variants such as `&#x0200B;`.
  - The pattern `&#[xX]?[0-9a-fA-F]+;?`. Note that HTML allows a missing semicolon in some contexts.
- **Language escapes:**
  - `​` (JSON, JS, Java, C#, Python str).
  - `\u{E0041}` (JS ES2015, Rust, Swift `\u{...}`).
  - `\U000E0041` (Python, C, C++).
  - `\x{200B}` (Perl, PCRE).
  - Surrogate pairs `󠁁` (JSON/JS encoding of U+E0041).
  - `\N{ZERO WIDTH SPACE}` (Python, Perl).
  - CSS `\200B` and `content: "\200B"`.
  - Percent-encoded UTF-8 in URLs: `%E2%80%8B` (ZWSP), `%F3%A0%81%81` (U+E0041), `%EF%B8%8F` (VS16).
  - Raw UTF-8 byte escapes: `\xE2\x80\x8B`, and octal `\342\200\213`.
  - Markdown and LaTeX: `\hspace{0pt}`, `{}` or `\-` (soft hyphen) are possible carriers, but are low risk and report-only.
- **Rationale:** GlassWorm-style payloads and prompt-injection strings can be written with escapes so that the file itself stays ASCII. Decode escapes inside string literals and rescan. Report findings, and do not rewrite escapes automatically, because ` ` in a test fixture may be intentional.

---

## Part F. Unicode standards guidance relevant to the tool

- **UTS #55 "Unicode Source Code Handling"** (version 2, revision 5, 2024-01-29; Robin Leroy and Mark Davis): https://www.unicode.org/reports/tr55/ [V]
  - Editors and review tools should make Default_Ignorable characters visible.
  - Do not prohibit bidi controls outright in comments and strings. Instead, check that they are balanced and visibly flag them.
  - Use UTS #39 confusable detection based on the skeleton, not ad-hoc highlighting of "non-ASCII lookalikes".
  - Identifiers should follow UAX #31 and the General Security Profile.
  - Tools should **not silently normalize string literals**, because doing so changes program semantics.
  - Support the UAX #31 Pattern_White_Space line breaks: U+000B, U+000C, U+0085, U+2028 and U+2029.
- **UTS #39 "Unicode Security Mechanisms"** (18.0.0, 2026-08-27): https://www.unicode.org/reports/tr39/ ; data at https://www.unicode.org/Public/security/latest/ [V]
  - The skeleton is computed as: NFD, then remove Default_Ignorable code points, then map each character via confusables.txt, then NFD again. Two strings are confusable if their skeletons are equal.
  - Identifier_Type values include `Default_Ignorable` and `Not_NFKC`, which the General Security Profile excludes.
  - ZWJ and ZWNJ are allowed only in limited contexts. Their Identifier_Status changed in Unicode 15.0. [V/M for the exact version note]
- **UTR #36 "Unicode Security Considerations"** (stabilized 2014, superseded by UTS #39 and UTS #55): https://www.unicode.org/reports/tr36/tr36-15.html [V]
  - §3.5: *deleting* invisible characters in security checks "may cause a security problem", because the stripped string differs from what is processed later.
  - §3.2: on ill-formed input, "at least substitute U+FFFD".
  - §2.5: "Never allow bidi override characters" in identifiers.
  - §2.9.2: prohibiting characters is an alternative to removing them.
  - **Implication:** the CI tool should *report and fail* rather than silently delete, especially in identifiers, URLs and string literals. Auto-fix should be explicit.
- **Default_Ignorable_Code_Point** (DerivedCoreProperties-18.0.0.txt, 2026-08-07). [V] The full set is:
  - U+00AD; U+034F; U+061C; U+115F..U+1160; U+17B4..U+17B5
  - U+180B..U+180D; U+180E; U+180F
  - U+200B..U+200F; U+202A..U+202E; U+2060..U+2064; U+2065; U+2066..U+206F
  - U+3164; U+FE00..U+FE0F; U+FEFF; U+FFA0; U+FFF0..U+FFF8
  - U+1BCA0..U+1BCA3; U+1D173..U+1D17A
  - U+E0000; U+E0001; U+E0002..U+E001F; U+E0020..U+E007F; U+E0080..U+E00FF; U+E0100..U+E01EF; U+E01F0..U+E0FFF
- **Other UCD properties** (PropList-18.0.0). [V]
  - **White_Space:** U+0009..U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000..U+200A, U+2028, U+2029, U+202F, U+205F, U+3000. ZWSP is *not* White_Space.
  - **Bidi_Control:** U+061C, U+200E..U+200F, U+202A..U+202E, U+2066..U+2069.
  - **Join_Control:** U+200C..U+200D.
  - **Variation_Selector:** U+180B..U+180D, U+180F, U+FE00..U+FE0F, U+E0100..U+E01EF.
  - **Noncharacter_Code_Point:** U+FDD0..U+FDEF, and U+nFFFE..U+nFFFF for planes 0–16 (66 code points in total).
  - **Pattern_White_Space:** U+0009..U+000D, U+0020, U+0085, U+200E..U+200F, U+2028, U+2029.
  - **General category Co (Private Use):** U+E000..U+F8FF, U+F0000..U+FFFFD, U+100000..U+10FFFD.

---

## Part G. Consolidated, deduplicated carrier table (default actions)

Actions:

- **strip**: delete the code point and report it.
- **replace-with-ASCII**: map to the stated ASCII equivalent and report it.
- **keep-in-context**: allowed only in the stated legitimate sequence or context; otherwise strip.
- **report-only**: flag it but do not modify.

Policy notes that apply to every row:

1. Following UTS #55 and TR36 §3.5, never auto-modify **identifiers or string literals** in code. Report and fail the check instead. Auto-fix applies to comments, prose and docs, or when the user explicitly opts in.
2. A BOM (U+FEFF) is acceptable only at file offset 0, and many projects strip it anyway.
3. Scan both raw text and decoded escapes and entities (Part E).

| # | Code point range(s) | What it is | Known techniques / users | Default action | Rationale |
|---|---|---|---|---|---|
| 1 | U+E0000, U+E0002..U+E001F, U+E0080..U+E00FF, U+E01F0..U+E0FFF | Unassigned Default_Ignorable (reserved) in plane 14 | Generic carrier space | strip | Never legitimate; invisible. [V] |
| 2 | U+E0001 | LANGUAGE TAG (deprecated) | ASCII-smuggling variants | strip | Deprecated, invisible. |
| 3 | U+E0020..U+E007E, U+E007F | Tag characters, CANCEL TAG | ASCII smuggling (Goodside, Rehberger 2024), Copilot exfiltration | strip; keep-in-context only inside a well-formed emoji tag sequence `U+1F3F4 (E0020..E007E)+ E007F` | Invisible ASCII payload read by LLMs; the only legitimate use is subdivision flags (UTS #51). |
| 4 | U+FE00..U+FE0D | Variation selectors VS1..VS14 | Butler 2025, GlassWorm, os-info-checker-es6, C2PA A.8, EncypherAI | keep-in-context (single selector after a base listed in StandardizedVariants.txt); otherwise strip | Byte-encoding carrier (bytes 0..15). Legitimate only as a single standardized variation. |
| 5 | U+FE0E, U+FE0F | VS15 (text) and VS16 (emoji presentation) | Same as #4 | keep-in-context (single selector after an emoji or text-presentation base, or inside an emoji ZWJ or keycap sequence); strip runs of 2 or more | Very common and legitimate in emoji, but also part of the byte map. |
| 6 | U+E0100..U+E01EF | Variation Selectors Supplement (VS17..VS256) | Butler, GlassWorm, os-info-checker-es6, C2PA A.8, EncypherAI, EasyMark VariantMark/PrintMark | keep-in-context (single selector after a CJK ideograph registered in the IVD); otherwise strip | Main byte carrier (bytes 16..255). |
| 7 | U+180B..U+180D, U+180F | Mongolian free variation selectors | Possible carrier | keep-in-context (after Mongolian letters U+1820..U+18AA); otherwise strip | Default_Ignorable VS. |
| 8 | U+180E | MONGOLIAN VOWEL SEPARATOR | Possible carrier; was Zs before Unicode 6.3 | keep-in-context (between Mongolian letters); otherwise strip | Invisible Cf. |
| 9 | U+200B | ZERO WIDTH SPACE | zwsp-steg, fingerprinting (Aysan 2018), Rules File Backdoor, Bad Characters | strip | Invisible; rarely needed in code or docs (line-break hints in Thai or Khmer prose excepted, so report in those). |
| 10 | U+200C, U+200D | ZWNJ, ZWJ | StegCloak, zwsp-steg, 330k tool, Bad Characters, Rules File Backdoor | keep-in-context (ZWJ inside emoji ZWJ sequences; ZWNJ/ZWJ between letters of Indic, Arabic or Persian scripts per UAX #31 A1/A2/B); otherwise strip | Required for some scripts and emoji; otherwise a carrier. |
| 11 | U+2060 | WORD JOINER | Zero-width encodings | strip (report-only in prose) | Invisible. |
| 12 | U+2061..U+2064 | FUNCTION APPLICATION, INVISIBLE TIMES, INVISIBLE SEPARATOR, INVISIBLE PLUS | StegCloak, Sneaky Bits | strip | Intended for MathML-like plain-text math; essentially never in code or docs. |
| 13 | U+2065, U+FFF0..U+FFF8 | Unassigned Default_Ignorable (BMP) | Generic | strip | Reserved; invisible. |
| 14 | U+206A..U+206F | Deprecated format characters | Generic | strip | Deprecated, invisible. |
| 15 | U+FEFF | ZWNBSP / BOM | Zero-width encodings (330k tool), C2PA A.8 wrapper prefix | keep-in-context (offset 0 as BOM; project policy may strip that too); otherwise strip. Report if followed by a run of variation selectors (C2PA wrapper) | Invisible mid-text; it marks the start of a C2PA text manifest. |
| 16 | U+00AD | SOFT HYPHEN | Fingerprinting, filter evasion | strip in code; report-only in prose | Invisible except at line breaks. |
| 17 | U+034F | COMBINING GRAPHEME JOINER | Possible carrier | keep-in-context (between combining marks to block reordering, e.g. Hebrew); otherwise strip | Invisible; Default_Ignorable. |
| 18 | U+115F, U+1160, U+3164, U+FFA0 | Hangul fillers | Certitude invisible JS backdoor (2021), invisible identifiers | keep-in-context (U+115F/U+1160 within Hangul jamo sequences); otherwise strip, and **fail** if inside an identifier | Lo and Default_Ignorable, so they are valid identifier characters that render blank. |
| 19 | U+17B4, U+17B5 | Khmer inherent vowels | Possible carrier | strip (keep-in-context in Khmer text only if the project requires it) | Default_Ignorable; use is discouraged by Unicode. |
| 20 | U+1BCA0..U+1BCA3 | Shorthand format controls | Possible carrier | keep-in-context (Duployan text); otherwise strip | Invisible Cf. |
| 21 | U+1D173..U+1D17A | Musical symbol format controls | Possible carrier | strip | Invisible Cf. |
| 22 | U+202A..U+202E, U+2066..U+2069 | Bidi embeddings, overrides and isolates | Trojan Source (CVE-2021-42574), Bad Characters, Rules File Backdoor | report-only (fail the check) in code; strip in comments and docs unless in RTL-language text; keep-in-context in RTL prose if balanced | High severity in code; UTS #55 says flag and check balance rather than forbid. |
| 23 | U+200E, U+200F, U+061C | LRM, RLM, ALM | Zero-width encodings, Trojan Source variants | keep-in-context (adjacent to RTL script text); otherwise strip | Invisible marks; legitimate in mixed-direction prose. |
| 24 | U+FFF9..U+FFFB | Interlinear annotation controls | Possible hidden-text carrier | strip | Internal use only, so never valid in interchange. |
| 25 | U+00A0 | NO-BREAK SPACE | AI "tell", alternative-space watermark | replace-with-ASCII (U+0020) in code; keep-in-context in prose (French typography, units, `&nbsp;`) and report | NFKC maps it to U+0020. [V] |
| 26 | U+202F | NARROW NO-BREAK SPACE | o3/o4-mini report (Rumi 2025; OpenAI said "not a watermark") | replace-with-ASCII (U+0020) in code; keep-in-context in French prose; report | NFKC maps it to U+0020. |
| 27 | U+2000..U+200A (includes U+2003 EM SPACE, U+2004 three-per-em, U+2005 four-per-em, U+2009 THIN SPACE) | Typographic spaces | EasyMark WhiteMark (U+2004), Genius (U+2005), AI tells (U+2003, U+2009), space-substitution watermarks | replace-with-ASCII (U+0020) | Invisible variation of a space; NFKC maps them to U+0020. |
| 28 | U+205F, U+3000, U+1680 | Medium math space, ideographic space, Ogham space mark | Alternative-space carriers | replace-with-ASCII (U+0020); keep-in-context U+3000 in CJK prose and U+1680 in Ogham | White_Space. |
| 29 | U+0085, U+2028, U+2029, U+000B, U+000C | NEL, line and paragraph separators, VT, FF | Line-ending steganography; JS string-literal quirks | replace-with-ASCII (LF) in docs; report-only in code (U+000C allowed in Python and C sources by convention) | UAX #31 and UTS #55 line breaks; invisible, and they break tooling. |
| 30 | CR/LF mixtures; trailing U+0020 and U+0009 | Line endings and trailing whitespace | SNOW/stegsnow, CRLF/LF bit encoding | replace (normalize EOL per `.gitattributes`; strip trailing whitespace except Markdown two-space hard breaks, which are report-only) | Carriers that are entirely whitespace. |
| 31 | U+0000..U+0008, U+000E..U+001F, U+007F, U+0080..U+0084, U+0086..U+009F | C0 and C1 controls (except TAB, LF, CR, and the line breaks in #29) | Bad Characters (backspace and delete), ANSI-escape terminal injection [M] | strip in docs; report-only (fail the check) in code | Never legitimate in text files; they can hide or rewrite displayed text. |
| 32 | U+2010..U+2015, U+2212 | Hyphens and dashes (including U+2011 non-breaking, U+2013 en, U+2014 em), minus | AI "tells" (em dash) | replace-with-ASCII (`-` or `--`) in code and identifiers; report-only in prose | Style artefact, not a watermark; harmful only in code. |
| 33 | U+2018, U+2019, U+201A, U+201B, U+201C, U+201D, U+201E, U+201F, U+2032, U+2033 | Smart quotes and primes | Genius apostrophe Morse watermark (2019), AI tells | replace-with-ASCII (`'` or `"`) in code; report-only in prose | Two-way choice between ASCII and curly quotes can carry bits; curly quotes break code. |
| 34 | U+2026, U+2024, U+2025 | Ellipsis and dot leaders | AI tells | replace-with-ASCII (`...`, `.`, `..`) in code; report-only in prose | NFKC maps them to periods. |
| 35 | U+1D400..U+1D7FF | Mathematical alphanumeric symbols | Filter evasion, styled text | replace-with-ASCII (NFKC) in code; report-only in docs (keep-in-context in math) | Look-alike letters; NFKC maps them. |
| 36 | U+FF01..U+FF5E (block U+FF00..U+FFEF) | Fullwidth ASCII and halfwidth forms | Filter evasion | replace-with-ASCII (NFKC) in code; keep-in-context in CJK prose | NFKC maps them. |
| 37 | U+2100..U+214F, U+2460..U+24FF, U+1F100..U+1F1FF, U+2070..U+209F | Letterlike, enclosed alphanumerics, super/subscripts | Look-alike carriers | report-only (NFKC candidate in code) | Some are legitimate (℃, ™, ², ①). |
| 38 | Confusables per UTS #39 `confusables.txt`, mainly U+0370..U+03FF (Greek), U+0400..U+052F (Cyrillic), U+0530..U+058F (Armenian), U+13A0..U+13FF (Cherokee) | Homoglyphs | Rizzo et al. 2016 homoglyph watermark, 330k tool homoglyph mode, Trojan Source CVE-2021-42694, SilverSpeak 2024 | report-only (fail on mixed-script identifiers or tokens; replace with prototype only on explicit fix) | Legitimate in real Greek or Cyrillic text; detect by skeleton and mixed-script checks. |
| 39 | U+0300..U+036F, U+1AB0..U+1AFF, U+1DC0..U+1DFF, U+20D0..U+20FF, U+FE20..U+FE2F | Combining marks | Zalgo or obfuscation; possible carrier | report-only when on ASCII bases in code, or when there are more than 2 per base | Needed for many languages; suspicious in ASCII code. |
| 40 | U+E000..U+F8FF, U+F0000..U+FFFFD, U+100000..U+10FFFD | Private Use Area (Co) | GlassWorm (as reported by some sources), font-icon glyphs | strip in code (fail if inside string literals); report-only in docs | No interoperable meaning; sometimes legitimate for icon fonts such as Nerd Fonts and Font Awesome. |
| 41 | U+FDD0..U+FDEF, U+nFFFE and U+nFFFF (n = 0..16) | Noncharacters | Possible carrier | replace with U+FFFD (or strip) and report | Not for interchange; TR36 §3.2 recommends U+FFFD substitution. |
| 42 | U+FFFC, U+FFFD | Object replacement and replacement character | Artefacts of corrupted conversion; possible marker | report-only | Indicates lossy conversion; rarely an intentional carrier. |
| 43 | U+2800, U+1D159 | Braille blank, null notehead | Invisible-looking identifiers and fillers | report-only (strip in code identifiers) | Renders as blank but is not Default_Ignorable. |
| 44 | U+0600..U+0605, U+06DD, U+070F, U+0890..U+0891, U+08E2, U+110BD, U+110CD, U+13430..U+1343F | Visible format characters (prepended concatenation marks, hieroglyph controls) | None reported | report-only (outside Arabic, Syriac, Kaithi or Egyptian text) | Cf but visible; low risk. |
| 45 | Entities and escapes for any row above: `&#x200B;`, `&#8203;`, `&zwj;`, `&ZeroWidthSpace;`, `​`, `\u{E0041}`, `\U000E0041`, `󠁁`, `%E2%80%8B`, `\xE2\x80\x8B`, `\N{...}` | Encoded carriers | GlassWorm-style payloads, prompt injection | report-only (decode, rescan, then apply the decoded row's action as a finding) | Escapes keep files ASCII while carrying the same payload; auto-rewriting escapes can break intentional fixtures. |
| 46 | `-----BEGIN C2PA MANIFEST-----` ... `-----END C2PA MANIFEST-----` block; U+FEFF followed by a VS run beginning with the magic "C2PATXT\0" | C2PA text manifests (A.9 structured, A.8 unstructured) | C2PA 2.3/2.4, EncypherAI | report-only (opt-in strip) | Deliberate provenance; removal may conflict with EU AI Act or Chinese labelling rules. |
| 47 | (no code points) | Statistical token watermarks: Kirchenbauer, Aaronson/Gumbel, SynthID-Text, Anthropic Claude watermark, OpenAI textGrain, Meta research schemes | Google, Anthropic, OpenAI (EU), others | none possible: document only | No character carrier exists. Stripping characters cannot remove or detect these. |

### Implementation notes derived from the sources

- Build the strip sets from UCD properties (Default_Ignorable_Code_Point, Bidi_Control, Variation_Selector, Noncharacter_Code_Point, gc=Co, gc=Cc, White_Space minus U+0020/TAB/LF/CR) rather than from hand-written lists. That way, future Unicode versions are covered automatically. Rows 1–24 above are exactly the Default_Ignorable set, plus U+FFF9..U+FFFB.
- Run the "keep-in-context" checks at the grapheme-cluster and sequence level. Useful sources:
  - emoji-zwj-sequences.txt and emoji-sequences.txt (UTS #51)
  - StandardizedVariants.txt and IVD_Sequences.txt
  - UAX #31 ZWJ/ZWNJ contexts
- Flag **runs**. One variation selector after an emoji is normal. Ten or more consecutive selectors, tags or zero-width characters is a payload. GlassWorm and C2PA A.8 both produce runs of hundreds or more.
- Never auto-fix inside identifiers or string literals (UTS #55; TR36 §3.5). Fail the check and print the code points (U+XXXX) with their positions, the way GitHub's hidden-Unicode warning and VS Code's highlighting do.

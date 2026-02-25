---
name: glossary-pdf
description: Extract Greek-English glossary from ΚΛΙΚ στα ελληνικά PDF into structured CSV. Use when working with words.pdf or glossary extraction.
allowed-tools: Read, Bash, Write, Glob, Grep
argument-hint: [pdf-path] [output-csv-path]
---

# Greek Glossary PDF Extractor

Extract vocabulary from **ΚΛΙΚ στα ελληνικά** glossary PDF into a structured CSV.

## Input

- `$ARGUMENTS[0]` — path to the glossary PDF (default: `words.pdf` in cwd)
- `$ARGUMENTS[1]` — output CSV path (default: `words.csv` in cwd)

## Output CSV columns

| Column | Description | Example |
|--------|-------------|---------|
| `greek` | Word with one ending expanded | `αγαπημένος` |
| `notes` | Article, alt endings, annotations | `-η, -ο` |
| `english` | English translation | `favorite, beloved, dear` |
| `russian` | Russian translation | `любимый, дорогой` |

## How to run

Use the Python script at `.claude/skills/glossary-pdf/extract.py`:

```bash
python3 .claude/skills/glossary-pdf/extract.py <pdf-path> <output-csv-path>
```

The script requires `pdfplumber` and `deep-translator`. Install if missing:

```bash
pip3 install pdfplumber deep-translator
```

## PDF structure notes

- The glossary PDF is **3-column layout**, pages 5–18 (0-indexed: 4–17) contain entries.
- Pages 1–4 are title/copyright, pages 19–20 are blank/back cover.
- Each entry follows the pattern: `greek_word = english_translation`.
- Multi-line entries have continuation lines without `=`.
- Column boundaries are detected dynamically per page by analyzing word x-positions and finding the two largest gaps.

## Greek word parsing rules

The `greek` column in the raw PDF contains articles, gender endings, brackets, and alternative forms mixed in. The parser separates them:

| Raw pattern | greek | notes |
|-------------|-------|-------|
| `αβγό, το` | `αβγό` | `το` |
| `αγαπάω, -ώ` | `αγαπάω` | `-ώ` |
| `αγαπημέν-ος, -η, -ο` | `αγαπημένος` | `-η, -ο` |
| `Άγγλος, ο / Αγγλίδα, η` | `Άγγλος` | `ο / Αγγλίδα, η` |
| `άγχος, το [see also αγωνία]` | `άγχος` | `το; [see also αγωνία]` |
| `ΑΕΙ (Ανώτατο...), τo` | `ΑΕΙ` | `τo; (Ανώτατο...)` |
| `δικ-ός, -ή, -ό / δικ-οί, -ές, -ά μου` | `δικός` | `-ή, -ό; / δικοί -ές, -ά μου` |

### Parsing priority

1. Extract `[...]` bracket annotations → notes
2. Extract `(...)` parenthetical annotations (keep short prefixes like `(μου)` in word) → notes
3. Expand hyphenated endings: `base-ending` → full word; alt endings → notes
4. Verb alternatives: `verb, -alt` → word + alt in notes
5. Multi-form with `/`: first form = word, rest → notes
6. Simple `word, article` → word + article in notes
7. Comma-separated forms: first = word, rest → notes

## Post-processing

After extraction, the script:
1. Removes column-bleed artifacts (entries where English contains Greek text)
2. Splits merged entries where two glossary items ended up on one line
3. Removes fragment entries (broken words from column boundaries)
4. Translates English → Russian via Google Translate

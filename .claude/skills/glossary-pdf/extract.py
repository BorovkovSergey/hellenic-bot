#!/usr/bin/env python3
"""
Extract Greek-English glossary from ΚΛΙΚ στα ελληνικά PDF into structured CSV.

Usage:
    python3 extract.py <pdf-path> [output-csv-path]

Output CSV columns: greek, notes, english, russian
"""

import csv
import re
import sys
import time

GLOSSARY_PAGES = range(4, 18)  # 0-indexed: pages 5-18
ARTICLES = {"ο", "η", "το", "τα", "οι", "τo", "o"}
GREEK_LOWER = r"[α-ωά-ώίύόέήϊϋΐΰ]"


# ---------------------------------------------------------------------------
# Step 1: Extract raw entries from 3-column PDF
# ---------------------------------------------------------------------------

def extract_raw_entries(pdf_path):
    """Read the PDF, split into columns, parse 'greek = english' entries."""
    import pdfplumber

    all_col_texts = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num in GLOSSARY_PAGES:
            if page_num >= len(pdf.pages):
                break
            page = pdf.pages[page_num]
            words = page.extract_words(
                keep_blank_chars=True, x_tolerance=2, y_tolerance=2
            )
            if not words:
                continue

            # Dynamic column detection via largest x-gaps
            x0_sorted = sorted(set(round(w["x0"]) for w in words))
            gaps = []
            for i in range(1, len(x0_sorted)):
                gap = x0_sorted[i] - x0_sorted[i - 1]
                if gap > 15:
                    gaps.append((gap, x0_sorted[i - 1], x0_sorted[i]))
            gaps.sort(reverse=True)

            if len(gaps) >= 2:
                boundaries = sorted(gaps[:2], key=lambda g: g[1])
                col1_end = boundaries[0][1] + 2
                col2_end = boundaries[1][1] + 2
            else:
                w = page.width
                col1_end = w / 3
                col2_end = 2 * w / 3

            columns = {0: [], 1: [], 2: []}
            for word in words:
                x = word["x0"]
                if x < col1_end:
                    columns[0].append(word)
                elif x < col2_end:
                    columns[1].append(word)
                else:
                    columns[2].append(word)

            for col_idx in range(3):
                col_words = columns[col_idx]
                if not col_words:
                    continue
                col_words.sort(key=lambda w: (round(w["top"]), w["x0"]))
                lines = []
                cur = [col_words[0]]
                for w in col_words[1:]:
                    if abs(w["top"] - cur[-1]["top"]) < 4:
                        cur.append(w)
                    else:
                        cur.sort(key=lambda ww: ww["x0"])
                        lines.append(" ".join(ww["text"] for ww in cur))
                        cur = [w]
                if cur:
                    cur.sort(key=lambda ww: ww["x0"])
                    lines.append(" ".join(ww["text"] for ww in cur))
                all_col_texts.append("\n".join(lines))

    # Parse columns into (greek, english) pairs
    entries = []
    for col_text in all_col_texts:
        cur_g, cur_e = None, None
        for line in col_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if re.match(r"^\d+$", line):
                continue
            if re.search(r"^.+ – .+$", line) and "=" not in line:
                continue

            if re.match(r"^\s*=\s*.+$", line):
                if cur_g is not None:
                    parts = line.split("=", 1)
                    prefix = parts[0].strip()
                    if prefix:
                        cur_g += " " + prefix
                    cur_e = parts[1].strip()
            elif "=" in line:
                if cur_g and cur_e:
                    entries.append((cur_g, cur_e))
                m = re.match(r"^(.+?)\s*=\s*(.+)$", line)
                if m:
                    cur_g = m.group(1).strip()
                    cur_e = m.group(2).strip()
                else:
                    cur_g, cur_e = None, None
            else:
                if cur_e is not None:
                    cur_e += " " + line
        if cur_g and cur_e:
            entries.append((cur_g, cur_e))

    return entries


# ---------------------------------------------------------------------------
# Step 2: Clean column-bleed artifacts
# ---------------------------------------------------------------------------

def has_greek_bleed(english):
    return len(re.findall(r"[Α-Ωα-ωΆ-Ώά-ώ]", english)) > 5


def split_merged(greek, english):
    """Split entries where two glossary items merged on one line."""
    m = re.match(
        r"^(.*?)\s+([Α-Ωα-ωΆ-Ώά-ώ(«\[Ε]"
        r"[Α-Ωα-ωΆ-Ώά-ώ\s,\-/\.\(\)\[\]ο/η«»]+"
        r"\s*=\s*.+)$",
        english,
    )
    if m:
        clean_e = m.group(1).strip().rstrip(",").strip()
        rest = m.group(2).strip()
        results = []
        if clean_e:
            results.append((greek, clean_e))
        m2 = re.match(r"^(.+?)\s*=\s*(.+)$", rest)
        if m2:
            results.append((m2.group(1).strip(), m2.group(2).strip()))
        return results if results else [(greek, english)]

    m = re.match(r"^(.*?)\s+[Α-Ωα-ωΆ-Ώά-ώ(«\[]", english)
    if m:
        clean_e = m.group(1).strip().rstrip(",").strip()
        if clean_e and len(clean_e) > 1:
            return [(greek, clean_e)]

    return [(greek, english)]


def clean_entries(raw):
    """Remove letter headers, fragments; fix bleed."""
    cleaned = []
    for g, e in raw:
        g = re.sub(r"\s+", " ", g).strip()
        e = re.sub(r"\s+", " ", e).strip()
        if re.match(r"^[Α-Ωα-ω], [Α-Ωα-ω]$", g):
            continue
        if len(g) < 2:
            continue
        cleaned.append((g, e))

    # Split merged entries
    result = []
    for g, e in cleaned:
        if has_greek_bleed(e):
            result.extend(split_merged(g, e))
        else:
            result.append((g, e))

    # Remove fragments
    final = []
    for g, e in result:
        if re.match(r"^[\)\]\}]", g) and len(g) < 10:
            continue
        if re.match(r"^[a-z\])]", g):
            continue
        if g.endswith(")") and len(g) < 15 and "," not in g and g[0].islower():
            continue
        if not e or len(e) < 1:
            continue
        final.append((g, e))

    return final


# ---------------------------------------------------------------------------
# Step 3: Parse greek column into (word, notes)
# ---------------------------------------------------------------------------

def parse_greek(raw):
    """Split raw greek entry into (clean_word, notes)."""
    text = raw.strip()
    notes = []

    # 1. Extract [...] annotations
    for m in re.finditer(r"\[([^\]]+)\]", text):
        notes.append(f"[{m.group(1)}]")
    text = re.sub(r"\s*\[[^\]]+\]", "", text).strip()

    # 2. Extract (...) annotations (keep short prefix like (μου) in word)
    for m in list(re.finditer(r"\(([^)]+)\)", text)):
        content = m.group(1)
        if m.start() <= 1 and len(content) <= 5 and "/" not in content:
            continue
        notes.append(f"({content})")
    text = re.sub(r"\((?![α-ωά-ώ]{1,5}\))([^)]{6,})\)", "", text)
    text = re.sub(r"\(/[^)]+\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r",\s*,", ",", text).strip()

    # 3. Hyphenated endings (Greek letter must precede the hyphen)
    hyph = re.match(
        rf"^(.*?{GREEK_LOWER})-({GREEK_LOWER}+)"
        rf"((?:\s*,\s*-{GREEK_LOWER}+)*)"
        r"(.*)$",
        text,
    )
    if hyph:
        base, primary, alts, rest = hyph.groups()
        word = base + primary
        if alts:
            notes.insert(0, alts.lstrip(",").strip())
        rest = rest.strip().lstrip(",").strip()
        if rest:
            rest_hyph = re.match(
                rf"^/\s*(.*?{GREEK_LOWER})-({GREEK_LOWER}+)"
                rf"((?:\s*,\s*-{GREEK_LOWER}+)*)"
                r"(.*)$",
                rest,
            )
            if rest_hyph:
                b2, p2, a2, r2 = rest_hyph.groups()
                note = f"/ {b2.strip()}{p2}"
                if a2:
                    note += f" {a2.lstrip(',').strip()}"
                r2 = r2.strip().lstrip(",").strip()
                if r2:
                    note += f" {r2}"
                notes.append(note)
            else:
                notes.append(rest)
        return word, _join_notes(notes)

    # 4. Verb alternative: αγαπάω, -ώ
    verb = re.match(rf"^(.+?)\s*,\s*(-{GREEK_LOWER}+)\s*(.*)$", text)
    if verb:
        word = verb.group(1).strip()
        notes.insert(0, verb.group(2).strip())
        rest = verb.group(3).strip().lstrip(",").strip()
        if rest:
            notes.append(rest)
        return word, _join_notes(notes)

    # 5. Multi-form with /
    if "/" in text:
        parts = text.split("/", 1)
        first = parts[0].strip().rstrip(",").strip()
        second = parts[1].strip()
        fp = first.rsplit(",", 1)
        if len(fp) == 2 and fp[1].strip() in ARTICLES:
            word = fp[0].strip()
            notes.insert(0, f"{fp[1].strip()} / {second}")
        else:
            word = first
            notes.append(f"/ {second}")
        return word, _join_notes(notes)

    # 6. Simple: word, article
    cp = text.rsplit(",", 1)
    if len(cp) == 2 and cp[1].strip() in ARTICLES:
        notes.insert(0, cp[1].strip())
        return cp[0].strip(), _join_notes(notes)

    # 7. Comma-separated forms
    cparts = [p.strip() for p in text.split(",")]
    if 2 <= len(cparts) <= 4 and all(p and p not in ARTICLES for p in cparts):
        notes.insert(0, ", ".join(cparts[1:]))
        return cparts[0], _join_notes(notes)

    return text, _join_notes(notes)


def _join_notes(parts):
    return "; ".join(p for p in parts if p).rstrip(",;").strip()


# ---------------------------------------------------------------------------
# Step 4: Translate English → Russian
# ---------------------------------------------------------------------------

def translate_to_russian(entries):
    """Add Russian translations via Google Translate."""
    from deep_translator import GoogleTranslator

    translator = GoogleTranslator(source="en", target="ru")
    english_texts = [e for _, _, e, _ in entries]

    all_russian = []
    batch_size = 50

    for i in range(0, len(english_texts), batch_size):
        batch = english_texts[i : i + batch_size]
        combined = "\n".join(batch)
        try:
            result = translator.translate(combined)
            parts = result.split("\n")
            if len(parts) != len(batch):
                for text in batch:
                    try:
                        all_russian.append(translator.translate(text))
                    except Exception:
                        all_russian.append("")
                    time.sleep(0.1)
            else:
                all_russian.extend(parts)
        except Exception:
            for text in batch:
                try:
                    all_russian.append(translator.translate(text))
                except Exception:
                    all_russian.append("")
                time.sleep(0.1)

        done = min(i + batch_size, len(english_texts))
        print(f"  Translated {done}/{len(english_texts)}", flush=True)
        time.sleep(0.2)

    result = []
    for idx, (g, n, e, _) in enumerate(entries):
        r = all_russian[idx] if idx < len(all_russian) else ""
        result.append((g, n, e, r))
    return result


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run(pdf_path, output_path):
    print(f"[1/4] Extracting from {pdf_path}...")
    raw = extract_raw_entries(pdf_path)
    print(f"       Raw entries: {len(raw)}")

    print("[2/4] Cleaning column artifacts...")
    cleaned = clean_entries(raw)
    print(f"       Clean entries: {len(cleaned)}")

    print("[3/4] Parsing greek column...")
    parsed = []
    for g, e in cleaned:
        word, note = parse_greek(g)
        word = re.sub(r"\s+", " ", word).strip().rstrip(",").strip()
        note = re.sub(r"\s+", " ", note).strip().rstrip(",;").strip()
        parsed.append((word, note, e, ""))

    print(f"[4/4] Translating to Russian ({len(parsed)} entries)...")
    final = translate_to_russian(parsed)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["greek", "notes", "english", "russian"])
        writer.writerows(final)

    print(f"\nDone! {len(final)} entries → {output_path}")
    return final


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else "words.pdf"
    out = sys.argv[2] if len(sys.argv) > 2 else "words.csv"
    run(pdf, out)

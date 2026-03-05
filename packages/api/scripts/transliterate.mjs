import { readFileSync, writeFileSync } from "fs";

// Modern Greek transliteration rules (phonetic, for learners)
// Voiced consonants for αυ/ευ rules: β,γ,δ,ζ,λ,μ,ν,ρ + vowels
const VOICED = new Set("αάβγδεέζηήιίϊΐκλμνοόρυύϋΰωώ".split(""));

function isVoiced(ch) {
  return VOICED.has(ch?.toLowerCase());
}

function transliterate(word) {
  const w = word.toLowerCase();
  let result = "";
  let i = 0;

  while (i < w.length) {
    const c = w[i];
    const next = w[i + 1];
    const next2 = w[i + 2];

    // --- Digraphs & trigraphs first ---

    // μπ → b (start of word) / mb (middle)
    if (c === "μ" && next === "π") {
      result += i === 0 ? "b" : "mb";
      i += 2;
      continue;
    }
    // ντ → d (start of word) / nd (middle)
    if (c === "ν" && next === "τ") {
      result += i === 0 ? "d" : "nd";
      i += 2;
      continue;
    }
    // γκ → g (start of word) / ng (middle)
    if (c === "γ" && next === "κ") {
      result += i === 0 ? "g" : "ng";
      i += 2;
      continue;
    }
    // γγ → ng
    if (c === "γ" && next === "γ") {
      result += "ng";
      i += 2;
      continue;
    }
    // γξ → nx
    if (c === "γ" && next === "ξ") {
      result += "nx";
      i += 2;
      continue;
    }
    // γχ → nch
    if (c === "γ" && next === "χ") {
      result += "nch";
      i += 2;
      continue;
    }
    // τσ → ts
    if (c === "τ" && next === "σ") {
      result += "ts";
      i += 2;
      continue;
    }
    // τζ → tz
    if (c === "τ" && next === "ζ") {
      result += "tz";
      i += 2;
      continue;
    }

    // αύ / αυ → av/af
    if ((c === "α" || c === "ά") && (next === "υ" || next === "ύ")) {
      const stressed = c === "ά" || next === "ύ";
      const afterDigraph = w[i + 2];
      const useV = afterDigraph && isVoiced(afterDigraph);
      result += (stressed ? "á" : "a") + (useV ? "v" : "f");
      i += 2;
      continue;
    }
    // εύ / ευ → ev/ef
    if ((c === "ε" || c === "έ") && (next === "υ" || next === "ύ")) {
      const stressed = c === "έ" || next === "ύ";
      const afterDigraph = w[i + 2];
      const useV = afterDigraph && isVoiced(afterDigraph);
      result += (stressed ? "é" : "e") + (useV ? "v" : "f");
      i += 2;
      continue;
    }
    // ηύ / ηυ → iv/if
    if ((c === "η" || c === "ή") && (next === "υ" || next === "ύ")) {
      const stressed = c === "ή" || next === "ύ";
      const afterDigraph = w[i + 2];
      const useV = afterDigraph && isVoiced(afterDigraph);
      result += (stressed ? "í" : "i") + (useV ? "v" : "f");
      i += 2;
      continue;
    }

    // οι → i
    if ((c === "ο" || c === "ό") && (next === "ι" || next === "ί")) {
      const stressed = c === "ό" || next === "ί";
      result += stressed ? "í" : "i";
      i += 2;
      continue;
    }
    // ει → i
    if ((c === "ε" || c === "έ") && (next === "ι" || next === "ί")) {
      const stressed = c === "έ" || next === "ί";
      result += stressed ? "í" : "i";
      i += 2;
      continue;
    }
    // αι → e
    if ((c === "α" || c === "ά") && (next === "ι" || next === "ί")) {
      const stressed = c === "ά" || next === "ί";
      result += stressed ? "é" : "e";
      i += 2;
      continue;
    }
    // ου → u
    if ((c === "ο" || c === "ό") && (next === "υ" || next === "ύ")) {
      const stressed = c === "ό" || next === "ύ";
      result += stressed ? "ú" : "u";
      i += 2;
      continue;
    }

    // γ before front vowels (ε,ι,η,ει,οι) → y
    if (c === "γ" && next && "εέιίηήυύ".includes(next)) {
      result += "y";
      i += 1;
      continue;
    }

    // --- Single letters ---
    const MAP = {
      "α": "a", "ά": "á",
      "β": "v",
      "γ": "g",
      "δ": "d",
      "ε": "e", "έ": "é",
      "ζ": "z",
      "η": "i", "ή": "í",
      "θ": "th",
      "ι": "i", "ί": "í", "ϊ": "i", "ΐ": "í",
      "κ": "k",
      "λ": "l",
      "μ": "m",
      "ν": "n",
      "ξ": "x",
      "ο": "o", "ό": "ó",
      "π": "p",
      "ρ": "r",
      "σ": "s", "ς": "s",
      "τ": "t",
      "υ": "i", "ύ": "í", "ϋ": "i", "ΰ": "í",
      "φ": "f",
      "χ": "ch",
      "ψ": "ps",
      "ω": "o", "ώ": "ó",
    };

    if (MAP[c]) {
      result += MAP[c];
    } else {
      // pass through non-Greek chars (spaces, hyphens, etc.)
      result += c;
    }
    i++;
  }

  return result;
}

// Extract words from seed SQL
const sql = readFileSync(
  new URL("../drizzle/0005_reseed_words.sql", import.meta.url),
  "utf-8"
);

const lines = sql.split("\n");
const updates = [];

for (const line of lines) {
  // Match: ('αβγό', ...
  const match = line.match(/^\s*\('([^']+)',\s/);
  if (!match) continue;
  const original = match[1];
  const transcription = transliterate(original);
  const escaped = (s) => s.replace(/'/g, "''");
  updates.push(
    `  UPDATE words SET transcription = '${escaped(transcription)}' WHERE original = '${escaped(original)}' AND transcription IS NULL;`
  );
}

console.log(`Generated ${updates.length} UPDATE statements`);

// Spot-check some transliterations
const checks = [
  ["αβγό", "avgó"],
  ["αγαπάω", "agapáo"],
  ["ευχαριστώ", "efcharistó"],
  ["μπαίνω", "béno"],
  ["ντομάτα", "domáta"],
  ["γκρίζος", "grízos"],
  ["τσάι", "tsái"],
  ["αυτοκίνητο", "aftokínito"],
  ["ούτε", "úte"],
  ["γεια", "yia"],
];

console.log("\nSpot checks:");
for (const [greek, expected] of checks) {
  const got = transliterate(greek);
  const ok = got === expected ? "OK" : "MISMATCH";
  console.log(`  ${greek} → ${got} (expected: ${expected}) ${ok}`);
}

// Write migration
const migrationSql = updates.join("\n--> statement-breakpoint\n");
writeFileSync(
  new URL("../drizzle/0006_add_transcriptions.sql", import.meta.url),
  migrationSql + "\n"
);

console.log(
  `\nMigration written to packages/api/drizzle/0006_add_transcriptions.sql`
);

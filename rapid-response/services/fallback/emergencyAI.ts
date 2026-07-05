// emergencyAI.ts
// Production-quality offline fallback AI for emergency classification
// Zero dependencies · Works in React Native (Expo) · TypeScript
// Handles: English, Hindi, Hinglish, messy speech transcripts

import {
  KEYWORD_DICT,
  URGENCY_HIGH,
  URGENCY_LOW,
  NEGATION_TOKENS,
  EmergencyCategory,
  KeywordEntry,
} from "../fallback/emergencyDictionary";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface EmergencyResult {
  type: EmergencyCategory;
  priority: Priority;
  summary: string;
  keywords: string[];
  location: string | null;   // e.g. "room 201", "floor 3"
  confidence: number;        // 0–1, how sure we are
  rawScores: Record<EmergencyCategory, number>; // debug visibility
}

// ─────────────────────────────────────────────────────────────────────────────
// PREPROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a raw (potentially noisy) speech transcript.
 * - Lowercase
 * - Strip filler words and transcription artifacts
 * - Transliterate common Devanagari variants to Latin equivalents already
 *   in the dictionary (Whisper usually gives Latin Hinglish, so this is a
 *   safety net for when it outputs Devanagari)
 */
function preprocess(text: string): string {
  let t = text.toLowerCase().trim();

  // Devanagari → Latin transliterations (common emergency words)
  const devToLatin: [RegExp, string][] = [
    [/आग/g, "aag"],
    [/बचाओ/g, "bachao"],
    [/मदद/g, "madad"],
    [/खून/g, "khoon"],
    [/बेहोश/g, "behosh"],
    [/चाकू/g, "chaku"],
    [/बंदूक/g, "bandook"],
    [/धुआ/g, "dhuan"],
    [/डर/g, "dar"],
  ];
  for (const [pattern, replacement] of devToLatin) {
    t = t.replace(pattern, replacement);
  }

  // Normalise common Whisper mishears / punctuation artifacts
  t = t.replace(/[^\w\s'-]/g, " "); // keep hyphens and apostrophes
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Extract all tokens (words + bigrams + trigrams) from the cleaned text.
 * Using n-grams catches multi-word phrases like "aag lag gayi".
 */
function tokenize(text: string): string[] {
  const words = text.split(/\s+/);
  const tokens: string[] = [...words];

  // bigrams
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]} ${words[i + 1]}`);
  }
  // trigrams
  for (let i = 0; i < words.length - 2; i++) {
    tokens.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEGATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a set of character offsets where negation tokens appear.
 * A keyword within 40 characters after a negation is considered negated.
 */
function buildNegationOffsets(text: string): number[] {
  const offsets: number[] = [];
  for (const neg of NEGATION_TOKENS) {
    let pos = text.indexOf(neg);
    while (pos !== -1) {
      offsets.push(pos);
      pos = text.indexOf(neg, pos + 1);
    }
  }
  return offsets;
}

function isNegated(text: string, term: string, negOffsets: number[]): boolean {
  const pos = text.indexOf(term);
  if (pos === -1) return false;
  return negOffsets.some((neg) => neg < pos && pos - neg < 45);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: EmergencyCategory[] = ["FIRE", "MEDICAL", "SECURITY", "PANIC", "OTHER"];

type ScoreMap = Record<EmergencyCategory, number>;

function buildEmptyScores(): ScoreMap {
  return { FIRE: 0, MEDICAL: 0, SECURITY: 0, PANIC: 0, OTHER: 0 };
}

/**
 * Core multi-signal scoring.
 * Returns raw scores per category + matched keywords.
 */
function scoreText(
  cleanText: string,
  tokens: string[],
  negOffsets: number[]
): { scores: ScoreMap; matchedKeywords: Map<string, KeywordEntry> } {
  const scores = buildEmptyScores();
  const matched = new Map<string, KeywordEntry>();

  for (const entry of KEYWORD_DICT) {
    const { term, weight, category, isNegatable } = entry;

    // Check if this token appears in our token set
    if (!tokens.includes(term)) continue;

    // Check negation
    if (isNegatable && isNegated(cleanText, term, negOffsets)) {
      // Negated → apply 10% weight (small signal that it was mentioned at all)
      scores[category] += weight * 0.1;
      continue;
    }

    // Count occurrences — repeated mentions increase confidence (capped at 3×)
    let occurrences = 0;
    let searchFrom = 0;
    while (true) {
      const idx = cleanText.indexOf(term, searchFrom);
      if (idx === -1) break;
      occurrences++;
      searchFrom = idx + term.length;
    }
    const repetitionMultiplier = Math.min(occurrences, 3);

    scores[category] += weight * repetitionMultiplier;
    matched.set(term, entry);
  }

  // Proximity bonus: if high-weight terms from the SAME category are within
  // 60 chars of each other, boost that category by 30%
  for (const cat of CATEGORIES) {
    const catTerms = KEYWORD_DICT.filter((e) => e.category === cat && e.weight >= 0.8);
    const positions: number[] = [];
    for (const entry of catTerms) {
      let pos = cleanText.indexOf(entry.term);
      while (pos !== -1) {
        positions.push(pos);
        pos = cleanText.indexOf(entry.term, pos + 1);
      }
    }
    positions.sort((a, b) => a - b);
    for (let i = 0; i < positions.length - 1; i++) {
      if (positions[i + 1] - positions[i] < 60) {
        scores[cat] *= 1.3;
        break;
      }
    }
  }

  return { scores, matchedKeywords: matched };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY SCORING
// ─────────────────────────────────────────────────────────────────────────────

function scorePriority(cleanText: string): Priority {
  let urgencyScore = 0;

  for (const phrase of URGENCY_HIGH) {
    if (cleanText.includes(phrase)) urgencyScore += 1;
  }
  for (const phrase of URGENCY_LOW) {
    if (cleanText.includes(phrase)) urgencyScore -= 1;
  }

  if (urgencyScore >= 1) return "HIGH";
  if (urgencyScore <= -1) return "LOW";
  return "MEDIUM";
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract structured location info from the transcript.
 * Handles: "room 201", "kamra 5", "floor 3", "gate B", "building A", etc.
 */
function extractLocation(text: string): string | null {
  const patterns: RegExp[] = [
    /(?:room|rm|room no\.?|kamra|room number)\s*[:#-]?\s*(\d{1,4}[a-z]?)/i,
    /(?:floor|fl|manzil)\s*[:#-]?\s*(\d{1,2}(?:st|nd|rd|th)?)/i,
    /(?:building|block|wing|blk)\s*[:#-]?\s*([a-z0-9]{1,4})/i,
    /(?:gate|entrance|exit)\s*[:#-]?\s*([a-z0-9]{1,3})/i,
    /(?:ward|section|zone)\s*[:#-]?\s*([a-z0-9]{1,4})/i,
    /(?:office|cabin|cubicle)\s*[:#-]?\s*(\d{1,4}[a-z]?)/i,
    /(?:basement|parking|terrace|lobby|corridor)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_TEMPLATES: Record<EmergencyCategory, (loc: string | null, kw: string[]) => string> = {
  FIRE: (loc, kw) => {
    const locStr = loc ? ` at ${loc}` : "";
    if (kw.includes("gas leak") || kw.includes("gas ka leak")) return `Gas leak detected${locStr}`;
    if (kw.includes("explosion") || kw.includes("blast") || kw.includes("phat gaya")) return `Explosion reported${locStr}`;
    if (kw.includes("smoke") || kw.includes("dhuan") || kw.includes("dhuaan")) return `Smoke reported${locStr}, possible fire`;
    return `Fire emergency reported${locStr}`;
  },
  MEDICAL: (loc, kw) => {
    const locStr = loc ? ` at ${loc}` : "";
    if (kw.includes("heart attack") || kw.includes("dil ka dora")) return `Possible cardiac emergency${locStr}`;
    if (kw.includes("unconscious") || kw.includes("behosh") || kw.includes("behosh ho gaya")) return `Person unconscious${locStr}, immediate response needed`;
    if (kw.includes("bleeding") || kw.includes("khoon")) return `Injury with bleeding reported${locStr}`;
    if (kw.includes("saans nahi") || kw.includes("saans le nahi")) return `Person having breathing difficulty${locStr}`;
    if (kw.includes("seizure") || kw.includes("mirgi")) return `Seizure reported${locStr}`;
    return `Medical emergency reported${locStr}`;
  },
  SECURITY: (loc, kw) => {
    const locStr = loc ? ` at ${loc}` : "";
    if (kw.includes("gun") || kw.includes("pistol") || kw.includes("bandook")) return `Weapon (firearm) reported${locStr}`;
    if (kw.includes("shooting") || kw.includes("goli") || kw.includes("goli chali")) return `Shooting reported${locStr}, evacuate immediately`;
    if (kw.includes("robbery") || kw.includes("loot") || kw.includes("loota")) return `Robbery in progress${locStr}`;
    if (kw.includes("knife") || kw.includes("chaku") || kw.includes("chhura")) return `Armed threat with blade${locStr}`;
    if (kw.includes("fight") || kw.includes("lad rahe")) return `Physical altercation reported${locStr}`;
    return `Security threat reported${locStr}`;
  },
  PANIC: (loc, kw) => {
    const locStr = loc ? ` at ${loc}` : "";
    if (kw.includes("trapped") || kw.includes("fansa hua") || kw.includes("fasi hui")) return `Person trapped${locStr}, urgent rescue needed`;
    return `Distress call received${locStr}, immediate assistance needed`;
  },
  OTHER: (loc, _kw) => {
    const locStr = loc ? ` at ${loc}` : "";
    return `Unclassified incident reported${locStr}`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Softmax-like confidence: how dominant is the winner over the rest?
 */
function computeConfidence(scores: ScoreMap, winner: EmergencyCategory): number {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const winnerScore = scores[winner];
  // Confidence = winner's share, boosted if it's clearly dominant
  const share = winnerScore / total;
  // Normalise to 0–1 range, 1.0 if winner is sole scorer
  return Math.min(1, share * 1.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY OVERRIDE BY TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Some incident types have a minimum priority floor.
 * E.g. a FIRE or SECURITY incident is never LOW priority.
 */
function applyPriorityFloor(type: EmergencyCategory, priority: Priority): Priority {
  if (type === "FIRE" || type === "SECURITY") {
    if (priority === "LOW") return "MEDIUM";
  }
  // Shooting/firearms always HIGH
  return priority;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a raw speech transcript into an EmergencyResult.
 * This is the single function you call from your app.
 *
 * @example
 * const result = classifyEmergency("bhai room 201 me aag lag gayi hai jaldi aao");
 * // → { type: "FIRE", priority: "HIGH", summary: "Fire emergency reported at room 201", ... }
 */
export function classifyEmergency(rawTranscript: string): EmergencyResult {
  if (!rawTranscript || rawTranscript.trim().length === 0) {
    return {
      type: "OTHER",
      priority: "MEDIUM",
      summary: "Empty or unreadable transcript",
      keywords: [],
      location: null,
      confidence: 0,
      rawScores: buildEmptyScores(),
    };
  }

  const cleanText = preprocess(rawTranscript);
  const tokens = tokenize(cleanText);
  const negOffsets = buildNegationOffsets(cleanText);

  // Score all categories
  const { scores, matchedKeywords } = scoreText(cleanText, tokens, negOffsets);

  // Determine winner
  let winner: EmergencyCategory = "OTHER";
  let winnerScore = 0;
  for (const cat of CATEGORIES) {
    if (scores[cat] > winnerScore) {
      winnerScore = scores[cat];
      winner = cat;
    }
  }

  // If no category scored above a minimum threshold, return OTHER
  if (winnerScore < 0.3) {
    winner = "OTHER";
  }

  // Priority
  let priority = scorePriority(cleanText);

  // Boost HIGH priority if winner score is very strong
  if (winnerScore >= 2.0 && priority !== "HIGH") {
    priority = "HIGH";
  }

  // Apply type-based floor
  priority = applyPriorityFloor(winner, priority);

  // Extract location
  const location = extractLocation(cleanText);

  // Build keyword list from matched terms (sorted by weight desc)
  const keywords = Array.from(matchedKeywords.entries())
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([term]) => term)
    .slice(0, 6);

  // Generate summary
  const summary = SUMMARY_TEMPLATES[winner](location, keywords);

  // Confidence
  const confidence = parseFloat(computeConfidence(scores, winner).toFixed(2));

  return {
    type: winner,
    priority,
    summary,
    keywords,
    location,
    confidence,
    rawScores: scores,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI → FALLBACK WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for your Gemini call.
 * Tries Gemini first; on any error (429, 503, timeout, invalid JSON)
 * it falls back to the local classifier instantly.
 *
 * @param transcript   The Whisper-transcribed text
 * @param geminiCall   Your existing Gemini API function
 * @param timeoutMs    Max time to wait for Gemini before falling back (default 3s)
 */
export async function classifyWithFallback(
  transcript: string,
  geminiCall: (text: string) => Promise<EmergencyResult>,
  timeoutMs = 3000
): Promise<EmergencyResult & { source: "gemini" | "local" }> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs)
  );

  try {
    const geminiResult = await Promise.race([geminiCall(transcript), timeoutPromise]);
    // Validate Gemini response structure
    if (geminiResult?.type && geminiResult?.priority && geminiResult?.summary) {
      return { ...geminiResult, source: "gemini" };
    }
    throw new Error("Invalid Gemini response structure");
  } catch (err) {
    // Gemini failed (429, 503, timeout, bad JSON, etc.) — use local
    console.warn("[EmergencyAI] Gemini unavailable, using local fallback:", err);
    const localResult = classifyEmergency(transcript);
    return { ...localResult, source: "local" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST SUITE (run with: npx ts-node emergencyAI.ts --test)
// ─────────────────────────────────────────────────────────────────────────────

if (typeof process !== "undefined" && process?.argv?.includes("--test")){
  const tests: [string, Partial<EmergencyResult>][] = [
    // English fire
    ["There is a fire in the building, black smoke everywhere",
      { type: "FIRE", priority: "HIGH" }],

    // Hinglish fire
    ["bhai room 201 me aag lag gayi hai jaldi aao",
      { type: "FIRE", priority: "HIGH", location: "room 201" }],

    // Security with weapon
    ["There are people fighting with guns in room 587",
      { type: "SECURITY", priority: "HIGH", location: "room 587" }],

    // Hindi security
    ["chaku lekar maar raha hai corridor mein jaldi aao",
      { type: "SECURITY", priority: "HIGH" }],

    // Medical
    ["sir is unconscious on the floor please send ambulance floor 3",
      { type: "MEDICAL", priority: "HIGH", location: "floor 3" }],

    // Hinglish medical
    ["uncle ko chest mein dard ho raha hai aur saans nahi le pa rahe room 104",
      { type: "MEDICAL", priority: "HIGH", location: "room 104" }],

    // Panic / trapped
    ["help help I'm trapped in the elevator please someone come",
      { type: "PANIC", priority: "HIGH" }],

    // Negation test (should NOT be FIRE)
    ["no fire alarm was a false alarm drill only test",
      { type: "OTHER" }],

    // Low urgency
    ["there might be a small leak somewhere maybe on floor 2",
      { type: "OTHER" }],

    // Mixed Hinglish panic
    ["bachao bachao koi hai yahan mere paas nahi aana please",
      { type: "PANIC", priority: "HIGH" }],
  ];

  let passed = 0;
  for (const [input, expected] of tests) {
    const result = classifyEmergency(input);
    const typeOk = !expected.type || result.type === expected.type;
    const priorityOk = !expected.priority || result.priority === expected.priority;
    const locationOk = !expected.location || result.location?.includes(expected.location.split(" ").pop()!);
    const ok = typeOk && priorityOk && locationOk;
    if (ok) passed++;
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} "${input.slice(0, 50)}..."`);
    if (!ok) {
      console.log(`   Expected: type=${expected.type} priority=${expected.priority} location=${expected.location}`);
      console.log(`   Got:      type=${result.type} priority=${result.priority} location=${result.location}`);
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed`);
}
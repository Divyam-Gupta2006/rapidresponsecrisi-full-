// emergencyDictionary.ts
// Hinglish + Hindi + English keyword dictionary for emergency detection
// Each entry: [term, weight, category]
// Weight: 1.0 = strong signal, 0.6 = moderate, 0.3 = weak/contextual

export type EmergencyCategory = "FIRE" | "MEDICAL" | "SECURITY" | "PANIC" | "OTHER";

export interface KeywordEntry {
  term: string;
  weight: number;
  category: EmergencyCategory;
  isNegatable?: boolean; // can "no X" / "no X nahi" cancel this?
}

export const KEYWORD_DICT: KeywordEntry[] = [
  // ─── FIRE ──────────────────────────────────────────────────────────────────
  { term: "fire",        weight: 1.0, category: "FIRE" },
  { term: "aag",         weight: 1.0, category: "FIRE" },         // Hindi: fire
  { term: "aag lagi",    weight: 1.0, category: "FIRE" },         // fire broke out
  { term: "aag lag",     weight: 1.0, category: "FIRE" },
  { term: "jal raha",    weight: 0.9, category: "FIRE" },         // burning
  { term: "jal rahi",    weight: 0.9, category: "FIRE" },
  { term: "dhuan",       weight: 0.8, category: "FIRE" },         // smoke
  { term: "dhuaan",      weight: 0.8, category: "FIRE" },
  { term: "smoke",       weight: 0.8, category: "FIRE", isNegatable: true },
  { term: "burning",     weight: 0.9, category: "FIRE" },
  { term: "flames",      weight: 1.0, category: "FIRE" },
  { term: "blast",       weight: 0.8, category: "FIRE" },
  { term: "explosion",   weight: 0.9, category: "FIRE" },
  { term: "bomb",        weight: 0.9, category: "SECURITY" },     // context-dependent
  { term: "sparks",      weight: 0.5, category: "FIRE", isNegatable: true },
  { term: "gas leak",    weight: 0.9, category: "FIRE" },
  { term: "gas ka leak", weight: 0.9, category: "FIRE" },
  { term: "jalane",      weight: 0.6, category: "FIRE" },         // to burn
  { term: "phat gaya",   weight: 0.8, category: "FIRE" },         // exploded
  { term: "short circuit", weight: 0.8, category: "FIRE" },

  // ─── MEDICAL ────────────────────────────────────────────────────────────────
  { term: "medical",     weight: 0.8, category: "MEDICAL" },
  { term: "ambulance",   weight: 1.0, category: "MEDICAL" },
  { term: "doctor",      weight: 0.7, category: "MEDICAL", isNegatable: true },
  { term: "heart attack", weight: 1.0, category: "MEDICAL" },
  { term: "dil ka dora", weight: 1.0, category: "MEDICAL" },      // heart attack colloquial
  { term: "chest pain",  weight: 1.0, category: "MEDICAL" },
  { term: "seene mein dard", weight: 1.0, category: "MEDICAL" },
  { term: "unconscious", weight: 1.0, category: "MEDICAL" },
  { term: "behosh",      weight: 1.0, category: "MEDICAL" },      // unconscious
  { term: "behosh ho gaya", weight: 1.0, category: "MEDICAL" },
  { term: "breathing",   weight: 0.7, category: "MEDICAL", isNegatable: true },
  { term: "saans nahi",  weight: 1.0, category: "MEDICAL" },      // can't breathe
  { term: "saans le nahi", weight: 1.0, category: "MEDICAL" },
  { term: "bleeding",    weight: 0.9, category: "MEDICAL" },
  { term: "khoon",       weight: 0.8, category: "MEDICAL" },      // blood
  { term: "khoon aa raha", weight: 1.0, category: "MEDICAL" },
  { term: "seizure",     weight: 1.0, category: "MEDICAL" },
  { term: "mirgi",       weight: 1.0, category: "MEDICAL" },      // epilepsy
  { term: "stroke",      weight: 1.0, category: "MEDICAL" },
  { term: "gir gaya",    weight: 0.6, category: "MEDICAL", isNegatable: true }, // fell down
  { term: "gir gayi",    weight: 0.6, category: "MEDICAL", isNegatable: true },
  { term: "injury",      weight: 0.7, category: "MEDICAL" },
  { term: "chot lagi",   weight: 0.7, category: "MEDICAL" },      // got hurt
  { term: "overdose",    weight: 1.0, category: "MEDICAL" },
  { term: "allergy",     weight: 0.6, category: "MEDICAL", isNegatable: true },
  { term: "reaction",    weight: 0.5, category: "MEDICAL", isNegatable: true },
  { term: "faint",       weight: 0.9, category: "MEDICAL" },
  { term: "dizziness",   weight: 0.5, category: "MEDICAL", isNegatable: true },
  { term: "cpr",         weight: 1.0, category: "MEDICAL" },

  // ─── SECURITY ───────────────────────────────────────────────────────────────
  { term: "gun",         weight: 1.0, category: "SECURITY" },
  { term: "weapon",      weight: 1.0, category: "SECURITY" },
  { term: "knife",       weight: 0.9, category: "SECURITY" },
  { term: "chaku",       weight: 1.0, category: "SECURITY" },     // knife/blade
  { term: "chhura",      weight: 1.0, category: "SECURITY" },     // knife
  { term: "pistol",      weight: 1.0, category: "SECURITY" },
  { term: "bandook",     weight: 1.0, category: "SECURITY" },     // gun/rifle
  { term: "shooting",    weight: 1.0, category: "SECURITY" },
  { term: "goli",        weight: 0.9, category: "SECURITY" },     // bullet/shot
  { term: "goli chali",  weight: 1.0, category: "SECURITY" },     // shots fired
  { term: "fight",       weight: 0.7, category: "SECURITY", isNegatable: true },
  { term: "lad rahe",    weight: 0.7, category: "SECURITY" },     // fighting
  { term: "maar raha",   weight: 0.8, category: "SECURITY" },     // hitting/beating
  { term: "maar rahi",   weight: 0.8, category: "SECURITY" },
  { term: "attack",      weight: 0.8, category: "SECURITY" },
  { term: "mara",        weight: 0.6, category: "SECURITY", isNegatable: true }, // hit (past)
  { term: "robbery",     weight: 1.0, category: "SECURITY" },
  { term: "loot",        weight: 0.9, category: "SECURITY" },
  { term: "loota",       weight: 0.9, category: "SECURITY" },     // robbed
  { term: "chori",       weight: 0.7, category: "SECURITY" },     // theft
  { term: "intruder",    weight: 1.0, category: "SECURITY" },
  { term: "trespassing", weight: 0.8, category: "SECURITY" },
  { term: "hostage",     weight: 1.0, category: "SECURITY" },
  { term: "violence",    weight: 1.0, category: "SECURITY" },
  { term: "threat",      weight: 0.7, category: "SECURITY" },
  { term: "dhamki",      weight: 0.9, category: "SECURITY" },     // threat
  { term: "stranger",    weight: 0.4, category: "SECURITY", isNegatable: true },
  { term: "suspicious",  weight: 0.5, category: "SECURITY", isNegatable: true },
  { term: "murder",      weight: 1.0, category: "SECURITY" },
  { term: "hatya",       weight: 1.0, category: "SECURITY" },     // murder

  // ─── PANIC ──────────────────────────────────────────────────────────────────
  { term: "help",        weight: 0.9, category: "PANIC" },
  { term: "bachao",      weight: 1.0, category: "PANIC" },        // save me / help
  { term: "bacha lo",    weight: 1.0, category: "PANIC" },
  { term: "madat",       weight: 0.8, category: "PANIC" },        // help (formal)
  { term: "madad karo",  weight: 0.9, category: "PANIC" },        // please help
  { term: "emergency",   weight: 0.8, category: "PANIC" },
  { term: "please help", weight: 1.0, category: "PANIC" },
  { term: "sos",         weight: 1.0, category: "PANIC" },
  { term: "trapped",     weight: 1.0, category: "PANIC" },
  { term: "fansa hua",   weight: 1.0, category: "PANIC" },        // trapped
  { term: "fasi hui",    weight: 1.0, category: "PANIC" },
  { term: "danger",      weight: 0.7, category: "PANIC" },
  { term: "khatara",     weight: 0.7, category: "PANIC" },        // danger
  { term: "scared",      weight: 0.5, category: "PANIC", isNegatable: true },
  { term: "dar raha",    weight: 0.5, category: "PANIC" },        // afraid
  { term: "please",      weight: 0.2, category: "PANIC", isNegatable: true },
  { term: "quickly",     weight: 0.3, category: "PANIC", isNegatable: true },
  { term: "jaldi",       weight: 0.3, category: "PANIC" },        // quickly/hurry
  { term: "jaldi aao",   weight: 0.6, category: "PANIC" },        // come quickly
  { term: "come fast",   weight: 0.6, category: "PANIC" },
  { term: "abhi aao",    weight: 0.6, category: "PANIC" },        // come now

  // ─── URGENCY MODIFIERS (boost priority score, not category) ─────────────────
  // handled separately in engine via URGENCY_TERMS
];

// Urgency phrases that boost priority HIGH
export const URGENCY_HIGH: string[] = [
  "immediately", "right now", "abhi", "bahut", "very", "extreme",
  "serious", "critical", "urgent", "please hurry", "jaldi", "bahut bura",
  "bohot bura", "zyada", "quickly", "fast", "tez", "turant",
  "right away", "asap", "fatafat"
];

// Urgency phrases that reduce priority to LOW
export const URGENCY_LOW: string[] = [
  "maybe", "shayad", "probably", "small", "minor", "little", "thoda",
  "chota", "chhota", "lagta hai", "normally", "usually", "not sure",
  "not urgent", "when you can", "no rush"
];

// Negation tokens — if these appear before a keyword, nullify or halve its weight
export const NEGATION_TOKENS: string[] = [
  "no", "not", "nahi", "nahin", "nahi hai", "false alarm",
  "just", "only", "nothing", "kuch nahi", "test", "practice",
  "mock", "drill", "simulation"
];
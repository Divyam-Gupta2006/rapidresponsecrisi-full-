export const WAKE_PHRASES = [
  "i need help",
  "code red",
  "help me now",
  "emergency help",
  "red alert distress",
  "initiate delta rescue",
  "trigger panic mode",
  "safety override execute",
  "activate rapid response",
] as const;

export type WakePhrase = (typeof WAKE_PHRASES)[number];

export type WakeMatch = {
  canonicalPhrase: WakePhrase;
  matchedPhrase: string;
  normalizedText: string;
};

const normalizeWakeInput = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const detectWakePhrase = (text: string): WakeMatch | null => {
  const normalizedText = normalizeWakeInput(text);

  if (!normalizedText) {
    return null;
  }

  for (const phrase of WAKE_PHRASES) {
    if (normalizedText.includes(phrase)) {
      return {
        canonicalPhrase: phrase,
        matchedPhrase: phrase,
        normalizedText,
      };
    }
  }

  return null;
};

export const isWakeWordDetected = (text: string) =>
  detectWakePhrase(text) !== null;

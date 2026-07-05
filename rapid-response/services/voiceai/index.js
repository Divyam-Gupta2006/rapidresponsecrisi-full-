import { classifyEmergency } from "./classifier";
import { cleanText } from "./cleaner";
import { extractEntities } from "./extractor";
import { calculatePriority } from "./scorer";
import { generateSummary } from "./summarizer";

export const processVoice = (transcript) => {
  const cleanedText = cleanText(transcript);

  const entities = extractEntities(cleanedText);

  const type = classifyEmergency(entities);

  const priority = calculatePriority(entities, type);

  const aiSummary = generateSummary(type, entities, priority);

  const confidence = calculateConfidence(entities);

  return {
    cleanedText,
    type,
    priority,
    confidence,
    entities,
    aiSummary,
  };
};

// simple confidence score
const calculateConfidence = (entities) => {
  let score = 0;

  score += entities.hazards.length * 0.3;
  score += entities.conditions.length * 0.3;
  score += entities.emotions.length * 0.1;

  return Math.min(1, score).toFixed(2);
};

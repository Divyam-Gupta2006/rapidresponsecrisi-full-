const hazardKeywords = ["smoke", "fire", "gas", "flame", "burn"];
const conditionKeywords = [
  "unconscious",
  "bleeding",
  "injured",
  "burned",
  "breathing",
];
const emotionKeywords = ["scared", "panic", "afraid", "help"];

export const extractEntities = (text) => {
  const hazards = hazardKeywords.filter((k) => text.includes(k));
  const conditions = conditionKeywords.filter((k) => text.includes(k));
  const emotions = emotionKeywords.filter((k) => text.includes(k));

  return {
    hazards,
    conditions,
    emotions,
  };
};

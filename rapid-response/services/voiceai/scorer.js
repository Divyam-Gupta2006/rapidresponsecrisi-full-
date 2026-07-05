export const calculatePriority = (entities, type) => {
  let score = 0;

  if (type === "FIRE") score += 5;
  if (type === "MEDICAL") score += 4;

  if (entities.conditions.includes("unconscious")) score += 5;
  if (entities.conditions.includes("breathing")) score += 4;
  if (entities.conditions.includes("bleeding")) score += 3;

  if (entities.emotions.length > 0) score += 1;

  if (score >= 8) return "HIGH";
  if (score >= 4) return "MEDIUM";

  return "LOW";
};

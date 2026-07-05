export const classifyEmergency = (entities) => {
  let fireScore = 0;
  let medicalScore = 0;
  let panicScore = 0;

  entities.hazards.forEach((h) => {
    if (["smoke", "fire", "flame", "burn"].includes(h)) fireScore += 5;
  });

  entities.conditions.forEach((c) => {
    if (["unconscious", "bleeding", "injured"].includes(c)) medicalScore += 5;
    if (["breathing"].includes(c)) {
      fireScore += 3;
      medicalScore += 3;
    }
  });

  entities.emotions.forEach(() => {
    panicScore += 2;
  });

  const max = Math.max(fireScore, medicalScore, panicScore);

  if (max === fireScore) return "FIRE";
  if (max === medicalScore) return "MEDICAL";
  if (max === panicScore) return "PANIC";

  return "GENERAL";
};

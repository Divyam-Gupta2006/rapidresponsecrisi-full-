export const processVoice = (text) => {
  const lower = text.toLowerCase();

  let type = "GENERAL";
  let priority = "LOW";

  if (lower.includes("fire") || lower.includes("smoke")) {
    type = "FIRE";
    priority = "HIGH";
  } else if (lower.includes("bleeding") || lower.includes("injured")) {
    type = "MEDICAL";
    priority = "HIGH";
  } else if (lower.includes("help")) {
    type = "PANIC";
    priority = "MEDIUM";
  }

  return {
    type,
    priority,
    aiSummary: `${type} emergency detected. Priority: ${priority}`,
  };
};
export const cleanText = (text) => {
  if (!text) return "";

  let cleaned = text.toLowerCase();

  const fillers = ["uh", "um", "like", "please", "help me"];

  fillers.forEach((word) => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

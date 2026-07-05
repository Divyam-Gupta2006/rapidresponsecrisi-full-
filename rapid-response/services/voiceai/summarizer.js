export const generateSummary = (type, entities, priority) => {
  let summary = "";

  if (type === "FIRE") {
    summary += "Fire hazard detected";
  } else if (type === "MEDICAL") {
    summary += "Medical emergency detected";
  } else if (type === "PANIC") {
    summary += "User in distress";
  } else {
    summary += "Emergency detected";
  }

  if (entities.conditions.includes("breathing")) {
    summary += " with breathing difficulty";
  }

  if (entities.conditions.includes("bleeding")) {
    summary += " with bleeding injury";
  }

  if (priority === "HIGH") {
    summary += ". Immediate assistance required.";
  } else if (priority === "MEDIUM") {
    summary += ". Assistance needed soon.";
  }

  return summary;
};

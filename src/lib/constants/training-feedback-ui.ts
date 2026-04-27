/** Suggested crop/plant names (optional datalist on feedback); users may type any name. */
export const TRAINING_FEEDBACK_CROP_EXAMPLES = [
  "Tomato",
  "Potato",
  "Pepper, bell",
  "Grape",
  "Apple",
  "Corn (maize)",
  "Strawberry",
  "Squash",
  "Cherry (including sour)"
] as const;

/** Shared dropdown options for optional ML training feedback (add plant + feedback page). */
export const TRAINING_FEEDBACK_CATEGORIES = [
  "",
  "Healthy",
  "Early blight",
  "Late blight",
  "Powdery mildew",
  "Rust",
  "Leaf spot",
  "Bacterial spot",
  "Nutrient deficiency",
  "Pest damage",
  "Other / not listed"
] as const;

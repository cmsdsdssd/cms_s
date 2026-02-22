export type ProductPose = 0 | 1 | 2;
export type BackgroundStyle = 0 | 1 | 2 | 3 | 4 | 5;

export type PromptInput = {
  productPose?: number;
  backgroundStyle?: number;
  customPrompt?: string;
};

const BACKGROUND_STYLE_DEFAULT: BackgroundStyle = 0;
const PRODUCT_POSE_DEFAULT: ProductPose = 0;

const POSE_PROMPT_MAP: Record<ProductPose, string> = {
  0: "CAMERA & COMPOSITION: Top-down flat-lay orientation preferred. HARD CONSTRAINT: product must be centered and occupy about 72-78% of the frame area.",
  1: "CAMERA & COMPOSITION: Upright eye-level orientation preferred. HARD CONSTRAINT: product must be centered and occupy about 72-78% of the frame area.",
  2: "CAMERA & COMPOSITION: Hanging/slight-angle orientation preferred. HARD CONSTRAINT: product must be centered and occupy about 72-78% of the frame area.",
};

const BACKGROUND_PROFILE_MAP: Record<BackgroundStyle, { hex: string; sentence: string }> = {
  0: {
    hex: "#FFFFFF",
    sentence: "BACKGROUND: Seamless pure white matte studio sweep (#FFFFFF). Perfectly uniform and clean with soft natural contact shadow.",
  },
  1: {
    hex: "#FDFBF7",
    sentence: "BACKGROUND: Seamless warm ivory matte studio sweep (#FDFBF7). Smooth and perfectly uniform with gentle warm contact shadow.",
  },
  2: {
    hex: "#F3F3F1",
    sentence: "BACKGROUND: Seamless light-gray matte studio sweep (#F3F3F1). Uniform and clean with soft natural contact shadow.",
  },
  3: {
    hex: "#EEF5FF",
    sentence: "BACKGROUND: Seamless pastel sky-blue matte studio sweep (#EEF5FF). Uniform and gentle with controlled natural contact shadow.",
  },
  4: {
    hex: "#FFF1F4",
    sentence: "BACKGROUND: Seamless soft blush-pink matte studio sweep (#FFF1F4). Uniform and elegant with subtle natural contact shadow.",
  },
  5: {
    hex: "#0F0F10",
    sentence: "BACKGROUND: Seamless deep black matte studio sweep (#0F0F10). Uniform and clean with restrained soft shadow separation.",
  },
};

export function sanitizePrompt(input: string) {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 2000);
}

export function normalizePose(value: number | undefined): ProductPose {
  if (value === 1 || value === 2) return value;
  return 0;
}

export function normalizeBackground(value: number | undefined): BackgroundStyle {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return 0;
}

export function buildPromptText(input: PromptInput) {
  const productPose = normalizePose(input.productPose ?? PRODUCT_POSE_DEFAULT);
  const backgroundStyle = normalizeBackground(input.backgroundStyle ?? BACKGROUND_STYLE_DEFAULT);
  const customPrompt = sanitizePrompt(input.customPrompt ?? "");
  const posePrompt = POSE_PROMPT_MAP[productPose];
  const backgroundPrompt = BACKGROUND_PROFILE_MAP[backgroundStyle];

  const promptLines = [
    "You are NANOBANANA PRO for jewelry image-to-image retouch.",
    "CRITICAL: Zero deformation. Keep exact jewelry identity and topology from input image.",
    "Allowed: camera angle/layout reposition only. Forbidden: redesign, added/removed stones, geometry changes.",
    "MANDATORY EDIT: Apply requested composition and requested background in this generation. Do not keep original background if it conflicts.",
    posePrompt,
    "FRAMING RULE: Use close framing. Avoid wide shot or distant subject.",
    "CROP RULE: Keep minimal empty margin (about 8-12%) around the product while keeping entire product visible.",
    backgroundPrompt.sentence,
    `MANDATORY BACKGROUND TARGET: final background must be visually close to ${backgroundPrompt.hex} in uniform studio tone.`,
    "LIGHTING: Soft warm studio light, clean specular control, premium e-commerce look.",
    "OUTPUT FORMAT (HARD): 1:1 square image only. Never output landscape or portrait aspect ratio.",
    "OUTPUT: product fully in frame, centered around 75% frame occupancy (acceptable range 72-78%).",
    "QUALITY CHECK: no hallucination, no missing parts, no melted metal, no text/watermark/hands/props.",
  ];

  if (customPrompt) {
    promptLines.push(`STRICT REQUIREMENT (must not violate 1:1 square output): ${customPrompt}`);
  }

  promptLines.push(
    "If any instruction conflicts, prioritize: ZERO DEFORMATION > PRODUCT IDENTITY > 1:1 SQUARE OUTPUT FORMAT > MANDATORY BACKGROUND TARGET > requested style."
  );

  return {
    prompt: promptLines.join("\n"),
    productPose,
    backgroundStyle,
  };
}

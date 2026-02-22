import sharp from "sharp";

type OverlayInput = {
  imageBytes: Uint8Array;
  displayName: string;
  textColor: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function estimateTextWidth(text: string) {
  const normalized = text.trim() || "product";
  const width = normalized.length * 22;
  return Math.max(120, Math.min(width, 1200));
}

async function sampleAverageColor(image: sharp.Sharp) {
  const metadata = await image.metadata();
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (width <= 0 || height <= 0) {
    return { r: 255, g: 255, b: 255 };
  }

  const sampleSize = Math.max(1, Math.min(20, width, height));
  const sampleX = clamp(Math.min(5, width - sampleSize - 5), 0, Math.max(0, width - sampleSize));
  const sampleY = clamp(Math.min(120, height - sampleSize - 5), 0, Math.max(0, height - sampleSize));

  const sample = await image
    .clone()
    .extract({ left: sampleX, top: sampleY, width: sampleSize, height: sampleSize })
    .removeAlpha()
    .raw()
    .toBuffer();

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const pixels = sample.length / 3;
  for (let i = 0; i < sample.length; i += 3) {
    rSum += sample[i];
    gSum += sample[i + 1];
    bSum += sample[i + 2];
  }
  const divisor = Math.max(1, pixels);
  return {
    r: Math.round(rSum / divisor),
    g: Math.round(gSum / divisor),
    b: Math.round(bSum / divisor),
  };
}

export async function addModelNameOverlay(input: OverlayInput) {
  const displayName = (input.displayName || "product").trim() || "product";
  const requestedTextColor = (input.textColor || "black").trim().toLowerCase() || "black";

  const image = sharp(Buffer.from(input.imageBytes));
  const metadata = await image.metadata();
  const imageWidth = Number(metadata.width ?? 0);
  const imageHeight = Number(metadata.height ?? 0);
  if (imageWidth <= 0 || imageHeight <= 0) {
    return input.imageBytes;
  }

  const { r, g, b } = await sampleAverageColor(image);
  const textColor = requestedTextColor === "white" ? "white" : "black";

  const fontSize = 40;
  const textX = clamp(70, 8, Math.max(8, imageWidth - 8));
  const textY = clamp(70, fontSize + 8, Math.max(fontSize + 8, imageHeight - 8));
  const textHeight = 40;
  const padding = 12;
  const textWidth = Math.min(estimateTextWidth(displayName), Math.max(40, imageWidth - 16));

  const rawBoxX = textX - padding;
  const rawBoxY = textY - textHeight - padding + 8;
  const rawBoxWidth = textWidth + padding * 2;
  const rawBoxHeight = textHeight + padding * 2;

  const boxX = clamp(rawBoxX, 0, Math.max(0, imageWidth - 1));
  const boxY = clamp(rawBoxY, 0, Math.max(0, imageHeight - 1));
  const boxWidth = Math.max(1, Math.min(rawBoxWidth, imageWidth - boxX));
  const boxHeight = Math.max(1, Math.min(rawBoxHeight, imageHeight - boxY));

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">
  <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="rgba(${r}, ${g}, ${b}, 1)" />
  <text
    x="${textX}"
    y="${textY}"
    font-family="'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
    font-size="${fontSize}"
    font-weight="500"
    fill="${escapeXml(textColor)}"
  >${escapeXml(displayName)}</text>
</svg>`;

  const overlaid = await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return new Uint8Array(overlaid);
}

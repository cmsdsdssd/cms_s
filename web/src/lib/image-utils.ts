const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function isHeicLike(file: File) {
  const lowerName = file.name.toLowerCase();
  return HEIC_MIME_TYPES.has(file.type) || lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
}

async function normalizeHeicToJpeg(file: File): Promise<File> {
  if (!isHeicLike(file)) return file;

  try {
    const heic2anyModule = await import("heic2any");
    const converted = await heic2anyModule.default({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
    if (!(convertedBlob instanceof Blob)) return file;

    const nextName = file.name.replace(/\.(heic|heif)$/i, "") || file.name;
    return new File([convertedBlob], `${nextName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function compressImage(file: File, targetSizeKB = 300): Promise<File> {
    const normalizedFile = await normalizeHeicToJpeg(file);

    // If file is already small enough, return original
    if (normalizedFile.size <= targetSizeKB * 1024) {
        return normalizedFile;
    }

    const maxWidth = 1440; // Reasonable max width for jewelry catalog
    const maxHeight = 1440;
    const mimeType = "image/webp"; // Use WebP for better compression/quality ratio
    const qualityStep = 0.1;
    let quality = 0.9;

    try {
        const imageBitmap = await createImageBitmap(normalizedFile);

        // Calculate new dimensions
        let width = imageBitmap.width;
        let height = imageBitmap.height;

        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(imageBitmap, 0, 0, width, height);

        // Iteratively reduce quality
        let compressedBlob: Blob | null = null;

        while (quality > 0.1) {
            compressedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(
                    (blob) => resolve(blob),
                    mimeType,
                    quality
                );
            });

            if (compressedBlob && compressedBlob.size <= targetSizeKB * 1024) {
                break;
            }
            quality -= qualityStep;
        }

        if (!compressedBlob) {
            // Fallback to original if something goes wrong
            return normalizedFile;
        }

        // Create new File object
        const newFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: mimeType,
            lastModified: Date.now(),
        });

        console.log(`Compressed: ${normalizedFile.size} -> ${newFile.size} (Quality: ${quality.toFixed(1)})`);
        return newFile;

    } catch (error) {
        console.error("Image compression failed:", error);
        return normalizedFile; // Return original on error
    }
}

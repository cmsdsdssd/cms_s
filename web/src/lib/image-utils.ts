export async function compressImage(file: File, targetSizeKB = 300): Promise<File> {
    // If file is already small enough, return original
    if (file.size <= targetSizeKB * 1024) {
        return file;
    }

    const maxWidth = 1440; // Reasonable max width for jewelry catalog
    const maxHeight = 1440;
    const mimeType = "image/webp"; // Use WebP for better compression/quality ratio
    const qualityStep = 0.1;
    let quality = 0.9;

    try {
        const imageBitmap = await createImageBitmap(file);

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
            return file;
        }

        // Create new File object
        const newFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: mimeType,
            lastModified: Date.now(),
        });

        console.log(`Compressed: ${file.size} -> ${newFile.size} (Quality: ${quality.toFixed(1)})`);
        return newFile;

    } catch (error) {
        console.error("Image compression failed:", error);
        return file; // Return original on error
    }
}

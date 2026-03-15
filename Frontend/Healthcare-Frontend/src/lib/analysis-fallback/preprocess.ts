import type { PreprocessedImage } from '@/lib/analysis/types';

const MAX_SIDE = Number(process.env.NEXT_PUBLIC_ANALYSIS_MAX_SIDE_PX ?? 1800);

export async function preprocessImage(file: File): Promise<PreprocessedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Unable to create an analysis canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const grayscale = new Uint8ClampedArray(width * height);
  const thresholded = new Uint8ClampedArray(width * height);

  for (let index = 0; index < grayscale.length; index += 1) {
    const base = index * 4;
    const value =
      imageData.data[base] * 0.299 +
      imageData.data[base + 1] * 0.587 +
      imageData.data[base + 2] * 0.114;
    grayscale[index] = value;
    thresholded[index] = value < 214 ? 255 : 0;
  }

  bitmap.close();
  return {
    width,
    height,
    imageData,
    grayscale,
    thresholded,
    deskewAngle: 0,
  };
}

export function findNonWhiteBounds(preprocessed: PreprocessedImage) {
  const { width, height, thresholded } = preprocessed;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let darkPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = thresholded[y * width + x];
      if (value === 0) {
        continue;
      }
      darkPixels += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const darkRatio = darkPixels / Math.max(1, width * height);
  return {
    bounds: {
      x: minX === width ? 0 : minX,
      y: minY === height ? 0 : minY,
      width: minX === width ? width : Math.max(1, maxX - minX),
      height: minY === height ? height : Math.max(1, maxY - minY),
    },
    darkRatio,
  };
}

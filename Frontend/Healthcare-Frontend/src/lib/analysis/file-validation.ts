import type { ValidatedUpload } from '@/lib/analysis/types';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function getMaxUploadBytes() {
  const megabytes = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? 15);
  return Number.isFinite(megabytes) ? megabytes * 1024 * 1024 : 15 * 1024 * 1024;
}

export async function validateUploadFile(file: File): Promise<ValidatedUpload> {
  const mimeType = file.type;
  if (!['image/png', 'image/jpeg'].includes(mimeType)) {
    throw new Error('Unsupported file type. Please upload a PNG or JPG image.');
  }

  if (file.size > getMaxUploadBytes()) {
    throw new Error('This image is too large for safe analysis. Please compress it or upload a smaller file.');
  }

  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPng = PNG_SIGNATURE.every((value, index) => signature[index] === value);
  const isJpeg = JPEG_SIGNATURE.every((value, index) => signature[index] === value);

  if (!isPng && !isJpeg) {
    throw new Error('The uploaded file does not look like a valid PNG or JPG image.');
  }

  const bitmap = await createImageBitmap(file);
  const sanitizedFile = await sanitizeUpload(file, bitmap);
  const previewUrl = URL.createObjectURL(sanitizedFile);
  const validated = {
    file: sanitizedFile,
    previewUrl,
    width: bitmap.width,
    height: bitmap.height,
    size: sanitizedFile.size,
    mimeType: sanitizedFile.type,
  };
  bitmap.close();
  return validated;
}

async function sanitizeUpload(file: File, bitmap: ImageBitmap) {
  const targetType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to prepare this image for analysis.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({
      type: targetType,
      quality: targetType === 'image/jpeg' ? 0.95 : undefined,
    });
    return toFile(blob, file.name, file.lastModified);
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare this image for analysis.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error('Unable to prepare this image for analysis.'));
          return;
        }
        resolve(nextBlob);
      },
      targetType,
      targetType === 'image/jpeg' ? 0.95 : undefined,
    );
  });

  return toFile(blob, file.name, file.lastModified);
}

function toFile(blob: Blob, originalName: string, lastModified: number) {
  const extension = blob.type === 'image/jpeg' ? '.jpg' : '.png';
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'floorplan';
  return new File([blob], `${baseName}${extension}`, {
    type: blob.type,
    lastModified,
  });
}

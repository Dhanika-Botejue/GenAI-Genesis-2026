export async function hashFile(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

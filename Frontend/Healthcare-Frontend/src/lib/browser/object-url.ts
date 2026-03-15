export function revokeObjectUrlSafe(url?: string | null) {
  if (!url) {
    return;
  }

  try {
    URL.revokeObjectURL(url);
  } catch {
    // noop
  }
}

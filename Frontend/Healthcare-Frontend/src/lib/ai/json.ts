export function stripMarkdownFences(input: string) {
  return input.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

export function extractJsonPayload(input: string) {
  const stripped = stripMarkdownFences(input).trim();
  const objectStart = stripped.indexOf('{');
  const arrayStart = stripped.indexOf('[');

  let start = -1;
  let openChar = '';
  let closeChar = '';

  if (objectStart === -1 && arrayStart === -1) {
    return stripped;
  }

  if (arrayStart === -1 || (objectStart !== -1 && objectStart < arrayStart)) {
    start = objectStart;
    openChar = '{';
    closeChar = '}';
  } else {
    start = arrayStart;
    openChar = '[';
    closeChar = ']';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < stripped.length; index += 1) {
    const char = stripped[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return stripped.slice(start, index + 1);
      }
    }
  }

  return stripped.slice(start);
}

export function inputPreview(input: Record<string, unknown>, maxLen = 60): string {
  const firstValue = Object.values(input)[0];
  if (firstValue === undefined) return "";
  const str = String(firstValue);
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

export function resultPreview(result: string, maxLen = 80): string {
  const lines = result.split("\n");
  const firstLine = lines[0] ?? "";
  const preview = firstLine.length > maxLen ? firstLine.slice(0, maxLen - 3) + "..." : firstLine;
  return lines.length > 1 ? `${preview} +${lines.length - 1} lines` : preview;
}

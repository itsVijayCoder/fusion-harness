const textEventTypes = new Set([
  "text",
  "message",
  "agent_message",
  "assistant_message",
  "response.output_text.delta",
  "response.output_text.done",
]);

export function extractReadableOutput(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "";

  const fragments: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const parsed = parseJson(line.trim());
    if (parsed !== undefined) collectTextFragments(parsed, fragments);
  }

  const text = fragments.join("");
  return text.trim() ? text.trim() : value;
}

function collectTextFragments(value: unknown, fragments: string[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectTextFragments(item, fragments);
    return;
  }

  const record = value as Record<string, unknown>;
  const part = record.part;
  if (isRecord(part)) {
    const partType = stringValue(part.type);
    const text = stringValue(part.text);
    if (partType === "text" && text) {
      fragments.push(text);
      return;
    }
    collectTextFragments(part, fragments);
  }

  const type = stringValue(record.type);
  const text = stringValue(record.text);
  const delta = stringValue(record.delta);
  const content = stringValue(record.content);

  if (type && textEventTypes.has(type) && text) {
    fragments.push(text);
    return;
  }
  if (type && textEventTypes.has(type) && delta) {
    fragments.push(delta);
    return;
  }
  if (type && textEventTypes.has(type) && content) {
    fragments.push(content);
    return;
  }

  collectTextFragments(record.message, fragments);
  collectTextFragments(record.delta, fragments);
  collectTextFragments(record.content, fragments);
  collectTextFragments(record.data, fragments);
}

function parseJson(value: string) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

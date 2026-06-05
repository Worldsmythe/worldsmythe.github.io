export type ConfigValue = string | ConfigSection;

export interface ConfigSection {
  [key: string]: ConfigValue;
}

export function parseIndented(text: string): ConfigSection {
  const root: ConfigSection = {};
  const stack: { indent: number; node: ConfigSection }[] = [
    { indent: -1, node: root },
  ];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const indent = line.length - line.trimStart().length;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    if (value === "") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = value;
    }
  }
  return root;
}

export function asString(value: ConfigValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function asSection(value: ConfigValue | undefined): ConfigSection {
  return typeof value === "object" && value !== null ? value : {};
}

export function asStringRecord(value: ConfigValue | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(asSection(value))) {
    if (typeof child === "string") out[key] = child;
  }
  return out;
}

export function parseBoolean(value: string | null, defaultValue = false): boolean {
  if (value == null) {
    return defaultValue;
  }
  const normalized = value.toLowerCase();
  if (["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "off", "disabled", "disable"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseIndented(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];
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

export function parseBoolean(value, defaultValue = false) {
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

export function parseList(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

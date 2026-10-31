/** Fills `{name}` placeholders in a line of the chat's words; a placeholder with no value stays as written. */
export function fillWords(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

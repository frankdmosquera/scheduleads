// Shared: the text colour that stays readable on a business's own colour (#rrggbb): white or dark
// ink, whichever contrasts more (WCAG relative luminance). A light brand colour gets dark text, so
// a button never turns unreadable. Used by the customer's page and the emails.

const INK = "#0f172a";
const WHITE = "#ffffff";

const luminance = (hex: string) => {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export function textColorOn(background: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(background)) return WHITE;
  const behind = luminance(background);
  return contrast(behind, luminance(WHITE)) >= contrast(behind, luminance(INK)) ? WHITE : INK;
}

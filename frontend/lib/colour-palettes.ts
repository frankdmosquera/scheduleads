// Frontend: the ready palettes on the Look page (feature 25e): one click fills the three colours,
// nothing is saved until Save. Each one's text reads well on its background.

export type ColourPaletteType = {
  id: "rose" | "forest" | "ocean" | "plum" | "gold" | "blue";
  main: string;
  background: string;
  text: string;
};

export const COLOUR_PALETTES: ColourPaletteType[] = [
  { id: "rose", main: "#b5838d", background: "#fbf6f2", text: "#3a2e39" },
  { id: "forest", main: "#2f6b4f", background: "#f6f8f4", text: "#1d2a22" },
  { id: "ocean", main: "#1f6f8b", background: "#f4f9fb", text: "#12303b" },
  { id: "plum", main: "#6d3b74", background: "#fbf7fc", text: "#2a1830" },
  { id: "gold", main: "#c9a227", background: "#1c1917", text: "#fafaf9" },
  { id: "blue", main: "#1d4ed8", background: "#ffffff", text: "#18181b" },
];

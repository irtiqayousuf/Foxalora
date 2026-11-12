import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

/**
 * Brand ramp (10 = darkest, 160 = lightest). Fluent generates every
 * brand-related token (buttons, links, focus, selected states) from this.
 * Defaults to Microsoft's Fluent blue — swap values to rebrand.
 */
export const brand: BrandVariants = {
  10: "#061724",
  20: "#082338",
  30: "#0a2e4a",
  40: "#0c3b5e",
  50: "#0e4775",
  60: "#0f548c",
  70: "#115ea3",
  80: "#0f6cbd",
  90: "#2886de",
  100: "#479ef5",
  110: "#62abf5",
  120: "#77b7f7",
  130: "#96c6fa",
  140: "#b4d6fa",
  150: "#cfe4fa",
  160: "#ebf3fc",
};

export const lightTheme: Theme = createLightTheme(brand);

export const darkTheme: Theme = {
  ...createDarkTheme(brand),
  // Lighter brand shades read better on dark backgrounds.
  colorBrandForeground1: brand[110],
  colorBrandForeground2: brand[120],
};

export type ThemeMode = "light" | "dark";

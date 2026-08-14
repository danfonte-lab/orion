import { Platform } from "react-native";

const tintColorLight = "#ff5d38";
const tintColorDark = "#ff5d38";

export const Colors = {
  light: {
    text: "#181210",
    background: "#FDF7EA",
    tint: tintColorLight,
    icon: "#8d665e",
    tabIconDefault: "#8d665e",
    tabIconSelected: "#ff5d38",
    card: "#FFFFFF",
    border: "rgba(255,93,56,0.12)",
  },
  dark: {
    text: "#F6EDE8",
    background: "#171512",
    tint: tintColorDark,
    icon: "#c9a79d",
    tabIconDefault: "#c9a79d",
    tabIconSelected: "#ff5d38",
    card: "#521F28",
    border: "rgba(255,93,56,0.22)",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "DM Sans",
    serif: "Instrument Serif",
    rounded: "Inter",
    mono: "ui-monospace",
  },
  default: {
    sans: "DM Sans",
    serif: "Instrument Serif",
    rounded: "Inter",
    mono: "monospace",
  },
  web: {
    sans: "'DM Sans', sans-serif",
    serif: "'Instrument Serif', serif",
    rounded: "'Inter', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export type ThemeMode = "color" | "rainbow";

export type ThemeBackground =
  | {
      type: "gradient";
      overlayClass: string;
    }
  | {
      type: "image";
      overlayClass: string;
      src: string;
      opacity?: number;
      blurPx?: number;
    }
  | {
      type: "video";
      overlayClass: string;
      src: string;
      opacity?: number;
      blurPx?: number;
    };

export type ThemeName =
  | "retrowave"
  | "adventurer"
  | "floral"
  | "premium";

export type ThemeDefinition = {
  id: ThemeName | "rainbow";
  label: string;
  c1: string;
  c2: string;
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  background: ThemeBackground;
  effects: {
    glitchTitle: boolean;
    scanlines: boolean;
    animatedBackground: boolean;
    coverGlow: boolean;
    organicInputs: boolean;
    glassPanels: boolean;
  };
  shape: {
    panelRadius: string;
    inputRadius: string;
    buttonRadius: string;
  };
};

export const THEME_ORDER: ThemeName[] = [
  "retrowave",
  "adventurer",
  "floral",
  "premium",
];

export const THEMES: Record<ThemeName | "rainbow", ThemeDefinition> = {
  retrowave: {
    id: "retrowave",
    label: "Retrowave",
    c1: "#22d3ee",
    c2: "#f472b6",
    bg: "#090412",
    panel: "#140b1d",
    ink: "#f5f3ff",
    muted: "#a78fbf",
    background: {
      type: "gradient",
      overlayClass: "theme-bg-retrowave",
    },
    effects: {
      glitchTitle: true,
      scanlines: true,
      animatedBackground: true,
      coverGlow: true,
      organicInputs: false,
      glassPanels: true,
    },
    shape: {
      panelRadius: "24px",
      inputRadius: "16px",
      buttonRadius: "16px",
    },
  },

  adventurer: {
    id: "adventurer",
    label: "Aventurier",
    c1: "#84cc16",
    c2: "#d4a373",
    bg: "#0f1510",
    panel: "#18211a",
    ink: "#f7f2e8",
    muted: "#b8b19b",
    background: {
      type: "image",
      overlayClass: "theme-bg-adventurer",
      src: "/themes/fatih-emir-bg-design.gif",
      opacity: 0.42,
      blurPx: 0,
    },
    effects: {
      glitchTitle: false,
      scanlines: false,
      animatedBackground: true,
      coverGlow: false,
      organicInputs: true,
      glassPanels: true,
    },
    shape: {
      panelRadius: "30px",
      inputRadius: "999px",
      buttonRadius: "999px",
    },
  },

  floral: {
    id: "floral",
    label: "Floral Dream",
    c1: "#f9a8d4",
    c2: "#86efac",
    bg: "#140f16",
    panel: "#201823",
    ink: "#fff7fb",
    muted: "#d6b8ca",
    background: {
      type: "image",
      overlayClass: "theme-bg-floral",
      src: "/themes/floral3.png",
      opacity: 0.30,
      blurPx: 0.5,
    },
    effects: {
      glitchTitle: false,
      scanlines: false,
      animatedBackground: true,
      coverGlow: true,
      organicInputs: true,
      glassPanels: true,
    },
    shape: {
      panelRadius: "30px",
      inputRadius: "22px",
      buttonRadius: "22px",
    },
  },

  premium: {
    id: "premium",
    label: "Dark Room",
    c1: "#d1d5db",
    c2: "#6b7280",
    bg: "#020202",
    panel: "#0a0a0a",
    ink: "#f3f4f6",
    muted: "#8a8f98",
    background: {
      type: "gradient",
      overlayClass: "theme-bg-premium",
    },
    effects: {
      glitchTitle: false,
      scanlines: false,
      animatedBackground: false,
      coverGlow: false,
      organicInputs: false,
      glassPanels: false,
    },
    shape: {
      panelRadius: "20px",
      inputRadius: "14px",
      buttonRadius: "14px",
    },
  },

  rainbow: {
    id: "rainbow",
    label: "Rainbow",
    c1: "#22d3ee",
    c2: "#f472b6",
    bg: "#0b1220",
    panel: "#111827",
    ink: "#ffffff",
    muted: "#94a3b8",
    background: {
      type: "gradient",
      overlayClass: "theme-bg-rainbow",
    },
    effects: {
      glitchTitle: false,
      scanlines: false,
      animatedBackground: true,
      coverGlow: true,
      organicInputs: false,
      glassPanels: true,
    },
    shape: {
      panelRadius: "24px",
      inputRadius: "18px",
      buttonRadius: "18px",
    },
  },
};

export const THEMES_SWATCH: Record<ThemeName, { c1: string; c2: string; label: string }> = {
  retrowave: {
    c1: THEMES.retrowave.c1,
    c2: THEMES.retrowave.c2,
    label: THEMES.retrowave.label,
  },
  adventurer: {
    c1: THEMES.adventurer.c1,
    c2: THEMES.adventurer.c2,
    label: THEMES.adventurer.label,
  },
  floral: {
    c1: THEMES.floral.c1,
    c2: THEMES.floral.c2,
    label: THEMES.floral.label,
  },
  premium: {
    c1: THEMES.premium.c1,
    c2: THEMES.premium.c2,
    label: THEMES.premium.label,
  },
};

export function isThemeName(value: string): value is ThemeName {
  return value === "retrowave" ||
    value === "adventurer" ||
    value === "floral" ||
    value === "premium";
}
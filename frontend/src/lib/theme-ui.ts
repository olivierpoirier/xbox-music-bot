import type { ThemeName } from "./themes";

type ThemeUiOptions = {
  theme: ThemeName;
  rainbow?: boolean;
};

export function getThemeUi({ theme, rainbow = false }: ThemeUiOptions) {
  const isRainbow = rainbow;
  const isAdventurer = !rainbow && theme === "adventurer";
  const isFloral = !rainbow && theme === "floral";
  const isPremium = !rainbow && theme === "premium";
  const isRetrowave = !rainbow && theme === "retrowave";

  return {
    isRainbow,
    isAdventurer,
    isFloral,
    isPremium,
    isRetrowave,

    panelClass: isAdventurer
      ? "organic-panel border-[#d5c5a1]/15"
      : "rounded-xl bg-bg/80 backdrop-blur-xl border-slate-800",

    softPanelClass: isAdventurer
      ? "organic-panel-soft border-[#d5c5a1]/15"
      : "rounded-xl bg-panel border-slate-700",

    cardClass: isAdventurer
      ? "organic-panel"
      : "rounded-xl bg-bg/80 backdrop-blur-xl",

    itemMutedClass: isAdventurer ? "text-[#d8d0bb]/65" : "text-muted",

    emptyStateClass: isAdventurer
      ? "text-[#d8d0bb]/60 border-[#d5c5a1]/15"
      : "text-muted border-slate-700/60",

    iconAccentClass: isAdventurer ? "text-[#d8d0bb]/80" : "text-[var(--c1)]",

    shellBarClass: isAdventurer
      ? "bg-[rgba(18,24,18,0.88)] border-t border-[#d5c5a1]/10"
      : isFloral
      ? "bg-[rgba(26,18,28,0.88)] border-t border-white/10"
      : "bg-[rgba(7,9,12,0.88)] border-t border-white/10",

    rainbowClass: isRainbow ? "rainbow-cycle" : "",
  };
}

export function getSpectrumColors(rainbow = false) {
  return {
    colorFrom: rainbow ? "#22d3ee" : "var(--c1)",
    colorTo: rainbow ? "#f472b6" : "var(--c2)",
  };
}
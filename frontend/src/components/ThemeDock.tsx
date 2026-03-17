import { useMemo, useState } from "react";
import { Rainbow } from "lucide-react";
import {
  type ThemeName,
  THEME_ORDER,
  THEMES_SWATCH,
  type ThemeMode,
} from "../lib/themes";

interface Props {
  value: ThemeName;
  mode: ThemeMode;
  onPick: (mode: ThemeMode, t?: ThemeName) => void;
}

export default function ThemeDock({ value, mode, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const current = useMemo(() => THEMES_SWATCH[value], [value]);
  const isRainbow = mode === "rainbow";

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 hidden md:block">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-10 h-20 rounded-full border border-slate-800 shadow-xl overflow-hidden bg-slate-900/60 backdrop-blur-md ${
            isRainbow ? "rainbow-cycle" : ""
          }`}
          title="Choisir le style"
          aria-expanded={open}
          type="button"
        >
          <div
            className={`w-full h-full ${isRainbow ? "rainbow-cycle" : ""}`}
            style={{
              background: isRainbow
                ? "conic-gradient(from 0deg, #22d3ee, #a78bfa, #f472b6, #22d3ee)"
                : `linear-gradient(180deg, ${current.c1}, ${current.c2})`,
            }}
          />
        </button>

        {open && (
          <div className={`absolute right-12 top-1/2 -translate-y-1/2 bg-[rgba(17,24,39,0.95)] border border-slate-800 rounded-2xl p-3 w-72 shadow-2xl backdrop-blur-md ${
            isRainbow ? "rainbow-cycle" : ""
          }`}>
            <div className="text-xs text-muted mb-2">Style</div>

            <button
              onClick={() => onPick("rainbow")}
              className={`w-full px-3 py-2 rounded-xl border ${
                isRainbow
                  ? "bg-pink-600 text-white border-pink-400"
                  : "bg-slate-800 text-white border-slate-700"
              } flex items-center justify-center gap-2 ${isRainbow ? "rainbow-cycle" : ""}`}
              title="Activer le style arc-en-ciel"
              aria-pressed={isRainbow}
              type="button"
            >
              <Rainbow className="w-4 h-4" />
              Rainbow
            </button>

            <div className="my-3 h-px bg-slate-800" />

            <div className="text-xs text-muted mb-2">Couleurs</div>

            <div className="grid grid-cols-2 gap-2">
              {THEME_ORDER.map((t) => {
                const s = THEMES_SWATCH[t];
                const selected = !isRainbow && t === value;

                return (
                  <button
                    key={t}
                    onClick={() => onPick("color", t)}
                    className={`rounded-xl p-2 border text-left transition ${
                      selected
                        ? "border-white bg-white/5"
                        : "border-slate-700 hover:bg-white/5"
                    } ${isRainbow ? "rainbow-cycle" : ""}`}
                    title={s.label}
                    aria-pressed={selected}
                    type="button"
                  >
                    <div
                      className={`rounded-lg h-8 mb-2 ${isRainbow ? "rainbow-cycle" : ""}`}
                      style={{
                        background: `linear-gradient(90deg, ${s.c1}, ${s.c2})`,
                      }}
                    />
                    <div className="text-[11px] text-white/80">{s.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
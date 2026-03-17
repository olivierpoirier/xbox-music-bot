import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { ThemeName } from "../../lib/themes";

type Props = {
  children: ReactNode;
  theme: ThemeName;
  rainbow?: boolean;
  className?: string;
  soft?: boolean;
  noBorder?: boolean;
};

export default function ThemedPanel({
  children,
  theme,
  rainbow = false,
  className = "",
  soft = false,
  noBorder = false,
}: Props) {
  const isAdventurer = !rainbow && theme === "adventurer";

  return (
    <div
      className={cn(
        !noBorder && "border",
        soft
          ? isAdventurer
            ? "organic-panel-soft border-[#d5c5a1]/15"
            : "rounded-xl bg-panel border-slate-700"
          : isAdventurer
          ? "organic-panel border-[#d5c5a1]/15"
          : "rounded-xl bg-bg/80 backdrop-blur-xl border-slate-800",
        rainbow && "rainbow-cycle",
        className
      )}
    >
      {children}
    </div>
  );
}
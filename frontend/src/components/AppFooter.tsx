import { cn } from "../lib/cn";

type Props = {
  rainbow?: boolean;
};

export default function AppFooter({ rainbow = false }: Props) {
  return (
    <footer
      className={cn(
        "mt-10 pt-6 border-t border-white/8",
        rainbow && "rainbow-cycle"
      )}
    >
      <div className="rounded-[24px] border border-white/8 bg-white/5 backdrop-blur-xl px-5 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <div className="text-white/80 font-medium">XMB Music Bot</div>

          <div className="text-center text-white/45 text-xs md:text-sm">
            Interface créée par Olivier Poirier · 2025
          </div>

          <div className="text-white/35 text-xs uppercase tracking-[0.2em]">
            Web · Local Player
          </div>
        </div>
      </div>
    </footer>
  );
}
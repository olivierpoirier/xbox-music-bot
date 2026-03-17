import { THEMES, type ThemeName } from "../lib/themes";
import FloralPetalField from "./FloralPetalField";

type Props = {
  theme: ThemeName;
  rainbow?: boolean;
  coverUrl?: string | null;
};

export default function ThemeScene({ theme, rainbow = false, coverUrl }: Props) {
  const active = rainbow ? THEMES.rainbow : THEMES[theme];
  const bg = active.background;

  return (
    <div className={`fixed inset-0 overflow-hidden ${rainbow ? "rainbow-cycle-slow" : ""}`}>
      <div className={`absolute inset-0 ${bg.overlayClass} ${rainbow ? "rainbow-cycle-slow" : ""}`} />

      {bg.type === "image" && (
        <img
          src={bg.src}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover object-center theme-bg-media pointer-events-none ${
            rainbow ? "rainbow-cycle-slow" : ""
          }`}
          style={{
            opacity: bg.opacity ?? 0.2,
            filter: `blur(${bg.blurPx ?? 0}px)`,
          }}
        />
      )}

      {bg.type === "video" && (
        <video
          className={`absolute inset-0 w-full h-full object-cover theme-bg-media pointer-events-none ${
            rainbow ? "rainbow-cycle-slow" : ""
          }`}
          autoPlay
          muted
          loop
          playsInline
          style={{
            opacity: bg.opacity ?? 0.2,
            filter: `blur(${bg.blurPx ?? 0}px)`,
          }}
        >
          <source src={bg.src} />
        </video>
      )}

      {!rainbow && theme === "retrowave" && (
        <>
          <div className="retro-sun pointer-events-none" />
          <div className="retro-grid pointer-events-none" />
          <div className="retro-noise pointer-events-none" />
        </>
      )}

      {!rainbow && theme === "floral" && (
        <>
          <div className="petal-overlay pointer-events-none" />
          <FloralPetalField />
        </>
      )}

      {!rainbow && theme === "adventurer" && (
        <>
          <div className="forest-mist pointer-events-none" />
          <div className="leaf-particles pointer-events-none" />
        </>
      )}

      {!rainbow && theme === "premium" && coverUrl && (
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-110 bg-center bg-cover pointer-events-none"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}

      <div className={`absolute inset-0 bg-black/38 pointer-events-none ${rainbow ? "rainbow-cycle-slow" : ""}`} />
    </div>
  );
}
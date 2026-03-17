import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  bars?: number;
  playing: boolean;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export default function SpectrumBars({
  bars = 62,
  playing,
  colorFrom = "var(--c1)",
  colorTo = "var(--c2)",
  className = "",
}: Props) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<Float32Array | null>(null);

  if (!lastRef.current || lastRef.current.length !== bars) {
    lastRef.current = new Float32Array(bars).fill(0.1);
  }

  useEffect(() => {
    const loop = () => {
      const minCheck = 0.08;
      const isSilent = !playing && lastRef.current!.every((h) => h < minCheck);

      if (isSilent) {
        rafRef.current = null;
        return;
      }

      setTick((n) => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    if (playing || lastRef.current!.some((h) => h > 0.06)) {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  const phases = useMemo(() => {
    const tau = Math.PI * 2;
    const arr: Array<[number, number, number, number]> = [];

    for (let i = 0; i < bars; i++) {
      const rnd = mulberry32(0x9e3779b9 ^ i);
      arr.push([rnd() * tau, rnd() * tau, rnd() * tau, rnd()]);
    }

    return arr;
  }, [bars]);

  const heights = useMemo(() => {
    const t = tick / (playing ? 14 : 24);
    const prelim = new Array<number>(bars);

    for (let i = 0; i < bars; i++) {
      const [p1, p2, p3, s] = phases[i];

      const w1 = 1.1 + 0.07 * s;
      const w2 = 0.55 + 0.33 * s;
      const w3 = 0.78 + 0.12 * s;

      const v1 = Math.sin(t * w1 + p1);
      const v2 = Math.sin(t * w2 + p2);
      const v3 = Math.sin(t * w3 + p3);
      const lane = Math.sin(t * 0.35 + i * (0.22 + 0.03 * s));

      let v = 0.34 + 0.23 * v1 + 0.19 * v2 + 0.15 * v3 + 0.07 * lane;
      v = 0.5 + 0.5 * v;

      const bassBias = 1 - i / Math.max(1, bars - 1);
      v *= 0.86 + 0.18 * bassBias;

      prelim[i] = v;
    }

    const avg = prelim.reduce((a, b) => a + b, 0) / Math.max(1, bars);
    const over = Math.max(0, avg - 0.62);
    const comp = 0.65 * over;

    const min = 0.06;
    const max = 0.9;
    const rise = playing ? 0.55 : 0.35;
    const fall = 0.25;

    const out = new Array<number>(bars);

    for (let i = 0; i < bars; i++) {
      let target = prelim[i] - comp;
      target = clamp(target, min, max);

      if (!playing) target *= 0.25;

      const prev = lastRef.current![i];
      const a = target > prev ? rise : fall;
      const next = prev + (target - prev) * a;

      out[i] = next;
      lastRef.current![i] = next;
    }

    return out;
  }, [tick, bars, playing, phases]);

  return (
    <div className={`flex items-end gap-[3px] h-full w-full ${className}`}>
      {heights.map((h, i) => {
        const progress = bars <= 1 ? 0 : i / (bars - 1);
        const background = `color-mix(in oklab, ${colorFrom} ${Math.round(
          (1 - progress) * 100
        )}%, ${colorTo} ${Math.round(progress * 100)}%)`;

        return (
          <div
            key={i}
            className="flex-1 h-full rounded-sm will-change-transform origin-bottom transition-transform duration-100 ease-linear"
            style={{
              transform: `translateZ(0) scaleY(${h})`,
              background,
              boxShadow: `0 0 3px ${background}`,
            }}
          />
        );
      })}
    </div>
  );
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
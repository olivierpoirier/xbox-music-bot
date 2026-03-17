import { useMemo } from "react";

type FloralPetalFieldProps = {
  enabled?: boolean;
};

type PetalSprite = {
  id: string;
  src: string;
  kind: "petal" | "flower";
};

type FallingPetal = {
  id: string;
  sprite: string;
  kind: "petal" | "flower";
  left: number;
  topOffset: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  swayDuration: number;
  rotateFrom: number;
  rotateTo: number;
  opacity: number;
  scale: number;
};

const SPRITES: PetalSprite[] = [
  { id: "petal-a", src: "/themes/floral/petal1.png", kind: "petal" },
  { id: "petal-b", src: "/themes/floral/petal2.png", kind: "petal" },
  { id: "petal-c", src: "/themes/floral/petal3.png", kind: "petal" },
  { id: "petal-d", src: "/themes/floral/petal4.png", kind: "petal" },
  { id: "leaf-a", src: "/themes/floral/leaf1.png", kind: "petal" },
  { id: "flower-a", src: "/themes/floral/flower1.png", kind: "flower" },
  { id: "flower-b", src: "/themes/floral/flower2.png", kind: "flower" },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickSprite() {
  return SPRITES[Math.floor(Math.random() * SPRITES.length)];
}

function makeFallingPetal(index: number): FallingPetal {
  const sprite = pickSprite();
  const isFlower = sprite.kind === "flower";

  return {
    id: `fall-${index}-${Math.random().toString(36).slice(2, 9)}`,
    sprite: sprite.src,
    kind: sprite.kind,
    left: rand(0, 100),
    topOffset: rand(-30, 0),
    size: isFlower ? rand(24, 44) : rand(16, 30),
    duration: rand(12, 22),
    delay: rand(-20, 0),
    drift: rand(-90, 90),
    swayDuration: rand(3.5, 7),
    rotateFrom: rand(-30, 25),
    rotateTo: rand(180, 420),
    opacity: isFlower ? rand(0.28, 0.5) : rand(0.35, 0.7),
    scale: rand(0.85, 1.2),
  };
}

export default function FloralPetalField({
  enabled = true,
}: FloralPetalFieldProps) {
  const petals = useMemo(
    () => Array.from({ length: 18 }, (_, i) => makeFallingPetal(i)),
    []
  );

  if (!enabled) return null;

  return (
    <div
      className="floral-petal-field"
      aria-hidden="true"
    >
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="floral-petal-lane"
          style={
            {
              left: `${petal.left}%`,
              top: `${petal.topOffset}%`,
              animationDuration: `${petal.duration}s`,
              animationDelay: `${petal.delay}s`,
              ["--drift-x" as string]: `${petal.drift}px`,
            } as React.CSSProperties
          }
        >
          <div
            className="floral-petal-sway"
            style={{
              animationDuration: `${petal.swayDuration}s`,
            }}
          >
            <img
              src={petal.sprite}
              alt=""
              className={`floral-petal-sprite ${
                petal.kind === "flower" ? "is-flower" : "is-petal"
              }`}
              draggable={false}
              style={
                {
                  width: `${petal.size}px`,
                  height: `${petal.size}px`,
                  opacity: petal.opacity,
                  transform: `rotate(${petal.rotateFrom}deg) scale(${petal.scale})`,
                  ["--rot-from" as string]: `${petal.rotateFrom}deg`,
                  ["--rot-to" as string]: `${petal.rotateTo}deg`,
                  ["--petal-scale" as string]: `${petal.scale}`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
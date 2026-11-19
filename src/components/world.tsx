import type { CSSProperties } from "react";

const floaters = [
  [6, 13, 14, -7], [18, 31, 23, -17], [31, 22, 27, -13],
  [53, 37, 21, -14], [68, 29, 27, -22], [82, 15, 17, -2],
  [94, 36, 25, -11], [24, 67, 19, -8], [54, 64, 28, -19], [74, 62, 24, -3],
];

export function World({ scene }: { scene: number }) {
  return (
    <div className={`world world-${scene}`} aria-hidden="true">
      <picture className="world-plate">
        <source media="(max-aspect-ratio: 4/5)" srcSet={`/art/world/scene-${scene}-portrait.webp`} />
        <img src={`/art/world/scene-${scene}.webp`} alt="" fetchPriority="high" draggable="false" />
      </picture>
      <div className="world-haze"><div /> <div /></div>
      <div className="world-sunwash" />
      <img className="world-canopy" src={`/art/world/canopy-${scene}.webp`} alt="" />
      <div className="world-water world-water-one" /><div className="world-water world-water-two" />
      <div className="world-mist world-mist-far" /><div className="world-mist world-mist-near" />
      <span className="world-lantern"><img src="/art/world/lantern.webp" alt="" /></span>
      {scene === 0 && <span className="world-bell"><img src="/art/entrance-bell.webp" alt="" /></span>}
      <div className="world-floaters">
        {floaters.map(([x, y, duration, delay], index) => <i key={index} className={index % 3 ? "world-petal" : "world-mote"}
          style={{ "--x": `${x}%`, "--y": `${y}%`, "--d": `${duration}s`, "--delay": `${delay}s` } as CSSProperties} />)}
      </div>
      <div className="world-veil" />
    </div>
  );
}

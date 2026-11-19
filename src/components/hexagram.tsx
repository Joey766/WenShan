import { lineNames, linePositions, type Polarity, type LineValue } from "@/lib/yijing";

export function LineMark({ yang, moving = false }: { yang: Polarity; moving?: boolean }) {
  return <span className={`line-mark ${yang ? "line-yang" : "line-yin"} ${moving ? "line-moving" : ""}`} aria-hidden="true"><i /><i /></span>;
}

export function HexagramGlyph({ lines, moving = [] }: { lines: readonly Polarity[]; moving?: readonly number[] }) {
  return <span className="hexagram-glyph" aria-hidden="true">
    {lines.map((_, i) => lines.length - 1 - i).map(i => <LineMark key={i} yang={lines[i]} moving={moving.includes(i)} />)}
  </span>;
}

export function LineBoard({ lines }: { lines: readonly { yang: Polarity; moving: boolean; value: LineValue }[] }) {
  return <ol className="line-board" aria-label="六爻进度，由下至上">
    {linePositions.map((label, i) => {
      const line = lines[i];
      return <li className={line ? "filled-line" : "empty-line"} key={label}>
        <span>{label}爻</span>
        {line ? <LineMark yang={line.yang} moving={line.moving} /> : <i className="line-placeholder" />}
        <b>{line ? lineNames[line.value] : "待起"}</b>
      </li>;
    })}
  </ol>;
}

import { readingEvidence } from "./knowledge.ts";
import type { ProfileContext } from "./profile.ts";
import { fortuneSubject, questionTopic } from "./question-context.ts";
import { getReading, type Coins, type Reading } from "./yijing.ts";

export type ReadingDetails = { theme: string; phrases: string[]; lines: string[]; relating: string };
export type Verdict = "偏吉" | "中平" | "偏慎";
export type Fortune = { verdict: Verdict; directAnswer: string; hexagramBasis: string; closing: string };
export type ReadingNotice = "cloud-consent" | "cloud-quota" | "cloud-account-quota" | "cloud-sign-in" | "cloud-unavailable";
export type ReadingAnswer = { mode: "local" | "cloud" | "demo"; text: string; fortune?: Fortune; fallbackSections?: number; notice?: ReadingNotice };
export type Message = { role: "user"; content: string } |
  { role: "assistant"; content: string; mode: ReadingAnswer["mode"]; details?: ReadingDetails; fallbackSections?: number };
export type ReadingRequest = { question: string; coins: Coins[]; profile?: ProfileContext; cloudConsent?: boolean };
export type ReadingPhase = "identifying" | "checking" | "connecting" | "explaining";
export type ReadingEvent = { phase: ReadingPhase } | { delta: string } | { answer: ReadingAnswer };

export function judgementPhrases(judgement: string) {
  const text = judgement.replace(/^[^：]{1,9}：/u, "");
  return (text.match(/[^。；！？]+[。；！？]?/gu) ?? [text]).map(part => part.trim()).filter(Boolean);
}

const staticGlosses: Record<number, string[]> = {
  1: ["指开端有创造与推进的力量，具备走得通的条件。", "事情能否长久，取决于能否守住合宜的原则。"],
  2: ["形容顺势而行也能通达，像母马一样柔顺而耐久。", "有事要做时，独自抢先容易失了方向，顺势寻得依循才有进展。", "古文以不同方位象征助力得失，要辨认哪些人能同行。", "安定下来，守住应守的事。"],
};
const authoredLines: Record<number, string[]> = {
  1: [
    "龙还潜在水里。条件未成熟时，宜积蓄能力，暂缓把自己推到前面。",
    "龙来到田野，力量开始被看见。这是借助有经验的人和外界反馈的时机。",
    "白天勤勉，傍晚仍检点风险。持续努力要配合检查，才能避开因疏忽而来的麻烦。",
    "龙可以试着跃起，也可以留在深处。看清条件后试探性行动，允许自己适时退回。",
    "龙飞到天上，象征能力有了充分施展的位置。即便在有利处境，也要与合适的人合作。",
    "龙飞得过高，几乎没有余地。力量越大，越该知道什么时候收住。",
  ],
  2: [
    "踩到薄霜，便可想到严寒将至。迹象尚小时先观察、预备，不必等问题积重。",
    "端正、坦荡而有尺度。基础做法扎实，就能少依赖刻意的技巧。",
    "才华可以藏在做好事情之中。即使跟随别人办事、不独占成果，也要把事收好尾。",
    "像把袋口扎紧，用谨慎的言行守住边界。这时平稳，比急于得到赞扬重要。",
    "黄色的下衣有居中而谦退的寓意。承当其位而不过分显露，容易维持平衡。",
    "龙在郊野相斗，以流血收场。两股力量一直硬碰硬，会使本可缓和的问题走向冲突。",
  ],
};

export function preparedDetails(reading: Reading): ReadingDetails | undefined {
  const { original, relating, moving } = readingEvidence(reading);
  const phrases = staticGlosses[original.number];
  const lines = authoredLines[original.number];
  if (!phrases || !lines || phrases.length !== judgementPhrases(original.classical.judgement).length) return undefined;
  return {
    theme: original.commentary.plain, phrases, lines: moving.map(line => lines[line.position - 1]),
    relating: moving.length ? relating.commentary.plain : "六爻皆静，沿用本卦的观察主题。",
  };
}

function plain(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 3 && value.length <= max &&
    !/《|》|【原文】|[「『][^」』]{3,}[」』]|(?:必定|一定|肯定|百分百|注定)(?:能|会|通过|及格|成功)|(?:概率|把握|机会)\s*(?:为|是|约|达|大概有)?\s*\d{1,3}(?:\.\d+)?\s*[%％]|\d{1,3}(?:\.\d+)?\s*[%％]的(?:概率|把握|机会)|约\s*\d+\s*字|填写字段|回复模板/u.test(value);
}

export function parseDetails(data: unknown): ReadingDetails | undefined {
  if (!data || typeof data !== "object") return undefined;
  const parts = data as Partial<ReadingDetails>;
  if (!plain(parts.theme, 110) || !plain(parts.relating, 125) ||
      !Array.isArray(parts.phrases) || parts.phrases.length > 12 || !parts.phrases.every(x => plain(x, 86)) ||
      !Array.isArray(parts.lines) || parts.lines.length > 6 || !parts.lines.every(x => plain(x, 96))) return undefined;
  return { theme: parts.theme, phrases: parts.phrases, lines: parts.lines, relating: parts.relating };
}



// This is the product's editorial reading convention. It makes the direction
// reproducible without asking a language model to decide what the cast was.
function omen(text: string) {
  const body = text.replace(/^(?:[^：:]{1,10})[：:]/u, "");
  const weighted = body.replace(/凶[，,]?終吉|凶[，,]?终吉/gu, "終吉").replace(/(?:无|無)不利/gu, "大吉");
  const hard = /大凶|有凶|貞凶|贞凶|征凶|終凶|终凶|凶|不利|無攸利|无攸利|泣血|焚如|死如/u.test(weighted);
  const repeatedDanger = /(?:^|[：:])\s*(?:習|习)坎/u.test(text);
  const careful = repeatedDanger || /厲|厉|吝|勿用|不可/u.test(weighted);
  // 維心亨 speaks to inward steadiness in repeated danger.
  const bright = /吉|亨|利貞|利贞|利見|利见|有攸往/u.test(weighted.replace(/不利|無攸利|无攸利|維心亨|惟心亨|维心亨/gu, ""));
  if (hard && bright) return -1;
  if (hard) return -2;
  if (careful) return bright ? 0 : -1;
  if (bright) return 1;
  return 0;
}

export function fortuneEvidence(reading: Reading) {
  const { original, relating, moving, specialText } = readingEvidence(reading);
  const from = omen(original.classical.judgement);
  const to = moving.length ? omen(relating.classical.judgement) : 0;
  const changed = specialText ? [omen(specialText)] : moving.map(line => omen(line.text));
  const active = changed.reduce((sum, value) => sum + value, 0) / Math.max(1, changed.length);
  const score = changed.length ? active * 2 + from * .7 + to * .5 : from;
  const verdict: Verdict = score >= .8 ? "偏吉" : score <= -.8 ? "偏慎" : "中平";
  const fromTheme = original.commentary.keywords[0];
  const toTheme = relating.commentary.keywords[0];
  const changes = changed.some(n => n > 0) && changed.some(n => n < 0) ? "顺阻同现" :
    active > 0 ? "有逐渐转顺的迹象" : active < 0 ? "有阻滞反复的迹象" : "有变化，趋势尚未坐实";
  const positions = moving.map(line => line.label).join("、");
  const motion = specialText ? "六爻皆动，参看" + (original.number === 1 ? "用九" : "用六") :
    moving.length ? positions + "动，" + changes : "六爻皆静，变卦与本卦相同";
  const note = original.commentary.plain.match(/^[^。！？；]+/u)?.[0];
  const beginning = note && note.length <= 50 ? "，" + note : "取象于" + fromTheme;
  const basis = "本卦「" + original.name + "」" + beginning + "。" + motion +
    (moving.length ? "，转为「" + relating.name + "」，后势带着" + toTheme + "的意味。" : "，卦意延续。");
  return { original, relating, moving, specialText, verdict, basis, fromTheme, toTheme };
}

export function fortuneFromCast(input: ReadingRequest, reading: Reading): Fortune {
  const { verdict, basis } = fortuneEvidence(reading);
  const { heading, omenSubject, scene } = fortuneSubject(input.question);
  if (questionTopic(input.question) === "lottery") {
    const buying = /适合|适不适合|要不要|该不该|该买|该去买|能不能买|能买|宜不宜|值得|不值得|可以买|可不可以买/u.test(input.question);
    const direction = verdict === "偏吉" ? "卦里有喜意，中奖仍是随机的。" : verdict === "中平" ? "卦里没有明显的中奖兆头。" :
      buying ? "按这卦的象意，眼下不宜买彩票碰运气。" : "中奖的兆头偏弱，卦里多见阻滞。";
    const closing = verdict === "偏吉" ? "云边稍亮，有一丝喜气，彩票结果仍由随机开奖决定。" :
      verdict === "中平" ? "云来云去，这一卦平平，彩运未显。" : "云气还没散开，彩运的光亮还淡，这一卦没有显出碰运气的好兆头。";
    return { verdict, directAnswer: heading + verdict + "，" + direction, hexagramBasis: basis, closing };
  }
  const direction = verdict === "偏吉" ? "有" + omenSubject + "的好兆头。" :
    verdict === "偏慎" ? omenSubject + "的兆头还弱，卦里多见阻碍。" : omenSubject + "的兆头尚未明朗。";
  const closing = verdict === "偏吉" ? scene + "这一线光透进来了，是个值得期待的卦。" :
    verdict === "偏慎" ? scene + "云气稍重，好兆头还藏在后面。" : scene + "风尚未定向，这一卦读来平稳，仍有变化。";
  return { verdict, directAnswer: heading + verdict + "，" + direction, hexagramBasis: basis, closing };
}

export function fortuneText(fortune: Fortune) {
  return fortune.directAnswer + "\n\n卦象依据\n" + fortune.hexagramBasis + "\n\n大白话\n" + fortune.closing;
}

export function demoReading(input: ReadingRequest, reading: Reading = getReading(input.coins)): ReadingAnswer {
  const fortune = fortuneFromCast(input, reading);
  return { mode: "demo", fortune, text: fortuneText(fortune) };
}

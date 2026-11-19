
const yang = [2, 2, 3];
const yin = [2, 3, 3];
const movingYang = [3, 3, 3];
const bright = [yang, yang, yang, yang, yang, yang];
const cautious = [yin, yin, yin, yang, yang, yang];
const football = "我今天踢球能进球吗？";
const lottery = "我今天彩票能中奖吗？";

export const oracleCases = [
  { label: "足球 · 离之艮", question: football, coins: [movingYang, yin, yang, movingYang, yin, yang], verdict: "偏慎", names: ["离","艮"], positions: [1,4], first: "球运", aim: "进球" },
  { label: "考试 · 乾", question: "我这次考试能过吗？", coins: bright, verdict: "偏吉", names: ["乾","乾"], positions: [], first: "考运", aim: "过关" },
  { label: "今日运气 · 屯", question: "我今天运气好吗？", coins: [yang, yin, yin, yin, yang, yin], verdict: "中平", names: ["屯","屯"], positions: [], first: "今日运势", aim: "顺心" },
  { label: "感情音讯 · 咸", question: "我喜欢的人会联系我吗？", coins: [yin, yin, yang, yang, yang, yin], verdict: "偏吉", names: ["咸","咸"], positions: [], first: "音讯", aim: "音讯" },
  { label: "求职 · 否", question: "我最近找工作顺利吗？", coins: cautious, verdict: "偏慎", names: ["否","否"], positions: [], first: "求职运", aim: "顺遂" },
  { label: "相同足球问题 · 乾", question: football, coins: bright, verdict: "偏吉", names: ["乾","乾"], positions: [], first: "球运", aim: "进球" },
  { label: "彩票中奖 · 否", question: lottery, coins: cautious, verdict: "偏慎", names: ["否","否"], positions: [], first: "彩运", aim: "中奖" },
  { label: "彩票中奖 · 乾", question: lottery, coins: bright, verdict: "偏吉", names: ["乾","乾"], positions: [], first: "彩运", aim: "随机" },
  { label: "彩票适宜性 · 否", question: "我今天适合买彩票吗？", coins: cautious, verdict: "偏慎", names: ["否","否"], positions: [], first: "彩运", aim: "不宜买彩票" },
];


export function questionTopic(text: string) {
  if (/彩票|福彩|体彩|双色球|大乐透|刮刮乐|买彩|彩券|彩票中奖/u.test(text)) return "lottery";
  if (/踢球|足球|篮球|打球|进球|射门|投篮|羽毛球|网球|乒乓球|排球|跑步|马拉松|田径|比赛|上场|守门|球赛|运动/u.test(text)) return "sports";
  if (/考试|考研|雅思|高考|及格|模考|复习|备考|分数|通过率|学业|挂科/u.test(text)) return "exam";
  if (/工作|求职|面试|同事|转岗|离职|项目|职业|团队|升职/u.test(text)) return "work";
  if (/感情|喜欢的人|喜欢我|恋爱|关系|伴侣|朋友|表白|分手|结婚|对象|联系我/u.test(text)) return "relationship";
  if (/财务|理财|财运|投资|股票|基金|消费|预算|买不买|值得买吗|该买吗|存钱|存款|贷款|花钱|收入|收益|债务/u.test(text)) return "money";
  return "general";
}

export function fortuneSubject(question: string) {
  const when = /今天|今日|今儿/u.test(question) ? "今日" : /明天|明日/u.test(question) ? "明日" : "这次";
  const topic = questionTopic(question);
  switch (topic) {
    case "lottery": return { heading: when + "彩运", omenSubject: "中奖", scene: "彩运上，" };
    case "sports": {
      const goal = /进球|破门|射门/u.test(question);
      const ball = goal || /球/u.test(question);
      return { heading: when + (ball ? "球运" : "赛运"), omenSubject: goal ? "进球" : "发挥顺手", scene: ball ? "球场上，" : "赛场上，" };
    }
    case "exam": return { heading: when + "考运", omenSubject: "过关", scene: "这一关，" };
    case "relationship": return { heading: /联系|消息|回应/u.test(question) ? "这次音讯的卦象" : "感情运势", omenSubject: /联系|消息|回应/u.test(question) ? "收到音讯" : "关系转顺", scene: "两人之间，" };
    case "work": return { heading: /求职|找工作|面试/u.test(question) ? "这段求职运" : "这段工作运势", omenSubject: "事情顺遂", scene: "前路上，" };
    case "money": return { heading: "这次财运", omenSubject: "财事顺遂", scene: "这一盘财运，" };
    default: return { heading: when + "运势", omenSubject: "遇见顺心事", scene: "这一路，" };
  }
}

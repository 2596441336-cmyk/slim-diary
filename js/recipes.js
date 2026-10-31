/* 食谱库与每日搭配
   每行：餐段(b早/l午/d晚/s加餐)|类型(home在家做/out外面吃)|名称|搭配|千卡|蛋白质|做法或点单建议 */
(function () {
  const RAW = `
b|home|燕麦牛奶碗|燕麦40克 + 脱脂牛奶250毫升 + 蓝莓50克 + 核桃10克|330|16|燕麦倒进牛奶里，微波炉加热2分钟，再放上蓝莓和掰碎的核桃。
b|home|全麦鸡蛋三明治|全麦面包2片 + 少油煎蛋1个 + 生菜番茄 + 低脂奶酪1片|305|19|平底锅刷一层薄油煎蛋，和生菜、番茄、奶酪一起夹进面包。
b|home|希腊酸奶杯|无糖希腊酸奶150克 + 半根香蕉 + 燕麦脆15克 + 奇亚籽10克|272|18|全部放进杯子里拌一拌，前一晚做好放冰箱也可以。
b|home|小米粥配鸡蛋|小米粥1碗 + 水煮蛋2个 + 凉拌黄瓜|300|17|小米粥可以前一晚用电饭锅预约，早上直接吃。
b|home|红薯鸡蛋牛奶|蒸红薯150克 + 水煮蛋1个 + 脱脂牛奶1杯|286|17|红薯和鸡蛋一起上锅蒸15分钟。
b|home|葱花鸡蛋饼|面粉30克 + 鸡蛋2个 + 葱花 + 油5克|297|16|面粉、鸡蛋加水调成糊，撒葱花，平底锅少油摊成薄饼。
b|home|玉米鸡蛋酸奶|玉米1根 + 水煮蛋1个 + 无糖酸奶1杯|302|16|玉米和鸡蛋一起煮10分钟。
b|home|牛油果鸡蛋吐司|全麦吐司1片 + 牛油果1/4个 + 水煮蛋1个 + 脱脂牛奶1杯|296|19|牛油果压成泥抹在烤好的吐司上，鸡蛋切片铺上，撒点盐和黑胡椒。
b|home|鸡蛋羹配馒头|鸡蛋羹1碗 + 馒头半个 + 凉拌菠菜|252|15|鸡蛋加1.5倍温水打匀，盖上盘子蒸10分钟。
b|home|鸡胸肉三明治|全麦面包2片 + 鸡胸肉60克 + 生菜番茄|264|27|鸡胸肉可以提前煮好切片冷藏，早上直接夹。
b|home|香蕉燕麦松饼|燕麦40克 + 香蕉1根 + 鸡蛋1个|329|13|香蕉压泥，和燕麦、鸡蛋拌匀，不粘锅小火煎成小饼。
b|home|南瓜粥配鸡蛋|南瓜粥1碗 + 水煮蛋2个|274|15|南瓜切块和米一起煮成粥。
b|home|燕麦牛奶配鸡蛋|燕麦40克 + 脱脂牛奶250毫升 + 水煮蛋1个|307|20|燕麦用牛奶煮开，再焖2分钟。
b|out|豆浆鸡蛋包子|无糖豆浆1杯 + 茶叶蛋1个 + 菜包子1个|360|21|早餐店点无糖豆浆，菜包比肉包热量低一些。
b|out|杂粮煎饼（不加薄脆）|杂粮煎饼1个，不要薄脆，加生菜|380|14|跟老板说不要薄脆、少刷酱，可以多加一个蛋。
b|out|皮蛋瘦肉粥配茶叶蛋|皮蛋瘦肉粥1碗 + 茶叶蛋1个|340|20|粥店的小碗就够，不要配油条。
b|out|肉包配豆浆|肉包子1个 + 无糖豆浆1杯|310|16|一个包子加一杯豆浆，蛋白质比只吃包子多一倍。
b|out|虾饺配豆浆|虾饺4个 + 无糖豆浆1杯|280|17|早茶店点虾饺，比烧卖、叉烧包清淡。
b|out|便利店早餐|三角饭团1个 + 无糖酸奶1杯 + 茶叶蛋1个|365|17|便利店的组合，热量清楚、拿了就走。
b|out|豆腐脑配菜包|咸豆腐脑1碗 + 菜包子1个|300|12|豆腐脑少放辣油。
l|home|鸡胸肉糙米便当|糙米饭1碗 + 鸡胸肉120克 + 西兰花200克 + 油5克|478|47|鸡胸用盐和黑胡椒腌10分钟，平底锅少油两面各煎4分钟；西兰花焯水2分钟。
l|home|番茄牛肉盖饭|米饭1碗 + 瘦牛肉100克 + 番茄2个 + 油8克|452|34|牛肉切片先炒变色盛出，番茄炒出汁再放回牛肉，加盐和一点生抽，浇在饭上。
l|home|虾仁炒蛋配青菜|虾仁炒蛋1份 + 米饭1碗 + 清炒时蔬1份|584|34|虾仁和蛋分开炒再合在一起，青菜大火快炒。
l|home|清蒸鱼套餐|清蒸鱼1份 + 杂粮饭1碗 + 蒜蓉西兰花1份|510|47|鱼身划几刀，放姜葱，水开后蒸8分钟，淋蒸鱼豉油。
l|home|牛肉荞麦面|荞麦面1碗 + 卤牛肉80克 + 青菜100克 + 油5克|462|34|荞麦面煮好过凉水，配卤牛肉片和烫青菜，汤里加点生抽。
l|home|番茄炒蛋套餐|番茄炒蛋1份 + 米饭1碗 + 凉拌黄瓜|494|17|家常快手菜，鸡蛋可以多放一个。
l|home|青椒肉丝套餐|青椒肉丝1份 + 米饭1碗 + 紫菜蛋花汤|534|24|肉丝用少量淀粉抓匀，下锅快炒，出锅前加青椒。
l|home|土豆炖牛肉|土豆炖牛肉1份 + 米饭半碗|507|32|牛肉焯水后炖40分钟，再放土豆炖20分钟。土豆本身就是主食，米饭吃半碗就够了。
l|home|番茄虾仁意面|意面150克（熟） + 虾仁100克 + 番茄酱汁 + 油5克|427|30|意面煮8分钟，虾仁炒熟后加番茄丁炒出汁，拌入意面。
l|home|三文鱼饭碗|米饭120克 + 三文鱼100克 + 牛油果30克 + 黄瓜毛豆|445|28|三文鱼可以生吃（刺身级）或煎熟，和其他材料一起铺在米饭上，淋一点酱油。
l|home|麻婆豆腐套餐|麻婆豆腐1份 + 米饭1碗 + 清炒时蔬1份|544|22|豆腐先在淡盐水里焯一下更不容易碎。
l|home|烤鸡腿便当|去皮鸡腿肉150克 + 米饭1碗 + 胡萝卜西兰花|494|47|鸡腿肉用生抽、蒜末腌20分钟，烤箱200度烤20分钟。
l|out|轻食鸡胸沙拉|鸡胸肉沙拉1份 + 全麦面包1片|455|39|酱料选油醋汁，或者让店家把酱分开放，自己只放一半。
l|out|麻辣烫（自己挑）|蔬菜、豆腐、瘦肉、鸡蛋为主，少选丸子和宽粉，不喝汤|450|25|夹菜时蔬菜占一大半，丸子、午餐肉这类加工肉少拿，麻酱和汤是热量大头。
l|out|兰州牛肉面加肉|牛肉面1碗，加一份牛肉|580|30|面可以要细的、少一点，多加一份牛肉补蛋白质，辣油少放。
l|out|黄焖鸡（饭吃一半）|黄焖鸡米饭，米饭吃一半，不浇汤汁|650|37|汤汁里油和糖很多，不要拌饭。
l|out|宫保鸡丁配青菜|宫保鸡丁1份 + 米饭半碗 + 炒青菜1份|617|31|和同事一起点的话，多夹青菜。
l|out|寿司配味噌汤|寿司8个 + 味噌汤1碗|440|17|握寿司比加了沙拉酱、炸物的卷寿司热量低。
l|out|卤肉饭配青菜|卤肉饭小份 + 烫青菜|560|18|卤汁少淋，青菜不要淋油。
l|out|越南牛肉河粉|牛肉河粉1碗|450|28|汤底清淡，可以多加豆芽和香草。
l|out|韩式拌饭（少酱）|石锅拌饭，辣酱放一半|600|20|拌饭酱里糖很多，放一半就够味。
l|out|酸菜鱼配半碗饭|酸菜鱼一人份 + 米饭半碗，少吃汤里的油|467|38|捞鱼片和酸菜吃，碗底的粉丝和红油尽量不吃。
l|out|便利店午餐|即食鸡胸肉1包 + 三角饭团1个 + 蔬菜沙拉（不放酱）|350|28|便利店拼一顿，蛋白质够，热量可控。
l|out|白切鸡饭（去皮）|白切鸡去皮 + 米饭半碗 + 烫青菜|447|38|鸡皮去掉能少一半以上的脂肪。
l|out|日式牛肉饭配沙拉|牛肉饭小碗 + 蔬菜沙拉|630|22|选小碗，加一份沙拉增加饱腹感。
d|home|清蒸鳕鱼配西兰花|鳕鱼150克 + 蒜蓉西兰花1份 + 杂粮饭半碗|328|35|鳕鱼放姜丝蒸8分钟，淋一点蒸鱼豉油。
d|home|番茄豆腐鸡蛋汤|番茄2个 + 嫩豆腐100克 + 鸡蛋1个 + 杂粮馒头半个|320|18|番茄炒出汁加水煮开，放豆腐，最后淋蛋液。
d|home|鸡胸肉炒彩椒配红薯|鸡胸肉120克 + 彩椒洋葱200克 + 油5克 + 红薯150克|432|41|鸡胸切丁用少许淀粉抓匀，和彩椒洋葱大火快炒；红薯蒸熟当主食。
d|home|虾仁西兰花|虾仁150克 + 西兰花200克 + 油5克 + 糙米饭半碗|324|38|虾仁和西兰花一起炒，加蒜末和一点蚝油。
d|home|牛肉蔬菜汤面|面条半碗 + 瘦牛肉80克 + 青菜番茄|313|29|番茄炒软加水煮开，下面条和牛肉片，最后放青菜。
d|home|香菇蒸鸡|去皮鸡腿肉150克 + 香菇 + 米饭半碗 + 青菜|407|40|鸡肉和香菇用生抽、姜丝腌15分钟，上锅蒸15分钟。
d|home|冬瓜排骨汤配木耳|冬瓜排骨汤（多吃排骨） + 米饭半碗 + 凉拌木耳|427|22|排骨先焯水，炖40分钟后放冬瓜再煮15分钟。
d|home|三文鱼牛油果沙拉|三文鱼100克 + 生菜番茄黄瓜 + 牛油果30克 + 油醋汁|346|23|三文鱼煎熟切块，和蔬菜拌在一起。
d|home|白灼虾配玉米|白灼虾1份 + 清炒时蔬1份 + 玉米1根|435|46|虾在加了姜片的开水里煮2分钟，蘸生抽芥末。
d|home|鸡蛋羹配南瓜|鸡蛋羹1碗 + 凉拌菠菜 + 蒸南瓜200克|212|13|不太饿的晚上吃得清淡一点。
d|home|番茄炖牛腩|番茄炖牛腩一人份 + 杂粮饭半碗|385|21|牛腩焯水后和番茄一起炖1小时，撇掉表面的油。
d|home|卤牛肉配小米粥|卤牛肉100克 + 凉拌黄瓜 + 小米粥1碗|441|36|卤牛肉可以一次做一大块，切片分装冷冻。
d|home|豆腐蔬菜锅|嫩豆腐200克 + 白菜蘑菇300克 + 鸡蛋1个 + 油5克|301|24|锅里加水和一点味噌或生抽，放豆腐、白菜、蘑菇煮10分钟，最后打一个蛋。
d|home|韭菜炒蛋套餐|韭菜炒鸡蛋1份 + 馒头半个 + 紫菜蛋花汤|432|21|韭菜最后放，大火炒几下就出锅。
d|home|鸡肉卷心菜炒面|荞麦面150克（熟） + 鸡胸肉100克 + 卷心菜200克 + 油5克|410|40|鸡肉先炒熟，加卷心菜炒软，再放面条和一点生抽翻炒。
d|out|酸菜鱼（不吃粉）|酸菜鱼一人份，不吃碗底的粉，少喝汤|380|36|和午餐的酸菜鱼一样，捞鱼片和酸菜吃。
d|out|麻辣烫（菜多肉少）|蔬菜、豆腐、鸡蛋为主，不喝汤|400|22|晚上选清汤或番茄汤底更好。
d|out|关东煮|萝卜、海带、魔芋、鸡蛋、鱼豆腐|250|15|便利店关东煮，汤别喝太多，比较咸。
d|out|外卖轻食|鸡胸肉沙拉1份|380|35|酱料分开放，自己控制用量。
d|out|清汤火锅|清汤锅，肥牛100克 + 虾滑100克 + 豆腐 + 蔬菜，蘸料少放麻酱|620|52|蘸料用醋、蒜、葱、小米辣调，比麻酱和油碟少好几百千卡。
d|out|便利店晚餐|即食鸡胸肉1包 + 玉米1根 + 无糖酸奶1杯|350|32|加班回家晚的时候，便利店拼一顿就好。
d|out|刺身拼盘|刺身8片 + 握寿司4个|400|37|刺身多、饭少，蛋白质很高。
s|home|一个苹果|苹果1个|104|0.5|
s|home|无糖酸奶|无糖酸奶1杯|95|5|
s|home|一小把坚果|混合坚果25克|150|5|一小把就是手心能托住的量，别直接抱着袋子吃。
s|home|一根香蕉|香蕉1根|107|1.3|
s|home|水煮蛋|水煮蛋1个|72|6.3|
s|home|盐水毛豆|毛豆100克|131|13|
s|home|黄瓜小番茄|黄瓜1根 + 小番茄10颗|60|2|
s|home|一杯牛奶|脱脂牛奶1杯|85|8.5|
s|home|希腊酸奶|无糖希腊酸奶1杯|110|14|
s|home|一个橙子|橙子1个|94|1.8|
s|home|蓝莓|蓝莓1小盒|71|0.9|
s|home|黑巧克力|70%黑巧克力2小块|75|1|想吃甜的时候，两小块就够。
s|out|即食鸡胸肉|即食鸡胸肉半包|60|11|
s|out|无糖豆浆|无糖豆浆1杯|78|7.5|
s|out|蛋白棒|蛋白棒半根|110|10|
`;
  const LIB = [];
  RAW.trim().split('\n').forEach((line, i) => {
    const [slot, type, name, items, kcal, protein, how] = line.split('|');
    LIB.push({ id: 'r' + i, slot, type, name, items, kcal: Number(kcal), protein: Number(protein), how: how || '' });
  });

  const SHARE = { b: 0.25, l: 0.35, d: 0.3, s: 0.1 };
  const SLOTS = { b: '早餐', l: '午餐', d: '晚餐', s: '加餐' };

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /** 最近 7 天里，计划中出现过或者已经记为吃过的食谱名称。 */
  function recentNames(day) {
    const S = Store.state, names = new Set();
    for (let i = 1; i <= 7; i++) {
      const d = D.add(day, -i);
      (S.foods[d] || []).forEach((f) => { if (f.src === 'recipe') names.add(f.name); });
      const p = S.plans[d]; if (p && p.picked) Object.values(p.picked).forEach((n) => names.add(n));
    }
    return names;
  }

  /** 每个餐段的热量预算：已经吃过的餐段按实际，其余按比例分配剩下的额度。 */
  function slotBudgets(day) {
    const B = Calc.budget(day); if (!B) return null;
    const foods = Store.state.foods[day] || [];
    const eatenBy = { b: 0, l: 0, d: 0, s: 0 };
    foods.forEach((f) => { eatenBy[f.meal] = (eatenBy[f.meal] || 0) + Number(f.kcal || 0); });
    const open = Object.keys(SHARE).filter((k) => eatenBy[k] === 0);
    const used = Object.values(eatenBy).reduce((a, b) => a + b, 0);
    const left = Math.max(0, B.total - used);
    const shareSum = open.reduce((a, k) => a + SHARE[k], 0) || 1;
    const out = {};
    Object.keys(SHARE).forEach((k) => { out[k] = eatenBy[k] ? { eaten: Math.round(eatenBy[k]) } : { budget: Math.round(left * SHARE[k] / shareSum) }; });
    return { slots: out, left, total: B.total };
  }

  function pick(day, slot, budget, roll) {
    const S = Store.state;
    const mode = S.settings.mode || 'any';
    const dislikes = (S.settings.dislikes || '').split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
    const recent = recentNames(day);
    let cands = LIB.filter((r) => r.slot === slot && (mode === 'any' || r.type === mode) && !dislikes.some((x) => (r.name + r.items).includes(x)));
    if (!cands.length) cands = LIB.filter((r) => r.slot === slot);
    const scored = cands.map((r) => {
      let s = Math.abs(r.kcal - budget) / Math.max(150, budget);
      if (r.kcal > budget * 1.2) s += 0.6;
      if (recent.has(r.name)) s += 0.5;
      s -= Math.min(0.25, r.protein / 200);
      return { r, s };
    }).sort((a, b) => a.s - b.s);
    const top = scored.slice(0, Math.min(6, scored.length));
    const rand = rng(hash(day + slot + ':' + (roll || 0)));
    // 越合适的权重越大，但每天都有变化
    const weights = top.map((x, i) => 1 / (1 + i * 0.6));
    let total = weights.reduce((a, b) => a + b, 0), v = rand() * total;
    for (let i = 0; i < top.length; i++) { v -= weights[i]; if (v <= 0) return top[i].r; }
    return top[0].r;
  }

  function plan(day) {
    const S = Store.state;
    const sb = slotBudgets(day); if (!sb) return null;
    const p = S.plans[day] || (S.plans[day] = { roll: { b: 0, l: 0, d: 0, s: 0 }, picked: {}, ai: null });
    const meals = {};
    Object.keys(SHARE).forEach((k) => {
      const s = sb.slots[k];
      if (s.eaten != null) { meals[k] = { eaten: s.eaten }; return; }
      const r = pick(day, k, s.budget, p.roll[k] || 0);
      meals[k] = { budget: s.budget, r };
      p.picked[k] = r.name;
    });
    // 只保留最近 60 天的计划
    const keys = Object.keys(S.plans).sort(); if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete S.plans[k]);
    return { meals, left: sb.left, total: sb.total, ai: p.ai };
  }
  function reroll(day, slot) { const p = Store.state.plans[day]; if (p) { p.roll[slot] = (p.roll[slot] || 0) + 1; Store.save(); } }

  window.Recipes = { LIB, SLOTS, SHARE, plan, reroll, slotBudgets };
})();

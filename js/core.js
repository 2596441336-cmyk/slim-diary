/* 瘦身日记 · 数据存储、日期工具与所有计算（热量目标、体重趋势、自动校准）
   体重统一用「斤」保存和显示（1 斤 = 0.5 公斤）。所有数据只保存在这台设备的浏览器里。 */
(function () {
  const KEY = 'slimdiary.v1';
  const pad = (n) => String(n).padStart(2, '0');

  const D = {
    key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); },
    todayKey() { return D.key(D.today()); },
    add(key, n) { const x = D.parse(key); x.setDate(x.getDate() + n); return D.key(x); },
    diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); }, // b - a 天
    week: ['日', '一', '二', '三', '四', '五', '六'],
    label(key) { const d = D.parse(key); return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + D.week[d.getDay()]; },
    short(key) { const d = D.parse(key); return (d.getMonth() + 1) + '/' + d.getDate(); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };

  const defaults = () => ({
    profile: { sex: '', age: '', height: '', goal: '', activity: 1.375, pace: 1, start: null },
    weights: [],      // [{d, w(斤), waist(厘米，可空)}]，按日期排序
    foods: {},        // { 'YYYY-MM-DD': [{id, meal:'b'|'l'|'d'|'s', name, amount, kcal, protein, src}] }
    exercise: {},     // { 'YYYY-MM-DD': [{id, name, kcal}] }
    custom: [],       // 我的食物 [{id, name, cat:'我的食物', serving, g, kcal, protein}]
    usage: {},        // { 食物名: {n, last, kcal, protein, amount} } 用来做「常吃」
    plans: {},        // { 'YYYY-MM-DD': {roll:{b,l,d,s}, ai:null|{...}} }
    settings: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', thinkingOff: true, dislikes: '', mode: 'any', exFactor: 0.5 }
  });

  function merge(base, saved) {
    for (const k in saved) {
      const v = saved[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && k !== 'foods' && k !== 'exercise' && k !== 'usage' && k !== 'plans') base[k] = merge(base[k], v);
      else base[k] = v;
    }
    return base;
  }
  let state;
  try { const raw = localStorage.getItem(KEY); state = raw ? merge(defaults(), JSON.parse(raw)) : defaults(); } catch (e) { state = defaults(); }
  let t = 0;
  function save() { clearTimeout(t); t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }, 100); }
  function replaceAll(obj) { state = merge(defaults(), obj); Store.state = state; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = defaults(); Store.state = state; }

  /* ================= 计算 ================= */
  const r1 = (x) => Math.round(x * 10) / 10;

  function latestWeight() { const w = Store.state.weights; return w.length ? w[w.length - 1].w : null; }

  /** 体重趋势：缺的日子按前后插值，再做指数平滑（α=0.1，约等于 10 天的移动平均）。 */
  function trendSeries() {
    const ws = Store.state.weights;
    if (!ws.length) return [];
    const first = ws[0].d, last = D.todayKey() > ws[ws.length - 1].d ? D.todayKey() : ws[ws.length - 1].d;
    const n = D.diff(first, last) + 1;
    const byDay = {}; ws.forEach((e) => { byDay[e.d] = e.w; });
    const out = [];
    let prevIdx = 0, prevW = ws[0].w, nextPtr = 0, trend = ws[0].w;
    const alpha = 0.1;
    for (let i = 0; i < n; i++) {
      const d = D.add(first, i);
      let raw = byDay[d], val;
      if (raw != null) { val = raw; prevIdx = i; prevW = raw; }
      else {
        while (nextPtr < ws.length && ws[nextPtr].d <= d) nextPtr++;
        if (nextPtr < ws.length) { const ni = D.diff(first, ws[nextPtr].d); val = prevW + (ws[nextPtr].w - prevW) * (i - prevIdx) / (ni - prevIdx); }
        else val = prevW; // 最后一次称重之后，沿用最后的值
      }
      trend = i === 0 ? val : trend + alpha * (val - trend);
      out.push({ d, w: raw == null ? null : raw, t: trend, est: raw == null });
    }
    return out;
  }

  /** 最近 n 天趋势的线性回归斜率（斤/天）。 */
  function slope(series, days) {
    const s = series.slice(-days);
    if (s.length < 5) return null;
    const n = s.length; let sx = 0, sy = 0, sxy = 0, sxx = 0;
    s.forEach((p, i) => { sx += i; sy += p.t; sxy += i * p.t; sxx += i * i; });
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  }

  function dayFoodKcal(d) { return (Store.state.foods[d] || []).reduce((a, f) => a + (Number(f.kcal) || 0), 0); }
  function dayProtein(d) { return (Store.state.foods[d] || []).reduce((a, f) => a + (Number(f.protein) || 0), 0); }
  function dayExercise(d) { return (Store.state.exercise[d] || []).reduce((a, f) => a + (Number(f.kcal) || 0), 0); }
  /** 一天算作「记全了」：至少记了 800 千卡，并且记了两个以上的餐段。 */
  function dayLogged(d) { const f = Store.state.foods[d] || []; return dayFoodKcal(d) >= 800 && new Set(f.map((x) => x.meal)).size >= 2; }

  /** 根据最近 3–4 周「实际吃了多少」和「体重实际变了多少」反推每天真实消耗。 */
  function observedTDEE() {
    const series = trendSeries();
    if (series.length < 15) return null;
    const win = series.slice(-28);
    const days = win.map((p) => p.d).filter((d) => d < D.todayKey());
    const logged = days.filter(dayLogged);
    if (logged.length < 10) return null;
    const avgIn = logged.reduce((a, d) => a + dayFoodKcal(d), 0) / logged.length;
    const k = slope(series, Math.min(28, series.length)); // 斤/天
    if (k == null) return null;
    const kgPerDay = k / 2;
    return { tdee: avgIn - kgPerDay * 7700, days: logged.length, avgIn };
  }

  function targets() {
    const p = Store.state.profile;
    const w = latestWeight() || (p.start && p.start.w) || null;
    if (!p.sex || !p.age || !p.height || !w) return null;
    const kg = w / 2, cm = Number(p.height), age = Number(p.age);
    const bmr = 10 * kg + 6.25 * cm - 5 * age + (p.sex === 'm' ? 5 : -161);
    const formula = bmr * Number(p.activity || 1.375);
    let tdee = formula, calibrated = null;
    const obs = observedTDEE();
    if (obs) {
      const o = Math.max(formula * 0.7, Math.min(formula * 1.3, obs.tdee));
      const wt = Math.min(0.75, 0.4 + (obs.days - 10) * 0.02);
      tdee = formula * (1 - wt) + o * wt;
      calibrated = { observed: Math.round(obs.tdee), used: Math.round(o), days: obs.days, weight: wt };
    }
    const goal = Number(p.goal) || null;
    const losing = goal && goal < w - 0.5;
    const pace = losing ? Number(p.pace) : 0; // 斤/周
    const deficit = pace / 2 * 7700 / 7;
    const floor = Math.max(p.sex === 'm' ? 1500 : 1200, Math.round(bmr * 0.9 / 10) * 10);
    let kcal = tdee - deficit, floored = false;
    if (kcal < floor) { kcal = floor; floored = true; }
    const protKg = goal ? Math.min(kg, Math.max(goal / 2, kg * 0.8)) : kg;
    const protein = Math.max(60, Math.round(protKg * 1.5));
    return { bmr: Math.round(bmr), formula: Math.round(formula), tdee: Math.round(tdee), deficit: Math.round(deficit), kcal: Math.round(kcal / 10) * 10, floor, floored, protein, pace, losing, calibrated, weight: w };
  }

  /** 某一天的预算：目标 + 运动消耗 × 折算系数。 */
  function budget(d) {
    const T = targets(); if (!T) return null;
    const ex = dayExercise(d) * Number(Store.state.settings.exFactor || 0.5);
    const eaten = dayFoodKcal(d);
    return { target: T.kcal, exercise: Math.round(ex), total: Math.round(T.kcal + ex), eaten: Math.round(eaten), left: Math.round(T.kcal + ex - eaten), protein: Math.round(dayProtein(d)), proteinTarget: T.protein };
  }

  /** 给体重页的分析结论（纯规则，不需要 AI）。 */
  function analysis() {
    const p = Store.state.profile, ws = Store.state.weights, series = trendSeries();
    const out = { lines: [], stats: null };
    if (!ws.length) return out;
    const last = series[series.length - 1];
    const startW = ws[0].w, goal = Number(p.goal) || null;
    const k14 = slope(series, 14), k7 = slope(series, 7);
    const weekRate = k14 != null ? r1(k14 * 7) : null; // 斤/周
    const lost = startW - last.t;
    let eta = null;
    if (goal && weekRate != null && weekRate < -0.05 && last.t > goal) {
      const days = Math.ceil((last.t - goal) / (-weekRate / 7));
      if (days < 3650) eta = D.add(D.todayKey(), days);
    }
    out.stats = { trend: r1(last.t), latest: ws[ws.length - 1].w, lost: r1(lost), weekRate: weekRate == null ? null : r1(weekRate), eta, goal, startW, days: series.length,
      pct: goal && startW > goal ? Math.max(0, Math.min(100, Math.round(lost / (startW - goal) * 100))) : null };

    const todayW = ws[ws.length - 1];
    const spanDays = D.diff(ws[0].d, D.todayKey());
    if (ws.length < 4 || spanDays < 6) {
      out.lines.push({ k: 'info', t: '再记几天，趋势线就出来了。每天固定在早上起床、上完厕所、吃东西之前称，数字最可比。' });
    }
    if (todayW.d === D.todayKey() && ws.length >= 3) {
      const diffT = r1(todayW.w - last.t);
      if (diffT >= 0.6) out.lines.push({ k: 'calm', t: '今天比趋势重 ' + diffT + ' 斤。这么大的单日起伏通常是水分、盐分、排便或经期带来的，不是长了脂肪，看趋势线就好。' });
      else if (diffT <= -0.6) out.lines.push({ k: 'calm', t: '今天比趋势轻 ' + (-diffT) + ' 斤。单日的低点多半也是水分变化，趋势线会慢慢跟上来。' });
    }
    if (weekRate != null && spanDays >= 14 && p.pace) {
      const plan = Number(p.pace);
      if (weekRate > 0.3) out.lines.push({ k: 'warn', t: '最近两周趋势在往上走，平均每周 +' + weekRate + ' 斤。可以回头看看这两周有没有漏记，比如炒菜油、饮料、零食。' });
      else if (-weekRate < plan * 0.4 && Math.abs(k14 * 14) < 0.4 && spanDays >= 21) out.lines.push({ k: 'warn', t: '最近两周趋势几乎没动，可能进入了平台期。这很常见，继续按计划记录，系统会根据实际数据自动下调每天的热量目标。' });
      else if (-weekRate < plan * 0.6) out.lines.push({ k: 'info', t: '最近平均每周减 ' + (-weekRate) + ' 斤，比计划的 ' + plan + ' 斤慢一些。记录满 10 天后，每天的目标会按你的实际消耗自动校准。' });
      else if (-weekRate > Math.max(2, plan * 1.6) && spanDays >= 21) out.lines.push({ k: 'warn', t: '最近平均每周减 ' + (-weekRate) + ' 斤，有点快。减得太快容易掉肌肉，可以每天多吃一点，尤其是蛋白质。' });
      else if (weekRate < 0) out.lines.push({ k: 'good', t: '最近平均每周减 ' + (-weekRate) + ' 斤，和计划的 ' + plan + ' 斤差不多，节奏很好。' });
    }
    if (lost >= 1 && spanDays >= 7) out.lines.push({ k: 'good', t: '从第一次记录到现在，趋势体重一共减了 ' + r1(lost) + ' 斤' + (out.stats.pct != null ? '，完成了目标的 ' + out.stats.pct + '%' : '') + '。' });
    // 腰围
    const wa = ws.filter((e) => e.waist);
    if (wa.length >= 2) {
      const dw = r1(wa[wa.length - 1].waist - wa[0].waist);
      if (dw <= -1) out.lines.push({ k: 'good', t: '腰围从 ' + r1(wa[0].waist) + ' 厘米到 ' + r1(wa[wa.length - 1].waist) + ' 厘米，小了 ' + (-dw) + ' 厘米。体重不动的时候，腰围也是很好的参考。' });
    }
    return out;
  }

  /** 最近几周的周报：平均体重、平均摄入、变化。 */
  function weeks(n) {
    const series = trendSeries(); const res = [];
    for (let i = 0; i < n; i++) {
      const end = D.add(D.todayKey(), -7 * i), start = D.add(end, -6);
      const days = []; for (let k = 0; k < 7; k++) days.push(D.add(start, k));
      const ws = Store.state.weights.filter((e) => e.d >= start && e.d <= end);
      const logged = days.filter((d) => dayFoodKcal(d) > 0 && d <= D.todayKey());
      const tEnd = series.find((p) => p.d === end), tStart = series.find((p) => p.d === D.add(start, -1));
      res.push({ start, end, avgW: ws.length ? r1(ws.reduce((a, e) => a + e.w, 0) / ws.length) : null, avgIn: logged.length ? Math.round(logged.reduce((a, d) => a + dayFoodKcal(d), 0) / logged.length) : null, logged: logged.length, change: tEnd && tStart ? r1(tEnd.t - tStart.t) : null });
    }
    return res;
  }

  function addUsage(f) {
    const u = Store.state.usage;
    const k = f.name;
    u[k] = { n: ((u[k] && u[k].n) || 0) + 1, last: Date.now(), kcal: f.kcal, protein: f.protein, amount: f.amount };
    const keys = Object.keys(u);
    if (keys.length > 300) keys.sort((a, b) => u[a].last - u[b].last).slice(0, keys.length - 300).forEach((k2) => delete u[k2]);
  }

  window.D = D;
  window.Store = { state, save, replaceAll, reset, KEY };
  window.Calc = { trendSeries, slope, targets, budget, analysis, weeks, dayFoodKcal, dayProtein, dayExercise, latestWeight, addUsage, r1 };
})();

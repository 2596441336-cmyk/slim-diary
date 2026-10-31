/* AI：调用 DeepSeek（OpenAI 兼容格式）。密钥只保存在本机，请求从手机直接发给 DeepSeek（或你自己的中转地址）。 */
(function () {
  const cfg = () => Store.state.settings;
  const ready = () => !!(cfg().apiKey && cfg().baseUrl && cfg().model);

  class AIError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }

  async function chat(messages, opts) {
    opts = opts || {};
    const s = cfg();
    if (!ready()) throw new AIError('还没有填写 DeepSeek 密钥。在「我的 → AI 设置」里填好就能用。', 'nokey');
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const base = { model: s.model, messages, temperature: opts.temperature == null ? 0.3 : opts.temperature, max_tokens: opts.maxTokens || 1500, stream: false };
    // 先带上「JSON 输出」和「关闭思考」；如果接口不认识这些参数，就去掉重试一次
    const extras = [];
    if (opts.json !== false) extras.push(['response_format', { type: 'json_object' }]);
    if (s.thinkingOff) extras.push(['thinking', { type: 'disabled' }]);
    let attempt = 0;
    while (true) {
      const body = Object.assign({}, base);
      if (attempt === 0) extras.forEach(([k, v]) => { body[k] = v; });
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey }, body: JSON.stringify(body) });
      } catch (e) {
        throw new AIError('连不上 AI 服务。可能是网络问题，也可能是浏览器不允许网页直接连接 DeepSeek。可以先在「我的 → AI 设置」里点「测试连接」看看；如果一直失败，按说明设置一个中转地址。', 'network');
      }
      if (res.ok) {
        const j = await res.json();
        const msg = j.choices && j.choices[0] && j.choices[0].message;
        const text = msg ? (msg.content || '') : '';
        return { text, usage: j.usage || null };
      }
      let detail = '';
      try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.type)) || JSON.stringify(j).slice(0, 200); } catch (e) { try { detail = (await res.text()).slice(0, 200); } catch (e2) {} }
      if (res.status === 400 && attempt === 0 && extras.length) { attempt++; continue; }
      if (res.status === 401) throw new AIError('密钥不对或者已经失效。到 DeepSeek 开放平台重新复制一个，填到设置里。', 'auth');
      if (res.status === 402) throw new AIError('DeepSeek 账户余额不足，充值后就能继续用。', 'balance');
      if (res.status === 429) throw new AIError('请求太频繁了，等几秒再试。', 'rate');
      if (res.status === 404) throw new AIError('找不到这个接口或模型（' + s.model + '）。检查一下设置里的接口地址和模型名称。', 'notfound');
      if (res.status >= 500) throw new AIError('DeepSeek 服务暂时不可用，稍后再试。', 'server');
      throw new AIError('AI 返回了错误（' + res.status + '）：' + detail, 'other');
    }
  }

  async function errorFor(res) {
    const s = cfg();
    let detail = '';
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.type)) || JSON.stringify(j).slice(0, 200); } catch (e) { try { detail = (await res.text()).slice(0, 200); } catch (e2) {} }
    if (res.status === 401) return new AIError('密钥不对或者已经失效。到 DeepSeek 开放平台重新复制一个，填到设置里。', 'auth');
    if (res.status === 402) return new AIError('DeepSeek 账户余额不足，充值后就能继续用。', 'balance');
    if (res.status === 429) return new AIError('请求太频繁了，等几秒再试。', 'rate');
    if (res.status === 404) return new AIError('找不到这个接口或模型（' + s.model + '）。检查一下设置里的接口地址和模型名称。', 'notfound');
    if (res.status >= 500) return new AIError('DeepSeek 服务暂时不可用，稍后再试。', 'server');
    return new AIError('AI 返回了错误（' + res.status + '）：' + detail, res.status === 400 ? 'bad' : 'other');
  }

  /** 流式对话：回复一段一段地到达，onDelta(全文) 会被反复调用。 */
  async function stream(messages, onDelta, opts) {
    opts = opts || {};
    const s = cfg();
    if (!ready()) throw new AIError('还没有填写 DeepSeek 密钥。在「我的 → AI 设置」里填好就能用。', 'nokey');
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = { model: s.model, messages, temperature: opts.temperature == null ? 0.7 : opts.temperature, max_tokens: opts.maxTokens || 2000, stream: true };
      if (attempt === 0 && s.thinkingOff) body.thinking = { type: 'disabled' };
      let res;
      try { res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey }, body: JSON.stringify(body), signal: opts.signal }); }
      catch (e) {
        if (e && e.name === 'AbortError') throw new AIError('已停止', 'abort');
        throw new AIError('连不上 AI 服务。可能是网络问题，也可能是浏览器不允许网页直接连接 DeepSeek。可以在「我的 → AI 设置」里点「测试连接」看看。', 'network');
      }
      if (!res.ok) { if (res.status === 400 && attempt === 0 && s.thinkingOff) continue; throw await errorFor(res); }
      // 不支持流式时（比如某些中转），直接读完整结果
      const ct = res.headers.get('content-type') || '';
      if (!res.body || ct.includes('application/json')) {
        const j = await res.json(); const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        onDelta(text); return text;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = '', text = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { onDelta(text); return text; }
            try { const j = JSON.parse(data); const d = j.choices && j.choices[0] && j.choices[0].delta; if (d && d.content) { text += d.content; onDelta(text); } } catch (e) {}
          }
        }
      } catch (e) { if (e && e.name === 'AbortError') { onDelta(text); return text; } throw new AIError('回复中断了，再试一次。', 'network'); }
      onDelta(text); return text;
    }
  }

  function parseJSON(text) {
    if (!text) throw new AIError('AI 没有返回内容，再试一次。', 'parse');
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch (e) {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw new AIError('AI 返回的格式看不懂，再试一次。', 'parse');
  }

  /** 把照片缩小到最长边 1024 像素，转成 JPEG。 */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new AIError('这张图片打不开，换一张试试。', 'image')); };
      img.src = url;
    });
  }

  const FOOD_SCHEMA = '{"items":[{"name":"食物名称","amount":"份量描述，如 1碗、约200克","grams":数字,"kcal":数字,"protein":数字}],"confidence":"高|中|低","tip":"一句简短的提醒或建议，可为空"}';

  function myFoodsHint() {
    const c = Store.state.custom.slice(0, 40);
    if (!c.length) return '';
    return '\n用户自己记录过的食物（如果照片或描述里就是这些，优先用这里的数值）：\n' + c.map((f) => '- ' + f.name + '（' + f.serving + '）' + f.kcal + '千卡，蛋白质' + f.protein + '克').join('\n');
  }

  const SYSTEM_FOOD = '你是一名严谨的中文营养师，帮用户估算一餐的热量。规则：\n' +
    '1. 按实际看到或描述的份量估算，中餐要把烹调用油算进去（一般炒菜每份含油 8–15 克）。\n' +
    '2. 每种食物单独列一行；同一盘里的主要组成可以合并。\n' +
    '3. 热量单位千卡，蛋白质单位克，都取整数。\n' +
    '4. 只输出 JSON，不要任何其他文字。格式：' + FOOD_SCHEMA + '\n' +
    '5. 如果图片里没有食物，items 返回空数组，并在 tip 里说明。';

  async function recognizePhoto(file, note) {
    const dataUrl = await shrink(file);
    const text = '请识别这张照片里的食物，并估算份量、热量和蛋白质，以 json 格式输出。' + (note ? '\n用户补充说明：' + note : '') + myFoodsHint();
    const r = await chat([{ role: 'system', content: SYSTEM_FOOD }, { role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: dataUrl } }] }], { maxTokens: 1200 });
    return Object.assign(clean(parseJSON(r.text)), { image: dataUrl });
  }
  async function parseText(desc) {
    const r = await chat([{ role: 'system', content: SYSTEM_FOOD }, { role: 'user', content: '用户吃了：' + desc + '\n请估算份量、热量和蛋白质，以 json 格式输出。' + myFoodsHint() }], { maxTokens: 1000 });
    return clean(parseJSON(r.text));
  }
  function clean(j) {
    const items = Array.isArray(j.items) ? j.items : [];
    return {
      items: items.map((x) => ({ name: String(x.name || '食物').slice(0, 30), amount: String(x.amount || '').slice(0, 30), grams: Math.max(0, Math.round(Number(x.grams) || 0)), kcal: Math.max(0, Math.round(Number(x.kcal) || 0)), protein: Math.max(0, Math.round(Number(x.protein) || 0)) })).filter((x) => x.kcal || x.name),
      confidence: ['高', '中', '低'].includes(j.confidence) ? j.confidence : '中',
      tip: String(j.tip || '').slice(0, 120)
    };
  }

  async function planDay(day) {
    const S = Store.state, T = Calc.targets(), sb = Recipes.slotBudgets(day);
    const p = S.profile;
    const eaten = (S.foods[day] || []).map((f) => Recipes.SLOTS[f.meal] + '：' + f.name + ' ' + f.kcal + '千卡').join('\n') || '还没吃';
    const open = Object.keys(sb.slots).filter((k) => sb.slots[k].budget != null).map((k) => Recipes.SLOTS[k] + ' 约' + sb.slots[k].budget + '千卡').join('，');
    const recent = [];
    for (let i = 1; i <= 5; i++) { const pl = S.plans[D.add(day, -i)]; if (pl && pl.ai) pl.ai.meals.forEach((m) => recent.push(m.name)); }
    const modeTxt = { any: '在家做或外面吃都可以', home: '主要在家自己做', out: '主要在外面吃（外卖、食堂、便利店）' }[S.settings.mode || 'any'];
    const prompt = '请为用户安排今天还没吃的餐。\n' +
      '用户：' + (p.sex === 'm' ? '男' : '女') + '，' + p.age + '岁，' + p.height + '厘米，现在 ' + T.weight + ' 斤，目标 ' + p.goal + ' 斤，正在减脂。\n' +
      '今天总预算 ' + sb.total + ' 千卡，蛋白质目标 ' + T.protein + ' 克。\n' +
      '今天已经吃了：\n' + eaten + '\n' +
      '需要安排：' + open + '\n' +
      '饮食方式：' + modeTxt + '。\n' +
      (S.settings.dislikes ? '不吃或不喜欢：' + S.settings.dislikes + '。\n' : '') +
      (recent.length ? '最近几天已经推荐过（尽量别重复）：' + recent.join('、') + '。\n' : '') +
      '要求：以中餐为主、家常好做或者容易买到，每餐写清楚具体食材和份量；蛋白质要尽量吃够；每餐热量尽量贴近预算。\n' +
      '只输出 json：{"meals":[{"slot":"b|l|d|s","name":"餐名","items":"食材和份量","kcal":数字,"protein":数字,"how":"一两句做法或点单建议"}],"note":"一句今天的整体建议"}';
    const r = await chat([{ role: 'system', content: '你是一名擅长中餐的营养师，给减脂的人安排实际可行的一日三餐。只输出 JSON。' }, { role: 'user', content: prompt }], { maxTokens: 1800, temperature: 0.8 });
    const j = parseJSON(r.text);
    const meals = (Array.isArray(j.meals) ? j.meals : []).filter((m) => ['b', 'l', 'd', 's'].includes(m.slot)).map((m) => ({ slot: m.slot, name: String(m.name || '').slice(0, 30), items: String(m.items || '').slice(0, 160), kcal: Math.round(Number(m.kcal) || 0), protein: Math.round(Number(m.protein) || 0), how: String(m.how || '').slice(0, 160) }));
    if (!meals.length) throw new AIError('AI 没有给出食谱，再试一次。', 'parse');
    return { meals, note: String(j.note || '').slice(0, 120), at: Date.now() };
  }

  async function test() {
    const r = await chat([{ role: 'user', content: '请只回复 json：{"ok":true}' }], { maxTokens: 20 });
    parseJSON(r.text);
    return true;
  }

  window.AI = { ready, recognizePhoto, parseText, planDay, test, stream, shrink, AIError };
})();

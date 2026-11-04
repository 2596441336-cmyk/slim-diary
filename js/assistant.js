/* 私人 AI 助手：每次提问都会附上你的资料、今天的饮食和最近的体重，所以回答是按你的情况来的。
   聊天记录只存在这台手机上，提问时发给 DeepSeek。 */
(function () {
  const { $, $$, esc, MEALS, toast, ICONS } = UI;
  const S = () => Store.state;
  const name = () => (S().settings.assistantName || '助手').slice(0, 10);
  const ACT_TXT = { 1.2: '久坐', 1.375: '轻度活动', 1.55: '中度活动', 1.725: '高强度活动' };
  let busy = false, ctrl = null, pending = []; // 待发送的照片 [{blob, dataUrl, url}]，最多 9 张
  const MAX_PHOTOS = 9;
  const photosOf = (m) => m.photos || (m.photo ? [m.photo] : []);
  const exTxt = (x) => x.name + (x.km ? ' ' + x.km + '公里' : x.min ? ' ' + x.min + '分钟' : '') + ' ' + x.kcal + '千卡';
  function cardDay(j) { const t = D.todayKey(); const d = typeof j.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.day) ? j.day : t; return d < D.add(t, -7) || d > D.add(t, 14) ? t : d; }
  function dayWord(d) { const t = D.todayKey(); return d === t ? '' : d === D.add(t, 1) ? '明天' : d === D.add(t, 2) ? '后天' : D.short(d); }

  /* ---------------- 给 AI 的背景信息 ---------------- */
  function context() {
    const s = S(), p = s.profile, T = Calc.targets(), today = D.todayKey(), B = Calc.budget(today), A = Calc.analysis();
    const now = new Date();
    const L = [];
    L.push('现在：' + now.getFullYear() + '年' + D.label(today) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
    L.push('用户：' + (p.nickname ? '昵称「' + p.nickname + '」，' : '') + (p.sex === 'm' ? '男' : '女') + '，' + p.age + '岁，身高' + p.height + '厘米，' + (ACT_TXT[p.activity] || '') + '。体重单位用「斤」（1斤=0.5公斤）。');
    if (T) {
      L.push('体重：最近一次称 ' + Calc.latestWeight() + ' 斤' + (A.stats ? '，趋势体重 ' + A.stats.trend + ' 斤，从 ' + A.stats.startW + ' 斤开始，已减 ' + A.stats.lost + ' 斤' + (A.stats.weekRate != null ? '，最近每周 ' + A.stats.weekRate + ' 斤' : '') + (A.stats.eta ? '，预计 ' + A.stats.eta + ' 到达目标' : '') : '') + '。目标 ' + p.goal + ' 斤，计划每周减 ' + p.pace + ' 斤。');
      L.push('热量：基础代谢 ' + T.bmr + '，每日总消耗约 ' + T.tdee + (T.calibrated ? '（已按 ' + T.calibrated.days + ' 天的实际记录校准）' : '（公式估算）') + '，每日目标 ' + T.kcal + ' 千卡' + (T.floored ? '（已到安全底线）' : '') + '，蛋白质目标 ' + T.protein + ' 克。安全底线 ' + T.floor + ' 千卡，任何建议都不要让一天的总摄入低于它。');
    }
    if (B) {
      const fs = s.foods[today] || [];
      L.push('今天：预算 ' + B.total + ' 千卡（含运动加回 ' + B.exercise + '），已吃 ' + B.eaten + '，还剩 ' + B.left + '，蛋白质 ' + B.protein + '/' + B.proteinTarget + ' 克。');
      Object.keys(MEALS).forEach((m) => {
        const items = fs.filter((f) => f.meal === m); const meta = Photos.meta(today, m);
        if (items.length || (meta && meta.note)) L.push('  ' + MEALS[m] + '：' + (items.map((f) => f.name + (f.amount ? '(' + f.amount + ')' : '') + ' ' + Math.round(f.kcal) + '千卡').join('，') || '无') + (meta && meta.note ? '；备注：' + meta.note : ''));
      });
      const ex = s.exercise[today] || []; if (ex.length) L.push('  运动：' + ex.map(exTxt).join('，'));
    }
    const ahead = [];
    for (let i = 1; i <= 3; i++) {
      const d = D.add(today, i); const fs = s.foods[d] || [];
      if (fs.length) ahead.push(dayWord(d) + '（' + d + '）已计划 ' + Math.round(Calc.dayFoodKcal(d)) + ' 千卡：' + Object.keys(MEALS).map((m) => { const it = fs.filter((f) => f.meal === m); return it.length ? MEALS[m] + ' ' + it.map((f) => f.name).join('、') : ''; }).filter(Boolean).join('；'));
    }
    if (ahead.length) { L.push('已经做好的饮食计划：' + ahead.join(' | '));
    }
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const d = D.add(today, -i); const k = Calc.dayFoodKcal(d); const w = s.weights.find((e) => e.d === d);
      if (k || w) days.push(D.short(d) + '：' + (k ? Math.round(k) + '千卡' : '没记饮食') + (w ? '，体重 ' + w.w : ''));
    }
    if (days.length) L.push('最近 7 天：' + days.join('；'));
    if (A.lines.length) L.push('应用的自动分析：' + A.lines.map((x) => x.t).join(' '));
    const pref = [];
    if (s.settings.dislikes) pref.push('不吃/不喜欢：' + s.settings.dislikes);
    pref.push('饮食方式：' + ({ any: '在家做和外面吃都可以', home: '主要在家做', out: '主要在外面吃' }[s.settings.mode || 'any']));
    L.push('偏好：' + pref.join('；'));
    if (s.custom.length) L.push('用户自己记录过的食物：' + s.custom.slice(0, 30).map((f) => f.name + '(' + f.serving + ' ' + f.kcal + '千卡)').join('、'));
    return L.join('\n');
  }

  function system() {
    return '你是「' + name() + '」，用户的私人减脂助手，熟悉营养学和中餐。用中文回答，语气温和、直接、像一个懂行的朋友。\n' +
      '下面是用户的实时数据，回答时要结合这些数据，给具体的数字和建议，不要说空话：\n<数据>\n' + context() + '\n</数据>\n\n' +
      '回答格式：\n' +
      '- 可以用 Markdown：### 小标题、**加粗**、列表、表格。简单的问题简短回答，不要每次都长篇大论。\n' +
      '- 推荐具体的一餐时，每一餐单独输出一个卡片代码块，用户可以一键记录：\n```meal\n{"slot":"b|l|d|s","name":"餐名","items":"食材和份量","kcal":数字,"protein":数字,"how":"一两句做法或点单建议"}\n```\n' +
      '- 只有当用户明确要你「帮我记一下/记录」吃了什么时，输出一个记录代码块让用户确认：\n```log\n{"slot":"b|l|d|s","items":[{"name":"食物","amount":"份量","kcal":数字,"protein":数字}]}\n```\n' +
      '  slot：b早餐 l午餐 d晚餐 s加餐，按用户说的或当前时间判断。热量按中餐常见做法估算，算上烹调油。\n' +
      '- 用户要规划明天或之后几天时，在卡片 JSON 里加 "day":"YYYY-MM-DD"（最多到 14 天后），不加就是今天。规划多天时每一餐一个卡片。\n' +
      '原则：\n' +
      '- 建议要安全：不鼓励节食、催吐、断食多天之类的做法，不让每日摄入低于安全底线；每周减重超过 2 斤要提醒放慢。\n' +
      '- 涉及疾病、用药、怀孕、进食障碍迹象时，温和地建议咨询医生，不要做诊断。\n' +
      '- 不知道的就说不知道，不编造数据。';
  }

  /* ---------------- Markdown（简化版） ---------------- */
  function inline(t) {
    return t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  }
  function md(text, msg) {
    const parts = []; const re = /```(\w*)\n?([\s\S]*?)(```|$)/g; let last = 0, m, cardIdx = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: 'md', v: text.slice(last, m.index) });
      parts.push({ t: 'code', lang: m[1], v: m[2], closed: m[3] === '```' });
      last = re.lastIndex; if (m[0] === '') break;
    }
    if (last < text.length) parts.push({ t: 'md', v: text.slice(last) });
    return parts.map((p) => {
      if (p.t === 'code') {
        if (p.lang === 'meal' || p.lang === 'log') {
          if (!p.closed) return '<div class="card-wait">正在准备卡片…</div>';
          let j; try { j = JSON.parse(p.v.trim()); } catch (e) { return ''; }
          const idx = cardIdx++;
          return p.lang === 'meal' ? mealCard(j, msg, idx) : logCard(j, msg, idx);
        }
        return '<pre><code>' + esc(p.v) + '</code></pre>';
      }
      return block(p.v);
    }).join('');
  }
  function block(src) {
    const lines = esc(src).split('\n'); let out = '', list = null, table = [];
    const flushList = () => { if (list) { out += '</' + list + '>'; list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^[\s|:-]+$/.test(r));
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      out += '<div class="md-table"><table><thead><tr>' + cells(rows[0]).map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map((r) => '<tr>' + cells(r).map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      table = [];
    };
    lines.forEach((ln) => {
      const t = ln.trim();
      if (/^\|.*\|$/.test(t)) { flushList(); table.push(t); return; } else flushTable();
      let mm;
      if (!t) { flushList(); return; }
      if ((mm = t.match(/^(#{1,4})\s+(.*)$/))) { flushList(); out += '<h4>' + inline(mm[2]) + '</h4>'; return; }
      if ((mm = t.match(/^[-*•]\s+(.*)$/))) { if (list !== 'ul') { flushList(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(mm[1]) + '</li>'; return; }
      if ((mm = t.match(/^\d+[.、)]\s*(.*)$/))) { if (list !== 'ol') { flushList(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(mm[1]) + '</li>'; return; }
      if (/^-{3,}$/.test(t)) { flushList(); out += '<hr>'; return; }
      flushList(); out += '<p>' + inline(t) + '</p>';
    });
    flushList(); flushTable();
    return out;
  }
  function mealCard(j, msg, idx) {
    const slot = ['b', 'l', 'd', 's'].includes(j.slot) ? j.slot : UI.defaultMeal(); const day = cardDay(j), dw = dayWord(day);
    const done = msg && msg.done && msg.done[idx];
    return '<div class="chat-card" data-card="' + idx + '" data-kind="meal" data-json="' + esc(JSON.stringify({ slot, day, name: j.name, items: j.items, kcal: j.kcal, protein: j.protein })) + '"><div class="cc-head"><span>' + (dw ? dw + ' · ' : '') + MEALS[slot] + '推荐</span><span>' + Math.round(j.kcal || 0) + ' 千卡 · 蛋白质 ' + Math.round(j.protein || 0) + ' 克</span></div>' +
      '<h5>' + esc(j.name || '') + '</h5><p>' + esc(j.items || '') + '</p>' + (j.how ? '<p class="cc-how">' + esc(j.how) + '</p>' : '') +
      '<button type="button" class="btn sm' + (done ? ' ghost' : '') + '" data-act="eat"' + (done ? ' disabled' : '') + '>' + (done ? '已记到' + (dw || '') + MEALS[slot] : (dw ? '加到' + dw + '的计划' : '记为已吃')) + '</button></div>';
  }
  function logCard(j, msg, idx) {
    const slot = ['b', 'l', 'd', 's'].includes(j.slot) ? j.slot : UI.defaultMeal(); const day = cardDay(j), dw = dayWord(day);
    const items = Array.isArray(j.items) ? j.items : [];
    const tot = items.reduce((a, x) => a + (Number(x.kcal) || 0), 0);
    const done = msg && msg.done && msg.done[idx];
    return '<div class="chat-card log" data-card="' + idx + '" data-kind="log" data-json="' + esc(JSON.stringify({ slot, day, items })) + '"><div class="cc-head"><span>记到' + (dw ? dw + ' · ' : '') + MEALS[slot] + '</span><span>合计 ' + Math.round(tot) + ' 千卡</span></div>' +
      '<ul>' + items.map((x) => '<li><span>' + esc(x.name) + (x.amount ? ' <small>' + esc(x.amount) + '</small>' : '') + '</span><b>' + Math.round(x.kcal || 0) + '</b></li>').join('') + '</ul>' +
      '<button type="button" class="btn sm' + (done ? ' ghost' : '') + '" data-act="log"' + (done ? ' disabled' : '') + '>' + (done ? '已记录' : '确认记录') + '</button></div>';
  }

  /* ---------------- 界面 ---------------- */
  function render() {
    const body = $('#chatBody'); const msgs = S().chat;
    $('#chatName').textContent = name();
    if (!msgs.length) {
      const p = S().profile;
      body.innerHTML = '<div class="chat-hello"><div class="hello-mark">' + ICONS.spark + '</div><h2>' + (p.nickname ? esc(p.nickname) + '，' : '') + '你好，我是' + esc(name()) + '</h2>' +
        '<p>我能看到你的体重趋势、今天吃了什么、还剩多少热量。想问什么都可以，也可以让我帮你记录饮食。</p>' +
        '<div class="prompts">' + ['今天推荐我吃什么？', '帮我看看这周的情况', '晚饭还能吃多少，吃什么好？', '点外卖怎么选不容易胖？', '帮我记一下：中午吃了一碗牛肉面', '最近为什么体重不动了？'].map((q) => '<button type="button" class="prompt">' + q + '</button>').join('') + '</div>' +
        (AI.ready() ? '' : '<p class="hint">要先在「我的 → AI 设置」里填写 DeepSeek 密钥。</p>') + '</div>';
      $$('.prompt', body).forEach((b) => b.addEventListener('click', () => { $('#chatInput').value = b.textContent; send(); }));
      return;
    }
    body.innerHTML = msgs.map((m, i) => bubble(m, i)).join('');
    hydrate(body);
    scrollEnd();
  }
  function bubble(m, i) {
    const ph = photosOf(m);
    if (m.role === 'user') return '<div class="msg me" data-i="' + i + '">' + (ph.length ? '<div class="msg-photos n' + Math.min(ph.length, 3) + '">' + ph.map((id) => '<div class="msg-photo" data-photo="' + id + '"></div>').join('') + '</div>' : '') + (m.text ? '<div class="bub">' + esc(m.text).replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
    return '<div class="msg ai" data-i="' + i + '"><div class="bub md">' + (m.text ? md(m.text, m) : '<span class="typing"><i></i><i></i><i></i></span>') + '</div>' +
      (m.text && !m.streaming ? '<div class="msg-tools"><button type="button" data-tool="speak" aria-label="朗读">' + ICONS.speaker + '</button><button type="button" data-tool="copy" aria-label="复制">' + ICONS.copy + '</button></div>' : '') +
      (m.error ? '<p class="msg-err">' + esc(m.error) + '</p>' : '') + '</div>';
  }
  function hydrate(root) {
    $$('[data-photo]', root).forEach(async (el) => { const u = await Photos.url(el.dataset.photo); if (u) { el.innerHTML = '<img alt="发送的照片" src="' + u + '">'; el.addEventListener('click', () => UI.viewPhoto(u)); } });
    $$('.chat-card', root).forEach((c) => {
      const btn = $('[data-act]', c); if (!btn || btn.disabled) return;
      const data = JSON.parse(c.dataset.json);
      const msgEl = c.closest('.msg'); const msg = S().chat[Number(msgEl.dataset.i)]; const idx = Number(c.dataset.card);
      btn.addEventListener('click', () => {
        const today = data.day || D.todayKey(); const future = today > D.todayKey(); const dw = dayWord(today); const list = S().foods[today] || (S().foods[today] = []);
        const items = c.dataset.kind === 'meal' ? [{ name: data.name, amount: String(data.items || '').slice(0, 30), kcal: Number(data.kcal) || 0, protein: Number(data.protein) || 0 }] : data.items.map((x) => ({ name: String(x.name || '食物'), amount: String(x.amount || ''), kcal: Number(x.kcal) || 0, protein: Number(x.protein) || 0 }));
        items.forEach((it) => { const e = { id: D.uid(), meal: data.slot, name: it.name, amount: it.amount, kcal: Math.round(it.kcal), protein: Calc.r1(it.protein), src: future ? 'plan' : 'ai' }; list.push(e); Calc.addUsage(e); });
        msg.done = msg.done || {}; msg.done[idx] = true; Store.save();
        btn.disabled = true; btn.classList.add('ghost'); btn.textContent = c.dataset.kind === 'meal' ? '已记到' + (dw || '') + MEALS[data.slot] : '已记录';
        const B = Calc.budget(today); const who = dw || '今天';
        toast('已记到' + (dw ? dw + '的' : '') + MEALS[data.slot] + '，' + (B.left >= 0 ? who + (future ? '还剩 ' : '还能吃 ') + B.left : who + '超出 ' + (-B.left)) + ' 千卡');
      });
    });
    $$('.msg.ai [data-tool]', root).forEach((b) => b.addEventListener('click', () => {
      const m = S().chat[Number(b.closest('.msg').dataset.i)];
      if (b.dataset.tool === 'copy') { const t = plain(m.text); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('已复制')).catch(() => toast('复制失败，可以长按文字复制')); }
      else speak(m.text);
    }));
  }
  function plain(t) { return t.replace(/```(meal|log)[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').replace(/[#*`>|]/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
  function speak(t) {
    if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(plain(t).slice(0, 1200)); u.lang = 'zh-CN'; u.rate = 1.05;
    const v = speechSynthesis.getVoices().find((x) => /zh[-_]CN/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function scrollEnd() { requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight)); }

  function updateLast() {
    const body = $('#chatBody'); const msgs = S().chat; const i = msgs.length - 1;
    const el = $('.msg[data-i="' + i + '"]', body);
    if (!el) { render(); return; }
    const tmp = document.createElement('div'); tmp.innerHTML = bubble(msgs[i], i);
    const nu = tmp.firstChild; el.replaceWith(nu);
    hydrate(nu);
    const nearBottom = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 220;
    if (nearBottom) scrollEnd();
  }
  function setBusy(b) {
    busy = b;
    const btn = $('#chatSend'); btn.classList.toggle('stop', b); btn.setAttribute('aria-label', b ? '停止' : '发送');
    btn.innerHTML = b ? '<span class="stop-sq"></span>' : ICONS.send;
  }

  async function send() {
    if (busy) { if (ctrl) ctrl.abort(); return; }
    if (!AI.ready()) { toast('先在「我的 → AI 设置」里填写 DeepSeek 密钥'); return; }
    const inp = $('#chatInput'); const text = inp.value.trim();
    if (!text && !pending.length) return;
    const msgs = S().chat;
    const um = { id: D.uid(), role: 'user', text, t: Date.now() };
    let imgs = [];
    if (pending.length) { const batch = pending.slice(); um.photos = []; for (const p of batch) um.photos.push(await Photos.put(p.blob)); imgs = batch.map((p) => p.dataUrl); clearPhotos(); Photos.persist(); }
    msgs.push(um);
    inp.value = ''; autosize();
    const am = { id: D.uid(), role: 'assistant', text: '', t: Date.now(), streaming: true };
    msgs.push(am);
    if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
    Store.save(); render(); setBusy(true);
    // 只带最近 12 条消息，避免越聊越贵
    const hist = msgs.slice(0, -1).slice(-12).map((m) => { const n = photosOf(m).length; return { role: m.role, content: (n && m !== um ? '[发了' + n + '张照片] ' : '') + (m.text || (n ? '（照片）' : '')) }; });
    if (imgs.length) hist[hist.length - 1] = { role: 'user', content: [{ type: 'text', text: (text || (imgs.length === 1 ? '帮我看看这张照片里的食物，大概多少热量？适合我现在吃吗？' : '帮我看看这几张照片里的食物，大概一共多少热量？适合我现在吃吗？')) + (imgs.length > 1 ? '\n（一共 ' + imgs.length + ' 张照片）' : '') }].concat(imgs.map((u) => ({ type: 'image_url', image_url: { url: u } }))) };
    ctrl = new AbortController();
    let lastPaint = 0;
    try {
      await AI.stream([{ role: 'system', content: system() }].concat(hist), (full) => {
        am.text = full; const now = performance.now();
        if (now - lastPaint > 60) { lastPaint = now; updateLast(); }
      }, { signal: ctrl.signal });
    } catch (e) {
      if (!(e && e.kind === 'abort')) am.error = e.message || '出错了，再试一次';
    }
    am.streaming = false; if (!am.text && !am.error) am.error = '没有收到回复，再试一次。';
    Store.save(); setBusy(false); ctrl = null; updateLast();
    if (S().settings.speak && am.text) speak(am.text);
  }

  function autosize() { const t = $('#chatInput'); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
  function clearPhotos() { pending.forEach((p) => URL.revokeObjectURL(p.url)); pending = []; drawPending(); }
  function drawPending() {
    const a = $('#chatAttach');
    if (!pending.length) { a.hidden = true; a.innerHTML = ''; return; }
    a.hidden = false;
    a.innerHTML = '<div class="att-strip">' + pending.map((p, i) => '<span class="att"><img alt="待发送的第' + (i + 1) + '张照片" src="' + p.url + '"><button type="button" data-rm="' + i + '" aria-label="去掉这张">×</button></span>').join('') +
      (pending.length < MAX_PHOTOS ? '<button type="button" class="att-add" id="attMore" aria-label="再加照片">＋</button>' : '') + '</div><span class="att-count">' + pending.length + ' / ' + MAX_PHOTOS + '</span>';
    $$('[data-rm]', a).forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.rm); URL.revokeObjectURL(pending[i].url); pending.splice(i, 1); drawPending(); }));
    const more = $('#attMore', a); if (more) more.addEventListener('click', () => $('#chatPhoto').click());
  }

  function init() {
    $('#chatInput').addEventListener('input', autosize);
    $('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); } });
    $('#chatSend').addEventListener('click', send);
    $('#chatPhotoBtn').addEventListener('click', () => $('#chatPhoto').click());
    $('#chatPhoto').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
      const room = MAX_PHOTOS - pending.length;
      if (files.length > room) toast('一次最多发 ' + MAX_PHOTOS + ' 张，多出来的 ' + (files.length - room) + ' 张没有加上');
      let bad = 0;
      for (const f of files.slice(0, room)) {
        try {
          const blob = await Photos.compress(f, 1024, 0.8);
          const url = URL.createObjectURL(blob);
          const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
          pending.push({ blob, dataUrl, url }); drawPending();
        } catch (err) { bad++; }
      }
      if (bad) toast('有 ' + bad + ' 张图片打不开，换一张试试');
    });
    $('#chatNew').addEventListener('click', () => {
      if (!S().chat.length) return;
      const b = $('#chatNew');
      if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '确定清空？'; setTimeout(() => { b.classList.remove('armed'); b.textContent = '新对话'; }, 3000); return; }
      b.classList.remove('armed'); b.textContent = '新对话';
      S().chat.forEach((m) => photosOf(m).forEach((id) => Photos.del(id)));
      S().chat = []; Store.save(); render();
    });
  }

  window.Assistant = { render, init, context, clear() { S().chat.forEach((m) => photosOf(m).forEach((id) => Photos.del(id))); S().chat = []; Store.save(); } };
})();

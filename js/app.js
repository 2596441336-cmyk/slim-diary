/* 瘦身日记 · 主界面：今天、体重、记录流程、标签切换 */
(function () {
  const { $, $$, esc, MEALS, toast, openSheet, closeSheet, swapSheet, seg, bindSeg, confirmBtn, defaultMeal, ICONS } = UI;
  const S = () => Store.state;
  const r1 = Calc.r1;
  UI.init();

  let curTab = 'today', curDay = D.todayKey();

  /* ---------------- 首次设置 ---------------- */
  function showSetup() {
    const p = Object.assign({}, S().profile);
    const el = $('#setup');
    el.innerHTML = '<div class="setup-inner"><div class="label-mark">瘦身日记</div><h1>先认识一下你</h1><p class="lead">这些信息只用来计算你每天大概需要吃多少，只保存在这台手机上。</p>' +
      '<form id="setupForm" class="form" autocomplete="off"><label class="field"><span>昵称（可不填）</span><input id="pNick" maxlength="12" placeholder="助手会这样称呼你"></label>' + Me.profileForm(p, true) +
      '<button type="submit" class="btn">开始</button></form>' +
      '<p class="fine">这个应用的建议适合一般健康的成年人。如果你有慢性病、正在服药、怀孕或哺乳，每天吃多少请先问医生。</p></div>';
    el.hidden = false;
    Me.bindProfile(el, p);
    $('#setupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = Me.readProfile(el, p); if (err) { toast(err); return; }
      const w = Number($('#pWeight', el).value);
      if (!(w >= 60 && w <= 600)) { toast('请填写现在的体重（斤）'); return; }
      p.nickname = $('#pNick', el).value.trim();
      p.start = { d: D.todayKey(), w: r1(w) }; p.since = p.since || D.todayKey();
      S().profile = p; setWeight(D.todayKey(), r1(w)); Store.save();
      el.hidden = true; Photos.persist();
      showTab('today'); refreshChrome();
      toast('设置好了。按你的情况，每天大约吃 ' + Calc.targets().kcal + ' 千卡。', 4200);
    });
  }

  function setWeight(d, w, waist) {
    const ws = S().weights; const i = ws.findIndex((e) => e.d === d);
    const rec = { d, w: r1(w) };
    if (waist) rec.waist = r1(waist); else if (i >= 0 && ws[i].waist && waist == null) rec.waist = ws[i].waist;
    if (i >= 0) ws[i] = rec; else ws.push(rec);
    ws.sort((a, b) => a.d < b.d ? -1 : 1); Store.save();
  }

  /* ---------------- 今天 ---------------- */
  async function renderToday() {
    const isToday = curDay === D.todayKey();
    $('#dayTitle').textContent = isToday ? '今天 · 周' + D.week[D.parse(curDay).getDay()] + ' ' + D.short(curDay) : D.label(curDay);
    $('#dayNext').disabled = curDay >= D.todayKey();
    const B = Calc.budget(curDay); const body = $('#todayBody');
    if (!B) { body.innerHTML = ''; return; }
    const over = B.left < 0, T = Calc.targets();
    const pctE = Math.min(100, B.eaten / B.total * 100), pctP = Math.min(100, B.protein / B.proteinTarget * 100);
    let html = '<article class="label-card' + (over ? ' is-over' : '') + '">' +
      '<div class="lc-head"><span>营养成分 · ' + (isToday ? '今天' : D.short(curDay)) + '</span><span>' + (T.calibrated ? '已按实际校准' : '估算') + '</span></div>' +
      '<div class="lc-big"><span class="lc-cap">' + (over ? '超出' : '还能吃') + '</span><span class="lc-num">' + Math.abs(B.left) + '</span><span class="lc-unit">千卡</span></div>' +
      '<div class="lc-bar" role="img" aria-label="已吃 ' + B.eaten + ' 千卡，共 ' + B.total + ' 千卡"><i style="width:' + pctE + '%"></i></div>' +
      '<dl class="lc-rows"><div><dt>每日目标</dt><dd>' + B.target + '</dd></div><div><dt>运动加回</dt><dd>' + (B.exercise ? '+' + B.exercise : '0') + '</dd></div><div><dt>已经吃了</dt><dd>' + B.eaten + '</dd></div></dl>' +
      '<div class="lc-prot"><span>蛋白质</span><span class="lc-pbar"><i style="width:' + pctP + '%"></i></span><span class="lc-pval">' + B.protein + ' / ' + B.proteinTarget + ' 克</span></div>' +
      (over ? '<p class="lc-note">今天吃多了一点也没关系，体重看的是一周的平均。明天照常就好。</p>' : '') + '</article>';
    const wToday = S().weights.find((e) => e.d === curDay);
    html += '<div class="weigh-row">' + (wToday
      ? '<span class="wr-label">' + (isToday ? '今天' : '这天') + '的体重</span><b class="wr-val">' + wToday.w + '</b><span class="wr-unit">斤</span><button type="button" class="link" id="wEditToday">修改</button>'
      : '<label for="wQuick" class="wr-label">' + (isToday ? '今天称了吗？' : '这天的体重') + '</label><div class="unit-in sm"><input id="wQuick" type="number" inputmode="decimal" step="0.1" placeholder="' + (Calc.latestWeight() || '') + '"><em>斤</em></div><button type="button" class="btn sm" id="wQuickSave">记下</button>') + '</div>';
    const foods = S().foods[curDay] || [];
    Object.keys(MEALS).forEach((m) => {
      const fs = foods.filter((f) => f.meal === m); const meta = Photos.meta(curDay, m);
      const sum = fs.reduce((a, f) => a + Number(f.kcal || 0), 0);
      html += '<section class="meal"><header><h2>' + MEALS[m] + '</h2><span class="m-sum">' + (sum ? Math.round(sum) + ' 千卡' : '') + '</span>' +
        '<button type="button" class="mini-tool" data-meta="' + m + '" aria-label="' + MEALS[m] + '的备注和照片">' + ICONS.note + '</button>' +
        '<button type="button" class="add-mini" data-add="' + m + '" aria-label="给' + MEALS[m] + '添加">＋</button></header>' +
        (fs.length ? '<ul>' + fs.map((f) => '<li data-id="' + f.id + '"><span class="f-name">' + esc(f.name) + (f.src === 'ai' ? '<em class="tag">AI</em>' : '') + '</span><span class="f-amt">' + esc(f.amount || '') + '</span><span class="f-kcal">' + Math.round(f.kcal) + '</span></li>').join('') + '</ul>' : '') +
        (meta && (meta.note || meta.photos.length) ? '<div class="meal-meta" data-mm="' + m + '">' + (meta.photos.length ? '<div class="mm-ph">' + meta.photos.slice(0, 4).map((id) => '<span class="ph xs" data-id="' + id + '"></span>').join('') + '</div>' : '') + (meta.note ? '<p>' + esc(meta.note) + '</p>' : '') + '</div>' : '') + '</section>';
    });
    const ex = S().exercise[curDay] || [];
    html += '<section class="meal ex"><header><h2>运动</h2><span class="m-sum">' + (ex.length ? Calc.dayExercise(curDay) + ' 千卡' : '') + '</span><button type="button" class="add-mini" id="exAdd" aria-label="添加运动">＋</button></header>' +
      (ex.length ? '<ul>' + ex.map((x) => '<li data-ex="' + x.id + '"><span class="f-name">' + esc(x.name) + '</span><span class="f-amt"></span><span class="f-kcal">' + x.kcal + '</span></li>').join('') + '</ul>' : '<p class="empty-line">运动消耗只按一半加回预算，因为手表和 App 通常会高估。</p>') + '</section>';
    body.innerHTML = html;
    $$('[data-add]', body).forEach((b) => b.addEventListener('click', () => openSearch(b.dataset.add)));
    $$('[data-meta]', body).forEach((b) => b.addEventListener('click', () => Cal.mealSheet(curDay, b.dataset.meta, renderToday)));
    $$('[data-mm]', body).forEach((b) => b.addEventListener('click', () => Cal.mealSheet(curDay, b.dataset.mm, renderToday)));
    $$('li[data-id]', body).forEach((li) => li.addEventListener('click', () => editEntry(li.dataset.id)));
    $$('li[data-ex]', body).forEach((li) => li.addEventListener('click', () => exerciseSheet(li.dataset.ex)));
    $('#exAdd').addEventListener('click', () => exerciseSheet());
    const q = $('#wQuickSave');
    if (q) q.addEventListener('click', () => {
      const v = Number($('#wQuick').value);
      if (!(v >= 60 && v <= 600)) { toast('请输入体重，单位是斤'); return; }
      setWeight(curDay, v); renderToday();
      const prev = S().weights.filter((e) => e.d < curDay).pop();
      toast('记下了。' + (prev && v - prev.w > 0.6 ? '比上次重一点，多半是水分，看趋势就好。' : ''));
    });
    const we = $('#wEditToday'); if (we) we.addEventListener('click', () => weightSheet(curDay));
    for (const el of $$('.mm-ph .ph', body)) { const u = await Photos.url(el.dataset.id); if (u) el.style.backgroundImage = 'url(' + u + ')'; }
  }
  $('#dayPrev').addEventListener('click', () => { curDay = D.add(curDay, -1); renderToday(); });
  $('#dayNext').addEventListener('click', () => { if (curDay < D.todayKey()) { curDay = D.add(curDay, 1); renderToday(); } });
  $('#dayTitle').addEventListener('click', () => { curDay = D.todayKey(); renderToday(); });

  function addEntries(day, meal, items, src) {
    const list = S().foods[day] || (S().foods[day] = []);
    items.forEach((it) => { const e = { id: D.uid(), meal, name: it.name, amount: it.amount || '', kcal: Math.round(it.kcal), protein: r1(it.protein || 0), src: src || 'db' }; list.push(e); Calc.addUsage(e); });
    Store.save(); if (curTab === 'today') renderToday();
  }

  function editEntry(id) {
    const list = S().foods[curDay] || []; const e = list.find((x) => x.id === id); if (!e) return;
    openSheet('<h3 class="sheet-title">' + esc(e.name) + '</h3><form id="edF" class="form" autocomplete="off">' +
      '<label class="field"><span>名称</span><input id="eName" value="' + esc(e.name) + '" maxlength="30"></label>' +
      '<label class="field"><span>份量</span><input id="eAmt" value="' + esc(e.amount) + '" maxlength="30"></label>' +
      '<div class="field-row"><label class="field"><span>热量</span><div class="unit-in"><input id="eKcal" type="number" inputmode="numeric" value="' + Math.round(e.kcal) + '"><em>千卡</em></div></label>' +
      '<label class="field"><span>蛋白质</span><div class="unit-in"><input id="eProt" type="number" inputmode="decimal" step="0.1" value="' + e.protein + '"><em>克</em></div></label></div>' +
      '<label class="field"><span>餐段</span>' + seg('em', MEALS, e.meal) + '</label>' +
      '<div class="actions"><button type="button" class="btn ghost danger" id="eDel">删除</button><button type="submit" class="btn">保存</button></div></form>',
      (root) => {
        let meal = e.meal; bindSeg(root, 'em', (v) => { meal = v; });
        $('#edF', root).addEventListener('submit', (ev) => { ev.preventDefault(); e.name = $('#eName', root).value.trim() || e.name; e.amount = $('#eAmt', root).value.trim(); e.kcal = Math.max(0, Number($('#eKcal', root).value) || 0); e.protein = Math.max(0, Number($('#eProt', root).value) || 0); e.meal = meal; Store.save(); closeSheet(); renderToday(); });
        confirmBtn($('#eDel', root), '再点一次删除', () => { S().foods[curDay] = list.filter((x) => x.id !== id); Store.save(); closeSheet(); renderToday(); });
      });
  }

  function exerciseSheet(id) {
    const list = S().exercise[curDay] || []; const x = id ? list.find((y) => y.id === id) : null;
    const presets = { '快走 30 分钟': 130, '慢跑 30 分钟': 280, '骑车 30 分钟': 220, '游泳 30 分钟': 260, '力量训练 45 分钟': 200, '跳绳 15 分钟': 170, '瑜伽 45 分钟': 140, '跳操 30 分钟': 200 };
    openSheet('<h3 class="sheet-title">' + (x ? '修改运动' : '记一次运动') + '</h3>' +
      (x ? '' : '<div class="chips">' + Object.keys(presets).map((k) => '<button type="button" class="chip" data-p="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>') +
      '<form id="exF" class="form" autocomplete="off"><label class="field"><span>运动</span><input id="xName" maxlength="20" value="' + esc(x ? x.name : '') + '" placeholder="比如：快走 40 分钟"></label>' +
      '<label class="field"><span>消耗</span><div class="unit-in"><input id="xKcal" type="number" inputmode="numeric" value="' + (x ? x.kcal : '') + '" placeholder="手表或 App 上的数字"><em>千卡</em></div><small>只按一半加回今天的预算。</small></label>' +
      '<div class="actions">' + (x ? '<button type="button" class="btn ghost danger" id="xDel">删除</button>' : '<button type="button" class="btn ghost" data-close>取消</button>') + '<button type="submit" class="btn">保存</button></div></form>',
      (root) => {
        $$('[data-p]', root).forEach((b) => b.addEventListener('click', () => { $('#xName', root).value = b.dataset.p; $('#xKcal', root).value = presets[b.dataset.p]; }));
        $('#exF', root).addEventListener('submit', (e) => {
          e.preventDefault(); const name = $('#xName', root).value.trim(), kcal = Math.round(Number($('#xKcal', root).value));
          if (!name || !(kcal > 0)) { toast('请填写运动和消耗'); return; }
          if (x) { x.name = name; x.kcal = kcal; } else (S().exercise[curDay] || (S().exercise[curDay] = [])).push({ id: D.uid(), name, kcal });
          Store.save(); closeSheet(); renderToday();
        });
        if (x) confirmBtn($('#xDel', root), '再点一次删除', () => { S().exercise[curDay] = list.filter((y) => y.id !== id); Store.save(); closeSheet(); renderToday(); });
      });
  }

  /* ---------------- 搜索 / 份量 / 手动 ---------------- */
  function foodRow(f, extra) { return '<button type="button" class="food-row" ' + extra + '><span class="fr-name">' + esc(f.name) + '</span><span class="fr-sv">' + esc(f.serving || f.amount || '') + '</span><span class="fr-kcal">' + Math.round(f.kcal) + '<small>千卡</small></span></button>'; }
  function openSearch(meal) {
    meal = meal || defaultMeal(); let cat = '常吃';
    const tabs = ['常吃', '我的食物'].concat(Foods.CATS);
    openSheet('<h3 class="sheet-title">添加到<span id="sMealName">' + MEALS[meal] + '</span></h3>' + seg('sm', MEALS, meal) +
      '<div class="search-box"><input id="sQ" type="search" placeholder="搜食物，比如：番茄炒蛋、拿铁" autocomplete="off" enterkeyhint="search"></div>' +
      '<div class="cat-tabs" id="sCats">' + tabs.map((c) => '<button type="button" data-c="' + esc(c) + '"' + (c === cat ? ' class="on"' : '') + '>' + esc(c) + '</button>').join('') + '</div>' +
      '<div class="food-list" id="sList"></div><button type="button" class="btn ghost" id="sManual">找不到？手动输入</button>',
      (root) => {
        bindSeg(root, 'sm', (v) => { meal = v; $('#sMealName', root).textContent = MEALS[v]; });
        const list = $('#sList', root), q = $('#sQ', root);
        function show(items, emptyTxt) {
          list.innerHTML = items.length ? items.map((f, i) => foodRow(f, 'data-i="' + i + '"')).join('') : '<p class="empty-line">' + emptyTxt + '</p>';
          $$('[data-i]', list).forEach((b) => b.addEventListener('click', () => { const f = items[Number(b.dataset.i)]; swapSheet(() => portionSheet(f, meal)); }));
        }
        function showCat() {
          if (cat === '常吃') {
            const u = S().usage;
            const items = Object.keys(u).sort((a, b) => (u[b].n * 2 + u[b].last / 864e5) - (u[a].n * 2 + u[a].last / 864e5)).slice(0, 30)
              .map((n) => Foods.find(n) || { name: n, serving: u[n].amount || '1份', kcal: u[n].kcal, protein: u[n].protein, g: 0, alias: [], cat: '常吃' });
            show(items, '吃过的东西会出现在这里，下次一点就能加。');
          } else if (cat === '我的食物') show(S().custom, '还没有自己添加的食物。用「手动输入」时勾选「存到我的食物」就会出现在这里。');
          else show(Foods.byCat(cat), '');
        }
        $('#sCats', root).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; q.value = ''; $$('#sCats button', root).forEach((x) => x.classList.toggle('on', x === b)); showCat(); });
        q.addEventListener('input', () => { const v = q.value.trim(); if (!v) { showCat(); return; } show(Foods.search(v), '没找到「' + esc(v) + '」。可以手动输入' + (AI.ready() ? '，或者用「说一句」让 AI 估算。' : '。')); });
        $('#sManual', root).addEventListener('click', () => swapSheet(() => manualSheet(meal, { name: q.value.trim() })));
        showCat();
      });
  }
  function portionSheet(f, meal) {
    let mult = 1; const hasG = f.g > 0;
    openSheet('<h3 class="sheet-title">' + esc(f.name) + '</h3><p class="sheet-sub">' + esc(f.serving) + (hasG ? '（约 ' + f.g + ' 克）' : '') + ' · ' + f.kcal + ' 千卡 · 蛋白质 ' + f.protein + ' 克' + (f.cat === '我的食物' ? '' : '<br><span class="faint">估算值，实际会因做法和用油不同有出入。</span>') + '</p>' +
      '<div class="field"><span class="f-lab">吃了多少</span>' + seg('mul', [[0.5, '半份'], [1, '1 份'], [1.5, '1.5 份'], [2, '2 份'], [3, '3 份']], 1) + '</div>' +
      (hasG ? '<label class="field"><span class="f-lab">或者直接填克数</span><div class="unit-in"><input id="pG" type="number" inputmode="decimal" placeholder="' + f.g + '"><em>克</em></div></label>' : '') +
      '<div class="field"><span class="f-lab">餐段</span>' + seg('pm', MEALS, meal) + '</div>' +
      '<div class="portion-total"><span>合计</span><b id="pK">' + f.kcal + '</b><span>千卡 · 蛋白质 <b id="pP">' + f.protein + '</b> 克</span></div>' +
      '<button type="button" class="btn" id="pAdd">添加</button>',
      (root) => {
        const upd = () => { $('#pK', root).textContent = Math.round(f.kcal * mult); $('#pP', root).textContent = r1(f.protein * mult); };
        bindSeg(root, 'mul', (v) => { mult = Number(v); if ($('#pG', root)) $('#pG', root).value = ''; upd(); });
        bindSeg(root, 'pm', (v) => { meal = v; });
        const g = $('#pG', root);
        if (g) g.addEventListener('input', () => { const v = Number(g.value); if (v > 0) { mult = v / f.g; $$('[data-seg="mul"] button', root).forEach((b) => b.classList.remove('on')); upd(); } });
        $('#pAdd', root).addEventListener('click', () => {
          const gv = g && Number(g.value) > 0 ? Number(g.value) : null;
          const amount = gv ? gv + '克' : (mult === 1 ? f.serving : mult === 0.5 ? '半份（' + f.serving + '）' : mult + ' × ' + f.serving);
          addEntries(curDay, meal, [{ name: f.name, amount, kcal: f.kcal * mult, protein: f.protein * mult }], f.cat === '我的食物' ? 'custom' : 'db');
          closeSheet(); toast('已添加到' + MEALS[meal]);
        });
      });
  }
  function manualSheet(meal, pre) {
    pre = pre || {};
    openSheet('<h3 class="sheet-title">手动输入</h3><form id="mF" class="form" autocomplete="off">' +
      '<label class="field"><span>名称</span><input id="mName" maxlength="30" value="' + esc(pre.name || '') + '" placeholder="比如：公司楼下的鸡肉卷"></label>' +
      '<label class="field"><span>份量</span><input id="mAmt" maxlength="30" value="' + esc(pre.amount || '1份') + '"></label>' +
      '<div class="field-row"><label class="field"><span>热量</span><div class="unit-in"><input id="mKcal" type="number" inputmode="numeric" placeholder="包装上的数字"><em>千卡</em></div></label>' +
      '<label class="field"><span>蛋白质（可不填）</span><div class="unit-in"><input id="mProt" type="number" inputmode="decimal" step="0.1"><em>克</em></div></label></div>' +
      '<p class="hint">包装上写的是千焦（kJ）的话，除以 4.184 就是千卡。</p>' +
      '<label class="field"><span>餐段</span>' + seg('mm', MEALS, meal) + '</label>' +
      '<label class="check"><input type="checkbox" id="mSave" checked><span>存到「我的食物」，下次直接搜到</span></label>' +
      '<div class="actions"><button type="button" class="btn ghost" data-close>取消</button><button type="submit" class="btn">添加</button></div></form>',
      (root) => {
        bindSeg(root, 'mm', (v) => { meal = v; });
        $('#mF', root).addEventListener('submit', (e) => {
          e.preventDefault();
          const name = $('#mName', root).value.trim(), kcal = Number($('#mKcal', root).value), prot = Number($('#mProt', root).value) || 0, amount = $('#mAmt', root).value.trim() || '1份';
          if (!name || $('#mKcal', root).value === '' || !(kcal >= 0)) { toast('请填写名称和热量'); return; }
          if ($('#mSave', root).checked) saveCustom({ name, serving: amount, kcal, protein: prot });
          addEntries(curDay, meal, [{ name, amount, kcal, protein: prot }], 'manual'); closeSheet(); toast('已添加到' + MEALS[meal]);
        });
      });
  }
  function saveCustom(f) {
    const c = S().custom; const i = c.findIndex((x) => x.name === f.name);
    const rec = { id: i >= 0 ? c[i].id : D.uid(), name: f.name, alias: [], cat: '我的食物', serving: f.serving || '1份', g: Number(f.g) || 0, kcal: Math.round(f.kcal), protein: r1(f.protein || 0) };
    if (i >= 0) c[i] = rec; else c.unshift(rec);
    Store.save();
  }

  /* ---------------- 拍照 / 说一句 ---------------- */
  function needKey() {
    openSheet('<h3 class="sheet-title">需要先填写 DeepSeek 密钥</h3><p class="sheet-sub">助手、拍照识别和一句话记录都要用到 AI。填好密钥就能用；不填也可以用「搜索」和「手动输入」来记录。</p>' +
      '<div class="actions"><button type="button" class="btn ghost" id="nkSearch">先用搜索</button><button type="button" class="btn" id="nkGo">去填写</button></div>',
      (root) => {
        $('#nkSearch', root).addEventListener('click', () => swapSheet(() => { showTab('today'); openSearch(); }));
        $('#nkGo', root).addEventListener('click', () => { closeSheet(); showTab('me'); Me.go('ai'); });
      });
  }
  $('#qPhoto').addEventListener('click', () => { if (!AI.ready()) { needKey(); return; } $('#photoInput').click(); });
  $('#qSearch').addEventListener('click', () => openSearch());
  $('#qText').addEventListener('click', () => { if (!AI.ready()) { needKey(); return; } textSheet(); });
  $('#photoInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) photoSheet(f); });

  function photoSheet(file) {
    const url = URL.createObjectURL(file); let meal = defaultMeal();
    openSheet('<div class="photo-prev"><img src="' + url + '" alt="要识别的照片"></div>' +
      '<label class="field"><span class="f-lab">补充说明（可不填）</span><input id="phNote" maxlength="60" placeholder="比如：米饭只吃了一半、是少油版"></label>' +
      '<div class="field"><span class="f-lab">餐段</span>' + seg('phm', MEALS, meal) + '</div>' +
      '<button type="button" class="btn" id="phGo">识别热量</button>',
      (root) => {
        bindSeg(root, 'phm', (v) => { meal = v; });
        $('#phGo', root).addEventListener('click', async () => {
          const btn = $('#phGo', root); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>正在识别…';
          try { const res = await AI.recognizePhoto(file, $('#phNote', root).value.trim()); URL.revokeObjectURL(url); res.file = file; swapSheet(() => resultSheet(res, meal)); }
          catch (e) { btn.disabled = false; btn.textContent = '再试一次'; toast(e.message || '识别失败', 5200); }
        });
      });
  }
  function textSheet() {
    let meal = defaultMeal();
    openSheet('<h3 class="sheet-title">说一句吃了什么</h3><textarea id="tDesc" rows="3" maxlength="200" placeholder="比如：中午吃了一份黄焖鸡米饭，饭剩了一半，喝了一杯三分糖奶茶"></textarea>' +
      '<p class="hint">可以用 iPhone 键盘上的麦克风直接说。</p><div class="field"><span class="f-lab">餐段</span>' + seg('tm', MEALS, meal) + '</div>' +
      '<button type="button" class="btn" id="tGo">估算热量</button>',
      (root) => {
        bindSeg(root, 'tm', (v) => { meal = v; }); setTimeout(() => $('#tDesc', root).focus(), 300);
        $('#tGo', root).addEventListener('click', async () => {
          const d = $('#tDesc', root).value.trim(); if (!d) { toast('先写一下吃了什么'); return; }
          const btn = $('#tGo', root); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>正在估算…';
          try { const res = await AI.parseText(d); swapSheet(() => resultSheet(res, meal)); }
          catch (e) { btn.disabled = false; btn.textContent = '再试一次'; toast(e.message || '估算失败', 5200); }
        });
      });
  }
  function resultSheet(res, meal) {
    const items = res.items.map((x) => Object.assign({ on: true, mult: 1 }, x));
    if (!items.length) { openSheet('<h3 class="sheet-title">没认出食物</h3><p class="sheet-sub">' + esc(res.tip || '换个角度再拍一张，或者用搜索添加。') + '</p><div class="actions"><button type="button" class="btn ghost" data-close>关闭</button><button type="button" class="btn" id="rSearch">用搜索添加</button></div>', (root) => { $('#rSearch', root).addEventListener('click', () => swapSheet(() => openSearch(meal))); }); return; }
    const total = () => items.filter((x) => x.on).reduce((a, x) => a + x.kcal * x.mult, 0);
    openSheet((res.image ? '<div class="photo-prev sm"><img src="' + res.image + '" alt=""></div>' : '') +
      '<h3 class="sheet-title">识别结果 <span class="conf conf-' + ({ 高: 'h', 中: 'm', 低: 'l' }[res.confidence]) + '">把握：' + res.confidence + '</span></h3>' +
      '<p class="sheet-sub">AI 估算通常有两三成的误差，可以直接改数字。不对的项取消勾选。</p>' +
      '<div class="res-list">' + items.map((x, i) =>
        '<div class="res-item" data-i="' + i + '"><label class="res-check"><input type="checkbox" checked aria-label="添加' + esc(x.name) + '"></label>' +
        '<div class="res-main"><input class="res-name" value="' + esc(x.name) + '" maxlength="30" aria-label="名称"><span class="res-amt">' + esc(x.amount) + '</span></div>' +
        '<div class="res-num"><input type="number" inputmode="numeric" class="res-kcal" value="' + x.kcal + '" aria-label="千卡"><small>千卡 · ' + x.protein + 'g 蛋白</small></div>' +
        '<div class="res-mult">' + [0.5, 1, 1.5].map((m) => '<button type="button" data-m="' + m + '"' + (m === 1 ? ' class="on"' : '') + '>' + (m === 0.5 ? '½' : m === 1 ? '×1' : '×1.5') + '</button>').join('') + '</div></div>').join('') + '</div>' +
      (res.tip ? '<p class="ai-tip">' + esc(res.tip) + '</p>' : '') +
      '<div class="field"><span class="f-lab">餐段</span>' + seg('rm', MEALS, meal) + '</div>' +
      '<div class="portion-total"><span>合计</span><b id="rTot">' + Math.round(total()) + '</b><span>千卡</span></div>' +
      (res.file ? '<label class="check"><input type="checkbox" id="rKeep" checked><span>把照片存到这一餐（只存在手机上）</span></label>' : '') +
      '<label class="check"><input type="checkbox" id="rSave"><span>同时存到「我的食物」</span></label>' +
      '<button type="button" class="btn" id="rAdd">添加</button>',
      (root) => {
        bindSeg(root, 'rm', (v) => { meal = v; });
        const upd = () => { $('#rTot', root).textContent = Math.round(total()); };
        $$('.res-item', root).forEach((row) => {
          const x = items[Number(row.dataset.i)];
          $('input[type=checkbox]', row).addEventListener('change', (e) => { x.on = e.target.checked; row.classList.toggle('off', !x.on); upd(); });
          $('.res-kcal', row).addEventListener('input', (e) => { const old = x.kcal; x.kcal = Math.max(0, Number(e.target.value) || 0); if (old) x.protein = r1(x.protein * x.kcal / old); upd(); });
          $('.res-name', row).addEventListener('input', (e) => { x.name = e.target.value.trim() || x.name; });
          $$('.res-mult button', row).forEach((b) => b.addEventListener('click', () => { x.mult = Number(b.dataset.m); $$('.res-mult button', row).forEach((y) => y.classList.toggle('on', y === b)); upd(); }));
        });
        $('#rAdd', root).addEventListener('click', async () => {
          const chosen = items.filter((x) => x.on); if (!chosen.length) { toast('至少选一项'); return; }
          const out = chosen.map((x) => ({ name: x.name, amount: (x.mult !== 1 ? (x.mult === 0.5 ? '半份 · ' : '1.5 份 · ') : '') + x.amount, kcal: x.kcal * x.mult, protein: x.protein * x.mult }));
          if ($('#rSave', root).checked) chosen.forEach((x) => saveCustom({ name: x.name, serving: x.amount || '1份', g: x.grams, kcal: x.kcal, protein: x.protein }));
          const keep = res.file && $('#rKeep', root) && $('#rKeep', root).checked;
          addEntries(curDay, meal, out, 'ai'); closeSheet(); toast('已添加到' + MEALS[meal]);
          if (keep) { try { await Photos.addToMeal(curDay, meal, res.file); if (curTab === 'today') renderToday(); } catch (e) {} }
        });
      });
  }

  /* ---------------- 体重 ---------------- */
  let range = 30; try { range = Number(localStorage.getItem('slimdiary.range')) || 30; } catch (e) {}
  function renderWeight() {
    const body = $('#weightBody'); const A = Calc.analysis();
    if (!A.stats) { body.innerHTML = '<div class="empty"><p>还没有体重记录。</p><button type="button" class="btn" id="wFirst">记录第一次体重</button></div>'; $('#wFirst').addEventListener('click', () => weightSheet()); return; }
    const st = A.stats, rate = st.weekRate;
    let html = '<div class="stat-grid">' +
      '<div class="stat main"><span class="s-cap">趋势体重</span><span class="s-num">' + st.trend.toFixed(1) + '<small>斤</small></span><span class="s-sub">最近一次称 ' + st.latest + ' 斤</span></div>' +
      '<div class="stat"><span class="s-cap">已经减了</span><span class="s-num">' + (st.lost > 0 ? st.lost.toFixed(1) : '0') + '<small>斤</small></span><span class="s-sub">起点 ' + st.startW + ' 斤</span></div>' +
      '<div class="stat"><span class="s-cap">每周变化</span><span class="s-num">' + (rate == null ? '—' : (rate > 0 ? '+' : '') + rate.toFixed(1)) + '<small>' + (rate == null ? '' : '斤') + '</small></span><span class="s-sub">' + (rate == null ? '再记几天' : '最近两周平均') + '</span></div>' +
      '<div class="stat"><span class="s-cap">预计到达目标</span><span class="s-num sm">' + (st.eta ? D.short(st.eta) : '—') + '</span><span class="s-sub">' + (st.goal ? '目标 ' + st.goal + ' 斤' : '还没设目标') + (st.eta ? ' · ' + D.parse(st.eta).getFullYear() + '年' : '') + '</span></div></div>';
    if (st.pct != null) html += '<div class="goal-bar" role="img" aria-label="完成了目标的 ' + st.pct + '%"><span>' + st.startW + '</span><div class="gb-track"><i style="width:' + Math.max(2, st.pct) + '%"></i></div><span>' + st.goal + '</span><b>' + st.pct + '%</b></div>';
    html += '<div class="chart-card"><div class="chart-head"><h2>趋势</h2>' + seg('rg', [[14, '2周'], [30, '1月'], [90, '3月'], [0, '全部']], range, 'mini') + '</div><div id="chart"></div>' +
      '<div class="legend"><span><i class="lg-dot"></i>每天称的</span><span><i class="lg-line"></i>平滑后的趋势</span>' + (st.goal ? '<span><i class="lg-goal"></i>目标</span>' : '') + '</div></div>';
    if (A.lines.length) html += '<div class="insights">' + A.lines.map((l) => '<p class="ins ins-' + l.k + '">' + esc(l.t) + '</p>').join('') + '</div>';
    const W = Calc.weeks(4);
    html += '<div class="card"><h2>最近四周</h2><div class="md-table"><table class="wk"><thead><tr><th>周</th><th>平均体重</th><th>趋势变化</th><th>平均摄入</th></tr></thead><tbody>' +
      W.map((w, i) => '<tr><td>' + (i === 0 ? '这周' : D.short(w.start) + '–' + D.short(w.end)) + '</td><td>' + (w.avgW == null ? '—' : w.avgW) + '</td><td class="' + (w.change < 0 ? 'down' : w.change > 0 ? 'up' : '') + '">' + (w.change == null ? '—' : (w.change > 0 ? '+' : '') + w.change) + '</td><td>' + (w.avgIn == null ? '—' : w.avgIn + '<small> · ' + w.logged + '天</small>') + '</td></tr>').join('') +
      '</tbody></table></div><p class="hint">按周看比按天看更准。摄入只算有记录的天。</p></div>';
    const ws = S().weights.slice().reverse().slice(0, 60);
    html += '<div class="card"><h2>记录</h2><ul class="w-list">' + ws.map((e, i) => { const prev = ws[i + 1]; const d = prev ? r1(e.w - prev.w) : null; return '<li data-d="' + e.d + '"><span>' + D.label(e.d) + '</span><b>' + e.w + '</b>' + (d != null ? '<em class="' + (d < 0 ? 'down' : d > 0 ? 'up' : '') + '">' + (d > 0 ? '+' : '') + d + '</em>' : '<em></em>') + (e.waist ? '<small>腰 ' + e.waist + '</small>' : '<small></small>') + '</li>'; }).join('') + '</ul></div>';
    body.innerHTML = html;
    bindSeg(body, 'rg', (v) => { range = Number(v); try { localStorage.setItem('slimdiary.range', range); } catch (e) {} drawChart(); });
    $$('.w-list li', body).forEach((li) => li.addEventListener('click', () => weightSheet(li.dataset.d)));
    drawChart();
  }
  function drawChart() {
    const el = $('#chart'); if (!el) return;
    let series = Calc.trendSeries(); if (range) series = series.slice(-range);
    if (series.length < 2) { el.innerHTML = '<p class="empty-line">再记几天，就能看到趋势线。</p>'; return; }
    const goal = Number(S().profile.goal) || null;
    const W = 340, H = 200, L = 34, R = 8, T = 12, B = 26;
    const vals = series.map((p) => p.t).concat(series.filter((p) => p.w != null).map((p) => p.w));
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const showGoal = goal && goal >= lo - 6 && goal <= hi + 6;
    if (showGoal) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
    const padV = Math.max(0.5, (hi - lo) * 0.12); lo -= padV; hi += padV;
    const step = [0.5, 1, 2, 5, 10, 20].find((s) => (hi - lo) / s <= 5) || 20;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const n = series.length;
    const x = (i) => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重趋势图">';
    for (let v = lo; v <= hi + 1e-9; v += step) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 3.5) + '" class="ax" text-anchor="end">' + (step < 1 ? v.toFixed(1) : v) + '</text>';
    const xt = n <= 8 ? series.map((_, i) => i) : [0, Math.round((n - 1) / 2), n - 1];
    xt.forEach((i) => { svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" class="ax" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + D.short(series[i].d) + '</text>'; });
    if (showGoal) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(goal) + '" y2="' + y(goal) + '" class="goal"/><text x="' + (W - R) + '" y="' + (y(goal) - 4) + '" class="ax goal-t" text-anchor="end">目标 ' + goal + '</text>';
    const pts = series.map((p, i) => x(i).toFixed(1) + ',' + y(p.t).toFixed(1));
    svg += '<path class="area" d="M' + x(0) + ',' + (H - B) + ' L' + pts.join(' L') + ' L' + x(n - 1) + ',' + (H - B) + ' Z"/>';
    series.forEach((p, i) => { if (p.w != null) svg += '<line class="stem" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + y(p.w) + '" y2="' + y(p.t) + '"/>'; });
    svg += '<polyline class="trend" points="' + pts.join(' ') + '"/>';
    series.forEach((p, i) => { if (p.w != null) svg += '<circle class="dot" cx="' + x(i) + '" cy="' + y(p.w) + '" r="' + (n > 60 ? 1.8 : 2.6) + '"/>'; });
    svg += '<circle class="end" cx="' + x(n - 1) + '" cy="' + y(series[n - 1].t) + '" r="4.2"/></svg>';
    el.innerHTML = svg;
  }
  function weightSheet(d) {
    const e = d ? S().weights.find((x) => x.d === d) : null; d = d || D.todayKey();
    openSheet('<h3 class="sheet-title">' + (e ? '修改体重' : '记录体重') + '</h3><form id="wF" class="form" autocomplete="off">' +
      '<label class="field"><span>日期</span><input id="wD" type="date" value="' + d + '" max="' + D.todayKey() + '"></label>' +
      '<div class="field-row"><label class="field"><span>体重</span><div class="unit-in"><input id="wW" type="number" inputmode="decimal" step="0.1" value="' + (e ? e.w : '') + '" placeholder="' + (Calc.latestWeight() || '') + '"><em>斤</em></div></label>' +
      '<label class="field"><span>腰围（可不填）</span><div class="unit-in"><input id="wWa" type="number" inputmode="decimal" step="0.5" value="' + (e && e.waist ? e.waist : '') + '"><em>厘米</em></div></label></div>' +
      '<p class="hint">腰围在肚脐上方一点、最细的地方量，呼气后不要用力收腹。</p>' +
      '<div class="actions">' + (e ? '<button type="button" class="btn ghost danger" id="wDel">删除</button>' : '<button type="button" class="btn ghost" data-close>取消</button>') + '<button type="submit" class="btn">保存</button></div></form>',
      (root) => {
        if (!e) setTimeout(() => $('#wW', root).focus(), 300);
        $('#wF', root).addEventListener('submit', (ev) => {
          ev.preventDefault(); const nd = $('#wD', root).value, w = Number($('#wW', root).value), wa = Number($('#wWa', root).value) || null;
          if (!nd || nd > D.todayKey()) { toast('请选择今天或以前的日期'); return; }
          if (!(w >= 60 && w <= 600)) { toast('请输入体重，单位是斤'); return; }
          if (e && nd !== e.d) S().weights = S().weights.filter((x) => x.d !== e.d);
          setWeight(nd, w, wa); closeSheet(); refresh(); toast('已保存');
        });
        if (e) confirmBtn($('#wDel', root), '再点一次删除', () => { S().weights = S().weights.filter((x) => x.d !== e.d); Store.save(); closeSheet(); refresh(); });
      });
  }
  $('#wAdd').addEventListener('click', () => weightSheet());

  /* ---------------- 标签页 ---------------- */
  function showTab(t) {
    if (t === 'me' && curTab !== 'me') Me.reset();
    curTab = t;
    $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== t; });
    $('#quick').hidden = t !== 'today'; $('#chatBar').hidden = t !== 'chat';
    document.body.dataset.tab = t;
    refresh();
    if (t !== 'chat') window.scrollTo(0, 0);
    try { sessionStorage.setItem('slimdiary.tab', t); } catch (e) {}
  }
  function refresh() {
    if (curTab === 'today') renderToday();
    else if (curTab === 'weight') renderWeight();
    else if (curTab === 'chat') Assistant.render();
    else if (curTab === 'plan') Cal.render();
    else if (curTab === 'me') Me.render();
  }
  function refreshChrome() { const n = (S().settings.assistantName || '助手').slice(0, 6); $('#tabChatLabel').textContent = n; $('#chatName').textContent = n; }
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'today' && curTab === 'today') curDay = D.todayKey(); if (b.dataset.tab === 'me' && curTab === 'me') Me.reset(); showTab(b.dataset.tab); }));

  window.App = {
    showTab, refresh, needKey, saveCustom, refreshChrome, showSetup,
    addEntries(day, meal, items, src) { addEntries(day, meal, items, src); },
    goDay(day) { curDay = day; showTab('today'); }
  };

  /* ---------------- 启动 ---------------- */
  Assistant.init(); refreshChrome();
  const prof = S().profile;
  if (!prof.sex || !prof.age || !prof.height || !S().weights.length) showSetup();
  let start = 'today'; try { start = sessionStorage.getItem('slimdiary.tab') || 'today'; } catch (e) {}
  showTab(start);
  let lastDay = D.todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (D.todayKey() !== lastDay) { if (curDay === lastDay) curDay = D.todayKey(); lastDay = D.todayKey(); }
    if (curTab !== 'chat') refresh();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();

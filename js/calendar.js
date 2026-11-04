/* 食谱页：饮食日历（每顿吃了什么、热量、备注、照片）+ 今日食谱推荐 */
(function () {
  const { $, $$, esc, MEALS, toast, ICONS } = UI;
  const S = () => Store.state;
  const pad = (n) => String(n).padStart(2, '0');
  let month = D.todayKey().slice(0, 7), sel = D.todayKey(), aiBusy = false;
  const maxDay = () => D.add(D.todayKey(), 14); // 最多可以提前规划 14 天

  /* ---------------- 每顿饭的备注和照片 ---------------- */
  function mealSheet(day, meal, after) {
    const m = Photos.meta(day, meal) || { note: '', photos: [] };
    UI.openSheet('<h3 class="sheet-title">' + D.label(day) + ' · ' + MEALS[meal] + '</h3>' +
      '<label class="field"><span>备注</span><textarea id="mmNote" rows="3" maxlength="300" placeholder="比如：和同事聚餐、吃完有点撑、今天特别想吃甜的">' + esc(m.note) + '</textarea></label>' +
      '<div class="field"><span class="f-lab">照片 <small class="faint">只保存在这台手机上</small></span><div class="ph-grid" id="mmPhotos"></div></div>' +
      '<input type="file" id="mmFile" accept="image/*" hidden>' +
      '<button type="button" class="btn" data-close>完成</button>',
      (root) => {
        const grid = $('#mmPhotos', root);
        async function draw() {
          const mm = Photos.meta(day, meal) || { photos: [] };
          grid.innerHTML = mm.photos.map((id) => '<button type="button" class="ph" data-id="' + id + '" aria-label="查看照片"></button>').join('') + '<button type="button" class="ph add" id="mmAdd" aria-label="添加照片">' + ICONS.plus + '</button>';
          for (const b of $$('.ph[data-id]', grid)) { const u = await Photos.url(b.dataset.id); if (u) { b.style.backgroundImage = 'url(' + u + ')'; b.addEventListener('click', () => UI.viewPhoto(u, async () => { await Photos.removeFromMeal(day, meal, b.dataset.id); draw(); changed(); })); } }
          $('#mmAdd', grid).addEventListener('click', () => $('#mmFile', root).click());
        }
        function changed() { if (after) after(); }
        $('#mmFile', root).addEventListener('change', async (e) => {
          const fs = Array.from(e.target.files || []); e.target.value = '';
          for (const f of fs) { try { await Photos.addToMeal(day, meal, f); } catch (err) { toast('有一张图片打不开'); } }
          draw(); changed();
        });
        $('#mmNote', root).addEventListener('input', (e) => { const mm = Photos.meta(day, meal, true); mm.note = e.target.value.trim(); Store.save(); });
        $('#mmNote', root).addEventListener('change', changed);
        draw();
      });
  }

  /* ---------------- 日历 ---------------- */
  function monthDays(ym) {
    const [y, mo] = ym.split('-').map(Number);
    const first = new Date(y, mo - 1, 1), n = new Date(y, mo, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // 周一开头
    return { y, mo, n, lead };
  }
  function shiftMonth(k) { const [y, mo] = month.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); month = d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  function renderCalendar() {
    const el = $('#calBody'); const { y, mo, n, lead } = monthDays(month);
    const today = D.todayKey();
    let cells = '', logged = 0, sum = 0;
    for (let i = 0; i < lead; i++) cells += '<span class="cal-cell blank"></span>';
    for (let d = 1; d <= n; d++) {
      const key = y + '-' + pad(mo) + '-' + pad(d);
      const st = Calc.dayStatus(key); const meta = S().mealMeta[key];
      const hasPhoto = meta && Object.values(meta).some((x) => x.photos && x.photos.length);
      const hasNote = meta && Object.values(meta).some((x) => x.note);
      if (st.kcal && key <= today) { logged++; sum += st.kcal; }
      cells += '<button type="button" class="cal-cell s-' + st.s + (key === today ? ' today' : '') + (key === sel ? ' sel' : '') + (key > maxDay() ? ' future' : key > today ? ' ahead' : '') + '" data-d="' + key + '" aria-label="' + D.label(key) + (st.kcal ? (key > today ? '，计划 ' : '，') + st.kcal + ' 千卡' : (key > today ? '，还没有计划' : '，没有记录')) + '">' +
        '<span class="cd">' + d + '</span><span class="ck">' + (st.kcal || '') + '</span><span class="cm">' + (hasPhoto ? '<i class="m-ph"></i>' : '') + (hasNote ? '<i class="m-nt"></i>' : '') + '</span></button>';
    }
    el.innerHTML = '<div class="cal-head"><button type="button" class="icon-btn" id="calPrev" aria-label="上个月">‹</button><h2>' + y + '年' + mo + '月</h2><button type="button" class="icon-btn" id="calNext" aria-label="下个月"' + (month >= maxDay().slice(0, 7) ? ' disabled' : '') + '>›</button></div>' +
      '<div class="cal-week">' + ['一', '二', '三', '四', '五', '六', '日'].map((w) => '<span>' + w + '</span>').join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<div class="cal-legend"><span><i class="lg s-plan"></i>计划</span><span><i class="lg s-ok"></i>正常</span><span><i class="lg s-low"></i>偏少</span><span><i class="lg s-over"></i>超出</span><span><i class="m-ph"></i>有照片</span><span><i class="m-nt"></i>有备注</span></div>' +
      '<p class="cal-sum">这个月记录了 <b>' + logged + '</b> 天' + (logged ? '，平均每天 <b>' + Math.round(sum / logged) + '</b> 千卡' : '') + '</p>';
    $('#calPrev').addEventListener('click', () => { shiftMonth(-1); renderCalendar(); });
    $('#calNext').addEventListener('click', () => { shiftMonth(1); renderCalendar(); });
    $$('.cal-cell[data-d]', el).forEach((b) => b.addEventListener('click', () => { if (b.dataset.d > maxDay()) { toast('最多可以提前规划 14 天'); return; } sel = b.dataset.d; renderCalendar(); renderDay(); }));
  }

  async function renderDay() {
    const el = $('#calDay'); const day = sel;
    const fs = S().foods[day] || []; const B = Calc.budget(day);
    const tot = Math.round(Calc.dayFoodKcal(day));
    const future = day > D.todayKey();
    let html = '<header class="dd-head"><div><h2>' + D.label(day) + (future ? '<em class="tag soft">计划</em>' : '') + '</h2><p>' + (tot ? (future ? '计划吃 ' : '吃了 ') + '<b>' + tot + '</b> 千卡' + (B ? ' / 目标 ' + B.total : '') + ' · 蛋白质 ' + Math.round(Calc.dayProtein(day)) + ' 克' : (future ? '这一天还没有计划' : '这一天还没有记录')) + '</p></div>' +
      '<button type="button" class="btn ghost sm" id="ddGo">' + (future ? '去安排' : day === D.todayKey() ? '去记录' : '补记这天') + '</button></header>';
    Object.keys(MEALS).forEach((m) => {
      const items = fs.filter((f) => f.meal === m); const meta = Photos.meta(day, m);
      const sum = Math.round(items.reduce((a, f) => a + Number(f.kcal || 0), 0));
      html += '<section class="dd-meal"><div class="ddm-top"><h3>' + MEALS[m] + '</h3><span>' + (sum ? sum + ' 千卡' : '') + '</span><button type="button" class="mini-tool" data-meta="' + m + '" aria-label="' + MEALS[m] + '的备注和照片">' + ICONS.camera + '</button></div>' +
        (items.length ? '<ul>' + items.map((f) => '<li><span>' + esc(f.name) + '</span><small>' + esc(f.amount || '') + '</small><b>' + Math.round(f.kcal) + '</b></li>').join('') + '</ul>' : '<p class="faint small">' + (future ? '还没有计划' : '没有记录') + '</p>') +
        (meta && meta.note ? '<p class="dd-note">' + esc(meta.note) + '</p>' : '') +
        (meta && meta.photos.length ? '<div class="dd-photos" data-m="' + m + '">' + meta.photos.map((id) => '<button type="button" class="ph sm" data-id="' + id + '" aria-label="查看照片"></button>').join('') + '</div>' : '') + '</section>';
    });
    html += '<button type="button" class="btn ghost" id="ddExport">' + ICONS.cal + '导出到手机日历</button>';
    el.innerHTML = html;
    $('#ddGo').addEventListener('click', () => App.goDay(day));
    $$('[data-meta]', el).forEach((b) => b.addEventListener('click', () => mealSheet(day, b.dataset.meta, () => { renderCalendar(); renderDay(); })));
    $('#ddExport').addEventListener('click', () => exportSheet(day));
    for (const box of $$('.dd-photos', el)) {
      for (const b of $$('.ph', box)) {
        const u = await Photos.url(b.dataset.id);
        if (u) { b.style.backgroundImage = 'url(' + u + ')'; b.addEventListener('click', () => UI.viewPhoto(u, async () => { await Photos.removeFromMeal(day, box.dataset.m, b.dataset.id); renderCalendar(); renderDay(); })); }
      }
    }
  }

  function exportSheet(day) {
    const d = D.parse(day); const wd = (d.getDay() + 6) % 7;
    const wStart = D.add(day, -wd), wEnd = D.add(wStart, 6) > D.todayKey() ? D.todayKey() : D.add(wStart, 6);
    const mStart = day.slice(0, 8) + '01'; const mEndRaw = D.key(new Date(d.getFullYear(), d.getMonth() + 1, 0)); const mEnd = mEndRaw > D.todayKey() ? D.todayKey() : mEndRaw;
    UI.openSheet('<h3 class="sheet-title">导出到手机日历</h3><p class="sheet-sub">每一顿饭会变成日历里的一条事件，写着吃了什么、多少千卡和备注。这是一次性导出，之后在这里修改，日历里不会跟着变。</p>' +
      '<div class="stack-btns"><button type="button" class="btn ghost" data-r="d">只导出 ' + D.short(day) + '</button><button type="button" class="btn ghost" data-r="w">这一周（' + D.short(wStart) + '–' + D.short(wEnd) + '）</button><button type="button" class="btn ghost" data-r="m">这个月（' + (d.getMonth() + 1) + '月）</button></div>' +
      '<p class="hint">导出后，iPhone 会弹出添加日历的页面，点「全部添加」。饭点提醒在「我的 → 提醒与日历」里设置。</p>',
      (root) => {
        $$('[data-r]', root).forEach((b) => b.addEventListener('click', () => {
          const r = b.dataset.r; const n = r === 'd' ? ICS.meals(day, day) : r === 'w' ? ICS.meals(wStart, wEnd) : ICS.meals(mStart, mEnd);
          if (!n) { toast('这段时间没有饮食记录'); return; }
          UI.closeSheet(); toast('已生成 ' + n + ' 条日历事件，在弹出的页面里点「全部添加」', 4200);
        }));
      });
  }

  /* ---------------- 今日食谱推荐 ---------------- */
  function renderRec() {
    const body = $('#recBody'); const day = D.todayKey();
    const P = Recipes.plan(day); Store.save();
    if (!P) { body.innerHTML = ''; return; }
    const st = S().settings; const ai = P.ai || null;
    let html = '<p class="plan-sub">今天还有 <b>' + Math.max(0, P.left) + '</b> 千卡的额度。没吃的餐会按剩下的额度来安排，每天都不一样。</p>' +
      UI.seg('mode', [['any', '都可以'], ['home', '在家做'], ['out', '外面吃']], st.mode || 'any') +
      '<button type="button" class="btn ai-btn" id="aiPlan"' + (aiBusy ? ' disabled' : '') + '>' + (aiBusy ? '<span class="spin"></span>AI 正在安排…' : (ai ? '让 AI 重新安排' : '让 AI 按今天的情况安排')) + '</button>';
    if (ai && ai.note) html += '<p class="ai-tip">' + esc(ai.note) + '</p>';
    Object.keys(MEALS).forEach((k) => {
      const m = P.meals[k];
      if (m.eaten != null) { html += '<article class="plan-card done"><header><h2>' + MEALS[k] + '</h2><span>已经吃了 ' + m.eaten + ' 千卡</span></header></article>'; return; }
      const aiM = ai ? ai.meals.find((x) => x.slot === k) : null; const r = aiM || m.r;
      html += '<article class="plan-card"><header><h2>' + MEALS[k] + '</h2><span>预算约 ' + m.budget + ' 千卡</span></header>' +
        '<h3>' + esc(r.name) + (aiM ? '<em class="tag">AI</em>' : '') + '</h3><p class="pc-items">' + esc(r.items) + '</p>' +
        '<div class="pc-nums"><span><b>' + r.kcal + '</b> 千卡</span><span>蛋白质 <b>' + r.protein + '</b> 克</span>' + (r.type ? '<span class="tag soft">' + (r.type === 'home' ? '在家做' : '外面吃') + '</span>' : '') + '</div>' +
        (r.how ? '<p class="pc-how">' + esc(r.how) + '</p>' : '') +
        '<div class="pc-actions">' + (aiM ? '<button type="button" class="btn ghost sm" data-unai="' + k + '">换回食谱库</button>' : '<button type="button" class="btn ghost sm" data-roll="' + k + '">换一个</button>') + '<button type="button" class="btn sm" data-eat="' + k + '">记为已吃</button></div></article>';
    });
    html += '<p class="hint center">' + Recipes.LIB.length + ' 种搭配，会避开最近 7 天吃过的。想要更灵活的建议，可以直接去问「' + esc(st.assistantName || '助手') + '」。</p>';
    body.innerHTML = html;
    UI.bindSeg(body, 'mode', (v) => { st.mode = v; Store.save(); renderRec(); });
    $$('[data-roll]', body).forEach((b) => b.addEventListener('click', () => { Recipes.reroll(day, b.dataset.roll); renderRec(); }));
    $$('[data-unai]', body).forEach((b) => b.addEventListener('click', () => { const p = S().plans[day]; if (p && p.ai) { p.ai.meals = p.ai.meals.filter((x) => x.slot !== b.dataset.unai); Store.save(); } renderRec(); }));
    $$('[data-eat]', body).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.eat, aiM = ai ? ai.meals.find((x) => x.slot === k) : null, r = aiM || P.meals[k].r;
      App.addEntries(day, k, [{ name: r.name, amount: r.items.slice(0, 30), kcal: r.kcal, protein: r.protein }], 'recipe');
      toast('已记到' + MEALS[k]); render();
    }));
    $('#aiPlan').addEventListener('click', async () => {
      if (!AI.ready()) { App.needKey(); return; }
      aiBusy = true; renderRec();
      try { const res = await AI.planDay(day); S().plans[day].ai = res; Store.save(); toast('安排好了'); }
      catch (e) { toast(e.message || 'AI 没能安排，再试一次', 5200); }
      aiBusy = false; if (document.body.dataset.tab === 'plan') renderRec();
    });
  }

  function render() {
    if (sel > maxDay()) sel = D.todayKey();
    renderCalendar(); renderDay(); renderRec();
  }

  window.Cal = { render, mealSheet, select(day) { sel = day; month = day.slice(0, 7); } };
})();

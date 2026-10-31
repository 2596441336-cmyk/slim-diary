/* 「我的」：头像昵称 + 菜单，每一项是单独的页面 */
(function () {
  const { $, $$, esc, toast, ICONS } = UI;
  const S = () => Store.state;
  const r1 = Calc.r1;
  const ACT = [[1.2, '久坐，几乎不运动'], [1.375, '轻度：每周运动 1–3 次'], [1.55, '中度：每周运动 3–5 次'], [1.725, '高强度：几乎每天运动']];
  const PACE = [[0.5, '慢一点 · 每周约 0.5 斤'], [1, '适中 · 每周约 1 斤'], [1.5, '快一点 · 每周约 1.5 斤'], [2, '最快 · 每周约 2 斤']];
  let sub = null;

  /* ---------------- 个人资料表单（首次设置也用） ---------------- */
  function profileForm(p, firstW) {
    return '<label class="field"><span>性别</span>' + UI.seg('sex', [['f', '女'], ['m', '男']], p.sex) + '</label>' +
      '<div class="field-row">' +
      '<label class="field"><span>年龄</span><div class="unit-in"><input id="pAge" type="number" inputmode="numeric" min="14" max="100" value="' + esc(p.age) + '" placeholder="例如 28"><em>岁</em></div></label>' +
      '<label class="field"><span>身高</span><div class="unit-in"><input id="pHeight" type="number" inputmode="decimal" min="120" max="230" value="' + esc(p.height) + '" placeholder="例如 165"><em>厘米</em></div></label></div>' +
      (firstW ? '<label class="field"><span>现在的体重</span><div class="unit-in"><input id="pWeight" type="number" inputmode="decimal" step="0.1" min="60" max="600" placeholder="例如 130"><em>斤</em></div></label>' : '') +
      '<label class="field"><span>目标体重</span><div class="unit-in"><input id="pGoal" type="number" inputmode="decimal" step="0.1" min="60" max="600" value="' + esc(p.goal) + '" placeholder="例如 115"><em>斤</em></div></label>' +
      '<label class="field"><span>平时的活动量</span>' + UI.seg('act', ACT, p.activity, 'stack') + '</label>' +
      '<label class="field"><span>想减多快</span>' + UI.seg('pace', PACE, p.pace, 'stack') + '<small>每周 1 斤左右最容易坚持，也不容易掉肌肉。</small></label>';
  }
  function bindProfile(root, p) {
    UI.bindSeg(root, 'sex', (v) => { p.sex = v; });
    UI.bindSeg(root, 'act', (v) => { p.activity = Number(v); });
    UI.bindSeg(root, 'pace', (v) => { p.pace = Number(v); });
  }
  function readProfile(root, p) {
    const age = Number($('#pAge', root).value), h = Number($('#pHeight', root).value), g = Number($('#pGoal', root).value);
    if (!p.sex) return '请选择性别';
    if (!(age >= 14 && age <= 100)) return '请填写年龄（14–100 岁）';
    if (!(h >= 120 && h <= 230)) return '请填写身高（厘米）';
    if (!(g >= 60 && g <= 600)) return '请填写目标体重（斤）';
    p.age = age; p.height = h; p.goal = r1(g);
    return null;
  }

  function avatarHTML(cls) {
    const p = S().profile;
    cls = cls ? 'av-' + cls : '';
    if (p.avatar) return '<span class="avatar ' + cls + '"><img alt="头像" src="' + p.avatar + '"></span>';
    const ch = (p.nickname || '').trim().slice(0, 1);
    return '<span class="avatar ' + cls + ' av-blank">' + (ch ? esc(ch) : ICONS.user) + '</span>';
  }
  function stats() {
    const s = S(); const days = new Set(Object.keys(s.foods).filter((d) => (s.foods[d] || []).length).concat(s.weights.map((w) => w.d)));
    let streak = 0; let d = D.todayKey(); if (!(s.foods[d] || []).length) d = D.add(d, -1);
    while ((s.foods[d] || []).length) { streak++; d = D.add(d, -1); }
    const A = Calc.analysis();
    return { days: days.size, streak, lost: A.stats ? Math.max(0, A.stats.lost) : 0 };
  }

  const PAGES = [
    ['profile', '个人资料', 'user', '昵称、头像、身高体重和目标'],
    ['target', '目标与热量', 'target', '每天的热量是怎么算出来的'],
    ['ai', 'AI 设置', 'spark', 'DeepSeek 密钥、助手名字'],
    ['prefs', '饮食偏好', 'bowl', '不吃的东西、在家做还是外面吃'],
    ['foods', '我的食物', 'box', '自己添加的食物和热量'],
    ['remind', '提醒与日历', 'bell', '饭点时间、加到手机日历'],
    ['data', '数据与备份', 'data', '导出、导入、占用空间'],
    ['about', '关于', 'info', '说明与开源地址']
  ];

  function render() {
    const body = $('#meBody'); const head = $('#meHead');
    if (sub) { renderSub(body, head); return; }
    head.innerHTML = '<h1>我的</h1>';
    const p = S().profile, st = stats(), T = Calc.targets();
    let html = '<button type="button" class="me-card" id="meCard">' + avatarHTML('lg') +
      '<div class="me-id"><b>' + esc(p.nickname || '给自己起个昵称') + '</b><span>' + (p.sex === 'm' ? '男' : '女') + ' · ' + p.age + '岁 · ' + p.height + '厘米 · 目标 ' + p.goal + ' 斤</span></div>' + ICONS.chev + '</button>' +
      '<div class="me-stats"><div><b>' + st.days + '</b><span>记录天数</span></div><div><b>' + st.streak + '</b><span>连续记饮食</span></div><div><b>' + r1(st.lost) + '</b><span>已减（斤）</span></div><div><b>' + (T ? T.kcal : '—') + '</b><span>每日目标</span></div></div>';
    html += '<nav class="menu">' + PAGES.map(([k, t, ic, d]) => '<button type="button" data-page="' + k + '"><span class="mi">' + ICONS[ic] + '</span><span class="mt"><b>' + t + '</b><small>' + d + '</small></span>' + (k === 'ai' ? '<em class="badge' + (AI.ready() ? ' on' : '') + '">' + (AI.ready() ? '已连接' : '未设置') + '</em>' : '') + ICONS.chev + '</button>').join('') + '</nav>';
    body.innerHTML = html;
    $('#meCard').addEventListener('click', () => go('profile'));
    $$('[data-page]', body).forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
  }
  function go(k) { sub = k; render(); window.scrollTo(0, 0); }
  function back() { sub = null; render(); window.scrollTo(0, 0); }

  function renderSub(body, head) {
    const page = PAGES.find((x) => x[0] === sub);
    head.innerHTML = '<button type="button" class="back-btn" id="meBack">' + ICONS.back + '我的</button><h1 class="sub-title">' + page[1] + '</h1>';
    $('#meBack').addEventListener('click', back);
    ({ profile: pgProfile, target: pgTarget, ai: pgAI, prefs: pgPrefs, foods: pgFoods, remind: pgRemind, data: pgData, about: pgAbout })[sub](body);
  }

  /* ---------------- 个人资料 ---------------- */
  function pgProfile(body) {
    const p = Object.assign({}, S().profile);
    body.innerHTML = '<div class="card center-card"><button type="button" class="avatar-btn" id="avBtn">' + avatarHTML('xl') + '<span>更换头像</span></button>' +
      '<input type="file" id="avFile" accept="image/*" hidden>' + (p.avatar ? '<button type="button" class="link" id="avDel">去掉头像</button>' : '') + '</div>' +
      '<form id="profF" class="card form" autocomplete="off"><label class="field"><span>昵称</span><input id="pNick" maxlength="12" value="' + esc(p.nickname) + '" placeholder="助手会这样称呼你"></label>' + profileForm(p, false) + '<button type="submit" class="btn">保存</button></form>';
    bindProfile(body, p);
    $('#avBtn').addEventListener('click', () => $('#avFile').click());
    $('#avFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { S().profile.avatar = await squareAvatar(f); Store.save(); render(); toast('头像已更新'); } catch (err) { toast('这张图片打不开，换一张试试'); }
    });
    const del = $('#avDel'); if (del) del.addEventListener('click', () => { S().profile.avatar = ''; Store.save(); render(); });
    $('#profF').addEventListener('submit', (e) => {
      e.preventDefault(); const err = readProfile(body, p); if (err) { toast(err); return; }
      p.nickname = $('#pNick').value.trim(); p.avatar = S().profile.avatar;
      S().profile = p; Store.save(); toast('已保存，每日目标 ' + Calc.targets().kcal + ' 千卡'); back();
    });
  }
  function squareAvatar(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 240;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 240, 240);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
      img.src = url;
    });
  }

  /* ---------------- 目标与热量 ---------------- */
  function pgTarget(body) {
    const T = Calc.targets();
    if (!T) { body.innerHTML = '<p class="hint">先填写个人资料。</p>'; return; }
    body.innerHTML = '<article class="card target-card"><dl class="calc-rows">' +
      '<div><dt>基础代谢</dt><dd>' + T.bmr + '</dd><p>躺着不动一天也会消耗的热量（Mifflin-St Jeor 公式）</p></div>' +
      '<div><dt>每天总消耗</dt><dd>' + T.tdee + '</dd><p>' + (T.calibrated ? '公式估算 ' + T.formula + '，按你 ' + T.calibrated.days + ' 天的实际记录校准后是 ' + T.tdee : '按活动量估算。记录满 10 天后，会按你的实际体重变化自动校准') + '</p></div>' +
      '<div><dt>每天少吃</dt><dd>' + (T.losing ? '−' + T.deficit : '0') + '</dd><p>' + (T.losing ? '对应每周减约 ' + T.pace + ' 斤（1 公斤脂肪约 7700 千卡）' : '已经接近目标，按维持体重计算') + '</p></div>' +
      '<div class="total"><dt>每日目标</dt><dd>' + T.kcal + '</dd><p>' + (T.floored ? '已经按安全底线 ' + T.floor + ' 千卡计算，不会再往下降' : '安全底线 ' + T.floor + ' 千卡') + '</p></div></dl></article>' +
      '<article class="card"><h2>蛋白质</h2><p class="big-line"><b>' + T.protein + '</b> 克 / 天</p><p class="hint">按目标体重每公斤约 1.5 克计算。减脂时蛋白质吃够，减掉的会更多是脂肪而不是肌肉，也更扛饿。</p></article>' +
      '<article class="card"><h2>运动</h2><p class="hint">记录的运动消耗只按一半加回当天预算，因为手表和 App 通常会高估。</p></article>' +
      '<button type="button" class="btn ghost" id="tgEdit">修改身高体重和目标</button>';
    $('#tgEdit').addEventListener('click', () => go('profile'));
  }

  /* ---------------- AI 设置 ---------------- */
  function pgAI(body) {
    const st = S().settings;
    body.innerHTML = '<form id="aiF" class="card form" autocomplete="off">' +
      '<label class="field"><span>API 密钥</span><input id="aKey" type="password" value="' + esc(st.apiKey) + '" placeholder="sk-…" autocapitalize="off" spellcheck="false"><small>只保存在这台手机上，不会出现在备份文件里。</small></label>' +
      '<label class="field"><span>助手的名字</span><input id="aName" maxlength="10" value="' + esc(st.assistantName || '助手') + '"></label>' +
      '<label class="check"><input type="checkbox" id="aSpeak"' + (st.speak ? ' checked' : '') + '><span>助手回答后自动朗读</span></label>' +
      '<details class="adv"><summary>高级设置</summary>' +
      '<label class="field"><span>接口地址</span><input id="aUrl" value="' + esc(st.baseUrl) + '" autocapitalize="off" spellcheck="false"><small>默认 https://api.deepseek.com。如果手机浏览器连不上，可以换成自己的中转地址，方法见项目说明。</small></label>' +
      '<label class="field"><span>模型</span><input id="aModel" value="' + esc(st.model) + '" autocapitalize="off" spellcheck="false"><small>要用支持「图像理解」的模型，目前是 deepseek-flash。</small></label>' +
      '<label class="check"><input type="checkbox" id="aThink"' + (st.thinkingOff ? ' checked' : '') + '><span>关闭思考模式（更快、更省钱）</span></label></details>' +
      '<div class="actions"><button type="button" class="btn ghost" id="aTest">测试连接</button><button type="submit" class="btn">保存</button></div></form>' +
      '<article class="card"><h2>怎么获取密钥</h2><ol class="steps"><li>打开 platform.deepseek.com 注册并登录</li><li>在「充值」里充一点钱，几美元能用很久</li><li>在「API keys」里创建一个密钥，复制下来</li><li>粘贴到上面，点「保存」，再点「测试连接」</li></ol>' +
      '<p class="hint">问助手一次大约 1 分钱，拍照识别一次不到 1 分钱。聊天记录只存在这台手机上，提问时会连同你的饮食和体重数据一起发给 DeepSeek。</p></article>' +
      '<article class="card"><h2>聊天记录</h2><p class="hint">现在有 ' + S().chat.length + ' 条。</p><button type="button" class="btn ghost danger" id="aClear">清空聊天记录</button></article>';
    function save() { st.apiKey = $('#aKey').value.trim(); st.assistantName = $('#aName').value.trim() || '助手'; st.speak = $('#aSpeak').checked; st.baseUrl = $('#aUrl').value.trim() || 'https://api.deepseek.com'; st.model = $('#aModel').value.trim() || 'deepseek-flash'; st.thinkingOff = $('#aThink').checked; Store.save(); App.refreshChrome(); }
    $('#aiF').addEventListener('submit', (e) => { e.preventDefault(); save(); toast('已保存'); });
    $('#aTest').addEventListener('click', async () => {
      save(); const b = $('#aTest'); b.disabled = true; b.innerHTML = '<span class="spin"></span>测试中';
      try { await AI.test(); toast('连接成功，助手和拍照识别都可以用了'); } catch (e) { toast(e.message || '连接失败', 6500); }
      b.disabled = false; b.textContent = '测试连接';
    });
    UI.confirmBtn($('#aClear'), '再点一次清空', () => { Assistant.clear(); toast('已清空'); render(); });
  }

  /* ---------------- 饮食偏好 ---------------- */
  function pgPrefs(body) {
    const st = S().settings;
    body.innerHTML = '<article class="card form"><label class="field"><span>不吃或不喜欢的</span><input id="dislikes" value="' + esc(st.dislikes) + '" placeholder="用逗号隔开，比如：香菜，羊肉，海鲜"><small>食谱推荐会避开含有这些词的搭配，助手也会参考。</small></label>' +
      '<div class="field"><span>平时怎么吃</span>' + UI.seg('mode', [['any', '都可以'], ['home', '主要在家做'], ['out', '主要在外面吃']], st.mode || 'any') + '</div>' +
      '<button type="button" class="btn" id="prSave">保存</button></article>';
    UI.bindSeg(body, 'mode', (v) => { st.mode = v; });
    $('#prSave').addEventListener('click', () => { st.dislikes = $('#dislikes').value.trim(); Store.save(); toast('已保存'); back(); });
  }

  /* ---------------- 我的食物 ---------------- */
  function pgFoods(body) {
    const cf = S().custom;
    body.innerHTML = '<article class="card">' + (cf.length ? '<div class="food-list">' + cf.map((f, i) => '<button type="button" class="food-row" data-cf="' + i + '"><span class="fr-name">' + esc(f.name) + '</span><span class="fr-sv">' + esc(f.serving) + '</span><span class="fr-kcal">' + Math.round(f.kcal) + '<small>千卡</small></span></button>').join('') + '</div>' : '<p class="hint">自己添加的食物会出现在这里，比如常买的便利店饭团、公司食堂的套餐、连锁店的餐品。搜索和拍照识别都会优先用你填的数字。</p>') +
      '</article><button type="button" class="btn" id="cfAdd">＋ 添加一种食物</button>';
    $$('[data-cf]', body).forEach((b) => b.addEventListener('click', () => customSheet(Number(b.dataset.cf))));
    $('#cfAdd').addEventListener('click', () => customSheet());
  }
  function customSheet(i) {
    const f = i != null ? S().custom[i] : null;
    UI.openSheet('<h3 class="sheet-title">' + (f ? '修改' : '添加') + '我的食物</h3><form id="cF" class="form" autocomplete="off">' +
      '<label class="field"><span>名称</span><input id="cName" maxlength="30" value="' + esc(f ? f.name : '') + '" placeholder="比如：全家鸡胸肉饭团"></label>' +
      '<label class="field"><span>一份是多少</span><input id="cSv" maxlength="30" value="' + esc(f ? f.serving : '1份') + '"></label>' +
      '<div class="field-row"><label class="field"><span>热量</span><div class="unit-in"><input id="cKcal" type="number" inputmode="numeric" value="' + (f ? f.kcal : '') + '"><em>千卡</em></div></label>' +
      '<label class="field"><span>蛋白质</span><div class="unit-in"><input id="cProt" type="number" inputmode="decimal" step="0.1" value="' + (f ? f.protein : '') + '"><em>克</em></div></label></div>' +
      '<p class="hint">包装上写的是千焦（kJ）的话，除以 4.184 就是千卡。</p>' +
      '<div class="actions">' + (f ? '<button type="button" class="btn ghost danger" id="cDel">删除</button>' : '<button type="button" class="btn ghost" data-close>取消</button>') + '<button type="submit" class="btn">保存</button></div></form>',
      (root) => {
        $('#cF', root).addEventListener('submit', (e) => {
          e.preventDefault();
          const name = $('#cName', root).value.trim(), kcal = Number($('#cKcal', root).value);
          if (!name || $('#cKcal', root).value === '' || !(kcal >= 0)) { toast('请填写名称和热量'); return; }
          if (f && f.name !== name) S().custom.splice(i, 1);
          App.saveCustom({ name, serving: $('#cSv', root).value.trim() || '1份', kcal, protein: Number($('#cProt', root).value) || 0 });
          UI.closeSheet(); render(); toast('已保存');
        });
        if (f) UI.confirmBtn($('#cDel', root), '再点一次删除', () => { S().custom.splice(i, 1); Store.save(); UI.closeSheet(); render(); });
      });
  }

  /* ---------------- 提醒与日历 ---------------- */
  function pgRemind(body) {
    const T = S().settings.mealTimes;
    body.innerHTML = '<article class="card form"><h2>饭点时间</h2><p class="hint">用来生成提醒，也决定导出到日历时每顿饭放在几点。</p>' +
      Object.keys(UI.MEALS).map((m) => '<label class="time-row"><span>' + UI.MEALS[m] + '</span><input type="time" data-t="' + m + '" value="' + esc(T[m]) + '"><input type="checkbox" data-c="' + m + '"' + (m !== 's' ? ' checked' : '') + ' aria-label="提醒' + UI.MEALS[m] + '"></label>').join('') +
      '<p class="hint">右边勾选的餐会加入提醒。</p><button type="button" class="btn" id="rmAdd">' + ICONS.bell + '把提醒加到手机日历</button>' +
      '<p class="hint">点了之后 iPhone 会弹出添加日历的页面，点「全部添加」。之后每天到点会提醒你记录。想取消的话，在 iPhone 日历里删掉这几个事件就行。</p></article>' +
      '<article class="card"><h2>导出饮食记录</h2><p class="hint">在「食谱」页的日历里点某一天，可以把那一天、那一周或那个月吃了什么导出到手机日历。</p><button type="button" class="btn ghost" id="rmCal">去食谱日历</button></article>';
    $$('[data-t]', body).forEach((inp) => inp.addEventListener('change', () => { if (inp.value) { T[inp.dataset.t] = inp.value; Store.save(); } }));
    $('#rmAdd').addEventListener('click', () => {
      const slots = $$('[data-c]', body).filter((c) => c.checked).map((c) => c.dataset.c);
      if (!slots.length) { toast('先勾选要提醒的餐'); return; }
      ICS.reminders(slots); toast('在弹出的页面里点「全部添加」', 3600);
    });
    $('#rmCal').addEventListener('click', () => App.showTab('plan'));
  }

  /* ---------------- 数据与备份 ---------------- */
  async function pgData(body) {
    const s = S();
    const nFood = Object.values(s.foods).reduce((a, l) => a + l.length, 0);
    body.innerHTML = '<article class="card"><h2>这台手机上的数据</h2><dl class="kv"><div><dt>体重记录</dt><dd>' + s.weights.length + ' 条</dd></div><div><dt>饮食记录</dt><dd>' + nFood + ' 条</dd></div><div><dt>聊天记录</dt><dd>' + s.chat.length + ' 条</dd></div><div><dt>照片</dt><dd id="phUse">计算中…</dd></div></dl>' +
      '<p class="hint">所有数据只存在这台手机的浏览器里。请从主屏幕的图标打开，这样数据最不容易被系统清理。换手机或清除 Safari 数据之前，先导出备份。</p></article>' +
      '<article class="card form"><h2>备份</h2><label class="check"><input type="checkbox" id="dPhotos"><span>备份里包含照片（文件会大很多）</span></label>' +
      '<div class="actions"><button type="button" class="btn ghost" id="dExp">导出备份</button><label class="btn ghost file-btn">导入备份<input type="file" id="dImp" accept="application/json,.json"></label></div>' +
      '<p class="hint">为了安全，备份里不包含 AI 密钥。</p></article>' +
      '<article class="card"><h2>清空</h2><p class="hint">删除这台手机上的所有记录、照片和聊天，回到第一次打开的样子。</p><button type="button" class="btn ghost danger" id="dReset">清空全部数据</button></article>';
    Photos.usage().then((u) => { const el = $('#phUse'); if (el) el.textContent = u.n + ' 张，约 ' + (u.bytes / 1048576).toFixed(1) + ' MB'; });
    $('#dExp').addEventListener('click', async () => {
      const b = $('#dExp'); b.disabled = true; b.innerHTML = '<span class="spin"></span>正在打包';
      const data = JSON.parse(JSON.stringify(S())); data.settings.apiKey = '';
      if ($('#dPhotos').checked) data._photos = await Photos.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'slim-diary-' + D.todayKey() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      b.disabled = false; b.textContent = '导出备份'; toast('备份已生成，大小约 ' + (blob.size / 1048576).toFixed(1) + ' MB');
    });
    $('#dImp').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const o = JSON.parse(rd.result); if (!o || !Array.isArray(o.weights)) throw 0;
          const key = S().settings.apiKey; const photos = o._photos; delete o._photos;
          Store.replaceAll(o); S().settings.apiKey = S().settings.apiKey || key;
          if (photos) await Photos.importAll(photos);
          Store.save(); toast('已恢复备份'); App.refreshChrome(); render();
        } catch (err) { toast('这个文件不是瘦身日记的备份'); }
      };
      rd.readAsText(f);
    });
    UI.confirmBtn($('#dReset'), '确定清空？再点一次', async () => { await Photos.clear().catch(() => {}); Store.reset(); sub = null; toast('已清空'); App.showSetup(); });
  }

  /* ---------------- 关于 ---------------- */
  function pgAbout(body) {
    body.innerHTML = '<article class="card about"><div class="label-mark">瘦身日记</div>' +
      '<p>记体重、看趋势、算热量、拍照记饮食，还有一个了解你情况的私人助手。</p>' +
      '<p class="hint">食物热量是常见做法下的估算值，照片识别通常有两三成的误差，看一周的平均更准。这个应用的建议适合一般健康的成年人，不能代替医生或营养师的意见。如果你有慢性病、正在服药、怀孕或哺乳，每天吃多少请先问医生。</p>' +
      '<p class="hint">所有数据只保存在你的手机上。AI 功能使用你自己的 DeepSeek 密钥，请求直接从手机发给 DeepSeek。</p>' +
      '<p><a href="https://github.com/2596441336-cmyk/slim-diary" target="_blank" rel="noopener">开源项目 · github.com/2596441336-cmyk/slim-diary</a></p></article>';
  }

  window.Me = { render, profileForm, bindProfile, readProfile, avatarHTML, reset() { sub = null; }, go };
})();

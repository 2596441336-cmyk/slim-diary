/* 通用界面工具：弹出层、提示、选项按钮、确认按钮 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MEALS = { b: '早餐', l: '午餐', d: '晚餐', s: '加餐' };

  let toastT = 0;
  function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms || 2600); }

  let wrap, sheet, stack = 0;
  function init() {
    wrap = $('#sheetWrap'); sheet = $('#sheet');
    $('#sheetBack').addEventListener('click', closeSheet);
  }
  function openSheet(html, mount, opts) {
    sheet.className = 'sheet' + (opts && opts.cls ? ' ' + opts.cls : '');
    sheet.innerHTML = '<div class="grab"></div>' + html; sheet.scrollTop = 0;
    wrap.hidden = false; stack++;
    requestAnimationFrame(() => wrap.classList.add('on'));
    $$('[data-close]', sheet).forEach((b) => b.addEventListener('click', closeSheet));
    if (mount) mount(sheet);
  }
  function closeSheet() { const my = ++stack; wrap.classList.remove('on'); setTimeout(() => { if (my === stack) { wrap.hidden = true; sheet.innerHTML = ''; } }, 260); }
  function swapSheet(fn) { closeSheet(); setTimeout(fn, 280); }

  function seg(name, opts, val, cls) {
    const pairs = Array.isArray(opts) ? opts : Object.keys(opts).map((k) => [k, opts[k]]);
    return '<div class="seg ' + (cls || '') + '" data-seg="' + name + '" role="radiogroup">' + pairs.map(([k, v]) =>
      '<button type="button" role="radio" aria-checked="' + (String(k) === String(val)) + '" data-v="' + k + '"' + (String(k) === String(val) ? ' class="on"' : '') + '>' + v + '</button>').join('') + '</div>';
  }
  function bindSeg(root, name, fn) {
    const el = $('[data-seg="' + name + '"]', root); if (!el) return;
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); fn(b.dataset.v); });
  }
  function confirmBtn(btn, label, fn) {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('armed')) { const old = btn.textContent; btn.classList.add('armed'); btn.textContent = label; setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = old; } }, 3000); return; }
      fn();
    });
  }
  function defaultMeal() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 'b' : h < 14.5 ? 'l' : h < 17 ? 's' : h < 21.5 ? 'd' : 's'; }

  /** 照片全屏查看 */
  function viewPhoto(url, onDelete) {
    const v = document.createElement('div'); v.className = 'viewer';
    v.innerHTML = '<img alt="照片" src="' + url + '"><div class="viewer-bar">' + (onDelete ? '<button type="button" class="btn ghost danger" data-del>删除这张</button>' : '') + '<button type="button" class="btn ghost" data-x>关闭</button></div>';
    document.body.appendChild(v);
    v.addEventListener('click', (e) => { if (e.target === v || e.target.tagName === 'IMG' || e.target.closest('[data-x]')) v.remove(); });
    const del = v.querySelector('[data-del]');
    if (del) confirmBtn(del, '再点一次删除', () => { v.remove(); onDelete(); });
  }

  const ICONS = {
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="13" rx="2.5"/><circle cx="12" cy="13" r="3.6"/><path d="M8.5 6.5l1.6-2.5h3.8l1.6 2.5"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-5 4 4 2.5-2.5L20 17"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
    bowl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 8c0-2 1-3 2-3M13 8c0-2.5 1-4 2.5-4"/></svg>',
    box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    data: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  window.UI = { $, $$, esc, MEALS, toast, init, openSheet, closeSheet, swapSheet, seg, bindSeg, confirmBtn, defaultMeal, viewPhoto, ICONS };
})();

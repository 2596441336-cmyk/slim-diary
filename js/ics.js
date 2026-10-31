/* 导出到手机日历（.ics）：饮食记录、饭点提醒。日历是单向导出，之后在应用里修改不会自动同步。 */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dk = (d) => d.replace(/-/g, '');
  function fold(line) {
    const enc = new TextEncoder(); if (enc.encode(line).length <= 74) return line;
    const out = []; let cur = '';
    for (const ch of line) { if (enc.encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
    out.push(cur); return out.join('\r\n');
  }
  function addMin(t, m) { const [h, mi] = t.split(':').map(Number); const x = h * 60 + mi + m; return pad(Math.floor(x / 60) % 24) + pad(x % 60) + '00'; }
  function wrap(events, name) {
    let L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SlimDiary//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name || '瘦身日记')];
    events.forEach((e) => { L = L.concat(e); }); L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function deliver(text, filename) {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  /** 把 start 到 end（含）之间每一顿饭导出成日历事件 */
  function meals(start, end) {
    const S = Store.state, T = S.settings.mealTimes, ev = [];
    let n = 0;
    for (let d = start; d <= end; d = D.add(d, 1)) {
      const fs = S.foods[d] || [];
      Object.keys(UI.MEALS).forEach((m) => {
        const items = fs.filter((f) => f.meal === m); const meta = Photos.meta(d, m);
        if (!items.length && !(meta && meta.note)) return;
        const kcal = Math.round(items.reduce((a, f) => a + Number(f.kcal || 0), 0));
        const desc = items.map((f) => '· ' + f.name + (f.amount ? '（' + f.amount + '）' : '') + ' ' + Math.round(f.kcal) + ' 千卡').join('\n') + (meta && meta.note ? '\n备注：' + meta.note : '') + '\n—— 瘦身日记';
        const t = T[m] || '12:00';
        ev.push(['BEGIN:VEVENT', 'UID:meal-' + d + '-' + m + '@slimdiary', 'DTSTAMP:' + stamp(), 'DTSTART:' + dk(d) + 'T' + t.replace(':', '') + '00', 'DTEND:' + dk(d) + 'T' + addMin(t, 30),
          'SUMMARY:' + esc(UI.MEALS[m] + ' · ' + (items[0] ? items[0].name + (items.length > 1 ? ' 等' + items.length + '样' : '') : '备注') + ' · ' + kcal + ' 千卡'), 'DESCRIPTION:' + esc(desc), 'TRANSP:TRANSPARENT', 'END:VEVENT']);
        n++;
      });
    }
    if (!n) return 0;
    deliver(wrap(ev, '瘦身日记 · 饮食'), 'meals-' + start + (end !== start ? '-' + end : '') + '.ics');
    return n;
  }

  /** 每天的饭点提醒（重复事件） */
  function reminders(slots) {
    const T = Store.state.settings.mealTimes, ev = [];
    const today = D.todayKey();
    slots.forEach((m) => {
      const t = T[m]; if (!t) return;
      ev.push(['BEGIN:VEVENT', 'UID:remind-' + m + '@slimdiary', 'DTSTAMP:' + stamp(), 'DTSTART:' + dk(today) + 'T' + t.replace(':', '') + '00', 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
        'SUMMARY:' + esc('记一下' + UI.MEALS[m]), 'DESCRIPTION:' + esc('打开瘦身日记，拍照或说一句，把这一顿记下来。'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('该记' + UI.MEALS[m] + '了'), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT']);
    });
    if (!ev.length) return 0;
    deliver(wrap(ev, '瘦身日记 · 提醒'), 'meal-reminders.ics');
    return ev.length;
  }

  window.ICS = { meals, reminders };
})();

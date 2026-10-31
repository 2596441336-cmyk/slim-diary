/* 照片：压缩后保存在本机浏览器的 IndexedDB 里，不上传到任何地方。普通清晰度：最长边 1280 像素，每张约 150KB。 */
(function () {
  const DB = 'slimdiary-photos', STORE = 'photos';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode); const st = t.objectStore(STORE);
      const r = fn(st);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
    }));
  }

  function compress(file, maxSide, quality) {
    maxSide = maxSide || 1280; quality = quality || 0.8;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => b ? resolve(b) : reject(new Error('compress')), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('这张图片打不开')); };
      img.src = url;
    });
  }

  const urls = {};
  async function put(blob) { const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await tx('readwrite', (st) => st.put(blob, id)); return id; }
  async function get(id) { return tx('readonly', (st) => st.get(id)); }
  async function url(id) { if (urls[id]) return urls[id]; const b = await get(id); if (!b) return null; urls[id] = URL.createObjectURL(b); return urls[id]; }
  async function del(id) { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } return tx('readwrite', (st) => st.delete(id)); }
  async function keys() { return tx('readonly', (st) => st.getAllKeys()); }
  async function clear() { Object.keys(urls).forEach((k) => URL.revokeObjectURL(urls[k])); return tx('readwrite', (st) => st.clear()); }
  async function usage() {
    let bytes = 0, n = 0;
    try { const all = await tx('readonly', (st) => st.getAll()); (all || []).forEach((b) => { bytes += b.size || 0; n++; }); } catch (e) {}
    return { bytes, n };
  }
  function blobToDataURL(b) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }
  async function dataURLToBlob(d) { const r = await fetch(d); return r.blob(); }
  async function exportAll() { const ks = await keys(); const out = {}; for (const k of ks) { const b = await get(k); if (b) out[k] = await blobToDataURL(b); } return out; }
  async function importAll(map) { for (const k of Object.keys(map || {})) { const b = await dataURLToBlob(map[k]); await tx('readwrite', (st) => st.put(b, k)); } }
  // 请浏览器把数据当作「需要长期保留」，减少被系统自动清理的可能
  function persist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} }

  /** 每顿饭的照片和备注 */
  function meta(day, meal, create) {
    const M = Store.state.mealMeta;
    if (!M[day]) { if (!create) return null; M[day] = {}; }
    if (!M[day][meal]) { if (!create) return null; M[day][meal] = { note: '', photos: [] }; }
    return M[day][meal];
  }
  async function addToMeal(day, meal, fileOrBlob) {
    const blob = fileOrBlob.type === 'image/jpeg' && fileOrBlob.size < 400000 ? fileOrBlob : await compress(fileOrBlob);
    const id = await put(blob);
    meta(day, meal, true).photos.push(id); Store.save(); persist();
    return id;
  }
  async function removeFromMeal(day, meal, id) {
    const m = meta(day, meal); if (!m) return;
    m.photos = m.photos.filter((x) => x !== id); Store.save();
    await del(id);
  }

  window.Photos = { compress, put, get, url, del, keys, clear, usage, exportAll, importAll, persist, meta, addToMeal, removeFromMeal };
})();

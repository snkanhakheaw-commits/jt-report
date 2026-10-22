// สลับสถานะช่องจอด ว่าง / ไม่ว่าง ให้ทุกคนเห็นตรงกัน (เก็บที่ Supabase ตาราง jt_parking_slots)
// ใช้กับ map.html: แค่ใส่ <script src="slots.js" defer></script> ก่อน </body>
// ไฟล์นี้แทนที่ <img src="plan.svg"> ด้วย SVG จริง และสร้างตัวเลือก คลัง → ด้าน → ช่อง (ค้นหาเลข/รหัสได้) ไว้เหนือผัง
// แตะช่อง (ปุ่มหรือบนผัง) = เปิดรายละเอียด + ผังใกล้ช่องก่อน สถานะเปลี่ยนเมื่อกดปุ่มยืนยันเท่านั้น
(() => {
  const API = "https://urbvwplaoznyhvcsvore.supabase.co/rest/v1";
  const KEY = "sb_publishable_Vudb-REBewSsT9BWbTf1zA_8pLvwgqQ"; // คีย์สาธารณะ อ่านได้ทุกคน เขียนได้แค่ผ่านฟังก์ชัน jt_set_parking_slot
  const POLL_MS = 10000;
  const BUILDINGS = {"b2-south": "คลังใหม่ ด้านใต้", "b2-west": "คลังใหม่ ด้านตะวันตก", "b2-north": "คลังใหม่ ด้านเหนือ", "b2-east": "คลังใหม่ ด้านตะวันออก", "b1-inner-east": "คลังเก่า ด้านตะวันออก", "b1-inner-north": "คลังเก่า ด้านเหนือ (ผนังใน)", "b1-west": "คลังเก่า ด้านตะวันตก", "b1-south": "คลังเก่า ด้านใต้"};
  const COLORS = {yellow: "เหลือง", white: "ขาว"};
  const FROM = {north: "เหนือ", south: "ใต้", east: "ตะวันออก", west: "ตะวันตก"};
  const SIDE_KEY = "jt-slots-side"; // จำด้านที่เปิดล่าสุดในเครื่อง (ไม่เลือกช่องให้เอง)
  const CLOSEUP_M = [64, 36];       // ผังใกล้ช่อง กว้าง × สูง (เมตร) รอบช่องที่แตะ
  // เปิดจากแอปกล้องลงเวลา (Android WebView ใส่ window.StampCam ไว้): กดยืนยัน = ส่งช่องกลับให้แอป แทนการสลับสถานะ
  // แอปเป็นคนตั้งช่องเป็น ไม่ว่าง เอง · ?current=<slot id> = ช่องที่เลือกไว้ตอนนี้ · ?plate= = ทะเบียนรถในแอป (บอกว่าช่องไหนเป็นของรถคุณ)
  const bridge = window.StampCam;
  const params = new URLSearchParams(location.search);
  const current = params.get("current");
  const myPlate = params.get("plate") || "";

  const viewer = document.getElementById("viewer");
  const img = viewer && viewer.querySelector("img");
  if (!img) return;

  // ห้ามใช้หน่วย vh: WebView ในแอปกล้อง (เปิดใน Dialog) คิด 100vh = 0 ใช้ % ของกล่อง fixed แทน
  const css = document.createElement("style");
  css.textContent = `
[hidden]{display:none!important}
.viewer svg{display:block;width:100%;max-width:1400px;height:auto;margin:0 auto}
.viewer.zoom svg{width:320%;max-width:none}
.viewer svg [data-slot]{cursor:pointer}
.viewer svg [data-slot].occ polygon,.closeup [data-slot].occ polygon{fill:#c8141c;stroke:#7a0b10}
.viewer svg [data-slot].occ text,.closeup [data-slot].occ text{fill:#fff}
.viewer svg [data-slot].unk polygon{fill-opacity:.45}
.closeup [data-slot].sel polygon{stroke:#1e88e5;stroke-width:1.2}
.pick{max-width:560px;margin:0 auto;padding:12px 16px 0}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:var(--chip)}
.seg button{min-height:52px;border:0;border-radius:10px;background:transparent;color:var(--ink);font:inherit;font-size:18px;font-weight:700;line-height:1.2;cursor:pointer}
.seg button small,.sides button small{display:block;font-size:12px;font-weight:600;color:var(--muted)}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.seg button[aria-pressed="true"] small{color:inherit;opacity:.8}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 0}
.sides button{min-height:52px;padding:4px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;font-weight:600;line-height:1.25;text-align:left;cursor:pointer}
.sides button[aria-pressed="true"]{background:#1e88e5;border-color:#1e88e5;color:#fff}
.sides button[aria-pressed="true"] small{color:#dcebfb}
.find{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;font-size:17px}
.slots{max-width:560px;margin:0 auto;padding:0 16px 24px}
.slots h2{font-size:19px;margin:16px 0 4px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.slots h2 .count{font-size:15px;font-weight:600;color:var(--muted)}
.slots h3{font-size:14px;font-weight:600;color:var(--muted);margin:12px 0 6px}
.slots .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:6px}
.slot{min-height:48px;border-radius:10px;border:2px solid #a8860f;background:#f6d443;color:#283d48;font:inherit;font-weight:700;font-size:18px;cursor:pointer;padding:0;line-height:1.1}
.slot.white{background:#fff;border-color:#6d8591}
.slot small{display:block;font-size:11px;font-weight:600}
.slot small.code{width:max-content;margin:2px auto 0;padding:0 5px;border-radius:4px;background:#283d48;color:#fff;font-weight:700;text-decoration:none}
.slot.occ{background:#c8141c;border-color:#7a0b10;color:#fff;text-decoration:line-through}
.slot.unk{opacity:.55;border-style:dashed}
.slot:disabled{opacity:.55}
.slot.picked{outline:4px solid #1e88e5;outline-offset:2px}
.results{display:grid;gap:6px;margin:12px 0 0}
.res{display:flex;align-items:center;gap:12px;min-height:60px;padding:6px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.res .rt{flex:1;line-height:1.3}
.res .rt small{display:block;color:var(--muted);font-size:13px}
.res .rs{font-size:14px;font-weight:600;color:var(--muted)}
.res .rs.o{color:#c8141c}
.res .rs small{display:block;font-size:12px;text-align:right}
.res.picked{outline:3px solid #1e88e5;outline-offset:1px}
.empty{color:var(--muted);margin:12px 0 0}
.num{display:inline-grid;place-items:center;min-width:48px;height:42px;padding:0 6px;border-radius:8px;border:2px solid #a8860f;background:#f6d443;color:#283d48;font-weight:700;font-size:19px;flex:none}
.num.white{background:#fff;border-color:#6d8591}
.num.occ{background:#c8141c;border-color:#7a0b10;color:#fff}
.num.unk{border-style:dashed}
.slotbar{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 16px;font-size:14px;color:var(--muted);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.slotbar b{color:var(--ink)}
.slotbar .err{color:var(--accent);font-weight:600}
.slotbar .retry{border:0;padding:0 0 0 6px;background:none;color:#1e88e5;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin:16px 0 0}
.legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid #6d8591;background:#fff}
.legend i.occ{background:#c8141c;border-color:#7a0b10}
.legend i.unk{border-style:dashed;opacity:.6}
.maphead{max-width:560px;margin:0 auto;padding:8px 16px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.maphead h2{font-size:19px;margin:0 auto 0 0}
.sheet-back{position:fixed;inset:0;z-index:10;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center}
.sheet{width:100%;max-width:560px;max-height:calc(100% - 16px);overflow:auto;background:var(--surface);color:var(--ink);border-radius:18px 18px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom))}
.sheet-head{display:flex;align-items:center;gap:12px}
.sheet-head .t{font-size:22px;font-weight:700;line-height:1.25}
.sheet-head .s{font-size:14px;color:var(--muted);line-height:1.4}
.sheet-head .x{margin-left:auto;align-self:flex-start;min-width:44px;min-height:44px;border:0;border-radius:10px;background:var(--chip);color:var(--ink);font:inherit;font-size:18px;cursor:pointer}
.closeup{margin:12px 0 0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.closeup svg{display:block;width:100%;height:auto}
.sheet .st{margin:10px 0 0;font-size:15px}
.sheet .st b.o{color:#c8141c}
.sheet .msg{margin:8px 0 0;padding:8px 12px;border-radius:10px;font-size:14px;background:#e3effc;color:#0d3c6e}
.sheet .msg.warn{background:#fdecea;color:#7a0b10}
.sheet .acts{display:grid;gap:8px;margin:14px 0 0}
.sheet .acts .btn{width:100%;min-height:52px;font-size:18px}
.sheet .acts .btn:disabled{opacity:.6}
`;
  document.head.appendChild(css);

  // หัวหน้าเดิมของ map.html (ชื่อ คำอธิบาย ปุ่มขยาย 8 ปุ่ม ลิงก์) — ในแอปซ่อนทั้งก้อน แอปมีหัว "เลือกช่องจอด" อยู่แล้ว
  const intro = viewer.previousElementSibling;
  const fit = document.getElementById("fitBtn");
  if (bridge && intro) intro.hidden = true;

  const bar = document.createElement("div");
  bar.className = "slotbar";
  bar.innerHTML = (bridge
    ? `<span><b>แตะเลขช่องที่จอด</b> ตรวจแล้วกด จอดช่องนี้</span>`
    : `<span>แตะเลขช่องเพื่อดูรายละเอียด และเปลี่ยน <b>ว่าง</b> / <b style="color:#c8141c">ไม่ว่าง</b></span>`)
    + `<span><span id="slotStatus">กำลังโหลดสถานะ…</span><button type="button" class="retry" hidden>ลองใหม่</button></span>`;
  const statusEl = bar.querySelector("#slotStatus");
  const retryBtn = bar.querySelector(".retry");

  const pick = document.createElement("div");
  pick.className = "pick";
  pick.innerHTML = `<div class="seg" role="group" aria-label="คลัง"></div><div class="sides" role="group" aria-label="ด้าน"></div>`
    + `<input class="find" type="search" enterkeyhint="search" autocomplete="off" placeholder="ค้นหาเลขช่อง หรือรหัส เช่น 12, A1" aria-label="ค้นหาเลขช่อง หรือรหัส">`;
  const segEl = pick.querySelector(".seg"), sidesEl = pick.querySelector(".sides"), find = pick.querySelector(".find");

  const list = document.createElement("div");
  list.className = "slots";
  const results = document.createElement("div");
  results.hidden = true;
  list.appendChild(results);

  const mapHead = document.createElement("div");
  mapHead.className = "maphead";
  mapHead.innerHTML = `<h2>ผังทั้งลาน</h2><button type="button" class="btn" id="sideOnMap"></button>`;
  const sideOnMap = mapHead.querySelector("#sideOnMap");
  if (fit) mapHead.appendChild(fit);

  viewer.before(bar, pick, list, mapHead);

  const back = document.createElement("div");
  back.className = "sheet-back";
  back.hidden = true;
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
<div class="sheet-head"><span class="num"></span><div><div class="t" id="sheetTitle"></div><div class="s"></div></div><button type="button" class="x" aria-label="ปิด">✕</button></div>
<div class="closeup"></div><p class="st"></p><p class="msg" hidden></p>
<div class="acts"><button type="button" class="btn primary go"></button><button type="button" class="btn no">ยกเลิก</button></div></div>`;
  document.body.appendChild(back);
  const sheet = sel => back.querySelector(sel);

  const state = {};   // slot id -> {occupied, updated_at}
  const slots = {};   // slot id -> {g, btn, wall, building, side, label, num, code, color, no, from}
  const walls = [];   // [{wall, building, side, ids, section, chip}] ตามลำดับบนผัง
  const lastSide = {}; // คลัง -> ด้านที่เปิดล่าสุด
  const pending = new Set();
  // เวลาที่โหลดสถานะสำเร็จล่าสุด · null = ยังไม่ทราบว่าช่องไหนว่าง (ห้ามนับเป็นว่าง)
  let loadedAt = null, loadFailed = false, saveErr = "";
  let svg = null, side = null, query = "", sheetId = null, sheetSel = null;

  const headers = {apikey: KEY, "Content-Type": "application/json"};
  const known = () => loadedAt !== null;
  const occupied = id => !!(state[id] && state[id].occupied);
  const timeOf = (d, sec) => new Date(d).toLocaleTimeString("th-TH", sec ? {hour: "2-digit", minute: "2-digit", second: "2-digit"} : {hour: "2-digit", minute: "2-digit"});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
  // "คลังใหม่ ด้านใต้" → ["คลังใหม่", "ด้านใต้"]
  const splitName = wall => {
    const name = BUILDINGS[wall] || wall, i = name.indexOf(" ");
    return i < 0 ? [name, wall] : [name.slice(0, i), name.slice(i + 1)];
  };
  const statusOf = id => pending.has(id) ? "กำลังบันทึก…" : !known() ? "ยังไม่ทราบสถานะ" : occupied(id) ? "ไม่ว่าง" : "ว่าง";
  // ทะเบียนรุ่นเก่ามีจังหวัดต่อท้าย ("72-7980 นครปฐม") ยังนับเป็นรถคันเดียวกัน (ตรงกับ parkingPlateKey ในแอป)
  const plateKey = p => { const t = (p || "").trim(), m = /^(\d{2}-\d{4})(?:\s|$)/.exec(t); return m ? m[1] : t; };
  const mine = id => !!myPlate && occupied(id) && plateKey(state[id].plate) === plateKey(myPlate);
  // "08:10" วันนี้ · "เมื่อวาน 22:10" · "20 ต.ค. 22:10"
  function dayTime(iso) {
    const d = new Date(iso), today = new Date(), y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return timeOf(d);
    if (d.toDateString() === y.toDateString()) return `เมื่อวาน ${timeOf(d)}`;
    return `${d.toLocaleDateString("th-TH", {day: "numeric", month: "short"})} ${timeOf(d)}`;
  }
  // รายละเอียดคนจอด: "รถ 72-7980 · ตั้งแต่ 08:10" (ทะเบียนมาจากฐานข้อมูลที่ใครก็เขียนได้ ต้อง escape ก่อนใส่ HTML)
  function holderOf(id) {
    const s = state[id];
    if (!s || !s.occupied) return "";
    return (s.plate ? `รถ ${s.plate}` : "ไม่ระบุรถ") + (s.since ? ` · ตั้งแต่ ${dayTime(s.since)}` : "");
  }
  const countOf = ids => known() ? `ว่าง ${ids.filter(id => !occupied(id)).length}/${ids.length}` : `${ids.length} ช่อง`;
  const titleOf = s => `${COLORS[s.color] || s.color} ` + (s.num || `ไม่มีเลข ${s.no}`);

  // กรอบช่องจาก polygon (หน่วยเมตรของผัง) ไม่ต้องรอให้ SVG แสดงผล
  function bounds(id) {
    const p = slots[id].g.querySelector("polygon").getAttribute("points").trim().split(/[\s,]+/).map(Number);
    const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1);
    return {x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys)};
  }

  function render(id) {
    const s = slots[id], occ = occupied(id), unk = !known();
    for (const el of [s.g, s.btn]) { el.classList.toggle("occ", occ); el.classList.toggle("unk", unk); }
    s.btn.disabled = pending.has(id);
    const when = !known() || !state[id] ? "" : occ ? ` · ${holderOf(id)}` : ` · เปลี่ยนเมื่อ ${timeOf(state[id].updated_at)}`;
    s.btn.title = `${s.label} · ${statusOf(id)}${when}`;
    s.btn.setAttribute("aria-label", `${s.label} · ${statusOf(id)}`);
  }

  function renderCounts() {
    for (const w of walls) {
      w.chip.querySelector("small").textContent = countOf(w.ids);
      w.section.querySelector(".count").textContent = known() ? countOf(w.ids).replace("/", " / ") : "ยังไม่ทราบสถานะ";
    }
    segEl.querySelectorAll("button").forEach(b => {
      b.querySelector("small").textContent = countOf(walls.filter(w => w.building === b.dataset.building).flatMap(w => w.ids));
    });
  }

  function showStatus() {
    const err = saveErr || (!loadFailed ? "" : known()
      ? `โหลดสถานะใหม่ไม่ได้ · ข้อมูลเมื่อ ${timeOf(loadedAt, true)}`
      : "โหลดสถานะไม่ได้ (เช็คเน็ต) · ยังไม่ทราบว่าช่องไหนว่าง");
    statusEl.className = err ? "err" : "";
    statusEl.textContent = err || (known() ? `อัปเดต ${timeOf(loadedAt, true)}` : "กำลังโหลดสถานะ…");
    retryBtn.hidden = !loadFailed;
  }

  function renderAll() {
    Object.keys(slots).forEach(render);
    renderCounts();
    showStatus();
    if (query) showResults();
    renderSheet();
  }

  async function load() {
    try {
      const r = await fetch(`${API}/jt_parking_slots?select=slot_id,occupied,updated_at,plate,since,version`, {headers, cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      for (const row of await r.json()) if (!pending.has(row.slot_id)) state[row.slot_id] = row;
      loadedAt = new Date();
      loadFailed = false;
      saveErr = "";
    } catch (e) {
      loadFailed = true;
    }
    renderAll();
  }

  // ส่ง version ที่เห็นอยู่ไปด้วย (ช่องที่ยังไม่มีแถว = 0) ถ้ามีคนเปลี่ยนก่อน ฐานข้อมูลคืน conflict แทนการทับ
  async function setSlot(id, next) {
    if (pending.has(id) || !known()) return;
    const prev = state[id], now = new Date().toISOString();
    state[id] = {slot_id: id, occupied: next, updated_at: now, plate: null, since: next ? now : null, version: prev ? prev.version : 0};
    pending.add(id);
    renderAll();
    try {
      const r = await fetch(`${API}/rpc/jt_set_parking_slot_v2`, {method: "POST", headers,
        body: JSON.stringify({p_slot_id: id, p_occupied: next, p_version: prev && prev.version != null ? prev.version : 0})});
      if (!r.ok) throw new Error(r.status);
      const row = await r.json();
      state[id] = row;
      saveErr = row.conflict ? `${slots[id].label} เพิ่งถูกเปลี่ยนจากที่อื่น ดูสถานะล่าสุดแล้วค่อยกดใหม่` : "";
    } catch (e) {
      if (prev) state[id] = prev; else delete state[id];
      saveErr = `บันทึก ${slots[id].label} ไม่สำเร็จ ลองใหม่`;
    }
    pending.delete(id);
    renderAll();
  }

  function buildPicker() {
    svg.querySelectorAll("g[data-wall]").forEach(wallEl => {
      const wall = wallEl.dataset.wall;
      const docks = [...wallEl.querySelectorAll("g[id^='dock-']")];
      if (!docks.length) return;
      const [building, sideName] = splitName(wall);
      const section = document.createElement("section");
      section.innerHTML = `<h2><span>${BUILDINGS[wall] || wall}</span><span class="count"></span></h2>`;

      // จัดกลุ่มตามช่วงที่ติดกันบนผัง (สีเดียวกัน + มีเลข/ไม่มีเลข) เช่น เหลือง 63–66 แยกจาก เหลือง 1–5
      const groups = [];
      let prevKey = null;
      for (const g of docks) {
        const key = `${g.dataset.color}-${g.dataset.number ? "n" : "none"}`;
        if (key !== prevKey) groups.push([]);
        groups[groups.length - 1].push(g);
        prevKey = key;
      }
      // ลำดับหัวข้อ: กลุ่มมีเลขเรียงตามเลขต่ำสุด (เหลืองก่อนขาวถ้าเท่ากัน) แล้วค่อยกลุ่มไม่มีเลข
      // ช่องชื่อเป็นตัวอักษร (เช่น F, G) ต่อท้ายกลุ่มที่เป็นเลข ก่อนกลุ่มไม่มีเลข
      const minNum = gs => gs[0].dataset.number ? Math.min(...gs.map(g => +g.dataset.number || 1e9)) : Infinity;
      const colorRank = gs => gs[0].dataset.color === "yellow" ? 0 : 1;
      groups.sort((a, b) => minNum(a) - minNum(b) || colorRank(a) - colorRank(b));
      // ช่องไม่มีเลขนับลำดับต่อกันทั้งด้าน (เช่น ด้านใต้คลังเก่ามี 2 กลุ่มคั่นด้วย F) ป้ายจะได้ไม่ซ้ำ
      let blankNo = 0;
      const ids = [];
      for (const gs of groups) {
        const color = gs[0].dataset.color, numbered = !!gs[0].dataset.number;
        gs.sort((a, b) => (+a.dataset.number || 0) - (+b.dataset.number || 0));
        const first = blankNo + 1;
        const h3 = document.createElement("h3");
        h3.textContent = numbered
          ? `สี${COLORS[color] || color} ${gs[0].dataset.number}` + (gs.length > 1 ? `–${gs[gs.length - 1].dataset.number}` : "")
          : `สี${COLORS[color] || color} ไม่มีเลข (${gs.length} ช่อง)` + (gs.length > 1 ? ` · ลำดับ ${first}–${first + gs.length - 1} นับจากฝั่ง${FROM[wallEl.dataset.from] || wallEl.dataset.from}` : "");
        const grid = document.createElement("div");
        grid.className = "grid";
        gs.forEach(g => {
          const id = g.id, num = g.dataset.number, code = g.dataset.code, no = num ? 0 : ++blankNo;
          // ชื่อช่องรูปแบบนี้ส่งให้แอปกล้องด้วย (ป้ายบนภาพ/ตัวเลือกงาน) อย่าเปลี่ยนรูปแบบ
          const label = (num ? `${COLORS[color] || color} ${num}` : `${COLORS[color] || color} ไม่มีเลข ${no}`) + (code ? ` (${code})` : "");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `slot ${color}`;
          btn.innerHTML = (num ? num : `–<small>${no}</small>`) + (code ? `<small class="code">${code}</small>` : "");
          btn.onclick = () => openSheet(id);
          if (id === current) btn.classList.add("picked");
          grid.appendChild(btn);
          g.dataset.slot = id;
          g.addEventListener("click", () => openSheet(id));
          slots[id] = {g, btn, wall, building, side: sideName, label: `${BUILDINGS[wall] || wall} ${label}`, num, code, color, no, from: wallEl.dataset.from};
          ids.push(id);
        });
        section.append(h3, grid);
      }
      list.insertBefore(section, results);

      const chip = document.createElement("button");
      chip.type = "button";
      chip.innerHTML = `${sideName}<small></small>`;
      chip.onclick = () => selectSide(wall, true);
      sidesEl.appendChild(chip);
      walls.push({wall, building, side: sideName, ids, section, chip});
    });

    for (const building of new Set(walls.map(w => w.building))) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.building = building;
      b.innerHTML = `${building}<small></small>`;
      b.onclick = () => selectSide(lastSide[building] || walls.find(w => w.building === building).wall, true);
      segEl.appendChild(b);
    }

    // รหัสเดียวครอบหลายช่อง (เช่น A1 = 24–28) ไว้บอกในรายละเอียดช่อง
    for (const s of Object.values(slots)) {
      if (!s.code) continue;
      const nums = Object.values(slots).filter(o => o.wall === s.wall && o.code === s.code).map(o => o.num);
      if (nums.length > 1) s.codeRange = `${nums[0]}–${nums[nums.length - 1]}`;
    }

    const legend = document.createElement("p");
    legend.className = "legend";
    legend.innerHTML = `<span><i></i>ว่าง (สีตามเส้นพื้น)</span><span><i class="occ"></i>ไม่ว่าง</span><span><i class="unk"></i>ยังไม่ทราบสถานะ</span><span>รีเฟรชเองทุก ${POLL_MS / 1000} วินาที</span>`;
    list.appendChild(legend);
  }

  // เลือกด้าน (เปลี่ยนคลังก็มาที่นี่) · byUser = ล้างคำค้นหาให้เห็นรายการด้านนั้นทันที
  function selectSide(wall, byUser) {
    const w = walls.find(x => x.wall === wall) || walls[0];
    side = w.wall;
    lastSide[w.building] = w.wall;
    if (byUser && query) { find.value = query = ""; }
    for (const x of walls) {
      x.chip.hidden = x.building !== w.building;
      x.chip.setAttribute("aria-pressed", x === w);
      x.section.hidden = !!query || x !== w;
    }
    segEl.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.building === w.building));
    results.hidden = !query;
    sideOnMap.textContent = `ดู${w.side}บนผัง`;
    try { localStorage.setItem(SIDE_KEY, w.wall); } catch (e) {}
  }

  // ค้นหา: ตัวเลข = ตรงเลขช่องทุกคลัง (เลขซ้ำได้) · ตัวอักษร = ชื่อช่อง (F, G) หรือรหัสที่ขึ้นต้นด้วยคำค้น (P → P1, P2, P3)
  function showResults() {
    for (const w of walls) w.section.hidden = !!query || w.wall !== side;
    results.hidden = !query;
    if (!query) return;
    const q = query.toUpperCase().replace(/\s+/g, ""), digits = /^\d+$/.test(q);
    const hits = Object.keys(slots).filter(id => {
      const s = slots[id];
      return s.num.toUpperCase() === q || (!digits && !!s.code && s.code.toUpperCase().startsWith(q));
    });
    const h3 = document.createElement("h3");
    h3.textContent = `ผลค้นหา “${query}” · ${hits.length} ช่อง`;
    const rows = hits.map(id => {
      const s = slots[id], occ = known() && occupied(id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "res" + (id === current ? " picked" : "");
      row.innerHTML = `<span class="num ${s.color}${occ ? " occ" : ""}${known() ? "" : " unk"}">${s.num || "–"}</span>`
        + `<span class="rt"><b>${titleOf(s)}${s.code ? ` · รหัส ${s.code}` : ""}</b><small>${s.building} · ${s.side}</small></span>`
        + `<span class="rs${occ ? " o" : ""}">${statusOf(id)}${occ && state[id].plate ? `<small>${esc(state[id].plate)}</small>` : ""}</span>`;
      row.onclick = () => openSheet(id);
      return row;
    });
    const box = document.createElement("div");
    box.className = "results";
    box.append(...rows);
    results.replaceChildren(h3, hits.length ? box : Object.assign(document.createElement("p"), {
      className: "empty",
      innerHTML: `ไม่พบช่อง “${esc(query)}” · พิมพ์เลขช่อง เช่น 12 หรือรหัส เช่น A1`,
    }));
  }

  // ผังใกล้ช่อง: สำเนาผังทั้งลาน (ลบ id กันซ้ำ) แล้วตั้ง viewBox รอบช่องที่แตะ
  function closeUp(id) {
    const c = svg.cloneNode(true);
    sheetSel = c.querySelector(`#${CSS.escape(id)}`);
    sheetSel.classList.add("sel");
    c.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
    c.removeAttribute("aria-labelledby");
    c.setAttribute("aria-hidden", "true");
    const b = bounds(id), [w, h] = CLOSEUP_M;
    c.setAttribute("viewBox", `${(b.x0 + b.x1 - w) / 2} ${(b.y0 + b.y1 - h) / 2} ${w} ${h}`);
    return c;
  }

  function openSheet(id) {
    const s = slots[id];
    sheetId = id;
    sheet(".t").textContent = titleOf(s);
    sheet(".s").textContent = [
      `${s.building} · ${s.side}`,
      s.code && `รหัส ${s.code}` + (s.codeRange ? ` (เข้าได้ช่อง ${s.codeRange})` : ""),
      !s.num && `ลำดับ ${s.no} นับจากฝั่ง${FROM[s.from] || s.from}`,
    ].filter(Boolean).join(" · ");
    sheet(".closeup").replaceChildren(closeUp(id));
    back.hidden = false;
    document.documentElement.style.overflow = "hidden";
    renderSheet();
    sheet(".go").focus();
  }

  function closeSheet() {
    back.hidden = true;
    document.documentElement.style.overflow = "";
    sheetId = sheetSel = null;
  }

  function renderSheet() {
    if (!sheetId) return;
    const id = sheetId, s = slots[id], occ = known() && occupied(id);
    const numEl = sheet(".sheet-head .num");
    numEl.className = `num ${s.color}${occ ? " occ" : ""}${known() ? "" : " unk"}`;
    numEl.textContent = s.num || "–";
    sheetSel.classList.toggle("occ", occ);
    const when = !state[id] ? "" : occ ? ` · ${esc(holderOf(id))}` : ` · เปลี่ยนเมื่อ ${timeOf(state[id].updated_at)}`;
    sheet(".st").innerHTML = known()
      ? `สถานะ: <b class="${occ ? "o" : ""}">${statusOf(id)}</b>${when}` + (loadFailed ? ` · ข้อมูลเมื่อ ${timeOf(loadedAt)} (โหลดใหม่ไม่ได้)` : "")
      : `สถานะ: <b>ยังไม่ทราบ</b> · ${loadFailed ? "โหลดไม่ได้ (เช็คเน็ต)" : "กำลังโหลด…"}`;

    let text, act = null, msg = "", warn = false;
    if (bridge) {
      // ช่องไม่ว่างที่คนขับเห็นในหน้านี้แล้วกดยืนยัน = แทนที่รอบเดิมได้ (takeover) · ยังไม่ทราบสถานะ = ให้ฐานข้อมูลตัดสิน แอปจะถามอีกทีถ้าชน
      act = () => {
        closeSheet();
        if (typeof bridge.pickSlot === "function") bridge.pickSlot(id, s.label, occ);
        else bridge.pick(id, s.label); // แอปรุ่นก่อนมีแค่ pick
      };
      const other = occ && !mine(id);
      if (other) {
        text = "ยืนยัน รถฉันจอดช่องนี้";
        msg = (id === current ? "ช่องที่เลือกไว้ แต่บนผังขึ้นว่ารถคันอื่นจอดอยู่" : "ช่องนี้มีรถคันอื่นตั้งไว้")
          + " ตรวจคลัง ด้าน สี และเลขช่องอีกครั้ง ถ้ารถคุณจอดช่องนี้จริงกดยืนยันได้";
        warn = true;
      } else if (id === current) {
        text = "ใช้ช่องนี้ต่อ";
        msg = "ช่องที่เลือกไว้ตอนนี้";
      } else if (occ) {
        text = "จอดช่องนี้";
        msg = `ช่องนี้ตั้งไว้เป็นของรถคุณ (${state[id].plate}) อยู่แล้ว`;
      } else {
        text = "จอดช่องนี้";
        if (!known()) msg = "ยังไม่ทราบว่าช่องนี้ว่างไหม เลือกได้ตามปกติ แอปจะตั้งเป็น ไม่ว่าง ให้เมื่อเชื่อมต่อได้";
      }
    } else if (!known()) {
      text = "ลองโหลดสถานะใหม่";
      act = () => load();
      msg = "ยังไม่ทราบสถานะช่องนี้ จึงยังเปลี่ยน ว่าง / ไม่ว่าง ไม่ได้";
      warn = true;
    } else if (pending.has(id)) {
      text = "กำลังบันทึก…";
    } else {
      text = occ ? "ตั้งเป็น ว่าง (รถออกแล้ว)" : "ตั้งเป็น ไม่ว่าง (มีรถจอด)";
      act = () => { closeSheet(); setSlot(id, !occ); };
    }
    const go = sheet(".go"), msgEl = sheet(".msg");
    go.textContent = text;
    go.disabled = !act;
    go.onclick = act;
    msgEl.textContent = msg;
    msgEl.className = "msg" + (warn ? " warn" : "");
    msgEl.hidden = !msg;
  }

  function zoomToSide(wall) {
    const ids = walls.find(w => w.wall === wall).ids, vb = svg.viewBox.baseVal;
    const bs = ids.map(bounds);
    const fx = ((Math.min(...bs.map(b => b.x0)) + Math.max(...bs.map(b => b.x1))) / 2 - vb.x) / vb.width;
    const fy = ((Math.min(...bs.map(b => b.y0)) + Math.max(...bs.map(b => b.y1))) / 2 - vb.y) / vb.height;
    viewer.classList.add("zoom");
    if (fit) fit.hidden = false;
    requestAnimationFrame(() => {
      const box = svg.getBoundingClientRect();
      viewer.scrollLeft = box.width * fx - viewer.clientWidth / 2;
      window.scrollTo({top: viewer.offsetTop + box.height * fy - innerHeight / 2});
    });
  }

  async function init() {
    try {
      const r = await fetch(img.getAttribute("src"), {cache: "no-cache"});
      if (!r.ok) throw new Error(r.status);
      svg = new DOMParser().parseFromString(await r.text(), "image/svg+xml").documentElement;
      if (svg.nodeName !== "svg") throw new Error("bad svg");
    } catch (e) {
      statusEl.className = "err";
      statusEl.textContent = "โหลดผังไม่ได้ ใช้งานเลือกช่องไม่ได้";
      if (intro) intro.hidden = false;
      return;
    }
    svg = document.importNode(svg, true);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-label", img.alt);
    img.replaceWith(svg);

    // ปุ่ม "ขยาย" 8 ปุ่มเดิมใช้ตัวเลือกด้าน + ปุ่ม "ดู…บนผัง" แทน
    document.querySelectorAll(".zoomTo").forEach(b => b.hidden = true);
    const sub = intro && intro.querySelector(".sub");
    if (sub) sub.textContent = "เลือกคลังและด้าน แล้วแตะเลขช่องเพื่อดูรายละเอียด · ผังทั้งลานอยู่ด้านล่าง";
    if (bridge) document.querySelectorAll(".btns a").forEach(a => a.hidden = true); // ในแอปไม่ให้ออกไปหน้าอื่น

    buildPicker();
    let saved = null;
    try { saved = localStorage.getItem(SIDE_KEY); } catch (e) {}
    selectSide(slots[current] ? slots[current].wall : saved, false);
    sideOnMap.onclick = () => zoomToSide(side);
    find.addEventListener("input", () => { query = find.value.trim(); showResults(); });
    retryBtn.onclick = () => load();
    sheet(".x").onclick = sheet(".no").onclick = closeSheet;
    back.addEventListener("click", e => { if (e.target === back) closeSheet(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetId) closeSheet(); });
    renderAll(); // ไม่เลื่อนหาช่องปัจจุบัน ให้เห็นตัวเลือกคลัง/ด้านก่อน (เปิดด้านของช่องปัจจุบันไว้ให้แล้ว)

    await load();
    setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  }

  init();
})();

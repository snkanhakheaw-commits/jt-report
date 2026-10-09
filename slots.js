// สลับสถานะช่องจอด ว่าง / ไม่ว่าง ให้ทุกคนเห็นตรงกัน (เก็บที่ Supabase ตาราง jt_parking_slots)
// ใช้กับ map.html: แค่ใส่ <script src="slots.js" defer></script> ก่อน </body>
// ไฟล์นี้แทนที่ <img src="plan.svg"> ด้วย SVG จริง เพื่อให้แตะช่องบนผังได้ และสร้างปุ่มช่องขนาดใหญ่ไว้ใต้ผัง
(() => {
  const API = "https://urbvwplaoznyhvcsvore.supabase.co/rest/v1";
  const KEY = "sb_publishable_Vudb-REBewSsT9BWbTf1zA_8pLvwgqQ"; // คีย์สาธารณะ อ่านได้ทุกคน เขียนได้แค่ผ่านฟังก์ชัน jt_set_parking_slot
  const POLL_MS = 10000;
  const BUILDINGS = {"b2-south": "อาคาร 2 ด้านใต้", "b2-west": "อาคาร 2 ด้านตะวันตก", "b2-north": "อาคาร 2 ด้านเหนือ", "b1-inner-east": "อาคาร 1 ด้านตะวันออก"};
  const COLORS = {yellow: "เหลือง", white: "ขาว"};

  const viewer = document.getElementById("viewer");
  const img = viewer && viewer.querySelector("img");
  if (!img) return;

  const css = document.createElement("style");
  css.textContent = `
.viewer svg{display:block;width:100%;max-width:1400px;height:auto;margin:0 auto}
.viewer.zoom svg{width:320%;max-width:none}
.viewer svg [data-slot]{cursor:pointer}
.viewer svg [data-slot].occ polygon{fill:#c8141c;stroke:#7a0b10}
.viewer svg [data-slot].occ text{fill:#fff}
.slots{max-width:560px;margin:0 auto;padding:0 16px 24px}
.slots h2{font-size:19px;margin:20px 0 4px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.slots h2 .count{font-size:15px;font-weight:600;color:var(--muted)}
.slots h3{font-size:14px;font-weight:600;color:var(--muted);margin:12px 0 6px}
.slots .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:6px}
.slot{min-height:48px;border-radius:10px;border:2px solid #a8860f;background:#f6d443;color:#283d48;font:inherit;font-weight:700;font-size:18px;cursor:pointer;padding:0;line-height:1.1}
.slot.white{background:#fff;border-color:#6d8591}
.slot small{display:block;font-size:11px;font-weight:600}
.slot small.code{width:max-content;margin:2px auto 0;padding:0 5px;border-radius:4px;background:#283d48;color:#fff;font-weight:700;text-decoration:none}
.slot.occ{background:#c8141c;border-color:#7a0b10;color:#fff;text-decoration:line-through}
.slot:disabled{opacity:.55}
.slotbar{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 16px;font-size:14px;color:var(--muted);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.slotbar b{color:var(--ink)}
.slotbar .err{color:var(--accent);font-weight:600}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin:8px 0 0}
.legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid #6d8591;background:#fff}
.legend i.occ{background:#c8141c;border-color:#7a0b10}
`;
  document.head.appendChild(css);

  const bar = document.createElement("div");
  bar.className = "slotbar";
  bar.innerHTML = `<span>แตะช่องเพื่อสลับ <b>ว่าง</b> / <b style="color:#c8141c">ไม่ว่าง</b></span><span id="slotStatus">กำลังโหลดสถานะ…</span>`;
  viewer.before(bar);
  const statusEl = bar.querySelector("#slotStatus");

  const list = document.createElement("div");
  list.className = "slots";
  viewer.after(list);

  const state = {};   // slot id -> {occupied, updated_at}
  const slots = {};   // slot id -> {g, btn, building}
  const pending = new Set();
  let lastErr = "";

  const headers = {apikey: KEY, "Content-Type": "application/json"};
  const timeOf = iso => new Date(iso).toLocaleTimeString("th-TH", {hour: "2-digit", minute: "2-digit"});

  function render(id) {
    const s = slots[id], occ = !!(state[id] && state[id].occupied);
    s.g.classList.toggle("occ", occ);
    s.btn.classList.toggle("occ", occ);
    s.btn.setAttribute("aria-pressed", occ);
    s.btn.disabled = pending.has(id);
    const when = state[id] ? ` · เปลี่ยนเมื่อ ${timeOf(state[id].updated_at)}` : "";
    s.btn.title = `${s.label} · ${occ ? "ไม่ว่าง" : "ว่าง"}${when}`;
  }

  function renderCounts() {
    list.querySelectorAll("h2[data-building]").forEach(h => {
      const ids = Object.keys(slots).filter(id => slots[id].building === h.dataset.building);
      const free = ids.filter(id => !(state[id] && state[id].occupied)).length;
      h.querySelector(".count").textContent = `ว่าง ${free} / ${ids.length}`;
    });
  }

  function showStatus() {
    statusEl.className = lastErr ? "err" : "";
    statusEl.textContent = lastErr || `อัปเดต ${new Date().toLocaleTimeString("th-TH", {hour: "2-digit", minute: "2-digit", second: "2-digit"})}`;
  }

  async function load() {
    try {
      const r = await fetch(`${API}/jt_parking_slots?select=slot_id,occupied,updated_at`, {headers, cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      for (const row of await r.json()) if (!pending.has(row.slot_id)) state[row.slot_id] = row;
      lastErr = "";
    } catch (e) {
      lastErr = "โหลดสถานะไม่ได้ (เช็คเน็ต)";
    }
    Object.keys(slots).forEach(render);
    renderCounts();
    showStatus();
  }

  async function toggle(id) {
    if (pending.has(id)) return;
    const prev = state[id];
    const next = !(prev && prev.occupied);
    state[id] = {slot_id: id, occupied: next, updated_at: new Date().toISOString()};
    pending.add(id);
    render(id); renderCounts();
    try {
      const r = await fetch(`${API}/rpc/jt_set_parking_slot`, {method: "POST", headers, body: JSON.stringify({p_slot_id: id, p_occupied: next})});
      if (!r.ok) throw new Error(r.status);
      state[id] = await r.json();
      lastErr = "";
    } catch (e) {
      if (prev) state[id] = prev; else delete state[id];
      lastErr = `บันทึก ${slots[id].label} ไม่สำเร็จ ลองใหม่`;
    }
    pending.delete(id);
    render(id); renderCounts(); showStatus();
  }

  function buildList(svg) {
    svg.querySelectorAll("g[data-wall]").forEach(wall => {
      const building = wall.dataset.wall;
      const docks = [...wall.querySelectorAll("g[id^='dock-']")];
      if (!docks.length) return;
      const h2 = document.createElement("h2");
      h2.dataset.building = building;
      h2.innerHTML = `<span>${BUILDINGS[building] || building}</span><span class="count"></span>`;
      list.appendChild(h2);

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
      const minNum = gs => gs[0].dataset.number ? Math.min(...gs.map(g => +g.dataset.number)) : Infinity;
      const colorRank = gs => gs[0].dataset.color === "yellow" ? 0 : 1;
      groups.sort((a, b) => minNum(a) - minNum(b) || colorRank(a) - colorRank(b));
      for (const gs of groups) {
        const color = gs[0].dataset.color, numbered = !!gs[0].dataset.number;
        gs.sort((a, b) => (+a.dataset.number || 0) - (+b.dataset.number || 0));
        const h3 = document.createElement("h3");
        h3.textContent = numbered
          ? `สี${COLORS[color] || color} ${gs[0].dataset.number}–${gs[gs.length - 1].dataset.number}`
          : `สี${COLORS[color] || color} ไม่มีเลข (${gs.length} ช่อง)`;
        const grid = document.createElement("div");
        grid.className = "grid";
        gs.forEach((g, i) => {
          const id = g.id, num = g.dataset.number, code = g.dataset.code;
          const label = (num ? `${COLORS[color] || color} ${num}` : `${COLORS[color] || color} ไม่มีเลข ${i + 1}`) + (code ? ` (${code})` : "");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `slot ${color}`;
          btn.innerHTML = (num ? num : `–<small>${i + 1}</small>`) + (code ? `<small class="code">${code}</small>` : "");
          btn.onclick = () => toggle(id);
          grid.appendChild(btn);
          g.dataset.slot = id;
          g.addEventListener("click", () => toggle(id));
          slots[id] = {g, btn, building, label: `${BUILDINGS[building] || building} ${label}`};
        });
        list.append(h3, grid);
      }
    });
    const legend = document.createElement("p");
    legend.className = "legend";
    legend.innerHTML = `<span><i></i>ว่าง (สีตามเส้นพื้น)</span><span><i class="occ"></i>ไม่ว่าง</span><span>รีเฟรชเองทุก ${POLL_MS / 1000} วินาที</span>`;
    list.appendChild(legend);
  }

  async function init() {
    let svg;
    try {
      const r = await fetch(img.getAttribute("src"), {cache: "no-cache"});
      if (!r.ok) throw new Error(r.status);
      svg = new DOMParser().parseFromString(await r.text(), "image/svg+xml").documentElement;
      if (svg.nodeName !== "svg") throw new Error("bad svg");
    } catch (e) {
      statusEl.className = "err";
      statusEl.textContent = "โหลดผังไม่ได้ ใช้งานสลับช่องไม่ได้";
      return;
    }
    svg = document.importNode(svg, true);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-label", img.alt);
    img.replaceWith(svg);

    // ปุ่ม "ขยาย" เดิมอ้างถึง <img> จึงผูกใหม่ให้ใช้ SVG
    const fit = document.getElementById("fitBtn");
    document.querySelectorAll(".zoomTo").forEach(b => b.onclick = () => {
      viewer.classList.add("zoom");
      if (fit) fit.hidden = false;
      requestAnimationFrame(() => {
        const box = svg.getBoundingClientRect();
        viewer.scrollLeft = box.width * +b.dataset.x - viewer.clientWidth / 2;
        window.scrollTo({top: viewer.offsetTop + box.height * +b.dataset.y - innerHeight / 2});
      });
    });

    buildList(svg);
    await load();
    setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  }

  init();
})();

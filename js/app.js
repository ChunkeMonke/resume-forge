// Resume Forge editor: state, history, editing panel, design panel, live preview,
// import, backup and PDF.
import {
  TEMPLATES, TEMPLATE_ORDER, ACCENTS, FONTS, PAGE_SIZES, BUILTIN, ENTRY_KINDS, PRESETS,
  SAMPLE, normalize, blankState, clone, uid, sectionTitle, allSectionKeys, design,
} from "./model.js";
import { layout, flowHtml, pageHtml, pageBox, esc } from "./render.js";
import { icon } from "./icons.js";

const STORE = "resumeforge:v2";
const LEGACY = "resumeforge:v1";
const UI_STORE = "resumeforge:ui";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

/* ---------------- state ---------------- */
let state;
let firstVisit = false;
let migrated = false;
{
  const raw = ls.get(STORE);
  const legacy = !raw && ls.get(LEGACY);
  try {
    if (raw) state = normalize(JSON.parse(raw));
    else if (legacy) { state = normalize(JSON.parse(legacy)); migrated = true; }
  } catch { state = null; }
  if (!state) { state = clone(SAMPLE); firstVisit = true; }
}

const ui = Object.assign({ welcome: true, panelW: 460, tipShown: false }, (() => {
  try { return JSON.parse(ls.get(UI_STORE)) || {}; } catch { return {}; }
})());
ui.welcome = firstVisit && ui.welcome !== false;
const open = { sections: new Set(["contact"]), entries: new Set() };
let tab = "content";
const saveUi = () => ls.set(UI_STORE, JSON.stringify({ welcome: ui.welcome, panelW: ui.panelW, tipShown: ui.tipShown }));

/* ---------------- history ---------------- */
const past = [], future = [];
let lastKey = null, lastTime = 0;

function commit(fn, opts = {}) {
  const now = Date.now();
  const snap = JSON.stringify(state);
  if (!(opts.coalesce && opts.coalesce === lastKey && now - lastTime < 1200)) {
    past.push(snap);
    if (past.length > 150) past.shift();
  }
  future.length = 0;
  lastKey = opts.coalesce || null;
  lastTime = now;
  fn(state);
  afterChange(opts.render);
}
function afterChange(render) {
  save();
  schedulePreview();
  updateUndo();
  if (render === "content" || render === "all") renderContent();
  if (render === "design" || render === "all") renderDesign();
  else if (tab === "design") scheduleThumbs();
}
function undo() {
  if (!past.length) return;
  future.push(JSON.stringify(state));
  state = JSON.parse(past.pop());
  lastKey = null;
  afterChange("all");
}
function redo() {
  if (!future.length) return;
  past.push(JSON.stringify(state));
  state = JSON.parse(future.pop());
  lastKey = null;
  afterChange("all");
}
function updateUndo() {
  $("#btn-undo").disabled = !past.length;
  $("#btn-redo").disabled = !future.length;
}

/* ---------------- saving ---------------- */
let saveTimer = null;
function save() {
  const el = $("#save-state");
  el.classList.add("saving");
  el.classList.remove("error");
  $(".txt", el).textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 450);
}
function flushSave() {
  clearTimeout(saveTimer);
  const el = $("#save-state");
  const ok = ls.set(STORE, JSON.stringify(state));
  el.classList.remove("saving");
  el.classList.toggle("error", !ok);
  $(".txt", el).textContent = ok ? "Saved on this device" : "Can't save here. Download a backup.";
}
addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushSave());

/* ---------------- path helpers ---------------- */
const customById = (id) => state.customSections.find((c) => c.id === id);
function locate(path) {
  const p = path.split(".");
  switch (p[0]) {
    case "contact": return [state.contact, p[1]];
    case "summary": return [state, "summary"];
    case "title": return BUILTIN[p[1]] ? [state.sectionTitles, p[1]] : [customById(p[1]), "label"];
    case "skills": return [state.skillGroups.find((g) => g.id === p[1]), p[2]];
    case "entry": {
      const e = state[p[1]].find((x) => x.id === p[2]);
      return p[3] === "bullets" ? [e.bullets, +p[4]] : [e, p[3]];
    }
    case "custom": {
      const c = customById(p[1]);
      if (p[2] === "label" || p[2] === "content") return [c, p[2]];
      const e = c.entries.find((x) => x.id === p[2]);
      return p[3] === "bullets" ? [e.bullets, +p[4]] : [e, p[3]];
    }
  }
  return [null, null];
}
function setPath(path, value) {
  const [obj, key] = locate(path);
  if (obj) obj[key] = value;
}
// The list an entry lives in, from "entry.kind.id" or "custom.cid.eid" style bases.
function entryList(listKey) {
  if (listKey.startsWith("custom.")) return customById(listKey.slice(7)).entries;
  return state[listKey];
}
const entryBase = (listKey, id) => (listKey.startsWith("custom.") ? `${listKey}.${id}` : `entry.${listKey}.${id}`);

/* ---------------- preview ---------------- */
const pagesEl = $("#pages"), scalerEl = $("#scaler"), canvasEl = $("#canvas");
let previewTimer = null, lastLayout = null;
function schedulePreview(delay = 60) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, delay);
}
function renderPreview() {
  lastLayout = layout(state);
  pagesEl.innerHTML = lastLayout.pages.join("");
  sizePreview();
  const pill = $("#fit-pill"), txt = $(".txt", pill);
  const L = lastLayout;
  pill.classList.toggle("multi", L.count > 1);
  pill.classList.toggle("warn", L.oversize);
  if (L.oversize) txt.textContent = "One entry is taller than a page. Shorten it.";
  else if (L.count > 1) txt.textContent = `${L.count} pages${state.fitOnePage ? " · too long to fit on one" : ""}`;
  else if (L.scalePct < 100) txt.textContent = `Fit to one page · text at ${L.scalePct}%`;
  else txt.textContent = "Fits on one page";
}
function sizePreview() {
  if (!lastLayout) return;
  const { w, h } = lastLayout.box;
  const n = lastLayout.count, gap = 28;
  const pad = parseFloat(getComputedStyle(canvasEl).paddingLeft) * 2;
  const avail = canvasEl.clientWidth - pad;
  const s = Math.max(0.2, Math.min(1, avail / w));
  pagesEl.style.transform = `scale(${s})`;
  scalerEl.style.width = w * s + "px";
  scalerEl.style.height = (n * h + (n - 1) * gap) * s + "px";
}
new ResizeObserver(() => sizePreview()).observe(canvasEl);

// Hover and click-to-edit on the page
let hoverEl = null;
pagesEl.addEventListener("mouseover", (e) => {
  const t = e.target.closest("[data-ed]");
  if (t === hoverEl) return;
  hoverEl && hoverEl.classList.remove("ed-hover");
  hoverEl = t;
  t && t.classList.add("ed-hover");
});
pagesEl.addEventListener("mouseleave", () => { hoverEl && hoverEl.classList.remove("ed-hover"); hoverEl = null; });
pagesEl.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ed]");
  if (t) focusPath(t.dataset.ed);
});

function focusPath(path) {
  const p = path.split(".");
  let sec = null, ent = null;
  if (p[0] === "contact") sec = "contact";
  else if (p[0] === "summary") sec = "summary";
  else if (p[0] === "title") sec = p[1];
  else if (p[0] === "skills") sec = "skills";
  else if (p[0] === "entry") { sec = p[1]; ent = p[2]; }
  else if (p[0] === "custom") { sec = p[1]; if (p[2] && p[2] !== "label" && p[2] !== "content") ent = p[2]; }
  setView("edit");
  if (tab !== "content") setTab("content");
  if (sec) open.sections.add(sec);
  if (ent) open.entries.add(ent);
  renderContent();
  let target = $(`[data-path="${CSS.escape(path)}"]`, paneContent);
  if (!target && p[0] === "skills") target = $(`[data-tags="skills.${CSS.escape(p[1])}"] input`, paneContent);
  if (!target && p[0] === "custom") target = $(`[data-tags="custom.${CSS.escape(p[1])}"] input`, paneContent);
  if (!target) target = $(`[data-path^="${CSS.escape(path)}."]`, paneContent);
  const card = sec && $(`[data-card="${CSS.escape(sec)}"]`, paneContent);
  if (target) {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
    const flashEl = target.closest(".tags") || target;
    flashEl.classList.remove("flash");
    void flashEl.offsetWidth;
    flashEl.classList.add("flash");
  } else if (card) {
    card.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

/* ---------------- content panel ---------------- */
const paneContent = $("#pane-content");
const paneDesign = $("#pane-design");

const KIND_INFO = {
  experience: { add: "Add position", empty: "Untitled position", bullets: "Accomplishments" },
  activities: { add: "Add activity", empty: "Untitled activity", bullets: "Highlights" },
  education: { add: "Add education", empty: "Untitled school", bullets: "Honors & details" },
  projects: { add: "Add project", empty: "Untitled project", bullets: "Highlights" },
  certifications: { add: "Add certification", empty: "Untitled certification" },
  custom: { add: "Add entry", empty: "Untitled entry", bullets: "Highlights" },
};
const JOB_FIELDS = [
  ["role", "Title", "Product Designer", "full"], ["org", "Organization", "Company or group", "full"],
  ["start", "Start", "Jan 2022"], ["end", "End", "Present"], ["location", "Location", "City, State", "full"],
];
const FIELDS = {
  experience: [["role", "Job title", "Product Designer", "full"], ["org", "Company", "Acme Inc.", "full"], ["start", "Start", "Jan 2022"], ["end", "End", "Present"], ["location", "Location", "City, State", "full"]],
  activities: JOB_FIELDS,
  custom: JOB_FIELDS,
  education: [["school", "School", "University of Colorado", "full"], ["degree", "Degree", "B.S. Computer Science", "full"], ["start", "Start", "2019"], ["end", "End", "2023"], ["location", "Location", "City, State"], ["gpa", "GPA", "3.8"], ["coursework", "Relevant coursework", "Courses, separated by commas", "full"]],
  projects: [["name", "Project name", "Mobile app for local food banks", "full"], ["role", "Your role", "Lead developer"], ["date", "Date", "2024"], ["link", "Link", "github.com/you/project", "full"]],
  certifications: [["name", "Certification", "AWS Solutions Architect", "full"], ["issuer", "Issuer", "Amazon Web Services"], ["date", "Date", "2024"]],
};

function entrySummary(kind, e) {
  const info = KIND_INFO[kind];
  const dates = [e.start, e.end].filter(Boolean).join(" – ");
  if (kind === "education") return [e.school || info.empty, [e.degree, dates].filter(Boolean).join(" · ")];
  if (kind === "projects") return [e.name || info.empty, [e.role, e.date].filter(Boolean).join(" · ")];
  if (kind === "certifications") return [e.name || info.empty, [e.issuer, e.date].filter(Boolean).join(" · ")];
  return [e.role || e.org || info.empty, [e.role ? e.org : "", dates].filter(Boolean).join(" · ")];
}

const input = (path, value, ph, label, cls = "", type = "text") => {
  const id = "f-" + path.replace(/[^a-z0-9]/gi, "-");
  return `<div class="field ${cls}"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" type="${type}" data-path="${esc(path)}" value="${esc(value)}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
};
const textarea = (path, value, ph, label, cls = "", hint = "") => {
  const id = "f-" + path.replace(/[^a-z0-9]/gi, "-");
  return `<div class="field ${cls}"><label for="${id}">${esc(label)}</label><textarea class="textarea" id="${id}" rows="3" data-path="${esc(path)}" placeholder="${esc(ph)}">${esc(value)}</textarea>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
};

function bulletsHtml(base, list, label) {
  const rows = (list.length ? list : [""]).map((b, i) =>
    `<div class="bullet"><textarea class="textarea" rows="1" data-path="${esc(base)}.bullets.${i}" data-bullet="${i}" placeholder="Start with a verb and include a result, like “Cut costs 22%…”" aria-label="${esc(label)} ${i + 1}">${esc(b)}</textarea><button class="icon-btn" type="button" data-act="del-bullet" data-base="${esc(base)}" data-i="${i}" aria-label="Remove bullet ${i + 1}">${icon("x")}</button></div>`).join("");
  return `<div class="field full"><span class="label">${esc(label)}</span><div class="bullets" data-bullets="${esc(base)}">${rows}</div>
    <button class="add-line" type="button" data-act="add-bullet" data-base="${esc(base)}">${icon("plus")}Add bullet</button></div>`;
}

function tagsHtml(key, items, label, ph) {
  return `<div class="tags" data-tags="${esc(key)}">${items.map((t, i) => `<span class="tag">${esc(t)}<button type="button" data-act="del-tag" data-tags-key="${esc(key)}" data-i="${i}" aria-label="Remove ${esc(t)}">${icon("x")}</button></span>`).join("")}<input type="text" placeholder="${esc(ph)}" aria-label="${esc(label)}" autocomplete="off"></div>`;
}

function entryHtml(listKey, kind, e) {
  const base = entryBase(listKey, e.id);
  const isOpen = open.entries.has(e.id);
  const [t, sub] = entrySummary(kind, e);
  const fields = FIELDS[kind].map(([f, label, ph, full]) => input(`${base}.${f}`, e[f] || "", ph, label, full ? "full" : "")).join("");
  const info = KIND_INFO[kind];
  return `<div class="entry${isOpen ? " is-open" : ""}${e.include === false ? " is-off" : ""}" data-sort-id="${e.id}" data-entry="${e.id}">
    <div class="entry-head" data-toggle="ent:${e.id}">
      <button class="grip" type="button" data-grip aria-label="Reorder ${esc(t)}. Drag, or use the arrow keys.">${icon("grip")}</button>
      <div class="entry-sum"><b>${esc(t)}</b><span>${esc(sub) || "&nbsp;"}</span></div>
      <div class="entry-actions">
        <button class="icon-btn" type="button" data-act="toggle-include" data-list="${esc(listKey)}" data-id="${e.id}" aria-pressed="${e.include !== false}" aria-label="${e.include === false ? "Show on resume" : "Hide from resume"}" title="${e.include === false ? "Hidden. Click to show on your resume" : "Hide from resume (keeps it saved)"}">${icon(e.include === false ? "eyeOff" : "eye")}</button>
        <button class="icon-btn" type="button" data-act="dup-entry" data-list="${esc(listKey)}" data-id="${e.id}" aria-label="Duplicate" title="Duplicate">${icon("copy")}</button>
        <button class="icon-btn" type="button" data-act="del-entry" data-list="${esc(listKey)}" data-id="${e.id}" aria-label="Delete" title="Delete">${icon("trash")}</button>
        <span class="icon-btn chev" aria-hidden="true">${icon("chev")}</span>
      </div>
    </div>
    <div class="entry-body"><div class="grid">${fields}${info.bullets ? bulletsHtml(base, e.bullets || [], info.bullets) : ""}</div></div>
  </div>`;
}

function entriesHtml(listKey, kind, list) {
  return `<div class="entries" data-sortable="entries:${esc(listKey)}">${list.map((e) => entryHtml(listKey, kind, e)).join("")}</div>
    <button class="add-entry" type="button" data-act="add-entry" data-list="${esc(listKey)}" data-kind="${kind}">${icon("plus")}${KIND_INFO[kind].add}</button>`;
}

function sectionBody(key) {
  if (key === "summary") return textarea("summary", state.summary, "Two or three sentences on who you are, what you've done, and what you want next.", "Professional summary", "", "Aim for 2–3 sentences. Lead with your title and years of experience.");
  if (key === "skills") {
    return `<div data-sortable="skills">${state.skillGroups.map((g) => `<div class="skill-group" data-sort-id="${g.id}">
        <button class="grip" type="button" data-grip aria-label="Reorder ${esc(g.label || "category")}">${icon("grip")}</button>
        <div><input class="input" data-path="skills.${g.id}.label" value="${esc(g.label)}" placeholder="Category, e.g. Languages" aria-label="Skill category name">
        ${tagsHtml("skills." + g.id, g.items, "Skills in " + (g.label || "this category"), g.items.length ? "Add skill…" : "Type a skill and press Enter")}</div>
        <button class="icon-btn" type="button" data-act="del-group" data-id="${g.id}" aria-label="Delete category">${icon("trash")}</button>
      </div>`).join("")}</div>
      <button class="add-line" type="button" data-act="add-group">${icon("plus")}Add category</button>`;
  }
  if (ENTRY_KINDS.includes(key)) return entriesHtml(key, key, state[key]);
  const cs = customById(key);
  if (cs.kind === "text") return textarea(`custom.${cs.id}.content`, cs.content, "Write anything here…", "Text");
  if (cs.kind === "list") return `<div class="field"><span class="label">Items</span>${tagsHtml("custom." + cs.id, cs.items, "Items", "Type and press Enter")}</div>`;
  return entriesHtml("custom." + cs.id, "custom", cs.entries);
}

function sectionCount(key) {
  if (ENTRY_KINDS.includes(key)) return state[key].length;
  if (key === "skills") return state.skillGroups.reduce((n, g) => n + g.items.length, 0);
  const cs = customById(key);
  if (cs && cs.kind === "entries") return cs.entries.length;
  if (cs && cs.kind === "list") return cs.items.length;
  return 0;
}

function sectionCard(key) {
  const isOpen = open.sections.has(key);
  const title = sectionTitle(state, key);
  const n = sectionCount(key);
  const custom = !BUILTIN[key];
  return `<div class="card${isOpen ? " is-open" : ""}" data-sort-id="${esc(key)}" data-card="${esc(key)}">
    <div class="card-head" data-toggle="sec:${esc(key)}">
      <button class="grip" type="button" data-grip aria-label="Reorder ${esc(title)}. Drag, or use the arrow keys.">${icon("grip")}</button>
      <div class="title-wrap"><input class="sec-title" data-path="title.${esc(key)}" value="${esc(title)}" placeholder="${esc(BUILTIN[key] || "Section title")}" aria-label="Section title" spellcheck="false">${n ? `<span class="count">${n}</span>` : ""}</div>
      <button class="icon-btn" type="button" data-act="hide-sec" data-key="${esc(key)}" aria-label="Remove ${esc(title)} from resume" title="${custom ? "Delete section" : "Remove from resume (you can add it back)"}">${icon(custom ? "trash" : "eyeOff")}</button>
      <span class="icon-btn chev" aria-hidden="true">${icon("chev")}</span>
    </div>
    <div class="card-body">${sectionBody(key)}</div>
  </div>`;
}

function contactCard() {
  const c = state.contact, isOpen = open.sections.has("contact");
  return `<div class="card${isOpen ? " is-open" : ""}" data-card="contact">
    <div class="card-head" data-toggle="sec:contact"><span class="grip-spacer"></span><div class="title-wrap"><span class="sec-title-static">Personal details</span></div><span class="icon-btn chev" aria-hidden="true">${icon("chev")}</span></div>
    <div class="card-body"><div class="grid">
      ${input("contact.fullName", c.fullName, "Jordan Reyes", "Full name", "full")}
      ${input("contact.roleTitle", c.roleTitle, "Mechanical Design Engineer", "Headline or target role", "full")}
      ${input("contact.email", c.email, "you@email.com", "Email", "", "email")}
      ${input("contact.phone", c.phone, "(555) 123-4567", "Phone", "", "tel")}
      ${input("contact.location", c.location, "Denver, CO", "Location")}
      ${input("contact.linkedin", c.linkedin, "linkedin.com/in/you", "LinkedIn")}
      ${input("contact.website", c.website, "yoursite.com", "Website or portfolio")}
      ${input("contact.extra", c.extra, "e.g. Secret clearance", "Extra detail (optional)")}
    </div></div>
  </div>`;
}

function renderContent() {
  const scroll = $("#panel").scrollTop;
  const hidden = allSectionKeys(state).filter((k) => BUILTIN[k] && !state.sectionOrder.includes(k));
  const welcome = ui.welcome ? `<div class="welcome">
      <button class="icon-btn close" type="button" data-act="dismiss-welcome" aria-label="Dismiss">${icon("x")}</button>
      <h2>Make it <em>yours</em>.</h2>
      <p>This is an example. Edit it in place, import the resume you already have, or start from a clean page.</p>
      <div class="row"><button class="btn btn-light" type="button" data-act="import">${icon("upload")}Import resume</button><button class="btn btn-outline" type="button" data-act="blank">Start blank</button></div>
    </div>` : "";
  paneContent.innerHTML = `${welcome}
    ${contactCard()}
    <div data-sortable="sections">${state.sectionOrder.map(sectionCard).join("")}</div>
    <h3 class="subhead">Add a section</h3>
    <div class="chip-row">
      ${hidden.map((k) => `<button class="chip" type="button" data-act="show-sec" data-key="${k}">${icon("plus")}${esc(sectionTitle(state, k))}</button>`).join("")}
      ${PRESETS.filter((p) => !state.customSections.some((c) => c.label === p.label)).map((p) => `<button class="chip" type="button" data-act="add-preset" data-key="${p.key}">${icon("plus")}${esc(p.label)}</button>`).join("")}
      <button class="chip" type="button" data-act="add-custom">${icon("plus")}Custom section</button>
    </div>`;
  autoGrowAll(paneContent);
  $("#panel").scrollTop = scroll;
}

function autoGrow(t) {
  if (!t.offsetParent) return;
  t.style.height = "auto";
  t.style.height = t.scrollHeight + 2 + "px";
}
const autoGrowAll = (root) => $$("textarea", root).forEach(autoGrow);

function refocus(selector, caret) {
  const el = $(selector, paneContent);
  if (!el) return;
  el.focus();
  if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret);
}

/* ----- content events ----- */
paneContent.addEventListener("input", (e) => {
  const t = e.target;
  if (t.tagName === "TEXTAREA") autoGrow(t);
  const path = t.dataset.path;
  if (path) {
    // Pasting several lines into a bullet splits them into bullets.
    if (t.dataset.bullet != null && /\n/.test(t.value)) {
      const parts = t.value.split(/\r?\n/).map((x) => x.replace(/^\s*[•\-*–·▪]\s*/, "").trim()).filter(Boolean);
      const base = path.replace(/\.bullets\.\d+$/, "");
      const i = +t.dataset.bullet;
      commit(() => { const list = locate(base + ".bullets.0")[0]; list.splice(i, 1, ...parts); }, { render: "content" });
      refocus(`[data-path="${CSS.escape(base + ".bullets." + (i + parts.length - 1))}"]`, 9999);
      return;
    }
    commit(() => setPath(path, t.value), { coalesce: path });
    const entry = t.closest(".entry");
    if (entry) updateEntrySummary(entry);
    return;
  }
  const tags = t.closest(".tags");
  if (tags && /,/.test(t.value)) addTags(tags, t.value);
});

function updateEntrySummary(entryEl) {
  const id = entryEl.dataset.entry;
  const list = entryEl.closest("[data-sortable]").dataset.sortable.slice(8);
  const e = entryList(list).find((x) => x.id === id);
  const kind = list.startsWith("custom.") ? "custom" : list;
  const [t, sub] = entrySummary(kind, e);
  $(".entry-sum b", entryEl).textContent = t;
  $(".entry-sum span", entryEl).innerHTML = esc(sub) || "&nbsp;";
}

function tagList(key) {
  const [type, id] = key.split(".");
  return type === "skills" ? state.skillGroups.find((g) => g.id === id).items : customById(id).items;
}
function addTags(tagsEl, raw) {
  const key = tagsEl.dataset.tags;
  const items = raw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  if (!items.length) { $("input", tagsEl).value = ""; return; }
  commit(() => tagList(key).push(...items), { render: "content" });
  refocus(`[data-tags="${CSS.escape(key)}"] input`);
}

paneContent.addEventListener("keydown", (e) => {
  const t = e.target;
  // Tag inputs
  const tags = t.closest && t.closest(".tags");
  if (tags && t.tagName === "INPUT") {
    if (e.key === "Enter") { e.preventDefault(); addTags(tags, t.value); }
    else if (e.key === "Backspace" && !t.value) {
      const key = tags.dataset.tags, list = tagList(key);
      if (list.length) {
        e.preventDefault();
        commit(() => list.pop(), { render: "content" });
        refocus(`[data-tags="${CSS.escape(key)}"] input`);
      }
    }
    return;
  }
  // Bullets: Enter splits, Backspace at start merges
  if (t.dataset && t.dataset.bullet != null) {
    const path = t.dataset.path, base = path.replace(/\.bullets\.\d+$/, ""), i = +t.dataset.bullet;
    const listOf = () => locate(base + ".bullets.0")[0];
    const sel = (j) => `[data-path="${CSS.escape(base + ".bullets." + j)}"]`;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const pos = t.selectionStart, before = t.value.slice(0, pos), after = t.value.slice(t.selectionEnd);
      commit(() => { const L = listOf(); L[i] = before; L.splice(i + 1, 0, after); }, { render: "content" });
      refocus(sel(i + 1), 0);
    } else if (e.key === "Backspace" && t.selectionStart === 0 && t.selectionEnd === 0 && i > 0) {
      e.preventDefault();
      const prev = listOf()[i - 1] || "";
      commit(() => { const L = listOf(); L[i - 1] = prev + t.value; L.splice(i, 1); }, { render: "content" });
      refocus(sel(i - 1), prev.length);
    } else if (e.key === "ArrowUp" && t.selectionStart === 0 && i > 0) {
      e.preventDefault(); refocus(sel(i - 1), 9999);
    } else if (e.key === "ArrowDown" && t.selectionStart === t.value.length && $(sel(i + 1), paneContent)) {
      e.preventDefault(); refocus(sel(i + 1), 0);
    }
    return;
  }
  // Keyboard reordering on grips
  if (t.matches && t.matches("[data-grip]") && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const item = t.closest("[data-sort-id]"), list = item.parentElement;
    const ids = $$(":scope > [data-sort-id]", list).map((x) => x.dataset.sortId);
    const i = ids.indexOf(item.dataset.sortId), j = i + (e.key === "ArrowUp" ? -1 : 1);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    applyOrder(list.dataset.sortable, ids);
    refocus(`[data-sortable="${CSS.escape(list.dataset.sortable)}"] > [data-sort-id="${CSS.escape(item.dataset.sortId)}"] [data-grip]`);
  }
  // Enter on section title just confirms
  if (t.classList && t.classList.contains("sec-title") && e.key === "Enter") { e.preventDefault(); t.blur(); }
});

paneContent.addEventListener("focusout", (e) => {
  const t = e.target;
  const tags = t.closest && t.closest(".tags");
  if (tags && t.tagName === "INPUT" && t.value.trim()) {
    const key = tags.dataset.tags, items = t.value.split(",").map((x) => x.trim()).filter(Boolean);
    commit(() => tagList(key).push(...items));
    // Re-render after focus has moved, without stealing it back
    setTimeout(() => { const f = document.activeElement; const p = f && f.dataset && f.dataset.path; renderContent(); if (p) refocus(`[data-path="${CSS.escape(p)}"]`); }, 0);
  }
  if (t.classList && t.classList.contains("sec-title")) {
    const key = t.dataset.path.slice(6);
    if (!t.value.trim()) commit(() => { if (BUILTIN[key]) delete state.sectionTitles[key]; else customById(key).label = "Untitled section"; }, { render: "content" });
  }
});

paneContent.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest(".tags") && !t.closest("button")) { $("input", t.closest(".tags")).focus(); return; }
  const btn = t.closest("[data-act]");
  if (btn) { handleAction(btn.dataset.act, btn); return; }
  const tog = t.closest("[data-toggle]");
  if (tog && !t.closest("input, [data-grip]")) {
    const [type, id] = tog.dataset.toggle.split(":");
    const set = type === "sec" ? open.sections : open.entries;
    set.has(id) ? set.delete(id) : set.add(id);
    const card = tog.parentElement;
    card.classList.toggle("is-open", set.has(id));
    autoGrowAll(card);
  }
});

function newEntry(kind) {
  const base = { id: uid(), include: true };
  if (kind === "education") return { ...base, school: "", degree: "", location: "", start: "", end: "", gpa: "", coursework: "", bullets: [] };
  if (kind === "projects") return { ...base, name: "", role: "", date: "", link: "", bullets: [] };
  if (kind === "certifications") return { ...base, name: "", issuer: "", date: "" };
  return { ...base, org: "", role: "", location: "", start: "", end: "", bullets: [] };
}

async function handleAction(act, btn) {
  const d = btn.dataset;
  switch (act) {
    case "dismiss-welcome": ui.welcome = false; saveUi(); renderContent(); break;
    case "import": openImport(); break;
    case "export": exportBackup(); break;
    case "blank": startBlank(); break;
    case "add-entry": {
      const e = newEntry(d.kind);
      commit(() => entryList(d.list).unshift(e), { render: "content" });
      open.entries.add(e.id);
      renderContent();
      refocus(`[data-entry="${e.id}"] input`);
      break;
    }
    case "del-entry": {
      const list = entryList(d.list), i = list.findIndex((x) => x.id === d.id);
      const [t] = entrySummary(d.list.startsWith("custom.") ? "custom" : d.list, list[i]);
      commit(() => list.splice(i, 1), { render: "content" });
      toast(`Deleted “${t}”`, { label: "Undo", fn: undo });
      break;
    }
    case "dup-entry": {
      const list = entryList(d.list), i = list.findIndex((x) => x.id === d.id);
      const copy = { ...clone(list[i]), id: uid() };
      commit(() => list.splice(i + 1, 0, copy), { render: "content" });
      open.entries.add(copy.id);
      renderContent();
      break;
    }
    case "toggle-include": {
      const e = entryList(d.list).find((x) => x.id === d.id);
      commit(() => (e.include = e.include === false), { render: "content" });
      break;
    }
    case "add-bullet": {
      const L = locate(d.base + ".bullets.0")[0];
      const i = L.length;
      commit(() => L.push(""), { render: "content" });
      refocus(`[data-path="${CSS.escape(d.base + ".bullets." + i)}"]`);
      break;
    }
    case "del-bullet": {
      const L = locate(d.base + ".bullets.0")[0];
      commit(() => L.splice(+d.i, 1), { render: "content" });
      break;
    }
    case "del-tag": commit(() => tagList(d.tagsKey).splice(+d.i, 1), { render: "content" }); break;
    case "add-group": {
      const g = { id: uid(), label: "", items: [] };
      commit(() => state.skillGroups.push(g), { render: "content" });
      refocus(`[data-path="skills.${g.id}.label"]`);
      break;
    }
    case "del-group": {
      const g = state.skillGroups.find((x) => x.id === d.id);
      commit(() => state.skillGroups.splice(state.skillGroups.indexOf(g), 1), { render: "content" });
      toast(`Deleted ${g.label ? "“" + g.label + "”" : "category"}`, { label: "Undo", fn: undo });
      break;
    }
    case "hide-sec": {
      const key = d.key, title = sectionTitle(state, key);
      commit(() => {
        state.sectionOrder = state.sectionOrder.filter((k) => k !== key);
        if (!BUILTIN[key]) state.customSections = state.customSections.filter((c) => c.id !== key);
      }, { render: "content" });
      toast(BUILTIN[key] ? `Removed “${title}” from your resume` : `Deleted “${title}”`, { label: "Undo", fn: undo });
      break;
    }
    case "show-sec":
      commit(() => state.sectionOrder.push(d.key), { render: "content" });
      openAndScroll(d.key);
      break;
    case "add-preset": {
      const p = PRESETS.find((x) => x.key === d.key);
      const cs = { id: uid(), label: p.label, kind: p.kind };
      if (p.kind === "list") cs.items = [];
      if (p.kind === "text") cs.content = "";
      if (p.kind === "entries") cs.entries = [];
      commit(() => { state.customSections.push(cs); state.sectionOrder.push(cs.id); }, { render: "content" });
      openAndScroll(cs.id);
      break;
    }
    case "add-custom": {
      const kind = await choose("What kind of section?", "Pick the format. You can rename it any time.", [
        ["list", "A list", "Languages, interests, tools"], ["entries", "Entries with dates", "Volunteering, research, teaching"], ["text", "A paragraph", "Objective, references"],
      ]);
      if (!kind) return;
      const cs = { id: uid(), label: "New section", kind };
      if (kind === "list") cs.items = [];
      if (kind === "text") cs.content = "";
      if (kind === "entries") cs.entries = [];
      commit(() => { state.customSections.push(cs); state.sectionOrder.push(cs.id); }, { render: "content" });
      openAndScroll(cs.id);
      const ti = $(`[data-path="title.${cs.id}"]`, paneContent);
      if (ti) { ti.focus(); ti.select(); }
      break;
    }
  }
}

function openAndScroll(key) {
  open.sections.add(key);
  renderContent();
  const card = $(`[data-card="${CSS.escape(key)}"]`, paneContent);
  if (card) {
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.classList.add("flash");
  }
}

function applyOrder(sortKey, ids) {
  commit(() => {
    if (sortKey === "sections") state.sectionOrder = ids;
    else if (sortKey === "skills") state.skillGroups = ids.map((id) => state.skillGroups.find((g) => g.id === id));
    else if (sortKey.startsWith("entries:")) {
      const listKey = sortKey.slice(8), list = entryList(listKey);
      const sorted = ids.map((id) => list.find((x) => x.id === id));
      list.splice(0, list.length, ...sorted);
    }
  }, { render: "content" });
}

/* ----- drag to reorder (mouse, touch, pen) ----- */
paneContent.addEventListener("pointerdown", (e) => {
  const grip = e.target.closest("[data-grip]");
  if (!grip || e.button > 0) return;
  const item = grip.closest("[data-sort-id]"), list = item.parentElement;
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  let startY = e.clientY, moved = false;
  const gap = parseFloat(getComputedStyle(list).rowGap) || 10;
  const onMove = (ev) => {
    const dy = ev.clientY - startY;
    if (!moved && Math.abs(dy) < 4) return;
    if (!moved) { moved = true; item.classList.add("dragging"); document.body.classList.add("is-dragging"); }
    item.style.transform = `translateY(${dy}px)`;
    const prev = item.previousElementSibling, next = item.nextElementSibling;
    const r = item.getBoundingClientRect(), mid = r.top + r.height / 2;
    if (next && next.dataset.sortId && mid > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      list.insertBefore(next, item);
      startY += next.offsetHeight + gap;
    } else if (prev && prev.dataset.sortId && mid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      list.insertBefore(item, prev);
      startY -= prev.offsetHeight + gap;
    }
    item.style.transform = `translateY(${ev.clientY - startY}px)`;
    // keep the panel scrolling while dragging near its edges
    const panel = $("#panel"), pr = panel.getBoundingClientRect();
    if (ev.clientY < pr.top + 60) panel.scrollTop -= 10;
    else if (ev.clientY > pr.bottom - 60) panel.scrollTop += 10;
  };
  const onUp = () => {
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", onUp);
    grip.removeEventListener("pointercancel", onUp);
    document.body.classList.remove("is-dragging");
    if (!moved) return;
    item.classList.remove("dragging");
    item.style.transform = "";
    applyOrder(list.dataset.sortable, $$(":scope > [data-sort-id]", list).map((x) => x.dataset.sortId));
  };
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", onUp);
  grip.addEventListener("pointercancel", onUp);
});

/* ---------------- design panel ---------------- */
function renderDesign() {
  const t = TEMPLATES[state.template];
  const accent = state.accent || t.accent, font = state.font || t.font;
  const seg = (name, opts, cur) => `<div class="seg" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-set="${name}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;
  paneDesign.innerHTML = `
    <div class="d-block">
      <div class="d-label"><h3>Template</h3><span>All five read cleanly in applicant tracking systems</span></div>
      <div class="tpl-grid">${TEMPLATE_ORDER.map((k) => `<button class="tpl" type="button" data-set="template" data-v="${k}" aria-pressed="${k === state.template}" title="${esc(TEMPLATES[k].blurb)}">
        <span class="tpl-frame" data-thumb="${k}"></span><span class="tpl-name">${icon("check")}${TEMPLATES[k].name}</span></button>`).join("")}</div>
    </div>
    <div class="d-block">
      <div class="d-label"><h3>Accent color</h3><span>${ACCENTS[accent].label}</span></div>
      <div class="swatches">${Object.keys(ACCENTS).map((k) => `<button class="swatch" type="button" style="--c:${ACCENTS[k].color}" data-set="accent" data-v="${k}" aria-pressed="${k === accent}" aria-label="${ACCENTS[k].label}" title="${ACCENTS[k].label}"></button>`).join("")}</div>
    </div>
    <div class="d-block">
      <div class="d-label"><h3>Typeface</h3><span>${TEMPLATES[state.template].name} uses ${FONTS[t.font].label} by default</span></div>
      <div class="font-list">${Object.keys(FONTS).map((k) => `<button class="font-opt" type="button" data-set="font" data-v="${k}" aria-pressed="${k === font}"><span class="aa" style="font-family:${esc(FONTS[k].stack)}">Aa</span><span><b>${FONTS[k].label}</b><small>${FONTS[k].kind}</small></span></button>`).join("")}</div>
    </div>
    <div class="d-block">
      <div class="d-label"><h3>Spacing</h3></div>
      ${seg("density", [["compact", "Compact"], ["standard", "Standard"], ["roomy", "Roomy"]], state.density)}
    </div>
    <div class="d-block d-row">
      <div><div class="d-label"><h3>Paper</h3></div>${seg("size", Object.keys(PAGE_SIZES).map((k) => [k, PAGE_SIZES[k].label]), state.page.size)}</div>
      <div><div class="d-label"><h3>Margins</h3></div>${seg("margin", [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]], state.page.margin)}</div>
    </div>
    <div class="d-block">
      <div class="switch-row" data-set="fit" role="presentation">
        <button class="switch" type="button" role="switch" aria-checked="${state.fitOnePage}" aria-labelledby="fit-label"></button>
        <div><b id="fit-label">Fit to one page</b><small>Gently tightens text, up to 15%, so a resume that's slightly long still fits on one page. Turn this off to flow onto a second page instead.</small></div>
      </div>
    </div>
    <div class="danger-zone">
      <button class="btn btn-sm" type="button" data-act="sample">${icon("sparkle")}Load the example</button>
      <button class="btn btn-sm btn-danger" type="button" data-act="blank">${icon("restart")}Start over</button>
    </div>`;
  scheduleThumbs(0);
}

let thumbTimer = null;
function scheduleThumbs(delay = 400) {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(renderThumbs, delay);
}
function renderThumbs() {
  if (tab !== "design") return;
  $$("[data-thumb]", paneDesign).forEach((frame) => {
    const s = { ...state, template: frame.dataset.thumb, accent: state.accent, font: null };
    const box = pageBox(s);
    frame.innerHTML = `<div class="thumb">${pageHtml(box, flowHtml(s))}</div>`;
    const k = frame.clientWidth / box.w;
    $(".thumb", frame).style.transform = `scale(${k})`;
  });
}

paneDesign.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]");
  if (act) {
    if (act.dataset.act === "blank") startBlank();
    if (act.dataset.act === "sample") loadSample();
    return;
  }
  const b = e.target.closest("[data-set]");
  if (!b) return;
  const v = b.dataset.v;
  switch (b.dataset.set) {
    case "template": commit(() => { state.template = v; state.font = null; }, { render: "design" }); break;
    case "accent": commit(() => (state.accent = v), { render: "design" }); break;
    case "font": commit(() => (state.font = v === TEMPLATES[state.template].font ? null : v), { render: "design" }); break;
    case "density": commit(() => (state.density = v), { render: "design" }); break;
    case "size": commit(() => (state.page.size = v), { render: "design" }); break;
    case "margin": commit(() => (state.page.margin = v), { render: "design" }); break;
    case "fit": commit(() => (state.fitOnePage = !state.fitOnePage), { render: "design" }); break;
  }
});

/* ---------------- tabs, view, layout ---------------- */
function setTab(name) {
  tab = name;
  $(".tabs").dataset.active = name;
  [["content", paneContent], ["design", paneDesign]].forEach(([n, pane]) => {
    const btn = $("#tab-" + n);
    btn.setAttribute("aria-selected", n === name);
    btn.tabIndex = n === name ? 0 : -1;
    pane.hidden = n !== name;
  });
  if (name === "design") renderDesign();
  else autoGrowAll(paneContent);
  $("#panel").scrollTop = 0;
}
$(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) setTab(b.id.slice(4)); });
$(".tabs").addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = tab === "content" ? "design" : "content"; setTab(n); $("#tab-" + n).focus(); }
});

function setView(v) {
  document.body.dataset.view = v;
  $$(".mobile-switch button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === v));
  if (v === "preview") requestAnimationFrame(sizePreview);
}
$(".mobile-switch").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); });

// Resizable editor panel
const ws = $(".workspace"), divider = $("#divider");
const setPanelW = (w) => { ui.panelW = Math.round(Math.max(360, Math.min(720, w, innerWidth - 420))); ws.style.setProperty("--panel-w", ui.panelW + "px"); };
if (ui.panelW && innerWidth > 1100) setPanelW(ui.panelW);
divider.addEventListener("pointerdown", (e) => {
  divider.setPointerCapture(e.pointerId);
  divider.classList.add("dragging");
  const move = (ev) => setPanelW(ev.clientX);
  const up = () => { divider.classList.remove("dragging"); divider.removeEventListener("pointermove", move); divider.removeEventListener("pointerup", up); saveUi(); };
  divider.addEventListener("pointermove", move);
  divider.addEventListener("pointerup", up);
});
divider.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { setPanelW($("#panel").offsetWidth + (e.key === "ArrowLeft" ? -24 : 24)); saveUi(); }
});

/* ---------------- dialogs, toast ---------------- */
let toastTimer = null;
function toast(msg, action) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  el.hidden = false;
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  if (action) $("button", el).onclick = () => { el.hidden = true; action.fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 6000 : 3200);
}

function confirmDlg(title, text, yes = "Continue") {
  const dlg = $("#confirm-dlg");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-yes").textContent = yes;
  dlg.showModal();
  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.removeEventListener("click", onClick); dlg.removeEventListener("cancel", onCancel); resolve(v); };
    const onClick = (e) => { const b = e.target.closest("[data-answer]"); if (b) done(b.dataset.answer === "yes"); else if (e.target === dlg) done(false); };
    const onCancel = () => done(false);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("cancel", onCancel);
  });
}

function choose(title, text, options) {
  const dlg = $("#import-dlg"), body = $("#import-body");
  body.innerHTML = `<h2 class="dlg-title" id="import-title">${esc(title)}</h2><p class="dlg-text">${esc(text)}</p>
    <div class="src-list" style="grid-template-columns:1fr">${options.map(([v, l, sub]) => `<button class="src chip" style="height:auto;border-radius:12px;padding:14px 16px;text-align:left;display:block" type="button" data-choice="${v}"><b>${esc(l)}</b><span>${esc(sub)}</span></button>`).join("")}</div>`;
  dlg.showModal();
  return new Promise((resolve) => {
    const onClick = (e) => { const b = e.target.closest("[data-choice]"); if (b) { cleanup(); dlg.close(); resolve(b.dataset.choice); } };
    const onClose = () => { cleanup(); resolve(null); };
    const cleanup = () => { body.removeEventListener("click", onClick); dlg.removeEventListener("close", onClose); };
    body.addEventListener("click", onClick);
    dlg.addEventListener("close", onClose);
  });
}

/* ---------------- start over, sample ---------------- */
async function startBlank() {
  const ok = await confirmDlg("Start a blank resume?", "Your current resume will be cleared. Your design choices stay. You can undo this.", "Start blank");
  if (!ok) return;
  commit(() => { state = blankState(state); }, { render: "all" });
  ui.welcome = false; saveUi();
  open.sections = new Set(["contact"]);
  setTab("content");
  renderContent();
  refocus('[data-path="contact.fullName"]');
}
async function loadSample() {
  const ok = await confirmDlg("Load the example resume?", "It replaces what's in the editor now. You can undo this.", "Load example");
  if (!ok) return;
  commit(() => { const d = clone(state); state = clone(SAMPLE); state.template = d.template; state.accent = d.accent; state.font = d.font; state.density = d.density; state.page = d.page; state.fitOnePage = d.fitOnePage; }, { render: "all" });
  setTab("content");
}

/* ---------------- import ---------------- */
const importDlg = $("#import-dlg"), importBody = $("#import-body");
function importStartHtml(error) {
  return `<h2 class="dlg-title" id="import-title">Import your resume</h2>
    <p class="dlg-text">Bring in what you already have. We'll sort it into sections so you can polish it here.</p>
    <div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a file to import">
      ${icon("upload")}<b>Drop a file here, or click to choose</b><span>PDF, Resume Forge backup (.json), or LinkedIn export (.zip or .csv)</span>
    </div>
    ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
    <div class="src-list">
      <div class="src"><b>LinkedIn profile PDF</b><span>On your LinkedIn profile, choose <i>Resources › Save to PDF</i>.</span></div>
      <div class="src"><b>Any resume PDF</b><span>Works best with PDFs saved from Word or Google Docs, not scans.</span></div>
      <div class="src"><b>LinkedIn data export</b><span>Most accurate. Request it in <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener">LinkedIn settings</a>; it can take up to a day.</span></div>
      <div class="src"><b>Resume Forge backup</b><span>A .json file you downloaded here, including from the previous version.</span></div>
    </div>
    <p class="privacy-note">${icon("lock")}Files are read in your browser and never uploaded.</p>`;
}
function openImport(error) {
  importBody.innerHTML = importStartHtml(error);
  if (!importDlg.open) importDlg.showModal();
  const drop = $("#drop", importBody);
  drop.addEventListener("click", () => $("#file-input").click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#file-input").click(); } });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("over"); runImport(e.dataTransfer.files); });
}
$("#file-input").addEventListener("change", (e) => { const files = Array.from(e.target.files); e.target.value = ""; if (files.length) runImport(files); });

let importerMod = null;
async function runImport(fileList) {
  const files = Array.from(fileList);
  if (!importDlg.open) importDlg.showModal();
  importBody.innerHTML = `<h2 class="dlg-title" id="import-title">Reading your file…</h2><div class="loading"><span class="spinner"></span>Sorting it into sections</div>`;
  try {
    importerMod = importerMod || (await import("./importers.js"));
    const r = await importerMod.importFiles(files, state);
    const name = r.state.contact.fullName;
    importBody.innerHTML = `<h2 class="dlg-title" id="import-title">${name ? `Found ${esc(name)}’s resume` : "We read your file"}</h2>
      <p class="dlg-text">From your ${esc(r.kind)}. Using it replaces what's in the editor now, and you can undo it.</p>
      ${r.found.length ? `<div class="result-h">Found</div><ul class="result-list">${r.found.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      ${r.missing.length ? `<div class="result-h">Fill in after importing</div><ul class="result-list missing">${r.missing.slice(0, 14).map((f) => `<li>${esc(f)}</li>`).join("")}${r.missing.length > 14 ? `<li>+${r.missing.length - 14} more</li>` : ""}</ul>` : ""}
      ${r.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}
      <div class="dlg-actions"><button class="btn" type="button" data-imp="back">Choose another file</button><button class="btn btn-primary" type="button" data-imp="use">Use this resume</button></div>`;
    importBody.onclick = (e) => {
      const b = e.target.closest("[data-imp]");
      if (!b) return;
      importBody.onclick = null;
      if (b.dataset.imp === "back") return openImport();
      importDlg.close();
      commit(() => { state = r.state; }, { render: "all" });
      ui.welcome = false; saveUi();
      open.sections = new Set(["contact"]);
      setTab("content");
      toast("Resume imported", { label: "Undo", fn: undo });
    };
  } catch (err) {
    openImport(err && err.message ? err.message : "That file could not be read.");
  }
}
// Dropping a file anywhere opens the importer
addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault(); });
addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); runImport(e.dataTransfer.files); } });

/* ---------------- export, PDF ---------------- */
const slug = (s) => String(s || "").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
function exportBackup() {
  flushSave();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(state.contact.fullName) || "resume"}-backup.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Backup downloaded. Import it any time to pick up where you left off.");
}

async function downloadPdf() {
  if (!ui.tipShown) {
    const ok = await confirmDlg("Save as PDF", "Your browser's print window will open. Choose “Save as PDF” as the destination. Margins are already set, so leave them on Default.", "Open print window");
    if (!ok) return;
    ui.tipShown = true; saveUi();
  }
  await document.fonts.ready;
  const L = layout(state);
  $("#print-root").innerHTML = L.pages.join("");
  $("#page-style").textContent = `@page { size: ${PAGE_SIZES[state.page.size].css}; margin: 0; }`;
  const prevTitle = document.title;
  const name = state.contact.fullName.trim();
  document.title = name ? `${name} – Resume` : "Resume";
  const restore = () => { document.title = prevTitle; removeEventListener("afterprint", restore); };
  addEventListener("afterprint", restore);
  window.print();
}

/* ---------------- top bar ---------------- */
$("#btn-undo").innerHTML = icon("undo");
$("#btn-redo").innerHTML = icon("redo");
$("#btn-import").innerHTML = `${icon("upload")}Import`;
$("#btn-export").innerHTML = `${icon("file")}Backup`;
$("#btn-export").title = "Download a backup file you can import later";
$("#btn-more").innerHTML = icon("more");
$("#btn-pdf").innerHTML = `${icon("download")}<span><span class="lbl-dl">Download </span>PDF</span>`;
$('#more-menu [data-act="import"]').innerHTML = `${icon("upload")}Import a resume`;
$('#more-menu [data-act="export"]').innerHTML = `${icon("file")}Download backup`;
$(".dlg-x button").innerHTML = icon("x");
$("#btn-undo").onclick = undo;
$("#btn-redo").onclick = redo;
$("#btn-import").onclick = () => openImport();
$("#btn-export").onclick = exportBackup;
$("#btn-pdf").onclick = downloadPdf;
const moreMenu = $("#more-menu"), moreBtn = $("#btn-more");
moreBtn.onclick = (e) => { e.stopPropagation(); const show = moreMenu.hidden; moreMenu.hidden = !show; moreBtn.setAttribute("aria-expanded", show); if (show) $("button", moreMenu).focus(); };
moreMenu.onclick = (e) => { const b = e.target.closest("[data-act]"); if (!b) return; moreMenu.hidden = true; moreBtn.setAttribute("aria-expanded", false); b.dataset.act === "import" ? openImport() : exportBackup(); };
document.addEventListener("click", (e) => { if (!moreMenu.hidden && !moreMenu.contains(e.target)) { moreMenu.hidden = true; moreBtn.setAttribute("aria-expanded", false); } });

/* ---------------- keyboard shortcuts ---------------- */
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (e.key === "Escape" && !moreMenu.hidden) { moreMenu.hidden = true; moreBtn.focus(); return; }
  if (!mod) return;
  const k = e.key.toLowerCase();
  const inText = e.target.matches && e.target.matches("input, textarea");
  if (k === "p") { e.preventDefault(); downloadPdf(); }
  else if (k === "s") { e.preventDefault(); flushSave(); toast("Saved. Everything saves automatically."); }
  else if (!inText && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (!inText && k === "y") { e.preventDefault(); redo(); }
});

/* ---------------- start ---------------- */
const params = new URLSearchParams(location.search);
if (params.get("template") && TEMPLATES[params.get("template")]) {
  state.template = params.get("template");
  state.font = null;
}
renderContent();
setTab("content");
updateUndo();
renderPreview();
flushSave();
document.fonts.ready.then(() => renderPreview());
if (params.has("import")) openImport();
else if (params.has("new") && !firstVisit) startBlank();
else if (params.has("new") && firstVisit) { state = blankState(state); ui.welcome = false; renderContent(); renderPreview(); flushSave(); }
if (migrated) toast("Welcome back. Your resume from the previous version is here.");
if (params.toString()) history.replaceState(null, "", location.pathname);

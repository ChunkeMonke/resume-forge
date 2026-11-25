// Turns resume data into page HTML, then lays it out onto real pages:
// shrinks gently to fit one page when asked, otherwise breaks between entries.
import { BUILTIN, ENTRY_KINDS, design, sectionTitle } from "./model.js";

export const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ed = (path, text, cls = "") => (text ? `<span class="${cls}" data-ed="${esc(path)}">${esc(text)}</span>` : "");
const dateRange = (a, b) => [a, b].filter(Boolean).join(" – ");

function headerHtml(s) {
  const c = s.contact;
  const parts = [
    ["email", c.email], ["phone", c.phone], ["location", c.location],
    ["linkedin", c.linkedin], ["website", c.website], ["extra", c.extra],
  ].filter((p) => p[1]);
  const contact = parts.map((p) => ed("contact." + p[0], p[1], "rs-ci")).join('<wbr><span class="rs-sep" aria-hidden="true"></span><wbr>');
  return `<header class="rs-head" data-sec="contact">
    <div class="rs-id">
      <h1 class="rs-name" data-ed="contact.fullName">${esc(c.fullName || "Your Name")}</h1>
      ${c.roleTitle ? `<p class="rs-role" data-ed="contact.roleTitle">${esc(c.roleTitle)}</p>` : ""}
    </div>
    ${contact ? `<p class="rs-contact">${contact}</p>` : ""}
  </header>`;
}

function bullets(list, base) {
  const items = (list || []).filter((b) => b && b.trim());
  if (!items.length) return "";
  return `<ul class="rs-bul">${items.map((b, i) => `<li data-ed="${esc(base)}.bullets.${i}">${esc(b)}</li>`).join("")}</ul>`;
}

// One entry. The date/location sit both in a side column (used by the Minimal
// template) and on the right of each line (every other template); CSS shows one.
function entryHtml({ base, title, titleField, sub, subField, date, loc, extra = "", bul }) {
  const when = date || loc ? `<div class="rs-when">${date ? `<span>${esc(date)}</span>` : ""}${loc ? `<span class="rs-when-loc">${esc(loc)}</span>` : ""}</div>` : '<div class="rs-when"></div>';
  return `<div class="rs-entry" data-ed="${esc(base)}">
    ${when}
    <div class="rs-what">
      <div class="rs-line"><span class="rs-title">${ed(base + "." + titleField, title)}</span>${date ? `<span class="rs-date">${esc(date)}</span>` : ""}</div>
      ${sub || loc ? `<div class="rs-line rs-line2"><span class="rs-sub">${ed(base + "." + subField, sub)}</span>${loc ? `<span class="rs-loc">${esc(loc)}</span>` : ""}</div>` : ""}
      ${extra}
      ${bul}
    </div>
  </div>`;
}

function entryItems(s, key) {
  const list = (s[key] || []).filter((e) => e.include !== false);
  return list.map((e) => {
    const base = `entry.${key}.${e.id}`;
    if (key === "experience" || key === "activities") {
      return entryHtml({ base, title: e.role || e.org, titleField: e.role ? "role" : "org", sub: e.role ? e.org : "", subField: "org",
        date: dateRange(e.start, e.end), loc: e.location, bul: bullets(e.bullets, base) });
    }
    if (key === "education") {
      const meta = [e.gpa ? `GPA ${e.gpa}` : "", e.coursework ? `Coursework: ${e.coursework}` : ""].filter(Boolean);
      const extra = meta.length ? `<p class="rs-meta">${meta.map((m, i) => `<span data-ed="${base}.${i === 0 && e.gpa ? "gpa" : "coursework"}">${esc(m)}</span>`).join('<wbr><span class="rs-sep" aria-hidden="true"></span><wbr>')}</p>` : "";
      return entryHtml({ base, title: e.school, titleField: "school", sub: e.degree, subField: "degree",
        date: dateRange(e.start, e.end), loc: e.location, extra, bul: bullets(e.bullets, base) });
    }
    if (key === "projects") {
      return entryHtml({ base, title: e.name, titleField: "name", sub: [e.role, e.link].filter(Boolean).join(" · "), subField: e.role ? "role" : "link",
        date: e.date, loc: "", bul: bullets(e.bullets, base) });
    }
    // certifications: one compact line each
    return `<div class="rs-entry rs-entry-line" data-ed="${base}">
      <div class="rs-when">${e.date ? `<span>${esc(e.date)}</span>` : ""}</div>
      <div class="rs-what"><div class="rs-line"><span class="rs-title-plain">${ed(base + ".name", e.name, "rs-strong")}${e.issuer ? `<span class="rs-issuer">, ${ed(base + ".issuer", e.issuer)}</span>` : ""}</span>${e.date ? `<span class="rs-date">${esc(e.date)}</span>` : ""}</div></div>
    </div>`;
  });
}

function sectionItems(s, key) {
  if (key === "summary") return s.summary.trim() ? [`<p class="rs-para" data-ed="summary">${esc(s.summary)}</p>`] : [];
  if (key === "skills") {
    const groups = s.skillGroups.filter((g) => g.items.length);
    if (!groups.length) return [];
    // A single group named like the section ("Skills") needs no label of its own.
    const plain = (g) => !g.label || (groups.length === 1 && g.label.trim().toLowerCase() === sectionTitle(s, "skills").trim().toLowerCase());
    return [`<div class="rs-skills">${groups.map((g) => `<p class="rs-skill" data-ed="skills.${g.id}">${!plain(g) ? `<span class="rs-skill-k">${esc(g.label)}</span>` : ""}<span class="rs-skill-v">${esc(g.items.join(", "))}</span></p>`).join("")}</div>`];
  }
  if (ENTRY_KINDS.includes(key)) return entryItems(s, key);
  const cs = s.customSections.find((c) => c.id === key);
  if (!cs) return [];
  const base = `custom.${cs.id}`;
  if (cs.kind === "text") return cs.content && cs.content.trim() ? [`<p class="rs-para" data-ed="${base}">${esc(cs.content)}</p>`] : [];
  if (cs.kind === "list") return cs.items.length ? [`<p class="rs-para rs-list" data-ed="${base}">${esc(cs.items.join(", "))}</p>`] : [];
  return cs.entries.filter((e) => e.include !== false).map((e) => {
    const b = `${base}.${e.id}`;
    return entryHtml({ base: b, title: e.role || e.org, titleField: e.role ? "role" : "org", sub: e.role ? e.org : "", subField: "org",
      date: dateRange(e.start, e.end), loc: e.location, bul: bullets(e.bullets, b) });
  });
}

// Visible sections with content, each as {key, title, items[]}
export function buildSections(s) {
  return s.sectionOrder
    .map((key) => ({ key, title: sectionTitle(s, key), items: sectionItems(s, key) }))
    .filter((sec) => sec.items.length);
}

const sectionHtml = (sec, items, cont) =>
  `<section class="rs-sec${cont ? " rs-cont" : ""}" data-sec="${esc(sec.key)}">${cont ? "" : `<h2 class="rs-h" data-ed="title.${esc(sec.key)}">${esc(sec.title)}</h2>`}${items.join("")}</section>`;

export function rootAttrs(s, scale) {
  const d = design(s);
  return `class="rs t-${d.template}" style="${esc(`--accent:${d.accent};--font:${d.font};--s:${scale ?? d.scale}`)}"`;
}

export function pageBox(s) {
  const d = design(s);
  return { w: d.page.w, h: d.page.h, mv: Math.round(d.margin[0] * 96), mh: Math.round(d.margin[1] * 96) };
}

// Full single-flow HTML (used for measuring and for thumbnails).
export function flowHtml(s, scale) {
  const secs = buildSections(s);
  return `<div ${rootAttrs(s, scale)}>${headerHtml(s)}${secs.map((sec) => sectionHtml(sec, sec.items, false)).join("")}</div>`;
}

export function pageHtml(box, inner) {
  return `<div class="rs-page" style="width:${box.w}px;height:${box.h}px;padding:${box.mv}px ${box.mh}px">${inner}</div>`;
}

let measureEl = null;
function measurer(width) {
  if (!measureEl) {
    measureEl = document.createElement("div");
    measureEl.setAttribute("aria-hidden", "true");
    measureEl.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(measureEl);
  }
  measureEl.style.width = width + "px";
  return measureEl;
}

function measureAtoms(s, secs, scale, width) {
  const m = measurer(width);
  m.innerHTML = `<div ${rootAttrs(s, scale)}>${headerHtml(s)}${secs.map((sec) => sectionHtml(sec, sec.items, false)).join("")}</div>`;
  const root = m.firstElementChild;
  const top = (el) => el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  const head = root.querySelector(".rs-head");
  const atoms = [{ kind: "head", top: 0, bottom: top(head) + head.offsetHeight }];
  const secEls = root.querySelectorAll(".rs-sec");
  secs.forEach((sec, si) => {
    const el = secEls[si];
    const kids = Array.from(el.children).filter((k) => !k.classList.contains("rs-h"));
    kids.forEach((k, i) => {
      atoms.push({ kind: "item", si, i, top: i === 0 ? top(el) : top(k), bottom: top(k) + k.offsetHeight });
    });
  });
  const total = root.getBoundingClientRect().height;
  return { atoms, total };
}

function paginate(atoms, cap) {
  const pages = [];
  let cur = [], start = 0, oversize = false;
  atoms.forEach((a) => {
    if (cur.length && a.bottom - start > cap + 0.5) {
      pages.push(cur);
      cur = [];
    }
    if (!cur.length) start = a.top;
    if (a.bottom - a.top > cap) oversize = true;
    cur.push(a);
  });
  if (cur.length) pages.push(cur);
  return { pages, oversize };
}

function pagesToHtml(s, secs, pages, scale) {
  return pages.map((atoms) => {
    let html = "";
    let i = 0;
    while (i < atoms.length) {
      const a = atoms[i];
      if (a.kind === "head") { html += headerHtml(s); i++; continue; }
      const items = [];
      let j = i;
      while (j < atoms.length && atoms[j].kind === "item" && atoms[j].si === a.si) { items.push(secs[a.si].items[atoms[j].i]); j++; }
      html += sectionHtml(secs[a.si], items, a.i > 0);
      i = j;
    }
    return `<div ${rootAttrs(s, scale)}>${html}</div>`;
  });
}

// Returns {pages: [html], count, scalePct, oversize, fitsOne}
export function layout(s) {
  const d = design(s);
  const box = pageBox(s);
  const width = box.w - 2 * box.mh;
  const cap = box.h - 2 * box.mv;
  const fitCap = cap - 2; // a little slack so rounding never pushes the last line over
  const secs = buildSections(s);
  let scale = d.scale;

  if (s.fitOnePage) {
    const full = measureAtoms(s, secs, scale, width);
    if (full.total > fitCap) {
      // Shrink at most 15%, keeping text readable; find the largest scale that fits.
      let lo = d.scale * 0.85, hi = d.scale;
      if (measureAtoms(s, secs, lo, width).total <= fitCap) {
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          if (measureAtoms(s, secs, mid, width).total <= fitCap) lo = mid; else hi = mid;
        }
        scale = Math.floor(lo * 1000) / 1000;
      }
    }
  }
  const { atoms } = measureAtoms(s, secs, scale, width);
  const { pages, oversize } = paginate(atoms, cap);
  const html = pagesToHtml(s, secs, pages, scale).map((inner) => pageHtml(box, inner));
  return {
    pages: html,
    count: html.length,
    scalePct: Math.round((scale / d.scale) * 100),
    oversize,
    box,
  };
}

// Import a resume from: a Resume Forge backup or other JSON resume, any PDF
// (with a dedicated reader for LinkedIn's "Save to PDF"), or LinkedIn's data
// export (ZIP or CSV files). Everything runs in the browser.
import { normalize, blankState, copyDesign, uid, clone } from "./model.js";

const MAX_JOBS = 6, MAX_PROJECTS = 4, MAX_SKILLS = 30;

/* ---------- shared helpers ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(v) {
  v = String(v == null ? "" : v).trim();
  const m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (m) { const mo = +m[2]; return mo >= 1 && mo <= 12 ? MONTHS[mo - 1] + " " + m[1] : m[1]; }
  return v;
}
const stripUrl = (u) => String(u || "").trim().replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").replace(/\/$/, "");
function formatPhone(d) { return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; }
function cleanPhone(raw) {
  raw = String(raw || "").trim();
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d.length === 10 ? formatPhone(d) : raw;
}
const C_BUL = "•●▪◦·";
const BULLET_RE = new RegExp("^[" + C_BUL + "*–—\\-]\\s*");
const PUA_RE = /[-​]/g;
function toBullets(desc) {
  return String(desc || "").split(/\r?\n+/).map((t) => t.replace(/^[\s•–—·▪◦*-]+/, "").trim()).filter(Boolean);
}
const splitItems = (t) => String(t || "").split(/[,;|]|\s•\s/).map((x) => x.replace(BULLET_RE, "").trim()).filter(Boolean);

function emptyData() {
  return { skills: [], experience: [], education: [], projects: [], activities: [], certifications: [], volunteer: [], lists: { languages: [], awards: [], interests: [], publications: [] } };
}

function summarize(s) {
  const found = [];
  const add = (n, one, many) => n && found.push(n + " " + (n === 1 ? one : many));
  add(s.experience.length, "position", "positions");
  add(s.education.length, "school", "schools");
  add(s.skillGroups.reduce((n, g) => n + g.items.length, 0), "skill", "skills");
  add(s.projects.length, "project", "projects");
  add(s.activities.length, "activity", "activities");
  add(s.certifications.length, "certification", "certifications");
  s.customSections.forEach((c) => found.push(c.label));
  return found;
}

// D = plain data from any reader. Builds a full resume and lists what is missing.
function assemble(D, kind, current, notes = []) {
  const missing = [];
  const need = (v, label) => { v = String(v || "").trim(); if (!v) missing.push(label); return v; };
  const s = blankState(current);
  s.contact = {
    fullName: need(D.name, "Name"), roleTitle: need(D.headline, "Headline or target role"),
    email: need(D.email, "Email"), phone: need(D.phone, "Phone"), location: need(D.location, "Location"),
    linkedin: D.linkedin || "", website: D.website || "", extra: "",
  };
  s.summary = need(D.summary, "Summary");
  const sk = (D.skills || []).filter((g) => g.items && g.items.length);
  s.skillGroups = sk.length ? sk.map((g) => ({ id: uid(), label: g.label || "Skills", items: g.items })) : [{ id: uid(), label: "Skills", items: [] }];
  if (!sk.length) missing.push("Skills");

  const jobs = D.experience || [];
  if (jobs.length > MAX_JOBS) notes.push(`${jobs.length} positions found. The ${MAX_JOBS} most recent are shown; the others are kept but hidden.`);
  s.experience = jobs.map((j, i) => {
    const n = "Job " + (i + 1);
    if (!(j.bullets || []).length) missing.push(n + " description");
    return { id: uid(), org: need(j.org, n + " company"), role: need(j.role, n + " title"), location: j.location || "",
      start: j.start || "", end: j.end || (j.start ? "Present" : ""), include: i < MAX_JOBS, bullets: j.bullets || [] };
  });
  s.education = (D.education || []).map((e, i) => ({
    id: uid(), school: need(e.school, `School ${i + 1} name`), degree: e.degree || "", location: e.location || "",
    start: e.start || "", end: e.end || "", gpa: e.gpa || "", coursework: e.coursework || "", include: true, bullets: e.bullets || [],
  }));
  const projects = D.projects || [];
  if (projects.length > MAX_PROJECTS) notes.push(`${projects.length} projects found. The first ${MAX_PROJECTS} are shown; the others are kept but hidden.`);
  s.projects = projects.map((p, i) => ({ id: uid(), name: p.name || "", role: "", date: p.date || "", link: p.link || "", include: i < MAX_PROJECTS, bullets: p.bullets || [] }));
  s.activities = (D.activities || []).map((a) => ({ id: uid(), org: a.org || "", role: a.role || "", location: a.location || "",
    start: a.start || "", end: a.end || (a.start ? "Present" : ""), include: true, bullets: a.bullets || [] }));
  s.certifications = (D.certifications || []).filter((c) => c.name).map((c) => ({ id: uid(), name: c.name, issuer: c.issuer || "", date: c.date || "", include: true }));

  const L = D.lists || {};
  const list = (label, items) => items && items.length && s.customSections.push({ id: uid(), label, kind: "list", items });
  list("Languages", L.languages); list("Awards & Honors", L.awards); list("Publications", L.publications); list("Interests", L.interests);
  if ((D.volunteer || []).length) {
    s.customSections.push({ id: uid(), label: "Volunteer Experience", kind: "entries", entries: D.volunteer.map((v) => ({
      id: uid(), org: v.org || "", role: v.role || "", location: v.location || "", start: v.start || "", end: v.end || (v.start ? "Present" : ""), include: true, bullets: v.bullets || [],
    })) });
  }
  s.sectionOrder = ["summary", "experience", "education", "skills", "projects", "activities", "certifications"].filter((k) => {
    if (k === "summary") return true;
    if (k === "skills") return true;
    if (k === "experience" || k === "education") return true;
    return s[k].length > 0;
  }).concat(s.customSections.map((c) => c.id));
  return { state: s, missing, notes, found: summarize(s), kind };
}

/* ---------- JSON ---------- */
const jkey = (k) => String(k).toLowerCase().replace(/[^a-z]/g, "");
function jget(obj, keys) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const low = {};
  Object.keys(obj).forEach((k) => (low[jkey(k)] = obj[k]));
  for (const k of keys) {
    const v = low[k];
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) return v;
  }
  return undefined;
}
function jstr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(jstr).filter(Boolean).join(", ");
  return jstr(jget(v, ["name", "value", "text", "label", "title", "city"]));
}
const jlines = (v) => (v == null ? [] : Array.isArray(v) ? v.map(jstr).filter(Boolean) : toBullets(jstr(v)));
const jlist = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);
const capFirst = (t) => { t = String(t || "").replace(/[_-]+/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1) : t; };

function jsonSkills(v) {
  const groups = [], flat = [];
  if (Array.isArray(v)) {
    v.forEach((x) => {
      if (typeof x === "string") flat.push(x);
      else if (x && typeof x === "object") {
        const kw = jget(x, ["keywords", "skills", "items", "list", "tools"]), nm = jstr(jget(x, ["name", "category", "label", "title", "group"]));
        if (Array.isArray(kw) && kw.length) groups.push({ label: nm || "Skills", items: kw.map(jstr).filter(Boolean) });
        else if (nm) flat.push(nm);
      }
    });
    if (flat.length) groups.unshift({ label: "Skills", items: flat });
  } else if (v && typeof v === "object") {
    Object.keys(v).forEach((k) => {
      const a = Array.isArray(v[k]) ? v[k].map(jstr).filter(Boolean) : splitItems(jstr(v[k]));
      if (a.length) groups.push({ label: capFirst(k), items: a });
    });
  } else if (typeof v === "string") {
    const a = splitItems(v);
    if (a.length) groups.push({ label: "Skills", items: a });
  }
  return groups;
}
function jsonEntry(e) {
  const st = fmtDate(jstr(jget(e, ["startdate", "start", "from", "begin", "started", "startyear"])));
  const enRaw = jget(e, ["enddate", "end", "to", "finish", "finished", "endyear"]);
  const cur = jget(e, ["current", "present", "iscurrent"]);
  const hl = jlines(jget(e, ["highlights", "bullets", "responsibilities", "achievements", "accomplishments", "details"]));
  return {
    org: jstr(jget(e, ["company", "companyname", "employer", "organization", "organisation", "org", "institution", "name"])),
    role: jstr(jget(e, ["position", "title", "role", "jobtitle"])),
    location: jstr(jget(e, ["location", "city"])),
    start: st,
    end: enRaw ? (/^(present|current|now|ongoing)$/i.test(jstr(enRaw)) ? "Present" : fmtDate(jstr(enRaw))) : cur === true || /^(true|yes|present)$/i.test(jstr(cur)) ? "Present" : "",
    bullets: hl.length ? hl : jlines(jget(e, ["description", "summary", "text", "notes"])),
  };
}
function dataFromJson(root) {
  if (Array.isArray(root) && root.length && root[0] && typeof root[0] === "object") root = root[0];
  if (!root || typeof root !== "object") return null;
  const inner = jget(root, ["resume", "cv"]);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) root = inner;
  let b = jget(root, ["basics", "profile", "personal", "personalinfo", "contact", "about", "header"]);
  b = b && typeof b === "object" && !Array.isArray(b) ? b : root;
  const D = emptyData();
  const pick = (keys) => { const v = jget(b, keys); return v !== undefined || b === root ? v : jget(root, keys); };
  D.name = jstr(pick(["name", "fullname", "displayname"])) || [jstr(pick(["firstname", "first"])), jstr(pick(["lastname", "last", "surname"]))].filter(Boolean).join(" ");
  D.headline = jstr(pick(["label", "headline", "jobtitle", "title", "position", "role", "tagline"]));
  D.email = jstr(pick(["email", "emailaddress", "mail"]));
  D.phone = cleanPhone(jstr(pick(["phone", "phonenumber", "mobile", "tel", "telephone"])));
  const loc = pick(["location", "address", "city"]);
  D.location = loc && typeof loc === "object" && !Array.isArray(loc) ? [jstr(jget(loc, ["city"])), jstr(jget(loc, ["region", "state"]))].filter(Boolean).join(", ") : jstr(loc);
  D.summary = jstr(pick(["summary", "about", "objective", "bio", "description"]));
  D.website = stripUrl(jstr(pick(["url", "website", "site", "homepage", "portfolio"])));
  let li = jstr(pick(["linkedin", "linkedinurl"]));
  jlist(pick(["profiles", "links", "socials"])).forEach((pf) => {
    const net = jstr(jget(pf, ["network", "name", "type", "label"])), url = jstr(jget(pf, ["url", "link", "href"]));
    if ((/linkedin/i.test(net) || /linkedin\.com/i.test(url)) && !li) li = url;
  });
  D.linkedin = stripUrl(li);
  D.experience = jlist(jget(root, ["work", "experience", "workexperience", "employment", "employmenthistory", "jobs", "positions", "professionalexperience"])).map(jsonEntry);
  D.education = jlist(jget(root, ["education", "schools", "academics", "educationhistory"])).map((e) => {
    const area = jstr(jget(e, ["area", "field", "major", "fieldofstudy"])), type = jstr(jget(e, ["studytype", "degree", "degreename", "qualification"]));
    const courses = jget(e, ["courses", "coursework"]);
    return {
      school: jstr(jget(e, ["institution", "school", "university", "college", "name"])),
      degree: type && area ? type + " in " + area : type || area,
      start: fmtDate(jstr(jget(e, ["startdate", "start", "from", "startyear"]))),
      end: fmtDate(jstr(jget(e, ["enddate", "end", "to", "graduation", "graduationdate", "endyear", "year"]))),
      gpa: jstr(jget(e, ["score", "gpa", "grade"])),
      coursework: Array.isArray(courses) ? courses.map(jstr).filter(Boolean).join(", ") : jstr(courses),
      bullets: jlines(jget(e, ["honors", "achievements", "highlights", "notes"])),
    };
  });
  D.skills = jsonSkills(jget(root, ["skills", "technicalskills", "skillset", "competencies"]));
  D.projects = jlist(jget(root, ["projects", "personalprojects"])).map((e) => {
    const st = fmtDate(jstr(jget(e, ["startdate", "start", "from"]))), en = fmtDate(jstr(jget(e, ["enddate", "end", "to"])));
    const hl = jlines(jget(e, ["highlights", "bullets", "achievements"]));
    return { name: jstr(jget(e, ["name", "title", "project"])), date: st && en ? st + " – " + en : st || en || fmtDate(jstr(jget(e, ["date", "year"]))),
      link: stripUrl(jstr(jget(e, ["url", "link", "github"]))), bullets: hl.length ? hl : jlines(jget(e, ["description", "summary"])) };
  });
  D.activities = jlist(jget(root, ["activities", "extracurricular", "extracurriculars", "leadership", "involvement"])).map(jsonEntry);
  D.volunteer = jlist(jget(root, ["volunteer", "volunteering", "volunteerwork"])).map((e) => {
    const x = jsonEntry(e);
    return { ...x, org: jstr(jget(e, ["organization", "organisation", "company", "name"])), role: jstr(jget(e, ["position", "role", "title"])) };
  });
  D.certifications = jlist(jget(root, ["certificates", "certifications", "certification", "licenses"])).map((c) =>
    typeof c === "string" ? { name: c } : { name: jstr(jget(c, ["name", "title"])), issuer: jstr(jget(c, ["issuer", "authority", "organization", "awarder"])), date: fmtDate(jstr(jget(c, ["date", "issued", "issuedon", "year"]))) });
  const names = (v, keys) => jlist(v).map((x) => (typeof x === "string" ? x : jstr(jget(x, keys)))).filter(Boolean);
  D.lists.awards = names(jget(root, ["awards", "honors", "honorsawards", "achievements"]), ["title", "name"]);
  D.lists.languages = jlist(jget(root, ["languages"])).map((l) => {
    if (typeof l === "string") return l;
    const nm = jstr(jget(l, ["language", "name"])), fl = jstr(jget(l, ["fluency", "level", "proficiency"]));
    return nm && fl ? `${nm} (${fl})` : nm;
  }).filter(Boolean);
  D.lists.interests = names(jget(root, ["interests", "hobbies"]), ["name", "title"]);
  D.lists.publications = names(jget(root, ["publications", "patents"]), ["name", "title"]);
  const ok = D.name || D.experience.length || D.education.length || D.skills.length || D.summary || D.projects.length;
  return ok ? D : null;
}

function fromJson(root, current) {
  if (root && typeof root === "object" && root.contact && typeof root.contact === "object" && !Array.isArray(root.contact)) {
    // Resume Forge backup (this version or the original site). Keep its own design.
    const s = normalize(root);
    return { state: s, missing: [], notes: [], found: summarize(s), kind: "Resume Forge backup", own: true };
  }
  const D = dataFromJson(root);
  return D ? assemble(D, "JSON resume", current) : null;
}

/* ---------- PDF ---------- */
// pdf.js 3.11.174 (Apache-2.0) is bundled in /vendor so imports work without a third-party CDN.
const PDFJS_URL = new URL("../vendor/pdfjs/pdf.min.js", import.meta.url).href;
const PDFJS_WORKER = new URL("../vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const sc = document.createElement("script");
    sc.src = PDFJS_URL;
    sc.onload = () => {
      if (!window.pdfjsLib) return reject(new Error("The PDF reader could not start."));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    sc.onerror = () => reject(new Error("Could not load the PDF reader. Refresh the page and try again."));
    document.head.appendChild(sc);
  });
}
async function readPdfPages(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), items = [];
    tc.items.forEach((it) => {
      if (typeof it.str !== "string" || !it.str.trim()) return;
      const tr = it.transform;
      items.push({ str: it.str, x: tr[4], y: tr[5], size: Math.abs(tr[3]) || it.height || 10, w: it.width || 0 });
    });
    pages.push({ width: vp.width, height: vp.height, items });
  }
  return pages;
}

const MON_RE = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const DT_RE = "(?:" + MON_RE + "\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})";
const RANGE_RE = new RegExp("(" + DT_RE + ")\\s*(?:-|–|—|to)\\s*(" + DT_RE + "|Present|Current|Now|Today)", "i");
const SINGLE_RE = new RegExp("(?:^|[\\s|,(])(" + DT_RE + ")\\s*\\)?\\s*$", "i");

function groupLines(items) {
  const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let cur = null;
  sorted.forEach((it) => {
    if (cur && Math.abs(it.y - cur.y) <= Math.max(2, it.size * 0.3)) cur.items.push(it);
    else { cur = { y: it.y, items: [it] }; lines.push(cur); }
  });
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    let text = "", prevEnd = null, size = 0;
    l.items.forEach((it) => {
      const str = it.str.replace(PUA_RE, "");
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      // A wide gap means a right-aligned column (dates, location): mark it so it can be split off.
      if (gap > it.size * 1.6) text = text.replace(/\s+$/, "") + " | ";
      else if (gap > it.size * 0.12 && !/^\s/.test(str) && !/\s$/.test(text)) text += " ";
      text += str;
      prevEnd = it.x + it.w;
      size = Math.max(size, it.size);
    });
    return { text: text.replace(/\s+/g, " ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trim(), x: l.items[0].x, y: l.y, size };
  }).filter((l) => l.text && !/^page \d+ of \d+$/i.test(l.text));
}

const SEC_ALIASES = {
  summary: ["summary", "professional summary", "profile", "about", "about me", "objective", "career objective", "professional profile", "executive summary"],
  experience: ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "relevant experience", "career history"],
  education: ["education", "academic background", "education and training", "academics"],
  skills: ["skills", "technical skills", "key skills", "core competencies", "top skills", "skills and tools", "skills and abilities", "competencies", "technologies"],
  projects: ["projects", "personal projects", "selected projects", "academic projects", "project experience", "relevant projects"],
  activities: ["extracurricular activities", "activities", "leadership", "leadership experience", "extracurriculars", "leadership and activities", "campus involvement"],
  certifications: ["certifications", "licenses and certifications", "certificates", "licenses", "certifications and licenses"],
  awards: ["honors", "honors awards", "honors and awards", "awards", "awards and honors", "achievements"],
  languages: ["languages"],
  volunteer: ["volunteer", "volunteering", "volunteer experience", "community involvement"],
  publications: ["publications", "patents", "publications and patents"],
  interests: ["interests", "hobbies", "hobbies and interests"],
  contact: ["contact", "contact information"],
};
function sectionKeyOf(text) {
  const t = text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Letter-spaced headings ("S U M M A R Y") come out of PDFs with gaps between letters.
  const squash = t.replace(/ /g, "");
  return Object.keys(SEC_ALIASES).find((k) => SEC_ALIASES[k].includes(t) || SEC_ALIASES[k].some((a) => a.replace(/ /g, "") === squash)) || null;
}
function splitSections(lines) {
  const header = [], secs = [];
  let cur = null;
  lines.forEach((l) => {
    const key = l.text.length <= 42 ? sectionKeyOf(l.text) : null;
    if (key) { cur = { key, lines: [] }; secs.push(cur); }
    else if (cur) cur.lines.push(l);
    else header.push(l);
  });
  return { header, secs };
}
function extractDates(t, allowSingle) {
  const m = t.match(RANGE_RE);
  if (m) {
    const rest = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)).replace(/\(\s*\d+\s+(?:years?|yrs?|months?|mos?)[^)]*\)/gi, " ").replace(/\s+/g, " ").replace(/[\s|,-]+$/, "").replace(/^[\s|,-]+/, "").trim();
    return { start: m[1], end: /^(present|current|now|today)$/i.test(m[2]) ? "Present" : m[2], rest };
  }
  if (allowSingle) {
    const sm = t.match(SINGLE_RE);
    if (sm && t.slice(0, sm.index).trim().length >= 3) return { start: "", end: sm[1], rest: t.slice(0, sm.index).replace(/[\s|,-]+$/, "").trim() };
  }
  return null;
}
function splitLoc(t) {
  const m = t.match(/^(.*?)\s*[,|]\s*([A-Z][A-Za-z.' -]+,\s*[A-Z]{2})$/);
  return m ? { org: m[1].trim(), loc: m[2].trim() } : { org: t, loc: "" };
}
function parseEntries(lines, allowSingle) {
  if (!lines.length) return [];
  const baseX = Math.min(...lines.map((l) => l.x));
  const entries = [];
  let cur = null;
  lines.forEach((l) => {
    const t = l.text, bul = BULLET_RE.test(t), indented = l.x > baseX + 9;
    if (bul) {
      if (!cur) { cur = { title: "", start: "", end: "", sub: "", bullets: [] }; entries.push(cur); }
      cur.bullets.push(t.replace(BULLET_RE, "").trim());
      return;
    }
    if (indented && cur) {
      // Bullets without a visible marker: a capitalized line starts a new one, lowercase continues it.
      if (cur.bullets.length && /^[a-z(&,]/.test(t)) cur.bullets[cur.bullets.length - 1] += " " + t;
      else cur.bullets.push(t);
      return;
    }
    const dr = extractDates(t, allowSingle);
    if (dr) { cur = { title: dr.rest, start: dr.start, end: dr.end, sub: "", bullets: [] }; entries.push(cur); return; }
    if (cur && !cur.sub && !cur.bullets.length) { cur.sub = t; return; }
    if (cur && !cur.bullets.length) { cur.bullets.push(t); return; }
    cur = { title: t, start: "", end: "", sub: "", bullets: [] };
    entries.push(cur);
  });
  return entries;
}
function parseSkills(lines) {
  const groups = [];
  let flat = [], last = null;
  lines.forEach((l) => {
    const t = l.text.replace(BULLET_RE, "").trim(), m = t.match(/^([A-Za-z][^:]{1,40}):\s*(.*)$/);
    if (m) { last = { label: m[1].trim(), items: splitItems(m[2]) }; groups.push(last); }
    else if (last) last.items = last.items.concat(splitItems(t));
    else flat = flat.concat(splitItems(t));
  });
  if (flat.length) groups.unshift({ label: "Skills", items: flat });
  return groups;
}
function parseItems(lines) {
  const items = [];
  lines.forEach((l) => {
    const t = l.text.replace(BULLET_RE, "").trim();
    if (!t) return;
    if (items.length && /^[a-z(]/.test(t)) items[items.length - 1] += " " + t;
    else items.push(t);
  });
  return items;
}
const parseCerts = (lines) => parseItems(lines).map((t) => {
  const dr = extractDates(t, true);
  const name = dr && dr.rest ? dr.rest : t;
  const m = name.match(/^(.+?),\s*([^,]{2,40})$/);
  return { name: m ? m[1] : name, issuer: m ? m[2] : "", date: dr && dr.rest ? dr.end : "" };
});
function bulletsFromParagraph(lines) {
  const out = [];
  let prevEnd = true;
  lines.forEach((l) => {
    const t = l.text.trim();
    if (BULLET_RE.test(t)) { out.push(t.replace(BULLET_RE, "").trim()); prevEnd = false; return; }
    if (!out.length || (prevEnd && /^[A-Z0-9]/.test(t))) out.push(t);
    else out[out.length - 1] += " " + t;
    prevEnd = /[.!?]$/.test(t);
  });
  return out;
}
function mapEntryRows(entries, kind) {
  return entries.map((e) => {
    if (kind === "education") {
      let deg = e.sub, gpa = "", cw = "";
      const gm = deg.match(/(?:[\s|,-]*)GPA[:\s]*([0-4](?:\.\d+)?(?:\s*\/\s*[0-4](?:\.\d+)?)?)/i);
      if (gm) { gpa = gm[1].replace(/\s+/g, ""); deg = deg.replace(gm[0], "").replace(/[\s|,-]+$/, "").trim(); }
      const rest = [];
      e.bullets.forEach((b) => {
        const cm = b.match(/^(?:relevant\s+)?coursework[:\s]+(.*)$/i), g2 = b.match(/^GPA[:\s]*([0-4](?:\.\d+)?)/i);
        if (cm && !cw) cw = cm[1]; else if (g2 && !gpa) gpa = g2[1]; else rest.push(b);
      });
      const sd = splitLoc(deg), ss = splitLoc(e.title);
      return { school: ss.org, degree: sd.org, location: sd.loc || ss.loc, start: e.start, end: e.end, gpa, coursework: cw, bullets: rest };
    }
    if (kind === "projects") return { name: e.title, date: e.start && e.end ? e.start + " – " + e.end : e.start || e.end, link: "", bullets: (e.sub ? [e.sub] : []).concat(e.bullets) };
    // The line that carries the location is usually the organization line.
    const a = splitLoc(e.title), b = splitLoc(e.sub);
    if (b.loc && !a.loc) return { org: b.org, location: b.loc, role: a.org, start: e.start, end: e.end, bullets: e.bullets };
    return { org: a.org, location: a.loc, role: b.org, start: e.start, end: e.end, bullets: e.bullets };
  });
}
function fillFromSections(D, secs, li) {
  secs.forEach((sec) => {
    const L = sec.lines;
    switch (sec.key) {
      case "summary": D.summary = ((D.summary ? D.summary + " " : "") + L.map((l) => l.text).join(" ")).trim(); break;
      case "skills": D.skills = D.skills.concat(parseSkills(L)); break;
      case "experience": D.experience = D.experience.concat(li ? parseLinkedInExperience(L) : mapEntryRows(parseEntries(L, false), "experience")); break;
      case "education": D.education = D.education.concat(li ? parseLinkedInEducation(L) : mapEntryRows(parseEntries(L, true), "education")); break;
      case "projects": D.projects = D.projects.concat(mapEntryRows(parseEntries(L, true), "projects")); break;
      case "activities": D.activities = D.activities.concat(mapEntryRows(parseEntries(L, false), "activities")); break;
      case "volunteer": D.volunteer = D.volunteer.concat(mapEntryRows(parseEntries(L, false), "volunteer")); break;
      case "certifications": D.certifications = D.certifications.concat(parseCerts(L)); break;
      case "awards": D.lists.awards = D.lists.awards.concat(parseItems(L)); break;
      case "languages":
        D.lists.languages = D.lists.languages.concat(parseItems(L).map((t) =>
          t.replace(/\(\s*native[^)]*\)/i, "(Native)").replace(/\(\s*full professional[^)]*\)/i, "(Fluent)").replace(/\(\s*professional working[^)]*\)/i, "(Professional)").replace(/\(\s*limited working[^)]*\)/i, "(Limited)")));
        break;
      case "interests": D.lists.interests = D.lists.interests.concat(parseItems(L)); break;
      case "publications": D.lists.publications = D.lists.publications.concat(parseItems(L)); break;
    }
  });
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+/i;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.(?:com|dev|io|net|org|me|co|ai|app|info|tech)(?:\/[^\s|,]*)?/i;
const LOC_RE = /\b([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+)*,\s*(?:[A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)?))\b/;

function parseContactBlob(blob, D) {
  let m, work = blob;
  if ((m = work.match(EMAIL_RE)) && !D.email) D.email = m[0];
  work = work.replace(EMAIL_RE, " ");
  if ((m = work.match(LINKEDIN_RE)) && !D.linkedin) D.linkedin = stripUrl(m[0]);
  work = work.replace(LINKEDIN_RE, " ");
  if ((m = work.match(PHONE_RE)) && !D.phone) D.phone = cleanPhone(m[0]);
  work = work.replace(PHONE_RE, " ");
  if ((m = work.match(URL_RE)) && !D.website) D.website = stripUrl(m[0]);
  work = work.replace(URL_RE, " ");
  if ((m = work.match(LOC_RE)) && !D.location) D.location = m[1];
}
function parseGenericHeader(header, D) {
  const cand = header.slice(0, 8).filter((l) => !/@/.test(l.text) && !/\d{3,}/.test(l.text) && l.text.length <= 60);
  let nameLine = null;
  cand.forEach((l) => { if (!nameLine || l.size > nameLine.size + 0.5) nameLine = l; });
  D.name = nameLine ? nameLine.text : "";
  const rest = header.filter((l) => l !== nameLine);
  parseContactBlob(rest.map((l) => l.text).join(" | "), D);
  for (const l of rest) {
    const t = l.text, words = t.split(/\s+/).length;
    if (EMAIL_RE.test(t) || PHONE_RE.test(t) || LINKEDIN_RE.test(t) || URL_RE.test(t) || /https?:/.test(t)) continue;
    if (words < 1 || words > 12 || t.length > 80) continue;
    const lm = t.match(LOC_RE);
    if (lm && lm[0].length >= t.length - 3) continue;
    D.headline = t;
    break;
  }
}
function dataFromGenericPdf(pages) {
  let lines = [];
  pages.forEach((pg) => (lines = lines.concat(groupLines(pg.items))));
  const sp = splitSections(lines), D = emptyData();
  parseGenericHeader(sp.header, D);
  fillFromSections(D, sp.secs, false);
  return D;
}

// LinkedIn "Save to PDF": a sidebar on the left, the profile on the right.
const isLinkedInPdf = (pages) => { const t = pages[0].items.map((i) => i.str).join(" "); return /\bTop Skills\b/.test(t) || /\(LinkedIn\)/.test(t); };
const DURATION_RE = /^\d+\s+(?:years?|yrs?|months?|mos?)\b/i;
const looksLikeLocation = (t) => t.length <= 70 && !/[.!?]$/.test(t) && (/,/.test(t) || /\b(area|remote|region)\b/i.test(t));
const isCompanyLike = (t) => t.length <= 60 && (!/[.;:]$/.test(t) || /\b(?:Inc|Ltd|LLC|Co|Corp|Jr|Sr)\.$/i.test(t)) && !BULLET_RE.test(t) && t.split(/\s+/).length <= 9 && !DURATION_RE.test(t);

function parseLinkedInExperience(lines) {
  const texts = lines.map((l) => l.text), dIdx = [];
  const startRe = new RegExp("^(?:" + MON_RE + "\\s+)?\\d{4}", "i");
  texts.forEach((t, i) => { if (RANGE_RE.test(t) && startRe.test(t)) dIdx.push(i); });
  const entries = [];
  let prevCompany = "", prevLocIdx = -1;
  dIdx.forEach((idx, k) => {
    let title = idx >= 1 ? texts[idx - 1] : "", company = prevCompany, startIdx = idx - 1;
    if (idx >= 2 && idx - 2 > prevLocIdx) {
      const c2 = texts[idx - 2];
      if (DURATION_RE.test(c2) && idx >= 3 && idx - 3 > prevLocIdx) { company = texts[idx - 3]; startIdx = idx - 3; }
      else if (isCompanyLike(c2)) { company = c2; startIdx = idx - 2; }
    }
    const dr = extractDates(texts[idx], false) || { start: "", end: "" };
    let loc = "", descFrom = idx + 1;
    if (idx + 1 < texts.length && (dIdx[k + 1] === undefined || idx + 1 < dIdx[k + 1] - 1) && looksLikeLocation(texts[idx + 1])) {
      loc = texts[idx + 1].replace(/,\s*United States$/i, "");
      descFrom = idx + 2;
    }
    prevLocIdx = descFrom - 1;
    prevCompany = company;
    entries.push({ org: company, role: title, location: loc, start: dr.start, end: dr.end, from: descFrom, startIdx });
  });
  entries.forEach((e, k) => {
    const to = k + 1 < entries.length ? entries[k + 1].startIdx : texts.length;
    e.bullets = bulletsFromParagraph(lines.slice(e.from, Math.max(e.from, to)));
  });
  return entries;
}
function parseLinkedInEducation(lines) {
  const texts = lines.map((l) => l.text), out = [], idxs = [];
  const YEARS = /\(\s*\d{4}\s*(?:-|to|–)\s*\d{4}\s*\)|\(\s*\d{4}\s*\)/;
  texts.forEach((t, i) => { if (RANGE_RE.test(t) || YEARS.test(t)) idxs.push(i); });
  idxs.forEach((idx, k) => {
    const t = texts[idx];
    const single = t.match(/\((\d{4})\)/);
    const dr = extractDates(t, false) || (single ? { start: "", end: single[1] } : { start: "", end: "" });
    let degree = t.replace(/\(.*$/, "").replace(new RegExp("[" + C_BUL + "\\s]+$"), "").trim();
    let school = idx >= 1 ? texts[idx - 1] : "";
    if (!degree && idx >= 2) { degree = school; school = texts[idx - 2]; }
    const to = k + 1 < idxs.length ? idxs[k + 1] - 1 : texts.length;
    out.push({ school, degree, start: dr.start, end: dr.end, gpa: "", coursework: "", bullets: bulletsFromParagraph(lines.slice(idx + 1, Math.max(idx + 1, to))) });
  });
  return out;
}
function dataFromLinkedInPdf(pages) {
  let side = [], main = [];
  pages.forEach((pg) => {
    const split = pg.width * 0.34;
    side = side.concat(groupLines(pg.items.filter((i) => i.x < split)));
    main = main.concat(groupLines(pg.items.filter((i) => i.x >= split)));
  });
  const D = emptyData(), sSide = splitSections(side), sMain = splitSections(main);
  let contact = "";
  sSide.secs.forEach((sec) => {
    if (sec.key !== "contact") return;
    sec.lines.forEach((l, i) => { contact += (i && /-$/.test(contact) ? "" : " ") + l.text; });
  });
  parseContactBlob(contact, D);
  const web = contact.match(/(\S+)\s*\((?:Personal|Company|Blog|Portfolio|Other)[^)]*\)/i);
  if (web && !D.website) D.website = stripUrl(web[1]);
  const hl = sMain.header;
  if (hl.length) {
    D.name = hl[0].text;
    const last = hl[hl.length - 1], hasLoc = hl.length > 2 && looksLikeLocation(last.text);
    if (hasLoc) D.location = last.text.split(",").filter((x) => !/^\s*united states\s*$/i.test(x)).join(",").trim();
    D.headline = hl.slice(1, hasLoc ? hl.length - 1 : hl.length).map((l) => l.text).join(" ");
  }
  fillFromSections(D, sSide.secs.filter((x) => x.key !== "contact"), true);
  fillFromSections(D, sMain.secs, true);
  return D;
}
async function fromPdf(file, current) {
  const pages = await readPdfPages(file);
  if (!pages.some((p) => p.items.length)) throw new Error("This PDF has no selectable text (it may be a scan). Try a PDF saved from a word processor, or the LinkedIn data export.");
  const li = isLinkedInPdf(pages);
  const D = li ? dataFromLinkedInPdf(pages) : dataFromGenericPdf(pages);
  return assemble(D, li ? "LinkedIn PDF" : "PDF", current, ["PDF reading is best effort. Check each section, especially dates and job titles."]);
}

/* ---------- LinkedIn data export (ZIP or CSV) ---------- */
const LI_FILES = ["profile", "positions", "education", "skills", "certifications", "projects", "honors", "languages", "volunteering", "publications", "emailaddresses", "phonenumbers"];
const LI_COLS = {
  profile: ["first name", "last name", "headline", "summary"], positions: ["company name", "title"], education: ["school name", "degree name"],
  skills: ["name"], certifications: ["name", "authority"], projects: ["title", "description"], honors: ["title", "issued on"],
  languages: ["name", "proficiency"], volunteering: ["company name", "role"], publications: ["name", "publisher"],
  emailaddresses: ["email address"], phonenumbers: ["number"],
};
const normFileKey = (name) => name.split(/[\\/]/).pop().toLowerCase().replace(/\.csv$/, "").replace(/[^a-z]/g, "");

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function csvTable(text, knownCols) {
  const rows = parseCSV(text);
  let hi = -1, head;
  for (let i = 0; i < rows.length && hi < 0; i++) {
    const low = rows[i].map((c) => c.trim().toLowerCase());
    if (low.some((c) => knownCols.includes(c))) { hi = i; head = low; }
  }
  if (hi < 0) return [];
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.some((c) => c.trim())) continue;
    const o = {};
    head.forEach((h, idx) => (o[h] = (cells[idx] || "").trim()));
    out.push(o);
  }
  return out;
}
async function readZipEntries(file) {
  const size = file.size;
  const tail = new DataView(await file.slice(Math.max(0, size - 66000)).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That does not look like a valid ZIP file.");
  const count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder("utf-8");
  let pos = 0;
  const found = {};
  for (let n = 0; n < count && pos + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(pos, true) !== 0x02014b50) break;
    const method = cd.getUint16(pos + 10, true), csize = cd.getUint32(pos + 20, true);
    const nlen = cd.getUint16(pos + 28, true), elen = cd.getUint16(pos + 30, true), clen = cd.getUint16(pos + 32, true);
    const lho = cd.getUint32(pos + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + pos + 46, nlen));
    pos += 46 + nlen + elen + clen;
    const key = normFileKey(name);
    if (!/\.csv$/i.test(name) || !LI_FILES.includes(key) || found[key]) continue;
    const lh = new DataView(await file.slice(lho, lho + 30).arrayBuffer());
    const start = lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const blob = file.slice(start, start + csize);
    let bytes;
    if (method === 0) bytes = await blob.arrayBuffer();
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open ZIP files. Unzip it and choose the CSV files instead.");
      bytes = await new Response(blob.stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    } else continue;
    found[key] = dec.decode(bytes);
  }
  return found;
}
async function collectLinkedInFiles(files) {
  const texts = {};
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const found = await readZipEntries(f);
      Object.keys(found).forEach((k) => { if (!texts[k]) texts[k] = found[k]; });
    } else if (/\.csv$/i.test(f.name)) {
      const key = normFileKey(f.name);
      if (LI_FILES.includes(key) && !texts[key]) texts[key] = await f.text();
    }
  }
  return texts;
}
const LI_PROF = [["native", "Native"], ["full professional", "Fluent"], ["professional working", "Professional"], ["limited working", "Limited"], ["elementary", "Elementary"]];

function fromLinkedInExport(texts, current) {
  const T = {};
  Object.keys(texts).forEach((k) => (T[k] = csvTable(texts[k], LI_COLS[k])));
  const p = (T.profile && T.profile[0]) || {};
  const D = emptyData();
  D.name = [p["first name"], p["last name"]].filter(Boolean).join(" ");
  D.headline = p.headline || "";
  D.summary = p.summary || "";
  (T.emailaddresses || []).forEach((r) => { const e = r["email address"]; if (e && (!D.email || /^(yes|true)$/i.test(r.primary || ""))) D.email = e; });
  if (T.phonenumbers && T.phonenumbers[0]) D.phone = cleanPhone(T.phonenumbers[0].number);
  const loc = String(p["geo location"] || p.address || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (loc.length > 1 && /^united states$/i.test(loc[loc.length - 1])) loc.pop();
  D.location = loc.join(", ");
  const site = String(p.websites || "").match(/https?:\/\/[^\s\][,;]+/);
  D.website = site ? stripUrl(site[0]) : "";
  const notes = [];
  const skills = (T.skills || []).map((r) => r.name).filter(Boolean);
  if (skills.length > MAX_SKILLS) notes.push(`Using the first ${MAX_SKILLS} of your ${skills.length} skills.`);
  if (skills.length) D.skills = [{ label: "Skills", items: skills.slice(0, MAX_SKILLS) }];
  D.experience = (T.positions || []).map((r) => ({ org: r["company name"], role: r.title, location: r.location || "", start: r["started on"] || "", end: r["finished on"] || "", bullets: toBullets(r.description) }));
  D.education = (T.education || []).map((e) => {
    const b = toBullets(e.notes);
    if (e.activities) b.push("Activities: " + e.activities);
    return { school: e["school name"], degree: e["degree name"], start: e["start date"] || "", end: e["end date"] || "", bullets: b };
  });
  D.projects = (T.projects || []).map((r) => { const a = r["started on"], z = r["finished on"]; return { name: r.title, date: a && z ? a + " – " + z : a || z || "", link: r.url || "", bullets: toBullets(r.description) }; });
  D.certifications = (T.certifications || []).map((c) => ({ name: c.name, issuer: c.authority, date: c["started on"] || "" }));
  D.lists.languages = (T.languages || []).filter((l) => l.name).map((l) => {
    const prof = (l.proficiency || "").toLowerCase();
    const short = (LI_PROF.find((pair) => prof.includes(pair[0])) || [])[1];
    return l.name + (short ? ` (${short})` : "");
  });
  D.lists.awards = (T.honors || []).map((h) => h.title).filter(Boolean);
  D.lists.publications = (T.publications || []).map((x) => x.name).filter(Boolean);
  D.volunteer = (T.volunteering || []).map((v) => ({ org: v["company name"], role: v.role, start: v["started on"] || "", end: v["finished on"] || "", bullets: toBullets(v.description) }));
  const r = assemble(D, "LinkedIn data export", current, notes);
  r.missing = r.missing.filter((m) => !/description$/.test(m)); // LinkedIn often has no descriptions; that is normal
  return r;
}

/* ---------- entry point ---------- */
export async function importFiles(fileList, current) {
  const files = Array.from(fileList);
  const li = files.filter((f) => /\.(zip|csv)$/i.test(f.name));
  const json = files.find((f) => /\.json$/i.test(f.name) || f.type === "application/json");
  const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (li.length) {
    const texts = await collectLinkedInFiles(li);
    if (Object.keys(texts).length) return fromLinkedInExport(texts, current);
    if (!json && !pdf) throw new Error("No LinkedIn profile files were found. The ZIP should contain files such as Profile.csv and Positions.csv.");
  }
  if (json) {
    let root;
    try { root = JSON.parse(await json.text()); } catch { throw new Error("That file is not valid JSON."); }
    const r = fromJson(root, current);
    if (!r) throw new Error("That JSON file does not look like a resume.");
    return r;
  }
  if (pdf) return fromPdf(pdf, current);
  throw new Error("Choose a PDF, a JSON backup, or LinkedIn's ZIP or CSV files.");
}

export { clone, copyDesign };

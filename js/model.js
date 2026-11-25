// Resume data model: templates, design options, defaults, and the normalizer that
// accepts current saves, older Resume Forge backups, and partial data.

export const TEMPLATES = {
  classic: {
    name: "Classic",
    blurb: "Centered serif. Timeless for law, finance and hospitality.",
    font: "garamond",
    accent: "ink",
  },
  modern: {
    name: "Modern",
    blurb: "Clean sans with a confident accent. Fits almost any role.",
    font: "inter",
    accent: "navy",
  },
  executive: {
    name: "Executive",
    blurb: "Large serif name and an accent rule. Built for senior roles.",
    font: "sourceserif",
    accent: "oxblood",
  },
  technical: {
    name: "Technical",
    blurb: "Dense and precise. Made for engineers and scientists.",
    font: "plex",
    accent: "ink",
  },
  minimal: {
    name: "Minimal",
    blurb: "A left date column and quiet type. Great for early careers.",
    font: "lato",
    accent: "forest",
  },
};
export const TEMPLATE_ORDER = ["classic", "modern", "executive", "technical", "minimal"];

export const ACCENTS = {
  ink: { label: "Ink", color: "#1d1d1f" },
  navy: { label: "Navy", color: "#1f3a5f" },
  oxblood: { label: "Oxblood", color: "#7a2a22" },
  forest: { label: "Forest", color: "#24503b" },
  teal: { label: "Teal", color: "#0f5b63" },
  plum: { label: "Plum", color: "#4f2f57" },
};

export const FONTS = {
  inter: { label: "Inter", kind: "Sans", stack: '"Inter", "Helvetica Neue", Arial, sans-serif' },
  plex: { label: "IBM Plex Sans", kind: "Sans", stack: '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif' },
  lato: { label: "Lato", kind: "Sans", stack: '"Lato", "Helvetica Neue", Arial, sans-serif' },
  sourceserif: { label: "Source Serif", kind: "Serif", stack: '"Source Serif 4", Georgia, serif' },
  garamond: { label: "EB Garamond", kind: "Serif", stack: '"EB Garamond", Garamond, Georgia, serif' },
  baskerville: { label: "Libre Baskerville", kind: "Serif", stack: '"Libre Baskerville", Georgia, serif' },
};

// Multiplies every size on the page. Standard sets body text near 10pt.
export const DENSITY = { compact: 1.2, standard: 1.3, roomy: 1.4 };

// Page sizes in CSS pixels at 96 dpi, which is what the browser prints.
export const PAGE_SIZES = {
  letter: { label: "US Letter", w: 816, h: 1056, css: "8.5in 11in" },
  a4: { label: "A4", w: 794, h: 1123, css: "210mm 297mm" },
};
// Margins in inches: [vertical, horizontal]
export const MARGINS = { narrow: [0.45, 0.5], normal: [0.6, 0.7], wide: [0.85, 0.95] };

export const BUILTIN = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Leadership & Activities",
  certifications: "Certifications",
};
export const ENTRY_KINDS = ["experience", "education", "projects", "activities", "certifications"];

export const PRESETS = [
  { key: "awards", label: "Awards & Honors", kind: "list" },
  { key: "languages", label: "Languages", kind: "list" },
  { key: "volunteer", label: "Volunteer Experience", kind: "entries" },
  { key: "publications", label: "Publications", kind: "entries" },
  { key: "affiliations", label: "Professional Affiliations", kind: "list" },
  { key: "interests", label: "Interests", kind: "list" },
  { key: "references", label: "References", kind: "text" },
];

export const uid = () => "id" + Math.random().toString(36).slice(2, 10);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const SAMPLE = {
  version: 2,
  template: "modern",
  accent: null,
  font: null,
  density: "standard",
  page: { size: "letter", margin: "normal" },
  fitOnePage: true,
  sectionOrder: ["summary", "experience", "education", "skills", "projects", "certifications"],
  sectionTitles: {},
  contact: {
    fullName: "Jordan Reyes",
    roleTitle: "Mechanical Design Engineer",
    email: "jordan.reyes@email.com",
    phone: "(555) 210-4488",
    location: "Denver, CO",
    linkedin: "linkedin.com/in/jordanreyes",
    website: "jordanreyes.dev",
    extra: "",
  },
  summary:
    "Mechanical engineer with three years designing sheet-metal and injection-molded assemblies for consumer hardware, from concept sketches through DFM and first-article inspection. Comfortable owning a part from CAD to the production floor.",
  skillGroups: [
    { id: "g1", label: "Design & CAD", items: ["SolidWorks", "GD&T", "DFM/DFA", "Sheet Metal"] },
    { id: "g2", label: "Analysis", items: ["FEA (ANSYS)", "MATLAB", "Minitab", "Tolerance Stacks"] },
    { id: "g3", label: "Manufacturing", items: ["Injection Molding", "CNC Machining", "Six Sigma Green Belt"] },
  ],
  experience: [
    {
      id: "e1", org: "Alta Motion Co.", role: "Mechanical Engineer II", location: "Boulder, CO",
      start: "Jun 2023", end: "Present", include: true,
      bullets: [
        "Led the redesign of a 14-part enclosure into a 6-part assembly, cutting unit cost by 22%",
        "Ran DFM reviews with two contract manufacturers, resolving 30+ issues before tooling was cut",
        "Built a GD&T-driven tolerance stack that caught a fit failure before production",
      ],
    },
    {
      id: "e2", org: "Highline Prototyping", role: "Engineering Intern", location: "Fort Collins, CO",
      start: "May 2022", end: "Aug 2022", include: true,
      bullets: [
        "Machined and fit-checked 40+ prototype brackets on a 3-axis CNC mill",
        "Wrote an inspection procedure the QA team still uses today",
      ],
    },
  ],
  education: [
    {
      id: "d1", school: "Colorado State University", degree: "B.S. Mechanical Engineering", location: "Fort Collins, CO",
      start: "2019", end: "2023", gpa: "3.6", coursework: "Machine Design, Thermodynamics, Manufacturing Processes", include: true,
      bullets: ["Dean's List, Fall 2021 and Spring 2022"],
    },
  ],
  projects: [
    {
      id: "p1", name: "Foot-Launch Glider Frame", role: "Team Lead", date: "2023", link: "", include: true,
      bullets: ["Designed a carbon-tube airframe that passed a 6g static load test with a 1.4x safety margin"],
    },
  ],
  activities: [],
  certifications: [
    { id: "c1", name: "Six Sigma Green Belt", issuer: "ASQ", date: "2023", include: true },
    { id: "c2", name: "Certified SolidWorks Associate", issuer: "Dassault Systèmes", date: "2022", include: true },
  ],
  customSections: [],
};

export function blankState(design) {
  const s = clone(SAMPLE);
  s.contact = { fullName: "", roleTitle: "", email: "", phone: "", location: "", linkedin: "", website: "", extra: "" };
  s.summary = "";
  s.skillGroups = [{ id: uid(), label: "Skills", items: [] }];
  s.experience = [];
  s.education = [];
  s.projects = [];
  s.activities = [];
  s.certifications = [];
  s.customSections = [];
  s.sectionOrder = ["summary", "experience", "education", "skills"];
  if (design) copyDesign(design, s);
  return s;
}

export function copyDesign(from, to) {
  ["template", "accent", "font", "density", "fitOnePage"].forEach((k) => (to[k] = from[k]));
  to.page = clone(from.page);
  return to;
}

// Older Resume Forge used industry template names.
const LEGACY_TEMPLATE = { engineering: "technical", aerospace: "executive", mechanical: "modern", internship: "minimal", service: "classic" };

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);

export function normalize(raw) {
  const p = raw && typeof raw === "object" ? clone(raw) : {};
  const s = {};
  s.version = 2;
  const tpl = LEGACY_TEMPLATE[p.template] || p.template;
  s.template = TEMPLATES[tpl] ? tpl : "modern";
  s.accent = ACCENTS[p.accent] ? p.accent : null;
  s.font = FONTS[p.font] ? p.font : null;
  s.density = DENSITY[p.density] ? p.density : "standard";
  const pg = p.page && typeof p.page === "object" ? p.page : {};
  s.page = { size: PAGE_SIZES[pg.size] ? pg.size : "letter", margin: MARGINS[pg.margin] ? pg.margin : "normal" };
  s.fitOnePage = p.fitOnePage !== undefined ? p.fitOnePage !== false : p.pageMode !== "multi";

  const c = p.contact && typeof p.contact === "object" ? p.contact : {};
  s.contact = {};
  ["fullName", "roleTitle", "email", "phone", "location", "linkedin", "website", "extra"].forEach((k) => (s.contact[k] = str(c[k])));
  if (!s.contact.extra) s.contact.extra = str(c.clearance || c.availability);
  s.summary = str(p.summary);

  s.skillGroups = arr(p.skillGroups).map((g) => ({ id: str(g.id) || uid(), label: str(g.label), items: arr(g.items).map(str).filter(Boolean) }));
  const entry = (e, fields) => {
    const o = { id: str(e && e.id) || uid(), include: !(e && e.include === false) };
    fields.forEach((f) => (o[f] = str(e && e[f])));
    o.bullets = arr(e && e.bullets).map(str).filter((b) => b.trim());
    return o;
  };
  const jobF = ["org", "role", "location", "start", "end"];
  s.experience = arr(p.experience).map((e) => entry(e, jobF));
  s.activities = arr(p.activities).map((e) => entry(e, jobF));
  s.education = arr(p.education).map((e) => entry(e, ["school", "degree", "location", "start", "end", "gpa", "coursework"]));
  s.projects = arr(p.projects).map((e) => entry(e, ["name", "role", "date", "link"]));
  s.certifications = arr(p.certifications).map((e) => {
    const o = entry(e, ["name", "issuer", "date"]);
    delete o.bullets;
    return o;
  });
  s.customSections = arr(p.customSections).map((cs) => {
    const kind = ["list", "entries", "text"].includes(cs.kind) ? cs.kind : "list";
    const o = { id: str(cs.id) || uid(), label: str(cs.label) || "Section", kind };
    if (kind === "list") o.items = arr(cs.items).map(str).filter(Boolean);
    if (kind === "text") o.content = str(cs.content);
    if (kind === "entries") o.entries = arr(cs.entries).map((e) => entry(e, jobF));
    return o;
  });

  const exists = (k) => BUILTIN[k] || s.customSections.some((c) => c.id === k);
  if (Array.isArray(p.sectionOrder)) {
    s.sectionOrder = [...new Set(p.sectionOrder.filter(exists))];
  } else {
    // Older saves without an explicit order: show every section that has content.
    s.sectionOrder = ["summary", "experience", "education", "skills", "projects", "activities", "certifications"].filter((k) => {
      if (k === "summary") return !!s.summary;
      if (k === "skills") return s.skillGroups.some((g) => g.items.length);
      return s[k].length > 0;
    });
    s.customSections.forEach((cs) => s.sectionOrder.push(cs.id));
  }
  s.sectionTitles = {};
  if (p.sectionTitles && typeof p.sectionTitles === "object") {
    Object.keys(p.sectionTitles).forEach((k) => {
      if (BUILTIN[k] && str(p.sectionTitles[k]).trim()) s.sectionTitles[k] = str(p.sectionTitles[k]);
    });
  }
  return s;
}

export function sectionTitle(s, key) {
  if (BUILTIN[key]) return s.sectionTitles[key] || BUILTIN[key];
  const cs = s.customSections.find((c) => c.id === key);
  return cs ? cs.label : key;
}

export function allSectionKeys(s) {
  return Object.keys(BUILTIN).concat(s.customSections.map((c) => c.id));
}

export function design(s) {
  const t = TEMPLATES[s.template];
  return {
    template: s.template,
    accent: ACCENTS[s.accent || t.accent].color,
    font: FONTS[s.font || t.font].stack,
    scale: DENSITY[s.density],
    page: PAGE_SIZES[s.page.size],
    margin: MARGINS[s.page.margin],
  };
}

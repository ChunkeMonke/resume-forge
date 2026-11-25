// Landing page: renders real resume pages with the editor's own renderer,
// plus scroll reveals and the nav background.
import { SAMPLE, TEMPLATES, TEMPLATE_ORDER, clone } from "./model.js";
import { flowHtml, pageHtml, pageBox } from "./render.js";

document.documentElement.classList.remove("no-js");

const sample = (template, extra = {}) => Object.assign(clone(SAMPLE), { template, accent: null, font: null }, extra);

function renderInto(el, s, width) {
  const box = pageBox(s);
  el.innerHTML = `<div class="thumb">${pageHtml(box, flowHtml(s))}</div>`;
  const t = el.querySelector(".thumb");
  if (width) t.style.transform = `scale(${width / box.w})`;
}

// Hero sheets
document.querySelectorAll("[data-render]").forEach((el) => {
  const s = sample(el.dataset.render);
  el.innerHTML = pageHtml(pageBox(s), flowHtml(s));
});

// Template cards
const row = document.getElementById("tpl-row");
row.innerHTML = TEMPLATE_ORDER.map((k, i) => `<a class="tpl-card reveal" style="transition-delay:${i * 70}ms" href="app.html?template=${k}">
  <div class="frame" data-tpl="${k}"></div><h3>${TEMPLATES[k].name}</h3><p>${TEMPLATES[k].blurb}</p></a>`).join("");
function sizeCards() {
  row.querySelectorAll("[data-tpl]").forEach((f) => renderInto(f, sample(f.dataset.tpl), f.clientWidth));
}
sizeCards();
new ResizeObserver(sizeCards).observe(row);
document.fonts && document.fonts.ready.then(sizeCards);

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
document.querySelectorAll(".reveal, .feat, .hero-art").forEach((el) => io.observe(el));

// Nav background once scrolled
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 10);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

document.getElementById("year").textContent = new Date().getFullYear();

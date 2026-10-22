// きのうノートの動き：号の一覧と号を読み、アドレスの # の部分（#/日付/ジャンル/記事）に合わせて描く。
import { GENRES } from "./render-story.js";
import { frontPage, genrePage, aiPage } from "./render-pages.js";
import { fetchJson } from "./data-source.js";

const page = document.getElementById("page");
const tabs = document.getElementById("tabs");
const dateSelect = document.getElementById("date-select");
const popover = document.getElementById("popover");
const state = { dates: [], editions: new Map(), filter: "all" };
const THEMES = ["auto", "light", "dark"];
const THEME_ICONS = { auto: "🌗", light: "☀️", dark: "🌙" };

async function loadEdition(date) {
  if (!state.editions.has(date)) state.editions.set(date, await fetchJson(`data/editions/${date}.json`));
  return state.editions.get(date);
}

function parseRoute() {
  const [date, genre, storyId] = location.hash.replace(/^#\/?/, "").split("/");
  return { date: date || state.dates[0], genre: GENRES.some((item) => item.key === genre) ? genre : "top", storyId };
}

function renderTabs(edition, route) {
  tabs.innerHTML = GENRES.map((genre) => {
    const count = genre.key === "top" ? "" : `<span class="tab-count">${edition.genres[genre.key]?.stories.length || 0}</span>`;
    const current = genre.key === route.genre ? ' aria-current="page"' : "";
    return `<a class="tab" href="#/${edition.date}/${genre.key}" style="--tab-color: var(--${genre.key})"${current}>${genre.emoji} ${genre.label}${count}</a>`;
  }).join("");
  tabs.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
}

function renderDateNav(route) {
  dateSelect.innerHTML = state.dates.map((date) => {
    const [year, month, day] = date.split("-").map(Number);
    const weekday = "日月火水木金土"[new Date(year, month - 1, day).getDay()];
    return `<option value="${date}"${date === route.date ? " selected" : ""}>${month}月${day}日（${weekday}）</option>`;
  }).join("");
  const index = state.dates.indexOf(route.date);
  document.getElementById("newer").disabled = index <= 0;
  document.getElementById("older").disabled = index < 0 || index >= state.dates.length - 1;
}

function storiesById(edition) {
  const map = new Map();
  for (const genre of Object.values(edition.genres)) for (const story of genre.stories) map.set(story.id, story);
  return map;
}

function focusStory(storyId) {
  const target = storyId && document.getElementById(storyId);
  if (!target) return;
  target.closest("details.more-list")?.setAttribute("open", "");  // 「あと N 件」の中なら開く
  target.querySelector("details")?.setAttribute("open", "");
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("is-flash");
  setTimeout(() => target.classList.remove("is-flash"), 1700);
}

async function render({ keepScroll = false } = {}) {
  hidePopover();
  const route = parseRoute();
  if (!route.date) { page.innerHTML = `<p class="empty">🦉 まだノートがありません。夜のあいだに作ります。</p>`; return; }
  let edition;
  try { edition = await loadEdition(route.date); } catch (error) {
    page.innerHTML = `<p class="empty">🦉 ${route.date} のノートが見つかりません</p>`; return;
  }
  const context = { date: edition.date, storiesById: storiesById(edition) };
  renderTabs(edition, route);
  renderDateNav(route);
  if (route.genre === "top") page.innerHTML = frontPage(edition, context);
  else if (route.genre === "ai") page.innerHTML = aiPage(edition, context, state.filter);
  else page.innerHTML = genrePage(edition, route.genre, context, state.filter);
  if (route.storyId) focusStory(route.storyId); else if (!keepScroll) window.scrollTo({ top: 0 });
}

// 用語・照合の印を押すと、すぐ下に説明のふきだしを出す
function showPopover(target) {
  const title = document.createElement("b");
  title.textContent = target.dataset.title;
  popover.replaceChildren(title, document.createTextNode(target.dataset.explain));
  popover.hidden = false;
  popover.dataset.scrollY = String(window.scrollY);
  const box = target.getBoundingClientRect();
  const width = popover.offsetWidth;
  popover.style.left = `${Math.max(16, Math.min(box.left, window.innerWidth - width - 16))}px`;
  const below = box.bottom + 8;
  popover.style.top = `${below + popover.offsetHeight > window.innerHeight ? box.top - popover.offsetHeight - 8 : below}px`;
}

function hidePopover() { popover.hidden = true; }

function applyTheme(theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  document.getElementById("theme-toggle").textContent = THEME_ICONS[theme];
  try { localStorage.setItem("theme", theme === "auto" ? "" : theme); } catch (error) { /* 保存できない端末でも見た目は切り替わる */ }
}

function setUpEvents() {
  window.addEventListener("hashchange", () => render());
  dateSelect.addEventListener("change", () => { location.hash = `#/${dateSelect.value}/${parseRoute().genre}`; });
  const step = (offset) => {
    const route = parseRoute();
    const next = state.dates[state.dates.indexOf(route.date) + offset];
    if (next) location.hash = `#/${next}/${route.genre}`;
  };
  document.getElementById("older").addEventListener("click", () => step(1));
  document.getElementById("newer").addEventListener("click", () => step(-1));
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "auto";
    applyTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  });
  document.addEventListener("click", (event) => {
    const explained = event.target.closest("[data-explain]");
    const filterButton = event.target.closest("[data-filter]");
    if (explained && explained.dataset.explain) { showPopover(explained); event.stopPropagation(); return; }
    if (filterButton) { state.filter = filterButton.dataset.filter; render({ keepScroll: true }); return; }
    hidePopover();
  });
  window.addEventListener("scroll", () => {
    if (!popover.hidden && Math.abs(window.scrollY - Number(popover.dataset.scrollY)) > 40) hidePopover();
  }, { passive: true });
}

async function start() {
  setUpEvents();
  applyTheme(document.documentElement.dataset.theme || "auto");
  try {
    state.dates = (await fetchJson("data/index.json")).editions.map((entry) => entry.date);
  } catch (error) {
    state.dates = [];
  }
  render();
}

start();

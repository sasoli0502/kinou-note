// 記事1つぶんの見た目（しっかり版のカード・ひとこと版の行）と、小さな共通の部品。
export const GENRES = [
  { key: "top", label: "トップ", emoji: "🌟" },
  { key: "politics", label: "政治", emoji: "🏛️" },
  { key: "economy", label: "経済", emoji: "💰" },
  { key: "tech", label: "テクノロジー", emoji: "🔧" },
  { key: "ai", label: "AI", emoji: "🤖" },
  { key: "sports", label: "スポーツ", emoji: "⚽" },
];
export const genreInfo = (key) => GENRES.find((genre) => genre.key === key) || GENRES[0];

const LANGUAGE_NAMES = { en: "英語", zh: "中国語", ja: "日本語" };
const CHECK_LABELS = {
  ok: ["check-ok", "🔍 翻訳を照合ずみ", "元の記事と照らし合わせて、合っていました。"],
  fixed: ["check-fixed", "✏️ 照合で直しました", ""],
  caution: ["check-caution", "⚠️ 要注意", ""],
};

export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

export function flag(code) {
  const normalized = String(code || "").toLowerCase();
  if (normalized === "intl" || normalized.length !== 2) return "🌐";
  const letters = normalized === "uk" ? "gb" : normalized;
  return String.fromCodePoint(...[...letters.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export function storyHref(date, story) {
  return `#/${date}/${story.genre}/${story.id}`;
}

// 要約の中の用語の最初の1か所を、押すと説明が出るボタンにする
function highlightTerms(sentence, terms, used) {
  let html = escapeHtml(sentence);
  for (const term of terms) {
    const escapedTerm = escapeHtml(term.term);
    if (!escapedTerm || used.has(term.term) || !html.includes(escapedTerm)) continue;
    used.add(term.term);
    const button = `<button type="button" class="term" data-title="${escapedTerm}" data-explain="${escapeHtml(term.explain)}">${escapedTerm}</button>`;
    html = html.replace(escapedTerm, button);
  }
  return html;
}

function termChips(terms) {
  if (!terms?.length) return "";
  const chips = terms.map((term) => `<button type="button" class="term-chip" data-title="${escapeHtml(term.term)}" data-explain="${escapeHtml(term.explain)}">📘 ${escapeHtml(term.term)}</button>`);
  return `<div class="term-chips">${chips.join("")}</div>`;
}

function checkBadge(check) {
  const label = CHECK_LABELS[check?.verdict];
  if (!label) return "";
  const explain = check.notes || label[2];
  return `<button type="button" class="check ${label[0]}" data-title="翻訳の照合" data-explain="${escapeHtml(explain)}">${label[1]}</button>`;
}

const VISIBLE_SOURCES = 3;

function sourceLink(source) {
  const stance = source.stance ? ` title="${escapeHtml(source.stance)}"` : "";
  return `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener"${stance}>${flag(source.country)} ${escapeHtml(source.name)} ↗</a>`;
}

// 同じ情報源は1回だけ。最初の3社だけ並べ、残りは「ほか N社」を開くと出る（立ち位置のメモつき）
function sourceLinks(sources) {
  const unique = [...new Map(sources.map((source) => [source.name, source])).values()];
  const shown = unique.slice(0, VISIBLE_SOURCES).map(sourceLink).join("");
  const rest = unique.slice(VISIBLE_SOURCES);
  if (!rest.length) return shown;
  const lines = rest.map((source) => `<li>${sourceLink(source)}${source.stance ? `<span class="source-stance">${escapeHtml(source.stance)}</span>` : ""}</li>`);
  return `${shown}<details class="more-sources"><summary>ほか ${rest.length}社</summary><ul>${lines.join("")}</ul></details>`;
}

function originalTitles(sources) {
  const foreign = sources.filter((source) => source.original_title);
  if (!foreign.length) return "";
  const lines = foreign.map((source) => `<p lang="${source.lang}">${escapeHtml(source.original_title)}<br><small>— ${escapeHtml(source.name)}（${LANGUAGE_NAMES[source.lang] || source.lang}）</small></p>`);
  return `<details class="original"><summary>元の見出しを見る（${foreign.length}）</summary>${lines.join("")}</details>`;
}

function aiExtra(ai) {
  if (!ai || (!ai.try_it && !ai.revenue)) return "";
  const rows = [];
  if (ai.try_it) rows.push(`<div><b>🧪 試すなら</b> ${escapeHtml(ai.try_it)}</div>`);
  if (ai.revenue) rows.push(`<div><b>💰 数字</b> ${escapeHtml(ai.revenue)}</div>`);
  return `<div class="ai-extra">${rows.join("")}</div>`;
}

function flags(countries) {
  return [...new Set(countries || [])].slice(0, 5).map(flag).join("");
}

export function storyCard(story, { hero = false } = {}) {
  const used = new Set();
  const summary = story.summary.map((sentence) => `<li>${highlightTerms(sentence, story.terms || [], used)}</li>`).join("");
  const big = story.importance >= 4 ? `<span class="big-badge">${story.importance >= 5 ? "超大ニュース" : "大ニュース"}</span>` : "";
  const point = story.point ? `<div class="point"><span class="point-label">ここがポイント</span><span class="point-text">${escapeHtml(story.point)}</span></div>` : "";
  const ribbon = hero ? `<div class="ribbon">🌟 きのういちばんのニュース</div>` : "";
  return `<article class="story${hero ? " hero" : ""}" id="${story.id}" style="--genre-color: var(--${story.genre})">
    ${ribbon}
    <div class="story-top"><span class="flags">${flags(story.countries)}</span>${big}<span>${genreInfo(story.genre).emoji} ${genreInfo(story.genre).label}</span><span>・${new Set(story.sources.map((source) => source.name)).size}社が報道</span></div>
    <h3>${escapeHtml(story.headline)}</h3>
    <ul class="story-summary">${summary}</ul>
    ${point}${aiExtra(story.ai)}${termChips(story.terms)}${originalTitles(story.sources)}
    <div class="story-foot">${checkBadge(story.check)}${sourceLinks(story.sources)}</div>
  </article>`;
}

export function briefItem(story) {
  const used = new Set();
  const text = story.summary.map((sentence) => highlightTerms(sentence, story.terms || [], used)).join("");
  return `<li class="brief" id="${story.id}" style="--genre-color: var(--${story.genre})">
    <div class="brief-head"><span class="flags">${flags(story.countries)}</span><span class="brief-title">${escapeHtml(story.headline)}</span></div>
    <p class="brief-text">${text}</p>
    ${originalTitles(story.sources)}
    <div class="story-foot">${checkBadge(story.check)}${sourceLinks(story.sources)}</div>
  </li>`;
}

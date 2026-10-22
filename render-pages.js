// ページ全体の見た目：表紙（トップ）・ジャンルのページ・AI のページ。
import { GENRES, genreInfo, escapeHtml, storyCard, briefItem, storyHref } from "./render-story.js";
import { insightNote, momentum, storyLinks, watchList } from "./render-insight.js";

export const FILTERS = [
  { key: "all", label: "すべて" },
  { key: "jp", label: "🇯🇵 日本" },
  { key: "us", label: "🇺🇸 アメリカ" },
  { key: "cn", label: "🇨🇳 中国" },
  { key: "other", label: "🌏 そのほか" },
];
const MAIN_COUNTRIES = ["jp", "us", "cn"];

function matchesFilter(story, filter) {
  const countries = story.countries || [];
  if (filter === "all") return true;
  if (filter === "other") return countries.some((country) => !MAIN_COUNTRIES.includes(country));
  return countries.includes(filter);
}

function section(title, body) {
  return body ? `<h2 class="section-title">${title}</h2>${body}` : "";
}

function miniLink(story, date) {
  const info = genreInfo(story.genre);
  return `<a class="mini" href="${storyHref(date, story)}" style="--genre-color: var(--${story.genre})">
    <div class="mini-genre">${info.emoji} ${info.label}</div><div class="mini-title">${escapeHtml(story.headline)}</div></a>`;
}

function stats(edition) {
  const s = edition.stats;
  const check = s.check || {};
  return `<div class="stats">
    <span class="stat"><b>${s.sources}</b>の情報源</span>
    <span class="stat"><b>${s.articles}</b>本の記事を読んで</span>
    <span class="stat"><b>${s.stories}</b>の話題にまとめました</span>
    <span class="stat">英語・中国語から翻訳 <b>${s.translated}</b> → 照合OK ${check.ok || 0}・直した ${check.fixed || 0}・要注意 ${check.caution || 0}</span>
    ${troubleNote(s.source_trouble)}
  </div>`;
}

// 1日の取得の半分以上で失敗した情報源（黙って記事が減らないよう、表紙に出す）
function troubleNote(troubled) {
  if (!troubled?.length) return "";
  const names = troubled.map((item) => `${escapeHtml(item.name)}（${item.failures}/${item.attempts}回失敗）`).join("・");
  return `<span class="stat stat-trouble">⚠️ 取れていない情報源：${names}</span>`;
}

export function frontPage(edition, context) {
  const front = edition.front || {};
  const hero = context.storiesById.get(front.hero_id);
  const highlights = (front.highlight_ids || []).map((id) => context.storiesById.get(id)).filter(Boolean);
  const lead = front.lead ? `<div class="lead-box"><div class="lead-owl">🦉</div><div><div class="lead-label">きのうをひとことで</div><p class="lead-text">${escapeHtml(front.lead)}</p></div></div>` : "";
  const connections = (front.connections || []).map((item) => `<div class="bubble"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.explain)} ${storyLinks(item.story_ids, context)}</span></div>`).join("");
  const genreCards = GENRES.filter((genre) => genre.key !== "top").map((genre) => {
    const data = edition.genres[genre.key] || { stories: [], insight: {} };
    const overview = (data.insight?.overview || "").split("。")[0];
    return `<a class="genre-card" href="#/${edition.date}/${genre.key}" style="--genre-color: var(--${genre.key})">
      <h3>${genre.emoji} ${genre.label}<span class="tab-count">　${data.stories.length}件</span></h3><p>${escapeHtml(overview)}${overview ? "。" : ""}</p></a>`;
  }).join("");
  return `${lead}
    <div class="front-grid">${hero ? storyCard(hero, { hero: true }) : ""}<div class="front-side">${highlights.map((story) => miniLink(story, edition.date)).join("")}</div></div>
    ${section("🔗 話題のつながり", connections ? `<div class="bubbles">${connections}</div>` : "")}
    ${section("📚 ジャンルごとのまとめ", `<div class="genre-strip">${genreCards}</div>`)}
    ${stats(edition)}`;
}

const FIRST_FULL = 24;
const FIRST_BRIEF = 30;

function filterButtons(filter) {
  return `<div class="filters">${FILTERS.map((item) => `<button type="button" class="chip-button" data-filter="${item.key}" aria-pressed="${item.key === filter}">${item.label}</button>`).join("")}</div>`;
}

function storyLists(data, filter) {
  const topIds = (data.insight?.top_ids || []).slice(0, 3);
  const visible = data.stories.filter((story) => matchesFilter(story, filter));
  const top = topIds.map((id) => visible.find((story) => story.id === id)).filter(Boolean);
  const rest = visible.filter((story) => !topIds.includes(story.id));
  const full = rest.filter((story) => story.full);
  const brief = rest.filter((story) => !story.full);
  if (!visible.length) return `<p class="empty">この国の話題はありませんでした</p>`;
  const grid = (html) => `<div class="story-grid">${html}</div>`;
  const list = (html) => `<ul class="brief-list">${html}</ul>`;
  return section("🔝 いちばん大事", top.length ? grid(top.map((story) => storyCard(story)).join("")) : "")
    + section(`📰 しっかり読む（${full.length}）`, full.length ? withMore(full, FIRST_FULL, (story) => storyCard(story), grid) : "")
    + section(`📝 ひとことニュース（${brief.length}）`, brief.length ? withMore(brief, FIRST_BRIEF, briefItem, list) : "");
}

// 話題が多い日（1ジャンル数百件）でもページが長くなりすぎないよう、最初は一部だけ出して残りは「あと N 件」で開く。
function withMore(items, firstCount, render, wrap) {
  const shown = wrap(items.slice(0, firstCount).map(render).join(""));
  const rest = items.slice(firstCount);
  if (!rest.length) return shown;
  return `${shown}<details class="more-list"><summary>あと ${rest.length} 件を見る</summary>${wrap(rest.map(render).join(""))}</details>`;
}

function genreHead(genreKey, data) {
  const info = genreInfo(genreKey);
  const sourceCount = new Set(data.stories.flatMap((story) => story.sources.map((source) => source.name))).size;
  return `<div class="genre-head"><h1 class="genre-title"><span class="emoji">${info.emoji}</span>${info.label}</h1>
    <div class="genre-meta">話題 ${data.stories.length}個・${sourceCount}の情報源から</div></div>`;
}

export function genrePage(edition, genreKey, context, filter) {
  const data = edition.genres[genreKey] || { stories: [], insight: {} };
  return genreHead(genreKey, data) + insightNote(data.insight, genreKey, context) + filterButtons(filter) + storyLists(data, filter);
}

function aiCards(items, render) {
  return items?.length ? `<div class="ai-grid">${items.map(render).join("")}</div>` : "";
}

export function aiPage(edition, context, filter) {
  const data = edition.genres.ai || { stories: [], insight: {} };
  const insight = data.insight || {};
  const links = (item) => storyLinks(item.story_ids, context);
  const tryCard = (item) => `<div class="try-card"><span class="try-cost">${escapeHtml(item.cost || "?")}</span><h3>${escapeHtml(item.title)}</h3>
    <p class="try-row"><b>なにもの？</b>${escapeHtml(item.what)}</p>
    <p class="try-row"><b>あなたの作業にどう効く？</b><span class="why-you">${escapeHtml(item.why_for_you)}</span></p>
    <p class="try-row"><b>試し方</b>${escapeHtml(item.how)}</p>${links(item)}</div>`;
  const modelCard = (item) => `<div class="simple-card"><b>${escapeHtml(item.name)}</b>（${escapeHtml(item.maker)}）<p>${escapeHtml(item.new)} ${links(item)}</p></div>`;
  const techniqueCard = (item) => `<div class="simple-card"><b>🪄 ${escapeHtml(item.title)}</b><p>${escapeHtml(item.how)} ${links(item)}</p></div>`;
  const moneyCard = (item) => `<div class="money-card"><div class="money-number">${escapeHtml(item.revenue)}</div>
    <div class="money-who">${escapeHtml(item.who)} — ${escapeHtml(item.what)}</div>
    <p>まねできる点：${escapeHtml(item.lesson)}</p><p><span class="confidence">確かさ：${escapeHtml(item.credibility || "?")}</span> ${links(item)}</p></div>`;
  const note = insight.overview ? `<section class="insight" style="--genre-color: var(--ai)"><div class="insight-title">🦉 Claude の所感</div>
    <p class="insight-overview">${escapeHtml(insight.overview)}</p>${momentum(insight.momentum, context)}${watchList(insight.watch)}</section>` : "";
  return genreHead("ai", data) + note
    + section("🧪 試してみよう（あなた向け）", aiCards(insight.try_list, tryCard))
    + section("🆕 新しいモデル", aiCards(insight.models, modelCard))
    + section("🪄 使い方の技", aiCards(insight.techniques, techniqueCard))
    + section("💰 AI で稼いだ人の話", aiCards(insight.money, moneyCard))
    + filterButtons(filter) + storyLists(data, filter);
}

// Claude の所感（付箋）の見た目：勢いメーター・生まれそうな議論・これからの注目・投資の見方。
import { escapeHtml, storyHref } from "./render-story.js";

const ARROWS = { up: ["arrow-up", "↑ 強まった"], down: ["arrow-down", "↓ 弱まった"], flat: ["arrow-flat", "→ 横ばい"] };
const KINDS = { person: "人", party: "政党", country: "国", company: "会社", industry: "業界", team: "チーム", player: "選手", technology: "技術" };
const VIEWS = { "追い風": "view-tail", "向かい風": "view-head", "様子見": "view-wait" };
const DEBATE_TITLES = { politics: "💬 生まれそうな議論", economy: "💬 これからの論点", tech: "💬 これからの論点", sports: "💬 話題になりそう" };

function confidence(level) {
  return level ? `<span class="confidence">自信：${escapeHtml(level)}</span>` : "";
}

// 根拠になった記事への小さなリンク（見出しの頭だけ見せる）
export function storyLinks(ids, context) {
  const links = (ids || []).map((id) => context.storiesById.get(id)).filter(Boolean).slice(0, 3)
    .map((story) => `<a class="story-link" href="${storyHref(context.date, story)}">📰 ${escapeHtml(story.headline.slice(0, 14))}…</a>`);
  return links.length ? `<span class="story-links">${links.join("")}</span>` : "";
}

export function momentum(items, context) {
  if (!items?.length) return "";
  const cards = items.map((item) => {
    const [arrowClass, arrowLabel] = ARROWS[item.direction] || ARROWS.flat;
    return `<div class="momentum-item">
      <div class="momentum-name"><span class="arrow ${arrowClass}">${arrowLabel}</span>${escapeHtml(item.name)}<span class="kind">${KINDS[item.kind] || ""}</span></div>
      <p class="momentum-reason">${escapeHtml(item.reason)} ${confidence(item.confidence)} ${storyLinks(item.story_ids, context)}</p>
    </div>`;
  });
  return `<h4>📈 勢いメーター</h4><div class="momentum">${cards.join("")}</div>`;
}

function debates(items, genre, context) {
  if (!items?.length) return "";
  const bubbles = items.map((item) => `<div class="bubble"><b>${escapeHtml(item.topic)}</b><span>${escapeHtml(item.why)} ${storyLinks(item.story_ids, context)}</span></div>`);
  return `<h4>${DEBATE_TITLES[genre] || "💬 論点"}</h4><div class="bubbles">${bubbles.join("")}</div>`;
}

export function watchList(items) {
  if (!items?.length) return "";
  const rows = items.map((item) => `<li>${item.when ? `<span class="watch-when">📅 ${escapeHtml(item.when)}</span>` : ""}<b>${escapeHtml(item.what)}</b> — ${escapeHtml(item.why)}</li>`);
  return `<h4>👀 これからの注目</h4><ul class="watch-list">${rows.join("")}</ul>`;
}

function investment(items) {
  if (!items?.length) return "";
  const rows = items.map((item) => `<li><span class="view ${VIEWS[item.view] || "view-wait"}">${escapeHtml(item.view)}</span><b>${escapeHtml(item.target)}</b> — ${escapeHtml(item.reason)} ${confidence(item.confidence)}
    <span class="invest-risk">⚖️ 反対のリスク：${escapeHtml(item.risk)}</span></li>`);
  return `<h4>🧭 投資の見方（国・業界）</h4><ul class="invest-list">${rows.join("")}</ul>
    <p class="disclaimer">※ 勉強のためのメモです。特定の商品をすすめるものではありません。</p>`;
}

export function insightNote(insight, genre, context) {
  if (!insight || !insight.overview) return "";
  return `<section class="insight" style="--genre-color: var(--${genre})">
    <div class="insight-title">🦉 Claude の所感</div>
    <p class="insight-overview">${escapeHtml(insight.overview)}</p>
    ${momentum(insight.momentum, context)}
    ${debates(insight.debates, genre, context)}
    ${investment(insight.investment)}
    ${watchList(insight.watch)}
  </section>`;
}

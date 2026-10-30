// @ts-check
/**
 * @fileoverview The dashboard's Explorer tab. The left rail holds the Rules/Guides toggle, lenses,
 * and a clickable funnel tree; the main column holds the precision map and a table grouped as a
 * work queue. Rule names show a hover card (interest invokers, with a timer-based fallback) and
 * open a detail dialog on click; the dialog also loads the ledger timeline and triage.
 *
 * Renders from the JSON in #xp-data; all derived logic lives in explorer-model.js.
 */
import { html, raw, setHtml } from './html.js';
import {
  createExplorerModel,
  findNode,
  GUIDE_STAGE,
  HIDDEN_WHEN_EMPTY,
  isGuideStage,
  isRuleStage,
  layoutMap,
  leavesOf,
  MAP_HEIGHT,
  MAP_WIDTH,
  pct,
  pctShort,
  plural,
  pp,
  QUEUE_ORDER,
  RULE_STAGE,
  THIN_MARGIN,
  TREES,
  ZOOM_FLOOR,
} from './explorer-model.js';

/** @typedef {import('./explorer-model.js').TreeNode} TreeNode */
/** @typedef {import('./explorer-model.js').StageMeta} StageMeta */
/** @typedef {import('./explorer-model.js').Tone} Tone */
/** @typedef {import('./explorer-model.js').RuleStage} RuleStage */
/** @typedef {import('../explorer-data.ts').ExplorerData} ExplorerData */
/** @typedef {import('../explorer-data.ts').ExplorerRule} ExplorerRule */
/** @typedef {import('../explorer-data.ts').JudgedSample} JudgedSample */
/** @typedef {import('../types.ts').RuleDetail} RuleDetail */

// ---- DOM lookups that fail loudly ----
/** @param {string} id */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Explorer: missing #${id}`);
  return el;
}
/** @param {string} id */
function inputById(id) {
  const el = byId(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`Explorer: #${id} is not an <input>`);
  return el;
}
/** @param {string} id */
function selectById(id) {
  const el = byId(id);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`Explorer: #${id} is not a <select>`);
  return el;
}
/** @param {string} id */
function dialogById(id) {
  const el = byId(id);
  if (!(el instanceof HTMLDialogElement)) throw new Error(`Explorer: #${id} is not a <dialog>`);
  return el;
}

/** @type {ExplorerData} */
const data = JSON.parse(byId('xp-data').textContent ?? '');
const m = createExplorerModel(data);
const { bar } = m;

/** @param {string | undefined} id */
function ruleFromId(id) {
  const rule = id === undefined ? undefined : m.ruleById.get(id);
  if (!rule) throw new Error(`Explorer: unknown rule ${String(id)}`);
  return rule;
}

/** @type {Readonly<Record<Tone, string>>} */
const TONE = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', paul: 'var(--paul)', dim: 'var(--dim)', acc: 'var(--acc)' };

/**
 * @typedef {'rules' | 'guides'} Unit
 * @type {{ unit: Unit, node: string | null, lens: string | null, guide: string | null, q: string, sort: string, zoom: boolean }}
 */
const state = { unit: 'rules', node: null, lens: 'all', guide: null, q: '', sort: 'queue', zoom: true };

// ---- Cells ----
/** @param {StageMeta} meta */
const badge = (meta) => html`<span class="stage-badge" style="--c:${raw(TONE[meta.tone])}">${meta.label}</span>`;
/** @param {ExplorerRule} r */
const suffixOf = (r) => (r.id === r.guideId ? '' : r.id.startsWith(`${r.guideId}/`) ? r.id.slice(r.guideId.length) : r.id);

/** @param {ExplorerRule} r @param {boolean} showStage */
function nameCell(r, showStage) {
  const suffix = suffixOf(r);
  const extras = [];
  if (showStage) extras.push(badge(RULE_STAGE[m.ruleStage(r)]));
  if (m.contradictions.has(r.id)) extras.push(html`<span class="chip bad" title="This rule's guide is triaged as having no legacy pattern">no-legacy guide</span>`);
  const cal = r.paulCalibration;
  if (cal) {
    const sampleMatches = cal.waveMatchesCurrentMeasurement && cal.ruleHashMatchesCurrentMeasurement;
    const label = cal.overturnedPanel && sampleMatches
      ? `Paul ${cal.paulRightCount}/${cal.totalGradedDrops} right · static ${cal.gradedWaveWithPaulStaticLegit}/${cal.gradedWaveTotalN} (${pctShort(cal.gradedWaveWithPaulStaticPrecision)})`
      : `Paul ${cal.paulRightCount}/${cal.totalGradedDrops} right`;
    extras.push(html`<span class="chip paul" title="Paul graded ${cal.paulRightCount}/${cal.totalGradedDrops} right on Wave ${cal.gradedWave} drops (${cal.deckId}, ${cal.checkedDate})">${label}</span>`);
  }
  return html`<button type="button" class="rule-link" interestfor="rule-card" data-id="${r.id}" title="${r.id}">
      <span class="rule-guide">${r.guideId}</span>${suffix ? html`<span class="rule-suffix mono">${suffix}</span>` : ''}
    </button>${extras.length ? html`<div class="rule-extras">${extras}</div>` : ''}`;
}

/** @param {ExplorerRule} r */
function yieldCell(r) {
  const width = r.heldOutYield > 0 ? Math.max(3, (Math.log10(r.heldOutYield + 1) / Math.log10(m.maxHeldOutYield + 1)) * 70) : 0;
  let note = '';
  if (r.ruleWritingYield === 0 && r.heldOutYield > 0) note = 'never fired on rule-writing';
  else if (r.yieldFlag === 'common-rw-rare-ho') note = `much rarer on held-out (rule-writing ${r.ruleWritingYield})`;
  return html`<div class="yield" title="held-out yield ${r.heldOutYield} · rule-writing yield ${r.ruleWritingYield}">
      <span class="yield-bar" style="width:${width.toFixed(0)}px"></span><span class="small">${r.heldOutYield.toLocaleString()}</span>
    </div>${note ? html`<div class="small warn-text">${note}</div>` : ''}`;
}

/** Small-n samples show each judged finding as a square: filled = legit. @param {JudgedSample} j */
function squares(j) {
  const cells = [];
  for (let i = 0; i < j.n; i++) {
    const legit = i < j.legit;
    cells.push(`<rect x="${i * 13 + 1}" y="1" width="10" height="10" rx="2" fill="${legit ? 'var(--ok)' : 'transparent'}" stroke="${legit ? 'var(--ok)' : 'var(--bad)'}" stroke-width="1.5"/>`);
  }
  const svg = `<svg width="${j.n * 13 + 2}" height="12" aria-hidden="true">${cells.join('')}</svg>`;
  return html`<div class="squares" title="${j.legit} of ${j.n} judged findings legit (filled = legit)">${raw(svg)}<span class="small">${j.legit}/${j.n} legit</span></div>`;
}

const GLYPH_WIDTH = 170;
/**
 * Two tracks (static, post-verifier) on a 40–100% axis: the shaded zone passes, the notch is the
 * applicable bar, the faint line is the 95% CI, and a filled dot means the value passes.
 * @param {JudgedSample} j
 */
function glyph(j) {
  const W = GLYPH_WIDTH;
  /** @param {number} v */
  const X = (v) => ((Math.max(ZOOM_FLOOR, Math.min(1, v)) - ZOOM_FLOOR) / (1 - ZOOM_FLOOR)) * W;
  const staticBar = m.staticBarFor(j.n);
  const keptNone = j.kept === 0;
  /** @param {number} y @param {number} v @param {number} lo @param {number} hi @param {number} threshold @param {boolean} undefinedValue */
  const track = (y, v, lo, hi, threshold, undefinedValue) => {
    const pass = !undefinedValue && v >= threshold;
    const color = undefinedValue ? TONE.dim : pass ? TONE.ok : TONE.bad;
    const marker = undefinedValue || v < ZOOM_FLOOR
      ? `<path d="M8 ${y - 4} L3 ${y} L8 ${y + 4}" fill="none" stroke="${color}" stroke-width="2"/>`
      : `<circle cx="${X(v).toFixed(1)}" cy="${y}" r="4" fill="${pass ? color : 'var(--surface)'}" stroke="${color}" stroke-width="2"/>`;
    const interval = undefinedValue ? '' : `<line x1="${X(lo).toFixed(1)}" x2="${X(hi).toFixed(1)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>`;
    return `<rect class="zone" x="${X(threshold).toFixed(1)}" y="${y - 5}" width="${(W - X(threshold)).toFixed(1)}" height="10" rx="2"/>`
      + `<line class="trk" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`
      + interval
      + `<line class="notch" x1="${X(threshold).toFixed(1)}" x2="${X(threshold).toFixed(1)}" y1="${y - 7}" y2="${y + 7}"/>`
      + marker;
  };
  const postText = keptNone ? 'post-verifier undefined (the verifier kept none)' : `post-verifier ${pct(j.postVerifier.value)} (95% CI ${pct(j.postVerifier.lower)}–${pct(j.postVerifier.upper)}, kept ${j.kept})`;
  const label = `Static ${pct(j.staticMatcher.value)} (95% CI ${pct(j.staticMatcher.lower)}–${pct(j.staticMatcher.upper)}, n ${j.n}, bar ${pctShort(staticBar)}); ${postText}, bar ${pctShort(bar.postVerifierPrecision)}. Axis 40–100%.`;
  const svg = `<svg width="${W + 4}" height="34" viewBox="-2 0 ${W + 4} 34" aria-hidden="true">`
    + track(10, j.staticMatcher.value, j.staticMatcher.lower, j.staticMatcher.upper, staticBar, false)
    + track(25, j.postVerifier.value, j.postVerifier.lower, j.postVerifier.upper, bar.postVerifierPrecision, keptNone)
    + '</svg>';
  const delta = Math.round((j.postVerifier.value - j.staticMatcher.value) * 100);
  const rareBar = staticBar === bar.standard.staticMatcherPrecision ? '' : ` · bar ${pctShort(staticBar)}`;
  return html`<div class="glyph" role="img" aria-label="${label}" title="${label}">${raw(svg)}<div class="glyph-text">
      <div>S ${pct(j.staticMatcher.value)} <span class="muted">n ${j.n}${rareBar}</span></div>
      <div>${keptNone ? html`P — <span class="muted">verifier kept none</span>` : html`P ${pct(j.postVerifier.value)}${Math.abs(delta) >= 1 ? html` <span class="muted">verifier ${delta > 0 ? '+' : ''}${delta} pp</span>` : ''}`}</div>
    </div></div>`;
}

/** @param {ExplorerRule} r */
function precisionCell(r) {
  if (r.measurementStatus === 'zero') return html`<span class="small muted">no held-out findings</span>`;
  if (r.measurementStatus === 'too few to measure') return html`<span class="small muted">not judged · held-out yield ${r.heldOutYield}</span>`;
  if (r.judged === null) return html`<span class="small muted">not judged yet · held-out yield ${r.heldOutYield}</span>`;
  if (r.judged.n < bar.rarePattern.minN) return squares(r.judged);
  return glyph(r.judged);
}

/** @param {ExplorerRule} r */
function nextCell(r) {
  const st = m.ruleStage(r);
  const j = r.judged;
  if (st === 'disagreement') return html`<span class="chip bad">status disagreement</span><div class="small">${r.disagreement ?? 'The healthcheck flags this rule.'}</div>`;
  if (st === 'scopeHold') return html`<span class="chip paul">Paul's call</span><div class="small muted clamp-2" title="${r.ledgerNote ?? ''}">${r.ledgerNote ?? 'no reason recorded'}</div>`;
  if (j !== null && st === 'qualified') {
    return m.margin(j) < THIN_MARGIN
      ? html`<span class="chip warn">thin margin</span><div class="small">${m.marginText(j)}</div>`
      : html`<span class="small muted">Margin +${pp(m.margin(j))} over the bar</span>`;
  }
  if (j !== null && (st === 'unlikely' || (st === 'tooFewToQualify' && m.isUnlikely(r)))) {
    const detail = st === 'unlikely' ? `static at most ${pctShort(j.staticMatcher.upper)} even optimistically; rewrite or retire (Paul's call)` : `${j.legit}/${j.n} legit so far`;
    return html`<span class="chip bad">unlikely to qualify</span><div class="small">${detail}</div>`;
  }
  if (j !== null && st === 'withinReach') {
    const ps = m.paths(j);
    const best = ps.reduce((a, b) => (m.gapOf(a) <= m.gapOf(b) ? a : b));
    const chips = [];
    if (best.staticGap > 0) chips.push(html`<span class="chip">tune matcher</span>`);
    if (best.postGap > 0) chips.push(html`<span class="chip">tune rubric</span>`);
    if (best.needN > 0) chips.push(html`<span class="chip">more data</span>`);
    const lines = ps.length === 1
      ? html`<div class="small">Needs ${m.describePath(ps[0])}</div>`
      : ps.map((p) => html`<div class="small"><span class="muted">${m.pathLabel(p)}</span> ${m.describePath(p)}</div>`);
    return html`<div>${chips}</div>${lines}`;
  }
  return html`<span class="small muted">${m.nextText(r)}</span>`;
}

/** @param {ExplorerRule} r @param {boolean} showStage */
const ruleRow = (r, showStage) => html`<tr data-id="${r.id}">
    <td class="rule-cell">${nameCell(r, showStage)}</td>
    <td>${yieldCell(r)}</td>
    <td>${precisionCell(r)}</td>
    <td>${nextCell(r)}</td>
  </tr>`;

/** @param {RuleStage} st @param {number} count */
function groupRow(st, count) {
  const meta = RULE_STAGE[st];
  return html`<tr class="grp"><td colspan="4">${badge(meta)} <span class="fw-600">${count}</span> <span class="muted">· ${meta.desc}</span></td></tr>`;
}

/** @param {string} g */
function guideRow(g) {
  const rs = m.rulesByGuide.get(g) ?? [];
  const dots = rs.map((r) => {
    const meta = RULE_STAGE[m.ruleStage(r)];
    return html`<span class="rule-dot" style="background:${raw(TONE[meta.tone])}" title="${r.id}: ${meta.label}"></span>`;
  });
  const flagged = m.guideStage(g) === 'noLegacyPattern' && rs.length > 0;
  return html`<tr data-guide="${g}">
    <td><button type="button" class="guide-link" data-guide="${g}" title="${g}">${g}</button></td>
    <td>${badge(GUIDE_STAGE[m.guideStage(g)])}</td>
    <td class="nowrap">${rs.length ? html`${dots}<span class="small muted rule-count">${rs.length}</span>` : html`<span class="small muted">—</span>`}</td>
    <td class="small">${data.guides.detection[g] ?? (m.guideStage(g) === 'stub' ? 'stub' : '—')}</td>
    <td class="small">${flagged ? html`<span class="chip bad">contradiction</span>` : ''}${m.guideNote(g)}</td>
  </tr>`;
}

// ---- Left rail ----
/** @param {Unit} unit */
const treeOf = (unit) => (unit === 'rules' ? TREES.rules : TREES.guides);

function renderTree() {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const items = state.unit === 'rules' ? m.rules.map(m.ruleStage) : m.allGuides.map(m.guideStage);
  for (const stage of items) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  const total = items.length;
  /** @param {TreeNode} node */
  const countOf = (node) => leavesOf(node).reduce((n, id) => n + (counts.get(id) ?? 0), 0);
  /** @param {string} id @returns {StageMeta | undefined} */
  const metaOf = (id) => {
    if (state.unit === 'rules') return isRuleStage(id) ? RULE_STAGE[id] : undefined;
    return isGuideStage(id) ? GUIDE_STAGE[id] : undefined;
  };
  /** @type {import('./html.js').SafeHtml[]} */
  const rows = [];
  /** @param {TreeNode} node @param {number} depth */
  const walk = (node, depth) => {
    const c = countOf(node);
    if (HIDDEN_WHEN_EMPTY.has(node.id) && c === 0) return;
    const meta = metaOf(node.id);
    const label = node.label ?? meta?.label ?? node.id;
    const tone = meta ? TONE[meta.tone] : TONE.acc;
    const pressed = state.node === node.id || (state.node === null && depth === 0 && (state.unit === 'guides' || state.lens === 'all'));
    const width = c === 0 ? 0 : Math.max(2, (100 * c) / total);
    rows.push(html`<button type="button" class="node" style="padding-left:${8 + depth * 14}px; --c:${raw(tone)}" data-node="${node.id}" aria-pressed="${String(pressed)}">
        <span class="${node.children ? 'node-label fw-600' : 'node-label'}">${label}</span><span class="small muted">${c}</span>
        <span class="bar"><span style="width:${width.toFixed(1)}%"></span></span>
      </button>`);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(treeOf(state.unit), 0);
  setHtml(byId('xp-tree'), html`${rows}`);
  const unaccounted = counts.get('unaccounted') ?? 0;
  const noun = state.unit === 'rules' ? 'rule' : 'guide';
  setHtml(byId('xp-reconcile'), unaccounted === 0
    ? html`<span class="ok-text">✓</span> Every ${noun} sits in exactly one stage (${total} of ${total}).`
    : html`<span class="bad-text">⚠ ${plural(unaccounted, noun)} unaccounted</span> (${total - unaccounted} of ${total} placed).`);
}

function renderLenses() {
  byId('xp-lenses').hidden = state.unit !== 'rules';
  setHtml(byId('xp-lens-buttons'), html`${m.lenses.map((l) => html`<button type="button" class="lens" data-lens="${l.id}" aria-pressed="${String(state.node === null && state.lens === l.id)}">${l.label} <span class="muted">${m.rules.filter(l.filter).length}</span></button>`)}`);
}

function renderSortOptions() {
  const sorts = state.unit === 'rules' ? m.ruleSorts : m.guideSorts;
  const select = selectById('xp-sort');
  setHtml(select, html`${Object.entries(sorts).map(([id, s]) => html`<option value="${id}">Sort: ${s.label}</option>`)}`);
  select.value = state.sort;
}

// ---- Main column ----
function filteredRules() {
  let list = m.rules;
  if (state.node) {
    const node = findNode(treeOf('rules'), state.node);
    const leaves = new Set(node ? leavesOf(node) : []);
    list = list.filter((r) => leaves.has(m.ruleStage(r)));
  } else if (state.lens) {
    const lens = m.lenses.find((l) => l.id === state.lens);
    if (lens) list = list.filter(lens.filter);
  }
  if (state.guide) {
    const guide = state.guide;
    list = list.filter((r) => r.guideId === guide);
  }
  if (state.q) {
    const q = state.q.toLowerCase();
    list = list.filter((r) => r.id.toLowerCase().includes(q) || r.guideId.toLowerCase().includes(q));
  }
  return list;
}

function filteredGuides() {
  let list = m.allGuides;
  if (state.node) {
    const node = findNode(treeOf('guides'), state.node);
    const leaves = new Set(node ? leavesOf(node) : []);
    list = list.filter((g) => leaves.has(m.guideStage(g)));
  }
  if (state.q) {
    const q = state.q.toLowerCase();
    list = list.filter((g) => g.toLowerCase().includes(q));
  }
  const sort = Object.entries(m.guideSorts).find(([id]) => id === state.sort)?.[1] ?? m.guideSorts.stage;
  return [...list].sort(sort.cmp);
}

const ZOOM_ANIMATION_DURATION = 450;
const ZOOM_ANIMATION_EASING = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let lastRenderedZoom = state.zoom;

/**
 * Records current positions and elements in #xp-map before re-rendering.
 * @param {SVGSVGElement} svg
 */
function recordMapPositions(svg) {
  const dots = new Map();
  for (const dot of svg.querySelectorAll('circle.dot[data-id]')) {
    const id = dot.dataset.id;
    if (id) {
      dots.set(id, {
        el: dot.cloneNode(true),
        cx: parseFloat(dot.getAttribute('cx') || '0'),
        cy: parseFloat(dot.getAttribute('cy') || '0'),
      });
    }
  }

  const gridX = new Map();
  for (const line of svg.querySelectorAll('line[data-grid-x]')) {
    const v = line.dataset.gridX;
    if (v) gridX.set(v, parseFloat(line.getAttribute('x1') || '0'));
  }

  const gridY = new Map();
  for (const line of svg.querySelectorAll('line[data-grid-y]')) {
    const v = line.dataset.gridY;
    if (v) gridY.set(v, parseFloat(line.getAttribute('y1') || '0'));
  }

  const tickX = new Map();
  for (const text of svg.querySelectorAll('text[data-tick-x]')) {
    const v = text.dataset.tickX;
    if (v) {
      tickX.set(v, {
        x: parseFloat(text.getAttribute('x') || '0'),
        y: parseFloat(text.getAttribute('y') || '0'),
      });
    }
  }

  const tickY = new Map();
  for (const text of svg.querySelectorAll('text[data-tick-y]')) {
    const v = text.dataset.tickY;
    if (v) {
      tickY.set(v, {
        x: parseFloat(text.getAttribute('x') || '0'),
        y: parseFloat(text.getAttribute('y') || '0'),
      });
    }
  }

  const thr = new Map();
  for (const line of svg.querySelectorAll('line[data-thr]')) {
    const id = line.dataset.thr;
    if (id) {
      thr.set(id, {
        x1: parseFloat(line.getAttribute('x1') || '0'),
        y1: parseFloat(line.getAttribute('y1') || '0'),
      });
    }
  }

  const thrLabels = new Map();
  for (const text of svg.querySelectorAll('text[data-thr-label]')) {
    const id = text.dataset.thrLabel;
    if (id) {
      thrLabels.set(id, {
        x: parseFloat(text.getAttribute('x') || '0'),
        y: parseFloat(text.getAttribute('y') || '0'),
      });
    }
  }

  const axisTitles = new Map();
  for (const text of svg.querySelectorAll('text[data-axis-title]')) {
    const id = text.dataset.axisTitle;
    if (id) {
      axisTitles.set(id, {
        x: parseFloat(text.getAttribute('x') || '0'),
        y: parseFloat(text.getAttribute('y') || '0'),
      });
    }
  }

  const gutters = [...svg.querySelectorAll('[data-gutter]')].map((el) => el.cloneNode(true));
  const gutterLabels = [...svg.querySelectorAll('[data-gutter-label]')].map((el) => el.cloneNode(true));
  const cornerEl = svg.querySelector('[data-corner]');
  const cornerClone = cornerEl ? cornerEl.cloneNode(true) : null;

  let cornerCenter = null;
  if (cornerEl) {
    const circle = cornerEl.querySelector('circle.corner');
    if (circle) {
      cornerCenter = {
        x: parseFloat(circle.getAttribute('cx') || '0'),
        y: parseFloat(circle.getAttribute('cy') || '0'),
      };
    }
  }

  const exitingTicks = [];
  for (const line of svg.querySelectorAll('line[data-grid-x], line[data-grid-y]')) {
    const v = parseInt(line.dataset.gridX || line.dataset.gridY || '100', 10);
    if (v < 40) exitingTicks.push(line.cloneNode(true));
  }
  for (const text of svg.querySelectorAll('text[data-tick-x], text[data-tick-y]')) {
    const v = parseInt(text.dataset.tickX || text.dataset.tickY || '100', 10);
    if (v < 40) exitingTicks.push(text.cloneNode(true));
  }

  return {
    dots,
    gridX,
    gridY,
    tickX,
    tickY,
    thr,
    thrLabels,
    axisTitles,
    gutters,
    gutterLabels,
    cornerClone,
    cornerCenter,
    exitingTicks,
  };
}

/**
 * Animates elements in #xp-map between previous and new layout.
 * @param {SVGSVGElement} svg
 * @param {ReturnType<typeof recordMapPositions>} prev
 * @param {ReturnType<typeof layoutMap>} L
 */
function animateMapZoom(svg, prev, L) {
  const exitLayer = svg.querySelector('#xp-exit-layer');

  // 1. Exiting elements placed in exitLayer to fade out
  if (exitLayer) {
    if (!L.gutter) {
      // Zooming out: old gutters and corner bubble fade out
      for (const el of [...prev.gutters, ...prev.gutterLabels]) {
        exitLayer.appendChild(el);
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
          fill: 'forwards',
        });
        a.onfinish = () => el.remove();
      }
      if (prev.cornerClone) {
        exitLayer.appendChild(prev.cornerClone);
        const a = prev.cornerClone.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
          fill: 'forwards',
        });
        a.onfinish = () => prev.cornerClone.remove();
      }
    } else {
      // Zooming in: ticks < 40% disappear
      for (const el of prev.exitingTicks) {
        exitLayer.appendChild(el);
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
          fill: 'forwards',
        });
        a.onfinish = () => el.remove();
      }
      // Any dot that collapsed into corner bubble
      for (const [id, oldDot] of prev.dots) {
        if (!svg.querySelector(`circle.dot[data-id="${id}"]`)) {
          const clone = oldDot.el;
          exitLayer.appendChild(clone);
          const dx = L.gutterCenterX - oldDot.cx;
          const dy = L.gutterCenterY - oldDot.cy;
          const a = clone.animate([
            { transform: 'translate(0px, 0px)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
          ], {
            duration: ZOOM_ANIMATION_DURATION,
            easing: ZOOM_ANIMATION_EASING,
            fill: 'forwards',
          });
          a.onfinish = () => clone.remove();
        }
      }
    }
  }

  // 2. Entering elements in new layout fade in
  if (L.gutter) {
    for (const el of svg.querySelectorAll('[data-gutter], [data-gutter-label], [data-corner]')) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ZOOM_ANIMATION_DURATION,
        easing: ZOOM_ANIMATION_EASING,
      });
    }
  } else {
    for (const el of svg.querySelectorAll('line[data-grid-x], line[data-grid-y], text[data-tick-x], text[data-tick-y]')) {
      const v = parseInt(el.dataset.gridX || el.dataset.gridY || el.dataset.tickX || el.dataset.tickY || '100', 10);
      if (v < 40) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // 3. Persistent elements: FLIP translates
  // Dots
  for (const dot of svg.querySelectorAll('circle.dot[data-id]')) {
    const id = dot.dataset.id;
    const newCx = parseFloat(dot.getAttribute('cx') || '0');
    const newCy = parseFloat(dot.getAttribute('cy') || '0');
    const old = prev.dots.get(id);
    if (old) {
      const dx = old.cx - newCx;
      const dy = old.cy - newCy;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        dot.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    } else if (prev.cornerCenter) {
      const dx = prev.cornerCenter.x - newCx;
      const dy = prev.cornerCenter.y - newCy;
      dot.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        { transform: 'translate(0px, 0px)', opacity: 1 },
      ], {
        duration: ZOOM_ANIMATION_DURATION,
        easing: ZOOM_ANIMATION_EASING,
      });
    }
  }

  // Grid X
  for (const line of svg.querySelectorAll('line[data-grid-x]')) {
    const v = line.dataset.gridX;
    const oldX = prev.gridX.get(v);
    if (oldX !== undefined) {
      const newX = parseFloat(line.getAttribute('x1') || '0');
      const dx = oldX - newX;
      if (Math.abs(dx) > 0.1) {
        line.animate([
          { transform: `translate(${dx}px, 0px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Grid Y
  for (const line of svg.querySelectorAll('line[data-grid-y]')) {
    const v = line.dataset.gridY;
    const oldY = prev.gridY.get(v);
    if (oldY !== undefined) {
      const newY = parseFloat(line.getAttribute('y1') || '0');
      const dy = oldY - newY;
      if (Math.abs(dy) > 0.1) {
        line.animate([
          { transform: `translate(0px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Tick X
  for (const text of svg.querySelectorAll('text[data-tick-x]')) {
    const v = text.dataset.tickX;
    const old = prev.tickX.get(v);
    if (old) {
      const newX = parseFloat(text.getAttribute('x') || '0');
      const dx = old.x - newX;
      if (Math.abs(dx) > 0.1) {
        text.animate([
          { transform: `translate(${dx}px, 0px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Tick Y
  for (const text of svg.querySelectorAll('text[data-tick-y]')) {
    const v = text.dataset.tickY;
    const old = prev.tickY.get(v);
    if (old) {
      const newY = parseFloat(text.getAttribute('y') || '0');
      const dy = old.y - newY;
      if (Math.abs(dy) > 0.1) {
        text.animate([
          { transform: `translate(0px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Threshold lines
  for (const line of svg.querySelectorAll('line[data-thr]')) {
    const id = line.dataset.thr;
    const old = prev.thr.get(id);
    if (old) {
      const newX1 = parseFloat(line.getAttribute('x1') || '0');
      const newY1 = parseFloat(line.getAttribute('y1') || '0');
      const dx = old.x1 - newX1;
      const dy = old.y1 - newY1;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        line.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Threshold labels
  for (const text of svg.querySelectorAll('text[data-thr-label]')) {
    const id = text.dataset.thrLabel;
    const old = prev.thrLabels.get(id);
    if (old) {
      const newX = parseFloat(text.getAttribute('x') || '0');
      const newY = parseFloat(text.getAttribute('y') || '0');
      const dx = old.x - newX;
      const dy = old.y - newY;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        text.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }

  // Axis titles
  for (const text of svg.querySelectorAll('text[data-axis-title]')) {
    const id = text.dataset.axisTitle;
    const old = prev.axisTitles.get(id);
    if (old) {
      const newX = parseFloat(text.getAttribute('x') || '0');
      const dx = old.x - newX;
      if (Math.abs(dx) > 0.1) {
        text.animate([
          { transform: `translate(${dx}px, 0px)` },
          { transform: 'translate(0px, 0px)' },
        ], {
          duration: ZOOM_ANIMATION_DURATION,
          easing: ZOOM_ANIMATION_EASING,
        });
      }
    }
  }
}

/** @param {readonly ExplorerRule[]} list */
function renderMap(list) {
  const mapCard = byId('xp-map-card');
  const plottable = list.filter((r) => r.judged !== null && r.judged.n >= bar.rarePattern.minN);
  mapCard.hidden = state.unit !== 'rules' || plottable.length === 0;
  if (mapCard.hidden) return;

  const svg = byId('xp-map');
  const shouldAnimate = lastRenderedZoom !== state.zoom && !prefersReducedMotion() && svg.children.length > 0;
  const prevPositions = shouldAnimate ? recordMapPositions(svg) : null;
  lastRenderedZoom = state.zoom;
  if (shouldAnimate) {
    hideTip();
    hideTrail();
  }

  const L = layoutMap(plottable, state.zoom);
  const { margins: mg, gutter: gut, x0, x1, y0, y1, fx, fy } = L;
  const H = MAP_HEIGHT;
  const out = [];
  if (gut) {
    out.push(`<rect class="gutter" data-gutter="y" x="${mg.left}" y="${y0}" width="${gut - 4}" height="${H - mg.bottom - y0}"/>`);
    out.push(`<rect class="gutter" data-gutter="x" x="${mg.left}" y="${y1 + 4}" width="${x1 + 8 - mg.left}" height="${gut - 4}"/>`);
    out.push(`<text class="axis" data-gutter-label="x" x="${L.gutterCenterX}" y="${H - mg.bottom + 30}" text-anchor="middle">&lt;${pctShort(ZOOM_FLOOR)}</text>`);
    out.push(`<text class="axis" data-gutter-label="y" x="${mg.left - 6}" y="${L.gutterCenterY + 4}" text-anchor="end">&lt;${pctShort(ZOOM_FLOOR)}</text>`);
  }
  for (let i = 0; i <= Math.round((1 - L.floor) * 10); i++) {
    const t = Math.round((L.floor + i / 10) * 100) / 100;
    const p = Math.round(t * 100);
    out.push(`<line class="grid" data-grid-x="${p}" x1="${fx(t)}" x2="${fx(t)}" y1="${y0}" y2="${y1}"/>`);
    out.push(`<line class="grid" data-grid-y="${p}" x1="${x0}" x2="${x1}" y1="${fy(t)}" y2="${fy(t)}"/>`);
    out.push(`<text class="axis" data-tick-x="${p}" x="${fx(t)}" y="${H - mg.bottom + 16}" text-anchor="middle">${p}%</text>`);
    out.push(`<text class="axis" data-tick-y="${p}" x="${mg.left - 6}" y="${fy(t) + 4}" text-anchor="end">${p}%</text>`);
  }
  const std = bar.standard;
  const rare = bar.rarePattern;
  out.push(`<text class="axis" data-axis-title="x" x="${(x0 + x1) / 2}" y="${H - 8}" text-anchor="middle">Static matcher precision →</text>`);
  out.push(`<text class="axis" data-axis-title="y" transform="translate(14 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Post-verifier precision →</text>`);
  out.push(`<line class="thr" data-thr="std" x1="${fx(std.staticMatcherPrecision)}" x2="${fx(std.staticMatcherPrecision)}" y1="${y0 - 6}" y2="${y1}"/>`);
  out.push(`<line class="thr2" data-thr="rare" x1="${fx(rare.staticMatcherPrecision)}" x2="${fx(rare.staticMatcherPrecision)}" y1="${y0 - 6}" y2="${y1}"/>`);
  out.push(`<line class="thr" data-thr="post" x1="${x0}" x2="${x1 + 10}" y1="${fy(bar.postVerifierPrecision)}" y2="${fy(bar.postVerifierPrecision)}"/>`);
  out.push(`<text class="axis" data-thr-label="std" x="${fx(std.staticMatcherPrecision) - 4}" y="${y0 - 18}" text-anchor="end">static bar ${pctShort(std.staticMatcherPrecision)} (n ≥ ${std.minN})</text>`);
  out.push(`<text class="axis" data-thr-label="rare" x="${fx(rare.staticMatcherPrecision) + 4}" y="${y0 - 18}" text-anchor="start">${pctShort(rare.staticMatcherPrecision)} (n ${rare.minN}–${std.minN - 1})</text>`);
  out.push(`<text class="axis" data-thr-label="post-1" x="${x1 + 16}" y="${fy(bar.postVerifierPrecision) - 2}">post-verifier</text>`);
  out.push(`<text class="axis" data-thr-label="post-2" x="${x1 + 16}" y="${fy(bar.postVerifierPrecision) + 13}">bar ${pctShort(bar.postVerifierPrecision)}</text>`);

  out.push(`<defs>
    <marker id="trail-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 1 L 6 4 L 1 7" fill="none" stroke="var(--dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>`);
  out.push('<g id="xp-trail-layer"></g>');
  out.push('<g id="xp-exit-layer" style="pointer-events: none;"></g>');

  if (L.corner.length) {
    const title = `${plural(L.corner.length, 'rule')} below ${pctShort(ZOOM_FLOOR)} on both axes: ${L.corner.map((r) => r.id).join(', ')}`;
    out.push(html`<g class="corner-group" data-corner="bubble"><title>${title}</title><circle cx="${L.gutterCenterX}" cy="${L.gutterCenterY}" r="11" class="corner"/><text x="${L.gutterCenterX}" y="${L.gutterCenterY + 4}" text-anchor="middle" class="corner-count">${L.corner.length}</text></g>`.value);
  }
  for (const dot of L.dots) {
    const st = m.ruleStage(dot.rule);
    const color = TONE[RULE_STAGE[st].tone];
    const hollow = st === 'declined';
    const opacity = Math.min(0.9, 0.35 + dot.judged.n / 40).toFixed(2);
    const label = `${dot.rule.id}: static ${pct(dot.judged.staticMatcher.value)}, post-verifier ${pct(dot.judged.postVerifier.value)}, n ${dot.judged.n}`;
    out.push(html`<circle class="dot" data-id="${dot.rule.id}" cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}" r="${dot.radius.toFixed(1)}" fill="${hollow ? 'transparent' : raw(color)}" fill-opacity="${opacity}" stroke="${raw(color)}" stroke-width="1.5" tabindex="0" role="button" aria-label="${label}"/>`.value);
  }

  svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  setHtml(svg, raw(out.join('')));
  mapDotsById = new Map(L.dots.map((d) => [d.rule.id, d]));

  if (prevPositions) {
    animateMapZoom(svg, prevPositions, L);
  }
}

function renderList() {
  const thead = byId('xp-thead');
  const tbody = byId('xp-tbody');
  const cols = byId('xp-cols');
  const title = byId('xp-list-title');
  const sub = byId('xp-list-sub');
  if (state.unit === 'rules') {
    const list = filteredRules();
    renderMap(list);
    setHtml(cols, html`<col style="width:27%"><col style="width:13%"><col style="width:31%"><col style="width:29%">`);
    setHtml(thead, html`<tr><th>Rule</th><th>Held-out yield</th><th>Precision <span class="fw-400">(S static · P post-verifier · shaded = passes)</span></th><th>Next step</th></tr>`);
    let rows;
    if (state.sort === 'queue') {
      rows = QUEUE_ORDER.flatMap((st) => {
        const items = list.filter((r) => m.ruleStage(r) === st).sort(m.within[st]);
        return items.length ? [groupRow(st, items.length), ...items.map((r) => ruleRow(r, false))] : [];
      });
    } else {
      const sort = Object.entries(m.ruleSorts).find(([id]) => id === state.sort)?.[1] ?? m.ruleSorts.name;
      rows = [...list].sort(sort.cmp ?? undefined).map((r) => ruleRow(r, true));
    }
    setHtml(tbody, rows.length ? html`${rows}` : html`<tr><td colspan="4" class="empty">No rules in this view.</td></tr>`);
    const count = plural(list.length, 'rule');
    if (state.guide) {
      title.textContent = `Rules for ${state.guide} · ${count}`;
      setHtml(sub, html`Drilled in from the guides view. <button type="button" class="text-button" data-clear-guide>Show all rules</button>`);
    } else if (state.node) {
      const node = findNode(treeOf('rules'), state.node);
      const label = node?.label ?? (node && isRuleStage(node.id) ? RULE_STAGE[node.id].label : 'Stage');
      title.textContent = `${label} · ${count}`;
      sub.textContent = 'Funnel stage';
    } else {
      const lens = m.lenses.find((x) => x.id === state.lens) ?? m.lenses[0];
      title.textContent = `${lens.label} · ${count}`;
      sub.textContent = lens.sub;
    }
  } else {
    const list = filteredGuides();
    renderMap([]);
    setHtml(cols, html`<col style="width:30%"><col style="width:18%"><col style="width:16%"><col style="width:12%"><col style="width:24%">`);
    setHtml(thead, html`<tr><th>Guide</th><th>Stage</th><th>Rules</th><th>Detection</th><th>Note</th></tr>`);
    setHtml(tbody, list.length ? html`${list.map(guideRow)}` : html`<tr><td colspan="5" class="empty">No guides in this view.</td></tr>`);
    const node = state.node ? findNode(treeOf('guides'), state.node) : null;
    const label = node?.label ?? (node && isGuideStage(node.id) ? GUIDE_STAGE[node.id].label : TREES.guides.label);
    title.textContent = `${label} · ${plural(list.length, 'guide')}`;
    sub.textContent = 'Click a guide with rules to see them in the rules view.';
  }
}

function render() {
  for (const b of document.querySelectorAll('[data-unit]')) b.setAttribute('aria-pressed', String(b instanceof HTMLElement && b.dataset.unit === state.unit));
  renderLenses();
  renderTree();
  renderSortOptions();
  renderList();
}

// ---- Rule detail (shared by the hover card and the dialog) ----
/** @param {ExplorerRule} r */
function paulCalibrationHtml(r) {
  const cal = r.paulCalibration;
  if (!cal) return html``;
  const sampleMatches = cal.waveMatchesCurrentMeasurement && cal.ruleHashMatchesCurrentMeasurement;
  const gradesList = [
    `${cal.paulRightCount}/${cal.totalGradedDrops} right`,
    ...(cal.paulNonTargetCount > 0 ? [`${cal.paulNonTargetCount}/${cal.totalGradedDrops} not-old-pattern`] : []),
  ].join(', ');
  const bothStatic = cal.overturnedPanel && sampleMatches
    ? html`<div class="small">Overturned panel on Wave ${cal.gradedWave} drops: static is <strong>${cal.gradedWavePanelStaticLegit}/${cal.gradedWaveTotalN} (${pct(cal.gradedWavePanelStaticPrecision)})</strong> by the panel and <strong>${cal.gradedWaveWithPaulStaticLegit}/${cal.gradedWaveTotalN} (${pct(cal.gradedWaveWithPaulStaticPrecision)})</strong> with Paul’s grades (95% CI ${pct(cal.gradedWaveWithPaulStaticWilson95.lower)}–${pct(cal.gradedWaveWithPaulStaticWilson95.upper)}).</div>`
    : '';
  const waveMismatch = !sampleMatches
    ? html`<div class="small warn-text">Scoped to Wave ${cal.gradedWave} verifier drops; current rule metrics above are from Wave ${cal.currentWave ?? 'latest'} (not mixed).</div>`
    : '';
  return html`
    <dt>Paul’s grades</dt>
    <dd>
      <div><strong>${gradesList}</strong> on Wave ${cal.gradedWave} verifier drops (<code>${cal.deckId}</code>, ${cal.checkedDate})</div>
      ${bothStatic}
      ${waveMismatch}
    </dd>`;
}

/** @param {ExplorerRule} r */
function ruleDetailHtml(r) {
  const j = r.judged;
  const cal = r.paulCalibration;
  const sampleMatches = Boolean(cal && cal.waveMatchesCurrentMeasurement && cal.ruleHashMatchesCurrentMeasurement);
  const staticDd = j
    ? cal && cal.overturnedPanel && sampleMatches
      ? html`${j.legit}/${j.n} (${pct(j.staticMatcher.value)}) by panel (95% CI ${pct(j.staticMatcher.lower)}–${pct(j.staticMatcher.upper)}) · <strong>${cal.gradedWaveWithPaulStaticLegit}/${cal.gradedWaveTotalN} (${pct(cal.gradedWaveWithPaulStaticPrecision)}) with Paul’s grades</strong> (95% CI ${pct(cal.gradedWaveWithPaulStaticWilson95.lower)}–${pct(cal.gradedWaveWithPaulStaticWilson95.upper)})`
      : html`${pct(j.staticMatcher.value)} (${j.legit}/${j.n} judged legit) · 95% CI ${pct(j.staticMatcher.lower)}–${pct(j.staticMatcher.upper)}`
    : '';
  const trail = r.trail ?? [];
  const historyRow = trail.length > 0
    ? html`<dt>History</dt><dd class="history-list">${[
        ...trail.map((pt) => {
          const label = pt.wave ? `Wave ${pt.wave}` : pt.date;
          return html`<div>${label}: static ${pct(pt.staticPrecision)}, post ${pct(pt.postVerifierPrecision)} (n ${pt.n})</div>`;
        }),
        j ? html`<div><strong>${r.wave ? `Wave ${r.wave} (current)` : 'Current'}: static ${pct(j.staticMatcher.value)}, post ${pct(j.postVerifier.value)} (n ${j.n})</strong></div>` : '',
      ]}</dd>`
    : '';
  return html`
    <div class="detail-badges">${badge(RULE_STAGE[m.ruleStage(r)])}${m.contradictions.has(r.id) ? html`<span class="chip bad">guide triaged as no legacy pattern</span>` : ''}${cal ? html`<span class="chip paul">Paul ${cal.paulRightCount}/${cal.totalGradedDrops} right (${cal.checkedDate})</span>` : ''}</div>
    ${j ? html`<div class="detail-precision">${precisionCell(r)}</div>` : ''}
    <dl class="kv">
      <dt>Yield</dt><dd>held-out ${r.heldOutYield} · rule-writing ${r.ruleWritingYield}${r.yieldFlag !== 'ok' ? ` · flag: ${r.yieldFlag}` : ''}</dd>
      ${j ? html`
        <dt>Static precision</dt><dd>${staticDd}</dd>
        <dt>Post-verifier precision</dt><dd>${j.kept === 0 ? 'undefined: the verifier kept none of the judged findings' : `${pct(j.postVerifier.value)} (${j.keptLegit}/${j.kept} kept by the verifier) · 95% CI ${pct(j.postVerifier.lower)}–${pct(j.postVerifier.upper)}`}</dd>
        <dt>Verifier drops</dt><dd>${plural(j.legitDropped, 'legit finding')} dropped · ${plural(j.nonLegitDropped, 'non-legit finding')} dropped</dd>
        <dt>Judge disagreements</dt><dd>${j.judgeDisagreements}</dd>` : ''}
      ${historyRow}
      ${paulCalibrationHtml(r)}
      <dt>Applicable bar</dt><dd>${m.applicableBar(r)}</dd>
      <dt>Next step</dt><dd>${m.nextText(r)}</dd>
    </dl>`;
}

/** @param {unknown} x @returns {x is RuleDetail} */
const isRuleDetail = (x) => typeof x === 'object' && x !== null && 'timeline' in x && Array.isArray(x.timeline) && 'triage' in x;

/** @param {RuleDetail} detail */
function evidenceHtml(detail) {
  const timeline = detail.timeline.length
    ? html`<ol class="evidence-timeline">${detail.timeline.map((t) => html`<li>
        <div class="small muted">${t.date} · ${t.type === 'ledger' ? 'ledger' : 'matcher commit'}${t.commitSha ? html` · <code>${t.commitSha.slice(0, 9)}</code>` : ''}</div>
        <div class="fw-600">${t.title}</div>
        ${t.description ? html`<div class="small">${t.description}</div>` : ''}
        ${t.citation ? html`<div class="small muted">Citation: <code>${t.citation}</code></div>` : ''}
      </li>`)}</ol>`
    : html`<p class="small muted">No ledger rows or matcher commits for this rule.</p>`;
  const tr = detail.triage;
  /** @param {string} label @param {readonly string[]} items */
  const list = (label, items) => (items.length ? html`<dt>${label}</dt><dd><ul class="plain">${items.map((x) => html`<li>${x}</li>`)}</ul></dd>` : '');
  const triage = tr
    ? html`<dl class="kv">
        <dt>Detection</dt><dd><code>${tr.detection}</code></dd>
        ${tr.modernFeature ? html`<dt>Modern feature</dt><dd>${tr.modernFeature}</dd>` : ''}
        ${tr.targetSubPattern ? html`<dt>Target sub-pattern</dt><dd>${tr.targetSubPattern}</dd>` : ''}
        ${list('Replaces', tr.replaces)}
        ${list('Doesn’t replace', tr.doesNotReplace)}
        ${list('False-positive traps', tr.falsePositiveTraps)}
      </dl>`
    : html`<p class="small muted">No triage entry for this guide.</p>`;
  return html`<h3 class="detail-h">Timeline</h3>${timeline}<h3 class="detail-h">Guide triage</h3>${triage}`;
}

// ---- Map tooltip and trail ----
const tip = byId('xp-tip');
/** @type {Map<string, import('./explorer-model.js').MapDot>} */
let mapDotsById = new Map();

/** @param {ExplorerRule} r */
function showTrail(r) {
  const layer = document.getElementById('xp-trail-layer');
  if (!layer) return;
  const dot = mapDotsById.get(r.id);
  if (!dot || !dot.trail || dot.trail.length === 0) {
    setHtml(layer, raw(''));
    return;
  }
  const pts = dot.trail;
  const elements = [];

  // Draw thin muted lines from oldest trail point to current dot
  const allCoords = [...pts.map((p) => ({ x: p.x, y: p.y })), { x: dot.x, y: dot.y }];
  for (let i = 0; i < allCoords.length - 1; i++) {
    const from = allCoords[i];
    const to = allCoords[i + 1];
    const isLastSegment = i === allCoords.length - 2;
    let toX = to.x;
    let toY = to.y;
    if (isLastSegment) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist > dot.radius + 4) {
        const offset = dot.radius + 2;
        toX = to.x - (dx / dist) * offset;
        toY = to.y - (dy / dist) * offset;
      }
    }
    elements.push(
      html`<line class="trail-line" x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${toX.toFixed(1)}" y2="${toY.toFixed(1)}" marker-end="url(#trail-arrow)" />`
    );
  }

  // Draw faded hollow rings at past positions
  for (const pt of pts) {
    const label = `${pt.wave ? `Wave ${pt.wave}` : pt.date}: static ${pct(pt.staticPrecision)}, post ${pct(pt.postVerifierPrecision)}, n ${pt.n}`;
    elements.push(
      html`<circle class="trail-ring" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${pt.radius.toFixed(1)}"><title>${label}</title></circle>`
    );
  }

  setHtml(layer, html`${elements}`);
}

function hideTrail() {
  const layer = document.getElementById('xp-trail-layer');
  if (layer) setHtml(layer, raw(''));
}

/** @param {Element} el @param {ExplorerRule} r */
function showTip(el, r) {
  const j = r.judged;
  if (!j) return;
  const barText = j.n >= bar.standard.minN
    ? `bar: static ≥ ${pctShort(bar.standard.staticMatcherPrecision)}, post-verifier ≥ ${pctShort(bar.postVerifierPrecision)}`
    : `n ${bar.rarePattern.minN}–${bar.standard.minN - 1} bar: static ≥ ${pctShort(bar.rarePattern.staticMatcherPrecision)}, post-verifier ≥ ${pctShort(bar.postVerifierPrecision)}`;
  const trailLines = r.trail.map((pt) => {
    const label = pt.wave ? `Wave ${pt.wave}` : pt.date;
    return html`<div class="small muted">${label}: static ${pct(pt.staticPrecision)}, post ${pct(pt.postVerifierPrecision)} (n ${pt.n})</div>`;
  });
  setHtml(tip, html`<div class="fw-600 small">${r.guideId}<span class="mono fw-400 muted">${suffixOf(r)}</span></div>
    <div class="small">Static ${pct(j.staticMatcher.value)} (${j.legit}/${j.n}) · post-verifier ${j.kept === 0 ? 'undefined (kept 0)' : `${pct(j.postVerifier.value)} (${j.keptLegit}/${j.kept} kept)`}</div>
    ${trailLines}
    <div class="small muted">${barText} · verifier dropped ${j.legitDropped} legit and ${j.nonLegitDropped} non-legit findings</div>
    <div class="small">${m.nextText(r)}</div>`);
  if (!tip.matches(':popover-open')) tip.showPopover();
  const b = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = b.top - t.height - 8;
  if (top < 4) top = b.bottom + 8;
  const left = Math.max(4, Math.min(b.left + b.width / 2 - t.width / 2, innerWidth - t.width - 4));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
function hideTip() {
  if (tip.matches(':popover-open')) tip.hidePopover();
}

/** @param {string | null} id */
function highlight(id) {
  for (const el of document.querySelectorAll('#explorer .hl')) el.classList.remove('hl');
  if (!id) return;
  const sel = CSS.escape(id);
  document.querySelector(`#xp-map circle.dot[data-id="${sel}"]`)?.classList.add('hl');
  document.querySelector(`#xp-tbody tr[data-id="${sel}"]`)?.classList.add('hl');
}

// ---- Hover card on rule names ----
// Native interest invokers (interestfor + popover="hint") handle hover, focus, delays, and
// positioning; the `interest` event says which rule to show. Browsers without them get the same
// card from pointer and focus timers.
const card = byId('rule-card');
/** @param {ExplorerRule} r */
function fillCard(r) {
  setHtml(card, html`<div class="card-title">${r.guideId}<span class="mono fw-400 small muted">${suffixOf(r)}</span></div>
    <div class="small muted card-sub">${r.wave ? `measured in wave ${r.wave}` : 'not judged'} · click to pin</div>
    ${ruleDetailHtml(r)}`);
}
function hideCard() {
  if (card.matches(':popover-open')) card.hidePopover();
}

const SHOW_DELAY_MS = 300;
const FOCUS_DELAY_MS = 150;
const HIDE_GRACE_MS = 150;
if (Object.hasOwn(HTMLButtonElement.prototype, 'interestForElement')) {
  card.addEventListener('interest', (e) => {
    const source = 'source' in e ? e.source : null;
    if (!(source instanceof HTMLElement)) return;
    const r = ruleFromId(source.dataset.id);
    fillCard(r);
    highlight(r.id);
    showTrail(r);
  });
  card.addEventListener('loseinterest', () => {
    highlight(null);
    hideTrail();
  });
} else {
  /** @type {string | null} */
  let cardFor = null;
  let showTimer = 0;
  let hideTimer = 0;
  /** @param {HTMLElement} trigger */
  const showFallbackCard = (trigger) => {
    window.clearTimeout(hideTimer);
    const r = ruleFromId(trigger.dataset.id);
    fillCard(r);
    highlight(r.id);
    showTrail(r);
    if (!card.matches(':popover-open')) card.showPopover();
    cardFor = r.id;
    const b = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    let left = b.right + 8;
    let top = b.top - 4;
    if (left + c.width > innerWidth - 8) {
      left = Math.max(8, b.left);
      top = b.bottom + 6;
    }
    top = Math.max(8, Math.min(top, innerHeight - c.height - 8));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  };
  const hideFallbackCard = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    hideCard();
    highlight(null);
    hideTrail();
    cardFor = null;
  };
  /** @param {EventTarget | null} target */
  const triggerOf = (target) => {
    const el = target instanceof Element ? target.closest('.rule-link') : null;
    return el instanceof HTMLElement ? el : null;
  };
  const tbody = byId('xp-tbody');
  tbody.addEventListener('pointerover', (e) => {
    const trigger = triggerOf(e.target);
    if (!trigger) return;
    window.clearTimeout(hideTimer);
    if (cardFor === trigger.dataset.id) return;
    window.clearTimeout(showTimer);
    // Short delay so scanning the column doesn't flash cards; instant once one is open.
    showTimer = window.setTimeout(() => showFallbackCard(trigger), card.matches(':popover-open') ? 0 : SHOW_DELAY_MS);
  });
  tbody.addEventListener('pointerout', (e) => {
    const trigger = triggerOf(e.target);
    if (!trigger) return;
    const to = e.relatedTarget;
    if (to instanceof Node && (trigger.contains(to) || card.contains(to))) return;
    window.clearTimeout(showTimer);
    hideTimer = window.setTimeout(hideFallbackCard, HIDE_GRACE_MS);
  });
  card.addEventListener('pointerenter', () => window.clearTimeout(hideTimer));
  card.addEventListener('pointerleave', () => {
    hideTimer = window.setTimeout(hideFallbackCard, HIDE_GRACE_MS);
  });
  tbody.addEventListener('focusin', (e) => {
    const trigger = triggerOf(e.target);
    if (!trigger) return;
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(() => showFallbackCard(trigger), FOCUS_DELAY_MS);
  });
  tbody.addEventListener('focusout', (e) => {
    if (!(e.relatedTarget instanceof Node && card.contains(e.relatedTarget))) hideFallbackCard();
  });
  addEventListener('scroll', hideFallbackCard, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideFallbackCard();
  });
}

// ---- Detail dialog ----
const dialog = dialogById('rule-detail');
const evidence = byId('rule-detail-evidence');
let evidenceRequest = 0;
/** @type {Promise<Record<string, unknown>> | null} */
let staticRuleDetailsPromise = null;

/** @returns {Promise<Record<string, unknown>>} */
function getStaticRuleDetails() {
  if (!staticRuleDetailsPromise) {
    staticRuleDetailsPromise = fetch('./assets/rule-details.json').then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        throw new Error('unexpected rule-details.json shape');
      }
      return /** @type {Record<string, unknown>} */ (json);
    }).catch((err) => {
      staticRuleDetailsPromise = null;
      throw err;
    });
  }
  return staticRuleDetailsPromise;
}

/** @param {ExplorerRule} r */
async function loadEvidence(r) {
  const request = ++evidenceRequest;
  setHtml(evidence, html`<p class="small muted">Loading the ledger timeline and triage…</p>`);
  try {
    let detail;
    if (document.documentElement.dataset.staticPages === 'true') {
      const details = await getStaticRuleDetails();
      detail = details[r.id];
    } else {
      const res = await fetch(`/api/dashboard/rule?id=${encodeURIComponent(r.id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      detail = await res.json();
    }
    if (!isRuleDetail(detail)) throw new Error('unexpected response shape');
    if (request === evidenceRequest) setHtml(evidence, evidenceHtml(detail));
  } catch (err) {
    if (request === evidenceRequest) setHtml(evidence, html`<p class="small bad-text">Couldn’t load the timeline and triage: ${err instanceof Error ? err.message : String(err)}</p>`);
  }
}

/** @param {ExplorerRule} r */
function openRule(r) {
  hideTip();
  hideCard();
  byId('rule-detail-title').textContent = r.guideId;
  byId('rule-detail-sub').textContent = `${r.id}${r.wave ? ` · measured in wave ${r.wave}` : ''}`;
  setHtml(byId('rule-detail-body'), ruleDetailHtml(r));
  evidence.hidden = false;
  loadEvidence(r);
  if (!dialog.open) dialog.showModal();
}

/** @param {string} g */
function openGuide(g) {
  hideTip();
  hideCard();
  byId('rule-detail-title').textContent = g;
  byId('rule-detail-sub').textContent = 'guide';
  setHtml(byId('rule-detail-body'), html`
    <div class="detail-badges">${badge(GUIDE_STAGE[m.guideStage(g)])}</div>
    <dl class="kv"><dt>Detection</dt><dd>${data.guides.detection[g] ?? (m.guideStage(g) === 'stub' ? 'stub (not triaged)' : '—')}</dd><dt>Note</dt><dd>${m.guideNote(g) || '—'}</dd><dt>Rules</dt><dd>none</dd></dl>`);
  evidence.hidden = true;
  if (!dialog.open) dialog.showModal();
}

/** @param {string} g */
function drillGuide(g) {
  if (m.ruleCount(g) === 0) {
    openGuide(g);
    return;
  }
  Object.assign(state, { unit: 'rules', guide: g, node: null, lens: 'all', sort: 'queue', q: '' });
  inputById('xp-q').value = '';
  render();
  byId('explorer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (!('closedBy' in HTMLDialogElement.prototype)) {
  /** @param {PointerEvent} e */
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = outside(e);
  });
  dialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && outside(e)) dialog.close();
  });
}

// ---- Events ----
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  // Rule links elsewhere on the dashboard (e.g. scope holds in the status popover) open the same dialog.
  const ruleLink = t.closest('[data-rule-id]');
  if (ruleLink instanceof HTMLElement) {
    e.preventDefault();
    openRule(ruleFromId(ruleLink.dataset.ruleId));
    return;
  }
  if (!t.closest('#explorer')) return;
  const unitButton = t.closest('[data-unit]');
  if (unitButton instanceof HTMLElement) {
    const unit = unitButton.dataset.unit === 'guides' ? 'guides' : 'rules';
    Object.assign(state, { unit, node: null, guide: null, lens: unit === 'rules' ? 'all' : null, sort: unit === 'rules' ? 'queue' : 'stage' });
    render();
    return;
  }
  const lensButton = t.closest('[data-lens]');
  if (lensButton instanceof HTMLElement) {
    const lens = m.lenses.find((l) => l.id === lensButton.dataset.lens);
    if (!lens) throw new Error(`Explorer: unknown lens ${String(lensButton.dataset.lens)}`);
    Object.assign(state, { lens: lens.id, node: null, guide: null, sort: lens.sort });
    render();
    return;
  }
  const nodeButton = t.closest('[data-node]');
  if (nodeButton instanceof HTMLElement) {
    Object.assign(state, { node: nodeButton.dataset.node ?? null, lens: null, guide: null, sort: state.unit === 'rules' ? 'queue' : 'stage' });
    render();
    return;
  }
  if (t.closest('[data-clear-guide]')) {
    state.guide = null;
    render();
    return;
  }
  const row = t.closest('tr[data-id]');
  if (row instanceof HTMLElement) {
    openRule(ruleFromId(row.dataset.id));
    return;
  }
  const guideRowEl = t.closest('tr[data-guide]');
  if (guideRowEl instanceof HTMLElement && guideRowEl.dataset.guide) {
    drillGuide(guideRowEl.dataset.guide);
    return;
  }
  const dot = t.closest('circle.dot');
  if (dot instanceof SVGElement) openRule(ruleFromId(dot.dataset.id));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideTip();
    hideTrail();
  }
  const t = e.target;
  if (!(t instanceof Element) || (e.key !== 'Enter' && e.key !== ' ')) return;
  const dot = t.closest('#xp-map circle.dot');
  if (dot instanceof SVGElement) {
    e.preventDefault();
    openRule(ruleFromId(dot.dataset.id));
  }
});

const map = byId('xp-map');
/** @param {Event} e */
const onDot = (e) => {
  const dot = e.target instanceof Element ? e.target.closest('circle.dot') : null;
  if (!(dot instanceof SVGElement)) return;
  const r = ruleFromId(dot.dataset.id);
  showTip(dot, r);
  highlight(r.id);
  showTrail(r);
};
/** @param {Event} e */
const offDot = (e) => {
  if (e.target instanceof Element && e.target.closest('circle.dot')) {
    hideTip();
    highlight(null);
    hideTrail();
  }
};
map.addEventListener('pointerover', onDot);
map.addEventListener('pointerout', offDot);
map.addEventListener('focusin', onDot);
map.addEventListener('focusout', offDot);
addEventListener('scroll', () => { hideTip(); hideTrail(); }, { passive: true });

const rowsBody = byId('xp-tbody');
rowsBody.addEventListener('pointerover', (e) => {
  const row = e.target instanceof Element ? e.target.closest('tr[data-id]') : null;
  const id = row instanceof HTMLElement ? row.dataset.id ?? null : null;
  highlight(id);
  if (id) {
    const r = m.ruleById.get(id);
    if (r) showTrail(r);
  } else {
    hideTrail();
  }
});
rowsBody.addEventListener('pointerleave', () => {
  highlight(null);
  hideTrail();
});

inputById('xp-q').addEventListener('input', (e) => {
  state.q = e.target instanceof HTMLInputElement ? e.target.value : '';
  renderList();
});
selectById('xp-sort').addEventListener('change', (e) => {
  if (e.target instanceof HTMLSelectElement) state.sort = e.target.value;
  renderList();
});
inputById('xp-zoom').addEventListener('change', (e) => {
  state.zoom = e.target instanceof HTMLInputElement && e.target.checked;
  renderList();
});

render();

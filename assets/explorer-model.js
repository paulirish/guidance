// @ts-check
/**
 * @fileoverview Pure, DOM-free logic behind the dashboard's Explorer tab: qualification paths,
 * stage partitions, lenses, sorts, next-step text, and the precision-map layout. The view renders
 * what this returns, and Node tests import it directly.
 *
 * Pass/fail always comes from the healthcheck's verdict (`barDisposition`).
 */

/** @typedef {import('../explorer-data.ts').ExplorerData} ExplorerData */
/** @typedef {import('../explorer-data.ts').ExplorerRule} ExplorerRule */
/** @typedef {import('../explorer-data.ts').JudgedSample} JudgedSample */

/** A static matcher precision upper bound (95% Wilson) below this makes a rule unlikely to qualify. */
export const UNLIKELY_UPPER = 0.6;
/** Qualified rules this close to the bar get flagged as having a thin margin. */
export const THIN_MARGIN = 0.05;
/** Below-bar rules this close on their cheapest path count as near misses. */
export const NEAR_MISS = 0.15;
/** The precision map's zoomed axis starts here; lower values go in gutters. */
export const ZOOM_FLOOR = 0.4;

/** @param {number} x */
export const pct = (x) => `${(x * 100).toFixed(1)}%`;
/** @param {number} x */
export const pctShort = (x) => `${Math.round(x * 100)}%`;
/** @param {number} x */
export const pp = (x) => `${(x * 100).toFixed(1)} pp`;
/** @param {number} n @param {string} noun */
export const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** @typedef {'ok' | 'bad' | 'warn' | 'paul' | 'dim' | 'acc'} Tone */
/** @typedef {{ readonly label: string, readonly tone: Tone, readonly desc: string }} StageMeta */

/** @typedef {'disagreement' | 'scopeHold' | 'withinReach' | 'tooFewToQualify' | 'unlikely' | 'qualified' | 'declined' | 'notYetJudged' | 'notEnoughToJudge' | 'zero' | 'unaccounted'} RuleStage */
/** @typedef {'onByDefault' | 'experimentalOnly' | 'backlog' | 'retired' | 'noLegacyPattern' | 'untriaged' | 'stub' | 'unaccounted'} GuideStage */

/** @type {Readonly<Record<RuleStage, StageMeta>>} */
export const RULE_STAGE = {
  disagreement: { label: 'Status disagreement', tone: 'bad', desc: 'registry status and measured verdict disagree' },
  scopeHold: { label: 'Scope hold', tone: 'paul', desc: "clears the bar; held for Paul's call" },
  withinReach: { label: 'Within reach', tone: 'bad', desc: 'below the bar; closest first' },
  tooFewToQualify: { label: 'Too few to qualify', tone: 'warn', desc: 'judged on fewer than 5 findings' },
  unlikely: { label: 'Unlikely to qualify', tone: 'bad', desc: `static upper bound below ${pctShort(UNLIKELY_UPPER)}; biggest yield first` },
  qualified: { label: 'Qualified', tone: 'ok', desc: 'on by default; thinnest margin first' },
  declined: { label: 'Declined promotion', tone: 'dim', desc: 'Paul declined promotion' },
  notYetJudged: { label: 'Not yet judged', tone: 'warn', desc: 'has held-out findings the panel hasn’t judged' },
  notEnoughToJudge: { label: 'Not enough findings to judge', tone: 'dim', desc: 'held-out yield 1–4; biggest first' },
  zero: { label: 'Zero held-out yield', tone: 'dim', desc: 'no held-out findings' },
  unaccounted: { label: 'Unaccounted', tone: 'bad', desc: 'no stage matches' },
};

/** @type {readonly RuleStage[]} */
export const QUEUE_ORDER = ['disagreement', 'scopeHold', 'withinReach', 'tooFewToQualify', 'unlikely', 'qualified', 'declined', 'notYetJudged', 'notEnoughToJudge', 'zero', 'unaccounted'];

/** @type {Readonly<Record<GuideStage, StageMeta>>} */
export const GUIDE_STAGE = {
  onByDefault: { label: 'On by default', tone: 'ok', desc: 'at least one qualified rule' },
  experimentalOnly: { label: 'Experimental only', tone: 'warn', desc: 'rules, none qualified' },
  backlog: { label: 'Backlog · no rule yet', tone: 'acc', desc: 'detectable; no rule written' },
  retired: { label: 'Retired', tone: 'dim', desc: 'rule retired' },
  noLegacyPattern: { label: 'No legacy pattern', tone: 'dim', desc: 'triaged as having nothing to detect' },
  untriaged: { label: 'Not triaged yet', tone: 'warn', desc: 'no triage entry' },
  stub: { label: 'Stub', tone: 'dim', desc: 'guide has no body yet' },
  unaccounted: { label: 'Unaccounted', tone: 'bad', desc: 'no stage matches' },
};

/** @param {string} id @returns {id is RuleStage} */
export const isRuleStage = (id) => Object.hasOwn(RULE_STAGE, id);
/** @param {string} id @returns {id is GuideStage} */
export const isGuideStage = (id) => Object.hasOwn(GUIDE_STAGE, id);

/** @type {readonly GuideStage[]} */
const GUIDE_RANK = ['onByDefault', 'experimentalOnly', 'backlog', 'retired', 'noLegacyPattern', 'untriaged', 'stub', 'unaccounted'];

/**
 * @typedef {{ readonly id: string, readonly label?: string, readonly children?: readonly TreeNode[] }} TreeNode
 */

/** Funnel trees for the left rail. Leaves are stage ids; inner nodes group them. */
export const TREES = /** @type {const} */ ({
  rules: {
    id: 'rules-all',
    label: 'All rules',
    children: [
      { id: 'disagreement' },
      { id: 'zero' },
      { id: 'notEnoughToJudge' },
      { id: 'notYetJudged' },
      {
        id: 'judged',
        label: 'Judged',
        children: [
          { id: 'qualified' },
          { id: 'scopeHold' },
          { id: 'declined' },
          { id: 'tooFewToQualify' },
          { id: 'below', label: 'Below bar', children: [{ id: 'withinReach' }, { id: 'unlikely' }] },
        ],
      },
      { id: 'unaccounted' },
    ],
  },
  guides: {
    id: 'guides-all',
    label: 'Catalog guides',
    children: [
      { id: 'stub' },
      { id: 'untriaged' },
      {
        id: 'triaged',
        label: 'Triaged',
        children: [
          { id: 'noLegacyPattern' },
          {
            id: 'detectable',
            label: 'Detectable',
            children: [
              { id: 'withRules', label: 'With rules', children: [{ id: 'onByDefault' }, { id: 'experimentalOnly' }] },
              { id: 'backlog' },
              { id: 'retired' },
            ],
          },
        ],
      },
      { id: 'unaccounted' },
    ],
  },
});

/** Stages that only appear in the tree when something lands in them. */
export const HIDDEN_WHEN_EMPTY = new Set(['disagreement', 'notYetJudged', 'untriaged', 'unaccounted']);

/** @param {TreeNode} node @returns {string[]} */
export const leavesOf = (node) => (node.children ? node.children.flatMap(leavesOf) : [node.id]);

/**
 * @param {TreeNode} root
 * @param {string} id
 * @returns {TreeNode | null}
 */
export function findNode(root, id) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) break;
    if (node.id === id) return node;
    stack.push(...(node.children ?? []));
  }
  return null;
}

/** Cheap deterministic string hash (FNV-1a) for stable jitter. @param {string} s */
export function hash(s) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @typedef {{ readonly name: 'standard' | 'rarePattern', readonly minN: number, readonly needN: number, readonly staticGap: number, readonly postGap: number }} QualificationPathGap
 */

/**
 * Builds every derived view of the Explorer data. Functions close over the data's indexes.
 * @param {ExplorerData} data
 */
export function createExplorerModel(data) {
  const { bar, rules, guides } = data;
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const contradictions = new Set(data.contradictions);
  /** @type {Map<string, ExplorerRule[]>} */
  const rulesByGuide = new Map();
  for (const r of rules) {
    const list = rulesByGuide.get(r.guideId);
    if (list) list.push(r);
    else rulesByGuide.set(r.guideId, [r]);
  }
  const maxHeldOutYield = Math.max(1, ...rules.map((r) => r.heldOutYield));
  const stubs = new Set(guides.stubs);
  const untriaged = new Set(guides.untriaged);
  const backlog = new Set(guides.backlog);
  const retired = new Map(guides.retired.map((x) => [x.guideId, x.reason]));
  const allGuides = [...guides.stubs, ...guides.untriaged, ...guides.triaged];

  /** @param {number} n */
  const staticBarFor = (n) => (n >= bar.standard.minN ? bar.standard.staticMatcherPrecision : bar.rarePattern.staticMatcherPrecision);

  /** @param {ExplorerRule} r */
  const isUnlikely = (r) => r.judged !== null && r.judged.staticMatcher.upper < UNLIKELY_UPPER;

  /** Distance above the applicable bar; negative means below. @param {JudgedSample} j */
  const margin = (j) => Math.min(j.staticMatcher.value - staticBarFor(j.n), j.postVerifier.value - bar.postVerifierPrecision);

  /** @param {JudgedSample} j @returns {QualificationPathGap[]} */
  function paths(j) {
    const postGap = Math.max(0, bar.postVerifierPrecision - j.postVerifier.value);
    /** @type {QualificationPathGap} */
    const standard = {
      name: 'standard',
      minN: bar.standard.minN,
      needN: Math.max(0, bar.standard.minN - j.n),
      staticGap: Math.max(0, bar.standard.staticMatcherPrecision - j.staticMatcher.value),
      postGap,
    };
    if (j.n >= bar.standard.minN) return [standard];
    return [
      standard,
      {
        name: 'rarePattern',
        minN: bar.rarePattern.minN,
        needN: Math.max(0, bar.rarePattern.minN - j.n),
        staticGap: Math.max(0, bar.rarePattern.staticMatcherPrecision - j.staticMatcher.value),
        postGap,
      },
    ];
  }
  /** @param {QualificationPathGap} p */
  const gapOf = (p) => Math.max(p.staticGap, p.postGap);
  /** @param {QualificationPathGap} p */
  function describePath(p) {
    const parts = [];
    if (p.needN > 0) parts.push(plural(p.needN, 'more finding'));
    if (p.staticGap > 0) parts.push(`static +${pp(p.staticGap)}`);
    if (p.postGap > 0) parts.push(`post-verifier +${pp(p.postGap)}`);
    return parts.join(', ');
  }
  /** @param {QualificationPathGap} p */
  const pathLabel = (p) => `n ≥ ${p.minN} bar:`;

  /** @param {ExplorerRule} r @returns {RuleStage} */
  function ruleStage(r) {
    if (r.statusDisposition === 'disagrees') return 'disagreement';
    if (r.measurementStatus === 'zero') return 'zero';
    if (r.measurementStatus === 'too few to measure') return 'notEnoughToJudge';
    if (r.measurementStatus === 'has findings, not judged') return 'notYetJudged';
    if (r.judged === null) return 'unaccounted';
    if (r.publicStatus === 'qualified') return 'qualified';
    if (r.statusDisposition === 'scope-hold') return 'scopeHold';
    if (r.statusDisposition === 'paul-declined') return 'declined';
    if (r.barDisposition === 'too-few-findings') return 'tooFewToQualify';
    if (r.barDisposition === 'fails-bar') return isUnlikely(r) ? 'unlikely' : 'withinReach';
    return 'unaccounted';
  }

  /** Cheapest path's largest gap, for below-bar rules only. @param {ExplorerRule} r */
  const closeness = (r) => (r.judged !== null && ruleStage(r) === 'withinReach' ? Math.min(...paths(r.judged).map(gapOf)) : null);

  /** @param {number | null} x */
  const inf = (x) => (x === null ? Infinity : x);
  /** @param {ExplorerRule} a @param {ExplorerRule} b */
  const byName = (a, b) => a.id.localeCompare(b.id);
  /** @param {ExplorerRule} r */
  const nOf = (r) => r.judged?.n ?? 0;
  /** @param {ExplorerRule} r */
  const legitOf = (r) => r.judged?.legit ?? 0;
  /** @param {ExplorerRule} r */
  const marginOf = (r) => (r.judged === null ? Infinity : margin(r.judged));

  /** Order within each work-queue group. @type {Readonly<Record<RuleStage, (a: ExplorerRule, b: ExplorerRule) => number>>} */
  const within = {
    disagreement: byName,
    scopeHold: byName,
    withinReach: (a, b) => inf(closeness(a)) - inf(closeness(b)) || b.heldOutYield - a.heldOutYield,
    tooFewToQualify: (a, b) => nOf(b) - nOf(a) || legitOf(b) - legitOf(a) || byName(a, b),
    unlikely: (a, b) => b.heldOutYield - a.heldOutYield || byName(a, b),
    qualified: (a, b) => marginOf(a) - marginOf(b) || byName(a, b),
    declined: byName,
    notYetJudged: (a, b) => b.heldOutYield - a.heldOutYield || byName(a, b),
    notEnoughToJudge: (a, b) => b.heldOutYield - a.heldOutYield || byName(a, b),
    zero: (a, b) => b.ruleWritingYield - a.ruleWritingYield || byName(a, b),
    unaccounted: byName,
  };

  /** @param {string} g @returns {GuideStage} */
  function guideStage(g) {
    if (stubs.has(g)) return 'stub';
    if (untriaged.has(g)) return 'untriaged';
    if (guides.detection[g] === 'no-legacy-pattern') return 'noLegacyPattern';
    const rs = rulesByGuide.get(g);
    if (rs?.length) return rs.some((r) => r.publicStatus === 'qualified') ? 'onByDefault' : 'experimentalOnly';
    if (backlog.has(g)) return 'backlog';
    if (retired.has(g)) return 'retired';
    return 'unaccounted';
  }
  /** @param {string} g */
  const ruleCount = (g) => rulesByGuide.get(g)?.length ?? 0;

  /**
   * @typedef {{ readonly id: string, readonly label: string, readonly filter: (r: ExplorerRule) => boolean, readonly sort: RuleSortId, readonly sub: string }} Lens
   * @typedef {'queue' | 'closest' | 'yield' | 'name'} RuleSortId
   * @typedef {'stage' | 'rules' | 'name'} GuideSortId
   */

  /** Lenses cover cross-cutting views the funnel tree can't express. @type {readonly Lens[]} */
  const lenses = [
    { id: 'all', label: 'All', filter: () => true, sort: 'queue', sub: 'Every rule, grouped as a work queue.' },
    {
      id: 'moved',
      label: 'Moved',
      filter: (r) => r.trail.length > 0,
      sort: 'queue',
      sub: 'Rules with earlier positions in committed snapshot history.',
    },
    {
      id: 'nearMiss',
      label: 'Near-miss',
      filter: (r) => {
        const c = closeness(r);
        return c !== null && c <= NEAR_MISS;
      },
      sort: 'closest',
      sub: `Below the bar, within ${pp(NEAR_MISS)} on the cheapest path. Rules unlikely to qualify are excluded.`,
    },
    {
      id: 'unlikely',
      label: 'Unlikely to qualify',
      filter: isUnlikely,
      sort: 'yield',
      sub: `Static upper bound below ${pctShort(UNLIKELY_UPPER)}, so tuning is unlikely to reach the bar. Rewrite or retirement candidates (Paul's call).`,
    },
    {
      id: 'thin',
      label: 'Thin margin',
      filter: (r) => ruleStage(r) === 'qualified' && marginOf(r) < THIN_MARGIN,
      sort: 'queue',
      sub: `Qualified, but within ${pp(THIN_MARGIN)} of the bar; a re-measure could flip them.`,
    },
    {
      id: 'needsData',
      label: 'Needs more data',
      filter: (r) => {
        const st = ruleStage(r);
        return st === 'notEnoughToJudge' || st === 'tooFewToQualify' || (st === 'withinReach' && nOf(r) < bar.standard.minN);
      },
      sort: 'yield',
      sub: 'Fewer findings than the bar needs.',
    },
    {
      id: 'contradictions',
      label: 'Contradictions',
      filter: (r) => contradictions.has(r.id),
      sort: 'name',
      sub: 'Rules on guides triaged as having no legacy pattern.',
    },
  ];

  /** @type {Readonly<Record<RuleSortId, { readonly label: string, readonly cmp: ((a: ExplorerRule, b: ExplorerRule) => number) | null }>>} */
  const ruleSorts = {
    queue: { label: 'Work queue (grouped)', cmp: null },
    closest: { label: 'Closest to the bar', cmp: (a, b) => inf(closeness(a)) - inf(closeness(b)) || b.heldOutYield - a.heldOutYield },
    yield: { label: 'Biggest held-out yield', cmp: (a, b) => b.heldOutYield - a.heldOutYield || byName(a, b) },
    name: { label: 'Name', cmp: byName },
  };

  /** @type {Readonly<Record<GuideSortId, { readonly label: string, readonly cmp: (a: string, b: string) => number }>>} */
  const guideSorts = {
    stage: { label: 'Stage', cmp: (a, b) => GUIDE_RANK.indexOf(guideStage(a)) - GUIDE_RANK.indexOf(guideStage(b)) || a.localeCompare(b) },
    rules: { label: 'Rule count', cmp: (a, b) => ruleCount(b) - ruleCount(a) || a.localeCompare(b) },
    name: { label: 'Name', cmp: (a, b) => a.localeCompare(b) },
  };

  /** @param {JudgedSample} j */
  function marginText(j) {
    const staticMargin = j.staticMatcher.value - staticBarFor(j.n);
    const postMargin = j.postVerifier.value - bar.postVerifierPrecision;
    return staticMargin <= postMargin
      ? `static ${pct(j.staticMatcher.value)} is ${pp(staticMargin)} over its ${pctShort(staticBarFor(j.n))} bar`
      : `post-verifier ${pct(j.postVerifier.value)} is ${pp(postMargin)} over the ${pctShort(bar.postVerifierPrecision)} bar`;
  }

  /** One-line next step for any rule. @param {ExplorerRule} r */
  function nextText(r) {
    const st = ruleStage(r);
    const j = r.judged;
    if (st === 'disagreement') return `Status disagreement: ${r.disagreement ?? 'the healthcheck flags this rule'}`;
    if (st === 'zero') return r.ruleWritingYield === 0 ? 'Never fired on either split' : `No held-out findings (rule-writing yield ${r.ruleWritingYield})`;
    if (st === 'notEnoughToJudge') return `Held-out yield ${r.heldOutYield}; needs ≥ ${bar.rarePattern.minN} findings to judge`;
    if (st === 'notYetJudged') return `Held-out yield ${r.heldOutYield}; not judged yet`;
    if (st === 'scopeHold') return `Paul's call: ${r.ledgerNote ?? 'no reason recorded'}`;
    if (st === 'declined') return 'Paul declined promotion';
    if (j === null) return 'Unaccounted: no stage matches';
    if (st === 'qualified') return margin(j) < THIN_MARGIN ? `Thin margin: ${marginText(j)}` : `Margin +${pp(margin(j))} over the bar`;
    if (st === 'tooFewToQualify') return isUnlikely(r) ? `Unlikely to qualify: ${j.legit}/${j.n} legit so far` : `Needs ≥ ${bar.rarePattern.minN} findings (has ${j.n})`;
    if (st === 'unlikely') return `Unlikely to qualify: static is at most ${pctShort(j.staticMatcher.upper)} even optimistically. Rewrite or retire (Paul's call)`;
    if (st === 'withinReach') {
      const ps = paths(j);
      return ps.length === 1 ? `Needs ${describePath(ps[0])}` : ps.map((p) => `${pathLabel(p)} ${describePath(p)}`).join(' · ');
    }
    return 'Unaccounted: no stage matches';
  }

  /** @param {string} g */
  function guideNote(g) {
    const st = guideStage(g);
    const rs = rulesByGuide.get(g) ?? [];
    if (st === 'retired') return retired.get(g) ?? '';
    if (st === 'backlog') return `Detectable (${guides.detection[g]}); no rule written yet`;
    if (st === 'noLegacyPattern' && rs.length) return `${plural(rs.length, 'rule')} despite no-legacy-pattern triage`;
    if (st === 'stub') return 'Guide is a stub';
    if (st === 'untriaged') return 'Not triaged yet';
    if (rs.length) return `${rs.filter((r) => ruleStage(r) === 'qualified').length} of ${plural(rs.length, 'rule')} qualified`;
    return '';
  }

  /** The bar sentence that applies to a rule's sample size. @param {ExplorerRule} r */
  function applicableBar(r) {
    if (r.judged === null) return 'not judged';
    const post = pctShort(bar.postVerifierPrecision);
    if (r.judged.n >= bar.standard.minN) return `n ≥ ${bar.standard.minN}: static ≥ ${pctShort(bar.standard.staticMatcherPrecision)} and post-verifier ≥ ${post}`;
    if (r.judged.n >= bar.rarePattern.minN) return `n ${bar.rarePattern.minN}–${bar.standard.minN - 1}: static ≥ ${pctShort(bar.rarePattern.staticMatcherPrecision)} and post-verifier ≥ ${post}`;
    return `n < ${bar.rarePattern.minN}: can’t qualify yet`;
  }

  return {
    bar,
    rules,
    allGuides,
    ruleById,
    rulesByGuide,
    contradictions,
    maxHeldOutYield,
    staticBarFor,
    isUnlikely,
    margin,
    paths,
    gapOf,
    describePath,
    pathLabel,
    ruleStage,
    closeness,
    within,
    guideStage,
    ruleCount,
    lenses,
    ruleSorts,
    guideSorts,
    marginText,
    nextText,
    guideNote,
    applicableBar,
  };
}

/** @typedef {ReturnType<typeof createExplorerModel>} ExplorerModel */

/**
 * @typedef {{ readonly left: number, readonly right: number, readonly top: number, readonly bottom: number }} Margins
 * @typedef {{ readonly staticPrecision: number, readonly postVerifierPrecision: number, readonly n: number, readonly wave: string | null, readonly date: string, readonly x: number, readonly y: number, readonly radius: number }} LayoutTrailPoint
 * @typedef {{ readonly rule: ExplorerRule, readonly judged: JudgedSample, x: number, y: number, readonly radius: number, readonly xmin: number, readonly xmax: number, readonly ymin: number, readonly ymax: number, readonly trail: readonly LayoutTrailPoint[] }} MapDot
 */

export const MAP_WIDTH = 760;
export const MAP_HEIGHT = 390;
const MAP_MARGINS = /** @type {Margins} */ ({ left: 56, right: 104, top: 38, bottom: 56 });
const GUTTER = 26;
const RELAX_ITERATIONS = 120;

/**
 * Lays out precision-map dots: values below the zoom floor go in gutters, rules below it on both
 * axes collapse into one counted corner marker, and overlapping dots get nudged apart.
 * @param {readonly ExplorerRule[]} rules judged rules with n at or above the rare-pattern minimum
 * @param {boolean} zoom
 */
export function layoutMap(rules, zoom) {
  const floor = zoom ? ZOOM_FLOOR : 0;
  const m = MAP_MARGINS;
  const gut = zoom ? GUTTER : 0;
  const x0 = m.left + gut;
  const x1 = MAP_WIDTH - m.right;
  const y0 = m.top;
  const y1 = MAP_HEIGHT - m.bottom - gut;
  /** @param {number} v */
  const fx = (v) => x0 + ((v - floor) / (1 - floor)) * (x1 - x0);
  /** @param {number} v */
  const fy = (v) => y1 - ((v - floor) / (1 - floor)) * (y1 - y0);
  const gutterCenterX = m.left + (gut - 4) / 2;
  const gutterCenterY = y1 + 4 + (gut - 4) / 2;

  /** @type {{ rule: ExplorerRule, judged: JudgedSample }[]} */
  const points = [];
  for (const rule of rules) if (rule.judged) points.push({ rule, judged: rule.judged });

  const corner = gut ? points.filter((p) => p.judged.staticMatcher.value < floor && p.judged.postVerifier.value < floor).map((p) => p.rule) : [];
  const cornerIds = new Set(corner.map((r) => r.id));

  /** @type {MapDot[]} */
  const dots = points
    .filter((p) => !cornerIds.has(p.rule.id))
    .sort((a, b) => b.judged.n - a.judged.n)
    .map(({ rule, judged }) => {
      const radius = 3 + Math.sqrt(judged.n) * 0.8;
      const inGutterX = judged.staticMatcher.value < floor;
      const inGutterY = judged.postVerifier.value < floor;
      const jitterX = ((hash(`${rule.id}x`) % 1000) / 1000 - 0.5) * (gut - 10);
      const jitterY = ((hash(`${rule.id}y`) % 1000) / 1000 - 0.5) * (gut - 10);
      const trail = (rule.trail ?? []).map((pt, idx) => {
        const ptRadius = 3 + Math.sqrt(pt.n) * 0.8;
        const ptInGutterX = pt.staticPrecision < floor;
        const ptInGutterY = pt.postVerifierPrecision < floor;
        const ptJitterX = ((hash(`${rule.id}tx${idx}`) % 1000) / 1000 - 0.5) * (gut - 10);
        const ptJitterY = ((hash(`${rule.id}ty${idx}`) % 1000) / 1000 - 0.5) * (gut - 10);
        return {
          ...pt,
          radius: ptRadius,
          x: ptInGutterX ? gutterCenterX + (gut ? ptJitterX : 0) : fx(pt.staticPrecision),
          y: ptInGutterY ? gutterCenterY + (gut ? ptJitterY : 0) : fy(pt.postVerifierPrecision),
        };
      });
      return {
        rule,
        judged,
        radius,
        trail,
        x: inGutterX ? gutterCenterX + jitterX : fx(judged.staticMatcher.value),
        y: inGutterY ? gutterCenterY + jitterY : fy(judged.postVerifier.value),
        xmin: inGutterX ? m.left + radius : x0 + radius * 0.5,
        xmax: inGutterX ? m.left + gut - 4 - radius : x1 + 10 - radius,
        ymin: inGutterY ? y1 + 4 + radius : y0 - 6 + radius,
        ymax: inGutterY ? y1 + gut - radius : y1 - radius * 0.5,
      };
    });

  for (let it = 0; it < RELAX_ITERATIONS; it++) {
    let moved = false;
    for (let i = 0; i < dots.length; i++) {
      for (let k = i + 1; k < dots.length; k++) {
        const a = dots[i];
        const b = dots[k];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.radius + b.radius + 1;
        if (d >= min) continue;
        if (d < 0.01) {
          const angle = (hash(a.rule.id + b.rule.id) % 628) / 100;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    for (const dot of dots) {
      dot.x = Math.min(dot.xmax, Math.max(dot.xmin, dot.x));
      dot.y = Math.min(dot.ymax, Math.max(dot.ymin, dot.y));
    }
    if (!moved) break;
  }

  return { floor, margins: m, gutter: gut, x0, x1, y0, y1, fx, fy, gutterCenterX, gutterCenterY, corner, dots };
}

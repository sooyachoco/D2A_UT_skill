// ut-a11y.mjs — axe-core 기반 접근성 자동 스캔
// 활성화: npm i -D @axe-core/playwright axe-core
// 미설치 시 우아하게 스킵한다(러너 자체는 계속 동작). WCAG 위반은 UT severity(S1~S4)로 매핑된다.

// axe impact → Nielsen severity 매핑
const IMPACT_TO_SEVERITY = {
  critical: 'S4',
  serious: 'S3',
  moderate: 'S2',
  minor: 'S1',
};

/**
 * 현재 페이지를 axe-core 로 스캔한다.
 * @param {import('@playwright/test').Page} page
 * @param {{tags?:string[], scope?:string}} [opts]  tags 기본 WCAG 2.1 A/AA
 * @returns {Promise<{skipped:boolean, reason?:string, violations:Array, counts:Record<string,number>}>}
 */
export async function scanA11y(page, opts = {}) {
  const tags = opts.tags ?? ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
  const empty = { S4: 0, S3: 0, S2: 0, S1: 0, total: 0 };

  let AxeBuilder;
  try {
    ({ default: AxeBuilder } = await import('@axe-core/playwright'));
  } catch {
    return {
      skipped: true,
      reason: '@axe-core/playwright 미설치 — `npm i -D @axe-core/playwright axe-core` 후 자동 활성화',
      violations: [],
      counts: { ...empty },
    };
  }

  try {
    let builder = new AxeBuilder({ page }).withTags(tags);
    if (opts.scope) builder = builder.include(opts.scope);
    const { violations } = await builder.analyze();

    const counts = { ...empty };
    const flat = violations.map((v) => {
      const sev = IMPACT_TO_SEVERITY[v.impact] ?? 'S2';
      counts[sev] += v.nodes.length;
      counts.total += v.nodes.length;
      return {
        id: v.id,
        impact: v.impact,
        severity: sev,
        help: v.help,
        wcag: (v.tags || []).filter((t) => /^wcag/i.test(t)),
        nodes: v.nodes.length,
        targets: v.nodes.slice(0, 5).map((n) => (n.target || []).join(' ')),
      };
    });
    return { skipped: false, violations: flat, counts };
  } catch (e) {
    return { skipped: true, reason: `axe 스캔 실패: ${e.message}`, violations: [], counts: { ...empty } };
  }
}

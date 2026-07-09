// ut-perf.mjs — Core Web Vitals(성능 지표) 수집기
// 외부 web-vitals 라이브러리 없이 PerformanceObserver 로 LCP/CLS/FCP 를 직접 수집한다.
// run-ut.mjs 가 페이지 생성 직후(첫 goto 전) PERF_INIT_SCRIPT 를 addInitScript 로 주입하고,
// 시나리오 종료 후 readPerf(page) 로 값을 읽는다.
//
// 주의: LCP 는 사용자 상호작용/페이지 숨김 시 확정되므로, 시나리오 도중 읽는 값은 "현재까지의
// 최대 후보"에 가까운 근사치다. UT(자동 시나리오) 맥락에선 충분히 유의미한 신호로 본다.

// 페이지 컨텍스트에서 실행되는 수집 스크립트. buffered:true 로 관측 이전 엔트리도 포함한다.
export const PERF_INIT_SCRIPT = `
(() => {
  if (window.__utPerf) return;
  window.__utPerf = { lcp: 0, cls: 0, fcp: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__utPerf.lcp = Math.round(e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__utPerf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__utPerf.fcp = Math.round(e.startTime);
    }).observe({ type: 'paint', buffered: true });
  } catch (e) {}
})();
`;

/**
 * 수집된 Web Vitals + 내비게이션 타이밍을 읽는다.
 * @returns {{ok:boolean, lcp:number, cls:number, fcp:number, load:number, ttfb:number, reason?:string}}
 *   lcp/fcp/load/ttfb 는 ms, cls 는 단위 없는 누적 점수(소수).
 */
export async function readPerf(page) {
  try {
    const p = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const load = nav ? Math.max(0, Math.round(nav.loadEventEnd - nav.startTime)) : 0;
      const ttfb = nav ? Math.max(0, Math.round(nav.responseStart - nav.startTime)) : 0;
      const u = window.__utPerf || { lcp: 0, cls: 0, fcp: 0 };
      return { lcp: u.lcp, cls: Math.round(u.cls * 1000) / 1000, fcp: u.fcp, load, ttfb };
    });
    return { ok: true, ...p };
  } catch (e) {
    return { ok: false, lcp: 0, cls: 0, fcp: 0, load: 0, ttfb: 0, reason: e.message };
  }
}

// 기본 성능 예산 (Google Core Web Vitals 기준선). 프로젝트에서 config.perfBudget 로 override.
//   good ≤ lcp / cls, poor > lcpPoor / clsPoor. 그 사이는 "개선 필요".
export const DEFAULT_PERF_BUDGET = { lcp: 2500, lcpPoor: 4000, cls: 0.1, clsPoor: 0.25 };

/**
 * perf 값을 예산과 비교해 결함(초과) 목록을 만든다.
 * poor 초과 → S3, good~poor 사이 → S2, good 이내 → 없음.
 * @returns {Array<{metric:string, value:number, severity:string, note:string}>}
 */
export function classifyPerf(perf, budget = DEFAULT_PERF_BUDGET) {
  const out = [];
  if (perf.lcp > budget.lcpPoor) out.push({ metric: 'LCP', value: perf.lcp, severity: 'S3', note: `LCP ${perf.lcp}ms > ${budget.lcpPoor}ms (poor)` });
  else if (perf.lcp > budget.lcp) out.push({ metric: 'LCP', value: perf.lcp, severity: 'S2', note: `LCP ${perf.lcp}ms > ${budget.lcp}ms (개선 필요)` });
  if (perf.cls > budget.clsPoor) out.push({ metric: 'CLS', value: perf.cls, severity: 'S3', note: `CLS ${perf.cls} > ${budget.clsPoor} (poor)` });
  else if (perf.cls > budget.cls) out.push({ metric: 'CLS', value: perf.cls, severity: 'S2', note: `CLS ${perf.cls} > ${budget.cls} (개선 필요)` });
  return out;
}

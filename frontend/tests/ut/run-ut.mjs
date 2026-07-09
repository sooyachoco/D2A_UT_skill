// run-ut.mjs — 범용 AI 사용성 테스트 러너 (설정 기반)
//
// ai-usability-test 스킬의 Step 3(Playwright 실행)을 구현한 재사용 드라이버.
// 프로젝트별 시나리오는 ut.config.mjs 에 정의하고, 이 러너가 3페르소나로 재현한다.
//
// 실행 (repo 루트에서):
//   UT_BASE=https://local-app.nexon.com node frontend/tests/ut/run-ut.mjs
//   UT_CONFIG=frontend/tests/ut/ut.config.mjs node frontend/tests/ut/run-ut.mjs
//
// 안정성:
//   · flaky 재시도 게이트 — 실패한 시나리오를 재실행(config.retries, 기본 1). 재시도에서 회복되면
//     "flaky"로 격리(결함 카운트 제외), 지속 실패하면 reproducible 결함으로 확정.
//   · 노이즈 필터 — HMR·Fast Refresh·Vite·DevTools·favicon 등 프레임워크 잡음을 기본 제외
//     (config.noiseFilters=false 로 끔). config.ignoreConsole/ignoreNetwork 로 추가.
//
// 산출: {specDir}/observations/raw-observations.json + {specDir}/screenshots/*.png
// 이후 `node frontend/tests/ut/ut-aggregate.mjs` 로 UT_FINDINGS_REPORT.md 를 집계한다.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makePersona, PERSONA_PROFILES } from './ut-personas.mjs';
import { scanA11y } from './ut-a11y.mjs';
import { PERF_INIT_SCRIPT, readPerf } from './ut-perf.mjs';

const ROOT = path.resolve(process.env.UT_ROOT || process.cwd());

class AuthRedirectError extends Error {}

const toRe = (p) => (p instanceof RegExp ? p : new RegExp(p));
const ignoredBy = (patterns, text) => patterns.some((p) => toRe(p).test(text));

// 프레임워크·개발서버 잡음(결함 아님). auto-acceptance 노이즈 필터와 동일 취지.
const DEFAULT_CONSOLE_IGNORE = [
  /\[Fast Refresh\]/i, /\[HMR\]/i, /\[vite\]/i,
  /Download the React DevTools/i, /React DevTools/i,
  /failed to load source map/i,
];
const DEFAULT_NETWORK_IGNORE = [
  /\/favicon\.ico(\?|$)/i, /\/@vite\//, /\/@react-refresh/, /hot-update\.(js|json)/,
];

// ── 설정 로드 ────────────────────────────────────────────────
async function loadConfig() {
  const candidates = [
    process.env.UT_CONFIG,
    'ut.config.mjs',
    'frontend/tests/ut/ut.config.mjs',
    'tests/ut/ut.config.mjs',
  ].filter(Boolean).map((p) => path.resolve(ROOT, p));

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      return { config: mod.default ?? mod.config, configPath: c };
    }
  }
  throw new Error(
    'ut.config.mjs 를 찾지 못했습니다. ut.config.example.mjs 를 복사해 시나리오를 정의하세요.\n' +
    `  탐색 경로: ${candidates.map((c) => path.relative(ROOT, c)).join(', ')}`
  );
}

async function main() {
  const { config, configPath } = await loadConfig();
  const base = (process.env.UT_BASE || config.base || 'http://localhost:5173').replace(/\/$/, '');
  const specDir = path.resolve(ROOT, config.specDir || 'specs/ut');
  const shotsDir = path.join(specDir, 'screenshots');
  const obsDir = path.join(specDir, 'observations');
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(obsDir, { recursive: true });

  const authState = config.authState ? path.resolve(ROOT, config.authState) : null;
  const useAuth = authState && fs.existsSync(authState);
  const guardHosts = config.authGuardHosts || ['signin.nexon.com', 'nxas.nexon.com'];
  const defaultPersonas = config.personas || ['beginner', 'power-user', 'accessibility'];
  const useNoise = config.noiseFilters !== false;
  const ignoreConsole = [...(useNoise ? DEFAULT_CONSOLE_IGNORE : []), ...(config.ignoreConsole || [])];
  const ignoreNetwork = [...(useNoise ? DEFAULT_NETWORK_IGNORE : []), ...(config.ignoreNetwork || [])];
  const collectPerf = config.perf !== false;
  const retries = Number.isInteger(config.retries) ? Math.max(0, config.retries) : 1;

  const results = [];
  const consoleErrors = [];
  const networkErrors = [];

  const browser = await chromium.launch();

  // 시나리오×페르소나 1회 실행(= 1 attempt). 격리된 컨텍스트에서 관측을 로컬 버퍼에 모아 반환.
  async function runAttempt(scenario, personaId, attempt) {
    const profile = PERSONA_PROFILES[personaId] || {};
    const ctx = await browser.newContext({
      viewport: profile.viewport || { width: 1440, height: 900 },
      isMobile: !!profile.isMobile,
      hasTouch: !!profile.hasTouch,
      deviceScaleFactor: profile.deviceScaleFactor || 1,
      storageState: useAuth ? authState : undefined,
    });
    const page = await ctx.newPage();
    if (collectPerf) await page.addInitScript(PERF_INIT_SCRIPT);

    const recs = [];
    const consoleErrs = [];
    const netErrs = [];

    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (ignoredBy(ignoreConsole, text)) return;
      consoleErrs.push({ persona: personaId, scenario: scenario.id, type: 'console', text });
    });
    page.on('pageerror', (e) => {
      const text = e.message || String(e);
      if (ignoredBy(ignoreConsole, text)) return;
      consoleErrs.push({ persona: personaId, scenario: scenario.id, type: 'pageerror', text });
    });
    page.on('response', (resp) => {
      const status = resp.status();
      if (status < 400) return;
      const url = resp.url();
      if (ignoredBy(ignoreNetwork, url)) return;
      netErrs.push({ persona: personaId, scenario: scenario.id, kind: 'status', status, method: resp.request().method(), url });
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (ignoredBy(ignoreNetwork, url)) return;
      netErrs.push({ persona: personaId, scenario: scenario.id, kind: 'failed', status: 0, method: req.method(), url, failure: req.failure()?.errorText || '' });
    });

    const persona = makePersona(page, personaId);
    const t0 = Date.now();
    let maxHesitation = 0;

    const rec = (partial) => {
      recs.push({ persona: personaId, scenario: scenario.id, title: scenario.title, covers: scenario.covers || [], timestamp: Date.now(), durationMs: Date.now() - t0, ...partial });
      if (typeof partial.hesitationMs === 'number') maxHesitation = Math.max(maxHesitation, partial.hesitationMs);
    };
    const shot = async (name) => {
      const p = path.join(shotsDir, `${personaId}-${scenario.id}-${name}.png`);
      await page.screenshot({ path: p }).catch(() => {});
      return path.relative(ROOT, p).replace(/\\/g, '/');
    };
    const goto = async (relOrAbs, opts) => {
      const url = /^https?:\/\//.test(relOrAbs) ? relOrAbs : base + (relOrAbs.startsWith('/') ? '' : '/') + relOrAbs;
      await persona.goto(url, opts);
      const host = new URL(page.url()).host;
      if (guardHosts.some((h) => host.includes(h))) {
        throw new AuthRedirectError(`인증 화면으로 리다이렉트됨(${host}) — storageState 만료. save-auth-state 재실행 필요`);
      }
    };

    let abortedByAuth = false;
    try {
      await scenario.run({ page, persona, base, rec, shot, goto, config, root: ROOT });
    } catch (e) {
      const isAuth = e instanceof AuthRedirectError;
      abortedByAuth = isAuth;
      rec({
        action: 'scenario-run', completed: false, isError: true,
        errorType: isAuth ? 'auth-redirect' : 'exception',
        severityHint: isAuth ? 'S4' : undefined,
        hesitationMs: maxHesitation, screenshotPath: await shot('error'), note: e.message,
      });
    }

    if (!abortedByAuth && scenario.a11y !== false) {
      const a = await scanA11y(page, scenario.a11yOptions);
      rec({
        action: 'a11y-axe-scan', completed: !a.skipped && a.counts.total === 0, isError: false, errorType: null,
        a11y: a.skipped ? { skipped: true, reason: a.reason } : a.counts,
        ariaIssue: a.skipped ? a.reason : (a.violations.map((v) => `${v.id}(${v.severity}×${v.nodes})`).join(', ') || null),
        violations: a.violations,
        note: a.skipped ? `axe 스킵: ${a.reason}` : `WCAG 위반 ${a.counts.total}건 (S4:${a.counts.S4}/S3:${a.counts.S3}/S2:${a.counts.S2}/S1:${a.counts.S1})`,
      });
    }
    if (!abortedByAuth && collectPerf) {
      const perf = await readPerf(page);
      rec({
        action: 'perf-metrics', completed: perf.ok, isError: false, errorType: null,
        perf: perf.ok ? { lcp: perf.lcp, cls: perf.cls, fcp: perf.fcp, load: perf.load, ttfb: perf.ttfb } : { skipped: true, reason: perf.reason },
        note: perf.ok ? `LCP ${perf.lcp}ms · CLS ${perf.cls} · FCP ${perf.fcp}ms · load ${perf.load}ms` : `perf 수집 실패: ${perf.reason}`,
      });
    }

    await ctx.close();

    // 이 attempt 를 "실패"로 볼지: 기능 오류(isError) · 잡히지 않은 예외 · 5xx/요청실패.
    // 4xx 단독(리소스 404 등)은 결정적이라 재시도 트리거로 보지 않는다.
    const failed = recs.some((r) => r.isError)
      || consoleErrs.some((c) => c.type === 'pageerror')
      || netErrs.some((n) => n.kind === 'failed' || n.status >= 500);

    return { recs, consoleErrs, netErrs, failed, abortedByAuth, attempt };
  }

  for (const scenario of config.scenarios || []) {
    const personas = scenario.personas || defaultPersonas;
    for (const personaId of personas) {
      const maxAttempts = 1 + retries;
      let kept = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const r = await runAttempt(scenario, personaId, attempt);
        if (r.abortedByAuth || !r.failed || attempt === maxAttempts) { kept = r; break; }
        // 실패 + 재시도 여지 → 이 attempt 관측 폐기하고 재실행
      }

      // 이전 attempt 가 실패했지만 최종 attempt 가 통과 → flaky(불안정) 격리 대상
      const flaky = !kept.failed && kept.attempt > 1;
      for (const rc of kept.recs) results.push({ ...rc, flaky, attempts: kept.attempt });
      for (const c of kept.consoleErrs) consoleErrors.push({ ...c, flaky, attempts: kept.attempt });
      for (const n of kept.netErrs) networkErrors.push({ ...n, flaky, attempts: kept.attempt });

      if (kept.abortedByAuth) {
        await browser.close();
        finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, { abortedByAuth: true });
        return;
      }
    }
  }

  await browser.close();
  finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, {});
}

function finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, extra) {
  const flakyCount = results.filter((r) => r.flaky).length
    + consoleErrors.filter((c) => c.flaky).length
    + networkErrors.filter((n) => n.flaky).length;
  const summary = {
    ranAt: new Date().toISOString(),
    base,
    config: path.relative(ROOT, configPath),
    total: results.length,
    completed: results.filter((r) => r.completed).length,
    errors: results.filter((r) => r.isError && !r.flaky).length,
    flaky: flakyCount,
    consoleErrors,
    networkErrors,
    ...extra,
    results,
  };
  const out = path.join(obsDir, 'raw-observations.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`✓ 관측 기록: ${path.relative(ROOT, out)}  (${summary.completed}/${summary.total} 완료, 결함 ${summary.errors}, flaky ${flakyCount})`);
  if (extra.abortedByAuth) {
    console.error('⛔ 인증 리다이렉트로 중단 — save-auth-state 재실행 후 다시 돌리세요.');
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('run-ut 실패:', e.message);
  process.exitCode = 1;
});

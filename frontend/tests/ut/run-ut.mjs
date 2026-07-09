// run-ut.mjs — 범용 AI 사용성 테스트 러너 (설정 기반)
//
// ai-usability-test 스킬의 Step 3(Playwright 실행)을 구현한 재사용 드라이버.
// 프로젝트별 시나리오는 ut.config.mjs 에 정의하고, 이 러너가 3페르소나로 재현한다.
//
// 실행 (repo 루트에서):
//   UT_BASE=https://local-app.nexon.com node frontend/tests/ut/run-ut.mjs
//   UT_CONFIG=frontend/tests/ut/ut.config.mjs node frontend/tests/ut/run-ut.mjs
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
  // 노이즈(서드파티 스크립트·favicon 404·애널리틱스 등) 제외 패턴. 문자열/RegExp 모두 허용.
  const ignoreConsole = config.ignoreConsole || [];
  const ignoreNetwork = config.ignoreNetwork || [];
  const collectPerf = config.perf !== false; // 기본 활성, config.perf===false 로 끔

  const results = [];
  const consoleErrors = [];
  const networkErrors = [];

  const browser = await chromium.launch();

  for (const scenario of config.scenarios || []) {
    const personas = scenario.personas || defaultPersonas;
    for (const personaId of personas) {
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

      // 콘솔 error 로그 캡처 (ignore 패턴 제외)
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (ignoredBy(ignoreConsole, text)) return;
        consoleErrors.push({ persona: personaId, scenario: scenario.id, type: 'console', text });
      });
      // 잡히지 않은 런타임 예외 캡처 (console.error 보다 강한 신호)
      page.on('pageerror', (e) => {
        const text = e.message || String(e);
        if (ignoredBy(ignoreConsole, text)) return;
        consoleErrors.push({ persona: personaId, scenario: scenario.id, type: 'pageerror', text });
      });
      // 실패 응답(4xx/5xx) 캡처
      page.on('response', (resp) => {
        const status = resp.status();
        if (status < 400) return;
        const url = resp.url();
        if (ignoredBy(ignoreNetwork, url)) return;
        networkErrors.push({ persona: personaId, scenario: scenario.id, kind: 'status', status, method: resp.request().method(), url });
      });
      // 네트워크 자체 실패(DNS·차단·CORS 등)
      page.on('requestfailed', (req) => {
        const url = req.url();
        if (ignoredBy(ignoreNetwork, url)) return;
        networkErrors.push({ persona: personaId, scenario: scenario.id, kind: 'failed', status: 0, method: req.method(), url, failure: req.failure()?.errorText || '' });
      });

      const persona = makePersona(page, personaId);
      const t0 = Date.now();
      let maxHesitation = 0;

      const rec = (partial) => {
        results.push({
          persona: personaId,
          scenario: scenario.id,
          title: scenario.title,
          timestamp: Date.now(),
          durationMs: Date.now() - t0,
          ...partial,
        });
        if (typeof partial.hesitationMs === 'number') maxHesitation = Math.max(maxHesitation, partial.hesitationMs);
      };

      const shot = async (name) => {
        const p = path.join(shotsDir, `${personaId}-${scenario.id}-${name}.png`);
        await page.screenshot({ path: p }).catch(() => {});
        return path.relative(ROOT, p).replace(/\\/g, '/');
      };

      // auth 리다이렉트 가드가 붙은 goto
      const goto = async (relOrAbs, opts) => {
        const url = /^https?:\/\//.test(relOrAbs) ? relOrAbs : base + (relOrAbs.startsWith('/') ? '' : '/') + relOrAbs;
        await persona.goto(url, opts);
        const host = new URL(page.url()).host;
        if (guardHosts.some((h) => host.includes(h))) {
          throw new AuthRedirectError(`인증 화면으로 리다이렉트됨(${host}) — storageState 만료. save-auth-state 재실행 필요`);
        }
      };

      const scenarioCtx = { page, persona, base, rec, shot, goto, config, root: ROOT };

      try {
        await scenario.run(scenarioCtx);
      } catch (e) {
        const isAuth = e instanceof AuthRedirectError;
        rec({
          action: 'scenario-run',
          completed: false,
          isError: true,
          errorType: isAuth ? 'auth-redirect' : 'exception',
          severityHint: isAuth ? 'S4' : undefined,
          hesitationMs: maxHesitation,
          screenshotPath: await shot('error'),
          note: e.message,
        });
        if (isAuth) { await ctx.close(); await browser.close();
          finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, { abortedByAuth: true });
          return;
        }
      }

      // 접근성 자동 스캔 (scenario.a11y === false 로 끌 수 있음)
      if (scenario.a11y !== false) {
        const a = await scanA11y(page, scenario.a11yOptions);
        rec({
          action: 'a11y-axe-scan',
          completed: !a.skipped && a.counts.total === 0,
          isError: false,
          errorType: null,
          a11y: a.skipped ? { skipped: true, reason: a.reason } : a.counts,
          ariaIssue: a.skipped ? a.reason : (a.violations.map((v) => `${v.id}(${v.severity}×${v.nodes})`).join(', ') || null),
          violations: a.violations,
          note: a.skipped ? `axe 스킵: ${a.reason}` : `WCAG 위반 ${a.counts.total}건 (S4:${a.counts.S4}/S3:${a.counts.S3}/S2:${a.counts.S2}/S1:${a.counts.S1})`,
        });
      }

      // 성능 지표(Core Web Vitals) 수집
      if (collectPerf) {
        const perf = await readPerf(page);
        rec({
          action: 'perf-metrics',
          completed: perf.ok,
          isError: false,
          errorType: null,
          perf: perf.ok ? { lcp: perf.lcp, cls: perf.cls, fcp: perf.fcp, load: perf.load, ttfb: perf.ttfb } : { skipped: true, reason: perf.reason },
          note: perf.ok ? `LCP ${perf.lcp}ms · CLS ${perf.cls} · FCP ${perf.fcp}ms · load ${perf.load}ms` : `perf 수집 실패: ${perf.reason}`,
        });
      }

      await ctx.close();
    }
  }

  await browser.close();
  finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, {});
}

function finalize(results, consoleErrors, networkErrors, base, obsDir, configPath, extra) {
  const summary = {
    ranAt: new Date().toISOString(),
    base,
    config: path.relative(ROOT, configPath),
    total: results.length,
    completed: results.filter((r) => r.completed).length,
    errors: results.filter((r) => r.isError).length,
    consoleErrors,
    networkErrors,
    ...extra,
    results,
  };
  const out = path.join(obsDir, 'raw-observations.json');
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`✓ 관측 기록: ${path.relative(ROOT, out)}  (${summary.completed}/${summary.total} 완료, 오류 ${summary.errors})`);
  if (extra.abortedByAuth) {
    console.error('⛔ 인증 리다이렉트로 중단 — save-auth-state 재실행 후 다시 돌리세요.');
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('run-ut 실패:', e.message);
  process.exitCode = 1;
});

// ut-aggregate.mjs — raw-observations.json → UT_FINDINGS_REPORT.md 자동 집계
//
// ai-usability-test 스킬 Step 4(Nielsen 휴리스틱 리포트)를 자동화한다.
//   · Severity 자동 분류 (관측 신호 + axe WCAG 위반 + 시각적 회귀 통합)
//   · 완료율·WCAG 위반·시각적 회귀 집계
//   · ut: 게이트가 파싱하는 machine-readable 지표 주석 삽입
//
// visual-diff/diff-report.json 이 있으면(ut-visual-diff.mjs 실행 결과) 함께 집계한다 — 선택 사항.
//
// 실행 (repo 루트에서):
//   node frontend/tests/ut/ut-aggregate.mjs [specDir]
// specDir 미지정 시 ut.config.mjs 의 specDir 를 사용.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_PERF_BUDGET, classifyPerf } from './ut-perf.mjs';

const ROOT = path.resolve(process.env.UT_ROOT || process.cwd());

// Nielsen 10 휴리스틱 이름
const HEURISTIC = {
  N1: '시스템 상태 가시성', N2: '실세계 대응', N3: '사용자 통제·자유',
  N4: '일관성·표준', N5: '오류 예방', N6: '기억보다 인식',
  N7: '사용 유연성·효율', N8: '미적 절제', N9: '오류 복구 지원', N10: '도움말·문서',
};
// errorType → { heuristic, severity } 기본 매핑 (관측에 명시값 있으면 우선)
const ERROR_DEFAULTS = {
  'auth-redirect': { heuristic: 'N9', severity: 'S4' },
  'navigation-dead-end': { heuristic: 'N1', severity: 'S3' },
  'primary-not-tab-reachable': { heuristic: 'N7', severity: 'S4' },
  'minimize-no-restore': { heuristic: 'N3', severity: 'S3' },
  'reaction-no-feedback': { heuristic: 'N1', severity: 'S3' },
  'exception': { heuristic: 'N1', severity: 'S3' },
};
const SEV_LABEL = { S4: 'Critical', S3: 'Major', S2: 'Minor', S1: 'Cosmetic' };

async function loadConfig() {
  const candidates = [process.env.UT_CONFIG, 'ut.config.mjs', 'frontend/tests/ut/ut.config.mjs', 'tests/ut/ut.config.mjs']
    .filter(Boolean).map((p) => path.resolve(ROOT, p));
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      return mod.default ?? mod.config ?? {};
    }
  }
  return {};
}

async function resolveSpecDir(cfg) {
  if (process.argv[2]) return path.resolve(ROOT, process.argv[2]);
  if (cfg?.specDir) return path.resolve(ROOT, cfg.specDir);
  return path.resolve(ROOT, 'specs/ut');
}

function classify(r) {
  const def = ERROR_DEFAULTS[r.errorType] || {};
  return {
    severity: r.severityHint || def.severity || 'S3',
    heuristic: r.heuristic || def.heuristic || 'N1',
  };
}

function shortUrl(u) {
  try { const p = new URL(u); return p.pathname + (p.search ? '?…' : ''); } catch { return (u || '').slice(0, 60); }
}

// 비-Nielsen 카테고리 라벨
const KIND_LABEL = {
  'N-a11y': '접근성(WCAG)',
  'N-visual': '시각적 회귀(스크린샷 diff)',
  'N-runtime': '런타임 오류(콘솔/예외)',
  'N-network': '네트워크 오류',
  'N-perf': '성능(Core Web Vitals)',
};

async function main() {
  const cfg = await loadConfig();
  const specDir = await resolveSpecDir(cfg);
  const perfBudget = { ...DEFAULT_PERF_BUDGET, ...(cfg.perfBudget || {}) };
  const rawPath = path.join(specDir, 'observations', 'raw-observations.json');
  if (!fs.existsSync(rawPath)) {
    console.error(`raw-observations.json 없음: ${path.relative(ROOT, rawPath)} — run-ut.mjs 를 먼저 실행하세요.`);
    process.exitCode = 1;
    return;
  }
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const all = raw.results || [];
  // 기능 시나리오 관측만 (자동 스캔 관측 제외 — 완료율 분모 오염 방지)
  const AUTO_ACTIONS = new Set(['a11y-axe-scan', 'perf-metrics']);
  const funcObs = all.filter((r) => !AUTO_ACTIONS.has(r.action));
  const a11yObs = all.filter((r) => r.action === 'a11y-axe-scan' && r.a11y && !r.a11y.skipped);
  const a11ySkipped = all.some((r) => r.action === 'a11y-axe-scan' && r.a11y?.skipped);

  // 완료율
  const completeRate = funcObs.length ? Math.round((funcObs.filter((r) => r.completed).length / funcObs.length) * 100) : 0;

  // flaky(재시도 후 회복 → 격리): 결함 카운트에서 제외하고 별도 표기
  const flakyKeys = new Map(); // "persona/scenario" → attempts
  for (const r of all) if (r.flaky) flakyKeys.set(`${r.persona}/${r.scenario}`, r.attempts || 2);
  const flakyCount = flakyKeys.size;

  // Severity 카운트 (기능 결함 + WCAG 위반 통합)
  const counts = { S4: 0, S3: 0, S2: 0, S1: 0 };
  const findings = [];

  for (const r of funcObs.filter((r) => r.isError && !r.flaky)) {
    const { severity, heuristic } = classify(r);
    counts[severity]++;
    findings.push({
      severity, heuristic,
      title: `[${r.scenario}] ${r.errorType || 'issue'} — ${r.title || ''}`.trim(),
      persona: r.persona, scenario: r.scenario,
      symptom: r.note || '', screenshot: r.screenshotPath || null,
      kind: 'functional',
    });
  }

  let wcagTotal = 0;
  for (const r of a11yObs) {
    wcagTotal += r.a11y.total || 0;
    for (const v of (r.violations || [])) {
      counts[v.severity]++;
      findings.push({
        severity: v.severity, heuristic: 'N-a11y',
        title: `[WCAG] ${v.id} — ${v.help}`,
        persona: r.persona, scenario: r.scenario,
        symptom: `${v.nodes}개 노드 · ${(v.wcag || []).join('/')} · 대상: ${(v.targets || []).join(' , ')}`,
        screenshot: null, kind: 'a11y',
      });
    }
  }

  // 시각적 회귀 (ut-visual-diff.mjs 산출, 선택 사항 — 없으면 건너뜀)
  const visualPath = path.join(specDir, 'visual-diff', 'diff-report.json');
  let visualStatus = 'not-run'; // 'not-run' | 'skipped' | 'baseline-created' | 'ok'
  let visualFlagged = 0;
  if (fs.existsSync(visualPath)) {
    const vr = JSON.parse(fs.readFileSync(visualPath, 'utf-8'));
    if (vr.skipped) {
      visualStatus = 'skipped';
    } else if (vr.baselineCreated) {
      visualStatus = 'baseline-created';
    } else {
      visualStatus = 'ok';
      for (const d of (vr.diffs || []).filter((d) => d.flagged)) {
        visualFlagged++;
        const severity = d.diffPercent >= 15 ? 'S3' : 'S2';
        counts[severity]++;
        findings.push({
          severity, heuristic: 'N-visual',
          title: `[시각적 회귀] ${d.name} — ${d.diffPercent}% 변경`,
          persona: d.name.split('-')[0] || '-', scenario: d.name.split('-')[1] || '-',
          symptom: d.note || `베이스라인 대비 ${d.diffPercent}% 픽셀 변경`,
          screenshot: d.diffImage || null, kind: 'visual',
        });
      }
    }
  }

  // 콘솔/런타임 오류 승격 (dedupe: 같은 메시지는 1건 + 발생횟수)
  const consoleMap = new Map();
  for (const c of (raw.consoleErrors || []).filter((c) => !c.flaky)) {
    const key = (c.type || 'console') + '::' + (c.text || '').slice(0, 200);
    const e = consoleMap.get(key) || { ...c, count: 0 };
    e.count++; consoleMap.set(key, e);
  }
  let consoleCount = 0;
  for (const e of consoleMap.values()) {
    consoleCount++;
    const severity = e.type === 'pageerror' ? 'S3' : 'S2'; // 잡히지 않은 예외가 더 심각
    counts[severity]++;
    findings.push({
      severity, heuristic: 'N-runtime',
      title: `[런타임 오류] ${e.type === 'pageerror' ? '잡히지 않은 예외' : '콘솔 error'} — ${(e.text || '').slice(0, 80)}`,
      persona: e.persona, scenario: e.scenario,
      symptom: `${(e.text || '').slice(0, 300)}${e.count > 1 ? ` (×${e.count})` : ''}`,
      screenshot: null, kind: 'runtime',
    });
  }

  // 네트워크 실패(4xx/5xx·요청 실패) 승격 (dedupe: method+url+status)
  const netMap = new Map();
  for (const n of (raw.networkErrors || []).filter((n) => !n.flaky)) {
    const key = `${n.method} ${n.status} ${n.url}`;
    const e = netMap.get(key) || { ...n, count: 0 };
    e.count++; netMap.set(key, e);
  }
  let netCount = 0;
  for (const e of netMap.values()) {
    netCount++;
    const severity = e.status >= 500 || e.kind === 'failed' ? 'S3' : 'S2'; // 5xx·요청실패 > 4xx
    counts[severity]++;
    const statusLabel = e.kind === 'failed' ? `요청 실패(${e.failure || 'network error'})` : `HTTP ${e.status}`;
    findings.push({
      severity, heuristic: 'N-network',
      title: `[네트워크] ${statusLabel} — ${e.method} ${shortUrl(e.url)}`,
      persona: e.persona, scenario: e.scenario,
      symptom: `${e.method} ${e.url} → ${statusLabel}${e.count > 1 ? ` (×${e.count})` : ''}`,
      screenshot: null, kind: 'network',
    });
  }

  // 성능(Core Web Vitals) — 페르소나×시나리오별 관측 중 최악값을 대표로 집계
  const perfObs = all.filter((r) => r.action === 'perf-metrics' && r.perf && !r.perf.skipped);
  const perfSkipped = all.some((r) => r.action === 'perf-metrics' && r.perf?.skipped);
  let worstLcp = 0, worstCls = 0, worstLcpPersona = '-', worstClsPersona = '-';
  for (const r of perfObs) {
    if (r.perf.lcp > worstLcp) { worstLcp = r.perf.lcp; worstLcpPersona = r.persona; }
    if (r.perf.cls > worstCls) { worstCls = r.perf.cls; worstClsPersona = r.persona; }
    for (const ex of classifyPerf(r.perf, perfBudget)) {
      counts[ex.severity]++;
      findings.push({
        severity: ex.severity, heuristic: 'N-perf',
        title: `[성능] ${ex.metric} 예산 초과 — ${r.persona}`,
        persona: r.persona, scenario: r.scenario,
        symptom: ex.note, screenshot: null, kind: 'perf',
      });
    }
  }
  const clsMetric = Math.round(worstCls * 1000); // 게이트는 정수만 파싱 → CLS×1000 (0.1 → 100)

  const order = ['S4', 'S3', 'S2', 'S1'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  const blocker = counts.S4 > 0 ? `⛔ 배포 블로커 (S4 ${counts.S4}건)` : '✅ 배포 블로커 없음';
  const metrics = `S4=${counts.S4} S3=${counts.S3} S2=${counts.S2} S1=${counts.S1} complete=${completeRate} wcag=${wcagTotal} visual=${visualFlagged} console=${consoleCount} net=${netCount} lcp=${worstLcp} cls=${clsMetric} flaky=${flakyCount}`;

  const md = [];
  md.push(`# UT_FINDINGS_REPORT — ${path.basename(path.dirname(specDir)) || '프로젝트'}`);
  md.push('');
  md.push(`**기반 데이터**: observations/raw-observations.json  `);
  md.push(`**실행**: ${raw.ranAt || '-'} · base=${raw.base || '-'}  `);
  md.push(`**분석일**: ${new Date().toISOString().slice(0, 10)}`);
  md.push('');
  md.push('<!-- 자동 생성: ut-aggregate.mjs — 수정 시 재생성으로 덮어써짐 -->');
  md.push(`<!-- ut-metrics: ${metrics} -->`);
  md.push('');
  md.push('## Executive Summary');
  md.push('');
  md.push('| 등급 | 건수 |');
  md.push('|---|---|');
  for (const s of order) md.push(`| ${s} ${SEV_LABEL[s]} | ${counts[s]} |`);
  md.push('');
  md.push(`- **시나리오 완료율**: ${completeRate}% (${funcObs.filter((r) => r.completed).length}/${funcObs.length})`);
  md.push(`- **WCAG 위반(axe)**: ${a11ySkipped && a11yObs.length === 0 ? '스캔 안 됨 (@axe-core/playwright 미설치)' : `${wcagTotal}건`}`);
  const visualLine = {
    'not-run': '실행 안 됨 (`node frontend/tests/ut/ut-visual-diff.mjs` 미실행)',
    skipped: '스캔 안 됨 (pixelmatch/pngjs 미설치)',
    'baseline-created': '베이스라인 최초 생성 — 이번 실행은 비교 대상 없음',
    ok: `${visualFlagged}건`,
  }[visualStatus];
  md.push(`- **시각적 회귀(스크린샷 diff)**: ${visualLine}`);
  md.push(`- **런타임 오류(콘솔/예외)**: ${consoleCount}건`);
  md.push(`- **네트워크 오류(4xx/5xx·요청실패)**: ${netCount}건`);
  const perfLine = perfObs.length
    ? `LCP ${worstLcp}ms(${worstLcpPersona}) · CLS ${worstCls}(${worstClsPersona})  [예산 LCP≤${perfBudget.lcp}ms/CLS≤${perfBudget.cls}]`
    : (perfSkipped ? '수집 실패' : '수집 안 됨 (config.perf=false)');
  md.push(`- **성능(Core Web Vitals)**: ${perfLine}`);
  md.push(`- **flaky(재시도 후 회복·격리)**: ${flakyCount}건${flakyCount ? ' — 결함 카운트 제외, 아래 격리 섹션 참조' : ''}`);
  md.push(`- **배포 판정**: ${blocker}`);
  md.push('');
  md.push('## 결함 목록 (심각도 순)');
  md.push('');
  if (findings.length === 0) {
    md.push('_결함 없음 — 전 시나리오 완료 · WCAG/시각적회귀/런타임/네트워크/성능 이상 0._');
  } else {
    findings.forEach((f, i) => {
      const hName = KIND_LABEL[f.heuristic] || `${f.heuristic} ${HEURISTIC[f.heuristic] || ''}`.trim();
      md.push(`### [F-${String(i + 1).padStart(3, '0')}] ${f.title}`);
      md.push(`- **Severity**: ${f.severity} — ${SEV_LABEL[f.severity]}`);
      md.push(`- **휴리스틱**: ${hName}`);
      md.push(`- **영향 페르소나**: ${f.persona}`);
      md.push(`- **관찰된 증상**: ${f.symptom}`);
      if (f.screenshot) md.push(`- **스크린샷**: ${f.screenshot}`);
      md.push('');
    });
  }

  if (flakyCount > 0) {
    md.push('## 불안정(flaky) — 재시도 후 통과, 격리됨');
    md.push('');
    md.push('첫 실행에서 실패했으나 재시도에서 회복된 케이스. **결함 카운트·게이트에서 제외**하되, 불안정 신호로 기록한다(반복되면 조사 필요).');
    md.push('');
    for (const [key, attempts] of flakyKeys) md.push(`- \`${key}\` — ${attempts}회 시도 후 통과`);
    md.push('');
  }

  md.push('## 한계');
  md.push('- AI 페르소나는 피로·주의분산 등 인지 노이즈를 재현하지 못한다 → 인간 UT 보완 권장.');
  if (a11ySkipped) md.push('- 접근성 자동 스캔이 비활성(axe 미설치) — WCAG 카운트는 0으로 보고됐다. `npm i -D @axe-core/playwright axe-core` 후 재실행.');
  if (visualStatus === 'not-run') md.push('- 시각적 회귀 diff 미실행 — `node frontend/tests/ut/ut-visual-diff.mjs` 로 이전 실행과 비교하면 레이아웃 회귀를 잡을 수 있다.');
  if (visualStatus === 'skipped') md.push('- 시각적 회귀 diff가 비활성(pixelmatch/pngjs 미설치) — `npm i -D pixelmatch pngjs` 후 재실행.');
  if (visualStatus === 'baseline-created') md.push('- 시각적 회귀 베이스라인이 이번 실행에서 처음 생성됐다 — 다음 실행부터 실제 diff가 시작된다.');
  if (consoleCount > 0 || netCount > 0) md.push('- 런타임/네트워크 오류는 노이즈(서드파티·애널리틱스 등)를 포함할 수 있다 → `ut.config.mjs` 의 `ignoreConsole`/`ignoreNetwork` 로 걸러낸다.');
  md.push('- 성능(LCP/CLS)은 자동 시나리오 중 측정한 근사치다(LCP는 상호작용 시 확정). 정밀 측정은 Lighthouse 등으로 보완.');

  const outPath = path.join(specDir, 'UT_FINDINGS_REPORT.md');
  fs.writeFileSync(outPath, md.join('\n') + '\n');
  console.log(`✓ 리포트 생성: ${path.relative(ROOT, outPath)}`);
  console.log(`  지표: ${metrics}  → ${blocker}`);
}

main().catch((e) => { console.error('ut-aggregate 실패:', e.message); process.exitCode = 1; });

// ut-calibrate.mjs — 실측(real-ut-sessions) vs AI 시뮬레이션(raw-observations) gap 계산기
// real-ut-intake 스킬이 저장한 refs/ux-research/real-ut-sessions/{scenario-id}/*.md 와
// run-ut.mjs 가 낸 raw-observations.json 을 scenario-id 기준으로 비교해
// CALIBRATION_REPORT.md 와 파라미터 조정 제안을 산출한다.
//
// 사용법:
//   node frontend/tests/ut/ut-calibrate.mjs --scenario S-B01 \
//     --real refs/ux-research/real-ut-sessions/S-B01 \
//     --ai specs/{NNN}/ut/raw-observations.json \
//     --out specs/{NNN}/ut/CALIBRATION_REPORT.md
//
// 이 스크립트는 세션을 만들지 않는다 — real-ut-intake 로 이미 정규화된 세션 파일을 입력으로만 받는다.

import fs from 'node:fs';
import path from 'node:path';

/** real-ut-sessions/{scenario-id}/*.md 를 파싱해 관측 필드 배열로 반환한다. */
function loadRealSessions(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseSessionLog(path.join(dir, f)));
}

/** REAL_UT_SESSION_LOG 템플릿의 "태스크 관측" 표를 최소한으로 파싱한다.
 *  실제 구현에서는 마크다운 표 파서(예: remark)를 쓰는 걸 권장 — 여기선 정규식 스켈레톤만 제공. */
function parseSessionLog(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const grab = (label) => {
    const m = text.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|]+?)\\s*\\|`));
    return m ? m[1].trim() : null;
  };
  return {
    file: filePath,
    completed: /완료 여부\s*\|\s*✅/.test(text),
    durationSec: parseFloat(grab('총 소요 시간')) || null,
    errorCount: parseInt(grab('오류 횟수'), 10) || 0,
    hesitation: grab('최장 머뭇거림'),
    dropoffPoint: grab('이탈 지점'),
  };
}

// 자동 스캔 관측(a11y-axe-scan/perf-metrics)은 완료 신호가 아니므로 제외한다 — ut-aggregate.mjs 와 동일 관례.
const AUTO_ACTIONS = new Set(['a11y-axe-scan', 'perf-metrics']);

/** raw-observations.json (run-ut.mjs 산출) 에서 동일 scenario·persona 의 AI 관측치를 추출한다.
 *  run-ut.mjs 의 finalize() 는 관측 배열을 `results` 필드에 담는다(`observations` 아님) — 여기서
 *  잘못된 키를 읽으면 실 데이터가 아무리 쌓여도 조용히 빈 배열만 반환되어 캘리브레이션이 항상 N/A 로 나온다. */
function loadAiObservations(jsonPath, scenarioId, personaId) {
  if (!fs.existsSync(jsonPath)) return [];
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const records = Array.isArray(raw) ? raw : raw.results || [];
  return records.filter(
    (r) => r.scenario === scenarioId && r.persona === personaId && !AUTO_ACTIONS.has(r.action)
  );
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const stddev = (arr) => {
  if (arr.length < 2) return null;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

/** 실측 vs AI 지표 gap을 계산하고, 임계치를 넘으면 파라미터 조정 제안을 만든다. */
function computeGap(realSessions, aiObservations) {
  const realCompletionRate = realSessions.length
    ? realSessions.filter((s) => s.completed).length / realSessions.length
    : null;
  const aiCompletionRate = aiObservations.length
    ? aiObservations.filter((o) => o.completed).length / aiObservations.length
    : null;

  const realDurations = realSessions.map((s) => s.durationSec).filter(Boolean);
  // rec() 은 durationMs(ms 단위, 시나리오 시작 t0 기준 누적)로 기록한다 — durationSec 필드는 없다.
  const aiDurations = aiObservations
    .map((o) => (typeof o.durationMs === 'number' ? o.durationMs / 1000 : null))
    .filter((v) => Number.isFinite(v) && v > 0);

  return {
    sampleSize: { real: realSessions.length, ai: aiObservations.length },
    completionRate: {
      real: realCompletionRate,
      ai: aiCompletionRate,
      diff: realCompletionRate != null && aiCompletionRate != null
        ? +(aiCompletionRate - realCompletionRate).toFixed(3)
        : null,
    },
    durationSec: {
      real: { mean: mean(realDurations), sd: stddev(realDurations) },
      ai: { mean: mean(aiDurations), sd: stddev(aiDurations) },
      diff: mean(realDurations) != null && mean(aiDurations) != null
        ? +(mean(aiDurations) - mean(realDurations)).toFixed(1)
        : null,
    },
  };
}

/** gap이 크면 ut-personas.mjs 파라미터 조정 방향을 제안 (자동 반영은 하지 않음 — 제안만). */
function suggestParamAdjustment(gap, personaId) {
  const suggestions = [];
  if (gap.durationSec.diff != null && Math.abs(gap.durationSec.diff) > 5) {
    const direction = gap.durationSec.diff < 0 ? '상향' : '하향';
    suggestions.push(
      `${personaId}.thinkMin/thinkMax 를 ${direction} 조정 검토 ` +
      `(AI 평균 ${gap.durationSec.ai.mean}s vs 실측 평균 ${gap.durationSec.real.mean}s, ` +
      `diff=${gap.durationSec.diff}s)`
    );
  }
  if (gap.completionRate.diff != null && Math.abs(gap.completionRate.diff) > 0.1) {
    suggestions.push(
      `완료율 gap ${(gap.completionRate.diff * 100).toFixed(1)}%p — ` +
      `AI가 ${gap.completionRate.diff > 0 ? '낙관적' : '비관적'}. ` +
      `오류 주입 확률(misclick/hesitation 임계) 조정 검토`
    );
  }
  if (!suggestions.length) suggestions.push('임계치(±10%p 완료율, ±5s 시간) 이내 — 캘리브레이션 양호');
  return suggestions;
}

function renderReport(scenarioId, personaId, gap, suggestions) {
  const calibrated =
    gap.completionRate.diff != null &&
    Math.abs(gap.completionRate.diff) <= 0.1 &&
    gap.durationSec.diff != null &&
    Math.abs(gap.durationSec.diff) <= 5;

  return `# CALIBRATION_REPORT — ${scenarioId}

**페르소나**: ${personaId}
**실측 표본 수**: ${gap.sampleSize.real} (n<3이면 참고용)
**AI 시뮬레이션 표본 수**: ${gap.sampleSize.ai}
**캘리브레이션 상태**: ${calibrated ? '✅ calibrated' : '⚠️ needs-tuning'}

## 완료율
| | 값 |
|---|---|
| 실측 | ${gap.completionRate.real ?? 'N/A'} |
| AI | ${gap.completionRate.ai ?? 'N/A'} |
| diff | ${gap.completionRate.diff ?? 'N/A'} |

## 소요 시간 (초)
| | 평균 | 표준편차 |
|---|---|---|
| 실측 | ${gap.durationSec.real.mean ?? 'N/A'} | ${gap.durationSec.real.sd ?? 'N/A'} |
| AI | ${gap.durationSec.ai.mean ?? 'N/A'} | ${gap.durationSec.ai.sd ?? 'N/A'} |
| diff | ${gap.durationSec.diff ?? 'N/A'} | — |

## 파라미터 조정 제안 (자동 반영 아님 — 사람 검토 후 ut-personas.mjs 에 수동 반영)
${suggestions.map((s) => `- ${s}`).join('\n')}

> n<3 표본에서 나온 제안은 확정 근거로 쓰지 말 것. real-ut-sessions 누적 후 재실행 권장.
`;
}

// --- CLI 엔트리 (간이 인자 파서 — 필요시 yargs 등으로 교체 가능) ---
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

async function main() {
  const { scenario, real, ai, out, persona = 'beginner' } = parseArgs(process.argv.slice(2));
  if (!scenario || !real || !ai || !out) {
    console.error('사용법: node ut-calibrate.mjs --scenario S-B01 --real <dir> --ai <raw-observations.json> --out <report.md> [--persona beginner]');
    process.exit(1);
  }
  const realSessions = loadRealSessions(real);
  const aiObservations = loadAiObservations(ai, scenario, persona);
  const gap = computeGap(realSessions, aiObservations);
  const suggestions = suggestParamAdjustment(gap, persona);
  const report = renderReport(scenario, persona, gap, suggestions);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, report, 'utf-8');
  console.log(`CALIBRATION_REPORT 생성: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

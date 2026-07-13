import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { findTasksFile, parseTasks, findTask } from "../shared/tasks-parser.js";

export interface TaskDoneResult {
  passed: boolean;
  reason: string;
  criteria_results?: Array<{ criterion: string; passed: boolean; reason: string }>;
}

/**
 * done 기준 한 항목을 실행하여 pass/fail 반환.
 *
 * 타입 명시 형식 (우선 처리):
 *   file: {path}              — 파일 존재 확인
 *   cmd: {shell command}      — 셸 명령 실행 (exit 0 = 통과)
 *   contains: {path} :: {str} — 파일 내 문자열 포함 확인
 *   ut: {report} :: {rules}   — AI UT 리포트 Severity 임계 검증 (예: S4=0,S3<=2)
 *
 * 레거시 자연어 형식 (하위 호환):
 *   "파일 {path} 존재" / "file {path} exists"
 *   "{file} 내 {pattern} 존재"
 *   그 외 → 셸 명령으로 실행
 */
async function executeCriterion(
  criterion: string,
  cwd: string
): Promise<{ passed: boolean; reason: string }> {
  const trimmed = criterion.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") {
    return { passed: false, reason: "빈 done 기준" };
  }

  // ── 타입 명시 형식 (우선) ────────────────────────────────────────────────

  // file: {path}
  const fileTyped = trimmed.match(/^file:\s*(.+)$/i);
  if (fileTyped) {
    const filePath = path.resolve(cwd, fileTyped[1].trim());
    const exists = fs.existsSync(filePath);
    return {
      passed: exists,
      reason: exists ? `파일 존재: ${fileTyped[1].trim()}` : `파일 없음: ${fileTyped[1].trim()}`,
    };
  }

  // contains: {path} :: {string}
  const containsTyped = trimmed.match(/^contains:\s*(.+?)\s*::\s*(.+)$/i);
  if (containsTyped) {
    const [, filePart, pattern] = containsTyped;
    const targetPath = path.resolve(cwd, filePart.trim());
    try {
      const content = fs.readFileSync(targetPath, "utf-8");
      const found = content.includes(pattern.trim());
      return found
        ? { passed: true, reason: `패턴 발견: "${pattern.trim()}"` }
        : { passed: false, reason: `패턴 없음: "${pattern.trim()}" in ${filePart.trim()}` };
    } catch (e: unknown) {
      return { passed: false, reason: `파일 읽기 실패: ${filePart.trim()} — ${(e as Error).message}` };
    }
  }

  // regex: {path} :: {pattern}
  // 파일 내용에서 정규식 매칭 여부를 확인한다.
  // 예: regex: src/api.ts :: export (default )?function getUserById
  const regexTyped = trimmed.match(/^regex:\s*(.+?)\s*::\s*(.+)$/i);
  if (regexTyped) {
    const [, filePart, regexStr] = regexTyped;
    const targetPath = path.resolve(cwd, filePart.trim());
    try {
      const content = fs.readFileSync(targetPath, "utf-8");
      let re: RegExp;
      try {
        re = new RegExp(regexStr.trim());
      } catch (e: unknown) {
        return { passed: false, reason: `잘못된 정규식: "${regexStr.trim()}" — ${(e as Error).message}` };
      }
      const found = re.test(content);
      return found
        ? { passed: true, reason: `정규식 매칭: /${regexStr.trim()}/` }
        : { passed: false, reason: `정규식 불일치: /${regexStr.trim()}/ in ${filePart.trim()}` };
    } catch (e: unknown) {
      return { passed: false, reason: `파일 읽기 실패: ${filePart.trim()} — ${(e as Error).message}` };
    }
  }

  // json: {path} :: {dot-path}[={expected}]
  // JSON 파일에서 dot-path 값의 존재(또는 일치)를 확인한다.
  // 예: json: package.json :: .scripts.build
  //     json: package.json :: .name=my-app
  const jsonTyped = trimmed.match(/^json:\s*(.+?)\s*::\s*(.+)$/i);
  if (jsonTyped) {
    const [, filePart, expr] = jsonTyped;
    const targetPath = path.resolve(cwd, filePart.trim());
    try {
      const raw = JSON.parse(fs.readFileSync(targetPath, "utf-8")) as unknown;
      const eqIdx = expr.indexOf("=");
      const dotPath = eqIdx >= 0 ? expr.slice(0, eqIdx).trim() : expr.trim();
      const expected = eqIdx >= 0 ? expr.slice(eqIdx + 1).trim() : null;

      const value = resolveDotPath(raw, dotPath);

      if (expected !== null) {
        const match = String(value) === expected;
        return match
          ? { passed: true, reason: `JSON 값 일치: ${dotPath} = "${expected}"` }
          : { passed: false, reason: `JSON 값 불일치: ${dotPath} = "${String(value)}" (기대: "${expected}")` };
      }

      const truthy = value !== undefined && value !== null && value !== false && value !== "";
      return truthy
        ? { passed: true, reason: `JSON 경로 존재: ${dotPath} = ${JSON.stringify(value)}` }
        : { passed: false, reason: `JSON 경로 없음 또는 falsy: ${dotPath} in ${filePart.trim()}` };
    } catch (e: unknown) {
      return { passed: false, reason: `JSON 읽기/파싱 실패: ${filePart.trim()} — ${(e as Error).message}` };
    }
  }

  // coverage: {source_path} :: {threshold}
  // 커버리지 리포트(coverage/coverage-summary.json 또는 coverage.json)를 읽어
  // 지정 경로의 라인 커버리지가 임계값 이상인지 확인한다.
  // 리포트는 cmd: 기준에서 테스트 실행 시 미리 생성되어 있어야 한다.
  const coverageTyped = trimmed.match(/^coverage:\s*(.+?)\s*::\s*(\d+)%?$/i);
  if (coverageTyped) {
    const [, sourcePath, thresholdStr] = coverageTyped;
    return checkCoverageReport(sourcePath.trim(), parseInt(thresholdStr, 10), cwd);
  }

  // ut: {report 경로} :: {S4=0,S3<=2,complete>=80,wcag=0}
  // AI 사용성 테스트(ai-usability-test) 리포트에서 지표를 추출하여 임계 규칙을 모두 만족하는지 확인한다.
  // 지표: Severity 카운트(S4/S3/S2/S1) + complete(완료율%) + wcag(접근성 위반) 등 임의 키.
  // 예: ut: specs/001/ut/UT_FINDINGS_REPORT.md :: S4=0,S3<=2,complete>=80
  const utTyped = trimmed.match(/^ut:\s*(.+?)\s*::\s*(.+)$/i);
  if (utTyped) {
    const [, reportPart, criteriaStr] = utTyped;
    return checkUtReport(reportPart.trim(), criteriaStr.trim(), cwd);
  }

  // token: {report 경로} :: {token_coverage>=90,token_violations=0}
  // 디자인 토큰 준수(token-conformance) 리포트의 machine-readable 지표를 임계 검증한다.
  // 지표: token_coverage(토큰 참조 비율%) / token_violations(신규 하드코딩 건수) 등.
  // 예: token: specs/001/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
  const tokenTyped = trimmed.match(/^token:\s*(.+?)\s*::\s*(.+)$/i);
  if (tokenTyped) {
    const [, reportPart, criteriaStr] = tokenTyped;
    return checkTokenReport(reportPart.trim(), criteriaStr.trim(), cwd);
  }

  // cmd: {shell command}
  const cmdTyped = trimmed.match(/^cmd:\s*(.+)$/i);
  if (cmdTyped) {
    return runShellCommand(cmdTyped[1].trim(), cwd);
  }

  // ── 레거시 자연어 형식 (하위 호환) ──────────────────────────────────────

  // "파일 {path} 존재" 또는 "file {path} exists?"
  const fileMatch = trimmed.match(/^(?:파일|file)\s+(.+?)\s+(?:존재|exist[s]?)$/i);
  if (fileMatch) {
    const filePath = path.resolve(cwd, fileMatch[1].trim());
    const exists = fs.existsSync(filePath);
    return {
      passed: exists,
      reason: exists ? `파일 존재 확인: ${fileMatch[1]}` : `파일 없음: ${fileMatch[1]}`,
    };
  }

  // "{file} 내 {pattern} 존재"
  // execSync + grep 대신 Node.js fs로 직접 읽어 검사한다.
  // grep에 패턴을 셸 문자열로 전달하면 $, `, \ 등으로 인한 인젝션 위험이 있다.
  const patternMatch = trimmed.match(/^(.+?)\s+내\s+(.+?)\s+존재$/);
  if (patternMatch) {
    const [, filePart, pattern] = patternMatch;
    const targetPath = path.resolve(cwd, filePart.trim());
    try {
      const content = fs.readFileSync(targetPath, "utf-8");
      const found = content.includes(pattern.trim());
      return found
        ? { passed: true, reason: `패턴 발견: "${pattern}"` }
        : { passed: false, reason: `패턴 없음: "${pattern}" in ${filePart}` };
    } catch (e: unknown) {
      return { passed: false, reason: `파일 읽기 실패: ${filePart} — ${(e as Error).message}` };
    }
  }

  // 그 외 — 셸 명령으로 실행 (레거시: pytest, npm run build 등)
  return runShellCommand(trimmed, cwd);
}

/**
 * dot-path 표기로 JSON 객체를 탐색한다.
 * ".scripts.build" → obj.scripts.build
 * 선행 "."은 무시한다.
 */
function resolveDotPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.replace(/^\./, "").split(".").filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 셸 명령을 실행하여 exit 0 = 통과로 판단한다. */
function runShellCommand(command: string, cwd: string): { passed: boolean; reason: string } {
  const LONG_RUNNING_PREFIXES = [
    "npm run build", "yarn build", "pnpm build",
    "npm run test", "yarn test", "pnpm test",
    "pytest", "python -m pytest",
    "cargo build", "cargo test",
    "go build", "go test",
    "mvn", "gradle",
  ];
  const isLongRunning = LONG_RUNNING_PREFIXES.some((prefix) => command.startsWith(prefix));
  const timeout = isLongRunning ? 600_000 : 30_000;

  try {
    const output = execSync(command, { cwd, stdio: "pipe", timeout });
    const stdout = output.toString().trim();
    return { passed: true, reason: stdout.substring(0, 300) || "명령 성공 (exit 0)" };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    const stderr = err.stderr?.toString().trim().substring(0, 500) ?? "";
    const stdout = err.stdout?.toString().trim().substring(0, 500) ?? "";
    return { passed: false, reason: stderr || stdout || err.message || "명령 실패 (non-zero exit)" };
  }
}

/**
 * 커버리지 리포트를 파싱하여 지정 경로가 임계값을 충족하는지 확인한다.
 *
 * 지원 포맷:
 *   Istanbul/v8  — coverage/coverage-summary.json  (Vitest, Jest)
 *   pytest-cov   — coverage.json                   (Python pytest)
 *
 * 리포트가 없으면 실패를 반환한다.
 * 리포트 생성은 done 기준의 cmd: 항목이 담당한다.
 */
function checkCoverageReport(
  sourcePath: string,
  threshold: number,
  cwd: string
): { passed: boolean; reason: string } {
  const istanbulCandidates = [
    path.join(cwd, "coverage", "coverage-summary.json"),
    path.join(cwd, "frontend", "coverage", "coverage-summary.json"),
    path.join(cwd, "backend", "coverage", "coverage-summary.json"),
  ];
  const pytestCandidates = [
    path.join(cwd, "coverage.json"),
    path.join(cwd, "backend", "coverage.json"),
  ];

  const istanbulReport = istanbulCandidates.find((p) => fs.existsSync(p));
  const pytestReport = pytestCandidates.find((p) => fs.existsSync(p));

  if (!istanbulReport && !pytestReport) {
    return {
      passed: false,
      reason:
        `coverage: 리포트 없음 — done 기준에 테스트 실행 cmd를 먼저 추가하세요.\n` +
        `  JS/TS:  cmd: npx vitest run --coverage\n` +
        `  Python: cmd: pytest --cov=${sourcePath} --cov-report=json -q`,
    };
  }

  if (istanbulReport) {
    return parseIstanbulReport(istanbulReport, sourcePath, threshold, cwd);
  }
  return parsePytestCovReport(pytestReport!, sourcePath, threshold, cwd);
}

/** Istanbul/v8 coverage-summary.json 파싱 */
function parseIstanbulReport(
  reportPath: string,
  sourcePath: string,
  threshold: number,
  cwd: string
): { passed: boolean; reason: string } {
  type IstanbulEntry = { lines: { total: number; covered: number; pct: number } };
  let report: Record<string, IstanbulEntry>;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as Record<string, IstanbulEntry>;
  } catch (e: unknown) {
    return { passed: false, reason: `coverage: 리포트 파싱 실패 — ${(e as Error).message}` };
  }

  const normalizedSource = path.resolve(cwd, sourcePath);
  let totalLines = 0;
  let coveredLines = 0;
  let matchCount = 0;

  for (const [key, val] of Object.entries(report)) {
    if (key === "total") continue;
    const absKey = path.isAbsolute(key) ? key : path.resolve(cwd, key);
    if (absKey === normalizedSource || absKey.startsWith(normalizedSource + path.sep)) {
      totalLines += val.lines.total;
      coveredLines += val.lines.covered;
      matchCount++;
    }
  }

  if (matchCount === 0) {
    const total = report["total"];
    if (total) {
      return formatCoverageResult(total.lines.pct, threshold, sourcePath, "프로젝트 전체");
    }
    return {
      passed: false,
      reason: `coverage: "${sourcePath}" 경로를 리포트에서 찾을 수 없음 (${path.relative(cwd, reportPath)})`,
    };
  }

  const pct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
  return formatCoverageResult(pct, threshold, sourcePath, `${matchCount}개 파일`);
}

/** pytest-cov coverage.json 파싱 */
function parsePytestCovReport(
  reportPath: string,
  sourcePath: string,
  threshold: number,
  cwd: string
): { passed: boolean; reason: string } {
  type PytestEntry = { summary?: { percent_covered?: number; covered_lines?: number; num_statements?: number } };
  type PytestReport = { totals?: { percent_covered?: number }; files?: Record<string, PytestEntry> };
  let report: PytestReport;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as PytestReport;
  } catch (e: unknown) {
    return { passed: false, reason: `coverage: 리포트 파싱 실패 — ${(e as Error).message}` };
  }

  const normalizedSource = path.resolve(cwd, sourcePath);
  let totalStatements = 0;
  let coveredStatements = 0;
  let matchCount = 0;

  if (report.files) {
    for (const [key, val] of Object.entries(report.files)) {
      const absKey = path.isAbsolute(key) ? key : path.resolve(cwd, key);
      if (absKey === normalizedSource || absKey.startsWith(normalizedSource + path.sep)) {
        totalStatements += val.summary?.num_statements ?? 0;
        coveredStatements += val.summary?.covered_lines ?? 0;
        matchCount++;
      }
    }
  }

  if (matchCount === 0) {
    const pct = report.totals?.percent_covered;
    if (pct !== undefined) {
      return formatCoverageResult(pct, threshold, sourcePath, "프로젝트 전체");
    }
    return {
      passed: false,
      reason: `coverage: "${sourcePath}" 경로를 리포트에서 찾을 수 없음 (${path.relative(cwd, reportPath)})`,
    };
  }

  const pct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
  return formatCoverageResult(pct, threshold, sourcePath, `${matchCount}개 파일`);
}

function formatCoverageResult(
  pct: number,
  threshold: number,
  sourcePath: string,
  scope: string
): { passed: boolean; reason: string } {
  const rounded = Math.round(pct * 10) / 10;
  const passed = rounded >= threshold;
  return {
    passed,
    reason: passed
      ? `커버리지 통과: ${rounded}% ≥ ${threshold}% (${sourcePath}, ${scope})`
      : `커버리지 미달: ${rounded}% < ${threshold}% (${sourcePath}, ${scope})`,
  };
}

/**
 * AI 사용성 테스트 리포트(UT_FINDINGS_REPORT.md)를 파싱하여
 * 지표 임계 규칙을 모두 만족하는지 확인한다.
 *
 * 지표 추출 우선순위:
 *   1) machine-readable 주석 (ut-aggregate.mjs 산출) — 가장 신뢰:
 *        <!-- ut-metrics: S4=0 S3=1 S2=2 S1=0 complete=92 wcag=0 -->
 *   2) 폴백: Executive Summary 표의 "S4 Critical | N" 행에서 Severity 카운트만 추출.
 *
 * 규칙 형식: 콤마로 구분된 "{key}{op}{value}" 목록. key 는 대소문자 무관.
 *   지원 키: S1~S4(결함 카운트), complete(완료율%), wcag(접근성 위반) 등 리포트가 노출하는 임의 지표.
 *   지원 연산자: =, ==, !=, <, <=, >, >=
 *   예: "S4=0,S3<=2,complete>=80,wcag=0"
 *
 * 리포트가 없거나 지표를 한 건도 못 찾으면 실패로 처리한다
 * (UT 미실행을 통과로 오인하지 않기 위함).
 */
function checkUtReport(
  reportPath: string,
  criteriaStr: string,
  cwd: string
): { passed: boolean; reason: string } {
  const targetPath = path.resolve(cwd, reportPath);

  let content: string;
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch (e: unknown) {
    return {
      passed: false,
      reason:
        `ut: 리포트 없음 — ${reportPath}\n` +
        `  ai-usability-test 스킬을 먼저 실행해 UT_FINDINGS_REPORT.md 를 생성하세요.\n` +
        `  (${(e as Error).message})`,
    };
  }

  const counts: Record<string, number> = {};

  // 1) machine-readable 지표 주석 우선: <!-- ut-metrics: S4=0 S3=1 complete=92 wcag=0 -->
  const metricsLine = content.match(/ut-metrics:\s*([^\n>]+)/i);
  if (metricsLine) {
    for (const pair of metricsLine[1].trim().split(/[\s,]+/)) {
      const kv = pair.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(\d+)$/);
      if (kv) counts[kv[1].toUpperCase()] = parseInt(kv[2], 10);
    }
  }

  // 2) 폴백: Executive Summary 의 "S4 ... | N" 표 행에서 Severity 카운트를 추출.
  //    표 셀(| S4 Critical | 0 |) 과 인라인(S4=0, S4: 0) 모두 허용한다.
  if (Object.keys(counts).length === 0) {
    for (const level of ["S1", "S2", "S3", "S4"]) {
      const re = new RegExp(`${level}\\b[^\\d\\n]*?(\\d+)`, "i");
      const m = content.match(re);
      if (m) counts[level] = parseInt(m[1], 10);
    }
  }

  if (Object.keys(counts).length === 0) {
    return {
      passed: false,
      reason:
        `ut: ${reportPath} 에서 지표(S1~S4/complete/wcag 등)를 찾지 못함 — ` +
        `ut-metrics 주석 또는 Executive Summary 표 형식을 확인하세요.`,
    };
  }

  return evaluateMetricRules(counts, criteriaStr, reportPath, "UT");
}

/**
 * 디자인 토큰 준수 리포트(TOKEN_CONFORMANCE_REPORT.md)를 파싱하여
 * token-metrics 주석의 지표가 임계 규칙을 모두 만족하는지 확인한다.
 *
 * 지표 추출: machine-readable 주석(token-conformance.mjs 산출) 전용.
 *   <!-- token-metrics: token_coverage=93 token_violations=0 token_hardcoded=10 ... -->
 * 지원 키: token_coverage(토큰 참조 비율%), token_violations(신규 하드코딩 건수),
 *          token_hardcoded/token_baseline/token_advisory/color_coverage/type_coverage 등.
 *
 * 리포트가 없거나 지표를 못 찾으면 실패로 처리한다(게이트 미실행을 통과로 오인 방지).
 */
function checkTokenReport(
  reportPath: string,
  criteriaStr: string,
  cwd: string
): { passed: boolean; reason: string } {
  const targetPath = path.resolve(cwd, reportPath);

  let content: string;
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch (e: unknown) {
    return {
      passed: false,
      reason:
        `token: 리포트 없음 — ${reportPath}\n` +
        `  token-conformance 게이트를 먼저 실행해 TOKEN_CONFORMANCE_REPORT.md 를 생성하세요.\n` +
        `  node frontend/tests/tokens/token-conformance.mjs\n` +
        `  (${(e as Error).message})`,
    };
  }

  const counts: Record<string, number> = {};
  const metricsLine = content.match(/token-metrics:\s*([^\n>]+)/i);
  if (metricsLine) {
    for (const pair of metricsLine[1].trim().split(/[\s,]+/)) {
      const kv = pair.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(\d+)$/);
      if (kv) counts[kv[1].toUpperCase()] = parseInt(kv[2], 10);
    }
  }

  if (Object.keys(counts).length === 0) {
    return {
      passed: false,
      reason:
        `token: ${reportPath} 에서 token-metrics 지표를 찾지 못함 — ` +
        `token-conformance.mjs 로 리포트를 재생성하세요.`,
    };
  }

  return evaluateMetricRules(counts, criteriaStr, reportPath, "토큰 준수");
}

/**
 * 지표 카운트 맵에 대해 "{key}{op}{value}" 콤마 목록 규칙을 모두 평가한다.
 * ut:·token: 등 machine-readable 지표 기반 게이트의 공통 평가 엔진.
 *   지원 연산자: = == != < <= > >=  (키는 대소문자 무관)
 */
function evaluateMetricRules(
  counts: Record<string, number>,
  criteriaStr: string,
  reportPath: string,
  label: string
): { passed: boolean; reason: string } {
  const rules = criteriaStr.split(",").map((s) => s.trim()).filter(Boolean);
  const failures: string[] = [];
  const checked: string[] = [];

  for (const rule of rules) {
    const rm = rule.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(==|!=|<=|>=|=|<|>)\s*(\d+)$/i);
    if (!rm) {
      failures.push(`잘못된 규칙 형식: "${rule}" (예: S4=0, token_coverage>=90)`);
      continue;
    }
    const level = rm[1].toUpperCase();
    const op = rm[2];
    const expected = parseInt(rm[3], 10);
    const actual = counts[level];

    if (actual === undefined) {
      failures.push(`${level} 지표를 리포트에서 찾지 못함`);
      continue;
    }

    let ok: boolean;
    switch (op) {
      case "=":
      case "==": ok = actual === expected; break;
      case "!=": ok = actual !== expected; break;
      case "<": ok = actual < expected; break;
      case "<=": ok = actual <= expected; break;
      case ">": ok = actual > expected; break;
      case ">=": ok = actual >= expected; break;
      default: ok = false;
    }

    checked.push(`${level}=${actual} ${ok ? "✓" : "✗"}(${op}${expected})`);
    if (!ok) failures.push(`${level}=${actual} 위반 (요구: ${op}${expected})`);
  }

  if (failures.length > 0) {
    return {
      passed: false,
      reason: `${label} 임계 미충족 [${reportPath}]: ${failures.join("; ")} | 관측: ${checked.join(", ")}`,
    };
  }

  return {
    passed: true,
    reason: `${label} 임계 통과 [${reportPath}]: ${checked.join(", ")}`,
  };
}

/**
 * tasks.md에서 지정된 task_id의 done 기준을 독립적으로 재실행하여 검증한다.
 * run-phase의 Claude 판단과 별개로 외부 코드가 검증하는 핵심 강제 포인트.
 */
export async function validateTaskDone(args: { task_id: string }): Promise<TaskDoneResult> {
  const { task_id } = args;
  const cwd = process.cwd();

  const tasksFile = findTasksFile(cwd);
  if (!tasksFile) {
    return { passed: false, reason: "tasks.md 파일을 찾을 수 없음" };
  }

  const tasks = parseTasks(tasksFile);
  const task = findTask(tasks, task_id);
  if (!task) {
    return {
      passed: false,
      reason: `태스크 ${task_id}를 tasks.md에서 찾을 수 없음 (대소문자 무관 검색)`,
    };
  }

  if (!task.done || task.done.length === 0) {
    return {
      passed: false,
      reason: `태스크 ${task_id}에 **done** 기준이 정의되지 않음`,
    };
  }

  const criteriaResults: Array<{ criterion: string; passed: boolean; reason: string }> = [];

  // B5: early return 제거 — 모든 기준을 실행한 뒤 실패 항목 전체를 보고한다.
  // 첫 번째 실패에서 중단하면 여러 기준이 동시에 깨진 경우 디버깅이 어려워진다.
  for (const criterion of task.done) {
    const result = await executeCriterion(criterion, cwd);
    criteriaResults.push({ criterion, ...result });
  }

  const failed = criteriaResults.filter((r) => !r.passed);

  if (failed.length > 0) {
    const failSummary = failed
      .map((r) => `❌ "${r.criterion}"\n   → ${r.reason}`)
      .join("\n");
    return {
      passed: false,
      reason: `done 기준 ${failed.length}/${task.done.length}개 실패:\n${failSummary}`,
      criteria_results: criteriaResults,
    };
  }

  return {
    passed: true,
    reason: criteriaResults.map((r) => `✅ ${r.criterion}`).join("\n"),
    criteria_results: criteriaResults,
  };
}

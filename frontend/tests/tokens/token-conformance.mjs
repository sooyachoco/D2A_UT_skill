// token-conformance.mjs — 디자인 토큰(색상·타이포) 준수 정적 분석 게이트
//
// 코드에 박힌 색상 리터럴(hex/rgb/hsl)과 하드코딩 font-size 를 결정론적으로 검출하고,
// baseline(기존 위반 면제) 대비 신규 위반만 게이트로 카운트한다.
//
// 계약(단일 source): frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md
// 방출 어휘(errorType/kind/severity)는 아래 RULE_DEFAULTS 와 규칙표 §2 가 1:1 일치해야 한다.
//
// 실행 (repo 루트에서):
//   node frontend/tests/tokens/token-conformance.mjs                 # 스캔 → TOKEN_CONFORMANCE_REPORT.md 생성
//   node frontend/tests/tokens/token-conformance.mjs --update-baseline  # 현재 위반을 baseline 으로 동결(기존 부채 면제)
//   node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0  # 임계 self-check(미충족 시 exit 1)
//   node frontend/tests/tokens/token-conformance.mjs --json           # 지표만 JSON 으로 출력(리포트 미생성)

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.env.TOKEN_ROOT || process.cwd());

// ── CLI 파싱 ────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const hasFlag = (f) => ARGV.includes(f);
const flagVal = (f) => {
  const hit = ARGV.find((a) => a === f || a.startsWith(f + '='));
  if (!hit) return null;
  if (hit.includes('=')) return hit.slice(hit.indexOf('=') + 1);
  const i = ARGV.indexOf(hit);
  return ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : '';
};

// ── 규칙표 §2 (단일 계약) ────────────────────────────────────────────────────
const RULE_DEFAULTS = {
  'hardcoded-color': { kind: 'color', category: '색상 토큰 이탈', severity: 'S3' },
  'hardcoded-font-size': { kind: 'font-size', category: '타이포 토큰 이탈', severity: 'S3' },
  'hardcoded-line-height': { kind: 'line-height', category: '타이포 토큰 이탈', severity: 'S2' },
  'hardcoded-letter-spacing': { kind: 'letter-spacing', category: '타이포 토큰 이탈', severity: 'S2' },
};
const SEV_LABEL = { S4: 'Critical', S3: 'Major', S2: 'Minor', S1: 'Cosmetic' };

const DEFAULTS = {
  roots: ['src', 'frontend/src', 'app', 'components'],
  include: [/\.(css|scss|sass|less|styl|ts|tsx|js|jsx|mjs|vue|svelte)$/],
  ignore: [
    /node_modules/, /[\\/](?:\.next|dist|build|coverage)[\\/]/, /\.d\.ts$/,
    /\.stories\.[jt]sx?$/, /\.(test|spec)\.[jt]sx?$/,
    /tokens?\.(css|ts|js|mjs|json)$/, /colors?\.css$/, /typography\.css$/, /theme\.(css|ts)$/,
  ],
  reportDir: 'specs/001-example/tokens',
  colorVarPrefixes: ['--color-', '--semantic-'],
  fontVarPrefixes: ['--font-', '--type-', '--text-', '--fs-', '--lh-'],
  typeClassPattern: /\btype-(?:default|w-)[a-z0-9-]+\b/,
  gateNamedColors: false,
  checkLineHeight: true,
  checkLetterSpacing: true,
  tokenSources: [],
  gate: { token_coverage: 90, token_violations: 0 },
};

async function loadConfig() {
  const candidates = [
    process.env.TOKEN_CONFIG,
    'token-conformance.config.mjs',
    'frontend/tests/tokens/token-conformance.config.mjs',
    'tests/tokens/token-conformance.config.mjs',
  ].filter(Boolean).map((p) => path.resolve(ROOT, p));
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      return { ...DEFAULTS, ...(mod.default ?? mod.config ?? {}) };
    }
  }
  return { ...DEFAULTS };
}

// ── 파일 워크 ────────────────────────────────────────────────────────────────
function walk(dir, include, ignore, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (ignore.some((re) => re.test(rel) || re.test(full.replace(/\\/g, '/')))) continue;
    if (e.isDirectory()) walk(full, include, ignore, out);
    else if (include.some((re) => re.test(e.name))) out.push(full);
  }
}

// ── 색상 리터럴 검출 ────────────────────────────────────────────────────────
// hex(#rgb/#rgba/#rrggbb/#rrggbbaa) + rgb()/rgba()/hsl()/hsla() 함수형.
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const FUNC_COLOR_RE = /\b(?:rgba?|hsla?)\([^)]*\)/gi;
// 색상 이름(advisory) — 오탐 낮은 대표값만. word-boundary + 값 위치 근사.
const NAMED_COLORS = ['white', 'black', 'red', 'green', 'blue', 'gray', 'grey', 'silver', 'orange', 'yellow', 'purple', 'pink'];
const NAMED_RE = new RegExp(`(?:^|[:\\s(,'"])(?:${NAMED_COLORS.join('|')})(?=[;\\s)}'",]|$)`, 'gi');

// 타이포 속성(css kebab + js camel) → kind
const TYPO_PROPS = [
  { re: /(?:font-size|fontSize)\s*[:=]\s*(['"]?)([^;,'"}\n)]+)\1/gi, kind: 'font-size', errorType: 'hardcoded-font-size' },
  { re: /(?:line-height|lineHeight)\s*[:=]\s*(['"]?)([^;,'"}\n)]+)\1/gi, kind: 'line-height', errorType: 'hardcoded-line-height' },
  { re: /(?:letter-spacing|letterSpacing)\s*[:=]\s*(['"]?)([^;,'"}\n)]+)\1/gi, kind: 'letter-spacing', errorType: 'hardcoded-letter-spacing' },
];
const LENGTH_LITERAL_RE = /-?\d*\.?\d+\s*(?:px|rem|em|pt|ex|ch|vh|vw|vmin|vmax)\b/i;
const BARE_NUMBER_RE = /^-?\d*\.?\d+$/; // line-height 무단위 숫자

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}
function snippet(text, index, len = 0) {
  const start = text.lastIndexOf('\n', index) + 1;
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  return text.slice(start, end).trim().slice(0, 120);
}
function norm(v) { return String(v).toLowerCase().replace(/\s+/g, ''); }

function isTokenRef(value, prefixes) {
  const m = value.match(/var\(\s*(--[\w-]+)/g) || [];
  return m.some((s) => {
    const name = s.replace(/var\(\s*/, '');
    return prefixes.some((p) => name.startsWith(p));
  });
}

// ── 단일 파일 분석 ──────────────────────────────────────────────────────────
function analyzeFile(full, cfg) {
  const rel = path.relative(ROOT, full).replace(/\\/g, '/');
  const text = fs.readFileSync(full, 'utf-8');
  const occ = [];          // 위반 후보 {rel,line,kind,errorType,value,severity,snippet}
  const advisory = [];     // {rel,line,errorType,value,note}
  let colorTokenized = 0, typeTokenized = 0;

  // 색상 토큰 참조(coverage 분자) — var(--color-*)/var(--semantic-*)
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (cfg.colorVarPrefixes.some((p) => m[1].startsWith(p))) colorTokenized++;
    else if (cfg.fontVarPrefixes.some((p) => m[1].startsWith(p))) typeTokenized++;
  }
  // 타이포 유틸 클래스 사용 → 토큰화로 인정(coverage 가산)
  for (const _ of text.matchAll(new RegExp(cfg.typeClassPattern, 'g'))) typeTokenized++;

  // 색상 리터럴(hardcoded-color)
  // hex 는 CSS 의 전부-hex id 선택자(`#abc { }`)와 구분해야 한다 →
  // "값 컨텍스트"(같은 줄에서 hex 앞에 `:`/`=` 가 있거나 괄호 안)일 때만 위반으로 잡는다.
  // rgb()/hsl() 함수형은 선택자로 오인될 여지가 없어 항상 잡는다.
  const inValueContext = (index) => {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const prefix = text.slice(lineStart, index);
    return /[:=]/.test(prefix) || (prefix.split('(').length > prefix.split(')').length);
  };
  HEX_RE.lastIndex = 0;
  for (const m of text.matchAll(HEX_RE)) {
    if (!inValueContext(m.index)) continue; // id 선택자 등 비-값 컨텍스트 제외
    occ.push({
      rel, line: lineOf(text, m.index), kind: 'color', errorType: 'hardcoded-color',
      severity: RULE_DEFAULTS['hardcoded-color'].severity, value: m[0], snippet: snippet(text, m.index),
    });
  }
  FUNC_COLOR_RE.lastIndex = 0;
  for (const m of text.matchAll(FUNC_COLOR_RE)) {
    occ.push({
      rel, line: lineOf(text, m.index), kind: 'color', errorType: 'hardcoded-color',
      severity: RULE_DEFAULTS['hardcoded-color'].severity, value: m[0], snippet: snippet(text, m.index),
    });
  }
  // 색상 이름(advisory)
  for (const m of text.matchAll(NAMED_RE)) {
    const val = m[0].replace(/^[^\w]+/, '');
    const entry = { rel, line: lineOf(text, m.index), kind: 'color', errorType: 'named-color', value: val, snippet: snippet(text, m.index) };
    if (cfg.gateNamedColors) {
      occ.push({ ...entry, errorType: 'hardcoded-color', severity: 'S3' });
    } else {
      advisory.push({ ...entry, note: '색상 이름 사용 — 토큰 var(--color-*) 권장(오탐 가능, 게이트 제외)' });
    }
  }

  // 타이포 하드코딩
  for (const { re, kind, errorType } of TYPO_PROPS) {
    if (kind === 'line-height' && !cfg.checkLineHeight) continue;
    if (kind === 'letter-spacing' && !cfg.checkLetterSpacing) continue;
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const raw = (m[2] || '').trim();
      if (!raw) continue;
      if (isTokenRef(raw, [...cfg.fontVarPrefixes, ...cfg.colorVarPrefixes])) continue; // var 참조 = 토큰화
      if (/^(inherit|initial|unset|revert|normal|auto|none)$/i.test(raw)) continue;      // 키워드 허용
      const isLen = LENGTH_LITERAL_RE.test(raw);
      const isBare = kind === 'line-height' && BARE_NUMBER_RE.test(raw);
      if (!isLen && !isBare) continue;
      occ.push({
        rel, line: lineOf(text, m.index), kind, errorType,
        severity: RULE_DEFAULTS[errorType].severity, value: raw, snippet: snippet(text, m.index),
      });
    }
  }

  return { occ, advisory, colorTokenized, typeTokenized };
}

// ── 토큰 세트 로드(선택, 리포트 보강) ────────────────────────────────────────
function loadTokenSet(cfg) {
  const hexToVar = new Map();   // '#e5f8ff' → '--color-b-100'
  const known = new Set();      // 알려진 var 이름
  for (const src of cfg.tokenSources || []) {
    const p = path.resolve(ROOT, src);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf-8');
    // CSS: --name: #hex;   /  TS: { name, cssVar: '--x', hex: '#...' }
    for (const m of t.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) { known.add(m[1]); hexToVar.set(norm(m[2]), m[1]); }
    for (const m of t.matchAll(/cssVar\s*:\s*['"](--[\w-]+)['"][^}]*?hex\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/gi)) { known.add(m[1]); hexToVar.set(norm(m[2]), m[1]); }
    for (const m of t.matchAll(/(--[\w-]+)/g)) known.add(m[1]);
  }
  return { hexToVar, known };
}

// ── baseline ────────────────────────────────────────────────────────────────
function fingerprint(o) { return `${o.rel}|${o.kind}|${norm(o.value)}`; }
function baselinePath(cfg) { return path.resolve(ROOT, cfg.reportDir, 'token-baseline.json'); }
function loadBaseline(cfg) {
  const p = baselinePath(cfg);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

// ── 게이트 규칙 평가 ──────────────────────────────────────────────────────────
function evalGate(criteriaStr, metrics) {
  const rules = criteriaStr.split(',').map((s) => s.trim()).filter(Boolean);
  const results = [];
  for (const rule of rules) {
    const m = rule.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(==|!=|<=|>=|=|<|>)\s*(\d+)$/);
    if (!m) { results.push({ rule, ok: false, reason: `잘못된 규칙 형식: "${rule}"` }); continue; }
    const [, key, op, valStr] = m;
    const actual = metrics[key];
    const expected = parseInt(valStr, 10);
    if (actual === undefined) { results.push({ rule, ok: false, reason: `지표 없음: ${key}` }); continue; }
    let ok;
    switch (op) {
      case '=': case '==': ok = actual === expected; break;
      case '!=': ok = actual !== expected; break;
      case '<': ok = actual < expected; break;
      case '<=': ok = actual <= expected; break;
      case '>': ok = actual > expected; break;
      case '>=': ok = actual >= expected; break;
      default: ok = false;
    }
    results.push({ rule, ok, reason: `${key}=${actual} ${ok ? '✓' : '✗'}(${op}${expected})` });
  }
  return results;
}

async function main() {
  const cfg = await loadConfig();

  // 스캔 대상 수집
  const files = [];
  for (const r of cfg.roots) {
    const abs = path.resolve(ROOT, r);
    if (fs.existsSync(abs)) walk(abs, cfg.include, cfg.ignore, files);
  }

  const tokenSet = loadTokenSet(cfg);
  const allOcc = [];
  const allAdvisory = [];
  let colorTokenized = 0, typeTokenized = 0;

  for (const f of files) {
    const { occ, advisory, colorTokenized: c, typeTokenized: t } = analyzeFile(f, cfg);
    allOcc.push(...occ); allAdvisory.push(...advisory);
    colorTokenized += c; typeTokenized += t;
  }

  // 토큰 세트로 보강: hex → 정확 일치 토큰 안내
  for (const o of allOcc) {
    if (o.kind === 'color') {
      const hit = tokenSet.hexToVar.get(norm(o.value));
      if (hit) o.suggest = `var(${hit})`;
    }
  }
  // 알 수 없는 var 참조 → advisory(토큰 세트가 로드된 경우만)
  if (tokenSet.known.size > 0) {
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf-8');
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
        const name = m[1];
        const relevant = cfg.colorVarPrefixes.some((p) => name.startsWith(p)) || cfg.fontVarPrefixes.some((p) => name.startsWith(p));
        if (relevant && !tokenSet.known.has(name)) {
          allAdvisory.push({ rel, line: lineOf(text, m.index), kind: 'ref', errorType: 'unknown-token-ref', value: name, note: '로드된 토큰 세트에 없는 var 참조 — 오타 또는 미등록 토큰(게이트 제외)' });
        }
      }
    }
  }

  // baseline 갱신 모드
  if (hasFlag('--update-baseline')) {
    const counts = {};
    for (const o of allOcc) counts[fingerprint(o)] = (counts[fingerprint(o)] || 0) + 1;
    const snap = { generatedAt: new Date().toISOString().slice(0, 10), total: allOcc.length, fingerprints: counts };
    const bp = baselinePath(cfg);
    fs.mkdirSync(path.dirname(bp), { recursive: true });
    fs.writeFileSync(bp, JSON.stringify(snap, null, 2) + '\n');
    console.log(`✓ baseline 스냅샷 생성: ${path.relative(ROOT, bp)} (${allOcc.length}건 면제)`);
    console.log('  이 파일을 커밋해 팀과 공유하세요. 이후 신규 위반만 게이트에 걸립니다.');
    return;
  }

  // baseline 대비 신규 위반 판정
  const baseline = loadBaseline(cfg);
  const baseCounts = baseline?.fingerprints || {};
  const seen = {};
  for (const o of allOcc) {
    const fp = fingerprint(o);
    seen[fp] = (seen[fp] || 0) + 1;
    o.provenance = seen[fp] <= (baseCounts[fp] || 0) ? 'baseline' : 'rule';
  }
  const violations = allOcc.filter((o) => o.provenance === 'rule');
  const exempted = allOcc.filter((o) => o.provenance === 'baseline');

  // 지표 산출
  const colorHard = allOcc.filter((o) => o.kind === 'color').length;
  const typeHard = allOcc.filter((o) => o.kind !== 'color').length;
  const colorDenom = colorTokenized + colorHard;
  const typeDenom = typeTokenized + typeHard;
  const tokenized = colorTokenized + typeTokenized;
  const hardcoded = allOcc.length;
  const total = tokenized + hardcoded;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 100);
  const metrics = {
    token_coverage: pct(tokenized, total),
    token_violations: violations.length,
    token_total: total,
    token_tokenized: tokenized,
    token_hardcoded: hardcoded,
    token_baseline: exempted.length,
    token_advisory: allAdvisory.length,
    color_coverage: pct(colorTokenized, colorDenom),
    type_coverage: pct(typeTokenized, typeDenom),
    files: files.length,
  };
  const metricsLine = Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(' ');

  // --json: 지표만 출력하고 종료
  if (hasFlag('--json')) { console.log(JSON.stringify(metrics, null, 2)); }

  // 리포트 생성 (--json 단독이 아닌 이상 항상)
  if (!hasFlag('--json') || hasFlag('--report')) {
    const order = ['S4', 'S3', 'S2', 'S1'];
    violations.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.rel.localeCompare(b.rel));
    const md = [];
    md.push('# TOKEN_CONFORMANCE_REPORT');
    md.push('');
    md.push(`**스캔 대상**: ${files.length}개 파일 · roots=[${cfg.roots.join(', ')}]  `);
    md.push(`**baseline**: ${baseline ? `${baseline.total}건 면제 (${baseline.generatedAt})` : '없음 — 모든 하드코딩이 신규 위반으로 집계됨 (최초 도입 시 `--update-baseline` 1회 실행 필요)'}  `);
    md.push(`**분석일**: ${new Date().toISOString().slice(0, 10)}`);
    md.push('');
    md.push('<!-- 자동 생성: token-conformance.mjs — 수정 시 재생성으로 덮어써짐 -->');
    md.push(`<!-- token-metrics: ${metricsLine} -->`);
    md.push('');
    md.push('## Executive Summary');
    md.push('');
    md.push('| 지표 | 값 |');
    md.push('|---|---|');
    md.push(`| 토큰 커버리지 | ${metrics.token_coverage}% (색상 ${metrics.color_coverage}% / 타이포 ${metrics.type_coverage}%) |`);
    md.push(`| **신규 위반(게이트)** | ${metrics.token_violations}건 |`);
    md.push(`| 하드코딩 총계 | ${metrics.token_hardcoded}건 (baseline 면제 ${metrics.token_baseline}건) |`);
    md.push(`| advisory(게이트 제외) | ${metrics.token_advisory}건 |`);
    md.push('');
    const blocker = metrics.token_violations > 0 ? `⛔ 신규 토큰 위반 ${metrics.token_violations}건` : '✅ 신규 토큰 위반 없음';
    md.push(`- **배포 판정**: ${blocker}`);
    md.push('');
    md.push('## 신규 위반 목록 (baseline 초과 — 게이트 대상)');
    md.push('');
    if (violations.length === 0) {
      md.push('_신규 위반 없음 — 기존 baseline 을 초과하는 하드코딩이 없습니다._');
    } else {
      violations.forEach((v, i) => {
        md.push(`### [T-${String(i + 1).padStart(3, '0')}] ${v.errorType} — \`${v.value}\``);
        md.push(`- **Severity**: ${v.severity} — ${SEV_LABEL[v.severity]}`);
        md.push(`- **카테고리**: ${RULE_DEFAULTS[v.errorType]?.category || v.kind}`);
        md.push(`- **위치**: \`${v.rel}:${v.line}\``);
        md.push(`- **코드**: \`${v.snippet}\``);
        if (v.suggest) md.push(`- **권장 토큰**: ${v.suggest} (값 일치)`);
        md.push('');
      });
    }
    if (allAdvisory.length > 0) {
      md.push('## advisory (게이트 제외 — 사람 검토)');
      md.push('');
      md.push('규칙표(TOKEN_CONFORMANCE_RUBRIC.md §3)에 확정 규칙이 없어 게이트에 반영되지 않는 findings. 오탐 가능성 때문에 배포 차단 근거로 쓰지 않는다.');
      md.push('');
      allAdvisory.slice(0, 100).forEach((a, i) => {
        md.push(`### [A-${String(i + 1).padStart(3, '0')}] ${a.errorType} — \`${a.value}\``);
        md.push(`- **위치**: \`${a.rel}:${a.line}\``);
        md.push(`- **비고**: ${a.note}`);
        md.push('');
      });
      if (allAdvisory.length > 100) md.push(`_…외 ${allAdvisory.length - 100}건 생략_`);
      md.push('');
    }
    if (exempted.length > 0) {
      md.push('## baseline 면제 (기존 부채 — 게이트 제외)');
      md.push('');
      md.push(`기존 코드의 하드코딩 ${exempted.length}건. baseline 에 동결돼 있어 게이트에 걸리지 않는다. 별도 리팩터로 점진 상환하고, 상환 후 \`--update-baseline\` 로 재스냅샷한다.`);
      md.push('');
    }
    md.push('## 한계');
    md.push('- 정적 분석은 런타임에 조립되는 색상(문자열 연결·JS 계산)을 잡지 못한다.');
    md.push('- 타이포는 NX Basic 에선 `.type-*` 유틸 클래스로 소비된다 — CSS 에 직접 쓴 font-size 만 검출한다(클래스 미적용 자체는 별도 리뷰 영역).');
    md.push('- spacing 토큰 미도입 → 이 게이트 범위 밖.');

    const outPath = path.resolve(ROOT, cfg.reportDir, 'TOKEN_CONFORMANCE_REPORT.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, md.join('\n') + '\n');
    console.log(`✓ 리포트 생성: ${path.relative(ROOT, outPath)}`);
    console.log(`  지표: ${metricsLine}  → ${blocker}`);
  }

  // --gate: 임계 self-check (미충족 시 exit 1) — cmd: 게이트용
  const gateStr = flagVal('--gate');
  if (gateStr !== null) {
    const criteria = gateStr || Object.entries(cfg.gate).map(([k, v]) => `${k}${k === 'token_coverage' ? '>=' : '<='}${v}`).join(',');
    const results = evalGate(criteria, metrics);
    const failed = results.filter((r) => !r.ok);
    console.log(`게이트 [${criteria}]: ${results.map((r) => r.reason).join(', ')}`);
    if (failed.length > 0) {
      console.error(`✗ 토큰 준수 게이트 미충족: ${failed.map((r) => r.reason).join('; ')}`);
      process.exitCode = 1;
    } else {
      console.log('✓ 토큰 준수 게이트 통과');
    }
  }
}

main().catch((e) => { console.error('token-conformance 실패:', e.stack || e.message); process.exitCode = 1; });

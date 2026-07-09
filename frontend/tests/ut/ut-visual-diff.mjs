// ut-visual-diff.mjs — 이전 실행(baseline) 대비 스크린샷 시각적 회귀 diff
//
// 활성화: npm i -D pixelmatch pngjs
// 미설치 시 우아하게 스킵한다(파이프라인 자체는 계속 동작). 최초 실행은 baseline 이 없으므로
// 현재 스크린샷을 그대로 baseline 으로 생성하고 종료한다(비교 대상 없음 — 정상 동작).
//
// 실행 (repo 루트에서):
//   node frontend/tests/ut/ut-visual-diff.mjs [specDir]
//   node frontend/tests/ut/ut-visual-diff.mjs [specDir] --update-baseline   # 의도된 UI 변경을 승인할 때
//
// 산출:
//   {specDir}/screenshots/.baseline/*.png   기준 스크린샷
//   {specDir}/visual-diff/diff/*.png        변경분 시각화(빨강 강조)
//   {specDir}/visual-diff/diff-report.json  ut-aggregate.mjs 가 리포트에 통합

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.env.UT_ROOT || process.cwd());
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
// 이 % 이상 픽셀이 달라지면 "변경"으로 플래그한다. 안티앨리어싱 노이즈를 걸러내기 위해 1%가 기본값.
const THRESHOLD_PCT = Number(process.env.UT_VISUAL_THRESHOLD || 1);

async function resolveSpecDir() {
  const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (arg) return path.resolve(ROOT, arg);
  const candidates = [process.env.UT_CONFIG, 'ut.config.mjs', 'frontend/tests/ut/ut.config.mjs', 'tests/ut/ut.config.mjs']
    .filter(Boolean).map((p) => path.resolve(ROOT, p));
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      const cfg = mod.default ?? mod.config;
      if (cfg?.specDir) return path.resolve(ROOT, cfg.specDir);
    }
  }
  return path.resolve(ROOT, 'specs/ut');
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

async function main() {
  const specDir = await resolveSpecDir();
  const shotsDir = path.join(specDir, 'screenshots');
  const baselineDir = path.join(shotsDir, '.baseline');
  const diffDir = path.join(specDir, 'visual-diff', 'diff');
  const reportPath = path.join(specDir, 'visual-diff', 'diff-report.json');

  if (!fs.existsSync(shotsDir)) {
    console.error(`스크린샷 디렉터리 없음: ${path.relative(ROOT, shotsDir)} — run-ut.mjs 를 먼저 실행하세요.`);
    process.exitCode = 1;
    return;
  }

  let PNG, pixelmatch;
  try {
    ({ PNG } = await import('pngjs'));
    ({ default: pixelmatch } = await import('pixelmatch'));
  } catch {
    console.log('⚠️  pixelmatch/pngjs 미설치 — 시각적 diff 스킵. `npm i -D pixelmatch pngjs` 후 재실행하면 자동 활성화됩니다.');
    writeReport(reportPath, { skipped: true, reason: 'pixelmatch/pngjs 미설치', total: 0, changed: 0, diffs: [] });
    return;
  }

  const currentFiles = fs.readdirSync(shotsDir).filter((f) => f.toLowerCase().endsWith('.png'));

  const noBaseline = !fs.existsSync(baselineDir) || fs.readdirSync(baselineDir).filter((f) => f.endsWith('.png')).length === 0;
  if (UPDATE_BASELINE || noBaseline) {
    fs.mkdirSync(baselineDir, { recursive: true });
    for (const f of currentFiles) fs.copyFileSync(path.join(shotsDir, f), path.join(baselineDir, f));
    const msg = UPDATE_BASELINE ? '베이스라인 갱신 완료(의도된 변경 승인)' : '베이스라인 최초 생성 — 비교 대상 없음, 다음 실행부터 diff 시작';
    console.log(`✓ ${msg}: ${currentFiles.length}개 → ${path.relative(ROOT, baselineDir)}`);
    writeReport(reportPath, {
      ranAt: new Date().toISOString(), baselineCreated: true, threshold: THRESHOLD_PCT,
      total: currentFiles.length, changed: 0, diffs: [],
    });
    return;
  }

  fs.mkdirSync(diffDir, { recursive: true });
  const diffs = [];

  for (const name of currentFiles) {
    const baselinePath = path.join(baselineDir, name);
    if (!fs.existsSync(baselinePath)) {
      diffs.push({ name, isNew: true, flagged: false, note: '신규 스크린샷 — 베이스라인에 없음(새 시나리오/페르소나)' });
      continue;
    }
    const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
    const img2 = PNG.sync.read(fs.readFileSync(path.join(shotsDir, name)));
    if (img1.width !== img2.width || img1.height !== img2.height) {
      diffs.push({
        name, flagged: true, diffPercent: 100,
        note: `크기 불일치 (베이스라인 ${img1.width}x${img1.height} → 현재 ${img2.width}x${img2.height}) — 뷰포트/레이아웃 변경 가능성`,
      });
      continue;
    }
    const { width, height } = img1;
    const diffImg = new PNG({ width, height });
    const diffPixels = pixelmatch(img1.data, img2.data, diffImg.data, width, height, { threshold: 0.1 });
    const diffPercent = Math.round((diffPixels / (width * height)) * 1000) / 10;
    const flagged = diffPercent >= THRESHOLD_PCT;
    let diffImagePath = null;
    if (flagged) {
      diffImagePath = path.join(diffDir, name);
      fs.writeFileSync(diffImagePath, PNG.sync.write(diffImg));
    }
    diffs.push({
      name, flagged, diffPercent, diffPixels, width, height,
      diffImage: diffImagePath ? path.relative(ROOT, diffImagePath).replace(/\\/g, '/') : null,
    });
  }

  const changed = diffs.filter((d) => d.flagged).length;
  writeReport(reportPath, {
    ranAt: new Date().toISOString(), baselineCreated: false, threshold: THRESHOLD_PCT,
    total: currentFiles.length, changed, diffs,
  });

  console.log(`✓ 시각적 diff 완료: ${changed}/${currentFiles.length}개 변경 감지 (임계 ${THRESHOLD_PCT}%)`);
  if (changed > 0) {
    console.log('  변경분 검토 후 의도된 UI 변경이면: node frontend/tests/ut/ut-visual-diff.mjs --update-baseline');
  }
}

main().catch((e) => { console.error('ut-visual-diff 실패:', e.message); process.exitCode = 1; });

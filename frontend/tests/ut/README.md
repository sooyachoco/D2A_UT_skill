# UT 러너 (frontend/tests/ut/)

`ai-usability-test` 스킬의 Playwright 실행 단계를 구현한 **재사용 러너**. 프로젝트는 시나리오만 정의하면 3페르소나(+선택적 모바일/태블릿 뷰포트) 재현·접근성 스캔·시각적 회귀 diff·콘솔/네트워크 오류 승격·성능 지표(Core Web Vitals)·리포트 집계가 자동이다.

## 파일

| 파일 | 역할 |
|---|---|
| `run-ut.mjs` | 러너 본체 — config 로드, storageState 재사용, 인증 리다이렉트 가드, 시나리오×페르소나 실행(페르소나별 viewport 반영), axe 스캔, 콘솔/네트워크 오류·성능 수집 |
| `ut-personas.mjs` | P1 초보 / P2 파워 / P3 접근성 + **mobile**·**tablet**(선택) 행동 모델 (think-time·입력수단·Tab 순회·above-fold 체크) |
| `ut-a11y.mjs` | axe-core WCAG 자동 스캔 → 위반을 S1~S4 로 매핑 |
| `ut-visual-diff.mjs` | 이전 실행(baseline) 대비 스크린샷 픽셀 diff → 레이아웃 회귀 자동 감지 |
| `ut-perf.mjs` | Core Web Vitals(LCP/CLS/FCP) 수집기 + 예산 대비 분류. 외부 의존 없음 |
| `ut-aggregate.mjs` | `raw-observations.json` (+ `visual-diff/diff-report.json`) → `UT_FINDINGS_REPORT.md` 자동 집계 |
| `ut.config.example.mjs` | 시나리오 정의 예시 → `ut.config.mjs` 로 복사해 사용 |

**결함 수집 차원** — 기능 시나리오 완료 여부 외에, 시나리오 실행 중 발생한 것들을 자동으로 severity 로 승격해 결함에 포함한다:
- **접근성**: axe WCAG 위반 (impact → S1~S4)
- **런타임 오류**: 잡히지 않은 예외(S3)·콘솔 error(S2) — dedupe + 발생횟수
- **네트워크 오류**: 5xx/요청실패(S3)·4xx(S2)
- **성능**: LCP/CLS 예산 초과 (poor→S3, 개선필요→S2)
- **시각적 회귀**: baseline 대비 diff (≥15%→S3, 그 외→S2)

**안정성(오탐 방지)** — 실패한 시나리오는 `retries`(기본 1)만큼 재시도한다. 재시도에서 회복되면 **flaky로 격리**해 결함 카운트·게이트에서 제외하고 리포트에 별도 표기한다(일시적 500·타이밍 오탐 방지). HMR·Fast Refresh·Vite·DevTools·favicon 등 프레임워크 잡음은 기본 노이즈 필터로 제외(`noiseFilters:false`로 끔). 추가 제외는 `ignoreConsole`/`ignoreNetwork`.

`mobile`/`tablet` 은 `refs/ux-research/PERSONA.md` SSOT(P1~P3)가 아니라 **뷰포트·터치 입력이라는 디바이스 차원**을 얹은 선택적 프로파일이다. 기본 personas 목록엔 없고, 시나리오의 `personas: [...]`에 `'mobile'`/`'tablet'`을 명시해야 실행된다. `tablet`(810×1080)은 사이드바 접힘 등 반응형 브레이크포인트 전환 구간을 확인하는 용도다.

`mobile`/`tablet` 은 `refs/ux-research/PERSONA.md` SSOT(P1~P3)가 아니라 **뷰포트·터치 입력이라는 디바이스 차원**을 얹은 선택적 프로파일이다. 기본 personas 목록엔 없고, 시나리오의 `personas: [...]`에 `'mobile'`/`'tablet'`을 명시해야 실행된다. `tablet`(810×1080)은 사이드바 접힘 등 반응형 브레이크포인트 전환 구간을 확인하는 용도다.

## 사용법 (repo 루트에서)

```bash
# 1) 설정 준비 (최초 1회) — 시나리오를 대상 서비스에 맞게 편집
cp frontend/tests/ut/ut.config.example.mjs frontend/tests/ut/ut.config.mjs

# 2) 접근성·시각적 diff 활성화 (선택)
npm i -D @axe-core/playwright axe-core pixelmatch pngjs

# 3) 관측 실행 → specs/{NNN}/ut/observations/raw-observations.json + screenshots/
UT_BASE=https://local-app.nexon.com node frontend/tests/ut/run-ut.mjs

# 4) 시각적 회귀 diff → specs/{NNN}/ut/visual-diff/diff-report.json
#    최초 실행은 베이스라인만 생성(비교 대상 없음). 의도된 변경 승인: --update-baseline
node frontend/tests/ut/ut-visual-diff.mjs

# 5) 리포트 집계 → specs/{NNN}/ut/UT_FINDINGS_REPORT.md
node frontend/tests/ut/ut-aggregate.mjs
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `UT_BASE` | config.base | 테스트 기준 URL |
| `UT_CONFIG` | `frontend/tests/ut/ut.config.mjs` | 설정 파일 경로 |
| `UT_ROOT` | `process.cwd()` | 경로 해석 기준(repo 루트) |

## 게이트 연동

집계된 리포트는 상단에 machine-readable 지표 주석을 담는다:
`<!-- ut-metrics: S4=0 S3=1 S2=2 S1=0 complete=92 wcag=0 visual=0 console=0 net=0 lcp=2100 cls=40 -->`

| 지표 | 의미 |
|---|---|
| `S4`~`S1` | Severity별 결함 건수 (기능+WCAG+런타임+네트워크+성능+시각 통합) |
| `complete` | 시나리오 완료율(%) |
| `wcag` | axe 접근성 위반 총건수 |
| `visual` | 시각적 회귀 플래그 건수 |
| `console` | 런타임 오류(콘솔 error+잡히지 않은 예외) 고유 건수 |
| `net` | 네트워크 실패(4xx/5xx·요청실패) 고유 건수 |
| `lcp` | 최악 LCP(ms) |
| `cls` | 최악 CLS×1000 (0.1 → 100) — 게이트는 정수만 파싱하므로 ×1000 |
| `flaky` | 재시도 후 회복돼 격리된 케이스 수 (결함 카운트 제외) |
| `coverage` | spec.md UI 기능(F-xx) 중 UT 시나리오가 덮은 비율(%) — `config.features` 선언 시에만 |

`tasks.md` 의 `done` 에서 임계로 건다:

```yaml
done:
  - ut: specs/{NNN}/ut/UT_FINDINGS_REPORT.md :: S4=0,S3<=2,complete>=80,wcag=0,visual=0,console=0,lcp<=2500,cls<=100
```

MCP `task-validator` 가 이 주석을 파싱해 Phase 완료를 강제한다. 위반 시 자동 차단.

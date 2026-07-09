---
name: ai-usability-test
description: AI 네이티브 사용성 테스트. Playwright + 다중 페르소나로 UI 결함을 자동 탐지하고 Nielsen 휴리스틱 기반 개선안을 산출한다. "사용성 테스트", "UT 돌려줘", "UI 결함 찾아줘", "접근성 검사", "UX 검증해줘" 등의 요청에 적용.
source: https://brunch.co.kr/@ghidesigner/492
last_updated: 2026-07-09 (D2A storageState 통합 + create-spec Step 2.7.5 게이트 진입점 명시)
---

# AI 네이티브 사용성 테스트 (AI-Native Usability Test)

> **출처**: [AI 네이티브 사용성 테스트 방식](https://brunch.co.kr/@ghidesigner/492)  
> Playwright + AI 페르소나로 기존 인간 중심 UT의 비용·시간 문제를 해결한다.  
> AI는 반복적·기술적 결함(클릭 정확도, 접근성, 논리 오류)을 먼저 제거하고,  
> 인간 평가자는 더 깊은 창의적·맥락적 영역에 집중한다.

---

## 산출물 5종 (specs/{NNN}/ut/ 하위)

| 파일 | 역할 |
|---|---|
| `UT_PLAN.md` | 테스트 범위·목표·페르소나·성공 기준 |
| `UT_SCENARIOS.md` | 페르소나별 현실적 작업 시나리오 |
| `UT_OBSERVATION_SHEET.md` | Playwright 원시 신호 (클릭·머뭇거림·오류·스크린샷) |
| `UT_FINDINGS_REPORT.md` | Nielsen 10 휴리스틱 기반 결함 우선순위 리포트 |
| `REDESIGN_PROPOSAL.md` | 구체적 화면 개선안 (다중 레이아웃 포함) |

---

## 진입점

이 스킬은 두 가지 경로로 진입된다:

| 경로 | 시점 | 자동/수동 |
|---|---|---|
| **A** `create-spec` Step 2.7.5 자동 게이트 | Step 2.7 UI 승인 직후(Step 2.8 진입 전) | **자동** |
| **B** 사용자 명시 호출 | UI 변경 후 회귀 검증, 배포 전 체크 | 수동 (`ai-usability-test 실행해줘`) |

경로 A에선 Step 0 대상 확인을 건너뛰고 `state.json` 의 `current_phase` + spec.md `페이지 목록` 으로 자동 셋업.

## Step 0.5: 단일 SOURCE 로드 (페르소나·여정 — 재정의 금지)

페르소나와 사용자 여정은 이 스킬에서 **새로 만들지 않는다.** 상류 리서치 산출물을 읽어온다.

| 로드 파일 | 사용처 | 부재 시 |
|---|---|---|
| `refs/ux-research/PERSONA.md` | Step 1-2 페르소나 3종 | 폴백: 아래 기본 3종(초보자/파워유저/접근성) 사용 + "PERSONA.md 미존재 — 가정 기반" 경고 |
| `refs/ux-research/USER_JOURNEY_MAP.md` | Step 2 시나리오 도출 | 폴백: spec.md/PRD 페이지 목록에서 시나리오 추출 |
| `refs/ux-research/USER_SCENARIOS.md` | Step 2 시나리오 **목표·성공조건 (권위 정의)** | 폴백: USER_JOURNEY_MAP 시드 → spec.md 사용자 시나리오 |

규약: `refs/ux-research/README.md`의 "단일 SOURCE 규약". 세 파일이 있으면 **반드시 그 내용을 권위 있는 정의로 사용**하고, UT 산출물에서 `PERSONA.md#P1` · `USER_SCENARIOS.md#US-P1-01` 형태로 역링크한다.
신뢰도 🔵(가설)인 페르소나로 UT 를 돌리면 UT_FINDINGS_REPORT Executive Summary 에 "가정 기반 — 인터뷰 검증 전" 을 명시한다.

## Step 0: 대상 확인 (경로 B 또는 자동 셋업 실패 시)

```
🔶 사용성 테스트 대상 확인

**테스트할 화면**: {사용자가 지정 or 현재 프로젝트 메인 화면}
**테스트 URL**: {local-{프로젝트}.nexon.com/{경로} 또는 사용자 지정}
**인증 모드**: {storageState 자동 / 게스트 / 익명}
**특이 사항**: {기존 storageState 사용 여부, 게스트 허용 여부 등}

이대로 진행할까요?
```

→ 확인 후 `specs/{NNN}/ut/` 디렉토리 생성.

### D2A 인증 통합 — storageState 자동 재사용

D2A 표준 인증 파이프라인이 셋업된 프로젝트에선 별도 로그인 시뮬레이션 불필요:

```javascript
// run-ut.mjs — D2A storageState 재사용 패턴
const authStatePath = 'tests/e2e/.auth/user.json';  // create-spec Step 2.7 산출물
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: fs.existsSync(authStatePath) ? authStatePath : undefined,
});
```

**storageState 만료 검사** (`scripts/save-auth-state.sh` 재실행 필요 시):
- 만료된 경우 UT가 로그인 화면으로 리다이렉트되어 모든 시나리오 실패
- run-ut.mjs 시작 시 첫 페이지 로드 후 URL이 `signin.nexon.com` / `nxas.nexon.com` 으로 가면 즉시 중단 + "save-auth-state.sh 재실행 필요" 보고

**인증 프로필별 호스트** (Stage 1.6-A 결정값 기반 자동 선택):
- `insign` / `insign-with-nxas` → `https://local-{project}.nexon.com`
- `nxas` / `custom` → `https://local-{project}.nxgd.io`
- `none` → `https://local-{project}.test`

---

## Step 1: UT_PLAN.md 작성

`specs/{NNN}/ut/UT_PLAN.md` 생성.

### 1-1. 테스트 범위 정의

spec.md / PRD에서 다음을 추출한다:
- 검사 대상 화면 목록 (화면명 + URL)
- 개념 인증(conceptual validation) 목표: "이 기능을 왜 쓰는지 명확한가"
- 전환 최적화 목표: 핵심 전환 단계별 이탈 예상 지점

### 1-2. 페르소나 3종 — `PERSONA.md`에서 로드 (재정의 금지)

Step 0.5 에서 읽은 `refs/ux-research/PERSONA.md` 의 P1/P2/P3 을 그대로 매핑한다.
PERSONA.md 의 `UT 시뮬레이션 매핑` 행이 곧 Playwright 행동 전략이다.

| PERSONA.md | UT 페르소나 | Playwright 시뮬레이션 전략 (PERSONA.md 매핑 행 사용) |
|---|---|---|
| P1 | **초보자** | 느린 클릭·hover 많이·에러 발생 시 방황 |
| P2 | **파워유저** | 빠른 클릭·키보드·직접 경로 탐색 |
| P3 | **접근성 사용자** | Tab/Enter/Arrow 전용, ARIA 확인 |

> `PERSONA.md` 부재 시에만 위 기본값을 직접 사용하고 "가정 기반" 경고를 남긴다.
> 페르소나를 이 문서에서 새로 정의하지 않는다 — 변경은 `PERSONA.md`에서만.
> 세 페르소나의 **행동 구현**(think-time·입력수단·키보드 Tab 순회)은 `ut-personas.mjs` 의 `PERSONA_PROFILES` 에 있으며 프로젝트별로 튜닝 가능하다. 접근성(P3)은 `tabTo()` 로 키보드만의 목표 도달 가능성을 실제 측정한다.

### 1-3. 성공 기준

```markdown
## 성공 기준 (합격 임계값)
- [ ] 초보자 시나리오 완료율 ≥ 80%
- [ ] 파워유저 시나리오 완료 시간 ≤ 목표치
- [ ] 접근성 사용자 핵심 동작 100% Tab 접근 가능
- [ ] Critical 오류 0건 (Nielsen severity 4)
- [ ] 클릭 정확도 오류 ≤ 목표치
```

### UT_PLAN.md 템플릿

```markdown
# UT_PLAN — {프로젝트명}

**작성일**: {YYYY-MM-DD}  
**버전**: {spec.md 버전}

## 검사 대상 화면
| 화면 | URL | 전환 목표 |
|---|---|---|
| {화면1} | {경로} | {전환 목표} |

## 타깃 페르소나
1. **초보자** — {구체적 사용자 프로필}
2. **파워유저** — {구체적 사용자 프로필}
3. **접근성 사용자** — {구체적 사용자 프로필}

## 성공 기준
{위 기준을 프로젝트에 맞게 수치화}

## 한계 및 범위 외 항목
- AI는 피로감·주의 분산 같은 인지 노이즈 재현 불가 → 정성적 피드백은 인간 UT 보완 필요
- {기타 프로젝트별 제약}
```

---

## Step 1.5: spec.md 기능정의 기반 커버리지 체크리스트 자동 도출

> **목적**: 시나리오를 손으로만 쓰면 얕게 써서 "초록불인데 실제론 헷갈리는"(vacuously green) 위험이 있다.
> PRD가 정규화된 `{spec_dir}/spec.md`(기능별 요구사항 F-xx + 페이지 목록)에서 **UT가 덮어야 할 기능 목록**을
> 자동 도출하고, 각 기능이 시나리오로 덮이는지 추적한다.
>
> **범위 경계 (중복 금지)**: 이 단계는 *"기능이 동작하는가"* 를 판정하지 않는다 — 그건 `auto-acceptance`(run-phase Step 4-1) 소관이다.
> 여기서는 각 기능에 대해 *"사용성 관점에서 무엇을 관찰할지"* 만 도출한다(페르소나 과업·상태·접근성/성능 관심사).

### 1.5-1. 원천 파싱
- `spec.md` "기능별 요구사항"의 `F-01, F-02 …` 코드와 제목을 추출한다.
- "페이지 목록"에서 각 F-xx가 나타나는 화면(라우트)을 연결한다.
- **UI가 없는 기능**(순수 백엔드·배치 등)은 UT 대상에서 제외 표시한다(커버리지 분모에서 뺀다).

### 1.5-2. 기능 → 사용성 커버리지 매핑
UI 있는 각 F-xx마다 아래를 1줄씩 채운다(자동 초안 → 사용자 검토):

| F-xx | 화면 | 페르소나 과업(무엇을 하려 하나) | 필수 상태 | a11y/perf 관심사 |
|---|---|---|---|---|
| F-01 | /login | (P1) 로그인해서 내 정보 확인 | 빈/로딩/에러 | 키보드 도달·폼 라벨 |
| … | | | | |

- **상태 매트릭스**(빈/로딩/결과/선택/수정/완료/실패) 중 해당 기능에 존재하는 것을 관찰 대상으로 표시.
- 페르소나는 `PERSONA.md` SSOT에서만 가져온다(재정의 금지).

### 1.5-3. 커버리지 게이트 (미커버 F-xx 경고)
- 도출한 UI F-xx 각각에 **최소 1개 UT 시나리오**가 대응하는지 확인한다.
- 시나리오에는 `covers: [F-01, …]` 로 어떤 기능을 덮는지 명시한다(`ut.config.mjs` 의 각 scenario에 `covers` 필드).
- **UI F-xx 중 대응 시나리오가 없는 것 = 미커버**로 리포트에 경고하고, 집계기가 `coverage`(덮인 UI F-xx 비율 %) 지표로 산출한다.
- `ut.config.mjs` 에 `features: ['F-01', …]`(UT가 덮어야 할 UI 기능 목록)를 선언하면 집계기가 이를 분모로 커버리지를 계산한다. 미선언 시 커버리지는 측정하지 않는다(게이트에 `coverage`를 걸면 미검출로 실패).

> 자동 도출은 **체크리스트/커버리지 맵까지**만 책임진다. 실행 가능한 `run()` 조작 코드(셀렉터·인터랙션)는
> 실제 UI를 봐야 하므로 사람/에이전트가 채운다. 도출 초안은 `USER_SCENARIOS.md`(SSOT)·`ut.config.mjs` 로 흘려보내고 별도 권위 문서를 만들지 않는다(drift 방지).

---

## Step 2: UT_SCENARIOS.md 작성

`specs/{NNN}/ut/UT_SCENARIOS.md` 생성.

### 시나리오 작성 원칙

> **2층 분리 (read-only 계약)**: `USER_SCENARIOS.md` 가 있으면 그 표의 **목표·성공조건을 권위 정의로
> 그대로 인용**하고(`UT_SCENARIOS` 에 `USER_SCENARIOS.md#US-P1-01` 역링크), 이 스텝은
> **예상 여정·Playwright 재현포인트·수치 임계만** 채운다. 목표·성공조건을 여기서 새로 바꾸지 않는다
> (변경은 `USER_SCENARIOS.md` 에서만). 부재 시에만 아래 시드 출처로 직접 도출한다.

> **시드 출처(폴백)**: Step 0.5 에서 읽은 `refs/ux-research/USER_JOURNEY_MAP.md` 의
> "페르소나별 핵심 경로 (→ UT 시나리오 시드)" 표와 ⚠ 결정 순간(이탈 지점)에서 시나리오를 도출한다.
> 여정맵의 ⚠ 표시 터치포인트는 **이탈 지점 집중 관찰 대상**으로 시나리오에 반드시 포함한다.

- **현실적 맥락**: "버튼을 클릭하세요" 대신 "오늘 오후 발표자료에 쓸 배너를 만들어야 합니다"
- **목표 중심**: 인터페이스 언급 없이 사용자 목표만 기술
- **여정 구성**: 진입 → 핵심 작업 → 완료/이탈 3단계

### 시나리오 템플릿 (페르소나 × 화면)

```markdown
# UT_SCENARIOS — {프로젝트명}

## 초보자 시나리오

### S-B01: {화면} — {목표}
**맥락**: {현실적 상황 묘사}
**목표**: {사용자가 달성해야 하는 것, UI 언급 없이}
**성공 조건**: {어떤 상태가 되면 완료인가}
**예상 여정**:
1. {진입 단계}
2. {핵심 작업 단계}
3. {완료/이탈 단계}
**Playwright 재현 포인트**: {특히 검사할 인터랙션}

## 파워유저 시나리오
(동일 구조, 효율·단축경로 중심)

## 접근성 사용자 시나리오
(동일 구조, Tab/Enter 전용 경로 + ARIA 체크 포인트)
```

---

## Step 3: Playwright 테스트 실행 → UT_OBSERVATION_SHEET.md

> **권장 실행 경로 — 번들 러너 재사용.** 아래 인라인 spec 을 매번 새로 짜지 말고, 번들이 제공하는
> 재사용 러너를 쓴다. 프로젝트는 **시나리오만** `ut.config.mjs` 에 정의하면 3페르소나(+선택적 모바일/태블릿 뷰포트) 재현·접근성 스캔·시각적 회귀 diff·관측 산출이 자동이다.
>
> | 파일 | 역할 |
> |---|---|
> | `frontend/tests/ut/run-ut.mjs` | 러너 — config 로드, storageState 재사용, 인증 리다이렉트 가드, 시나리오×페르소나 실행(페르소나별 viewport 반영), axe 스캔, `raw-observations.json` 산출 |
> | `frontend/tests/ut/ut-personas.mjs` | P1/P2/P3 행동 모델(느린클릭/빠른클릭/키보드전용) + 선택적 `mobile`/`tablet` 프로파일(터치 입력·뷰포트·above-fold 체크) — think-time·입력수단 프로파일 튜닝 가능 |
> | `frontend/tests/ut/ut-a11y.mjs` | axe-core WCAG 자동 스캔 → 위반을 S1~S4 로 매핑 (`npm i -D @axe-core/playwright axe-core`) |
> | `frontend/tests/ut/ut-visual-diff.mjs` | 이전 실행(baseline) 대비 스크린샷 픽셀 diff → 레이아웃 회귀 자동 감지 (`npm i -D pixelmatch pngjs`) |
> | `frontend/tests/ut/ut-perf.mjs` | Core Web Vitals(LCP/CLS/FCP) 수집 + 예산 대비 분류 (외부 의존 없음) |
> | `frontend/tests/ut/ut.config.example.mjs` | 시나리오 정의 예시 — `ut.config.mjs` 로 복사해 사용 |
> | `frontend/tests/ut/ut-aggregate.mjs` | `raw-observations.json` + 시각적 diff → `UT_FINDINGS_REPORT.md` 자동 집계(Step 4). 콘솔/네트워크 오류·성능도 severity로 승격 |
>
> 러너는 시나리오 실행 중 **콘솔 error·잡히지 않은 예외·네트워크 실패(4xx/5xx)·성능(LCP/CLS)** 도 자동 수집한다. 집계기가 이를 결함으로 승격하며, 노이즈(HMR·Fast Refresh·Vite·favicon 등)는 기본 필터 + `ignoreConsole`/`ignoreNetwork`로 제외한다.
>
> **flaky 게이트(오탐 방지)**: 실패한 시나리오는 `retries`(기본 1)만큼 재시도하고, 회복되면 flaky로 격리해 결함·게이트에서 제외한다(일시적 500·타이밍이 배포를 잘못 막는 것을 방지). 지속 실패만 reproducible 결함으로 확정. — 기능·안정성(콘솔/네트워크) 판정은 `auto-acceptance`(run-phase Step 4-1)와 겹치므로, 그 스킬을 쓰는 프로젝트는 UT의 `console`/`net` 게이트를 느슨히 두고 접근성·성능·시각·페르소나에 집중해도 된다.
>
> `mobile`(390×844)/`tablet`(810×1080) 은 `PERSONA.md` SSOT(P1~P3)의 사용자 유형이 아니라 **디바이스(뷰포트) 차원**이다. 기본 3페르소나엔 포함되지 않으며, 시나리오의 `personas: [...]`에 명시해야 실행된다. `tablet`은 사이드바 접힘 등 반응형 브레이크포인트 전환 구간을 확인하는 용도다.

### 3-1. 테스트 스크립트 생성 (수동/저수준 경로 — 러너를 쓰면 생략)

`tests/ut/usability-{화면명}.spec.ts` 생성.

**페르소나별 행동 패턴 구현:**

```typescript
// tests/ut/usability-{page}.spec.ts
import { test, expect, Page } from '@playwright/test';

// 페르소나: 초보자 (느린 탐색, 실수 포함)
async function beginnerBehavior(page: Page, scenario: string) {
  // 느린 클릭 (딜레이 200~800ms 랜덤)
  // 잘못된 요소 먼저 클릭 후 정정
  // 에러 발생 시 뒤로가기 후 재시도
}

// 페르소나: 파워유저 (빠른 탐색, 키보드 위주)
async function powerUserBehavior(page: Page, scenario: string) {
  // 빠른 클릭 (딜레이 50~150ms)
  // 키보드 단축키 시도
  // 직접 URL 진입
}

// 페르소나: 접근성 사용자 (Tab/Enter 전용)
async function accessibilityUserBehavior(page: Page, scenario: string) {
  // Tab 키 순서대로 이동
  // Enter/Space로 활성화
  // ARIA label 검증
}
```

**기록할 원시 신호:**

```typescript
interface ObservationSignal {
  persona: 'beginner' | 'power-user' | 'accessibility';
  scenario: string;
  timestamp: number;
  action: string;          // 클릭·입력·탭 이동 등
  target: string;          // 대상 요소 (selector)
  hesitationMs: number;    // 머뭇거림 시간
  isError: boolean;        // 오류 발생 여부
  errorType?: string;      // 'wrong-click' | 'dead-end' | 'form-error' | 'nav-confusion'
  screenshotPath?: string; // 오류/이탈 시점 스크린샷
  ariaIssue?: string;      // 접근성 위반 내용
}
```

### 3-2. 실행

```bash
# 권장: 번들 러너 (repo 루트에서). ut.config.mjs 의 시나리오를 3페르소나(+선택적 모바일/태블릿)로 재현.
cp frontend/tests/ut/ut.config.example.mjs frontend/tests/ut/ut.config.mjs   # 최초 1회, 시나리오 편집
npm i -D @axe-core/playwright axe-core pixelmatch pngjs                       # 접근성 스캔 + 시각적 diff 활성화(선택)
UT_BASE=https://local-{프로젝트}.nexon.com node frontend/tests/ut/run-ut.mjs # 3페르소나 + 콘솔/네트워크 오류·성능 자동 수집
node frontend/tests/ut/ut-visual-diff.mjs   # 이전 실행 대비 스크린샷 회귀 diff (최초 실행은 baseline만 생성)

# 저수준: 직접 짠 spec 을 돌릴 때
npx playwright test tests/ut/ --headed --reporter=json > tests/ut/raw-observations.json
```

storageState(`tests/e2e/.auth/user.json`)가 있으면 인증 상태로 실행되고, 첫 페이지가
`signin.nexon.com`/`nxas.nexon.com` 으로 리다이렉트되면 러너가 즉시 중단하며 재로그인을 안내한다(만료 오탐 방지).

### 3-3. UT_OBSERVATION_SHEET.md 작성

`specs/{NNN}/ut/UT_OBSERVATION_SHEET.md` 생성.

```markdown
# UT_OBSERVATION_SHEET — {프로젝트명}

**실행일**: {YYYY-MM-DD HH:mm}
**환경**: {브라우저·해상도·storageState 여부}

## 초보자 페르소나

### S-B01: {시나리오명}
| 신호 | 값 |
|---|---|
| 완료 여부 | ✅ / ❌ |
| 총 소요 시간 | {N}s |
| 오류 횟수 | {N}회 |
| 최장 머뭇거림 | {N}ms @ {요소} |
| 이탈 지점 | {있으면 단계명} |
| 스크린샷 | {오류 시점 경로} |

**주요 관찰 사항**:
- {관찰 1}
- {관찰 2}

## 파워유저 페르소나
(동일 구조)

## 접근성 사용자 페르소나
(동일 구조 + ARIA 이슈 목록)

## 집계 요약

| 지표 | 초보자 | 파워유저 | 접근성 |
|---|---|---|---|
| 시나리오 완료율 | {N}% | {N}% | {N}% |
| 평균 소요 시간 | {N}s | {N}s | {N}s |
| 오류 발생 건수 | {N} | {N} | {N} |
| 이탈 지점 최다 | {단계} | {단계} | {단계} |
```

---

## Step 4: UT_FINDINGS_REPORT.md 작성 (Nielsen 휴리스틱 적용)

`specs/{NNN}/ut/UT_FINDINGS_REPORT.md` 생성.

> **자동 집계 우선.** 번들 러너로 관측했다면 아래 한 줄로 리포트를 생성한다 —
> Severity 자동 분류(기능 결함 + WCAG + 런타임/네트워크 오류 + 성능 + 시각적 회귀 통합), 완료율·각 지표 집계, 게이트용 주석 삽입이 자동이다.
> ```bash
> node frontend/tests/ut/ut-visual-diff.mjs      # (선택) visual-diff/diff-report.json 생성 — 있으면 함께 집계
> node frontend/tests/ut/ut-aggregate.mjs        # specs/{NNN}/ut/UT_FINDINGS_REPORT.md 생성
> ```
> 집계기는 리포트 상단에 게이트가 파싱하는 machine-readable 주석을 넣는다:
> `<!-- ut-metrics: S4=0 S3=1 S2=2 S1=0 complete=92 wcag=0 visual=0 console=0 net=0 lcp=2100 cls=40 -->`
> 관측 신호에 `severityHint`·`heuristic` 을 실으면 그 값을 우선 쓰고, 없으면 `errorType` 기본 매핑으로 분류한다.
> 아래 템플릿은 수동 작성 또는 집계 결과 보강용 기준이다.

### Nielsen 10 휴리스틱 체크리스트

| # | 휴리스틱 | 체크 포인트 |
|---|---|---|
| N1 | 시스템 상태 가시성 | 로딩·진행·완료 상태가 항상 표시되는가 |
| N2 | 실세계 대응 | 시스템 용어 대신 사용자 언어를 쓰는가 |
| N3 | 사용자 통제·자유 | 실행 취소·뒤로가기가 명확한가 |
| N4 | 일관성·표준 | 같은 기능이 일관된 UI 패턴을 쓰는가 |
| N5 | 오류 예방 | 되돌리기 어려운 행동 전 확인 절차가 있는가 |
| N6 | 기억보다 인식 | 선택지·아이콘이 외우지 않아도 이해되는가 |
| N7 | 사용 유연성·효율 | 숙련자를 위한 단축경로가 존재하는가 |
| N8 | 미적 절제 | 불필요한 정보·장식이 핵심을 가리지 않는가 |
| N9 | 오류 복구 지원 | 오류 메시지가 원인·해결책을 명확히 안내하는가 |
| N10 | 도움말·문서 | 도움이 필요한 곳에 컨텍스트 도움말이 있는가 |

### Severity 분류 (Jakob Nielsen)

| 등급 | 기준 | 처리 방침 |
|---|---|---|
| **S4 — Critical** | 사용자가 작업 완료 불가 | 즉시 수정 (배포 블로커) |
| **S3 — Major** | 작업 완료는 가능하나 큰 불편·이탈 유발 | 다음 스프린트 처리 |
| **S2 — Minor** | 불편하나 우회 가능 | 백로그 등록 |
| **S1 — Cosmetic** | 미적·UX 소소한 개선 | 여유 있을 때 처리 |

### UT_FINDINGS_REPORT.md 템플릿

```markdown
# UT_FINDINGS_REPORT — {프로젝트명}

**기반 데이터**: UT_OBSERVATION_SHEET.md  
**분석일**: {YYYY-MM-DD}

## Executive Summary

| 등급 | 건수 |
|---|---|
| S4 Critical | {N} |
| S3 Major | {N} |
| S2 Minor | {N} |
| S1 Cosmetic | {N} |

**배포 블로커**: {S4 항목 있으면 ⛔, 없으면 ✅}

## 결함 목록 (우선순위 순)

### [F-001] {결함 제목}
- **Severity**: S{N} — {Critical/Major/Minor/Cosmetic}
- **휴리스틱**: N{N} — {휴리스틱명}
- **영향 페르소나**: 초보자 / 파워유저 / 접근성
- **발생 화면·경로**: {화면 > 단계}
- **관찰된 증상**: {UT_OBSERVATION_SHEET에서 어떤 신호로 감지됐는가}
- **근본 원인**: {왜 이 문제가 발생하는가}
- **개선 방향**: {어떻게 고쳐야 하는가 — 간결하게}
- **스크린샷**: {있으면 경로}

(반복)

## 기술적 접근성 이슈 (별도 섹션)

| 이슈 | WCAG 기준 | 심각도 |
|---|---|---|
| {이슈} | {2.1.1 등} | {AA/AAA} |
```

---

## Step 5: REDESIGN_PROPOSAL.md 작성

`specs/{NNN}/ut/REDESIGN_PROPOSAL.md` 생성.

### 5-1. S4/S3 항목에 대한 개선안 발산

각 Critical/Major 결함마다 **레이아웃 안 2종** 제시:
- **안 A**: 기존 패턴 유지, 최소 변경
- **안 B**: 사용자 흐름 재설계 (권장)

### REDESIGN_PROPOSAL.md 템플릿

```markdown
# REDESIGN_PROPOSAL — {프로젝트명}

**기반**: UT_FINDINGS_REPORT.md  
**작성일**: {YYYY-MM-DD}

## F-001 개선안: {결함 제목}

**문제 요약**: {1줄}

### 안 A — 최소 변경
{ASCII 와이어프레임 또는 HTML 목업 경로}
- 변경 범위: {어떤 컴포넌트만 바뀌는가}
- 예상 효과: {어떤 오류가 줄어드는가}
- 트레이드오프: {뭘 포기하는가}

### 안 B — 흐름 재설계 (권장)
{ASCII 와이어프레임 또는 HTML 목업 경로}
- 변경 범위: {더 넓은 범위}
- 예상 효과: {더 큰 개선}
- 트레이드오프: {개발 비용 등}

**권장**: 안 {A/B} — {이유}

(결함별 반복)

## 구현 우선순위 로드맵

| 우선순위 | 결함 ID | 개선안 | 예상 공수 |
|---|---|---|---|
| P1 | F-001 | 안 B | {N}h |
| P2 | F-002 | 안 A | {N}h |
```

---

## Step 6: CI 통합 (선택 사항)

매 커밋마다 자동 실행하려면 `.github/workflows/ut.yml` 또는 Gitlab CI에 추가:

```yaml
# .github/workflows/ut.yml (GitHub Actions 예시)
name: AI Usability Test
on: [push, pull_request]
jobs:
  ut:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run UT
        run: npx playwright test tests/ut/ --reporter=json
      - name: Upload observations
        uses: actions/upload-artifact@v3
        with:
          name: ut-observations
          path: tests/ut/raw-observations.json
```

---

## Step 6.5: Phase 게이트 통합 (MCP done 기준)

D2A MCP 하네스의 `submit_task` done 기준에 `ut:` 타입을 추가해 Phase 완료 조건에 UT 통과를 명시한다.

### tasks.md done 형식

```yaml
done:
  - cmd: npm run build
  # Severity 외에 완료율·접근성·시각회귀·런타임/네트워크 오류·성능까지 임계로 걸 수 있다.
  - ut: specs/{NNN}/ut/UT_FINDINGS_REPORT.md :: S4=0,S3<=2,complete>=80,wcag=0,visual=0,console=0,lcp<=2500,cls<=100
```

**지원 지표** (리포트의 `ut-metrics` 주석에서 추출):

| 키 | 의미 | 예 |
|---|---|---|
| `S4`~`S1` | Severity별 결함 건수 (기능 + WCAG + 런타임/네트워크 + 성능 + 시각 통합) | `S4=0`, `S3<=2` |
| `complete` | 시나리오 완료율(%) | `complete>=80` |
| `wcag` | axe 접근성 위반 총건수 | `wcag=0` |
| `visual` | 베이스라인 대비 시각적 회귀(스크린샷 diff) 플래그 건수 | `visual=0` |
| `console` | 런타임 오류(콘솔 error + 잡히지 않은 예외) 고유 건수 | `console=0` |
| `net` | 네트워크 실패(4xx/5xx·요청실패) 고유 건수 | `net=0` |
| `lcp` | 최악 LCP(ms) | `lcp<=2500` |
| `cls` | 최악 CLS×1000 (0.1 → 100, 게이트는 정수만 파싱) | `cls<=100` |
| `flaky` | 재시도 후 회복돼 격리된 케이스 수(결함 제외, 참고용) | `flaky<=1` |
| `coverage` | spec.md UI 기능(F-xx) 중 UT 시나리오가 덮은 비율(%) — `config.features` 선언 시 | `coverage>=100` |

> 연산자: `=` `==` `!=` `<` `<=` `>` `>=`. 지표 미검출·리포트 부재 시 **실패 처리**(UT 미실행을 통과로 오인 방지).
> 이전 버전과 하위호환 — `S4=0,S3<=2` 만 써도 그대로 동작한다.

### 검증 로직 (의사 코드)

```typescript
// d2a-mcp-server validate_task_done — ut: 타입 핸들러
function validateUtCriteria(reportPath: string, criteria: string): boolean {
  const report = readFile(reportPath);
  const counts = parseExecutiveSummary(report);   // S4/S3/S2/S1 카운트 추출
  const rules = parseCriteria(criteria);           // "S4=0,S3<=2" 파싱
  return rules.every(rule => evaluate(counts, rule));
}
```

### 통합 결과
- Phase 말미 자동 검증 — S4 1건이라도 있으면 Phase 완료 차단
- S3 임계 초과 시 BLOCKED 처리 → `collaboration-tracker.md` 자동 등록
- 통과 시 `submit_task` 정상 진행

## Step 7: 결과 보고 및 다음 단계

```
## AI 사용성 테스트 완료

📊 **요약**
- 테스트 화면: {N}개
- 페르소나: 초보자·파워유저·접근성 (3종 동시 실행)
- 발견 결함: S4 {N}건 / S3 {N}건 / S2 {N}건 / S1 {N}건

🚨 **배포 블로커**: {있으면 F-xxx 목록, 없으면 "없음"}

📁 **산출물 위치**: specs/{NNN}/ut/
  - UT_PLAN.md
  - UT_SCENARIOS.md
  - UT_OBSERVATION_SHEET.md
  - UT_FINDINGS_REPORT.md
  - REDESIGN_PROPOSAL.md

⚡ **권장 다음 단계**:
  - S4 결함 즉시 수정 후 재실행
  - REDESIGN_PROPOSAL.md의 P1 항목 리뷰
  - 접근성 S4/S3 이슈 있으면 → `design:accessibility-review`로 심층 리뷰 (2차 검토)
  - 인간 UT로 정성적 피드백 보완 (AI가 못 잡는 인지 노이즈)
```

---

## 타 스킬과의 역할 분담

| 스킬 | 역할 | 이 스킬과의 관계 |
|---|---|---|
| `refs/ux-research/` (상류 source) | 페르소나·여정 단일 정의 (brunch 493) | **상류** — Step 0.5 에서 `PERSONA.md`·`USER_JOURNEY_MAP.md` 를 읽어 페르소나·시나리오를 채운다 |
| `ai-usability-test` (이 스킬) | Playwright 자동화 — 기술적·반복적 결함 1차 탐지 | — |
| `design:accessibility-review` | WCAG 기준 심층 접근성 리뷰 | **이 스킬 이후** 접근성 S4/S3 이슈가 있을 때 2차로 실행 |
| `design:design-critique` | 주관적 디자인 품질 피드백 (위계·일관성) | 병렬 실행 가능. 이 스킬은 자동화, critique는 정성 평가 |
| `1.0.0:ux-design` | 디자인 시스템 내 사용성 개선안 제안 | 이 스킬로 결함 발견 → `ux-design`으로 개선안 도출 가능 |
| `pre-launch-check` | 배포 전 체크리스트 | 접근성 검수 항목을 이 스킬 결과로 갈음 (Step 2-A/B 주석 참조) |
| `design:user-research` | 정성적 사용자 리서치 (인터뷰·설문) | 이 스킬이 먼저 → 정성 리서치가 더 깊은 문제에 집중 가능 |

### 접근성 검사 흐름 (중복 방지)

```
ai-usability-test (자동 1차)
  └─ 접근성 사용자 페르소나 → "기술적 접근성 이슈" 섹션 생성
       │
       ├─ S4/S3 이슈 없음 → pre-launch-check 접근성 항목 통과 처리
       │
       └─ S4/S3 이슈 있음 → design:accessibility-review (심층 2차)
                               └─ WCAG 기준 상세 분석 + 수정 가이드
```

---

## 한계 및 주의사항

- AI는 **피로감·주의 분산·감정적 맥락** 재현 불가 → 인간 UT 완전 대체가 아닌 1차 필터
- 페르소나 행동 패턴은 가정이며, 실제 사용자 행동과 차이 가능
- JavaScript 렌더링·인증이 복잡한 페이지는 Playwright storageState 사전 준비 필요
- 테스트 실행 환경이 프로덕션과 다르면 관찰 신호가 왜곡될 수 있음

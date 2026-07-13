---
name: create-spec
description: 기능 명세 문서를 spec → plan → tasks 순서로 생성. 스펙 작성, 기능 명세, spec.md 생성, 새 기능 설계 요청 시 사용.
---

# Create Spec Workflow

기능 명세 문서를 정해진 순서로 생성한다.

## 실행 시점

> create-spec은 **boilerplate-setup의 Stage 1.5(디자인 방향 확정) 완료 후**에 실행된다.
> 이 시점에 이미 확정된 것:
> - 디자인 방향 (design-direction.md — 레이아웃·컬러·타이포그래피)
> - 기술 스택 (백엔드/DB/인프라 — Stage 2~4에서 확정)

## 순서

```
spec.md (기능 명세) → PRD + 대화 + design-direction.md 기반으로 작성 → 사용자 검토
  ↓
기능 의존성 분류 (자체 개발 / 외부 연동) → 모호 항목은 사용자 질문
  ↓
[Phase 0] React 프로젝트 + Mock UI 구현 → 사용자 전체 UI 확인 + 승인 루프
  ↓
decisions.md (기술 결정 로그) → 사용자 승인
prerequisites.md (사전 확인) → 자동 생성
  ↓
plan.md (구현 계획) → 사용자 검토
data-model.md (DB 설계) → 자동 생성
api-spec.yaml (API 설계) → 자동 생성
  ↓
tasks.md (태스크 분해) → 자동 생성 (Phase 0은 완료 상태로 시작)
```

스킬 시작 시 `TodoWrite`로 생성할 문서(spec.md → frontend/ React 구현 → decisions.md → plan.md → data-model.md → api-spec.yaml → tasks.md) 목록을 등록한다. 외부 연동이 발견되면 `analyze-integrations` 태스크를 추가한다.

## Step 0.5: STEP 0 점검 게이트 (UI 있는 프로젝트 전용)

> spec.md 작성 *전*에 메인 기능·톤·토큰·사용자가 모호한 채로 굳혀지는 것을 차단.
> 이전 세션 사례: "게임 스트리밍" 한 줄 모호어가 클라우드 게이밍(콘솔 대시보드)으로 굳혀져 처음부터 다시 작업.

### 점검 6항 — 없는 것만 사용자에게 묻는다

| # | 항목 | 점검 기준 |
|---|---|---|
| ① | 기준 톤 (톤 레퍼런스 1개) | `design/design-direction.md` "확정된 방향" 또는 `state.json.tone_reference` |
| ② | 디자인 토큰 단일 출처 | `state.json.design_system` (nxbasic / 커스텀 / 없음) 결정됨 |
| ③ | PRD 7칸 (동사+대상 형식) | 제품유형/사용자/제약/핵심기능★메인/규모/유사제품 |
| ④ | **메인 기능 1개** ★ | "이 제품의 차별점이자 가장 어려운 화면" 1개 명시 |
| ⑤ | 상태 목록 | 핵심 인터랙션마다 빈/로딩/완료/수정/실패 정의 가능한가 |
| ⑥ | 단계 게이트 합의 | STEP 0~5.5 흐름 적용 동의 |

### AskUserQuestion 형식 (빠진 항목만 묶어서 4개 이하로)

```
🔶 STEP 0 점검 — 빠진 항목 확인

다음 중 결정되지 않은 항목을 확정해주세요:
{빠진 항목별 선택지 — boilerplate-setup Q5 같은 백지 질문 금지, AI가 PRD 기반 카테고리 추천}
```

> **AI 추측 금지**. 특히 ④ 메인 기능은 사용자가 직접 확정해야 한다.
> 6항이 모두 ✅ 가 되기 전엔 Step 1(디렉터리 생성)로 진입하지 않는다.

---

## Step 1: 디렉터리 생성

기존 specs/ 디렉터리에서 가장 높은 번호를 확인하고 다음 번호를 부여한다.

```
specs/{NNN}-{feature-name}/
├── spec.md
├── plan.md
├── tasks.md
├── decisions.md
├── prerequisites.md
├── data-model.md
├── contracts/
│   └── api-spec.yaml
└── spikes/
    └── README.md
```

## Step 2: spec.md 초안 작성

사용자의 아이디어/요구사항 + **PRD(있는 경우)** + **`design/design-direction.md`** 를 바탕으로 spec.md 초안을 생성한다.

작성 시 반드시:
1. `design/design-direction.md`를 읽고 레이아웃 구조·컬러·인터랙션 수준을 파악한다
2. `refs/INDEX.md`를 참조하여 정책 충돌이 없는지 사전 확인
3. 서비스에 포함될 **페이지 목록**을 기능 요구사항에 명시한다 (Step 2.7 프로토타입의 기준이 됨)

> `prototype/index.html`은 이 단계에서 존재하지 않는다 — Step 2.7에서 spec.md를 기반으로 생성한다.

spec.md 구조:
```markdown
# {기능명}

## 개요
## 사용자 시나리오
## 기능 요구사항
  ### 페이지 목록
  ### 기능별 요구사항 (F-01, F-02 ...)
## 비기능 요구사항 (성능, 보안)
## 제약사항
## 용어 정의
```

→ 사용자에게 검토 요청: "spec.md를 확인해주세요. 수정할 부분이 있나요?"

## Step 2.5: 기능 의존성 분류

spec.md 검토 완료 후, 모든 기능 요구사항을 **자체 개발**과 **외부 연동**으로 분류한다.

| 분류 | 기준 | 예시 |
|---|---|---|
| 🟢 **자체 개발** | 외부 시스템 호출 없이 프로젝트 내부에서 완결 | 정적 데이터 조회, CRUD |
| 🔴 **외부 연동** | 프로젝트 외부 시스템의 API/DB/서비스 호출 필수 | SSO 인증, 외부 REST API |
| 🟡 **판단 필요** | 양쪽 모두 가능하거나 정보 부족 | 이메일 발송, 파일 저장 |

🟡 항목은 CLAUDE.md의 `ask-before-decide` 규칙에 따라 반드시 사용자에게 질문한다.

분류 완료 후 spec.md에 "기능 의존성 분류" 테이블을 추가한다.

> 🔴 외부 연동이 1개 이상 있으면, 분류 완료 후 `/analyze-integrations` 스킬을 실행한다.

### 상태 관리 자동 선택

의존성 분류 완료 후, spec.md 엔티티 수를 기반으로 상태 관리 방식을 자동 선택하고 사용자에게 확인한다.
선택 결과는 decisions.md `STATE_MANAGEMENT` 항목에 기록하며, Step 2.7 React 프로젝트 초기화 시 즉시 설치된다.

| 엔티티 수 | 자동 선택 | 비고 |
|---|---|---|
| 1~2개 | useState + Context API | 단순 앱, 외부 라이브러리 불필요 |
| 3~6개 | **Zustand** (기본값) | 중간 규모, 보일러플레이트 최소 |
| 7개 이상 | Zustand + React Query | 서버 상태·클라이언트 상태 분리 |

> 엔티티는 spec.md 기능 요구사항에서 명사형 데이터 단위를 센다 (예: Todo, Category, Tag, Notification, Share → 5개 → Zustand).

확인 형식:
```
🔶 상태 관리 자동 선택

감지된 엔티티 ({N}개): {엔티티 목록}
→ 자동 선택: {라이브러리명} ({이유})

  A) {자동 선택값} 사용
  B) useState + Context API
  C) Zustand
  D) Zustand + React Query
  E) 기타 (직접 지정)
```

---

## Step 2.7: 프론트엔드 초기화 + Mock UI 구현 + 사용자 승인

> **이 단계의 목적**: Phase 1 구현에 들어가기 전에 전체 UI를 **실제 React 코드**로 구현하여 확인·조정한다.
> Mock 서비스 레이어로 백엔드 없이 전체 UI를 검증하며, Phase 1에서 Mock을 실제 API로 교체한다.
> spec.md 기반이므로 모든 페이지가 포함되며, 이후 decisions.md·plan.md·tasks.md는 승인된 UI를 기준으로 작성한다.

### 구현 전 준비

`design/design-direction.md`의 "선택 결과" 섹션과 spec.md "페이지 목록"을 읽고, 구현 시작 전 다음 형식으로 출력한다:

```
디자인 시스템: {없음 (커스텀) / NX Basic 1.0v}
선택 방향: {방향 A/B/C/D/N}
레이아웃 구조: {design-direction.md 정의 그대로 인용}
사이드바: 있음 / 없음
KPI 영역: {정의 그대로 인용 또는 없음}
Primary 컬러: {값}

구현할 페이지 목록 (spec.md 기반):
  {페이지 1}: {F-0x 대응 기능}
  {페이지 2}: {F-0x 대응 기능}
  ...
```

> 방향 정의에 없는 레이아웃 요소를 AI 임의로 추가하는 것은 금지한다.

> **DESIGN_SYSTEM = nxbasic 확인**: `state.json.design_system == "nxbasic"` 이거나
> `design-direction.md` 의 "디자인 시스템" 항목이 NX Basic 이면, 웹 디자인 리서치 없이
> (NX Basic 토큰 고정·레이아웃 3종 샘플 비교·선택을 거쳐) 이 UI 프로토타입으로 진입한 경로다.
> 색·타이포·컴포넌트는 NX Basic 토큰, 레이아웃은 선택된 샘플 방향을 따른다. 아래 **NX Basic 구현 규칙**을 함께 적용한다.
>
> **이 판정이 곧 `token-conformance` 게이트의 트리거다.** DESIGN_SYSTEM = nxbasic 으로 확정되면 Step 2.7 사용자
> 승인(A) 직후 **Step 2.7.6** 에서 게이트를 자동 배선한다(설정 부트스트랩 → baseline 동결 → 이후 모든 Phase
> review 에 `token:` 기준 자동 삽입). DESIGN_SYSTEM 이 커스텀/없음이면 이 배선 전체를 스킵한다 — 강제할
> 토큰 기준 자체가 없기 때문이다.

### 구현 규칙

`frontend/` React 프로젝트로 구현한다. `prototype/index.html`은 생성하지 않는다.

- **페이지 완전성**: spec.md 페이지 목록의 **모든 페이지**를 React 컴포넌트로 구현한다
- **Mock 서비스 레이어**: 실제 API 없이 `src/mocks/` 더미 데이터로 동작 (`VITE_USE_MOCK=true`)
- **Rough 타입**: 엔티티 인터페이스는 spec.md 기반 draft 수준 (`[key: string]: unknown` 허용, `// rough — Step 2.8에서 확정` 주석 필수)
- **페이지 전환**: React Router로 모든 페이지를 전환 가능하게 구현
- **디자인 방향 준수**: `design/design-direction.md` 레이아웃·컬러·타이포그래피를 그대로 적용
- **AI 임의 추가 금지**: spec.md와 design-direction.md에 없는 기능·레이아웃 요소는 추가하지 않는다

#### NX Basic 구현 규칙 (DESIGN_SYSTEM = nxbasic 전용)

`refs/design-systems/nxbasic-1.0v.md` 를 읽고 아래 규칙으로 구현한다 (MCP 미등록 — Storybook WebFetch 조회):

- **토큰 우선**: 컬러·타이포·여백·radius 는 `design-direction.md` 에 옮겨둔 NX Basic 토큰 값을 사용한다.
  값이 비어 있으면 Storybook(`colors.css` / `typography.css` / `tokens.ts`)을 WebFetch 로 조회해 채운다.
- **컴포넌트 매핑**: UI 요소를 NX Basic 18종(Button·TextField·Table·Dialog·Tab·Tag·Toggle 등)에 매핑한다.
  - `nxbasic` 패키지 설치가 가능하면 `import { Button } from 'nxbasic'` 사용을 우선한다.
  - 설치 불가/사내망 제약 시: 해당 컴포넌트의 Storybook 문서(props·스타일)를 참조하여 동등 컴포넌트를 직접 구현한다.
    (`.../components-{이름소문자}--docs`)
- **변주 금지**: 디자인 시스템을 그대로 따르는 것이 목표이므로, NX Basic 토큰/컴포넌트에 임의 장식·변주를 추가하지 않는다.
  `design-quality-guard` 의 "기본 테마 그대로 사용 금지" 규칙은 NX Basic 토큰 준수로 갈음한다.

### 상태 매트릭스 게이트 (구현 시작 전 필수 — UI-intensive 기능)

spec.md의 핵심 인터랙션 기능(Drawer, Dialog, 실시간 폴링, 3D 뷰포트 등)마다 아래 7개 상태가
코딩 시작 전에 정의되어 있는지 확인한다. 미정의 상태는 코딩 전에 반드시 결정한다.

| 상태 | 구현 규칙 |
|---|---|
| **빈(empty)** | 아이콘 + CTA 버튼 1개. 안내 문구 텍스트 금지. |
| **로딩** | Skeleton UI 또는 스피너 + 무엇을 기다리는지 라벨 |
| **결과(채워짐)** | Mock 데이터로도 실제 콘텐츠처럼 렌더 (회색 박스 금지) |
| **선택·포커스** | 강조 표시 — 테두리/배경색 변화 명시 |
| **수정·편집** | 편집 컨트롤이 어떤 조작(드래그/입력/토글)인지 |
| **완료·승인** | 성공 피드백 — Toast/배지/상태 전이 |
| **실패·에러** | API 에러 코드별(402/409/500) 복구 안내 분리 |

> 상태가 정의되지 않은 채로 구현에 들어가면 빈 슬롯/회색박스가 나온다.
> 이 7상태 매트릭스는 ai-usability-test 의 페르소나 시나리오가 각 상태를 실제로 통과하는지 검증한다.

### 프론트엔드 프로젝트 초기화

`frontend/package.json`이 없으면 React 프로젝트를 초기화한다.

```bash
# 기존 인증서 파일 임시 보관 (mkcert가 이미 frontend/ 에 생성한 경우)
PEMS=$(ls frontend/*.pem frontend/*-key.pem 2>/dev/null | tr '\n' ' ' || true)
[ -n "$PEMS" ] && mkdir -p /tmp/d2a-cert-backup && cp $PEMS /tmp/d2a-cert-backup/ 2>/dev/null || true

# Vite React-TS 템플릿으로 초기화
npm create vite@latest frontend -- --template react-ts

# 인증서 복원
[ -n "$PEMS" ] && cp /tmp/d2a-cert-backup/*.pem frontend/ 2>/dev/null || true

cd frontend && npm install

# 상태 관리 라이브러리 설치 (Step 2.5 선택값)
#   Zustand:          npm install zustand
#   React Query 추가:  npm install @tanstack/react-query
# React Router (SPA 라우팅):
npm install react-router-dom

# HTTPS 개발 서버 스크립트 추가 (boilerplate-setup Stage 3~4에서 추가 실패한 경우 대비)
# boilerplate-setup Stage 3~4는 frontend/package.json이 없을 때 스킵되므로 여기서 확실히 추가한다.
LOCAL_DOMAIN="local-{GNB_DOMAIN}"   # Stage 1에서 수집된 값
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts['dev:https']) {
  pkg.scripts['dev:https'] = 'vite --https --port 443 --cert ${LOCAL_DOMAIN}.pem --key ${LOCAL_DOMAIN}-key.pem --host ${LOCAL_DOMAIN}';
  pkg.scripts['dev'] = pkg.scripts['dev'] || 'vite';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('dev:https 스크립트 추가 완료');
} else {
  console.log('dev:https 이미 존재');
}
"
cd ..
```

**`frontend/.env.local`** (Git 추적 대상, Mock 활성화 + INSIGN 환경변수):
```env
VITE_USE_MOCK=true
VITE_INFACE_WEB_AUTH=local-{GNB_DOMAIN}
VITE_INFACE_ENV=test
VITE_INFACE_PLATFORM=krpc
VITE_INFACE_SDK_URL=https://signin.nexon.com/sdk/inface.js
# VITE_INFACE_API_KEY=     # optional-local (미설정 시 API Key 검증 생략)
```

**`vite.config.ts`에 proxy 설정 추가 (백엔드 테스트용):**
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:4000', changeOrigin: true },
  },
}
```

### Rough TypeScript 타입 생성 (`frontend/src/types/*.ts`)

spec.md 엔티티별로 draft 인터페이스를 생성한다. `[key: string]: unknown` placeholder는 Step 2.8에서 제거된다.

```typescript
// rough — Step 2.8에서 확정 (UI 승인 후 컴포넌트 props 기반으로 재정의)
export interface {Entity} {
  id: string;
  // spec.md에서 확인된 기본 필드들
  createdAt: string;   // rough: Date vs string — Step 2.8에서 결정
  [key: string]: unknown;  // rough placeholder — Step 2.8에서 반드시 제거
}
```

> `[key: string]: unknown`이 남아 있는 파일은 Step 2.8 완료 전까지 Mock 전용으로만 사용된다.
> `scripts/check-mock-cleanup.sh`는 이 패턴이 `src/types/`에 남아 있으면 Phase 2 진입을 차단한다.

### GNB 삽입 (GNB_REQUIRED = true 전용)

**삽입 대상**: Vite SPA → `frontend/index.html` / Next.js App Router → `frontend/src/app/layout.tsx`의 `<Script>` 컴포넌트

`GNB_REQUIRED = true`이면 아래 3곳에 스크립트를 삽입한다 (위치 오류 시 GNB 렌더링 불가).

**1. `<head>` 안:**
```html
<!-- live 환경: ssl-test.nexon.com → ssl.nexon.com -->
<script src="https://ssl-test.nexon.com/s1/global/ngb_head.js"></script>
```

**2. `<body>` 시작 직후:**
```html
<script src="https://ssl-test.nexon.com/s1/global/ngb_bodystart.js"></script>
<!-- ?gid= 쿼리스트링 방식은 2024-11 deprecated, data-gamecode= 사용 -->
<!-- live 환경: rs-test.nxfs.nexon.com → rs.nxfs.nexon.com, data-loginenv="live" -->
<script src="https://rs-test.nxfs.nexon.com/common/js/gnb.min.js"
  data-gamecode="{GNB_GID}"
  data-ispublicbanner="false"
  data-loginenv="test"
  data-oncomplete="onGnbReady">
</script>
```

**3. `</body>` 직전:**
```html
<script src="https://ssl-test.nexon.com/s1/global/ngb_bodyend.js"></script>
```

**data-oncomplete 콜백 (GNB 높이로 레이아웃 동적 보정):**
```js
function onGnbReady() {
  requestAnimationFrame(function() {
    var h = parseInt(getComputedStyle(document.body).paddingTop, 10) || 60;
    var hdr = document.querySelector('.site-header');
    if (hdr) hdr.style.top = h + 'px';
  });
}
window.addEventListener('load', onGnbReady);
```

**GNB `body.paddingTop` 이중 적용 금지:**
> GNB 스크립트가 `body { padding-top: Npx }`를 자동 주입한다.
> 루트 컨테이너(`#root`, `.app-shell` 등) **및 페이지 레벨 요소(`<main>`, `<section>`, 페이지 wrapper `<div>`)** 에
> `padding-top: var(--gnb-h)` 를 지정하면 GNB 높이가 두 배로 적용된다.

**❌ 안티패턴:**
```tsx
<main style={{ paddingTop: 'var(--gnb-h)' }}>...</main>
<main style={{ paddingTop: 'calc(var(--gnb-h) + var(--space-12))' }}>...</main>
```

**✅ 올바른 패턴:** 디자인 여백은 `--space-*` 토큰만 사용한다.
```tsx
<main style={{ paddingTop: 'var(--space-12)' }}>...</main>
```

> `var(--gnb-h)` 는 `.site-header` 같은 fixed/sticky 요소의 `top` 오프셋 전용이다.
> AI write 시점에 위 안티패턴은 `pre-write-hook.sh` 가 자동 차단한다.

### INSIGN 연동 + 검증 라우트 (INSIGN_REQUIRED = true 전용)

InfaceTest 패턴으로 INSIGN SDK를 연동하고, `/insign-debug` 라우트에 검증 컴포넌트를 추가한다.

**참조 구현**: `/Users/thkim111/Desktop/test/InfaceTest/frontend/src/`

**이식할 파일:**
- `frontend/src/lib/insign.ts` ← InfaceTest의 `loadScript` → `waitForInsignAuth` 폴링 → `initInsign` 패턴
- `frontend/src/context/InsignContext.tsx` ← `InsignProvider` + `useInsign` hook (`isSignedIn`, `profile`, `isLoading`)
- `frontend/src/lib/apiClient.ts` ← `buildAuthHeaders` (로컬: x-inface-api-key + Authorization + x-inface-user-uid 직접 주입)

**App Router에 InsignProvider 적용** (`frontend/src/App.tsx` 또는 `layout.tsx`):
```tsx
<InsignProvider>
  <RouterProvider router={router} />
</InsignProvider>
```

**검증 라우트 컴포넌트** (`frontend/src/pages/InsignDebug.tsx`):
아래 HTML spec을 React 컴포넌트로 이식한다. React Router에 `/insign-debug` 라우트로 등록한다.

```tsx
// frontend/src/pages/InsignDebug.tsx
// InfaceTest 검증 페이지를 React로 이식 — 아래 HTML spec 참조
```

**HTML Spec (React 컴포넌트 이식 기준 — 기능 목록은 유지):**

```html
<!-- ================================================================
     INSIGN 검증 도구 — Phase 0.7 T070~T072 전용
     빌드 배포 전 반드시 제거 또는 /insign-debug 라우트 비활성화
     InfaceTest 수준의 전체 SDK 플로우 검증 페이지
     ================================================================ -->
<div id="page-insign-debug" class="page" style="display:none;">
  <div style="max-width:800px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <h2 style="margin:0;font-size:20px;font-weight:700;">🔍 INSIGN SDK 검증 도구</h2>
      <span id="dbg-overall-status" style="font-size:12px;padding:4px 10px;border-radius:12px;background:#2a2a3a;color:#888;">초기화 중...</span>
    </div>

    <!-- 0. SDK 설정 입력 -->
    <section style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 14px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">SDK 설정</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div>
          <label style="display:block;font-size:11px;color:#555;margin-bottom:4px;">web-auth (도메인)</label>
          <input id="dbg-web-auth" type="text" placeholder="dev-xxx.nexon.com"
            style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;padding:7px 10px;border-radius:4px;font-size:12px;font-family:monospace;" />
        </div>
        <div>
          <label style="display:block;font-size:11px;color:#555;margin-bottom:4px;">env</label>
          <select id="dbg-env" style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;padding:7px 10px;border-radius:4px;font-size:12px;">
            <option value="test">test</option><option value="pre">pre</option><option value="live">live</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:11px;color:#555;margin-bottom:4px;">platform</label>
          <select id="dbg-platform" style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;padding:7px 10px;border-radius:4px;font-size:12px;">
            <option value="krpc">krpc (한국)</option>
            <option value="jppc">jppc (일본)</option>
            <option value="arena_west">arena_west</option>
            <option value="arena_th">arena_th</option>
            <option value="arena_tw">arena_tw</option>
            <option value="arena_sea">arena_sea</option>
          </select>
        </div>
      </div>
      <button onclick="dbgReinit()"
        style="margin-top:12px;background:#1e1e30;color:#888;border:1px solid #333;padding:7px 16px;border-radius:4px;cursor:pointer;font-size:12px;">
        SDK 재초기화
      </button>
    </section>

    <!-- 1. SDK 상태 -->
    <section style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 14px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">SDK 상태</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:5px 0;color:#555;width:220px;">inface.js 로드</td><td id="dbg-sdk-load">⏳</td></tr>
        <tr><td style="padding:5px 0;color:#555;">window.inface.auth</td><td id="dbg-inface-obj">-</td></tr>
        <tr><td style="padding:5px 0;color:#555;">init() 결과</td><td id="dbg-sdk-init">-</td></tr>
      </table>
    </section>

    <!-- 2. 인증 상태 -->
    <section style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 14px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">인증 상태</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;">
        <tr><td style="padding:5px 0;color:#555;width:220px;">isSignedIn()</td><td id="dbg-signed-in">-</td></tr>
        <tr><td style="padding:5px 0;color:#555;">_ifwt 쿠키</td><td id="dbg-cookie">-</td></tr>
        <tr><td style="padding:5px 0;color:#555;">webToken</td><td id="dbg-web-token" style="font-size:11px;">-</td></tr>
      </table>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="dbgSignIn()"
          style="background:#1a3a20;color:#a8e6cf;border:1px solid #2a5a30;padding:8px 18px;border-radius:4px;cursor:pointer;font-size:12px;">
          gotoSignIn()
        </button>
        <button onclick="dbgSignOut()"
          style="background:#3a1a1a;color:#ffb3b3;border:1px solid #5a2a2a;padding:8px 18px;border-radius:4px;cursor:pointer;font-size:12px;">
          gotoSignOut()
        </button>
        <button onclick="dbgGetProfile()"
          style="background:#1a2a3a;color:#a8c8ea;border:1px solid #2a3a5a;padding:8px 18px;border-radius:4px;cursor:pointer;font-size:12px;">
          getUserProfile()
        </button>
      </div>
    </section>

    <!-- 3. 프로필 응답 -->
    <section id="dbg-profile-section" style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;margin-bottom:16px;display:none;">
      <h3 style="margin:0 0 14px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">getUserProfile() 응답</h3>
      <pre id="dbg-profile-json" style="margin:0;font-size:12px;color:#a8e6cf;white-space:pre-wrap;word-break:break-all;"></pre>
    </section>

    <!-- 4. 백엔드 헤더 전달 테스트 -->
    <section style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 6px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">백엔드 헤더 전달 테스트</h3>
      <p style="font-size:11px;color:#444;margin:0 0 14px;">
        로컬: 프론트가 Gateway 역할 시뮬레이션 — x-inface-user-uid 직접 주입
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:flex-end;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:11px;color:#555;margin-bottom:4px;">x-inface-api-key</label>
          <input id="dbg-api-key" type="text" placeholder="your-api-key-here"
            style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;padding:7px 10px;border-radius:4px;font-size:12px;font-family:monospace;" />
        </div>
        <div>
          <label style="display:block;font-size:11px;color:#555;margin-bottom:4px;">엔드포인트</label>
          <input id="dbg-endpoint" type="text" value="/api/verify"
            style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;padding:7px 10px;border-radius:4px;font-size:12px;font-family:monospace;" />
        </div>
        <button onclick="dbgVerify()"
          style="background:#1a2a3a;color:#a8c8ea;border:1px solid #2a3a5a;padding:8px 18px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;">
          요청 전송
        </button>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;color:#444;margin-bottom:6px;">전송될 헤더</div>
        <pre id="dbg-headers-preview" style="margin:0;background:#0d0d1a;padding:10px;border-radius:4px;font-size:11px;color:#666;"></pre>
      </div>
      <div>
        <div style="font-size:11px;color:#444;margin-bottom:6px;">응답</div>
        <pre id="dbg-verify-result" style="margin:0;background:#0d0d1a;padding:10px;border-radius:4px;font-size:12px;color:#666;min-height:60px;white-space:pre-wrap;word-break:break-all;">-</pre>
      </div>
    </section>

    <!-- 5. 쿠키 목록 -->
    <section style="background:#1a1a2e;border:1px solid #2a2a3a;border-radius:8px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.1em;">쿠키 목록 (현재 도메인)</h3>
        <button onclick="dbgRefreshCookies()"
          style="background:transparent;color:#444;border:1px solid #2a2a3a;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">
          새로고침
        </button>
      </div>
      <pre id="dbg-cookie-list" style="margin:0;font-size:11px;color:#d0d0d0;white-space:pre-wrap;word-break:break-all;"></pre>
    </section>
  </div>
</div>

<script>
(function () {
  'use strict';
  var _insign = null;
  var _profile = null;

  function ok(t)   { return '<span style="color:#a8e6cf">✅ ' + t + '</span>'; }
  function warn(t) { return '<span style="color:#ffd93d">⚠️ ' + t + '</span>'; }
  function fail(t) { return '<span style="color:#ff6b6b">❌ ' + t + '</span>'; }

  function setHtml(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; }
  function setText(id, text) { var e = document.getElementById(id); if (e) e.textContent = text; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  function getCookieExists(name) {
    return document.cookie.split(';').some(function (c) {
      return c.trim().startsWith(name + '=') && c.trim().length > name.length + 1;
    });
  }

  function updateAuthStatus() {
    var ifwt = getCookieExists('_ifwt');
    setHtml('dbg-cookie', ifwt ? ok('존재 (_ifwt)') : warn('없음 — 미로그인 또는 도메인 불일치'));
    if (_insign) {
      var signed = _insign.isSignedIn();
      setHtml('dbg-signed-in', signed ? ok('true (로그인)') : warn('false (미로그인)'));
      var tok = _insign.webToken;
      setText('dbg-web-token', tok
        ? tok.substring(0, 20) + '…(생략 ' + (tok.length - 20) + '자)'
        : '없음');
    }
    updateHeadersPreview();
    dbgRefreshCookies();
  }

  function updateHeadersPreview() {
    var apiKey = val('dbg-api-key');
    var headers = {};
    if (apiKey) headers['x-inface-api-key'] = apiKey.substring(0, 8) + '…(마스킹)';
    if (_insign && _insign.webToken)
      headers['Authorization'] = 'Web ' + _insign.webToken.substring(0, 12) + '…';
    if (_profile && _profile.uid) headers['x-inface-user-uid'] = _profile.uid;
    setText('dbg-headers-preview', Object.keys(headers).length
      ? Object.keys(headers).map(function (k) { return k + ': ' + headers[k]; }).join('\n')
      : '(API Key 미입력 또는 미로그인)');
  }

  function loadSdk(cb) {
    setHtml('dbg-sdk-load', '<span style="color:#ffd93d">⏳ 로드 중…</span>');
    if (window.inface && window.inface.auth) {
      setHtml('dbg-sdk-load', ok('이미 로드됨'));
      setHtml('dbg-inface-obj', ok('window.inface.auth 존재'));
      cb(window.inface.auth); return;
    }
    var s = document.createElement('script');
    s.src = 'https://signin.nexon.com/sdk/inface.js';
    s.onload = function () {
      setHtml('dbg-sdk-load', ok('로드됨 (signin.nexon.com)'));
      var poll = setInterval(function () {
        if (window.inface && window.inface.auth) {
          clearInterval(poll);
          setHtml('dbg-inface-obj', ok('window.inface.auth 존재'));
          cb(window.inface.auth);
        }
      }, 100);
      setTimeout(function () {
        clearInterval(poll);
        if (!window.inface || !window.inface.auth)
          setHtml('dbg-inface-obj', fail('타임아웃 — window.inface.auth 없음'));
      }, 8000);
    };
    s.onerror = function () {
      setHtml('dbg-sdk-load', fail('로드 실패 — CSP 또는 네트워크 오류'));
    };
    document.head.appendChild(s);
  }

  function runInit(auth) {
    setHtml('dbg-sdk-init', '<span style="color:#ffd93d">⏳ init() 호출 중…</span>');
    var webAuth = val('dbg-web-auth') || location.hostname;
    var env = val('dbg-env') || 'test';
    var platform = val('dbg-platform') || 'krpc';
    auth.init({
      webAuth: webAuth, env: env, platform: platform,
      callbackOk: function () {
        _insign = auth;
        setHtml('dbg-sdk-init', ok('callbackOk — 초기화 성공'));
        setHtml('dbg-overall-status',
          '<span style="background:#1a3a20;color:#a8e6cf;padding:4px 10px;border-radius:12px;font-size:12px;">SDK 준비됨</span>');
        updateAuthStatus();
      },
      callbackFail: function (e) {
        setHtml('dbg-sdk-init', fail('callbackFail: ' + (e && e.message ? e.message : String(e))));
        setHtml('dbg-overall-status',
          '<span style="background:#3a1a1a;color:#ffb3b3;padding:4px 10px;border-radius:12px;font-size:12px;">초기화 실패</span>');
      }
    });
  }

  window.dbgReinit = function () {
    _insign = null; _profile = null;
    setText('dbg-signed-in', '-'); setText('dbg-web-token', '-');
    loadSdk(runInit);
  };
  window.dbgSignIn = function () {
    if (!_insign) { alert('SDK가 초기화되지 않았습니다.'); return; }
    _insign.gotoSignIn({ redirect_uri: location.href });
  };
  window.dbgSignOut = function () {
    if (!_insign) { alert('SDK가 초기화되지 않았습니다.'); return; }
    _insign.gotoSignOut({ redirect_uri: location.href });
  };
  window.dbgGetProfile = function () {
    if (!_insign) { alert('SDK가 초기화되지 않았습니다.'); return; }
    var sec = document.getElementById('dbg-profile-section');
    if (sec) sec.style.display = 'block';
    setText('dbg-profile-json', '조회 중…');
    if (!_insign.isSignedIn()) {
      setText('dbg-profile-json', '{\n  "error": "미로그인 상태\\ngotoSignIn() 으로 먼저 로그인하세요"\n}');
      return;
    }
    _insign.getUserProfile().then(function (result) {
      _profile = (result.data && result.data.uid) ? result.data : null;
      setText('dbg-profile-json', JSON.stringify(result, null, 2));
      updateHeadersPreview();
    }).catch(function (e) { setText('dbg-profile-json', 'Error: ' + String(e)); });
  };
  window.dbgVerify = function () {
    var apiKey = val('dbg-api-key');
    var endpoint = val('dbg-endpoint') || '/api/verify';
    var resultEl = document.getElementById('dbg-verify-result');
    if (resultEl) { resultEl.style.color = '#666'; resultEl.textContent = '요청 중…'; }

    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-inface-api-key'] = apiKey;
    if (_insign && _insign.webToken) headers['Authorization'] = 'Web ' + _insign.webToken;
    if (_profile && _profile.uid) headers['x-inface-user-uid'] = _profile.uid;

    var previewLines = Object.keys(headers)
      .filter(function (k) { return k !== 'Content-Type'; })
      .map(function (k) {
        var v = headers[k];
        if (k === 'Authorization') v = v.substring(0, 16) + '…';
        if (k === 'x-inface-api-key' && v.length > 12) v = v.substring(0, 12) + '…';
        return k + ': ' + v;
      }).join('\n') || '(헤더 없음)';
    setText('dbg-headers-preview', previewLines);

    fetch(endpoint, { method: 'POST', headers: headers, credentials: 'include' })
      .then(function (res) {
        var status = res.status;
        return res.text().then(function (body) {
          var color = status === 200 ? '#a8e6cf' : status === 401 ? '#ffd93d' : '#ff6b6b';
          if (resultEl) {
            resultEl.style.color = color;
            var parsed; try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
            resultEl.textContent = 'HTTP ' + status + '\n\n' +
              (typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed);
          }
        });
      })
      .catch(function (e) {
        if (resultEl) {
          resultEl.style.color = '#ff6b6b';
          resultEl.textContent = 'fetch 오류: ' + String(e) +
            '\n\n확인사항:\n  · 백엔드 서버 실행 중?\n  · vite proxy /api 설정 확인\n  · HTTPS 환경에서 실행 중?';
        }
      });
  };
  window.dbgRefreshCookies = function () {
    var cookies = document.cookie.split(';').map(function (c) { return c.trim(); }).filter(Boolean);
    setText('dbg-cookie-list', cookies.length
      ? cookies.map(function (c) {
          var note = c.startsWith('_ifwt=') ? ' ← 인증 쿠키' : '';
          return c.substring(0, 100) + (c.length > 100 ? '…' : '') + note;
        }).join('\n')
      : '(쿠키 없음 — 로그인 후 재확인)');
  };

  document.addEventListener('DOMContentLoaded', function () {
    var waEl = document.getElementById('dbg-web-auth');
    if (waEl && !waEl.value) waEl.value = location.hostname;
    var akEl = document.getElementById('dbg-api-key');
    if (akEl) akEl.addEventListener('input', updateHeadersPreview);
    loadSdk(runInit);
    setInterval(updateAuthStatus, 3000);
  });
}());
</script>
```

**검증 페이지 기능 목록 (InfaceTest 동등 수준):**

| 항목 | 내용 |
|---|---|
| SDK 설정 입력 | web-auth 도메인 / env / platform 실시간 입력 → SDK 재초기화 버튼 |
| SDK 상태 | inface.js 로드 여부 / window.inface.auth 존재 / init() callbackOk·Fail 결과 |
| 인증 상태 | isSignedIn() / _ifwt 쿠키 존재 여부 / webToken (마스킹) — 3초 자동 갱신 |
| 액션 버튼 | gotoSignIn() / gotoSignOut() / getUserProfile() |
| 프로필 JSON | uid / platform_type / platform_user_id / is_guest 전체 응답 표시 |
| 백엔드 테스트 | API Key 입력 + 엔드포인트 입력 + 요청 전송 버튼 → HTTP 상태·응답 JSON 표시 |
| 헤더 미리보기 | 전송될 x-inface-api-key / Authorization / x-inface-user-uid 미리 확인 |
| 쿠키 목록 | 현재 도메인 전체 쿠키 표시, _ifwt 쿠키 하이라이트 |

### Mock 서비스 레이어 구현

spec.md 엔티티별로 `src/mocks/` + `src/services/`를 생성한다.

**`frontend/src/mocks/{entity}Mock.ts`** — spec.md 사용자 시나리오 기반 더미 데이터:
```typescript
import type { {Entity} } from '../types/{entity}';

const MOCK_{ENTITIES}: {Entity}[] = [
  // spec.md 시나리오에서 추출한 구체적 케이스 반영
  { id: '1', /* spec.md의 실제 필드 구조 */ },
];

export const mock{Entity}Service = {
  getAll: () => Promise.resolve([...MOCK_{ENTITIES}]),
  getById: (id: string) => Promise.resolve(MOCK_{ENTITIES}.find(e => e.id === id) ?? null),
  create: (data: Omit<{Entity}, 'id'>) => Promise.resolve({ ...data, id: crypto.randomUUID() } as {Entity}),
  update: (id: string, data: Partial<{Entity}>) => {
    const item = MOCK_{ENTITIES}.find(e => e.id === id);
    return Promise.resolve({ ...(item ?? {}), ...data } as {Entity});
  },
  remove: (_id: string) => Promise.resolve(),
};
```

**`frontend/src/services/{entity}Service.ts`** — Mock ↔ 실제 API 전환 게이트:
```typescript
import type { {Entity} } from '../types/{entity}';
import { mock{Entity}Service } from '../mocks/{entity}Mock';
import { apiFetch } from '../lib/apiClient';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function get{Entities}(): Promise<{Entity}[]> {
  if (USE_MOCK) return mock{Entity}Service.getAll();
  const res = await apiFetch('/{entities}');
  return res.json();
}
// create, update, remove 동일 패턴 적용
```

**`frontend/src/mocks/index.ts`**:
```typescript
export const isMock = import.meta.env.VITE_USE_MOCK === 'true';
export * from './{entity}Mock';
```

### 구현 완료 후 처리

**1. PROGRESS.md Phase D 체크박스 갱신:**
```
- [x] 프론트엔드 프로젝트 초기화 + 의존성 설치
- [x] Rough TypeScript 타입 생성 (Step 2.8에서 확정)
- [x] Mock 서비스 레이어 구현
- [x] 각 페이지 UI 컴포넌트 (spec.md 기반)
```

**2. 커밋:**
```bash
git add frontend/
git add -f frontend/.env.local   # Mock 환경변수 포함
git commit -m "feat: Phase 0 — React frontend with Mock layer, {feature-name}"
```

**3. 로컬 서버 기동 + 인증 검증 통합 (UI 프로토타입 + 실제 로그인 + storageState 저장 1회 통합):**

> **방안 A (HTTPS + storageState 통합 검증)**: AUTH_PROFILE 이 `none` 이 아니면
> Caddy 게이트키퍼가 종단한 HTTPS 진입(`https://${LOCAL_DEV_HOST}/`, **포트 없이**)으로 dev 서버를 띄운 뒤,
> `save-auth-state.sh` 가 여는 단일 Playwright 세션에서 UI 검증 → 실제 로그인 → storageState 저장이
> 한 번에 처리된다. **별도의 Stage 2-F 단계는 더 이상 존재하지 않는다.**
>
> Vite 직접 노출(`https://...:5173`) 은 금지 — 포트가 노출되면 Caddy 우회·`_ifwt` 쿠키 차단이 발생한다.

```bash
LOCAL_DEV_HOST="local-{프로젝트}.{도메인}"   # boilerplate-setup Stage 1.6 에서 확정된 값
LOCAL_DEV_PORT="{8010-8099 중 할당된 값}"  # state.json.local_dev_port
AUTH_PROFILE="{state.json.auth_profile}"     # insign / nxas / insign-with-nxas / custom / none

echo "──────────────────────────────────────────"
echo "⚠️  아래 명령을 터미널에서 직접 입력해주세요:"
echo ""
echo "  # 1) frontend dev 서버 (평문 HTTP — Caddy 가 https 종단)"
echo "  cd frontend && npm run dev -- --port ${LOCAL_DEV_PORT}"
echo ""
if [ "$AUTH_PROFILE" != "none" ]; then
  echo "  # 2) Playwright 헤드풀 브라우저 (UI 검증 + 로그인 + storageState 저장)"
  echo "  ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST}"
  echo ""
  echo "  ※ 이 단일 세션에서 UI 레이아웃·GNB·INSIGN SDK 확인 + 실제 로그인을 모두 수행한다."
  echo "  ※ 브라우저 창을 닫으면 tests/e2e/.auth/user.json 으로 storageState 가 자동 저장된다."
fi
echo "──────────────────────────────────────────"
echo "접속 URL (포트 없이): https://${LOCAL_DEV_HOST}/"
[ "$AUTH_PROFILE" = "insign" ] || [ "$AUTH_PROFILE" = "insign-with-nxas" ] && \
  echo "INSIGN 검증 라우트: https://${LOCAL_DEV_HOST}/insign-debug"
```

AUTH_PROFILE = `none` (인증 없는 프로젝트):
```bash
# storageState 저장 단계 자체를 건너뛴다 — 일반 dev 서버로만 UI 검증
echo "⚠️  아래 명령을 터미널에서 직접 입력해주세요:"
echo "  cd frontend && npm run dev -- --port ${LOCAL_DEV_PORT}"
echo "→ https://${LOCAL_DEV_HOST}/   (Caddy 가 평문 dev 서버로 reverse proxy)"
```

> **서버 종료 시점 (권장):**
> **사용자가 A(승인)를 입력한 직후** 터미널에서 Ctrl+C로 Vite 서버를 종료한다.
> - B(피드백) 반복 중에는 서버를 유지한다 — 수정 후 브라우저 HMR 새로고침 가능해야 하기 때문
> - A 승인 후 Step 2.8(타입 확정)·Step 3~6(decisions.md → tasks.md)은 코드/문서 작업이므로 서버 불필요
> - Playwright 헤드풀 브라우저는 사용자가 직접 닫으면 자동 종료 (storageState 저장됨)

**4. 사용자에게 확인 요청:**

> **Step 2.7 의 사용자 확인 분기 기준은 `state.json.auth_profile` 한 값으로 통일한다.**
> GNB 스크립트 삽입·레이아웃 패딩 등 다른 단계에서 사용하는 `GNB_REQUIRED` / `INSIGN_REQUIRED`
> 플래그는 그대로 유효하며, 다음 관계로 AUTH_PROFILE 에서 파생된다:
>   - `GNB_REQUIRED = (AUTH_PROFILE ∈ {insign, insign-with-nxas})`
>   - `INSIGN_REQUIRED = (AUTH_PROFILE ∈ {insign, insign-with-nxas})`

`AUTH_PROFILE = 'none'` (인증 없는 프로젝트 — UI 검증만):
```
✅ Phase 0 — React Frontend (Mock) 준비 완료

접속 URL: https://${LOCAL_DEV_HOST}/   (포트 없이 — Caddy 가 평문 dev 서버로 reverse proxy)

구현된 페이지:
  {spec.md 페이지 목록}

확인 후 아래 중 하나를 입력해주세요:
  A) 이대로 진행 → Step 2.8 (TypeScript 타입 확정)으로 이동
  B) UI 피드백 있음 → 수정 내용을 말씀해주세요
```

`AUTH_PROFILE != 'none'` (HTTPS + 실제 로그인 + storageState 저장 통합 검증):
```
✅ Phase 0 — React Frontend (Mock) + HTTPS + 인증 통합 검증 준비 완료

접속 URL    : https://${LOCAL_DEV_HOST}/   (포트 없이 — Caddy 가 https 종단)
검증 도구  : ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST}
            (단일 Playwright 세션에서 UI 확인 → 실제 로그인 → storageState 자동 저장)

브라우저가 열린 동일 세션에서 아래 4단계를 순서대로 확인해주세요:

━━ [1단계] UI 레이아웃 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  □ 모든 페이지가 의도한 레이아웃·컬러·인터랙션으로 표시됨
  □ {spec.md 페이지 목록 나열}

━━ [2단계] GNB / 외부 인증 진입 (AUTH_PROFILE 에 insign 포함 시) ━
  □ GNB 바가 화면 상단에 렌더링됨
  □ GNB 로그인 버튼 클릭 → signin.nexon.com 이동됨
  □ 넥슨 테스트 계정으로 로그인 → 서비스 URL로 복귀됨
  □ GNB에 로그인 상태 표시됨 (_ifwt 쿠키 발급)

━━ [2'단계] NXAS SSO 진입 (AUTH_PROFILE 에 nxas 포함 시) ━━━━
  □ "사내 로그인" 버튼 클릭 → nxas.nexon.com 이동
  □ SSO 인증 완료 후 /auth/callback 으로 복귀
  □ 사용자 프로필(EMPNO·DEPTName 등) 표시 확인

━━ [3단계] INSIGN SDK / 토큰 확인 (AUTH_PROFILE 에 insign 포함 시) ━
  □ 하단 "🔍 INSIGN 검증" 탭 클릭 → #/insign-debug 이동
  □ SDK 상태: inface.js 로드 ✅ / init() callbackOk ✅
  □ 인증 상태: isSignedIn() ✅ true (2단계 로그인 상태 유지됨)
  □ getUserProfile() → uid, platform_user_id 확인됨
  □ 백엔드 테스트 패널 → /api/verify → HTTP 200 수신
     (백엔드 서버 미기동 시 이 항목만 건너뜀 — Phase 1 에서 확인)

━━ [4단계] storageState 자동 저장 (브라우저 종료 시) ━━━━━━━
  □ 위 1~3단계 확인 후 Playwright 브라우저 창을 닫는다
  □ 콘솔에 "storageState : tests/e2e/.auth/user.json" 메시지 표시 확인
  □ 인증 쿠키 검증 결과: YES (NO 표시 시 로그인 미완료 — 재실행 필요)
  □ 이후 e2e 테스트가 매번 로그인 없이 인증 상태로 시작 가능

확인 후 아래 중 하나를 입력해주세요:
  A) 전 단계 통과 + storageState 저장 완료 → Step 2.8 (TypeScript 타입 확정)으로 이동
  B) UI 피드백 있음 → 수정 내용을 말씀해주세요
  C) 인증/SDK 이슈 → 구체적인 증상을 알려주세요
```

**A 입력 시 — storageState 검증 + Step 2.7 산출물 강제 검증 후 Step 2.8 진행:**

```
→ tests/e2e/.auth/user.json 존재 + 인증 쿠키 YES 확인:
    test -f tests/e2e/.auth/user.json && echo "✅ storageState 저장됨" \
        || echo "❌ storageState 없음 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행 필요"

→ state.json 갱신 (auth_storage_ready=true, step27_user_approved=true):
    mcp__d2a-harness__update_state({
      patch: {
        auth_storage_ready: true,
        auth_storage_saved_at: "<ISO 8601 — 오늘 날짜>",
        step27_user_approved: true
      }
    })

→ Step 2.7 사용자 승인 이벤트 활동 로그 기록 (Phase 1 게이트 검증 통과 조건):
    ./scripts/log-activity.sh SKILL "create-spec Step 2.7 user-approval" \
      "auth_profile=${AUTH_PROFILE} — UI/GNB/INSIGN/storageState 4단계 통과" || true

→ Phase 1 게이트 사전 점검 (선택 — 누락분 즉시 보고):
    mcp__d2a-harness__check_phase_gate({ phase: 1 })
    blockers가 있으면 사용자에게 보고하고 보강 후 재시도.

→ 터미널에서 Ctrl+C로 dev 서버를 종료해주세요.
→ 이후 Step 2.8 (TypeScript 타입 확정)을 진행합니다.
```

> **강제 사항**: 위 세 단계(`update_state` / `log-activity` / `check_phase_gate`)는 모두 수행한다.
> `update_state`로 `step27_user_approved=true`를 설정하지 않거나 활동 로그가 빠지면 Phase 1
> 진입 게이트(`check_phase_gate(phase=1)`)에서 자동 차단된다.
> 검증 항목: INSIGN 자산(`lib/insign.ts` / `InsignContext.tsx` / `apiClient.ts`) + Mock 잔존 부재
> + storageState 쿠키 expires 유효 + `step27_user_approved=true` 또는 activity log 이벤트.
> 케이스 배경: `docs/case-studies/step27-validation-gap.md`

**AUTH_PROFILE = 'none' 인 경우**: storageState 검증은 건너뛰고 dev 서버만 종료한다.

**B 입력 시 — 피드백 반영 처리 (서버 유지, HMR 적용):**
- **레이아웃 변경**(사이드바 추가/제거, KPI 구성 변경 등) 포함 시: `design/design-direction.md` "선택 결과" 섹션을 업데이트하고 안내 출력:
  ```
  ⚠ 레이아웃이 변경되었습니다.
  design/design-direction.md를 현재 구현 기준으로 갱신했습니다.
  이 내용은 이후 plan.md와 tasks.md 작성의 기준이 됩니다.
  ```
- **기능 추가/제거** 포함 시: spec.md를 먼저 수정한 뒤 React 컴포넌트를 갱신한다.

**C 입력 시 — 인증/SDK/storageState 이슈 점검:**
```
GNB 미표시:
  1. frontend/index.html의 3곳(head/body시작/body끝) 스크립트 삽입 여부 확인
  2. /etc/hosts 에 127.0.0.1  ${LOCAL_DEV_HOST} 등록 여부 확인
  3. Caddy 가 ${LOCAL_DEV_HOST} 사이트를 인식하는지 확인:
       sudo brew services list | grep caddy   # started 인지
       curl -kI https://${LOCAL_DEV_HOST}/    # 200/3xx 인지
  4. dev 서버가 평문 HTTP 로 localhost:${LOCAL_DEV_PORT} 에서 떠 있는지 확인

INSIGN init() 실패:
  1. 주소창 URL 에 포트 번호가 없는지 확인 (https://${LOCAL_DEV_HOST}/ — 443 자동)
       포트가 노출되면 Caddy 우회 → _ifwt 쿠키 차단
  2. VITE_INFACE_WEB_AUTH 환경변수가 ${LOCAL_DEV_HOST} 와 일치하는지 확인
  3. 브라우저 콘솔 오류 메시지 확인 (Mixed Content, CORS, CSP)

storageState 인증 쿠키 NO:
  1. Playwright 세션 안에서 실제로 로그인 완료까지 진행했는지 확인
  2. 외부 인증 페이지 (signin / nxas) 에서 콜백 URL 까지 정상 복귀했는지 확인
  3. 재실행: rm tests/e2e/.auth/user.json && ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST}

백엔드 테스트 실패 (선택 검증):
  verify-backend.js 또는 backend dev 서버가 LOCAL_BACKEND_PORT 에서 떠 있는지 확인
  (INFACE_API_KEY 미설정 시 로컬에서는 API Key 검증 생략됨 — optional)
```

> **A 입력 후에만 Step 2.8로 진행한다.**
> 3단계 중 "백엔드 테스트 패널" 항목만 미완료여도 A 입력이 허용된다.
> 단 **4단계 (storageState 자동 저장)** 는 AUTH_PROFILE != 'none' 인 경우 필수 통과 항목이다.
> (storageState 미생성 시 Phase 1 진입 게이트에서 Blocker 로 차단됨)
> (백엔드는 Phase 1에서 구현하므로, Step 2.7 단계에서 미기동 상태는 정상임)

---

## Step 2.7.5: AI 사용성 테스트 자동 게이트 (UI 승인 후 / Step 2.8 진입 전)

> **트리거**: Step 2.7의 사용자 A(승인) 직후 자동 진입.
> Step 2.8 (타입 확정 → Phase 1 구현)에 들어가기 전 **UI 결함을 1차 자동 필터링**한다.

### 자동 실행 조건
- `state.json.auth_profile != 'none'` → storageState 재사용
- spec.md 페이지 목록에 UI 페이지 ≥ 1
- `frontend/package.json` 존재 (Step 2.7 결과)

### 실행

```bash
# 사전 셋업 1회 (specs/{NNN}/ut/playwright/ 가 없으면 자동 생성)
.claude/skills/ai-usability-test.md Step 1~3 인라인 실행
# 또는
Skill("ai-usability-test")
```

### 게이트 판정 (`UT_FINDINGS_REPORT.md` 의 Executive Summary 기준)

| 등급 | 카운트 | 조치 |
|---|---|---|
| **S4 Critical** | ≥ 1 | ⛔ Step 2.8 진입 차단 → 결함 수정 후 재실행 |
| **S3 Major** | ≥ 3 | ⚠️ 사용자 확인 후 진행 (이월 또는 즉시 수정 선택) |
| **S3 Major** | ≤ 2 | ✅ 진행 + REDESIGN_PROPOSAL.md 의 P1 항목을 tasks.md 백로그에 자동 등록 |
| **S2 / S1** | 임의 | ✅ 진행 (정보로만 기록) |

### 산출물 (`specs/{NNN}/ut/`)
- UT_PLAN.md / UT_SCENARIOS.md / UT_OBSERVATION_SHEET.md / UT_FINDINGS_REPORT.md / REDESIGN_PROPOSAL.md
- observations/raw-observations.json
- screenshots/{persona}-{scenario}.png
- playwright/run-ut.mjs

> 이 게이트의 목적은 **Phase 1 구현 *전*에 UI 결함을 잡는 것**.
> Phase 1 끝나고 잡으면 재작업 비용이 ~5배 증가 (코드 리팩터링 동반).
> 참조: `.claude/skills/ai-usability-test.md` Step 6.5 Phase 게이트 통합

---

## Step 2.7.6: 디자인 토큰 준수 게이트 자동 배선 (DESIGN_SYSTEM = nxbasic 전용)

> **트리거**: Step 2.7 사용자 A(승인) 직후, Step 2.7.5(AI UT 게이트)와 병렬로 진입.
> Step 2.7 의 "DESIGN_SYSTEM = nxbasic 확인" 결과가 `nxbasic` 일 때만 실행한다 — 커스텀/디자인 시스템 없음이면
> 강제할 토큰 기준 자체가 없으므로 이 스텝 전체를 스킵한다(로그도 남기지 않음).

### 자동 실행 조건
- `state.json.design_system == "nxbasic"` 또는 `design-direction.md` "디자인 시스템" 항목이 NX Basic
- `frontend/src` 존재 (Step 2.7 결과)

### 실행 — ①설정 부트스트랩 → ②baseline 동결(최초 1회) → ③tasks.md 배선

```bash
# ① 설정 부트스트랩 — 파일이 이미 있으면 건드리지 않는다(팀이 커스터마이즈했을 수 있음)
if [ ! -f frontend/tests/tokens/token-conformance.config.mjs ]; then
  cp frontend/tests/tokens/token-conformance.config.example.mjs \
     frontend/tests/tokens/token-conformance.config.mjs
  # roots를 실제 소스 위치로 좁힌다(예시 기본값 그대로면 스캔 범위가 부정확)
  node -e "
    const fs = require('fs');
    const p = 'frontend/tests/tokens/token-conformance.config.mjs';
    let t = fs.readFileSync(p, 'utf-8');
    t = t.replace(/roots:\s*\[[^\]]*\]/, \"roots: ['frontend/src']\");
    t = t.replace(/reportDir:\s*'[^']*'/, \"reportDir: 'specs/{NNN}/tokens'\");
    fs.writeFileSync(p, t);
  "
fi

# ② baseline 동결 — 지금 승인된 Step 2.7 Mock UI 코드를 기준으로 1회만 실행한다.
#    (이 시점 이후 코드는 전부 "신규"로 취급되어 게이트 대상이 된다 — 되도록 이 순서를 지킨다)
node frontend/tests/tokens/token-conformance.mjs --update-baseline
git add frontend/tests/tokens/token-conformance.config.mjs specs/{NNN}/tokens/token-baseline.json
git commit -m "chore(tokens): token-conformance baseline 최초 동결 — Step 2.7 승인 시점 기준"
```

### tasks.md 배선 (Step 6 연동)

Step 6(tasks.md 생성)에서 매 Phase 마지막에 자동 삽입되는 `T{N}-review` 태스크의 `done` 기준에
`token:` 항목을 함께 넣는다 — 상세 템플릿은 Step 6 "T{N}-review 태스크 자동 삽입" 참조.
이렇게 하면 Step 2.7 시점의 1회 baseline 스냅샷에 그치지 않고, **이후 모든 Phase 구현이 끝날 때마다**
새 하드코딩이 없는지 재확인된다 — `ai-usability-test`(Step 2.7.5)가 UI 승인 *전* 1회성 필터인 것과 달리,
이 게이트는 Phase 1부터 배포까지 **상시 재확인되는 게이트**다.

### 실패/스킵 처리
- 설정 파일이 이미 존재하면 부트스트랩을 건너뛴다(덮어쓰지 않음).
- `--update-baseline` 은 최초 스냅샷이라 실패 조건이 사실상 없다. 스크립트 실행 자체가 안 되면(node 부재 등)
  사용자에게 보고만 하고 **Step 2.8 진입을 막지는 않는다** — 이 스텝은 차단용이 아니라 이후 배선용이며,
  실질적인 강제는 Step 6에서 삽입되는 `token:` done 기준(Phase review 시점)이 담당한다.

> 참조: `.claude/skills/token-conformance.md`, `frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md` §4(baseline 계약)

---

## Step 2.8: TypeScript 타입 확정 (UI 승인 후)

> **트리거**: Step 2.7에서 사용자가 **A(승인)** 를 입력한 직후 실행한다.
> 이 단계에서 확정된 타입이 Step 5(data-model.md)의 DB 스키마 역설계 기준이 된다.

### 목적

Step 2.7에서 생성한 rough type(`[key: string]: unknown` 포함)을 승인된 UI 컴포넌트 props를 기반으로
최종 TypeScript 인터페이스로 확정한다.

### 타입 확정 절차

각 페이지 컴포넌트 파일을 읽고, 실제 사용된 props·데이터 구조에서 타입을 역산한다:

1. `frontend/src/types/*.ts`에서 `[key: string]: unknown` 플레이스홀더 제거
2. **날짜 필드**: UI에 Date 피커 있음 → `Date`, 텍스트 표시만 → `string`
3. **선택적 필드**: UI에서 optional로 렌더링된 항목 → `?: T`
4. **열거형**: UI 선택지(버튼·드롭다운)에서 확인된 값만 → `union type`
5. **중첩 구조**: 컴포넌트의 실제 데이터 드릴다운 수준에 맞게 구체화

### 예시 (Todo 앱 기준)

```typescript
// Before (Step 2.7 rough type)
export interface Todo {
  id: string;
  title: string;
  [key: string]: unknown;  // rough placeholder
}

// After (Step 2.8 확정 — UI 컴포넌트에서 역산)
export interface Todo {
  id: string;
  title: string;          // 최대 200자 (spec.md F-02 제약)
  description?: string;   // 선택 입력, 상세 모달에서만 표시됨
  dueDate?: Date;         // DatePicker 컴포넌트 확인 → Date 타입
  priority: 'high' | 'medium' | 'low';  // 3개 버튼으로 확인
  status: 'todo' | 'in_progress' | 'done';  // 칸반 컬럼과 1:1 대응
  categoryId?: string;    // 카테고리 선택 UI에서 확인
  tags: string[];         // 태그 멀티선택 UI에서 확인
  createdAt: Date;
  updatedAt: Date;
}
```

### 확정 후 검증 및 커밋

```bash
# rough placeholder 제거 확인
if grep -rn "\[key: string\]: unknown" frontend/src/types/ 2>/dev/null | grep -q .; then
  echo "⚠️  rough type이 아직 남아 있습니다:"
  grep -rn "\[key: string\]: unknown" frontend/src/types/
else
  echo "✅ rough type 없음"
fi

# 타입 변경으로 빌드 통과 확인
cd frontend && npm run build

git add frontend/src/types/
git commit -m "feat(types): finalize TypeScript types from approved UI — step 2.8"
```

> Step 2.8 완료 후 → Step 3 (decisions.md) 진행.
> Step 5 (data-model.md) 작성 시 여기서 확정된 타입을 기준으로 DB 스키마를 역설계한다.

---

## Step 3: decisions.md + prerequisites.md

spec.md에서 기술 결정이 필요한 항목을 추출하여 문서화한다.

## Step 4: plan.md

spec.md 확정 후 구현 계획을 생성한다.

plan.md 구조:
```markdown
# 구현 계획

## 아키텍처 개요
## Phase 분리
## Phase별 산출물
## 기술 스택 (CLAUDE.md 헌법 기반)
## 리스크 및 대응
```

## Step 5: data-model.md + api-spec.yaml

plan.md 확정 후 자동 생성한다.

## Step 6: tasks.md — 자기완결 형식 생성

**Phase 0 (React Frontend + Mock 구현)은 이미 완료 상태(☑)**로 기록한다. (`prototype/index.html`은 생성하지 않는다.)
Phase 0.5 (외부 연동 검증)는 🔴 외부 연동이 1개 이상인 경우에만 포함한다.

### 자기완결 태스크 스펙 형식

각 태스크는 `/run-phase`가 별도 컨텍스트에서 독립 실행할 수 있도록 다음 필드를 포함한다:

```markdown
## Phase 0.5: 외부 연동 검증

### T050: 환경변수 키 목록 확정
**read**: specs/{NNN}/prerequisites.md, .env.example
**write**: .env.example
**done**:
  - file: .env.example
  - contains: .env.example :: {필수 환경변수 키}
**deps**: -
**status**: ☐

### T051: 전체 외부 연동 Smoke Test
**read**: specs/{NNN}/prerequisites.md
**write**: integration-ready.md
**done**:
  - file: integration-ready.md
  - contains: integration-ready.md :: ✅ AUTONOMOUS ZONE 진입 가능
**skill**: collect-prerequisites
**deps**: T050
**status**: ☐

## Phase 1: {이름}

### T101: {태스크 제목}
**read**: specs/{NNN}/spec.md#{관련 섹션}, specs/{NNN}/api-spec.yaml, {정책 파일 경로}
**write**: {출력 파일 1}, {출력 파일 2}
**done**:
  - file: {출력 파일 1}
  - cmd: npm run build
  - regex: {출력 파일 1} :: export (default )?function {함수명}
**no-read**: {읽지 말아야 할 광범위 파일} (예: authentication.md 전체)
**deps**: T050 (선행 태스크 ID, 없으면 -)
**status**: ☐
```

### GNB 포함 태스크 예시

> **Step 2.7에서 GNB가 이미 삽입된 경우**: Phase 1에서 GNB 재삽입 태스크는 불필요하다.
> GNB 삽입이 Phase 1에서 처음 이루어지는 경우(Step 2.7 미실행 프로젝트)에만 아래 예시를 사용한다.

```markdown
### T{N}: GNB 삽입 + INSIGN 연동 (InfaceTest 패턴)
**read**: specs/{NNN}/plan.md,
          refs/policies/authentication-external.md#A-10,
          frontend/src/lib/insign.ts
**write**: frontend/index.html,
           frontend/src/lib/insign.ts,
           frontend/src/context/InsignContext.tsx,
           frontend/src/lib/apiClient.ts
**done**:
  - contains: frontend/index.html :: ngb_head.js
  - contains: frontend/index.html :: ngb_bodystart.js
  - contains: frontend/index.html :: gnb.min.js
  - contains: frontend/index.html :: data-gamecode
  - contains: frontend/index.html :: ngb_bodyend.js
  - contains: frontend/src/lib/insign.ts :: waitForInsignAuth
  - contains: frontend/src/context/InsignContext.tsx :: useInsign
  - cmd: cd frontend && npm run build
**deps**: T{prev}
**status**: ☐
```

### Mock → 실제 API 교체 태스크 예시 (Phase 1 핵심)

Step 2.7에서 Mock으로 구현된 서비스 레이어를 실제 백엔드 API로 교체하는 태스크.
**`scripts/check-mock-cleanup.sh` 통과가 완료 기준에 반드시 포함되어야 한다.**

```markdown
### T{N}: Mock → 실제 백엔드 API 교체 + Mock 코드 제거
**read**: specs/{NNN}/contracts/api-spec.yaml,
          frontend/src/services/{entity}Service.ts,
          frontend/src/mocks/{entity}Mock.ts
**write**: frontend/src/services/{entity}Service.ts,
           frontend/src/mocks/{entity}Mock.ts (삭제),
           frontend/src/mocks/index.ts (삭제)
**done**:
  - contains: frontend/src/services/{entity}Service.ts :: apiFetch
  - cmd: test ! -d frontend/src/mocks && echo "mocks 폴더 제거됨"
  - cmd: cd frontend && npm run build
  - cmd: npx playwright test tests/e2e/{feature}.spec.ts --reporter=line
  - cmd: bash scripts/check-mock-cleanup.sh
**deps**: T{prev}
**status**: ☐
```

### 태스크 스펙 작성 규칙

- **read**: spec.md, api-spec.yaml, data-model.md에서 해당 태스크에 필요한 섹션만 명시. Phase 1 API 연동 태스크는 `contracts/api-spec.yaml`과 `frontend/src/services/`를 read에 포함한다. `prototype/index.html`은 Step 2.7 이후 존재하지 않으므로 read에 포함하지 않는다. 포함 우선순위: `contracts/api-spec.yaml` > `frontend/src/services/` > `spec.md`
- **write**: 이 태스크가 생성/수정할 파일 목록. **프론트엔드 UI 파일(`.tsx`/`.jsx`/`.vue`/`.svelte`)을 write에 포함하는 태스크는 반드시 `tests/e2e/{feature-name}.spec.ts`를 write에 추가한다.** e2e 설정이 없으면 boilerplate-setup Stage 2-E를 먼저 실행한다.
- **done**: 타입 명시 형식으로 기술 (MCP가 직접 실행하여 검증) — 타입 형식은 CLAUDE.md 규칙 4 참조. **프론트엔드 UI 파일을 write에 포함하는 태스크는 반드시 `cmd: npx playwright test tests/e2e/{feature-name}.spec.ts --reporter=line`을 done 기준에 포함한다.** spec.ts는 Happy path 1개 + Error path 1개를 최소 단위로 작성한다.
- **외부 연동 done 기준 완전성**: 태스크의 write 대상이 외부 연동(GNB·INSIGN 등)을 포함하는 경우, 해당 정책 파일의 요구 항목을 모두 done 기준에 반영해야 한다. GNB 삽입 태스크 done 기준 필수 5항목: `ngb_head.js`, `ngb_bodystart.js`, `gnb.min.js`, `data-gamecode`, `ngb_bodyend.js`.
- **보호 라우트 e2e 패턴**: `state.json.auth_profile != 'none'` (INSIGN/NXAS/custom) 인 프로젝트의 보호 라우트(로그인 후 진입) 태스크는 e2e spec 에서 `tests/e2e/fixtures/auth-mock.ts` 의 `authenticatedPage` fixture 를 사용한다. 일반 라우트와 import 가 다르다:
  ```typescript
  // 보호 라우트 (인증 필요)
  import { test, expect } from '../fixtures/auth-mock';
  test('대시보드 진입', async ({ authenticatedPage: page }) => { ... });

  // 공개 라우트 (인증 불필요)
  import { test, expect } from '@playwright/test';
  test('메인 화면', async ({ page }) => { ... });
  ```
  fixture 가 로컬은 `tests/e2e/.auth/user.json` storageState 를 자동 사용하고, CI 는 모드별 모킹으로 자동 분기한다 (create-spec Step 2.7 통합 검증의 `save-auth-state.sh` 가 storageState 를 1회 저장한다).
- **Mock 제거 완료 기준**: Mock → API 교체 태스크에는 반드시 `cmd: bash scripts/check-mock-cleanup.sh`를 done 기준에 포함한다. 이 스크립트는 mocks 디렉터리·USE_MOCK 참조·rough type placeholder를 통합 검증한다.
- **write → done 경로 일치**: done 기준의 `file:`/`contains:`/`regex:` 경로는 `write` 필드에 명시한 실제 생성 경로와 반드시 일치해야 한다. 프레임워크 초기화(`next`, `vite` 등)로 생성되는 파일은 `src/` 유무를 미리 확인하고 실제 경로를 `write`에 먼저 기재한 뒤 `done`을 작성한다.

- **no-read**: 광범위 파일(전체 authentication.md, 전체 gamescale-docs)은 읽지 않도록 명시
- **deps**: 선행 태스크가 완료(☑)되어야 시작 가능한 경우만 기입

### T{N}-review 태스크 자동 삽입 (필수)

**모든 Phase(1 이상)의 마지막 태스크로 반드시 T{N}-review를 삽입한다.**
이 태스크가 없으면 MCP 루프에서 review가 실행되지 않는다.

형식 (Phase 번호를 N으로 치환. **`DESIGN_SYSTEM == nxbasic` 인 프로젝트는 `done` 에 `token:` 두 줄을
추가한다** — Step 2.7.6 에서 배선된 정적 토큰 게이트가 매 Phase 종료 시점마다 재확인되도록 한다):
```markdown
### T{N}-review: 서브에이전트 코드 리뷰
**read**: -
**write**: .claude/review-tokens/phase-{N}.token
**skill**: subagent-review
**done**:
  - file: .claude/review-tokens/phase-{N}.token
  - cmd: node frontend/tests/tokens/token-conformance.mjs        # DESIGN_SYSTEM=nxbasic 전용
  - token: specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0   # DESIGN_SYSTEM=nxbasic 전용
**deps**: {해당 Phase의 마지막 구현 태스크 ID}
**status**: ☐
```

예) Phase 1의 마지막 구현 태스크가 T103이고 DESIGN_SYSTEM=nxbasic 이면:
```markdown
### T1-review: 서브에이전트 코드 리뷰
**read**: -
**write**: .claude/review-tokens/phase-1.token
**skill**: subagent-review
**done**:
  - file: .claude/review-tokens/phase-1.token
  - cmd: node frontend/tests/tokens/token-conformance.mjs
  - token: specs/001-todo/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
**deps**: T103
**status**: ☐
```

> Phase 0, 0.5는 제외. Phase 1 이상에서만 삽입.
> `skip-review: true` 주석이 있는 Phase는 삽입하지 않는다 (문서/설정 전용 Phase).
> **`token:` 두 줄은 `DESIGN_SYSTEM == nxbasic` 인 프로젝트에서만** 삽입한다(Step 2.7.6 참조).
> 커스텀/디자인 시스템 없음 프로젝트는 이 두 줄을 생략하고 `file:` 기준 하나만 유지한다.

스펙 문서 생성 완료 후 커밋한다:

```bash
git add specs/{NNN}/spec.md specs/{NNN}/plan.md specs/{NNN}/tasks.md \
        specs/{NNN}/decisions.md specs/{NNN}/prerequisites.md \
        specs/{NNN}/data-model.md specs/{NNN}/contracts/api-spec.yaml
git commit -m "docs: {feature-name} spec documents created"
```

이후 다음 스킬을 자동 호출한다:

```
🔴 외부 연동이 1개 이상인 경우:
Skill("collect-prerequisites")

🟢 외부 연동이 없는 경우:
Skill("run-phase", "1")
```

---
name: token-conformance
description: 디자인 토큰(색상·타이포) 준수 배포 게이트. 코드에 박힌 색상 hex/rgb/hsl·하드코딩 font-size 를 정적 분석으로 검출하고, baseline 대비 신규 위반만 차단한다. "토큰 검사", "하드코딩 색상 찾아줘", "디자인 토큰 준수 확인", "token conformance", "컬러 토큰 게이트" 등의 요청에 적용.
last_updated: 2026-07-13 (신설 — NX Basic 색상 변수 + type 유틸 클래스 체계 기반)
---

# 디자인 토큰 준수 게이트 (Token Conformance)

> 디자인 시스템 토큰을 "쓰라고 권하는 것"에서 **"안 쓰면 배포가 막히는 것"** 으로 만든다.
> `ai-usability-test` 와 동일 철학 — **결정론적으로 검출되는 리터럴에만 게이트**를 걸고, 주관 판단은 advisory 로 분리한다.

## 왜 필요한가

디자인 시스템을 도입해도 강제 장치가 없으면 아래가 반복된다. 이 게이트는 **①·②를 직접 차단**하고 나머지는 파이프라인 전체(`ai-usability-test`·`create-spec`)와 분담한다. 상세: `TOKEN_CONFORMANCE_RUBRIC.md` §0.

| 문제 | 이 게이트의 역할 |
|---|---|
| ① UI/UX 일관성 붕괴(화면마다 색상·폰트·여백 제각각) | **직접 차단** — 하드코딩 검출 |
| ② 디자인 부채 누적(즉흥 컴포넌트·중복 스타일 반복) | **직접 차단** — baseline 이후 신규 부채 원천 차단 |
| ③ 개발 생산성 저하 / ④ 유지보수 난이도 증가 | 간접 — 토큰 참조 강제로 재사용·영향범위 예측 유도 |
| ⑤ SDD 전환 불가(UI 명세 비구조화) | 간접 — `create-spec` Step 2.7.6이 `token-metrics` 를 `done` 기준(`token:`)에 **자동 편입**(DESIGN_SYSTEM=nxbasic 전용, 수동 배선 불필요) |

## 무엇을 검출하나 (NX Basic 전제)

| 축 | 토큰 방식 | 위반(하드코딩) |
|---|---|---|
| 색상 | `var(--color-*)` / `var(--semantic-*)` | `#fff`, `rgb(...)`, `hsl(...)` 리터럴 |
| 타이포 | `.type-default-16` 등 유틸 클래스 (또는 `var(--font-*)`) | `font-size: 14px` 등 직접 선언 |

> 색상은 CSS 변수, 타이포는 **유틸 클래스**로 소비된다(`sooyachoco/NXbasic1.0v`: colors.css·tokens.ts·typography.css).
> **spacing 토큰은 아직 없어 범위 밖.** 판정 계약 전문: `frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md`.

## 산출물

| 파일 | 역할 |
|---|---|
| `{specDir}/tokens/TOKEN_CONFORMANCE_REPORT.md` | 위반 목록 + 커버리지 + machine-readable 지표 주석 |
| `{specDir}/tokens/token-baseline.json` | 기존 위반 동결 스냅샷(면제 대상) |

## 실행 (repo 루트에서)

```bash
# 0) 최초 1회: 설정 복사 후 대상 프로젝트에 맞게 편집(roots/reportDir/tokenSources)
cp frontend/tests/tokens/token-conformance.config.example.mjs frontend/tests/tokens/token-conformance.config.mjs

# 1) 기존 부채 동결 — 도입 시점의 위반을 baseline 으로 면제(반드시 1회, 커밋)
node frontend/tests/tokens/token-conformance.mjs --update-baseline

# 2) 스캔 → 리포트 생성 (신규 위반만 집계)
node frontend/tests/tokens/token-conformance.mjs

# 3) 임계 self-check (CI·로컬) — 미충족 시 exit 1
node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0
```

> **baseline 을 안 만들면 모든 하드코딩이 신규 위반으로 잡힌다** — 참조 컴포넌트(Button.css 등)에서 이미 `#fff`·`#1f8a30`·`#c33636` 이탈이 실측됐으므로, 전면 강제 대신 **①동결 → ②신규 차단 → ③점진 상환** 순서를 지킨다.

## 게이트 지표 (`token-metrics` 주석에서 추출)

| 키 | 의미 | 예 |
|---|---|---|
| `token_coverage` | 테마 대상 선언 중 토큰 참조 비율(%) | `token_coverage>=90` |
| `token_violations` | **신규** 하드코딩 건수(baseline 초과분) | `token_violations=0` |
| `token_hardcoded` / `token_baseline` | 전체 하드코딩 / 그중 면제분 | 참고용 |
| `token_advisory` | 게이트 제외(이름색상·미등록 var 등, 사람 검토) | 참고용 |
| `color_coverage` / `type_coverage` | 축별 커버리지 | 참고용 |

## Phase 게이트 통합 (MCP done 기준)

**기본 경로 — 자동 배선(수동 작성 불필요).** DESIGN_SYSTEM=nxbasic 프로젝트는 `create-spec` Step 2.7.6이
사용자가 Step 2.7(화면구성)에서 UI를 승인하는 순간 다음을 전부 자동 처리한다:
1. `token-conformance.config.mjs` 부트스트랩
2. `--update-baseline` 최초 1회 실행(Step 2.7 승인 시점 코드 기준으로 기존 부채 동결)
3. Step 6에서 생성되는 **모든 Phase의 `T{N}-review` 태스크** `done` 에 아래 두 줄을 자동 삽입

```yaml
done:
  - cmd: node frontend/tests/tokens/token-conformance.mjs
  - token: specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
```

`ut:` 와 동일한 파싱·평가 엔진(`evaluateMetricRules`)을 공유해 문법이 일관된다. 상세: `create-spec.md` Step 2.7.6 · Step 6 "T{N}-review 태스크 자동 삽입".

**수동 배선(예외 케이스만)** — create-spec 이전에 이미 화면구성을 마친 레거시 프로젝트, DESIGN_SYSTEM이 커스텀인데 자체 토큰에 이 게이트를 걸고 싶은 경우, 또는 create-spec 파이프라인을 쓰지 않는 프로젝트. MCP `dist/` 재빌드 전제(`ut:` 게이트 때문에 이미 필수 스텝이므로 한계비용은 0에 가깝다 — `INTEGRATION.md` §3-2):

```yaml
done:
  - token: specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
```

**대안: `cmd:` self-contained** — D2A MCP 하네스 자체를 도입하지 않아 §3-2 재빌드를 아예 거치지 않는 프로젝트에서만 쓴다:
```yaml
done:
  - cmd: node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0
```

> 연산자: `=` `==` `!=` `<` `<=` `>` `>=`. 리포트 부재·지표 미검출 시 **실패 처리**(게이트 미실행을 통과로 오인 방지).

## 결과 보고

```
## 디자인 토큰 준수 게이트 완료
📊 커버리지 {N}% (색상 {N}% / 타이포 {N}%)
🚨 신규 위반: {N}건 (baseline 면제 {N}건, advisory {N}건)
📁 specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md
⚡ 다음 단계:
  - 신규 위반 → 해당 hex 를 리포트가 제안한 var(--color-*) 로 교체
  - 기존 부채(baseline) → 별도 리팩터로 상환 후 --update-baseline 재스냅샷
```

## 타 게이트와의 관계

| 게이트 | 무엇을 본다 | 관계 |
|---|---|---|
| `ai-usability-test`(`ut:`) | 런타임 사용성·접근성·성능 (Playwright) | **병렬** — 이건 정적 소스 분석, 저건 런타임 관측 |
| `token-conformance`(`token:`) | 소스의 색상·타이포 토큰 준수 (정적) | — |
| `design:design-system` | 디자인 시스템 문서화·확장 (주관) | 이 게이트로 이탈 검출 → design-system 으로 토큰 추가 논의 |

# UX Research — AI 네이티브 리서치 지식 베이스

> **출처 개념**: [AI 네이티브 방식의 UX 리서치와 데이터 분석](https://brunch.co.kr/@ghidesigner/493)
> 형제 글: [AI 네이티브 사용성 테스트](https://brunch.co.kr/@ghidesigner/492) → `.claude/skills/ai-usability-test.md`

UX 리서치 산출물을 **HTML이 아닌 MD 파일**로 관리하는 지식 자산 체계.
(토큰 68~87%↓ · RAG 탐색 정확도 35%↑ · git 변경 추적 · 스크립트 실행 위험 0)

> ⚠️ **이 디렉터리는 템플릿(빈) 상태로 배포된다.** 각 파일은 구조·규약만 갖춘 골격이며,
> **프로젝트 시작 시 `/ux-research-sync` 를 실행**해 실제 리서치 데이터(MCP/Notion 등)를
> 신뢰도 등급과 함께 주입해 채운다. 데이터가 비어 있으면 하위 스킬은 "가정 기반"으로 동작한다.

> **생산 스킬**: 이 8종은 `/ux-research-sync` 가 실제 리서치 데이터를 연결해 신뢰도 등급과 함께 채운다.
> **소비 스킬**: `ai-usability-test`·`ui-design-workflow`·`design:design-critique`.

---

## 단일 SOURCE 규약 (drift 방지 — 가장 중요)

페르소나·사용자 여정·시나리오 목표는 **이 디렉터리에서만 정의**한다.
`ai-usability-test`, `1.0.0:ux-design`, `design:design-critique` 등 하위 스킬은
아래 파일을 **읽기만** 하고 자체적으로 재정의하지 않는다.

| 단일 source 파일 | 소비하는 곳 | 소비 방식 |
|---|---|---|
| `PERSONA.md` | `ai-usability-test` Step 1-2 (페르소나 3종) | 읽어서 시뮬레이션 행동에 매핑 |
| `USER_JOURNEY_MAP.md` | `ai-usability-test` Step 2 (UT_SCENARIOS) | 터치포인트 → 검증 시나리오 도출 |
| `USER_SCENARIOS.md` | `ai-usability-test` Step 2 (UT_SCENARIOS) | 목표·성공조건을 권위로 받아 실행 세부만 추가 (2층 분리) |

> 하위 스킬이 페르소나/여정을 직접 새로 만들고 있으면 **규약 위반** —
> 이 파일들로 통합한 뒤 링크로 참조하게 고친다.

---

## 산출물 8종

| 파일 | 역할 | 단계 |
|---|---|---|
| `USER_RESEARCH.md` | 가설·방법론·마일스톤 (전략 이정표) | 1. 설계 |
| `INTERVIEW_GUIDE.md` | AI 에이전트 작동 경계 (CAR: 맥락·지시·규칙) | 1. 설계 |
| `INTERVIEW_NOTES.md` | 전사본 + 자동요약 + 원천 발화 타임코드 | 2. 수집 |
| `SURVEY_ANALYSIS.md` | 정량 설문 + 주관식 패턴 융합 | 3. 분석 |
| `EMPATHY_MAP.md` | 감정·환경·이득·곤경 다차원 구조화 | 3. 분석 |
| **`PERSONA.md`** ⭐ | 페르소나 + 신뢰도 점수 + 실증 링크 | 3. 분석 · **단일 source** |
| **`USER_JOURNEY_MAP.md`** ⭐ | 유입~이탈 터치포인트·결정 순간 (**조건부** — 다단계/리텐션 서비스만, `ux-research-sync` Step 3.5 판단) | 3. 분석 · **단일 source** |
| **`USER_SCENARIOS.md`** ⭐ | 페르소나별 과업의 목표·성공조건 (상류 레이어, 여정맵 N/A 시에도 필수) | 3. 분석 · **단일 source** |

> 외부 3자 데이터는 `EXTERNAL_BENCHMARKS.md` 에 분리 보관한다(검증 근거 아님, 벤치마크 전용).

---

## 데이터 신뢰도 표기 (필수)

"상상한 것"과 "데이터로 검증된 것"을 분리한다. (3단계)

| 표기 | 의미 |
|---|---|
| 🟢 검증 | **대상 서비스 1차 데이터**(자체 설문·UT·트래킹 등)로 직접 확인. 실증 링크 + 표본 한계 명시 필수 |
| 🟢 인접 실증 | 인접 도메인 데이터에서 전이한 행동 패턴. 전이 가정 잔존 |
| 🔵 가설 | 아직 데이터 없는 추정 — `collaboration-tracker.md`에 등록 |

승격 경로: 🔵 가설 → 🟢 인접 실증(전이) → 🟢 검증(1차 직접). 강등도 기록한다(오버클레임 방지).
외부 3자 데이터는 검증 근거가 아니라 **벤치마크**로만 쓰며 [EXTERNAL_BENCHMARKS.md](EXTERNAL_BENCHMARKS.md)에 분리 보관한다.

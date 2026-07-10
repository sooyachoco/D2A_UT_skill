# D2A UT (사용성 테스트) Skill Bundle

D2A 보일러플레이트의 **AI 네이티브 사용성 테스트(UT) 검증** 기능 묶음 — 본체([D2A_UX_UI](https://github.com/sooyachoco/D2A_UX_UI))에서 **UT 자동 검증과 그 근거·게이트**에 해당하는 스킬·에이전트·데이터만 추출한 저장소.
> 출처 작업 기록: Notion — "🦍 AI 네이티브 사용성 테스트 스킬 구축"
> 이 번들은 **UT 전용**이다. 화면설계(상류) 스킬(`write-scenario`·`reference-proposal`·`ui-design-workflow`·`ux-audit`)은 포함하지 않는다.

## 전체 그림

```
[상류] 누구를 위해 / 왜              [하류] 만든 UI가 쓸 만한가            [종착] 개발 전달
 ux-research-sync                     ai-usability-test 스킬               design-handoff
 (실데이터 → SSOT 주입)   ──읽기──▶   (Playwright 3페르소나 자동 검증)  ──▶  (S4=0 후 HANDOFF.md)
        │                                     │
        ▼                                     ▼
 refs/ux-research/                    MCP `ut:` done 게이트
 (페르소나·여정 단일출처)              (S4 결함 → Phase 자동 차단)

[실측 캘리브레이션] 실제 사용자 세션 → AI 시뮬레이션과 대조
 real-ut-intake                        ut-calibrate.mjs
 (실 세션 원본 → 표준 스키마)  ──▶     (실측 vs AI gap 계산 + 파라미터 조정 제안)
        │                                     │
        ▼                                     ▼
 refs/ux-research/real-ut-sessions/    CALIBRATION_REPORT.md
 (scenario-id별 누적, 신뢰도 등급)      (calibrated 여부 표시)
```

사람이 눈으로 보던 UX 검수를, **코드가 숫자로 검사해 자동으로 막는 강제 게이트**로 전환한 묶음이다.
페르소나·여정은 `refs/ux-research/` **한 곳에서만 정의**하고, UT 스킬은 그것을 **읽기만** 해 drift(정의 중복)를 제거한다.

**참고**: AI 시뮬레이션은 반복적·기술적 결함(클릭 정확도, 접근성, 논리 오류)을 빠르게 걸러내는 1차 필터다.
실제 사용자의 인지적 노이즈·감정적 맥락까지 대체하지 않으며, `real-ut-intake` + `ut-calibrate.mjs` 는
그 간극을 **완전히 없애는 게 아니라 측정 가능하게 만드는** 도구다 — 실제 세션을 모집·진행하는 일 자체는
여전히 사람의 몫이다.

## 🔧 보일러플레이트 엔진과 병합 셋업

이 번들은 **단독 실행용이 아니라** D2A 보일러플레이트(엔진, `d2a-boilerplate-claude`) 위에 얹는 **오버레이**다.
아래 스텝이면 엔진에 UX 리서치 SSOT + `ut:` 강제 게이트 + UT 스킬 4종이 활성화된다.

```
# 0) 엔진(보일러플레이트) 준비 — 없으면 먼저 설치
#    새 프로젝트에서 'd2a-installer 실행해줘' 로 d2a-boilerplate-claude 를 받는다.
#    (사내: gitlab.nexon.com/frontdev/inhouse/replatform-playground/d2a-boilerplate-claude)

# 1) 이 번들 클론
git clone https://github.com/sooyachoco/D2A_UXUI_skill.git && cd D2A_UXUI_skill

# 2) 엔진에 병합 설치 (template/ 로 오버레이 복사, 충돌 파일은 .bak 백업)
bash install.sh <d2a-boilerplate-claude 경로>            # macOS/Linux/Git Bash
#  또는
pwsh ./install.ps1 -Target <d2a-boilerplate-claude 경로>  # Windows PowerShell
```

**설치기가 자동으로 하는 것**

1. 신규 파일 복사 — UT 스킬 4종(`ux-research-sync`·`ai-usability-test`·`design-handoff`·`real-ut-intake`) + `refs/ux-research/`(SSOT 11종) + `frontend/tests/ut/run-ut.mjs`·`ut-calibrate.mjs` + `accessibility` 서브에이전트
2. 충돌 파일 덮어쓰기(상위호환) — `create-spec.md`·`pre-launch-check.md`·`task-validator.ts` (기존은 `.bak-<timestamp>` 백업)
3. **MCP 자동 재빌드** — `task-validator.ts` 를 덮어썼으므로 `d2a-mcp-server` 를 `npm install && npm run build` 재빌드해 **`ut:` 게이트를 활성화**(구버전 `dist/` 가 게이트를 조용히 죽이는 것 방지)

**남은 수동 2스텝 (병합 후 정합성)** 4. `CLAUDE.md` **스킬 표에 신규 4종 등록** + 스킬 수 표기 **18개 → 22개** (미등록 시 CLAUDE.md 규약상 자동 호출 안 됨 — 등록 스니펫은 설치기 콘솔/`INTEGRATION.md` 제공). `create-spec`·`pre-launch-check` 은 기존 엔진 스킬 덮어쓰기라 신규 등록 대상이 아니다.
5. 프로젝트 시작 시 **`ux-research-sync 실행해줘`** 로 SSOT(페르소나·여정·과업)를 실제 데이터로 채움 (채우기 전엔 전 항목 🔵 가설)

**병합 검증 (선택)**

```
grep -c 'ut:' d2a-mcp-server/src/tools/task-validator.ts   # >0 (게이트 존재)
grep -rlq checkUtReport d2a-mcp-server/dist && echo "ut게이트 빌드됨"
```
> 파일별 병합 판정(상위호환/동일)·경로 매핑·CLAUDE.md 등록 스니펫 상세는 [`INTEGRATION.md`](https://github.com/sooyachoco/D2A_UT_skill/blob/main/INTEGRATION.md) 참조.
> 병합이 끝나면 파이프라인은 `create-spec(코딩) → ai-usability-test → (실 UT 있으면 real-ut-intake → ut-calibrate) → design-handoff → run-phase(ut: 게이트)` 로 흐른다.

## 구성

### 1. 스킬 (`.claude/skills/`)

| 파일                     | 역할                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ai-usability-test.md` | **핵심 UT 스킬.** Playwright + 3페르소나(초보/파워/접근성) + Nielsen 휴리스틱 자동 사용성 테스트. 산출물 5종 생성, MCP `ut:` done 기준                         |
| `ux-research-sync.md`  | 실제 리서치 데이터를 MCP로 연결 → 신뢰도 3단계(🟢검증/🟢인접/🔵가설)로 ux-research 주입. UT 페르소나의 단일 source 공급                                           |
| `real-ut-intake.md` ⭐신규 | 실 사용자 세션 원본(녹화·노트)을 `UT_OBSERVATION_SHEET.md` 와 동일 스키마로 정규화해 `real-ut-sessions/` 에 저장. 세션을 만들지 않고 정규화만 담당(모집·동의·진행은 범위 밖) |
| `design-handoff.md`    | **(종착)** UT 통과(S4=0) 후 개발 핸드오프 스펙 생성. `design:design-handoff` 플러그인을 엔진으로 호출(없으면 폴백), 앞 단계 산출물을 묶어 `HANDOFF.md`로 출력. 새 결정 금지 |
| `create-spec.md`       | (엔진 상위호환) spec/plan/tasks 생성. Step 0.5(STEP 0 점검) + Step 2.7.5(AI UT 자동 게이트) 포함                                             |
| `pre-launch-check.md`  | (엔진 상위호환) 배포 전 검증 체크리스트 (UT\_FINDINGS\_REPORT 갈음 규칙 연동)                                                                     |

### 2. 에이전트 (`.claude/subagent-templates/`)

| 파일                 | 역할                                                      |
| ------------------ | --------------------------------------------------------- |
| `accessibility.md` | 접근성 리뷰 서브에이전트 템플릿 (ARIA·Tab·Focus) — UT 접근성 페르소나(P3) 심화 |

### 3. UX 리서치 단일 source (`refs/ux-research/`)

페르소나·여정을 한 곳에서만 정의하는 SSOT. UT 스킬은 **읽기만** 한다.
> ⚠️ **템플릿(빈) 상태로 배포된다.** 10종 모두 구조·규약만 갖춘 골격이며 실데이터는 비어 있다. **프로젝트 시작 시 `ux-research-sync 실행해줘`** 로 대상 서비스의 실제 리서치 데이터(MCP/Notion 등)를
> 신뢰도 등급과 함께 주입해 채운다. 채우기 전에는 전 항목 🔵 가설이며 UT 결과는 "가정 기반"으로 표기된다.

| 파일                       | 역할                                            |
| ------------------------ | --------------------------------------------- |
| `README.md`              | 단일 source 규약 + 신뢰도 3단계 체계                     |
| `PERSONA.md` ⭐           | P1 신규 / P2 헤비·도네이터 / P3 접근성 — UT 시뮬레이션 매핑     |
| `USER_JOURNEY_MAP.md` ⭐  | 유입~이탈 5단계 + 이탈 지점                             |
| `USER_SCENARIOS.md` ⭐    | 페르소나별 과업 목표·성공조건 (상류 레이어 — UT가 read-only로 소비) |
| `USER_RESEARCH.md`       | 가설·방법론·마일스톤 + 실증 데이터 출처 표                     |
| `INTERVIEW_GUIDE.md`     | AI 인터뷰어 작동 경계 (CAR 구조)                        |
| `INTERVIEW_NOTES.md`     | 전사+요약+타임코드 템플릿                                |
| `SURVEY_ANALYSIS.md`     | 정량+주관식 융합                                     |
| `EMPATHY_MAP.md`         | 페르소나별 공감맵                                     |
| `EXTERNAL_BENCHMARKS.md` | 외부 공개 데이터 (3자·벤치마크 등급, 검증 근거 미사용)             |
| `REAL_UT_SESSION_LOG_TEMPLATE.md` ⭐신규 | 실 사용자 세션 1건의 표준 로그 템플릿 — `real-ut-intake` 가 복제해 사용 |
| `real-ut-sessions/` ⭐신규 | scenario-id 별 실 세션 로그 누적 디렉토리 (`{scenario-id}/{session-id}.md`) — `ut-calibrate.mjs` 의 입력 |

### 4. MCP `ut:` 강제 게이트

| 파일                                           | 역할                                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d2a-mcp-server/src/tools/task-validator.ts` | `checkUtReport` — `done` 기준의 `ut: {리포트} :: S4=0,S3<=2,complete>=80,wcag=0,visual=0,console=0,lcp<=2500,cls<=100` 평가. Severity + 완료율 + 접근성 + 시각적 회귀 + 런타임/네트워크 오류 + 성능까지 임계로 걸며, 위반 시 Phase 자동 차단 |
| `frontend/tests/ut/run-ut.mjs`               | 범용 UT 러너. `ut.config.mjs` 시나리오를 3페르소나(+선택적 모바일/태블릿)로 재현, storageState 재사용, 인증 리다이렉트 가드, axe 스캔, 콘솔/네트워크 오류·성능 수집                                                                                 |
| `frontend/tests/ut/ut-personas.mjs`          | P1/P2/P3 행동 모델(느린클릭/빠른클릭/키보드전용) + 선택적 `mobile`/`tablet` 프로파일(터치·뷰포트·above-fold 체크)                                                                                                               |
| `frontend/tests/ut/ut-heuristics.mjs` ⭐신규    | 결정론적 Nielsen 검출기(above-fold CTA·destructive-confirm·form-error-recovery·keyboard-reachable 등). 시나리오가 호출해 "AI 눈대중" 대신 관찰 조건을 코드로 검사하고 표준 `errorType` 을 방출                                                     |
| `frontend/tests/ut/UT_HEURISTIC_RUBRIC.md` ⭐신규 | **판정 계약** — `errorType`→휴리스틱→severity→신뢰도 규칙표. 게이트는 결정론 규칙에만 걸고 LLM 자유 라벨은 advisory 로 분리(근거 없는 게이트 방지) + 개선안 패턴 카탈로그                                                                                    |
| `frontend/tests/ut/ut-a11y.mjs`              | axe-core WCAG 자동 스캔 → S1~S4 매핑 (`@axe-core/playwright` 설치 시 활성)                                                                                                                                  |
| `frontend/tests/ut/ut-visual-diff.mjs`       | 이전 실행(baseline) 대비 스크린샷 픽셀 diff → 레이아웃 회귀 자동 감지 (`pixelmatch`+`pngjs` 설치 시 활성)                                                                                                                   |
| `frontend/tests/ut/ut-perf.mjs`              | Core Web Vitals(LCP/CLS/FCP) 수집 + 예산 대비 분류. 외부 의존 없음                                                                                                                                             |
| `frontend/tests/ut/ut-aggregate.mjs`         | `raw-observations.json` + 시각적 diff → `UT_FINDINGS_REPORT.md` 자동 집계. WCAG·런타임/네트워크 오류·성능·시각 회귀를 severity로 승격 + 게이트용 지표 주석 삽입                                                                      |
| `frontend/tests/ut/ut-calibrate.mjs` ⭐신규     | `real-ut-sessions/{scenario-id}/*.md` 와 `raw-observations.json` 을 scenario-id 기준으로 비교해 완료율·소요시간 gap을 계산하고, `ut-personas.mjs` 파라미터 조정 제안이 담긴 `CALIBRATION_REPORT.md` 를 생성. 파라미터 자동 반영은 하지 않음(사람 검토 필수) |
| `frontend/tests/ut/ut.config.example.mjs`    | 시나리오 정의 예시 (`ut.config.mjs` 로 복사)                                                                                                                                                                |

## `ut:` done 기준

`tasks.md` 의 `done` 항목에서 사용:

```
done:
  - ut: specs/001-xxx/ut/UT_FINDINGS_REPORT.md :: S4=0,S3<=2,complete>=80,wcag=0,visual=0,console=0,lcp<=2500,cls<=100
```

`submit_task` 시 리포트의 `ut-metrics` 주석(또는 폴백으로 Executive Summary 표)에서 지표를 추출해 임계 규칙을 평가한다:
S1~S4 · 완료율(`complete`) · 접근성 위반(`wcag`) · 시각적 회귀(`visual`) · 런타임 오류(`console`) · 네트워크 오류(`net`) · 성능(`lcp` ms, `cls` = CLS×1000) · flaky 격리 수(`flaky`) · advisory 수(`advisory`) · 기능 커버리지(`coverage` %, spec F-xx 대비).
실패 시나리오는 `retries`(기본 1) 재시도 후 회복되면 flaky로 격리해 결함·게이트에서 제외한다(오탐 방지).

**휴리스틱 판정 계약 (신규)**: severity 분류는 [`UT_HEURISTIC_RUBRIC.md`](frontend/tests/ut/UT_HEURISTIC_RUBRIC.md) 계약을 따른다. `errorType` 이 규칙표에 등재된 findings 만 **결정론 규칙(provenance=rule)** 으로 게이트(S1~S4)에 반영하고, 규칙표에 없이 LLM 이 자유 라벨링한 findings 는 **advisory** 로 분리해 게이트에서 제외한다(리포트엔 표시). AI 의 "좋다/나쁘다" 자유 판단을 게이트 근거로 쓰지 않기 위한 장치다 — 개선안(REDESIGN)도 자유 생성 대신 카탈로그 기반 **가설**로 다루며 검증 전 배포하지 않는다.
리포트 부재·지표 미검출 시 **실패 처리**(UT 미실행을 통과로 오인 방지).

## Severity 분류 (Nielsen)

| 등급          | 기준         | 처리             |
| ----------- | ---------- | -------------- |
| S4 Critical | 작업 완료 불가   | 즉시 수정 (배포 블로커) |
| S3 Major    | 큰 불편·이탈 유발 | 다음 스프린트        |
| S2 Minor    | 우회 가능      | 백로그            |
| S1 Cosmetic | 소소한 개선     | 여유 시 처리        |

## 실측 캘리브레이션 루프 (신규)

AI 시뮬레이션(`ai-usability-test`)만으로는 실제 다수 사용자의 행동 분포를 대체할 수 없다는 한계를,
**측정 가능한 형태로 좁히는** 절차다. 실 사용자 세션이 있을 때만 동작하며, 세션을 만들어내지는 않는다.

```
1) 실 사용자 세션 진행 (모집·동의·진행 — 사람의 몫, 이 번들 범위 밖)
        │
        ▼
2) real-ut-intake 실행 — 녹화/노트 원본을 UT_OBSERVATION_SHEET.md 와 동일 스키마로 정규화
        │  refs/ux-research/real-ut-sessions/{scenario-id}/{session-id}.md 저장
        ▼
3) node frontend/tests/ut/ut-calibrate.mjs --scenario S-B01 \
     --real refs/ux-research/real-ut-sessions/S-B01 \
     --ai specs/{NNN}/ut/raw-observations.json \
     --out specs/{NNN}/ut/CALIBRATION_REPORT.md
        │
        ▼
4) CALIBRATION_REPORT.md 확인
   - gap이 임계치(완료율 ±10%p, 시간 ±5s) 이내 → calibrated: true
   - 벗어나면 → ut-personas.mjs 파라미터(thinkMin/thinkMax 등) 조정 제안 확인 후 사람이 반영
```

**주의**: 실 세션이 3건 미만(n<3)인 상태의 조정 제안은 참고용이며, 확정적 파라미터 변경 근거로 쓰지 않는다.
`real-ut-sessions/`가 누적될수록 `USER_RESEARCH.md`의 표본 한계 문구를 갱신한다.

## 클론 후 사용 (다른 작업자용 빠른 시작)

각자 로컬에서 클론한 뒤, 자신의 `d2a-boilerplate-claude` 에 오버레이를 한 번에 설치한다.

```
# 1) 이 번들 클론
git clone https://github.com/sooyachoco/D2A_UXUI_skill.git
cd D2A_UXUI_skill

# 2) 내 보일러플레이트에 설치 (template/ 로 복사, 기존 파일은 .bak 백업)
bash install.sh <d2a-boilerplate-claude 경로>          # macOS/Linux/Git Bash
#  또는
pwsh ./install.ps1 -Target <d2a-boilerplate-claude 경로>  # Windows PowerShell
```

설치기는 신규 파일을 복사하고 충돌 파일(create-spec·pre-launch-check·accessibility·task-validator)은 `.bak-<timestamp>` 로 백업한 뒤 덮어쓴다. **이어서 `ut:` 게이트 활성화를 위해 MCP 를 자동 재빌드**한다
(`task-validator.ts` 를 덮어썼으므로 필수 — npm 부재 시에만 수동 안내). 끝나면 콘솔이 남은 수동 단계를 안내한다:

1. `CLAUDE.md` 스킬 표에 신규 4종(`ux-research-sync`/`ai-usability-test`/`design-handoff`/`real-ut-intake`) 등록 + 개수 22개

> MCP 빌드는 보일러플레이트 초기 셋업의 빌드와 동일한 작업이다. 설치기가 덮어쓴 직후 자동 재실행해
> 구버전 `dist/` 가 남지 않도록 보장한다(`ut:` 게이트가 조용히 죽는 것을 방지).
> 파일별 병합 판정(상위호환/동일)·경로 매핑 상세는 [`INTEGRATION.md`](https://github.com/sooyachoco/D2A_UT_skill/blob/main/INTEGRATION.md) 참조.

## 통합

본체(`d2a-boilerplate-claude`)에 병합하는 검증된 절차는 [`INTEGRATION.md`](https://github.com/sooyachoco/D2A_UT_skill/blob/main/INTEGRATION.md) 참조 — 신규 파일 / 충돌 파일 diff 판정, CLAUDE.md 등록 스니펫, `dist/` 재빌드 절차를 담았다.

## 비고

- 본 묶음은 D2A 보일러플레이트 본체에서 **UT 검증 부분만** 발췌한 것으로, 단독 실행보다는 본체 구조(`.claude/`, `d2a-mcp-server/`, `refs/`) 안에 배치해 사용하는 것을 전제로 한다.
- 화면설계(상류) 스킬은 이 번들에서 제외됐다. 설계 단계가 필요하면 별도 설계 번들을 함께 얹거나, `refs/ux-research/` SSOT + 외부 설계 산출물(`scenario.md`·`reference-board.md`)을 입력으로 제공한다.
- `refs/ux-research/` 10종(+ 신규 세션 로그 체계)은 **빈 템플릿**으로 배포된다. 특정 서비스의 실데이터는 포함하지 않으며, `ux-research-sync` 스킬이 프로젝트 시작 시 실제 리서치 데이터로 채운다.
- `real-ut-intake`·`ut-calibrate.mjs` 는 **실 사용자 세션을 만들어내지 않는다.** 참가자 모집·동의서·스크리닝·세션 진행은 리서치 패널·외부 툴(Maze/UserTesting/Dovetail 등)·사내 리서치팀의 몫이며, 이 번들은 그 결과물을 AI 시뮬레이션과 비교 가능한 형태로 표준화하는 것까지만 담당한다.

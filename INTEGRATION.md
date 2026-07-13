# 보일러플레이트 통합 가이드

이 번들을 [`d2a-boilerplate-claude`](https://gitlab.nexon.com/frontdev/inhouse/replatform-playground/d2a-boilerplate-claude) 의 `template/` 구조에 병합하는 절차다.
아래 분류는 실제 `diff` 로 검증한 결과이며, **충돌 파일이 모두 기존 로직을 깨지 않는 상위호환(superset)** 임을 확인했다.

> 이 번들은 **사용성 테스트(UT) 전용 오버레이**다. 화면설계(상류) 스킬은 포함하지 않는다.
> 파이프라인 상류가 필요하면 별도 설계 번들을 함께 얹는다.

## 0. 왜 이 번들이 필요한가

디자인 시스템(NX Basic 등)을 도입해도 **강제 장치가 없으면** 아래 5개 문제가 반복된다. 이 번들(UT 게이트 + 토큰 게이트)은 그중 **정적/동적으로 결정론 검출이 가능한 항목만 배포 게이트로 강제**하고, 나머지는 디자인 시스템 자체 운영과 팀 프로세스가 담당한다 — "전부 자동화"가 아니라 "검출 가능한 것부터 확실히 막는다"가 원칙이다.

| # | 문제 | 대표 증상 | 이 번들의 대응 |
|---|---|---|---|
| ① | UI/UX 일관성 붕괴 | 화면마다 버튼·색상·폰트·여백이 다름 · 동일 기능에 다른 인터랙션 · 브랜드 아이덴티티 약화 | **`token-conformance`(정적)** — 색상·타이포 하드코딩 검출·차단 |
| ② | 디자인 부채 누적 | 즉흥적 컴포넌트 생성 반복 · 중복 스타일·예외 케이스 증가 · 리팩토링 비용 상승 | **`token-conformance`(정적)** — baseline 이후 신규 하드코딩(새 부채) 원천 차단, 기존 부채는 별도 상환 트랙 |
| ③ | 개발 생산성 저하 | 공통 UI 프로젝트마다 재구현 · 디자이너-개발자 확인/수정 반복 · 표준 부재로 코드 구조 제각각 | 간접 — 토큰 참조 강제로 공통 UI 재사용 유도(컴포넌트 라이브러리 자체는 번들 범위 밖) |
| ④ | 유지보수 난이도 증가 | 전역 수정 시 영향 범위 예측 어려움 · 작은 변경에도 다수 화면 수정 필요 · 기술 부채 가속화 | **`ai-usability-test`(동적)** — 시각적 회귀·런타임/네트워크 오류를 회귀 시점에 자동 검출 · 토큰 커버리지↑가 영향 범위를 예측 가능하게 함 |
| ⑤ | SDD(Spec Driven Development) 전환 불가 | UI 명세가 구조화되어 있지 않음 · 자동 코드 생성 기준 부재 · 규칙 기반 개발 체계 구축 어려움 | **`create-spec` 연동** — `ut:`/`token:` machine-readable 지표가 `tasks.md` 의 `done` 기준으로 편입되어 Phase 완료가 규칙(임계값)으로 판정됨 |

> ①·②는 **정적 분석**(`token-conformance`), ④의 일부는 **동적 관측**(`ai-usability-test`)으로 결정론 검출한다. ③·⑤는 이 번들만으로 완결되지 않으며, 디자인 시스템 문서화(`design:design-system`)·컴포넌트 라이브러리 운영·팀 컨벤션이 함께 필요하다.
> 상세 매핑: `frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md` §0, `.claude/skills/token-conformance.md` "왜 필요한가".

## 1. 신규 추가 (8건) — 충돌 없음, 그대로 복사

| 번들 경로 | → 보일러플레이트 경로 |
|---|---|
| `.claude/skills/ai-usability-test.md` | `template/.claude/skills/ai-usability-test.md` |
| `.claude/skills/ux-research-sync.md` | `template/.claude/skills/ux-research-sync.md` |
| `.claude/skills/design-handoff.md` | `template/.claude/skills/design-handoff.md` |
| `.claude/skills/real-ut-intake.md` ⭐신규 | `template/.claude/skills/real-ut-intake.md` |
| `.claude/skills/token-conformance.md` ⭐신규 | `template/.claude/skills/token-conformance.md` |
| `refs/ux-research/` (11파일 + `real-ut-sessions/` 디렉토리: 기존 10 + `REAL_UT_SESSION_LOG_TEMPLATE.md`) | `template/refs/ux-research/` |
| `frontend/tests/ut/` (러너 10 + 계약문서 1 = 11파일: run-ut·ut-personas·ut-heuristics·ut-a11y·ut-visual-diff·ut-perf·ut-aggregate·ut-calibrate·ut.config.example·README·UT_HEURISTIC_RUBRIC) | `template/frontend/tests/ut/` |
| `frontend/tests/tokens/` ⭐신규 (4파일: token-conformance·config.example·README·TOKEN_CONFORMANCE_RUBRIC) | `template/frontend/tests/tokens/` |

## 2. 기존 파일 덮어쓰기 (4건) — diff 검증 결과

| 파일 | 판정 | 변경 내용 | 처리 |
|---|---|---|---|
| `d2a-mcp-server/src/tools/task-validator.ts` | 🟢 순수 superset (삭제 0줄) | `ut:` 분기 + `checkUtReport()` / `token:` 분기 + `checkTokenReport()` 추가 (규칙 평가는 공유 `evaluateMetricRules()` 로 추출 — `ut:` 동작 불변) | 그대로 덮어쓰기 안전 |
| `.claude/skills/create-spec.md` | 🟢 superset | Step 0.5(STEP 0 점검 게이트) / Step 2.7.5(AI UT 자동 게이트) / Step 2.7.6(token-conformance 자동 배선, DESIGN_SYSTEM=nxbasic 전용) / 상태 매트릭스 게이트 삽입 | 그대로 덮어쓰기 안전 |
| `.claude/skills/pre-launch-check.md` | 🟢 superset (삭제 0줄) | UT_FINDINGS 연계 검증 + 디자인 토큰 준수(조건부) 체크리스트 항목 삽입 | 그대로 덮어쓰기 안전 |
| `.claude/subagent-templates/accessibility.md` | ⚪ 완전 동일 | 없음 | 복사 불필요(스킵 가능) |

> 검증 방법: `diff <보일러플레이트> <번들>` 에서 삭제(`<`) 라인이 0건임을 확인 — 기존 내용은 전부 보존되고 추가만 발생한다.

## 3. 정합성 보강 (병합 후 필수)

### 3-1. `template/CLAUDE.md` 스킬 표에 신규 5종 등록

미등록 시 CLAUDE.md 의 스킬 호출 규약("표에 없는 이름은 추정 금지")에 걸려 자동 호출되지 않는다.

```markdown
| `/ux-research-sync`   | 외부 리서치 데이터를 refs/ux-research SSOT에 적재 (3단계 신뢰도) |
| `/ai-usability-test`  | Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md |
| `/real-ut-intake`     | 실 사용자 UT 세션 원본을 AI 관측 스키마로 정규화 → refs/ux-research/real-ut-sessions/ |
| `/design-handoff`     | UT 통과(S4=0) 후 개발 핸드오프 스펙 생성 (design:design-handoff 플러그인 호출) → HANDOFF.md |
| `/token-conformance`  | 디자인 토큰(색상·타이포) 준수 정적 분석 게이트 → TOKEN_CONFORMANCE_REPORT.md (신규 위반만 차단, baseline 면제) |
```

스킬 개수 표기도 갱신한다 (`CLAUDE.md`, `README.md`): `18개 → 23개`.

> `create-spec`·`pre-launch-check` 은 **기존 엔진 스킬을 상위호환으로 덮어쓴 것**이라 신규 등록 대상이 아니다(이미 표에 있음).
> UT 파이프라인: `create-spec(코딩) → ai-usability-test → (실 UT 있으면 real-ut-intake → ut-calibrate) → design-handoff → run-phase(ut:/token: 게이트)`.
> `token:` 은 Step 2.7.6에서 DESIGN_SYSTEM=nxbasic 프로젝트에 한해 **자동 배선**된다(수동으로 tasks.md에 추가할 필요 없음) — §3-3 참조.
> 페르소나·여정이 필요하면 `ux-research-sync` 로 `refs/ux-research/` SSOT 를 먼저 채운다(가설 페르소나만 있을 때).
> 실 사용자 세션이 있으면 `real-ut-intake` 로 정규화 후 `node frontend/tests/ut/ut-calibrate.mjs` 로 AI-실측 gap을 확인한다(파라미터 자동 반영 없음 — 사람 검토 필수).

### 3-2. MCP `dist/` 재빌드 (필수)

MCP 서버는 `dist/` 빌드 산출물을 실행하므로, `task-validator.ts` 병합 후 반드시 재빌드해야 `ut:` 게이트가 활성화된다.
**이 재빌드는 `ut:` 게이트 때문에 이미 필수 스텝이었다** — `token:` 을 같은 파일(`task-validator.ts`)에 얹는 것은 새 오버레이 부담이 아니라 기존 재빌드에 무임승차하는 것이다. 아래 §3-3 은 이 전제 위에서 `token:` 을 기본 경로로 안내한다.

```bash
cd template/d2a-mcp-server && npm install && npm run build
# 확인 (ut: · token: 게이트 둘 다 활성인지):
grep -rl "checkUtReport" dist/      # dist/tools/task-validator.js 가 나오면 ut: 활성
grep -rl "checkTokenReport" dist/   # 같은 파일이 나오면 token: 활성
```

### 3-3. token-conformance 게이트 (신규)

`ut:` 와 형제 게이트다. **런타임 관측(ai-usability-test)** 과 달리 **소스 정적 분석**으로 디자인 토큰 준수를 강제한다.
계약: `frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md`.

**기본 경로 — 자동 배선(Step 2.7.6).** DESIGN_SYSTEM=nxbasic 인 프로젝트는 `create-spec` Step 2.7 사용자
승인(A) 직후 create-spec 이 알아서:
1. `token-conformance.config.mjs` 부트스트랩 (roots를 `frontend/src`로 좁혀 생성)
2. `--update-baseline` 최초 1회 실행 (Step 2.7 승인 시점 Mock UI 코드 기준으로 기존 부채 동결)
3. Step 6에서 생성되는 모든 Phase의 `T{N}-review` 태스크 `done` 에 `token:` 두 줄을 자동 삽입

**즉, `tasks.md` 에 수동으로 `token:` 을 적을 필요가 없다** — 정상 파이프라인(create-spec 을 거쳐 만든 프로젝트)에서는 병합 담당자가 할 일이 없다. 상세: `.claude/skills/create-spec.md` Step 2.7.6 · Step 6 "T{N}-review 태스크 자동 삽입".

**수동 배선이 필요한 예외 케이스만 아래를 따른다** — ①create-spec 이전에 이미 Step 2.7을 통과한 레거시 프로젝트에 소급 적용, ②DESIGN_SYSTEM이 커스텀인데도 팀이 자체 토큰 세트에 이 게이트를 걸고 싶은 경우, ③create-spec 파이프라인 자체를 쓰지 않는 프로젝트:

```bash
# 0) 설정 복사·편집 (roots/reportDir/tokenSources)
cp frontend/tests/tokens/token-conformance.config.example.mjs frontend/tests/tokens/token-conformance.config.mjs
# 1) 기존 부채 동결 — 참조 컴포넌트(Button.css 등)의 기존 #fff·#1f8a30 이탈을 baseline 으로 면제(1회, 커밋)
node frontend/tests/tokens/token-conformance.mjs --update-baseline
# 2) 이후부터 신규 위반만 게이트에 걸림
node frontend/tests/tokens/token-conformance.mjs
```

`tasks.md` done 기준 — 권장: `token:` (선언적, §3-2 재빌드 전제):

```yaml
done:
  - token: specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
```

`ut:` 와 동일한 파싱·평가 엔진(`evaluateMetricRules()`)을 공유해 `done` 기준 문법이 일관된다.

대안 — `cmd:` self-contained (MCP 하네스 자체를 안 쓰는 프로젝트 전용, §3-2 재빌드를 아예 거치지 않는 경우):

```yaml
done:
  - cmd: node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0
```

**지표**: `token_coverage`(토큰 참조 비율%) · `token_violations`(신규 하드코딩 건수, baseline 초과분) — 나머지는 `token-conformance.md`·규칙표 §5 참조.
`baseline` 미생성 시 모든 하드코딩이 신규 위반으로 잡히므로, 자동/수동 어느 경로든 `--update-baseline` 이 먼저 실행돼야 한다.

## 4. 병합 검증 체크리스트

- [ ] 신규 8건 복사 완료 (real-ut-intake·REAL_UT_SESSION_LOG_TEMPLATE·real-ut-sessions/·ut-calibrate·token-conformance skill·frontend/tests/tokens/ 포함)
- [ ] 충돌 4건 중 3건 덮어쓰기 (accessibility.md 는 동일 → 스킵)
- [ ] `CLAUDE.md` 스킬 표 5종 등록 + 개수 23개
- [ ] `dist/` 재빌드 → `checkUtReport` + `checkTokenReport` 반영 확인
- [ ] `tasks.md` 의 `done` 에 `ut: {리포트} :: S4=0,S3<=2` 사용 가능
- [ ] `token-conformance`: DESIGN_SYSTEM=nxbasic 프로젝트는 create-spec Step 2.7.6이 자동 배선(설정·baseline·tasks.md `token:` 삽입까지 자동) — 병합 담당자는 별도 조치 불필요. 예외 케이스(레거시 소급/커스텀 디자인 시스템/create-spec 미사용)만 수동으로 `token-conformance.config.mjs` 편집 → `--update-baseline` 1회 → `token: … :: token_coverage>=N,token_violations<=N` done 등록
- [ ] (선택) 실 UT 세션 확보 시 `real-ut-intake` → `ut-calibrate.mjs` 캘리브레이션 루프 동작 확인

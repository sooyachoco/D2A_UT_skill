# 보일러플레이트 통합 가이드

이 번들을 [`d2a-boilerplate-claude`](https://gitlab.nexon.com/frontdev/inhouse/replatform-playground/d2a-boilerplate-claude) 의 `template/` 구조에 병합하는 절차다.
아래 분류는 실제 `diff` 로 검증한 결과이며, **충돌 파일이 모두 기존 로직을 깨지 않는 상위호환(superset)** 임을 확인했다.

> 이 번들은 **사용성 테스트(UT) 전용 오버레이**다. 화면설계(상류) 스킬은 포함하지 않는다.
> 파이프라인 상류가 필요하면 별도 설계 번들을 함께 얹는다.

## 1. 신규 추가 (6건) — 충돌 없음, 그대로 복사

| 번들 경로 | → 보일러플레이트 경로 |
|---|---|
| `.claude/skills/ai-usability-test.md` | `template/.claude/skills/ai-usability-test.md` |
| `.claude/skills/ux-research-sync.md` | `template/.claude/skills/ux-research-sync.md` |
| `.claude/skills/design-handoff.md` | `template/.claude/skills/design-handoff.md` |
| `.claude/skills/real-ut-intake.md` ⭐신규 | `template/.claude/skills/real-ut-intake.md` |
| `refs/ux-research/` (11파일 + `real-ut-sessions/` 디렉토리: 기존 10 + `REAL_UT_SESSION_LOG_TEMPLATE.md`) | `template/refs/ux-research/` |
| `frontend/tests/ut/` (러너 10 + 계약문서 1 = 11파일: run-ut·ut-personas·ut-heuristics·ut-a11y·ut-visual-diff·ut-perf·ut-aggregate·ut-calibrate·ut.config.example·README·UT_HEURISTIC_RUBRIC) | `template/frontend/tests/ut/` |

## 2. 기존 파일 덮어쓰기 (4건) — diff 검증 결과

| 파일 | 판정 | 변경 내용 | 처리 |
|---|---|---|---|
| `d2a-mcp-server/src/tools/task-validator.ts` | 🟢 순수 superset (삭제 0줄) | `ut:` 분기 + `checkUtReport()` 함수 추가 | 그대로 덮어쓰기 안전 |
| `.claude/skills/create-spec.md` | 🟢 superset | Step 0.5(STEP 0 점검 게이트) / Step 2.7.5(AI UT 자동 게이트) / 상태 매트릭스 게이트 삽입 | 그대로 덮어쓰기 안전 |
| `.claude/skills/pre-launch-check.md` | 🟢 superset (삭제 0줄) | UT_FINDINGS 연계 검증 11줄 삽입 | 그대로 덮어쓰기 안전 |
| `.claude/subagent-templates/accessibility.md` | ⚪ 완전 동일 | 없음 | 복사 불필요(스킵 가능) |

> 검증 방법: `diff <보일러플레이트> <번들>` 에서 삭제(`<`) 라인이 0건임을 확인 — 기존 내용은 전부 보존되고 추가만 발생한다.

## 3. 정합성 보강 (병합 후 필수)

### 3-1. `template/CLAUDE.md` 스킬 표에 신규 4종 등록

미등록 시 CLAUDE.md 의 스킬 호출 규약("표에 없는 이름은 추정 금지")에 걸려 자동 호출되지 않는다.

```markdown
| `/ux-research-sync`  | 외부 리서치 데이터를 refs/ux-research SSOT에 적재 (3단계 신뢰도) |
| `/ai-usability-test` | Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md |
| `/real-ut-intake`    | 실 사용자 UT 세션 원본을 AI 관측 스키마로 정규화 → refs/ux-research/real-ut-sessions/ |
| `/design-handoff`    | UT 통과(S4=0) 후 개발 핸드오프 스펙 생성 (design:design-handoff 플러그인 호출) → HANDOFF.md |
```

스킬 개수 표기도 갱신한다 (`CLAUDE.md`, `README.md`): `18개 → 22개`.

> `create-spec`·`pre-launch-check` 은 **기존 엔진 스킬을 상위호환으로 덮어쓴 것**이라 신규 등록 대상이 아니다(이미 표에 있음).
> UT 파이프라인: `create-spec(코딩) → ai-usability-test → (실 UT 있으면 real-ut-intake → ut-calibrate) → design-handoff → run-phase(ut: 게이트)`.
> 페르소나·여정이 필요하면 `ux-research-sync` 로 `refs/ux-research/` SSOT 를 먼저 채운다(가설 페르소나만 있을 때).
> 실 사용자 세션이 있으면 `real-ut-intake` 로 정규화 후 `node frontend/tests/ut/ut-calibrate.mjs` 로 AI-실측 gap을 확인한다(파라미터 자동 반영 없음 — 사람 검토 필수).

### 3-2. MCP `dist/` 재빌드 (필수)

MCP 서버는 `dist/` 빌드 산출물을 실행하므로, `task-validator.ts` 병합 후 반드시 재빌드해야 `ut:` 게이트가 활성화된다.

```bash
cd template/d2a-mcp-server && npm install && npm run build
# 확인:
grep -rl "checkUtReport" dist/   # dist/tools/task-validator.js 가 나오면 활성
```

## 4. 병합 검증 체크리스트

- [ ] 신규 6건 복사 완료 (real-ut-intake·REAL_UT_SESSION_LOG_TEMPLATE·real-ut-sessions/·ut-calibrate 포함)
- [ ] 충돌 4건 중 3건 덮어쓰기 (accessibility.md 는 동일 → 스킵)
- [ ] `CLAUDE.md` 스킬 표 4종 등록 + 개수 22개
- [ ] `dist/` 재빌드 → `checkUtReport` 반영 확인
- [ ] `tasks.md` 의 `done` 에 `ut: {리포트} :: S4=0,S3<=2` 사용 가능
- [ ] (선택) 실 UT 세션 확보 시 `real-ut-intake` → `ut-calibrate.mjs` 캘리브레이션 루프 동작 확인

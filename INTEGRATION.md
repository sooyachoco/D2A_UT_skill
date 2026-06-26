# 보일러플레이트 통합 가이드

이 번들을 [`d2a-boilerplate-claude`](https://gitlab.nexon.com/frontdev/inhouse/replatform-playground/d2a-boilerplate-claude) 의 `template/` 구조에 병합하는 절차다.
아래 분류는 실제 `diff` 로 검증한 결과이며, **충돌 파일 4종이 모두 기존 로직을 깨지 않는 상위호환(superset)** 임을 확인했다.

## 1. 신규 추가 (6건) — 충돌 없음, 그대로 복사

| 번들 경로 | → 보일러플레이트 경로 |
|---|---|
| `.claude/skills/ux-audit.md` | `template/.claude/skills/ux-audit.md` |
| `.claude/skills/ai-usability-test.md` | `template/.claude/skills/ai-usability-test.md` |
| `.claude/skills/ux-research-sync.md` | `template/.claude/skills/ux-research-sync.md` |
| `.claude/skills/ui-design-workflow.md` | `template/.claude/skills/ui-design-workflow.md` |
| `refs/ux-research/` (9파일) | `template/refs/ux-research/` |
| `frontend/tests/ut/run-ut.mjs` | `template/frontend/tests/ut/run-ut.mjs` |

## 2. 기존 파일 덮어쓰기 (4건) — diff 검증 결과

| 파일 | 판정 | 변경 내용 | 처리 |
|---|---|---|---|
| `d2a-mcp-server/src/tools/task-validator.ts` | 🟢 순수 superset (삭제 0줄) | `ut:` 분기 + `checkUtReport()` 함수 추가 | 그대로 덮어쓰기 안전 |
| `.claude/skills/create-spec.md` | 🟢 superset | Step 0.5 / Step 2.7.5 / 상태 매트릭스 게이트 삽입 (NX Basic 문구 1곳 개선, 로직 무관) | 그대로 덮어쓰기 안전 |
| `.claude/skills/pre-launch-check.md` | 🟢 superset (삭제 0줄) | UT_FINDINGS 연계 검증 11줄 삽입 | 그대로 덮어쓰기 안전 |
| `.claude/subagent-templates/accessibility.md` | ⚪ 완전 동일 | 없음 | 복사 불필요(스킵 가능) |

> 검증 방법: `diff <보일러플레이트> <번들>` 에서 삭제(`<`) 라인이 0건임을 확인 — 기존 내용은 전부 보존되고 추가만 발생한다.

## 3. 정합성 보강 (병합 후 필수)

### 3-1. `template/CLAUDE.md` 스킬 표에 신규 4종 등록

미등록 시 CLAUDE.md 의 스킬 호출 규약("표에 없는 이름은 추정 금지")에 걸려 자동 호출되지 않는다.

```markdown
| `/ux-audit` | 구현 전 UX 진단 (7가지 휴리스틱 렌즈 — advisory) |
| `/ux-research-sync` | 외부 리서치 데이터를 refs/ux-research SSOT에 적재 (3단계 신뢰도) |
| `/ui-design-workflow` | PRD→게이트0→3안 발산→락→상태설계→무드리프트 핸드오프 |
| `/ai-usability-test` | Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md |
```

스킬 개수 표기도 갱신한다 (`CLAUDE.md`, `README.md`): `18개 → 22개`.

### 3-2. MCP `dist/` 재빌드 (필수)

MCP 서버는 `dist/` 빌드 산출물을 실행하므로, `task-validator.ts` 병합 후 반드시 재빌드해야 `ut:` 게이트가 활성화된다.

```bash
cd template/d2a-mcp-server && npm install && npm run build
# 확인:
grep -rl "checkUtReport" dist/   # dist/tools/task-validator.js 가 나오면 활성
```

## 4. 병합 검증 체크리스트

- [ ] 신규 6건 복사 완료
- [ ] 충돌 4건 중 3건 덮어쓰기 (accessibility.md 는 동일 → 스킵)
- [ ] `CLAUDE.md` 스킬 표 4종 등록 + 개수 22개
- [ ] `dist/` 재빌드 → `checkUtReport` 반영 확인
- [ ] `tasks.md` 의 `done` 에 `ut: {리포트} :: S4=0,S3<=2` 사용 가능

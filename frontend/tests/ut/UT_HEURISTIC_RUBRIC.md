# UT 휴리스틱 규칙표 (Heuristic Rubric) — 판정 계약

> **목적**: AI 사용성 테스트의 결함 분류를 "LLM 자유 판단"에서 **"관찰 신호 → 휴리스틱 → severity → 신뢰도"의 명시적 계약**으로 전환한다.
> 이 문서는 `run-ut.mjs`/시나리오 코드가 방출하는 `errorType` 어휘와, `ut-aggregate.mjs`가 그것을 분류·게이팅하는 규칙의 **단일 계약(source of truth)**이다.
>
> **근거**: 생성형 AI는 "좋다/나쁘다" 판단과 개선안 생성에는 약하지만(정확도 편차 큼), **명시적 기준에 대한 분류·패턴 매칭에는 강하다.**
> 따라서 게이트(배포 차단)는 **결정론적으로 검출된 신호에만** 걸고, LLM이 자유롭게 라벨링한 findings 는 **advisory(참고, 게이트 제외)** 로 분리한다.

---

## 1. 핵심 원칙

1. **게이트는 결정론적 검출에만** — `errorType`이 아래 규칙표에 등재된 findings 만 severity 카운트(S1~S4)에 반영되어 게이트에 걸린다.
2. **LLM 판단은 advisory** — `errorType` 없이 `severityHint`/`heuristic`만 붙은(=사후 LLM 라벨) findings, 또는 규칙표에 없는 `errorType`은 **advisory 섹션**으로 분리되고 게이트에서 제외된다. (사라지지 않고 반드시 리포트에 표시된다.)
3. **약한 기본값 금지** — 미분류를 "N1/S3"로 조용히 승격하지 않는다. 미분류 = `N-unclassified` + `confidence: low` + advisory.
4. **주관 휴리스틱은 결정론 검출 불가** — N2(실세계 대응)·N6(기억보다 인식)·N8(미적 절제)·N10(도움말)은 본질적으로 판단 영역이라 규칙(rule)이 없다. 이들에 해당하는 관찰은 자연히 advisory로 들어온다. 게이트로 강제하지 않는다.
5. **개선안은 가설** — `REDESIGN_PROPOSAL.md`의 AI 개선안은 검증 전 배포 금지. A/B 또는 실측 UT(`ut-calibrate`)로 검증할 **가설**이며, 자유 생성이 아니라 §4 패턴 카탈로그에서 선택·적용한다.

---

## 2. errorType 어휘 → 휴리스틱·severity (게이트 대상)

`ut-aggregate.mjs`의 `ERROR_DEFAULTS`와 1:1로 일치한다. 시나리오 `run()` 코드는 아래 어휘만 방출한다.

| errorType | 휴리스틱 | severity | 검출 방법 (결정론) | 검출기 |
|---|---|---|---|---|
| `auth-redirect` | N9 오류 복구 | S4 | storageState 만료 → 로그인 리다이렉트 (러너 자동) | run-ut |
| `primary-not-tab-reachable` | N7 효율 | S4 | 핵심 CTA가 Tab 순회로 도달 불가 | `checkKeyboardReachable` |
| `navigation-dead-end` / `dead-end` | N1 상태 가시성 | S3 | 진입 후 다음 경로 없음(막다른 길) | 시나리오 |
| `nav-confusion` | N1 상태 가시성 | S3 | 경로 혼동(반복 왕복) | 시나리오 |
| `reaction-no-feedback` / `no-loading-indicator` | N1 상태 가시성 | S3 | 액션 후 로딩/피드백 표시 없음 | `checkLoadingFeedback` |
| `destructive-no-confirm` | N5 오류 예방 | S3 | 파괴적 액션에 확인 절차 없음 | `checkDestructiveConfirm` |
| `form-error` / `form-error-no-recovery` | N9 오류 복구 | S3 | 잘못된 입력 제출 시 인라인 복구 안내 없음 | `checkFormErrorRecovery` |
| `minimize-no-restore` | N3 통제·자유 | S3 | 최소화/닫기 후 복원 수단 없음 | 시나리오 |
| `cta-below-fold` | N7 효율 | S3 | 핵심 CTA가 스크롤 없이 fold 밖 | `checkAboveFoldCTA` |
| `no-undo-affordance` | N3 통제·자유 | S2 | 되돌리기(undo) 수단 부재 | 시나리오 |
| `inconsistent-control` | N4 일관성 | S2 | 같은 기능의 라벨/패턴 불일치 | 시나리오 |
| `wrong-click` | N6 기억보다 인식 | S2 | 오클릭 후 정정(관찰된 행동) | 시나리오 |
| `exception` | N1 상태 가시성 | S3 | 시나리오 실행 중 잡히지 않은 예외 (러너 자동) | run-ut |

> severity 는 **규칙표가 권위(authoritative)** 다 — 시나리오가 임의로 바꾸지 않는다. 새 상황이 필요하면 이 표에 어휘를 추가한다(코드 변경 + 리뷰).

### 비-Nielsen 결정론 카테고리 (별도 파이프라인, 게이트 대상)

관측 신호가 아니라 도구가 직접 측정하는 객관 지표 — `ut-aggregate.mjs`가 직접 승격한다.

| 카테고리 | 소스 | severity 규칙 |
|---|---|---|
| `N-a11y` 접근성(WCAG) | axe-core (`ut-a11y.mjs`) | axe impact → S1~S4 |
| `N-visual` 시각 회귀 | 스크린샷 diff (`ut-visual-diff.mjs`) | diff≥15% → S3, else S2 |
| `N-runtime` 런타임 오류 | 콘솔 error·예외 | pageerror → S3, console → S2 |
| `N-network` 네트워크 | 4xx/5xx·요청 실패 | 5xx·실패 → S3, 4xx → S2 |
| `N-perf` 성능 | LCP/CLS (`ut-perf.mjs`) | 예산 초과 → classifyPerf |

---

## 3. 신뢰도·provenance 규칙 (`classify()` 계약)

| provenance | 조건 | confidence | 게이트 | 렌더링 위치 |
|---|---|---|---|---|
| `rule` | `errorType`이 §2 규칙표에 등재 | high | ✅ 카운트 | 결함 목록 |
| `ai-hint` | `errorType` 없거나 미등재 + `severityHint`/`heuristic`만 있음 | low | ❌ 제외 | advisory 섹션 |
| `unclassified` | 아무 근거 없음 | low | ❌ 제외 | advisory 섹션 |

- 게이트 지표(`ut-metrics` 주석)의 `S1~S4`는 **provenance=rule + 비-Nielsen 결정론 카테고리**만 반영한다.
- advisory findings 수는 별도 지표 `advisory=N`으로 보고한다(은폐 금지).
- `advisory`는 게이트에 걸 수 없다(정보용). 리뷰어가 사람 판단으로 처리한다.

---

## 4. 개선안 패턴 카탈로그 (REDESIGN — 자유 생성 대신 선택)

각 휴리스틱 위반에 대해 **검증된 수정 패턴**에서 선택·적응한다. 새 패턴을 발명하지 않는다.

| 위반 휴리스틱 | 권장 수정 패턴 (카탈로그) |
|---|---|
| N1 상태 가시성 | 즉시 로딩 인디케이터 / 진행 표시 / 낙관적 UI 피드백 |
| N3 통제·자유 | 명시적 취소·뒤로·undo 어포던스 추가 |
| N4 일관성 | 동일 액션에 동일 라벨·컴포넌트 통일 |
| N5 오류 예방 | 파괴적 액션 전 확인 다이얼로그 / undo 유예 |
| N7 효율 | 키보드 도달성 확보 / 핵심 CTA fold 내 배치 |
| N9 오류 복구 | 필드 인라인 에러 + 원인·해결책 안내 문구 |

> 모든 개선안은 **가설**로 표기하고, 배포 전 A/B 또는 실측 UT(`ut-calibrate`)로 검증한다.
> AI가 생성한 개선안은 상당수가 전환율에 중립·부정적일 수 있으므로, 자동 반영·무검증 배포를 금지한다.

---

## 5. 게이트 지표 (참고)

```
<!-- ut-metrics: S4=0 S3=1 S2=2 S1=0 complete=92 wcag=0 visual=0 console=0 net=0 lcp=2100 cls=40 flaky=0 advisory=3 coverage=100 -->
```

- `S1~S4` — 결정론 findings 만 (provenance=rule + 비-Nielsen 카테고리)
- `advisory` — LLM 판단·미분류 findings 수 (게이트 제외, 사람 검토)
- 나머지 지표 정의는 `ai-usability-test.md` Step 6.5 참조.

---

## 변경 이력

- 2026-07-10 v1 — 규칙표 신설. `classify()`를 provenance/confidence 기반으로 개편, advisory 분리, 약한 N1/S3 기본값 제거, 결정론 검출기(`ut-heuristics.mjs`) 도입, 개선안 카탈로그화.

---
name: design-handoff
interactive: true
version: 1.0.0
description: 파이프라인 종착 단계. UI 구현 + ai-usability-test(UT 게이트) 통과 후, 사람 개발자·타 팀에 넘길 개발 핸드오프 스펙을 생성한다. design:design-handoff 플러그인을 엔진으로 호출(없으면 내장 템플릿 폴백)하고, D2A 산출물(spec·UT 리포트·frontend 구현, 있으면 design-direction 등)을 한데 묶어 specs/{NNN}/design/HANDOFF.md로 굳힌다. "핸드오프", "개발 핸드오프", "핸드오프 스펙", "개발자에게 넘길 스펙", "dev handoff" 요청 시 사용. ai-usability-test 다음, 배포·전달 직전에 들어간다.
status: draft
last_updated: 2026-06-30
triggers:
  - /design-handoff
  - 핸드오프
  - 개발 핸드오프
  - 핸드오프 스펙
  - dev handoff
---

# 개발 핸드오프 워크플로 (Design Handoff)

> **이 문서의 출발점 (왜 필요한가):**
> 이 파이프라인은 `ai-usability-test`(UT 게이트)에서 끝났다. AI가 그대로 구현·배포하는 경우엔 충분하지만,
> **사람 개발자·외주·타 팀에 넘길 때 "확정·검증된 설계를 한 장으로 정리한 스펙"이 없었다.**
> design 플러그인의 `design:design-handoff`가 그 전문 렌즈를 제공하므로, 이 단계는 그걸 **엔진으로 호출**해
> D2A 산출물과 묶는 오케스트레이터다. (복사·포크가 아니라 호출 + 폴백)

---

## 0. 제1원칙 — 새 결정 금지, "확정·검증된 것"만 정리

핸드오프는 설계 단계가 **아니다**. 앞 단계에서 **이미 사용자가 확정하고 UT로 검증된 것**만 모아 옮긴다.
여기서 새 토큰·새 레이아웃·새 흐름을 만들면 위반이다 — 그건 설계 단계로 되돌아가 다시 확정한다.

---

## 1. 위치 · 진입 조건

- **위치**: `ai-usability-test`(UT 게이트) **다음**, 배포·전달 직전. 파이프라인 **종착**.
- **진입 조건**: UT `S4=0`(치명 결함 0). 미검증 화면은 핸드오프 금지 — 먼저 `ai-usability-test` 로 검증한다.
- **생략 가능**: 같은 에이전트가 그대로 구현·배포하면 스킵한다(넘길 대상이 없음). 사람 핸드오프가 있을 때만 실행.

```
UI 구현 → ai-usability-test(S4=0) → [이 스킬] design-handoff → HANDOFF.md → 개발 전달
```

---

## 2. 엔진 — `design:design-handoff` 플러그인 호출 (없으면 폴백)

1. **`Skill("design:design-handoff")` 호출을 먼저 시도**한다 — 레이아웃·토큰·컴포넌트 props·상태·반응형·엣지케이스·애니메이션의 전문 핸드오프 렌즈.
2. **플러그인 부재/실패 시** → §4 내장 템플릿으로 직접 작성(폴백). 산출물 계약은 동일하게 `HANDOFF.md`.
3. 이 스킬은 **오케스트레이터**다 — 플러그인이 엔진, 아래 D2A 산출물이 입력, `HANDOFF.md`가 출력.

> 선택적 심화(겹치면 생략): 핸드오프 직전 `design:accessibility-review`(WCAG 정밀)·`design:design-system`(토큰/네이밍 감사)을 한 번 돌려 결과를 HANDOFF의 "접근성 주석"·"토큰" 섹션에 반영할 수 있다. 단 `ai-usability-test` P3(접근성 페르소나)와 중복되면 새로 돌리지 않는다.

---

## 3. 입력 — 앞 단계 산출물만 (새로 만들지 않음)

| 입력 | 가져올 것 |
|---|---|
| `spec.md` | 기능 범위·수용 기준 |
| `specs/{NNN}/ut/UT_FINDINGS_REPORT.md` | UT 통과(S4=0) 확인 + 잔여 S2/S1 → 백로그로 명시 |
| `refs/ux-research/` (PERSONA·USER_SCENARIOS 등) | 페르소나 과업·성공조건 (있으면) |
| `frontend/` 구현 | 실제 컴포넌트·라우트·상태 |
| `design/design-direction.md` (+ DS) | 토큰(색·타이포·여백·radius) — 있으면 |
| `specs/{NNN}/scenario.md` · `design/reference-board.md` | 흐름·기준 톤·키스톤 — **외부 설계 산출물(있으면)** |

> **DS 분기**: `DESIGN_SYSTEM=nxbasic`이면 컴포넌트 명세를 nxbasic-mcp 컴포넌트+props로 매핑한다(`get_component_docs`). 커스텀이면 `design-direction.md` 토큰을 그대로 적는다.

---

## 4. 산출물 — `specs/{NNN}/design/HANDOFF.md` (폴백 템플릿)

```markdown
# 개발 핸드오프 — {기능/화면}

> 출처: design-handoff 스킬 · {날짜} · UT 통과(S4=0) 확인
> 입력: spec.md · UT_FINDINGS_REPORT.md · frontend/ 구현 · (있으면) design-direction.md · scenario.md · reference-board.md

## 1. 개요 · 범위
- 대상 화면 / 라우트 / 수용 기준

## 2. 화면별 레이아웃
- 영역·그리드·폭(사이드/콘텐츠/패널) — design-direction 정의값

## 3. 디자인 토큰
| 용도 | 토큰 | 값 |
|---|---|---|
| 포인트 | color-pc-800 | #0a74ff |   ← DS면 실제 토큰명, 커스텀이면 design-direction 값

## 4. 컴포넌트 명세 (props · 상태)
- DS: `<Button size="m" variant="filled" semanticColor="primary">` 형식
- 상태: 빈/로딩/결과/선택/수정/완료/실패 (7상태 매트릭스)

## 5. 인터랙션 · 상태 전이
- 트리거 → 동작 → 결과 (UT 시나리오 성공조건 연동)

## 6. 반응형 브레이크포인트
- 데스크톱/태블릿/모바일 분기

## 7. 엣지케이스 · 빈/에러 상태
- 권한 없음 / 네트워크 실패 / 빈 데이터

## 8. 애니메이션 · 모션
- 전이·로딩·피드백 모션 토큰

## 9. 접근성 주석
- WCAG 대비 / 키보드 포커스 순서 / 터치 타겟 ≥ 44px / ARIA

## 10. 잔여 결함 (백로그)
- UT의 S2/S1 항목 — 다음 스프린트 후보

## 11. 에셋 · 아이콘 출처
```

---

## 5. 활동 로그 (CLAUDE.md 규칙 5)

```bash
# 스킬 실행은 Skill hook이 자동 기록(SKILL). 핸드오프는 새 결정이 없어 DECISION 불필요.
./scripts/log-activity.sh SETUP "design-handoff: HANDOFF.md 생성 ({기능})" "UT S4=0 통과 후 핸드오프" || true
```

---

## 6. 관련 문서
- `ai-usability-test` — 앞 단계(UT 게이트). `S4=0` 통과가 이 스킬의 진입 조건.
- `design:design-handoff` — 엔진(플러그인). 이 스킬이 호출한다.
- `design:design-system` · `design:accessibility-review` — 핸드오프 전 선택적 심화 점검(기존 게이트와 겹치면 생략).

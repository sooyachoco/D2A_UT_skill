---
name: reference-proposal
interactive: true
version: 1.0.0
description: 시나리오의 화면 목록을 입력받아, 화면설계 전에 레퍼런스를 "AI가 제안 → 사용자가 선택/반례"로 확정하는 실행 워크플로. ① 전체 기준 톤 1개 + ② 화면(job)별 인터랙션 레퍼런스 2~3안을 PRD job 기반으로 직접 추천하고, reference-board.md로 굳혀 ui-design-workflow에 공급한다. "레퍼런스 제안해줘", "레퍼런스 잡아줘", "참고할 만한 거 골라줘", "화면 레퍼런스" 요청 시 사용. write-scenario(시나리오) 다음, ui-design-workflow(화면 설계) 앞에 들어간다.
status: draft
last_updated: 2026-06-30
triggers:
  - /reference-proposal
  - 레퍼런스 제안
  - 레퍼런스 잡아
  - 레퍼런스 골라
  - 참고 화면 제안
  - 레퍼런스 추천
---

# 레퍼런스 제안 워크플로 (Reference Proposal)

> **이 문서의 출발점 (왜 필요한가):**
> 레퍼런스에 관한 원칙은 이미 흩어져 있다 — `ui-design-workflow §5`(레퍼런스 키스매드)·`§5.5`(기준 톤)·`design-research`(웹 리서치).
> 그런데 그건 **원칙**일 뿐, "입력→제안→선택→산출물"로 묶은 **실행 절차**가 없다.
> 그래서 매번 화면 설계 STEP 0에서 "톤 레퍼런스 1개 주세요"로 즉흥 처리되고, 화면별 인터랙션 레퍼런스는
> 사용자가 백지에서 떠올려야 했다. 이 스킬이 그 빠진 실행 단계다.

---

## 0. 제1원칙 — 백지로 묻지 않는다 (AI가 제안, 사용자는 고르거나 반례만)

레퍼런스를 "주세요"라고 백지로 물으면 사용자가 떠올려야 하고(부담↑), 수렴이 느리다.
**AI가 PRD의 job(동사+대상)을 근거로 카테고리 + 구체 제품을 직접 제안하면, 사용자는 *고르거나 반례를 들기만* 하면 된다**
(부담↓·수렴↑ — `ui-design-workflow.md` §5).

레퍼런스는 **2층**이다 (`ui-design-workflow.md` §5):

| 층 | 무엇 | 개수 | 누가 정하나 |
|---|---|---|---|
| ① 기준 톤 | 전체 비주얼 방향 | **1개** | 사용자 선택 (없으면 AI가 극단 2~3안 던짐) |
| ② 인터랙션 레퍼런스 | 화면(job)별 "어떻게 보이고 조작되나" | 화면당 1개 | 사용자 선택/반례 |

> **레퍼런스는 베끼지 않는다.** 키스톤(레이아웃·정보 위계·여백·텍스트 크기차·진입점)만 가져와 맥락에 맞춘다.
> 그리고 **"그 요소가 우리 맥락에서도 의미 있나"를 먼저 거른다** (`ui-design-workflow.md:277` — 증권 종목 태그 트랩).

---

## 1. 파이프라인 위치

```
write-scenario        [이 스킬 · 레퍼런스 제안]            ui-design-workflow
(화면 목록)    ──▶   Step2 기준 톤  제안→선택      ──▶   STEP 0 (기준 톤 확보됨)
                     Step3 화면별 인터랙션            STEP 3 발산 (레퍼런스 기준)
                           레퍼런스 제안→선택/반례
      ↑ refs/ux-research(페르소나·여정) 읽기          ↓ 산출
                                          specs/{NNN}/design/reference-board.md
```

- **앞 단계**: `write-scenario`(시나리오=화면 목록·위계). 시나리오가 없으면 Step 0에서 PRD만으로 화면 후보를 잠정 도출하되, 흐름 확정은 `ui-design-workflow` STEP 1에 위임한다.
- **뒤 단계**: `ui-design-workflow`. 이 스킬의 산출물(기준 톤 + 화면별 키스톤)이 그 STEP 0·STEP 3의 입력이 된다.

### 기존 스킬과의 경계 (중복 금지)

| 스킬 | 역할 | 이 스킬과의 관계 |
|---|---|---|
| `design-research` | 제품 *전체* 비주얼 트렌드 리서치(Phase 0, 1회) → `design-direction.md` | **Step 2(톤)에서 호출/재사용.** 톤 발산을 새로 만들지 않는다. |
| `ui-design-workflow §5` | 레퍼런스를 *어떻게 다룰지*의 원칙(임베디드 가이드) | 이 스킬은 그 원칙의 **러너**. §5는 그대로 두고 참조한다. |
| **이 스킬의 순수 신규** | **Step 3(화면별 propose→pick) + `reference-board.md`** | — |

---

## 2. grounding 소스 — AI 기억만으로 제안 금지

제안은 반드시 실제 소스에 근거한다 (추측 제품명·"~인 것 같은" 금지).

| 소스 | 언제 | 방법 |
|---|---|---|
| **WebSearch** (기본) | 항상 | `design-research` Step 1 키워드 재사용 — "{도메인} {job} UI design {연도}", "best {유형} {기능} pattern", "Awwwards/Dribbble {키워드}" |
| **nxbasic-mcp** | `DESIGN_SYSTEM=nxbasic` 이거나 사내 표준 UI일 때 | `list_components` / `get_component_docs` 로 사내 컴포넌트를 레퍼런스로 제시 (예: Table·Dialog·TextField 패턴) |
| **사용자 제공** | 사용자가 링크·스크린샷·기존 서비스를 줄 때 | 그대로 키스톤 추출 대상으로 삼는다 |

> 이 스킬은 Figma MCP를 **능동적으로 호출하지 않는다**(사용자 결정). 사용자가 Figma 화면을 직접 공유하면 그건 "사용자 제공" 소스로 소비한다.

---

## 3. 실행 런북 — 각 스텝: [내 액션] · [사용자 유도] · [게이트]

> **핵심: 사용자가 레퍼런스를 *떠올리게* 하지 말고, 내가 후보·근거를 *유도*한다.**

### STEP 0 · 입력 수집 (그리기 전)
- **내 액션**: 아래를 로드 — ① PRD 7칸(§5 동사+대상; 없으면 PRD에서 추출) ② 시나리오 화면 목록(`write-scenario` 산출 또는 `specs/{NNN}/flow.md`) ③ 페르소나·여정(`refs/ux-research/PERSONA.md`·`USER_JOURNEY_MAP.md` — 채워져 있으면 톤·밀도 판단에 사용, 비었으면 일반 휴리스틱) ④ 기존 기준 톤/`design-direction.md` 존재 여부. **메인 기능 1개 식별(깊이 우선 — `ui-design-workflow` §2).**
- **유도**: 없는 것만 콕 집어 청한다 — "메인 기능은 어느 화면인가요? / 떠오르는 기존 서비스 있으면 1개만(없으면 제가 극단안 던집니다)"
- **게이트**: job 목록 + 화면↔job 매핑 초안 + 메인 기능 확보 → STEP 1

### STEP 1 · job 분해 + 화면 매핑 (글)
- **내 액션**: PRD/시나리오에서 job을 **"동사 + 대상 + 핵심 인터랙션 1줄"**로 리라이트(§5 표). 명사·모호어("관리/처리")는 매칭 불가 → 동사로 변환. 각 화면에 job을 매핑하고 ★메인 표시.
- **유도**: "이 job 매핑 맞나요? 빠진/틀린 화면 짚어주세요"
- **게이트**: 매핑 승인 → STEP 2

### STEP 2 · 기준 톤 제안 → 선택 (1개)
- **분기**:
  - 기준 톤/`design-direction.md`가 **이미 확정** → 확인만 하고 STEP 3로.
  - `DESIGN_SYSTEM=nxbasic` → 톤은 NX Basic으로 이미 고정. 기준 톤 발산 생략, nxbasic-mcp 개요만 확인하고 STEP 3로.
  - **미확정** → `design-research`를 호출/재사용한다(톤 발산을 새로 만들지 않음). `Skill("design-research")` 시도 → 실패 시 `.claude/skills/design-research.md` Read 후 Step 1~3.5 인라인 실행. 그 결과(극단 2~3안 또는 비주얼 시그니처)를 **기준 톤 후보**로 제시.
- **내 액션**: 후보 2~3안을 각각 *실제 레퍼런스 1~2개(URL)* + "왜 이 톤이 이 페르소나/제품에 맞나" 1줄로 제시.
- **유도**: "기준 톤 1개만 고르세요. 탈락안도 기록해 둡니다(2-strike 후퇴 지점)."
- **게이트**: 기준 톤 1개 확정 → `reference-board.md`의 톤 섹션 기록 + (신규 확정 시) `design-direction.md` 톤 항목 갱신은 design-research/ui-design-workflow에 위임.

### STEP 3 · 화면별 인터랙션 레퍼런스 제안 → 선택/반례 ★(신규 가치)
- **순서**: **메인 기능 화면부터**(깊이 우선). 로그인·대시보드 등 관습 화면은 뒤로.
- **내 액션**: 각 화면(job)마다 grounding 소스로 **구체 제품/화면 2~3개**를 찾아 제안한다. 각 후보에 대해 한 줄씩:
  - **왜 이 job에 맞나** (job의 핵심 인터랙션과 어떻게 일치하나)
  - **가져올 키스톤** (레이아웃·정보 위계·진입점 중 구체적으로 무엇)
  - **안 가져올 것** (우리 맥락에서 의미 없는 군더더기 — §5 종목 태그 트랩 차단)
- **유도**: "이 화면은 이 셋 중 어느 쪽? 섞을 부분이나 반례 있으면 알려주세요." — 백지 질문 금지.
- **게이트**: 화면별 레퍼런스 1개 + 키스톤 확정 (메인 기능은 반드시, 보조 화면은 사용자가 "추천대로"면 일괄 수용 가능).

### STEP 4 · 보드 작성 + 핸드오프
- **내 액션**: `specs/{NNN}/design/reference-board.md` 작성(아래 §4 스키마). 작성 후:
  - 기준 톤 → `ui-design-workflow` STEP 0의 "기준 톤"으로 투입(또는 `design-direction.md`에 이미 반영됨).
  - 화면별 키스톤 → `ui-design-workflow` §5 / STEP 3 발산의 입력.
- **유도**: "레퍼런스 보드 확정했습니다. 이대로 `ui-design-workflow 실행해줘`로 화면 설계 들어갈까요?"
- **게이트**: 보드 파일 존재 → 1c(ui-design-workflow) 진입 가능.

---

## 4. 산출물 — `specs/{NNN}/design/reference-board.md`

```markdown
# 레퍼런스 보드 — {기능/프로젝트}

> 출처: reference-proposal 스킬 · {날짜}
> 소비처: ui-design-workflow(STEP 0 기준 톤 / STEP 3 발산), design-direction.md(톤)

## 1. 기준 톤 (1개)
- **선택**: {제품/사이트} · 출처: {URL} · 이유: {왜 이 톤 — 페르소나/제품 맥락}
- 탈락 안: {A}(왜 탈락), {B}(왜 탈락)   ← 2-strike 후퇴 지점

## 2. 화면별 인터랙션 레퍼런스
| 화면(job) | 메인? | 레퍼런스 | 가져올 키스톤 | 안 가져올 것 | 출처 |
|---|:---:|---|---|---|---|
| {동사+대상} | ✅/— | {제품/화면} | {레이아웃·위계·진입점 중 구체} | {군더더기} | {URL/MCP} |

## 3. 미결 (와이어프레임에서 확정할 것)
- {레퍼런스만으로 안 풀린 인터랙션} → ui-design-workflow STEP 3 발산에서 해소
```

> "안 가져올 것" 칸은 **빈칸 금지** — 비우면 §5의 "맥락 적합성 거르기"를 건너뛴 것이다. 없으면 "해당 없음(전부 적합)"이라도 명시.

---

## 5. 활동 로그 (CLAUDE.md 규칙 5)

```bash
# 스킬 실행은 Skill hook이 자동 기록(SKILL). 아래는 AI 직접 호출 필수 건만:

# 기준 톤 확정 직후 (설계 결정)
./scripts/log-activity.sh DECISION "[기준 톤]: {선택 제품}" "👤 reference-proposal에서 선택" || true

# nxbasic-mcp를 레퍼런스 소스로 참조한 경우
./scripts/log-activity.sh POLICY "nxbasic-mcp: {참조 컴포넌트} 레퍼런스로 제시" "" || true
```

---

## 6. 사이드레일 — "다 별로일 때"
1. **한 축으로 좁힌다**: 톤이 안 맞나 / 인터랙션 패턴이 안 맞나 / 밀도가 안 맞나.
2. **톤이면 STEP 2로**, 인터랙션이면 STEP 3에서 해당 화면만 후보 교체.
3. **2-strike 후퇴**: 같은 화면 후보를 2번 제안해도 다 반려되면 → 그 화면은 레퍼런스 없이 `ui-design-workflow` STEP 3 발산(관습 깬 안 포함)으로 직행한다. 무한 제안 금지.

## 7. 관련 문서
- `write-scenario` — 앞 단계(화면 목록·위계). 이 스킬의 입력.
- `ui-design-workflow` §5 레퍼런스 키스매드 / §5.5 기준 톤 — 이 스킬이 실행하는 원칙.
- `design-research` — Step 2 톤 발산에서 재사용.
- `refs/ux-research/PERSONA.md`·`USER_JOURNEY_MAP.md` — 톤·밀도 판단의 단일 source(read-only).

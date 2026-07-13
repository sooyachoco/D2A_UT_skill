# 토큰 준수 규칙표 (Token Conformance Rubric) — 판정 계약

> **목적**: 디자인 토큰(색상·타이포) 준수 여부를 "리뷰어 눈대중"에서 **"정적 신호 → 카테고리 → severity → 신뢰도 → baseline"의 명시적 계약**으로 전환한다.
> 이 문서는 `token-conformance.mjs` 가 방출하는 위반 어휘와, 그것을 집계·게이팅하는 규칙의 **단일 계약(source of truth)** 이다.
>
> **근거**: `UT_HEURISTIC_RUBRIC.md` 와 동일 원칙 — 생성형 AI/리뷰어의 "이건 좀 아닌데" 주관 판단이 아니라, **정적 분석으로 결정론적으로 검출되는 리터럴**에만 게이트를 건다.
> 색상 hex/rgb/hsl 리터럴, 하드코딩 font-size 는 파서가 100% 재현 가능하게 검출한다. "의미 색상을 잘못 골랐다" 같은 판단은 advisory 로 분리한다.

---

## 0. 배경 — 디자인 시스템 없이(또는 강제 없이) 개발할 때 발생하는 문제

디자인 시스템(NX Basic 등)을 도입해도 **강제 장치가 없으면** 토큰이 서서히 이탈하며 아래 문제가 반복된다.
이 게이트는 그중 **정적으로 결정론 검출이 가능한 ①·②**를 배포 차단으로 강제하고, 나머지는 디자인 시스템 자체와 파이프라인 전체가 함께 다룬다.

| # | 문제 | 대표 증상 | 이 게이트의 대응 |
|---|---|---|---|
| ① | UI/UX 일관성 붕괴 | 화면마다 버튼·색상·폰트·여백이 다름 · 동일 기능에 다른 인터랙션 · 패턴 적용·브랜드 아이덴티티 약화 | **직접 해소** — 색상·타이포 하드코딩을 검출해 토큰(`var(--color-*)` / `.type-*`) 참조를 강제 |
| ② | 디자인 부채 누적 | 즉흥적 컴포넌트 생성 반복 · 중복 스타일·예외 케이스 증가 · 리팩토링 비용 지속 상승 | **직접 해소** — baseline 이후 신규 하드코딩(=새 부채)을 원천 차단, 기존 부채는 §4 별도 상환 트랙으로 분리 관리 |
| ③ | 개발 생산성 저하 | 공통 UI를 프로젝트마다 재구현 · 디자이너-개발자 간 확인/수정 반복 · 표준 부재로 코드 구조 제각각 | 간접 — 토큰 참조 강제가 "공통 UI 재사용"을 기본 경로로 만듦(컴포넌트 라이브러리 자체는 이 게이트 범위 밖) |
| ④ | 유지보수 난이도 증가 | 전역 수정 시 영향 범위 예측 어려움 · 작은 변경에도 다수 화면 수정 필요 · 기술 부채 가속화 | 간접 — `token_coverage` 가 높을수록 전역 수정이 "토큰 1곳 변경"으로 수렴, 영향 범위가 예측 가능해짐 |
| ⑤ | SDD(Spec Driven Development) 전환 불가 | UI 명세가 구조화되어 있지 않음 · 자동 코드 생성 기준 부재 · 규칙 기반 개발 체계 구축 어려움 | 간접 — `token-metrics` machine-readable 지표가 `create-spec`/`tasks.md` 의 `done` 기준(`token:`)으로 편입되어, 규칙 기반 파이프라인의 검증 레이어가 됨 |

> 이 게이트 단독으로 5개 문제를 전부 해결하지 않는다. 나머지 축(③④⑤)은 `ai-usability-test`·`create-spec`·디자인 시스템 문서화(`design:design-system`)가 함께 담당한다 — 전체 그림은 `INTEGRATION.md` §0 참조.

---

## 1. 핵심 원칙

1. **게이트는 결정론 검출에만** — 아래 §2 규칙표에 등재된 위반(`hardcoded-color`·`hardcoded-font-size` 등)만 `token_violations` 카운트에 반영되어 게이트에 걸린다.
2. **신규/baseline 분리 필수** — 기존 코드의 위반은 `--update-baseline` 로 **1회 스냅샷 등록 후 면제**된다. 게이트로 차단되는 건 **신규·수정 코드에서 새로 생긴 위반(baseline 초과분)** 뿐이다. (전면 강제 시 레거시가 전부 걸려 도입 불가 → 점진 강제.)
3. **두 지표로 판정** — `token_coverage`(테마 대상 선언 중 토큰 참조 비율 %)와 `token_violations`(신규 하드코딩 건수). 게이트 예: `token_coverage>=90,token_violations=0`.
4. **주관 판단은 advisory** — "primitive(`--color-*`) 대신 semantic(`--semantic-*`)을 썼어야" 같은 판단, 알 수 없는 var 참조 등은 게이트에서 제외하고 advisory 로만 표기한다(은폐 금지, 사람 검토).
5. **토큰 정의는 위반이 아니다** — `colors.css`/`tokens.ts`/`typography.css` 등 토큰 SSOT 파일의 hex/px 는 "정의"이므로 반드시 `ignore` 로 스캔에서 제외한다.
6. **spacing 은 범위 밖** — NX Basic 에 아직 spacing 토큰이 없으므로 이 게이트는 색상·타이포만 검출한다. 토큰이 생기면 §2 에 어휘를 추가한다(코드 변경 + 리뷰).

---

## 2. 위반 어휘 → 카테고리·severity (게이트 대상)

`token-conformance.mjs` 의 `RULE_DEFAULTS` 와 1:1로 일치한다. 스캐너는 아래 어휘만 방출한다.

| errorType | 카테고리 | severity | 검출 방법 (결정론) |
|---|---|---|---|
| `hardcoded-color` | 색상 토큰 이탈 | S3 | 스캔 파일에 raw 색상 리터럴(`#rgb`/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`/`hsl()`/`hsla()`)이 존재 — `var(--color-*)`/`var(--semantic-*)` 참조가 아님 |
| `hardcoded-font-size` | 타이포 토큰 이탈 | S3 | `font-size`/`fontSize` 선언 값이 길이 리터럴(`px`/`rem`/`em`/`pt`) — `var(--font-*)` 도 `.type-*` 클래스도 아님 |
| `hardcoded-line-height` | 타이포 토큰 이탈 | S2 | `line-height`/`lineHeight` 값이 하드코딩(설정 `checkLineHeight`) |
| `hardcoded-letter-spacing` | 타이포 토큰 이탈 | S2 | `letter-spacing`/`letterSpacing` 값이 하드코딩(설정 `checkLetterSpacing`) |

> **정규화**: 검출된 리터럴은 소문자·공백제거로 정규화해 fingerprint 를 만든다(§4). `#FFF`·`#ffffff`·`#fff` 는 색상 리터럴로는 모두 하드코딩이며, fingerprint 는 표기 그대로 정규화한 값으로 구분한다.
> **토큰 참조 판정**: `var(--<prefix>…)` 형태이며 prefix 가 config 의 `colorVarPrefixes`/`fontVarPrefixes` 에 등재된 경우 "tokenized". `var(--x, #fff)` 의 fallback 자리 hex 는 여전히 `hardcoded-color` 로 검출한다(fallback 도 이탈).
> severity 는 **규칙표가 권위** 다 — 스캐너가 임의로 바꾸지 않는다.

---

## 3. 신뢰도·provenance 규칙 (`classify()` 계약)

| provenance | 조건 | confidence | 게이트 | 렌더링 위치 |
|---|---|---|---|---|
| `rule` | §2 규칙표에 등재된 위반 (baseline 초과분) | high | ✅ `token_violations` 카운트 | 위반 목록 |
| `baseline` | §2 위반이지만 baseline 에 등록됨(기존 코드) | high | ❌ 면제 | baseline 섹션(요약만) |
| `advisory` | 규칙표 밖 판단 — 아래 어휘 | low | ❌ 제외 | advisory 섹션 |

### advisory 어휘 (게이트 제외, 사람 검토)

| errorType | 의미 | 왜 advisory 인가 |
|---|---|---|
| `named-color` | `white`/`black`/`red` 등 색상 이름 사용 | 이름 색상은 오탐 많음(예: `white-space`). `gateNamedColors: true` 로 게이트 승격 가능 |
| `unknown-token-ref` | `var(--x)` 인데 로드된 토큰 세트에 없음 | 오타일 수도, 아직 미등록 토큰일 수도 — 하드코딩과 달리 확정 불가 |
| `raw-primitive-over-semantic` | `--color-*` 직접 사용(semantic 별칭 존재 시) | 의미 레이어 사용은 "권장"이지 "규칙"이 아님(주관) |

- 게이트 지표(`token-metrics` 주석)의 `token_violations` 는 **provenance=rule** 만 반영한다.
- advisory 건수는 별도 지표 `token_advisory=N` 으로 보고한다(은폐 금지).

---

## 4. baseline 계약 (신규 위반만 게이트)

- baseline 스냅샷: `{reportDir}/token-baseline.json`. `node token-conformance.mjs --update-baseline` 로 생성/갱신.
- fingerprint = `{상대경로}|{kind}|{정규화값}` (라인 번호 미포함 → 리포맷·줄이동에 안정). kind ∈ `color`/`font-size`/`line-height`/`letter-spacing`.
- baseline 은 fingerprint→개수(count) 맵. 스캔 시 각 fingerprint 의 **baseline 초과 발생분만** `token_violations` 로 카운트한다.
  - 기존 hex 를 그대로 두면 → baseline 이 흡수 → 위반 아님.
  - 같은 값을 **새 위치에 추가**(count 증가)하거나 **새로운 값**을 도입하면 → 신규 fingerprint/초과분 → 위반.
  - 기존 hex 를 토큰으로 고치면 → 발생분 감소 → baseline 이 자연히 줄어드는 방향(게이트에 유리, 재스냅샷 시 반영).
- baseline 이 없으면 **모든 하드코딩이 신규 위반**으로 잡힌다(최초 도입 시 반드시 `--update-baseline` 1회 실행 후 커밋).

> baseline 은 "부채 동결" 장치다. 새 부채는 막고, 기존 부채는 별도 리팩터로 점진 상환한다. baseline 파일을 커밋해 팀 공유한다.

---

## 5. 게이트 지표 (참고)

```
<!-- token-metrics: token_coverage=93 token_violations=0 token_total=142 token_tokenized=132 token_hardcoded=10 token_baseline=10 token_advisory=3 color_coverage=95 type_coverage=88 files=57 -->
```

- `token_coverage` — 테마 대상 선언 중 토큰 참조 비율 % = `tokenized / (tokenized + hardcoded)`
- `token_violations` — **신규** 하드코딩 건수(baseline 초과분, provenance=rule) ← **핵심 게이트 지표**
- `token_hardcoded` — 전체 하드코딩(신규 + baseline), `token_baseline` — 그중 면제분
- `token_advisory` — 게이트 제외 findings 수(사람 검토)
- `color_coverage`/`type_coverage` — 축별 커버리지(참고)

tasks.md done 게이트:
```
- token: specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md :: token_coverage>=90,token_violations=0
```
(self-contained 경로: `cmd: node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0`)

---

## 변경 이력

- 2026-07-13 v1 — 규칙표 신설. 색상(`--color-*`/`--semantic-*` 변수)·타이포(`.type-*` 유틸 클래스) NX Basic 체계 반영, hex/rgb/hsl + font-size 결정론 검출, baseline 면제(신규 위반만 게이트), advisory 분리, `token_coverage`/`token_violations` 2지표. spacing 은 토큰 부재로 범위 밖.
- 2026-07-13 — §0 배경 섹션 추가: 디자인 시스템 미강제 시 발생하는 5대 문제(일관성 붕괴·디자인 부채·생산성 저하·유지보수 난이도·SDD 전환 불가)와 이 게이트의 대응 범위(직접/간접) 명시.

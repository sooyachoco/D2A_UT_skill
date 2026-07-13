# frontend/tests/tokens — 디자인 토큰 준수 게이트

코드에 박힌 색상 리터럴(hex/rgb/hsl)과 하드코딩 font-size 를 **정적 분석**으로 검출해,
디자인 토큰 준수 여부를 배포 게이트로 강제한다. (런타임 관측은 `../ut/` 의 `ai-usability-test` 담당.)

## 파일

| 파일 | 역할 |
|---|---|
| `TOKEN_CONFORMANCE_RUBRIC.md` | **판정 계약** — 위반 어휘 → 카테고리 → severity → 신뢰도 → baseline 규칙 (단일 source) |
| `token-conformance.mjs` | 스캐너 — 스캔·분류·baseline diff·리포트 생성·게이트 self-check (외부 의존 없음) |
| `token-conformance.config.example.mjs` | 설정 예시 — `token-conformance.config.mjs` 로 복사해 사용 |

## 빠른 시작

```bash
# 아래는 모두 repo 루트에서 실행
cp frontend/tests/tokens/token-conformance.config.example.mjs frontend/tests/tokens/token-conformance.config.mjs  # roots/reportDir/tokenSources 편집
node frontend/tests/tokens/token-conformance.mjs --update-baseline   # 기존 부채 동결(1회, 커밋)
node frontend/tests/tokens/token-conformance.mjs                     # 스캔 → 리포트
node frontend/tests/tokens/token-conformance.mjs --gate token_coverage>=90,token_violations=0
```

## 동작 원리

- **토큰화 판정**: `var(--color-*)`/`var(--semantic-*)`(색상), `var(--font-*)` 또는 `.type-*` 유틸 클래스(타이포)를 참조하면 tokenized.
- **위반**: 위 참조가 아닌 raw 리터럴(hex/rgb/hsl, `font-size: 14px` 등) = 하드코딩.
- **신규만 게이트**: `token-baseline.json`(fingerprint = 경로|kind|정규화값, 라인번호 무관) 대비 **초과분만** `token_violations`. 기존 부채는 면제.
- **advisory**: 색상 이름(`white`)·미등록 var 참조·primitive-over-semantic 은 오탐 여지가 있어 게이트에서 제외(리포트에는 표기).

## CLI

| 명령 | 동작 |
|---|---|
| (없음) | 스캔 → `{reportDir}/TOKEN_CONFORMANCE_REPORT.md` 생성 |
| `--update-baseline` | 현재 위반을 `token-baseline.json` 으로 동결(기존 부채 면제) |
| `--gate <규칙>` | 임계 self-check — 미충족 시 exit 1 (규칙 생략 시 config.gate 사용) |
| `--json` | 지표만 JSON 출력 |

환경변수: `TOKEN_ROOT`(스캔 루트, 기본 `cwd`), `TOKEN_CONFIG`(설정 경로 override).

## 계약 변경

위반 어휘·severity 를 바꾸려면 **`TOKEN_CONFORMANCE_RUBRIC.md` 와 `token-conformance.mjs` 의 `RULE_DEFAULTS` 를 함께** 수정한다(1:1 일치가 계약). spacing 토큰이 생기면 여기에 축을 추가한다.

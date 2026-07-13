// token-conformance.config.example.mjs — 디자인 토큰 준수 게이트 설정 예시
// 복사해서 token-conformance.config.mjs 로 저장하고 대상 프로젝트에 맞게 채운다.
//   cp frontend/tests/tokens/token-conformance.config.example.mjs frontend/tests/tokens/token-conformance.config.mjs
//
// 이 게이트는 "코드에 박힌 색상/타이포 리터럴"을 정적 분석으로 검출한다.
// 계약(단일 source): frontend/tests/tokens/TOKEN_CONFORMANCE_RUBRIC.md
//
// NX Basic(sooyachoco/NXbasic1.0v) 토큰 체계 전제:
//   · 색상   → CSS 변수  --color-*  / --semantic-*  (colors.css, tokens.ts)
//   · 타이포 → 유틸 클래스 .type-default-16 등        (typography.css, defaultTypeScale)
//              ※ 타이포는 `var(--font-*)`가 아니라 클래스로 소비된다. 규칙표 §2 참조.
//   · spacing 토큰은 아직 없음 → 이번 게이트 범위 밖(검출하지 않는다).

export default {
  // ── 스캔 범위 ──────────────────────────────────────────────────────────
  // 애플리케이션 코드(토큰을 "소비"하는 쪽)만 스캔한다. 토큰 "정의" 파일은 ignore 로 뺀다.
  roots: ['src', 'frontend/src', 'app', 'components'],
  include: [/\.(css|scss|sass|less|styl|ts|tsx|js|jsx|mjs|vue|svelte)$/],
  ignore: [
    /node_modules/, /\.next\/|\/dist\/|\/build\/|\/coverage\//, /\.d\.ts$/,
    /\.stories\.[jt]sx?$/, /\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/,
    // 토큰 정의(SSOT) — 여기의 hex/px 는 "정의"이므로 위반이 아니다. 반드시 제외.
    /tokens?\.(css|ts|js|mjs|json)$/, /colors?\.css$/, /typography\.css$/, /theme\.(css|ts)$/,
  ],

  // 산출물 위치 (repo 루트 기준). 리포트와 baseline 스냅샷이 여기 저장된다.
  //   ai-usability-test 규약과 정렬: specs/{NNN}/tokens
  reportDir: 'specs/001-example/tokens',

  // ── 토큰 참조로 인정하는 CSS 변수 프리픽스 ─────────────────────────────
  // 이 프리픽스로 시작하는 var(--…) 참조는 "토큰화됨(tokenized)"으로 집계한다.
  colorVarPrefixes: ['--color-', '--semantic-'],
  // 타이포는 NX Basic 에선 클래스지만, 프로젝트가 자체 폰트 변수를 쓰면 여기에 등록.
  fontVarPrefixes: ['--font-', '--type-', '--text-', '--fs-', '--lh-'],
  // 타이포 유틸 클래스 패턴 — className/class 에서 이걸 쓰면 "토큰화됨"으로 인정(커버리지 가산).
  typeClassPattern: /\btype-(?:default|w-)[a-z0-9-]+\b/,

  // ── 검출 정책 ──────────────────────────────────────────────────────────
  // 색상 이름(white/black/red …)은 오탐이 많아 기본은 advisory(게이트 제외). hex/rgb/hsl 만 게이트.
  gateNamedColors: false,
  // font-size 외에 line-height/letter-spacing 하드코딩도 검출할지(기본 검출, severity 낮음).
  checkLineHeight: true,
  checkLetterSpacing: true,

  // ── 토큰 세트(선택) — 리포트 보강용 ─────────────────────────────────────
  // 지정하면 하드코딩된 hex 가 어떤 토큰과 정확히 일치하는지 리포트에 "→ var(--color-xxx)" 로 안내하고,
  // 알 수 없는 var(--…) 참조를 advisory(unknown-token-ref)로 표기한다. 게이트에는 영향 없음(참고용).
  tokenSources: ['src/tokens/colors.css', 'src/tokens/tokens.ts'],

  // ── 게이트 기본 임계 (--gate 플래그 미지정 시 self-check 에 사용) ────────
  // tasks.md done 에서 token: 타입으로 걸 때는 거기 임계가 우선한다.
  gate: { token_coverage: 90, token_violations: 0 },
};

// ut.config.example.mjs — UT 러너 설정 예시
// 복사해서 ut.config.mjs 로 저장하고, 대상 서비스의 실제 시나리오로 채운다.
//   cp frontend/tests/ut/ut.config.example.mjs frontend/tests/ut/ut.config.mjs
//
// 각 scenario.run(ctx) 은 페르소나별로 재실행된다. ctx 로 받는 것:
//   ctx.page      Playwright Page
//   ctx.persona   행동 헬퍼 { activate, goto, fill, tabTo, isVisible, isAboveFold, think, label }
//   ctx.base      기준 URL (UT_BASE 로 override)
//   ctx.goto(p)   base+경로 이동 + 인증 리다이렉트 가드
//   ctx.rec(sig)  관측 신호 기록 (persona/scenario 자동 첨부)
//   ctx.shot(n)   스크린샷 → 상대경로 반환
//
// rec 신호 스키마(집계기 ut-aggregate 가 소비):
//   { action, completed, isError, errorType, hesitationMs, severityHint,
//     heuristic('N1'~'N10'), screenshotPath, ariaIssue, note }

export default {
  base: process.env.UT_BASE || 'https://local-app.nexon.com',

  // 산출물 위치 (repo 루트 기준). ai-usability-test 규약: specs/{NNN}/ut
  specDir: 'specs/001-example/ut',

  // create-spec Step 2.7 이 저장한 storageState — 있으면 인증 상태로 UT 실행
  authState: 'tests/e2e/.auth/user.json',
  authGuardHosts: ['signin.nexon.com', 'nxas.nexon.com'],

  // 콘솔/네트워크 오류 승격에서 제외할 노이즈 패턴 (문자열/RegExp). 서드파티·애널리틱스 등.
  ignoreConsole: [/analytics/i, /Failed to load resource.*favicon/i],
  ignoreNetwork: [/\/favicon\.ico$/, /googletagmanager|google-analytics|doubleclick/],

  // 성능 예산 (Core Web Vitals). 생략 시 기본값(LCP 2500/4000ms, CLS 0.1/0.25) 사용.
  // perf: false 로 성능 수집 자체를 끌 수 있다.
  perfBudget: { lcp: 2500, lcpPoor: 4000, cls: 0.1, clsPoor: 0.25 },

  // 안정성 — 실패한 시나리오 재시도 횟수(기본 1 = 최대 2회 실행).
  // 재시도에서 회복되면 flaky로 격리해 결함 카운트·게이트에서 제외한다(일시적 500/타이밍 오탐 방지).
  retries: 1,
  // 프레임워크 잡음(HMR·Fast Refresh·Vite·DevTools·favicon 등) 기본 노이즈 필터. false 로 끈다.
  noiseFilters: true,

  // PERSONA.md P1/P2/P3 매핑(SSOT). 시나리오에서 personas 로 개별 override 가능.
  // 'mobile'/'tablet' 은 SSOT 사용자 유형이 아니라 뷰포트 차원 — 필요한 시나리오에만 추가.
  //   예: personas: ['beginner', 'power-user', 'accessibility', 'tablet']
  personas: ['beginner', 'power-user', 'accessibility'],

  // 커버리지(Step 1.5) — UT가 덮어야 할 UI 기능(spec.md F-xx) 목록. 각 scenario의 covers와 대조해
  // 미커버 F-xx를 경고하고 coverage(%) 지표를 산출한다. 미선언 시 커버리지 미측정.
  //   게이트 예: ut: .../UT_FINDINGS_REPORT.md :: S4=0,coverage>=100
  features: ['F-01', 'F-02'],

  scenarios: [
    {
      id: 'S-01',
      title: '메인에서 상세로 진입',
      covers: ['F-01'],        // 이 시나리오가 덮는 spec.md 기능 (커버리지 산출용)
      // a11y: false,          // 이 시나리오만 접근성 스캔 끄기
      async run({ persona, goto, rec, shot, page }) {
        await goto('/');
        await page.waitForSelector('.card', { timeout: 8000 });
        const r = await persona.activate('.card', { label: '첫 카드' });
        const reached = await page.waitForURL(/\/detail\//, { timeout: 8000 }).then(() => true).catch(() => false);
        rec({
          action: 'enter-detail',
          completed: r.ok && reached,
          isError: !reached,
          errorType: reached ? null : 'navigation-dead-end',
          heuristic: reached ? null : 'N1',        // 시스템 상태 가시성
          hesitationMs: r.hesitationMs,
          severityHint: reached ? undefined : 'S3',
          screenshotPath: await shot('detail'),
          note: `활성화=${r.ok}${r.forced ? '(force)' : ''}, 상세도달=${reached}`,
        });
      },
    },

    {
      id: 'S-02',
      title: '핵심 행동(후원/제출) 키보드 도달성',
      covers: ['F-02'],
      personas: ['accessibility'],   // 접근성 페르소나만 실행하는 예시
      async run({ persona, goto, rec, shot }) {
        await goto('/detail/1');
        const nav = await persona.tabTo((info) => /후원|제출|submit/i.test(info.text), 40);
        rec({
          action: 'keyboard-reach-primary',
          completed: nav.reached,
          isError: !nav.reached,
          errorType: nav.reached ? null : 'primary-not-tab-reachable',
          heuristic: nav.reached ? null : 'N7',    // 사용 유연성·효율(단축/접근 경로)
          severityHint: nav.reached ? undefined : 'S4',
          screenshotPath: await shot('keyboard'),
          note: `Tab 포커스 가능 ${nav.focusableCount}개, ${nav.steps}스텝 내 도달=${nav.reached}`,
        });
      },
    },

    {
      id: 'S-03',
      title: '태블릿 브레이크포인트 — 핵심 CTA가 fold 안에 보이는가',
      personas: ['tablet'],   // 810x1080 뷰포트에서만 실행하는 예시 — 사이드바 접힘 등 레이아웃 전환 확인
      async run({ persona, goto, rec, shot }) {
        await goto('/detail/1');
        const fold = await persona.isAboveFold('.cta-primary');
        rec({
          action: 'tablet-cta-above-fold',
          completed: fold.visible && fold.aboveFold,
          isError: fold.visible && !fold.aboveFold,
          errorType: fold.visible && !fold.aboveFold ? 'cta-below-fold' : null,
          heuristic: fold.aboveFold ? null : 'N6',   // 기억보다 인식 — 스크롤해야 보이면 발견성 저하
          severityHint: fold.aboveFold ? undefined : 'S2',
          screenshotPath: await shot('tablet-fold'),
          note: `CTA 노출=${fold.visible}, fold 안=${fold.aboveFold}, y=${fold.y}/${fold.viewportHeight}`,
        });
      },
    },
  ],
};

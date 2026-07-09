// ut-personas.mjs — 재사용 가능한 페르소나 행동 모델
// ai-usability-test 스킬의 P1(초보)/P2(파워)/P3(접근성) 매핑을 Playwright 행동으로 구현한다.
// 시나리오 코드는 이 팩토리가 반환하는 헬퍼로 상호작용해, 같은 시나리오를
// 페르소나별로 서로 다른 속도·경로·입력수단으로 재현한다.
//
// `mobile`/`tablet` 은 PERSONA.md SSOT(P1~P3)가 정의하는 사용자 유형이 아니라, 뷰포트·터치 입력이라는
// **디바이스 차원**을 기존 러너 구조에 얹은 선택적 프로파일이다. 기본 personas 목록에는
// 포함되지 않으며, 시나리오의 `personas: [...]` 에 명시적으로 추가해야 실행된다.

/** 페르소나별 행동 프로파일 (think-time·입력수단·뷰포트). 프로젝트에서 override 가능. */
export const PERSONA_PROFILES = {
  beginner: {
    label: '초보자 — 느린 탐색, 머뭇거림, 오류 후 재시도',
    thinkMin: 300,
    thinkMax: 900,
    input: 'mouse',
    hoverBeforeClick: true,
    viewport: { width: 1440, height: 900 },
  },
  'power-user': {
    label: '파워유저 — 빠른 클릭, 키보드 병행, 직접 경로',
    thinkMin: 40,
    thinkMax: 160,
    input: 'mouse',
    hoverBeforeClick: false,
    viewport: { width: 1440, height: 900 },
  },
  accessibility: {
    label: '접근성 사용자 — Tab/Enter 전용, ARIA 의존',
    thinkMin: 120,
    thinkMax: 350,
    input: 'keyboard',
    hoverBeforeClick: false,
    viewport: { width: 1440, height: 900 },
  },
  mobile: {
    label: '모바일 사용자 — 터치 입력, 좁은 뷰포트, 스크롤 의존 (선택적 디바이스 차원)',
    thinkMin: 250,
    thinkMax: 700,
    input: 'touch',
    hoverBeforeClick: false,
    viewport: { width: 390, height: 844 }, // iPhone 12/13 크기
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
  tablet: {
    label: '태블릿 사용자 — 터치 입력, 중간 뷰포트 (사이드바 접힘 등 반응형 브레이크포인트 전환 확인) (선택적 디바이스 차원)',
    thinkMin: 150,
    thinkMax: 500,
    input: 'touch',
    hoverBeforeClick: false,
    viewport: { width: 810, height: 1080 }, // iPad Air 세로 크기
    isMobile: false, // 태블릿은 데스크톱 레이아웃으로 분기하는 사이트가 많아 모바일 UA/뷰포트 메타 강제는 끈다
    hasTouch: true,
    deviceScaleFactor: 2,
  },
};

const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

/**
 * 한 페르소나의 행동 헬퍼를 만든다.
 * @param {import('@playwright/test').Page} page
 * @param {string} personaId  'beginner' | 'power-user' | 'accessibility'
 */
export function makePersona(page, personaId) {
  const profile = PERSONA_PROFILES[personaId];
  if (!profile) throw new Error(`알 수 없는 페르소나: ${personaId}`);

  /** 페르소나 특성에 맞는 think-time 만큼 멈춘다. 최장 머뭇거림을 반환. */
  const think = async () => {
    const ms = rand(profile.thinkMin, profile.thinkMax);
    await page.waitForTimeout(ms);
    return ms;
  };

  const goto = async (url, opts = {}) =>
    page.goto(url, { waitUntil: 'networkidle', ...opts });

  /**
   * 페르소나 방식으로 요소를 활성화한다.
   *  - mouse 페르소나: (초보는 hover 후) 클릭. 애니메이션으로 unstable 이면 force 폴백.
   *  - keyboard 페르소나: focus() 후 Enter — 실제 키보드 사용자 경로.
   *  - touch 페르소나: 뷰포트 밖이면 스크롤 후 tap(). 미지원 요소는 force 클릭 폴백.
   * @returns {{ok:boolean, hesitationMs:number, forced:boolean, error?:string}}
   */
  const activate = async (selector, { label } = {}) => {
    const loc = typeof selector === 'string' ? page.locator(selector).first() : selector;
    const hesitationMs = await think();
    try {
      await loc.waitFor({ state: 'visible', timeout: 8000 });
      if (profile.input === 'keyboard') {
        await loc.focus();
        await page.keyboard.press('Enter');
        return { ok: true, hesitationMs, forced: false };
      }
      if (profile.input === 'touch') {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        try {
          await loc.tap({ timeout: 2500 });
          return { ok: true, hesitationMs, forced: false };
        } catch {
          await loc.click({ force: true });
          return { ok: true, hesitationMs, forced: true };
        }
      }
      if (profile.hoverBeforeClick) await loc.hover().catch(() => {});
      try {
        await loc.click({ timeout: 2500 });
        return { ok: true, hesitationMs, forced: false };
      } catch {
        // 무한 애니메이션 등으로 'not stable' → 현실의 반복 클릭을 force 로 시뮬레이션
        await loc.click({ force: true });
        return { ok: true, hesitationMs, forced: true };
      }
    } catch (e) {
      return { ok: false, hesitationMs, forced: false, error: e.message };
    }
  };

  const fill = async (selector, value) => {
    await think();
    const loc = typeof selector === 'string' ? page.locator(selector).first() : selector;
    await loc.fill(value);
  };

  const isVisible = async (selector) => {
    const loc = typeof selector === 'string' ? page.locator(selector).first() : selector;
    return loc.isVisible().catch(() => false);
  };

  /**
   * 키보드 Tab 으로 최대 maxTabs 만큼 이동하며 predicate 를 만족하는 포커스를 찾는다.
   * 접근성 페르소나의 "키보드만으로 목표 도달 가능?" 을 측정한다.
   * @param {(info:{tag:string,text:string,role:string})=>boolean} predicate
   * @returns {{reached:boolean, focusableCount:number, steps:number, trail:string[]}}
   */
  const tabTo = async (predicate, maxTabs = 40) => {
    let focusableCount = 0;
    let reached = false;
    let steps = 0;
    const trail = [];
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      steps++;
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName ?? '',
          role: el?.getAttribute?.('role') ?? '',
          text: (el?.innerText || el?.getAttribute?.('aria-label') || '').slice(0, 24),
        };
      });
      if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(info.tag)) focusableCount++;
      if (info.text) trail.push(info.text);
      if (predicate(info)) { reached = true; break; }
    }
    return { reached, focusableCount, steps, trail };
  };

  /**
   * 요소가 스크롤 없이 현재 뷰포트(fold) 안에 보이는지 확인한다.
   * 좁은 모바일 뷰포트에서 핵심 CTA가 fold 밖으로 밀려나는 문제를 잡는 데 쓴다.
   * @returns {{visible:boolean, aboveFold:boolean, y?:number, viewportHeight?:number}}
   */
  const isAboveFold = async (selector) => {
    const loc = typeof selector === 'string' ? page.locator(selector).first() : selector;
    const box = await loc.boundingBox().catch(() => null);
    if (!box) return { visible: false, aboveFold: false };
    const vp = page.viewportSize();
    const viewportHeight = vp?.height ?? Infinity;
    const aboveFold = box.y >= 0 && box.y + box.height <= viewportHeight;
    return { visible: true, aboveFold, y: box.y, viewportHeight };
  };

  return { id: personaId, profile, label: profile.label, think, goto, activate, fill, isVisible, tabTo, isAboveFold };
}

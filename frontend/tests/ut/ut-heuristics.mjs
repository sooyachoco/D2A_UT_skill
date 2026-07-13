// ut-heuristics.mjs — 결정론적 Nielsen 휴리스틱 검출기
//
// 시나리오 run() 코드에서 호출해, "AI가 눈으로 판단"하는 대신 **관찰 가능한 조건**을
// 코드로 검사하고 UT_HEURISTIC_RUBRIC.md 의 표준 errorType 을 방출한다.
// 각 검출기는 위반 시 rec()에 넣을 partial 객체를, 정상이면 null 을 반환한다.
//
// 규칙표(단일 계약): frontend/tests/ut/UT_HEURISTIC_RUBRIC.md
// 여기서 방출하는 errorType/heuristic/severityHint 는 ut-aggregate.mjs 의 ERROR_DEFAULTS 와 일치해야 한다.
//
// 사용 예 (ut.config.mjs 의 scenario.run 안):
//   import { checkAboveFoldCTA, checkDestructiveConfirm } from './ut-heuristics.mjs';
//   const v = await checkAboveFoldCTA(persona, 'button.cta');
//   if (v) rec(v);

/** 핵심 CTA가 스크롤 없이 현재 fold 안에 보이는가 (N7). persona.isAboveFold 사용. */
export async function checkAboveFoldCTA(persona, selector, { label } = {}) {
  const r = await persona.isAboveFold(selector).catch(() => null);
  if (!r || !r.visible) return null; // 요소 부재는 이 검출기 범위 밖
  if (r.aboveFold) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'cta-below-fold', heuristic: 'N7', severityHint: 'S3',
    note: `핵심 CTA(${label || selector})가 fold 밖 — y=${r.y}, viewport=${r.viewportHeight}. 스크롤 없이는 보이지 않음`,
  };
}

/** 핵심 액션이 키보드(Tab)만으로 도달 가능한가 (N7). persona.tabTo 사용. */
export async function checkKeyboardReachable(persona, predicate, { label, maxTabs = 40 } = {}) {
  const r = await persona.tabTo(predicate, maxTabs).catch(() => ({ reached: false, steps: 0 }));
  if (r.reached) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'primary-not-tab-reachable', heuristic: 'N7', severityHint: 'S4',
    note: `핵심 액션(${label || 'target'})에 키보드 Tab 으로 도달 불가 — ${r.steps}회 순회 후 미도달`,
  };
}

/** 파괴적 액션 트리거 후 확인 절차(다이얼로그 등)가 뜨는가 (N5). */
export async function checkDestructiveConfirm(page, persona, triggerSelector, confirmSelector, { label, timeoutMs = 800 } = {}) {
  const act = await persona.activate(triggerSelector, { label }).catch(() => ({ ok: false }));
  if (!act.ok) return null; // 트리거 자체 실패는 다른 검출기 범위
  // isVisible() 은 auto-wait 하지 않는다 — checkLoadingFeedback 과 동일하게 waitFor 로 렌더 지연을 흡수한다.
  const hasConfirm = await page.locator(confirmSelector).first()
    .waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true).catch(() => false);
  if (hasConfirm) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'destructive-no-confirm', heuristic: 'N5', severityHint: 'S3',
    note: `파괴적 액션(${label || triggerSelector}) 실행에 확인 절차(${confirmSelector}) 없음 — 되돌리기 어려운 행동이 즉시 수행됨`,
  };
}

/** 잘못된 입력 제출 시 인라인 오류 메시지(복구 안내)가 표시되는가 (N9). */
export async function checkFormErrorRecovery(page, persona, submitSelector, errorSelector, { label, timeoutMs = 800 } = {}) {
  await persona.activate(submitSelector, { label }).catch(() => {});
  // isVisible() 은 auto-wait 하지 않는다 — checkLoadingFeedback 과 동일하게 waitFor 로 렌더 지연을 흡수한다.
  const hasError = await page.locator(errorSelector).first()
    .waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true).catch(() => false);
  if (hasError) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'form-error-no-recovery', heuristic: 'N9', severityHint: 'S3',
    note: `잘못된 입력 제출 후 인라인 오류 안내(${errorSelector}) 미표시 — 사용자가 원인/해결책을 알 수 없음`,
  };
}

/** 액션 후 지정 시간 내 로딩/피드백 표시가 나타나는가 (N1). */
export async function checkLoadingFeedback(page, persona, actionSelector, feedbackSelector, { label, timeoutMs = 800 } = {}) {
  await persona.activate(actionSelector, { label }).catch(() => {});
  const appeared = await page.locator(feedbackSelector).first()
    .waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true).catch(() => false);
  if (appeared) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'no-loading-indicator', heuristic: 'N1', severityHint: 'S3',
    note: `액션(${label || actionSelector}) 후 ${timeoutMs}ms 내 피드백(${feedbackSelector}) 미표시 — 시스템 상태 불명`,
  };
}

/** 같은 의미의 컨트롤이 화면 간 일관된 라벨을 쓰는가 (N4). labels 배열의 고유값이 1개여야 일관. */
export function checkControlConsistency(labels, { control } = {}) {
  const uniq = [...new Set((labels || []).map((s) => (s || '').trim()).filter(Boolean))];
  if (uniq.length <= 1) return null;
  return {
    action: 'heuristic-check', completed: false, isError: true,
    errorType: 'inconsistent-control', heuristic: 'N4', severityHint: 'S2',
    note: `동일 기능(${control || 'control'})의 라벨 불일치 — ${uniq.map((s) => `"${s}"`).join(' / ')}`,
  };
}

export const HEURISTIC_DETECTORS = {
  checkAboveFoldCTA,
  checkKeyboardReachable,
  checkDestructiveConfirm,
  checkFormErrorRecovery,
  checkLoadingFeedback,
  checkControlConsistency,
};

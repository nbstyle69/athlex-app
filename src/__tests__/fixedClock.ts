// Fige Date (Date.now, new Date()) sur une date fixe ; les minuteurs restent réels.
const REAL_TIMERS = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
  'setTimeout', 'clearTimeout',
] as const;

export const FIXED_NOW = new Date('2026-09-28T10:00:00Z');

export function freezeDate(now: Date = FIXED_NOW) {
  jest.useFakeTimers({ now, doNotFake: [...REAL_TIMERS] });
}

export const DEFAULT_QA_WORLD = 'visioner-qa';

export function assertQaWorld(actual, expected = DEFAULT_QA_WORLD) {
  if (!actual || actual !== expected) {
    throw Error(`Refusing live tests outside disposable world "${expected}" (current: ${actual || 'unknown'})`);
  }
}


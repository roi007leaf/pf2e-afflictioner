export function casePassed(result) {
  return result?.status === 'passed' && result.mode === 'automated' &&
    Array.isArray(result.steps) && result.steps.length > 0 &&
    result.steps.every(step => step.status === 'passed' && Array.isArray(step.assertions) &&
      step.assertions.length > 0 && step.assertions.every(assertion => assertion.status === 'passed'));
}

export function coverageFor(required, results) {
  const byName = new Map(results.map(result => [result.name, result]));
  return {
    required: required.length,
    passed: required.filter(testCase => casePassed(byName.get(testCase.name))).map(testCase => testCase.name),
    failed: required.filter(testCase => byName.has(testCase.name) && !casePassed(byName.get(testCase.name))).map(testCase => testCase.name),
    unrun: required.filter(testCase => !byName.has(testCase.name)).map(testCase => testCase.name),
  };
}

export function validateCases(cases) {
  const names = new Set();
  for (const testCase of cases) {
    if (!/^[a-z0-9-]+$/.test(testCase.name) || names.has(testCase.name)) {
      throw Error(`Invalid or duplicate case: ${testCase.name}`);
    }
    names.add(testCase.name);
    if (!testCase.disposableWorld) throw Error(`Live case must require disposable world: ${testCase.name}`);
    if (!Array.isArray(testCase.steps) || !testCase.steps.length ||
        testCase.steps.some(step => !step.workflow || step.review !== undefined)) {
      throw Error(`Case needs automated workflow assertions: ${testCase.name}`);
    }
  }
}


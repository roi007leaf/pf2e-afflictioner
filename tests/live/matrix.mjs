import { readFile } from 'node:fs/promises';
import { fullCases } from './cases.mjs';
import { assessMatrix, sourceFingerprint } from './evidence.mjs';
import { assessRequirements } from './requirements.mjs';

const files = process.argv.slice(2);
if (!files.length) throw Error('Provide report.json path from local Foundry 14/PF2e run. No world is started or modified.');
const reports = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
const result = assessMatrix(fullCases, reports, await sourceFingerprint());
result.missingImplementations = assessRequirements(fullCases, []).details.flatMap(item => item.missing);
result.complete &&= result.missingImplementations.length === 0;
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.complete ? 0 : 1;


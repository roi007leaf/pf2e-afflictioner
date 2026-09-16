import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { casePassed } from './coverage.mjs';

export async function sourceFingerprint() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:js|mjs|hbs|css)$/.test(entry.name)) files.push(file);
    }
  }
  for (const directory of ['scripts', 'templates', 'styles', 'tests/live']) await walk(directory);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0');
  return hash.digest('hex');
}

export function assessMatrix(catalog, reports, fingerprint) {
  const names = catalog.map(testCase => testCase.name);
  const invalid = [];
  for (const report of reports) {
    if (report.sourceFingerprint !== fingerprint) invalid.push(`${report.runId ?? 'unknown'}: source fingerprint mismatch`);
    if (report.cleanup !== 'complete') invalid.push(`${report.runId ?? 'unknown'}: cleanup incomplete`);
    if (report.error || report.startupErrors?.length) invalid.push(`${report.runId ?? 'unknown'}: run errors present`);
  }
  const byName = new Map(reports.flatMap(report => report.cases ?? []).map(result => [result.name, result]));
  const missing = names.filter(name => !casePassed(byName.get(name)));
  return { complete: reports.length > 0 && !invalid.length && !missing.length, reports: reports.length, missing, invalid };
}

// scripts/checkRtl.mjs — fails on physical Tailwind direction utilities.
// Logical utilities (ms-/me-/ps-/pe-/text-start/text-end/start-/end-) mirror
// automatically under `<html dir="rtl">`; physical ones (ml-/mr-/pl-/pr-/
// left-/right-/text-left/text-right) do not. See docs/superpowers/plans/
// 2026-09-10-rtl-layout-polish.md Task 15.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const RE_UTIL = /className="[^"]*\b(ml|mr|pl|pr|left|right)-[0-9[]/;
const RE_TEXT = /\btext-(left|right)\b/;
const roots = ['src/components', 'src/app'];
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(t|j)sx?$/.test(name)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (RE_UTIL.test(line) || RE_TEXT.test(line)) {
        offenders.push(`${p}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}
roots.forEach(walk);

if (offenders.length) {
  console.error('Physical Tailwind direction utilities (use ms-/me-/ps-/pe-/text-start/text-end/start-/end-):');
  offenders.forEach(o => console.error('  ' + o));
  process.exit(1);
}
console.log('rtl:check ok');

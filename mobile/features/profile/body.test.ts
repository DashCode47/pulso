// Run: node --experimental-strip-types features/profile/body.test.ts
import assert from 'node:assert';
import { bmi, chartPoints, localDate, parseDecimal } from './body.ts';

assert.strictEqual(bmi(70, 175), 22.9);
assert.strictEqual(bmi(84, 180), 25.9);

assert.strictEqual(parseDecimal('72,5', 25, 300), 72.5);
assert.strictEqual(parseDecimal(' 80 ', 25, 300), 80);
assert.strictEqual(parseDecimal('', 25, 300), null);
assert.strictEqual(parseDecimal('abc', 25, 300), null);
assert.strictEqual(parseDecimal('10', 25, 300), null);

const pts = chartPoints([80, 75, 70], 116, 66);
assert.deepStrictEqual(pts[0], [8, 8]); // heaviest at the top
assert.deepStrictEqual(pts[2], [108, 58]); // lightest at the bottom
assert.deepStrictEqual(chartPoints([70, 70], 100, 40).map((p) => p[1]), [20, 20]);

assert.strictEqual(localDate(new Date(2026, 0, 5)), '2026-01-05');
console.log('body ok');

// Run: node --experimental-strip-types features/schedule/week.test.ts
import assert from 'node:assert';
import { addDays, bogotaDate, bogotaInstant, mondayOf } from './week.ts';

assert.equal(mondayOf('2026-10-01'), '2026-09-28'); // Thu
assert.equal(mondayOf('2026-10-04'), '2026-09-28'); // Sun belongs to the week before
assert.equal(mondayOf('2026-10-05'), '2026-10-05'); // Mon
assert.equal(addDays('2026-12-29', 7), '2027-01-05');
assert.equal(bogotaInstant('2026-10-05', '07:00').toISOString(), '2026-10-05T12:00:00.000Z');
assert.equal(bogotaDate('2026-10-06T02:30:00Z'), '2026-10-05'); // 21:30 Bogota stays on its day
assert.equal(bogotaDate('2026-10-05T05:00:00Z'), '2026-10-05'); // Bogota midnight

console.log('week ok');

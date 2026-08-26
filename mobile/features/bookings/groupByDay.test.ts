// Run: node --experimental-strip-types features/bookings/groupByDay.test.ts
import assert from 'node:assert';
import { groupClassesByDay } from './groupByDay.ts';

const now = new Date('2026-08-26T12:00:00Z');
const classes = [
  { id: 'a', startsAt: '2026-08-26T19:00:00Z' },
  { id: 'b', startsAt: '2026-08-26T07:00:00Z' },
  { id: 'c', startsAt: '2026-08-27T07:00:00Z' },
  { id: 'd', startsAt: '2026-08-30T07:00:00Z' },
];

const days = groupClassesByDay(classes, now);

assert.strictEqual(days.length, 3, 'expected 3 day groups');
assert.strictEqual(days[0].label, 'Hoy');
assert.strictEqual(days[0].classes.length, 2);
assert.strictEqual(days[1].label, 'Mañana');
assert.strictEqual(days[2].classes[0].id, 'd');
assert.strictEqual(groupClassesByDay([], now).length, 0);

console.log('groupByDay: ok');

// Run: node --experimental-strip-types features/bookings/groupByDay.test.ts
import assert from 'node:assert';
import { groupClassesByDay, groupClassesByWeekday } from './groupByDay.ts';

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

// Weekday view: Wed 26 Aug -> Mon 24..Sat 29; Sunday 30 is outside the week.
const week = groupClassesByWeekday(classes, new Date(2026, 7, 26, 12));
assert.deepStrictEqual(week.map((d) => d.label), ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
assert.strictEqual(week[0].key, '2026-08-24');
assert.strictEqual(week.reduce((n, d) => n + d.classes.length, 0), 3);
// Saturday still shows the current week; Sunday switches to next week.
assert.strictEqual(groupClassesByWeekday([], new Date(2026, 7, 29, 12))[0].key, '2026-08-24');
assert.strictEqual(groupClassesByWeekday([], new Date(2026, 7, 30, 12))[0].key, '2026-08-31');

console.log('groupByDay: ok');

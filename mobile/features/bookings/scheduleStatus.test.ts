// Run: node --experimental-strip-types features/bookings/scheduleStatus.test.ts
import assert from 'node:assert';
import { scheduleStatus, upcomingSunday } from './scheduleStatus.ts';

// Week of Mon 28 Sep – Sat 3 Oct 2026; Sunday 4 Oct closes it.
const wed = new Date(2026, 8, 30, 12);
const fri = new Date(2026, 9, 2, 20);
const sun = new Date(2026, 9, 4, 10);
const friClass = { startsAt: new Date(2026, 9, 2, 7).toISOString(), started: true };
const sat = { startsAt: new Date(2026, 9, 3, 9).toISOString(), started: false };
const nextMon = { startsAt: new Date(2026, 9, 5, 7).toISOString(), started: false };

assert.strictEqual(upcomingSunday(wed).getDate(), 4);
assert.strictEqual(upcomingSunday(sun).getDate(), 4);

// Loading: no notice.
assert.strictEqual(scheduleStatus([], undefined, wed), 'open');
// Classes left this week.
assert.strictEqual(scheduleStatus([sat], '2026-10-04', wed), 'open');
// Current week not published yet.
assert.strictEqual(scheduleStatus([], '2026-09-27', wed), 'thisWeekPending');
// Friday after the last class: next week not up yet...
assert.strictEqual(scheduleStatus([friClass], '2026-10-04', fri), 'nextWeekPending');
// ...or already published early (classes of next week don't count as "left").
assert.strictEqual(scheduleStatus([friClass, nextMon], '2026-10-11', fri), 'nextWeekOpen');
// Sunday depends only on the publish date.
assert.strictEqual(scheduleStatus([], '2026-10-04', sun), 'nextWeekPending');
assert.strictEqual(scheduleStatus([nextMon], '2026-10-11', sun), 'nextWeekOpen');

console.log('scheduleStatus: ok');

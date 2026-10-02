// Run: node --experimental-strip-types features/bookings/errorMessages.test.ts
import assert from 'node:assert';
import { membershipBlockMessage } from './errorMessages.ts';

const today = '2026-10-01';

assert.strictEqual(membershipBlockMessage(undefined, today), null, 'loading never blocks');
assert.strictEqual(membershipBlockMessage({ status: 'active', cycleEnd: today }, today), null, 'last day still valid');
assert.match(membershipBlockMessage(null, today)!, /No tienes/);
assert.match(membershipBlockMessage({ status: 'active', cycleEnd: '2026-09-30' }, today)!, /venció/, 'lapsed before cron runs');
assert.match(membershipBlockMessage({ status: 'expired', cycleEnd: '2026-09-30' }, today)!, /venció/);
assert.match(membershipBlockMessage({ status: 'cancelled', cycleEnd: '2026-12-01' }, today)!, /cancelada/);

console.log('membershipBlockMessage: ok');

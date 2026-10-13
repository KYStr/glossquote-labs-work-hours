import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorksheet, localToday } from '../public/js/state.mjs';
import { copy, errorText } from '../public/js/i18n.mjs';

const fresh = (locale = 'en') => createWorksheet(locale, () => '2026-10-13');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('FR01 default has one empty interval, local today, zero break; caller cannot mutate drafts', () => {
  const state = fresh();
  assert.deepEqual(state.view().draftRows, [{ date: '2026-10-13', start: '', end: '', nextDay: false, breakMinutes: '0' }]);
  state.view().draftRows[0].start = '09:00'; assert.equal(state.view().draftRows[0].start, '');
  assert.equal(localToday(new Date(1999, 0, 1)), ''); assert.equal(localToday(new Date(2100, 0, 1)), '');
  assert.equal(localToday(new Date(2026, 9, 13)), '2026-10-13');
});
test('W23 add inherits only valid date, at least one and at most 62, example requires calculation', () => {
  const state = fresh(); assert.equal(state.remove(0), false);
  state.edit(0, 'date', '\t2024-02-29 '); state.add(); assert.equal(state.view().draftRows[1].date, '2024-02-29');
  state.edit(1, 'date', '2023-02-29'); state.add(); assert.equal(state.view().draftRows[2].date, '2026-10-13');
  for (let i = 3; i < 62; i++) assert.equal(state.add(), true);
  assert.equal(state.add(), false); assert.equal(state.view().draftRows.length, 62);
  state.loadExample(); assert.equal(state.view().result, null); assert.equal(state.view().example, true); assert.equal(state.view().notice, 'example');
  assert.equal(state.calculate().totalMinutes, 450);
  state.reset(); assert.equal(state.view().draftRows.length, 1); assert.equal(state.view().draftRows[0].start, ''); assert.equal(state.report(), '');
});
test('W24 any field, checkbox, add, remove or example invalidates result and copy state immediately', async () => {
  const actions = [
    (s) => s.edit(0, 'date', '2026-10-02'), (s) => s.edit(0, 'start', '10:00'), (s) => s.edit(0, 'end', '10:30'),
    (s) => s.edit(0, 'nextDay', true), (s) => s.edit(0, 'breakMinutes', '5'), (s) => s.add(), (s) => s.remove(0), (s) => s.loadExample()
  ];
  for (const action of actions) {
    const state = fresh(); state.loadExample(); state.calculate(); await state.copy(async () => {});
    const revision = state.view().revision; action(state);
    assert.equal(state.view().result, null); assert.equal(state.report(), ''); assert.equal(state.view().copyStatus, 'idle'); assert.ok(state.view().revision > revision);
  }
});
test('invalid input preserves the complete raw draft and clears prior output', () => {
  const state = fresh(); state.loadExample(); state.calculate();
  state.edit(0, 'start', '9:00'); const snapshot = state.view().draftRows;
  assert.equal(state.calculate().ok, false); assert.deepEqual(state.view().draftRows, snapshot); assert.equal(state.report(), '');
  assert.equal(state.view().errors[0].code, 'TIME_FORMAT');
});
test('W25 clipboard rejection/missing API retains identical selectable report', async () => {
  const state = fresh(); state.loadExample(); state.calculate(); const report = state.report(); let received;
  assert.equal(await state.copy(async (value) => { received = value; }), true);
  assert.equal(received, report); assert.equal(state.view().copyStatus, 'copied');
  assert.equal(await state.copy(async () => { throw new Error('Fake permission rejection'); }), false);
  assert.equal(state.view().copyStatus, 'copyFailed'); assert.equal(state.report(), report);
  assert.equal(await state.copy(undefined), false); assert.equal(state.view().copyStatus, 'copyFailed');
});
test('W25 late clipboard success/failure after clear/edit/pagehide cannot restore status or report', async () => {
  for (const invalidate of [(s) => s.reset(), (s) => s.edit(0, 'start', '10:00'), (s) => s.pagehide()]) {
    for (const settles of ['resolve', 'reject']) {
      const state = fresh(); state.loadExample(); state.calculate(); const pending = deferred();
      const copying = state.copy(() => pending.promise); assert.equal(state.view().copyStatus, 'copying');
      invalidate(state); pending[settles](new Error('Fake')); assert.equal(await copying, false);
      assert.equal(state.report(), ''); assert.equal(state.view().copyStatus, 'idle'); assert.equal(state.view().result, null);
    }
  }
});
test('W26 two copies settling in reverse order: latest request owns status', async () => {
  for (const latest of ['resolve', 'reject']) {
    const state = fresh(); state.loadExample(); state.calculate(); const first = deferred(), second = deferred();
    const a = state.copy(() => first.promise), b = state.copy(() => second.promise);
    second[latest](new Error('Fake')); await b; const expected = latest === 'resolve' ? 'copied' : 'copyFailed';
    first[latest === 'resolve' ? 'reject' : 'resolve'](new Error('Fake')); await a;
    assert.equal(state.view().copyStatus, expected);
  }
});
test('W27 pagehide removes drafts; pageshow/reset starts empty instead of restoring old times', () => {
  const state = fresh(); state.loadExample(); state.calculate(); state.pagehide();
  assert.deepEqual(state.view().draftRows, []); assert.equal(state.report(), '');
  state.reset(); assert.deepEqual(state.view().draftRows, [{ date: '2026-10-13', start: '', end: '', nextDay: false, breakMinutes: '0' }]);
});
test('both locales expose equivalent error keys and original overlap row numbers', () => {
  assert.deepEqual(Object.keys(copy.en.errors).sort(), Object.keys(copy['zh-Hant'].errors).sort());
  assert.equal(errorText({ code: 'ROW_OVERLAP', rowIndexes: [0, 2] }, 'en'), 'Entries 1 and 3 overlap. Correct them to avoid counting time twice.');
  assert.equal(errorText({ code: 'ROW_OVERLAP', rowIndexes: [0, 2] }, 'zh-Hant'), '時段 1 與時段 3 重疊，請修正，避免重複計入。');
});

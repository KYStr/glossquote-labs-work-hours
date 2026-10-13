import { createWorksheet } from './state.mjs';
import { copy, errorText } from './i18n.mjs';
import { formatDuration, formatDecimalHours, MAX_ROWS } from './core/work-hours.mjs';

const locale = document.documentElement.lang;
const text = copy[locale];
const worksheet = createWorksheet(locale);
const byId = (id) => document.getElementById(id);
const rowsElement = byId('entries');
const resultElement = byId('results');
const statusElement = byId('status');
const errorsElement = byId('errors');
const copyButton = byId('copy');
const reportElement = byId('report');

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function renderRows() {
  const view = worksheet.view();
  rowsElement.replaceChildren();
  view.draftRows.forEach((row, index) => {
    const fieldset = element('fieldset', undefined, 'entry');
    fieldset.append(element('legend', `${text.entry} ${index + 1}`));
    const grid = element('div', undefined, 'entry-grid');
    for (const field of ['date', 'start', 'end', 'nextDay', 'breakMinutes']) {
      const wrapper = element('div', undefined, `field field-${field}`);
      const id = `entry-${index}-${field}`;
      const label = element('label', text.fields[field]);
      label.htmlFor = id;
      const input = element('input');
      input.id = id;
      input.name = field;
      input.type = field === 'nextDay' ? 'checkbox' : 'text';
      input.setAttribute('aria-label', `${text.entry} ${index + 1}: ${text.fields[field]}`);
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (field === 'nextDay') {
        input.checked = row.nextDay;
        wrapper.classList.add('checkbox-field');
        label.prepend(input);
        wrapper.append(label);
      } else {
        input.inputMode = field === 'breakMinutes' ? 'numeric' : 'text';
        input.value = row[field];
        input.setAttribute('autocapitalize', 'off');
        const hint = element('small', field === 'date' ? text.dateHint : field === 'breakMinutes' ? text.breakHint : text.timeHint);
        hint.id = `${id}-hint`;
        input.setAttribute('aria-describedby', hint.id);
        wrapper.append(label, input, hint);
      }
      const error = element('p', '', 'field-error');
      error.id = `${id}-error`;
      error.hidden = true;
      wrapper.append(error);
      input.addEventListener(field === 'nextDay' ? 'change' : 'input', () => {
        worksheet.edit(index, field, field === 'nextDay' ? input.checked : input.value);
        renderFeedback();
      });
      grid.append(wrapper);
    }
    const remove = element('button', text.remove, 'button quiet remove');
    remove.type = 'button';
    remove.disabled = view.draftRows.length === 1;
    remove.setAttribute('aria-label', `${text.remove} ${text.entry} ${index + 1}`);
    remove.addEventListener('click', () => {
      if (!worksheet.remove(index)) return;
      renderRows(); renderFeedback();
      byId(`entry-${Math.min(index, worksheet.view().draftRows.length - 1)}-date`).focus();
    });
    grid.append(remove);
    fieldset.append(grid);
    rowsElement.append(fieldset);
  });
  byId('add').disabled = view.draftRows.length >= MAX_ROWS;
  setText(byId('row-count'), `${view.draftRows.length} ${text.rowCount}`);
}

function clearFieldErrors() {
  for (const input of rowsElement.querySelectorAll('input')) {
    input.removeAttribute('aria-invalid');
    const hint = byId(`${input.id}-hint`);
    if (hint) input.setAttribute('aria-describedby', hint.id);
    else input.removeAttribute('aria-describedby');
    const error = byId(`${input.id}-error`);
    error.hidden = true;
    error.textContent = '';
  }
}

function markError(index, field, message) {
  const input = byId(`entry-${index}-${field === 'row' ? 'date' : field}`);
  if (!input) return;
  const error = byId(`${input.id}-error`);
  error.textContent = message;
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', [byId(`${input.id}-hint`)?.id, error.id].filter(Boolean).join(' '));
}

function table(headers, values) {
  const container = element('div', undefined, 'table-region');
  container.tabIndex = 0;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', headers.join(' / '));
  const node = element('table');
  const head = element('thead');
  const header = element('tr');
  for (const title of headers) {
    const th = element('th', title); th.scope = 'col'; header.append(th);
  }
  head.append(header);
  const body = element('tbody');
  for (const valuesRow of values) {
    const tr = element('tr');
    for (const value of valuesRow) tr.append(element('td', value));
    body.append(tr);
  }
  node.append(head, body); container.append(node);
  return container;
}

function renderFeedback() {
  const view = worksheet.view();
  clearFieldErrors();
  errorsElement.replaceChildren();
  errorsElement.hidden = view.errors.length === 0;
  if (view.errors.length) {
    const list = element('ul');
    for (const error of view.errors) {
      const message = errorText(error, locale);
      const item = element('li');
      const indexes = error.rowIndexes ?? [error.rowIndex];
      const field = error.code === 'ROW_OVERLAP' ? 'start' : error.field;
      indexes.filter((index) => index !== undefined).forEach((index) => markError(index, field, message));
      if (indexes[0] !== undefined) {
        const target = `entry-${indexes[0]}-${field === 'row' ? 'date' : field}`;
        const link = element('a', message); link.href = `#${target}`;
        link.addEventListener('click', (event) => { event.preventDefault(); byId(target)?.focus(); });
        item.append(link);
      } else item.textContent = message;
      list.append(item);
    }
    errorsElement.append(list);
  }
  const notice = view.notice === 'success' ? `${text.success} ${formatDuration(view.result.totalMinutes, locale)} (${view.result.totalDecimalHours} ${text.decimalUnit}).` : text[view.notice];
  setText(statusElement, notice);
  resultElement.hidden = !view.result;
  byId('result-details').replaceChildren();
  byId('total-duration').textContent = '';
  byId('total-decimal').textContent = '';
  byId('total-minutes').textContent = '';
  reportElement.value = '';
  if (view.result) {
    const result = view.result;
    byId('total-duration').textContent = formatDuration(result.totalMinutes, locale);
    byId('total-decimal').textContent = `${result.totalDecimalHours} ${text.decimalUnit}`;
    byId('total-minutes').textContent = `${result.totalMinutes} ${text.minuteUnit}`;
    const details = byId('result-details');
    details.append(element('h3', text.daily), table([text.date, text.duration, text.decimal], result.days.map((day) => [day.date, formatDuration(day.netMinutes, locale), formatDecimalHours(day.netMinutes)])));
    details.append(element('h3', text.details), table([text.entry, text.date, text.period, text.gross, text.rest, text.net], result.rows.map((row) => [
      String(row.sourceIndex + 1), row.date, `${row.start} → ${row.end} (${row.nextDay ? text.nextDay : text.sameDay})`,
      `${row.grossMinutes} ${text.minuteUnit} / ${formatDuration(row.grossMinutes, locale)}`,
      `${row.breakMinutes} ${text.minuteUnit} / ${formatDuration(row.breakMinutes, locale)}`,
      `${row.netMinutes} ${text.minuteUnit} / ${formatDuration(row.netMinutes, locale)}`
    ])));
    reportElement.value = worksheet.report();
  }
  copyButton.disabled = !view.result || view.copyStatus === 'copying';
  copyButton.setAttribute('aria-busy', String(view.copyStatus === 'copying'));
  setText(byId('copy-status'), view.copyStatus === 'idle' ? '' : text[view.copyStatus]);
}

byId('worksheet').addEventListener('submit', (event) => {
  event.preventDefault();
  const result = worksheet.calculate();
  renderFeedback();
  if (!result.ok) rowsElement.querySelector('[aria-invalid="true"]')?.focus();
});
byId('add').addEventListener('click', () => {
  if (!worksheet.add()) return;
  renderRows(); renderFeedback();
  byId(`entry-${worksheet.view().draftRows.length - 1}-date`).focus();
});
byId('clear').addEventListener('click', () => {
  worksheet.reset(); renderRows(); renderFeedback(); byId('entry-0-date').focus();
});
byId('example').addEventListener('click', () => {
  worksheet.loadExample(); renderRows(); renderFeedback(); byId('entry-0-start').focus();
});
copyButton.addEventListener('click', async () => {
  const write = navigator.clipboard?.writeText ? (report) => navigator.clipboard.writeText(report) : undefined;
  const pending = worksheet.copy(write);
  // Busy feedback is synchronous; the only asynchronous work is this user-initiated copy.
  copyButton.disabled = true;
  copyButton.setAttribute('aria-busy', 'true');
  setText(byId('copy-status'), text.copying);
  await pending;
  const view = worksheet.view();
  copyButton.disabled = !view.result || view.copyStatus === 'copying';
  copyButton.setAttribute('aria-busy', String(view.copyStatus === 'copying'));
  setText(byId('copy-status'), view.copyStatus === 'idle' ? '' : text[view.copyStatus]);
});
window.addEventListener('pagehide', () => {
  worksheet.pagehide();
  rowsElement.replaceChildren();
  renderFeedback();
});
window.addEventListener('pageshow', () => {
  worksheet.reset(); renderRows(); renderFeedback();
});
renderRows();
renderFeedback();

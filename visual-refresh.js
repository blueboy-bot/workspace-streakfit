// Presentation only: leave plans, submitted logs, units and rewards untouched.
const visualSettings = document.querySelector('#appearance-dialog');
document.querySelector('#appearance-open')?.addEventListener('click', () => visualSettings.showModal());
document.querySelector('[data-close-appearance]')?.addEventListener('click', () => visualSettings.close());
document.querySelector('[data-open-privacy]')?.addEventListener('click', () => {visualSettings.showModal();const details=document.querySelector('#privacy-settings');details.open=true;details.querySelector('summary').focus();});
document.querySelector('[data-header-home]')?.addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('nav [data-page="today"]')?.click();
});
visualSettings?.addEventListener('click', event => {
  if (event.target.closest('#profile,#account-entry')) visualSettings.close();
});

function refreshTrainingPresentation() {
  for (const reminder of document.querySelectorAll('.backup-reminder')) {
    if (reminder.dataset.visualReady) continue;
    reminder.dataset.visualReady = 'true';
    const heading = reminder.querySelector('b');
    if (!heading) continue;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.append(heading);
    const children = [...reminder.childNodes];
    details.append(summary);
    for (const child of children) details.append(child);
    reminder.append(details);
  }
  const visualTaskPaths = [
    '<path d="M5 3v6M8 3v6M3 6h7M6.5 9v12M17 3c-3 3-3 7 0 8v10M17 3v8"/>',
    '<path d="M12 3c-3 4-7 8-7 12a7 7 0 0 0 14 0c0-4-4-8-7-12zM8 15c0 2 1 3 3 3"/>',
    '<path d="M20 14a8 8 0 0 1-10-10A8.5 8.5 0 1 0 20 14z"/>',
    '<path d="M20 4c-9 0-15 4-15 9a6 6 0 0 0 6 6c5 0 9-6 9-15zM4 21l11-11"/>'
  ];
  for (const [index, icon] of [...document.querySelectorAll('.task .icon')].entries()) {
    if (icon.dataset.visualReady) continue;
    icon.dataset.visualReady = 'true';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+visualTaskPaths[index % 4]+'</svg>';
  }
  for (const card of document.querySelectorAll('.workout-card')) {
    if (card.dataset.visualReady) continue;
    card.dataset.visualReady = 'true';
    const record = card.querySelector('[data-log],[data-log-cardio],[data-log-mobility]');
    const undo = card.querySelector('[data-remove-log]');
    if (record) {
      const actions = document.createElement('div');
      actions.className = 'record-actions';
      record.before(actions);
      actions.append(record);
      if (undo) actions.append(undo);
    }
    const rows = [...card.querySelectorAll(':scope > .set-row')];
    if (rows.length) {
      const list = document.createElement('details');
      list.className = 'recorded-sets';
      const summary = document.createElement('summary');
      summary.textContent = document.documentElement.lang==='en'?'Set details · '+rows.length:'组明细 · '+rows.length;
      list.append(summary);
      rows[0].before(list);
      for (const row of rows) list.append(row);
    }
  }
}
const visualContent = document.querySelector('#content');
if (visualContent) {
  new MutationObserver(refreshTrainingPresentation).observe(visualContent, {childList: true, subtree: true});
  refreshTrainingPresentation();
}

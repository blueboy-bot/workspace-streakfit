// Presentation only: leave plans, submitted logs, units and rewards untouched.
const visualSettings = document.querySelector('#appearance-dialog');
document.querySelector('#appearance-open')?.addEventListener('click', () => visualSettings.showModal());
document.querySelector('[data-close-appearance]')?.addEventListener('click', () => visualSettings.close());
document.querySelector('[data-open-privacy]')?.addEventListener('click', () => {visualSettings.showModal();const details=document.querySelector('#privacy-settings');details.open=false;details.querySelector('summary').focus();});
document.querySelector('[data-header-home]')?.addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('nav [data-page="today"]')?.click();
});
visualSettings?.addEventListener('click', event => {
  if (event.target.closest('#profile,#account-entry')) visualSettings.close();
});

const expandedRecordingOptions = new Map();
function refreshTrainingPresentation() {
  document.body.classList.toggle('training-focus',!!document.querySelector('.session-mode'));
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
    if (card.closest('.session-mode')) {
      const step=card.querySelector('.session-step-actions>button'),actions=card.querySelector('.record-actions');
      if(step&&actions){if(undo)undo.remove();actions.append(step);actions.classList.add('record-actions-paired');const status=card.querySelector('.record-status');if(undo||status){const utilities=document.createElement('div');utilities.className='record-utilities';actions.after(utilities);if(status)utilities.append(status);if(undo)utilities.append(undo);}}

      const title=card.querySelector('.exercise-heading h3');
      if(title&&document.documentElement.lang!=='en')title.textContent=title.textContent.split(' · ')[0].replace(/\s*▷$/, '')+' ▷';
      const id=record?.dataset.log||record?.dataset.logCardio||record?.dataset.logMobility;
      card.querySelector('.exercise-recovery')?.remove();
      card.querySelector('.load-comparison')?.remove();
      const goal=card.querySelector('.exercise-goal>span:first-child');if(goal)goal.textContent=goal.textContent.replace(/^目标\s*/, '');
      const count=card.querySelector('.workout-progress-visual>span:last-child');if(count)count.classList.add('sr-only');
      const weight=card.querySelector('input[id^="weight-"]');
      if(weight){const label=weight.closest('label'),description=weight.getAttribute('aria-label')||'',unit=description.match(/\((kg|lb)\)/)?.[1]||'kg';
        for(const child of [...label.childNodes])if(child.nodeType===3)child.remove();
        label.classList.add('inline-weight');weight.placeholder=description.includes('辅助')?'辅助重量':description.includes('单只')?'单只重量':'重量';
        const suffix=document.createElement('span');suffix.className='input-unit';suffix.textContent=description.includes('单只')?unit+'/只':description.includes('辅助')?'辅助 '+unit:unit;label.classList.toggle('qualified-weight',description.includes('单只')||description.includes('辅助')); suffix.setAttribute('aria-hidden','true');label.append(suffix);
      }
      const reps=card.querySelector('.reps-picker');if(reps){const label=reps.closest('label'),perSide=label.textContent.includes('侧');for(const child of [...label.childNodes])if(child.nodeType===3)child.remove();const unit=document.createElement('span');unit.className='reps-unit';unit.textContent=perSide?'次/侧':'次';unit.setAttribute('aria-hidden','true');reps.append(unit);}

      const more=document.createElement('details');more.className='session-more';more.dataset.exerciseId=id||'';
      more.open=expandedRecordingOptions.get(id)===true;
      const heading=document.createElement('summary');heading.textContent=document.documentElement.lang==='en'?'Sets':'组记录';more.append(heading);
      const setup=card.querySelector('.strength-input input[id^="setup-"]')?.closest('label');
      if(setup&&!setup.textContent.includes('弹力带'))setup.remove();
      if(card.querySelectorAll('.strength-input>label').length===1)card.querySelector('.strength-input')?.classList.add('record-single');
      card.querySelector('.exercise-details')?.remove();
      for(const node of card.querySelectorAll('.recorded-sets'))more.append(node);
      if(more.children.length>1)card.append(more);
      if(undo){undo.setAttribute('aria-label',document.documentElement.lang==='en'?'Undo last set':'撤回最后一组');undo.textContent=document.documentElement.lang==='en'?'Undo':'撤回';}
    }
  }
  for(const session of document.querySelectorAll('.session-mode')){
    if(session.dataset.compactReady)continue;session.dataset.compactReady='true';
    const timer=session.querySelector('.rest-circular'),navigation=session.querySelector('.session-navigation');
    if(timer&&navigation)navigation.before(timer);
    const tools=document.createElement('details');tools.className='session-tools';
    const summary=document.createElement('summary');summary.textContent='•••';summary.setAttribute('aria-label',document.documentElement.lang==='en'?'Training menu':'训练菜单');tools.append(summary);
    const position=session.querySelector('.session-position');if(position){const top=document.createElement('div');top.className='session-topline';position.before(top);top.append(position,tools);}
    for(const nav of [...session.querySelectorAll('.session-navigation')])tools.append(nav);
    const sets=session.querySelector('.session-more');if(sets)tools.append(sets);
    session.querySelector('.session-title')?.remove();

  }
}
const visualContent = document.querySelector('#content');
if (visualContent) {
  visualContent.addEventListener('toggle',event=>{if(event.target.matches?.('details.session-more'))expandedRecordingOptions.set(event.target.dataset.exerciseId,event.target.open);},true);
  new MutationObserver(refreshTrainingPresentation).observe(visualContent, {childList: true, subtree: true});
  refreshTrainingPresentation();
}

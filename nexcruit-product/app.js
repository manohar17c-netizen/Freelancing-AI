const auth = document.querySelector('#auth');
const workspace = document.querySelector('#workspace');
const status = document.querySelector('#status');
const stages = ['Applied', 'Interview', 'Hired', 'Closed'];

async function request(action, data) {
  const options = data ? {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  } : {};
  const response = await fetch('/product/api/' + action, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function showRecord(record) {
  const form = document.createElement('form');
  form.className = 'card';
  form.innerHTML = '<h3></h3><p></p><label class="field">Hiring stage <select name="stage"></select></label><fieldset><legend>Employee progress</legend><label class="check-line"><input type="checkbox" name="onboarding"> Onboarding complete</label><label class="field">Latest performance check-in <textarea name="checkin" maxlength="600"></textarea></label></fieldset><button class="btn small">Save</button>';
  form.querySelector('h3').textContent = record.role;
  form.querySelector('p').textContent = record.reference;
  const fields = form.elements;
  fields.stage.replaceChildren(...stages.map(stage => new Option(stage, stage)));
  fields.stage.value = record.stage;
  fields.onboarding.checked = Boolean(record.onboarding);
  fields.checkin.value = record.checkin;
  const employee = form.querySelector('fieldset');
  const updateVisibility = () => { employee.hidden = fields.stage.value !== 'Hired'; };
  updateVisibility();
  fields.stage.addEventListener('change', updateVisibility);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    await run(async () => {
      const result = await request('update', {
        id: record.id, stage: fields.stage.value,
        onboarding: fields.onboarding.checked, checkin: fields.checkin.value
      });
      render(result);
      status.textContent = 'Record saved.';
    });
  });
  return form;
}

function render(result) {
  auth.hidden = true;
  workspace.hidden = false;
  document.querySelector('#records').replaceChildren(...result.records.map(showRecord));
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function actionForm(action, buttonLabel, fields = [], fixed = {}) {
  const form = document.createElement('form');
  for (const [name, label, limit, type] of fields) {
    const wrapper = element('label', label);
    wrapper.className = 'field';
    const input = document.createElement(type === 'area' ? 'textarea' : 'input');
    input.name = name;
    input.maxLength = limit;
    input.required = true;
    wrapper.append(input);
    form.append(wrapper);
  }
  const button = element('button', buttonLabel);
  button.className = 'btn small';
  form.append(button);
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      renderHiring(await request(action, {...fixed, ...Object.fromEntries(new FormData(form))}));
      status.textContent = 'Update saved.';
    });
  });
  return form;
}

function renderHiring({role, jobs, applications}) {
  auth.hidden = true;
  workspace.hidden = false;
  const expert = role === 'hiring expert';
  const candidate = role === 'job seeker' || role === 'interviewee';
  document.querySelector('#roleHeading').textContent = role.replace(/^./, char => char.toUpperCase()) + ' workspace';
  document.querySelector('#internalRecords').hidden = !expert;
  const section = document.querySelector('#hiring');
  section.replaceChildren();
  if (expert) {
    const publish = actionForm('publish', 'Publish job', [
      ['title', 'Job title', 120], ['description', 'Description', 2000, 'area']
    ]);
    publish.className = 'card';
    section.append(element('h3', 'Publish a role'), publish);
  }
  if (candidate) {
    section.append(element('h3', 'Open jobs'));
    if (!jobs.length) section.append(element('p', 'No jobs have been published yet.'));
    for (const job of jobs) {
      const card = element('article', '');
      card.className = 'card';
      card.append(element('h4', job.title), element('p', job.description),
        actionForm('apply', 'Submit application', [['statement', 'Why this role?', 1000, 'area']], {job: job.id}));
      section.append(card);
    }
  }
  section.append(element('h3', role === 'interviewer' ? 'Assigned interviews' : 'Applications'));
  if (!applications.length) section.append(element('p', 'There are no records to review yet.'));
  for (const application of applications) {
    const {id, stage, slot, accepted, feedback} = application;
    const card = element('article', '');
    card.className = 'card';
    card.append(element('h4', application.title), element('p', `${application.candidate} · ${stage}`),
      element('p', application.statement));
    if (slot) card.append(element('p', `${slot} · ${accepted ? 'Confirmed' : 'Awaiting confirmation'}`));
    if (feedback) card.append(element('p', 'Interviewer feedback: ' + feedback));
    if (expert && (stage === 'Applied' || stage === 'Interview')) {
      card.append(actionForm('invite', 'Send workspace invitation', [
        ['interviewer', 'Interviewer username', 64], ['slot', 'Date, time and time zone', 100]
      ], {id}));
      const decisions = element('div', '');
      decisions.className = 'action-row';
      decisions.append(actionForm('decide', 'Mark hired', [], {id, stage: 'Hired'}),
        actionForm('decide', 'Close application', [], {id, stage: 'Closed'}));
      card.append(decisions);
    } else if (candidate && stage === 'Interview' && !accepted) {
      card.append(actionForm('accept', 'Confirm interview', [], {id}));
    } else if (role === 'interviewer' && stage === 'Interview' && accepted) {
      card.append(actionForm('feedback', 'Save evaluation',
        [['feedback', 'Interview evidence and evaluation', 2000, 'area']], {id}));
    }
    section.append(card);
  }
}

async function loadWorkspace() {
  const result = await request('hiring');
  renderHiring(result);
  if (result.role === 'hiring expert') render(await request('records'));
}

async function run(action) {
  status.textContent = '';
  try {
    await action();
  } catch (error) {
    status.textContent = error.message;
  }
}

auth.addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    await request(event.submitter.value, Object.fromEntries(new FormData(auth)));
    auth.reset();
    await loadWorkspace();
  });
});

document.querySelector('#create').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  run(async () => {
    render(await request('create', Object.fromEntries(new FormData(form))));
    form.reset();
  });
});

document.querySelector('#logout').addEventListener('click', () => run(async () => {
  await request('logout', {});
  workspace.hidden = true;
  auth.hidden = false;
  document.querySelector('#records').replaceChildren();
}));

loadWorkspace().catch(() => {});

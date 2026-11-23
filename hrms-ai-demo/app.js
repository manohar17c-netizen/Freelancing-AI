/* Nexcruit public concept prototype. All candidate data is fabricated and local. */
'use strict';

const SCENARIOS = {
  data: {
    company:'Nexcruit', department:'Data & Platform Engineering',
    mission:'Build trustworthy digital products that make complex work simpler for customers.',
    values:'Ownership, collaboration, curiosity, customer empathy',
    priority:'Scale our data platform while improving reliability, governance and collaboration across teams.',
    role:'Data Engineering Lead', ninetyDays:'Improve platform reliability and team execution',
    outcome:'Can design reliable data systems, coach engineers and align trade-offs with business stakeholders.',
    skills:['Cloud architecture','Data pipelines','Stakeholder communication','People leadership','Data governance'],
    weights:[25,25,15,20,15],
    candidates:[
      {id:'a',name:'Aarav Patel',title:'Data Platform Architect · 9 years',skills:[95,92,77,78,90],evidence:'Sample profile: cloud migration, large-scale data pipelines, reliability controls and mentoring engineers. Source evidence is invented and has not been verified.'},
      {id:'n',name:'Neha Sharma',title:'Engineering Lead · 8 years',skills:[87,79,97,94,80],evidence:'Sample profile: engineering delivery, cross-functional communication, team coaching and stakeholder alignment. Source evidence is invented and has not been verified.'},
      {id:'r',name:'Riya Kapoor',title:'Analytics Engineer · 7 years',skills:[84,71,67,82,93],evidence:'Sample profile: analytics infrastructure, data quality, governance and documentation. Source evidence is invented and has not been verified.'}
    ]
  },
  product: {
    company:'Nexcruit', department:'Product & Customer Experience',
    mission:'Make everyday business tools radically more useful, accessible and delightful.',
    values:'Customer obsession, curiosity, empathy, ownership',
    priority:'Improve product adoption and retention with faster learning from customer feedback.',
    role:'Senior Product Manager', ninetyDays:'Validate a high-impact product roadmap',
    outcome:'Can turn customer problems into a clear product direction and drive results through cross-functional teams.',
    skills:['Product strategy','Customer discovery','Product analytics','Stakeholder alignment','Execution & delivery'],
    weights:[27,23,19,16,15],
    candidates:[
      {id:'m',name:'Maya Shah',title:'Senior Product Manager · 8 years',skills:[95,88,84,90,81],evidence:'Sample profile: platform product strategy, research-led discovery and cross-functional prioritisation. Illustrative data only; unverified.'},
      {id:'d',name:'Dev Mehta',title:'Growth Product Manager · 7 years',skills:[81,93,97,74,88],evidence:'Sample profile: experimentation, onboarding growth, analytics frameworks and customer interviews. Illustrative data only; unverified.'},
      {id:'f',name:'Farah Khan',title:'Product Delivery Lead · 9 years',skills:[86,79,76,96,96],evidence:'Sample profile: stakeholder negotiation, complex launches, delivery risk management and product operations. Illustrative data only; unverified.'}
    ]
  },
  sales: {
    company:'Nexcruit', department:'Commercial & Growth',
    mission:'Help organisations adopt technology with clarity, trust and measurable business value.',
    values:'Trust, ownership, communication, customer success',
    priority:'Establish repeatable enterprise sales processes while strengthening strategic account relationships.',
    role:'Enterprise Sales Lead', ninetyDays:'Build a qualified enterprise pipeline',
    outcome:'Can run consultative discovery, navigate buying committees and coach a reliable sales team.',
    skills:['Enterprise selling','Customer discovery','Pipeline forecasting','Stakeholder influence','Team coaching'],
    weights:[28,19,18,20,15],
    candidates:[
      {id:'k',name:'Kabir Sethi',title:'Enterprise Account Executive · 10 years',skills:[97,89,82,92,76],evidence:'Sample profile: enterprise software deals, procurement navigation, multi-year renewals and account mapping. Illustrative data only; unverified.'},
      {id:'t',name:'Tara Iyer',title:'Regional Sales Manager · 9 years',skills:[86,85,92,90,97],evidence:'Sample profile: team enablement, revenue planning, forecasting process and customer relationships. Illustrative data only; unverified.'},
      {id:'z',name:'Zoya Ahmed',title:'Solutions Consultant · 8 years',skills:[81,98,85,94,78],evidence:'Sample profile: consultative technical discovery, proof-of-value workshops and buyer alignment. Illustrative data only; unverified.'}
    ]
  }
};
const STEPS=['context','role','applicants','brief','pipeline','portal','onboarding','performance'];
const LABELS={
 context:['STEP 01 / COMPANY CONTEXT','Start with what your company believes.','Give the recruitment workflow context before reviewing candidates.'],
 role:['STEP 02 / ROLE INTELLIGENCE','Define what success looks like.','Translate the manager’s expectations into clear, weighted requirements.'],
 applicants:['STEP 03 / APPLICANT INTELLIGENCE','Explore the applicant shortlist.','Compare fictional evidence and see why the illustrative scores change.'],
 brief:['STEP 04 / INTERVIEW INTELLIGENCE','Prepare for a better interview.','Build a clear, candidate-specific briefing without replacing human judgment.'],
 pipeline:['STEP 05 / HUMAN WORKFLOW','Keep the hiring process moving.','Track progress through stages controlled by the hiring team.'],
 portal:['STEP 06 / CANDIDATE EXPERIENCE','Show candidates where they stand.','Preview a transparent application status experience.'],
 onboarding:['STEP 07 / ONBOARDING','Give the new hire a clear start.','Complete a role-specific checklist and track progress.'],
 performance:['STEP 08 / PERFORMANCE','Turn role goals into regular check-ins.','Record progress and feedback against an employee goal.']
};
const $=id=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=name=>name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'??';
const clip=(v,n=105)=>v.length>n?v.slice(0,n-1)+'…':v;
const clean=v=>String(v||'').trim();
let state;
let toastTimeout;
const params = new URLSearchParams(location.search);
const workspaceMode = params.get('mode') === 'workspace';
const storageKey = 'nexcruit.workspace.v1';
const contextFields = ['companyName','department','mission','values','priority','roleTitle','ninetyDays','managerOutcome'];

function readWorkspace() {
 if (!workspaceMode) return null;
 try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  return saved && Object.hasOwn(SCENARIOS, saved.state?.scenario) && Array.isArray(saved.state?.candidates) && saved.fields ? saved : null;
 } catch {
  return null;
 }
}

function saveWorkspace() {
 if (!workspaceMode) return;
 try {
  const fields = Object.fromEntries(contextFields.map(id => [id, $(id).value]));
  localStorage.setItem(storageKey, JSON.stringify({ state, fields }));
 } catch {
  $('workspaceStorage').textContent = 'Browser storage is unavailable. Changes last until you refresh.';
 }
}

function reset(scenario='data',say=false){
 const cfg=SCENARIOS[scenario]||SCENARIOS.data;
 state={scenario,step:'context',weights:[...cfg.weights],selected:cfg.candidates[0].id,
  candidates:cfg.candidates.map(c=>({...c,skills:[...c.skills],stage:'Human review'})),portalSelected:cfg.candidates[0].id};
 for(const [id,val] of Object.entries({companyName:cfg.company,department:cfg.department,mission:cfg.mission,values:cfg.values,priority:cfg.priority,roleTitle:cfg.role,ninetyDays:cfg.ninetyDays,managerOutcome:cfg.outcome})) $(id).value=val;
 $('scenario').value=scenario;
 if(location.protocol==='https:'||location.protocol==='http:'){const u=new URL(location.href);u.searchParams.set('scenario',scenario);history.replaceState(null,'',u.pathname+u.search+u.hash);}
 $('portalConsent').checked=false;
 renderSliders();renderContext();openStep('context');updateHeroPreview();
 saveWorkspace();
 if(say)toast('Demo reset with fictional sample data.');
}

function getCandidate(id=state.selected){return state.candidates.find(c=>c.id===id)||state.candidates[0]}
function score(c){if(!c||!c.skills||c.skills.length!==state.weights.length)return null;let total=state.weights.reduce((a,b)=>a+b,0);return total?Math.round(c.skills.reduce((sum,v,i)=>sum+v*state.weights[i],0)/total):null}
function sortedCandidates(){return [...state.candidates].sort((a,b)=>(score(b)??-1)-(score(a)??-1))}
function orderedSkills(c){let skills=SCENARIOS[state.scenario].skills;
 return skills.map((name,i)=>({name,value:c.skills[i],weight:state.weights[i],inquiry:(100-c.skills[i])*state.weights[i]}));
}
function rankedGaps(c){return orderedSkills(c).sort((a,b)=>b.inquiry-a.inquiry)}
function topGaps(c){return rankedGaps(c).slice(0,2)}
function topStrengths(c){return orderedSkills(c).sort((a,b)=>b.value-a.value).slice(0,2)}
function questionsFor(c){
 const g=topGaps(c);let v=clean($('values').value.split(',')[0])||'ownership';
 let priority=clean($('priority').value)||'the team’s most important goal';
 return [
 `Tell us about a time you applied ${g[0].name.toLowerCase()} to a complex problem. What trade-offs did you make, and what was the measurable result?`,
 `Walk us through a project that shows your experience in ${g[1].name.toLowerCase()}. What evidence would help the panel understand your contribution?`,
 `Our team emphasises ${v.toLowerCase()}. How would you put that into practice while helping us ${priority.charAt(0).toLowerCase()+priority.slice(1).replace(/[.!?]+$/,'')}?`
 ];
}
function renderSliders(){let skills=SCENARIOS[state.scenario].skills;
 $('skillSliders').innerHTML=skills.map((x,i)=>`<div class="skill-entry"><label for="skill-${i}">${esc(x)}</label><input id="skill-${i}" type="range" min="0" max="50" step="1" value="${state.weights[i]}" data-index="${i}" aria-label="Priority weight for ${esc(x)}"><output id="weight-${i}">${state.weights[i]}</output></div>`).join('');
 $('skillSliders').querySelectorAll('input').forEach(el=>el.addEventListener('input',()=>{let i=Number(el.dataset.index);state.weights[i]=Number(el.value);$('weight-'+i).textContent=el.value;updateWeights();saveWorkspace();}));
 updateWeights();
}
function updateWeights(){let n=state.weights.reduce((a,b)=>a+b,0);$('weightTotal').textContent=`${n} relative points${n?'':' · Set at least one weight'}`;
 $('bestMatch').textContent=sortedCandidates().map(score).find(v=>v!==null)||'—';
 if(STEPS.includes(state.step)&&!['context','role'].includes(state.step))renderCurrent();
 updateHeroPreview();
}
function renderContext(){let tokens=clean($('values').value).split(',').map(s=>clean(s)).filter(Boolean).slice(0,6);
 $('orgChips').innerHTML=`<span>${esc(clip(clean($('companyName').value)||'Your organisation',50))}</span>`+tokens.map(v=>`<span>${esc(clip(v,35))}</span>`).join('');
}
function updateHeroPreview(){if(!state)return;let title=document.querySelector('.dash-main h4');if(title)title.textContent=clean($('roleTitle').value)||SCENARIOS[state.scenario].role;let s=sortedCandidates().slice(0,3);let heads=document.querySelectorAll('.dash-cand');heads.forEach((el,i)=>{
  let c=s[i];if(!c)return;let name=el.querySelector('strong'),avatar=el.querySelector('.avatar'),scoreEl=el.querySelector('.dash-score');if(name)name.textContent=c.name;if(avatar)avatar.textContent=initials(c.name);if(scoreEl)scoreEl.textContent=score(c)??'—';
 });}
function renderApplicants(){let c=getCandidate();const arr=sortedCandidates();$('applicantCount').textContent=arr.length;$('criteriaCount').textContent=state.weights.length;
 $('bestMatch').textContent=arr.length?(score(arr[0])??'—'):'—';
 $('applicantList').innerHTML=arr.map((a,i)=>`<button class="candidate-btn ${c?.id===a.id?'active':''}" data-candidate="${esc(a.id)}" aria-pressed="${c?.id===a.id}"><span class="avatar">${esc(initials(a.name))}</span><span class="info"><strong>${esc(a.name)}</strong><small>${esc(clip(a.title,55))}</small></span><span class="score ${score(a)===null?'none':''}" title="Illustrative weighted rubric score">${score(a)===null?'N/A':score(a)+'/100'}</span></button>`).join('');
 $('applicantList').querySelectorAll('[data-candidate]').forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.candidate;renderApplicants()}));
 if(!c){$('selectedName').textContent='No applicant selected';return}
 $('selectedAvatar').textContent=initials(c.name);$('selectedName').textContent=c.name;$('selectedRole').textContent=c.title;$('selectedScore').textContent=score(c)===null?'—':score(c)+'/100';
 $('evidenceBars').innerHTML=orderedSkills(c).map(s=>`<div class="skill-meter"><div class="label-line"><strong>${esc(s.name)}</strong><span>Sample evidence: ${s.value}/100</span></div><div class="barline"><div class="barfill" style="width:${s.value}%"></div></div></div>`).join('');
 $('selectedEvidence').textContent=c.evidence;
 $('selectedGaps').textContent=`Follow up on ${topGaps(c).map(s=>s.name.toLowerCase()).join(' and ')}. Ask for actual examples and independent evidence; do not treat the score as a hiring decision.`;
}
function scoreRationale(candidate) {
 const match = score(candidate);
 if (match === null) return 'Assign a positive weight to at least one skill to calculate alignment.';
 return `The ${match}/100 score is the weighted average of fictional skill evidence. Each skill is multiplied by its role weight, then the sum is divided by the total weight and rounded.`;
}

function gapDetails(skill) {
 return `${skill.value}/100 sample evidence · role weight ${skill.weight} · ${100 - skill.value} points below the sample benchmark`;
}

function renderBrief(){let c=getCandidate();if(!c)return;let cfg=SCENARIOS[state.scenario];$('briefAvatar').textContent=initials(c.name);$('briefName').textContent=c.name;
 $('briefMeta').textContent=`${c.title} · ${clean($('roleTitle').value)||cfg.role}`;$('briefScore').textContent=score(c)===null?'—':score(c)+'/100';
 $('briefRationale').textContent = scoreRationale(c);
 $('briefMission').textContent = clean($('mission').value) || 'Company mission pending.';
 $('briefManager').textContent = clean($('managerOutcome').value) || 'Manager criteria pending.';
 const tags=[clean($('companyName').value)||'Your organisation',clean($('department').value)||'Team',clean($('ninetyDays').value)||'Role impact'];
 $('briefContext').innerHTML=tags.map(t=>`<span>${esc(clip(t,70))}</span>`).join('');
 $('briefStrengths').innerHTML=topStrengths(c).map(s=>`<li><strong>${esc(s.name)}</strong> · ${s.value}/100 illustrative skill evidence</li>`).join('');
 $('briefGaps').innerHTML=rankedGaps(c).map(s=>`<li><strong>${esc(s.name)}</strong> · ${gapDetails(s)}</li>`).join('');
 $('briefQuestions').innerHTML=questionsFor(c).map((q,i)=>`<li><span>Q${i+1}</span>${esc(q)}</li>`).join('');
}
function renderPipeline(){let c=state.candidates;let counts={'Human review':0,'Invite to interview':0,'Request evidence':0,'On hold':0,'Hired':0,'Declined':0};c.forEach(p=>counts[p.stage]=(counts[p.stage]||0)+1);
 $('stageReview').textContent=counts['Human review'];$('stageInvite').textContent=counts['Invite to interview'];$('stageEvidence').textContent=counts['Request evidence'];$('stageOther').textContent=counts['On hold']+counts.Hired+counts.Declined;
 $('pipelineRows').innerHTML=c.map(p=>`<div class="pipeline-row"><span class="avatar">${esc(initials(p.name))}</span><div class="pinfo"><strong>${esc(p.name)}</strong><small>${esc(p.title)} · demo match ${score(p)??'—'}/100</small></div><select data-stage-candidate="${esc(p.id)}" aria-label="Stage for ${esc(p.name)}">${Object.keys(counts).map(s=>`<option value="${s}" ${s===p.stage?'selected':''}>${s}</option>`).join('')}</select></div>`).join('');
 $('pipelineRows').querySelectorAll('[data-stage-candidate]').forEach(sel=>sel.addEventListener('change',()=>{let p=getCandidate(sel.dataset.stageCandidate);p.stage=sel.value;if(p.stage==='Hired')registerEmployee(p);if(p.stage!=='Invite to interview')delete p.interviewSlot;renderPipeline();saveWorkspace();document.querySelector(`[data-stage-candidate="${p.id}"]`)?.focus();toast(`${p.name}'s demo stage changed to ${p.stage}.`);}));
 const invited = c.filter(candidate => candidate.stage === 'Invite to interview');
 const candidatePicker = $('interviewCandidate');
 const previousId = candidatePicker.value;
 candidatePicker.replaceChildren(...invited.map(candidate => new Option(candidate.name, candidate.id)));
 if (invited.some(candidate => candidate.id === previousId)) candidatePicker.value = previousId;
 $('interviewForm').hidden = invited.length === 0;
 syncInterviewSlot();
}

function syncInterviewSlot() {
 const candidate = state.candidates.find(item => item.id === $('interviewCandidate').value);
 $('interviewSlot').value = candidate?.interviewSlot || '';
}

function renderPortal(){let list=$('portalCandidate'),selected=state.portalSelected;
 list.innerHTML=state.candidates.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('');
 let c=getCandidate(selected);if(!c)return;
 $('portalHello').textContent=`Hello, ${c.name.split(' ')[0]}!`;
 let display={'Human review':'Under review','Invite to interview':'Interview invited','Request evidence':'More evidence needed','On hold':'On hold','Hired':'Hired','Declined':'Application closed'}[c.stage]||c.stage;
 $('portalStatus').textContent=display;
 $('portalInterview').hidden = !c.interviewSlot;
 $('portalInterview').textContent = c.interviewSlot ? `Sample interview booked for ${c.interviewSlot}. No calendar invite was sent.` : '';
 $('portalRole').textContent=`${clean($('roleTitle').value)||SCENARIOS[state.scenario].role} · ${clean($('companyName').value)||'Hiring organisation'}`;
 let interview=c.stage==='Invite to interview';$('portalStepInterview').classList.toggle('now',interview);$('portalStepReview').classList.toggle('now',!interview);$('portalStepReview').classList.toggle('done',interview);
 const messages={
 'Human review':'Your application is with the hiring team. A person will decide what happens next.',
 'Invite to interview':'The hiring team has moved this sample application to the interview stage. No invitation has been sent.',
 'Request evidence':'The hiring team has requested more information. You would receive a clear explanation in a future production flow.',
 'On hold':'Your application has been placed on hold by the hiring team.',
 'Hired':'The hiring team recorded a hire. You can explore the onboarding plan in this preview.',
 'Declined':'The hiring team has closed this sample application.'
 };$('portalStatusText').textContent=messages[c.stage]||messages['Human review'];
 const skill=SCENARIOS[state.scenario].skills;
 let top=skill.map((name,i)=>({name,weight:state.weights[i]})).sort((a,b)=>b.weight-a.weight).slice(0,3).map(s=>s.name.toLowerCase());
 $('portalExpectations').textContent=`The role prioritises ${top.join(', ')}. The manager's stated 90-day goal is: ${clean($('ninetyDays').value)||'to demonstrate role-specific success'}.`;
}
function renderCurrent(){if(!state)return;switch(state.step){case 'context':renderContext();break;case 'applicants':renderApplicants();break;case 'brief':renderBrief();break;case 'pipeline':renderPipeline();break;case 'portal':renderPortal();break;case 'onboarding':case 'performance':renderEmployeeWorkspace();break;}}
function openStep(name){if(!STEPS.includes(name))return;state.step=name;let labels=LABELS[name];$('stepEyebrow').textContent=labels[0];$('stepTitle').textContent=labels[1];$('stepDescription').textContent=labels[2];
 document.querySelectorAll('.step-nav').forEach(b=>{const on=b.dataset.step===name;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'step':'false')});
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===`tab-${name}`));
 let i=STEPS.indexOf(name);$('nextStep').innerHTML=i===STEPS.length-1?'Start the journey again <svg class="icon"><use href="#i-refresh"></use></svg>':`Continue: ${['','role setup','applicant shortlist','interview brief','hiring workflow','candidate experience','onboarding plan','performance check-ins'][i+1]} <svg class="icon"><use href="#i-arrow"></use></svg>`;
 $('nextStep').dataset.next=STEPS[(i+1)%STEPS.length];renderCurrent();
 updateTour();
}
function toast(message){let el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2800)}
function showModal(){let skills=SCENARIOS[state.scenario].skills;
 $('newSkillInputs').innerHTML=skills.map((name,i)=>`<div class="skill-entry"><label for="newSkill-${i}">${esc(name)}</label><input id="newSkill-${i}" type="range" min="0" max="100" value="75" aria-label="Sample evidence for ${esc(name)}" oninput="document.getElementById('newSkillValue-${i}').textContent=this.value"><output id="newSkillValue-${i}">75</output></div>`).join('');
 $('addForm').reset();$('addModal').classList.add('open');$('newName').focus();}
function closeModal(){ $('addModal').classList.remove('open');$('addApplicantBtn').focus(); }
function addCandidate(e){e.preventDefault();let name=clean($('newName').value), title=clean($('newTitle').value), evidence=clean($('newEvidence').value);
 if(!name||!title||!evidence)return;
 let skills=SCENARIOS[state.scenario].skills.map((_,i)=>Number($('newSkill-'+i).value));
 let c={id:'custom'+(Date.now()),name,title,evidence:'User-created fictional profile: '+evidence+' (Values were entered manually in this demo; no facts have been verified.)',skills,stage:'Human review'};
 state.candidates.push(c);state.selected=c.id;state.portalSelected=c.id;saveWorkspace();closeModal();openStep('applicants');toast('Fictional profile added to the local demo.');}
function buildPrint(){let c=getCandidate();if(!c)return;let q=questionsFor(c), mission=clean($('mission').value), role=clean($('roleTitle').value);
 $('printArea').innerHTML=`<h1>Nexcruit · Executive Candidate Brief</h1><p><strong>Illustrative prototype · Not an employment decision or verified candidate assessment</strong></p><hr><p><b>Candidate:</b> ${esc(c.name)}<br><b>Role:</b> ${esc(role)}<br><b>Company:</b> ${esc(clean($('companyName').value))}<br><b>Team:</b> ${esc(clean($('department').value))}<br><b>Sample rubric alignment:</b> ${score(c)??'—'}/100</p><p>${esc(scoreRationale(c))}</p><p><b>Company mission:</b> ${esc(mission)}</p><p><b>Manager success criteria:</b> ${esc(clean($('managerOutcome').value))}</p><div class="print-cols"><section><h2>Sample strengths</h2><ul>${topStrengths(c).map(s=>`<li>${esc(s.name)} — ${s.value}/100 synthetic skill evidence</li>`).join('')}</ul></section><section><h2>Gaps to investigate</h2><ul>${rankedGaps(c).map(s=>`<li>${esc(s.name)} — ${gapDetails(s)}</li>`).join('')}</ul></section></div><h2>Contextual interview questions</h2><ol>${q.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><h2>Evidence note</h2><p>${esc(c.evidence)}</p><p class="print-warning">DEMO ONLY — This brief is generated from fictional inputs and deterministic calculations. Professional identities and work histories were not checked. A human interviewer must assess real evidence and make the final decision.</p>`;
}

const tourHints = {
 context: 'Review the sample company mission and hiring priorities, then continue to role setup.',
 role: 'Adjust a skill weight to see how the role priorities affect the shortlist.',
 applicants: 'Choose a fictional applicant and compare their skill evidence against the role.',
 brief: 'Read the score rationale and interview questions, or print the brief.',
 pipeline: 'Try booking an interview. Then change the applicant to Hired to unlock their employee workspace.',
 portal: 'Choose the applicant to see how the hiring team’s update looks to them.',
 onboarding: 'Finish a task or two to see progress for the new hire.',
 performance: 'Update the goal and save a fictional check-in to see it in the history.'
};

function registerEmployee(candidate) {
 if (!candidate.employee) {
  const goal = clean($('ninetyDays').value) || SCENARIOS[state.scenario].ninetyDays;
  const trainingSkill = topGaps(candidate)[0].name;
  candidate.employee = {
   goal,
   goalStatus: 'Not started',
   tasks: [
    { label: 'Meet the manager and confirm the 90-day goal', done: false },
    { label: 'Complete the team and tools orientation', done: false },
    { label: `Plan training for ${trainingSkill.toLowerCase()}`, done: false }
   ],
   checkins: []
  };
 }
 state.employeeId = candidate.id;
 state.portalSelected = candidate.id;
 $('portalConsent').checked = false;
}

function currentEmployee() {
 const hires = state.candidates.filter(candidate => candidate.stage === 'Hired');
 return hires.find(candidate => candidate.id === state.employeeId) || hires[0];
}

function renderEmployeeWorkspace() {
 const candidate = currentEmployee();
 const step = state.step;
 const panel = $('tab-' + step);
 panel.querySelector('.lifecycle-empty').hidden = Boolean(candidate);
 panel.querySelector('.employee-workspace').hidden = !candidate;
 if (!candidate) return;

 const picker = $(step + 'Employee');
 const hires = state.candidates.filter(item => item.stage === 'Hired');
 picker.replaceChildren(...hires.map(item => new Option(item.name, item.id)));
 picker.value = candidate.id;
 const employee = candidate.employee;

 if (step === 'onboarding') {
  $('onboardingTasks').innerHTML = employee.tasks.map((task, index) =>
   `<label class="check-line"><input type="checkbox" data-task="${index}" ${task.done ? 'checked' : ''}><span>${esc(task.label)}</span></label>`
  ).join('');
  updateOnboardingProgress(employee);
  return;
 }
 $('employeeGoal').value = employee.goal;
 $('goalStatus').value = employee.goalStatus;
 $('checkinFeedback').value = '';
 $('checkinHistory').innerHTML = employee.checkins.map(checkin =>
  `<li><strong>${esc(checkin.status)}</strong><p>${esc(checkin.goal)}</p><p>${esc(checkin.feedback)}</p></li>`
 ).join('');
}

function updateOnboardingProgress(employee) {
 const done = employee.tasks.filter(task => task.done).length;
 $('onboardingProgress').textContent = `${done} of ${employee.tasks.length} tasks complete`;
}

for (const step of ['onboarding', 'performance']) {
 $(step + 'Employee').addEventListener('change', event => {
  state.employeeId = event.target.value;
  renderEmployeeWorkspace();
 });
}

$('onboardingTasks').addEventListener('change', event => {
 const employee = currentEmployee().employee;
 employee.tasks[Number(event.target.dataset.task)].done = event.target.checked;
 updateOnboardingProgress(employee);
 saveWorkspace();
});

$('checkinForm').addEventListener('submit', event => {
 event.preventDefault();
 const goal = clean($('employeeGoal').value);
 const feedback = clean($('checkinFeedback').value);
 if (!goal || !feedback) {
  toast('Enter a goal and fictional feedback.');
  return;
 }
 const employee = currentEmployee().employee;
 employee.goal = goal;
 employee.goalStatus = $('goalStatus').value;
 employee.checkins.unshift({ goal, status: employee.goalStatus, feedback });
 saveWorkspace();
 renderEmployeeWorkspace();
 toast('Sample check-in saved.');
});

function updateTour() {
 if ($('tourPanel').hidden) return;
 $('tourTitle').textContent = `Guided demo · ${STEPS.indexOf(state.step) + 1} of ${STEPS.length}`;
 $('tourHint').textContent = tourHints[state.step];
}

$('startTour').addEventListener('click', () => {
 $('tourPanel').hidden = false;
 openStep('context');
 const heading = $('stepTitle');
 heading.tabIndex = -1;
 heading.focus();
});
$('exitTour').addEventListener('click', () => {
 $('tourPanel').hidden = true;
 $('startTour').focus();
});
$('interviewCandidate').addEventListener('change', syncInterviewSlot);
$('interviewForm').addEventListener('submit', event => {
 event.preventDefault();
 const candidate = state.candidates.find(item => item.id === $('interviewCandidate').value);
 const slot = $('interviewSlot').value;
 if (!candidate || candidate.stage !== 'Invite to interview' || !slot) return;
 candidate.interviewSlot = slot;
 state.portalSelected = candidate.id;
 $('portalConsent').checked = false;
 saveWorkspace();
 toast(`Sample interview saved for ${candidate.name}.`);
});

// Wire controls and local-only events.
document.querySelectorAll('.step-nav').forEach(b=>b.addEventListener('click',()=>openStep(b.dataset.step)));
$('nextStep').addEventListener('click',()=>{openStep($('nextStep').dataset.next);if(window.innerWidth<800)document.querySelector('.demo-shell').scrollIntoView({behavior:'smooth',block:'start'})});
$('scenario').addEventListener('change',e=>{reset(e.target.value);toast('Scenario updated. All applicants are fictional sample data.');});
$('resetDemo').addEventListener('click', () => {
 if (!workspaceMode || window.confirm('Replace this browser workspace with the initial sample records?')) reset(state.scenario, true);
});
$('shareScenario').addEventListener('click', async ()=>{
 const url=new URL(location.href);
 url.searchParams.set('scenario',state.scenario);
 url.hash='experience';
 if(!['http:','https:'].includes(url.protocol)){toast('Publish the site to share scenario links. This local preview has no public URL.');return;}
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(url.href);toast('Scenario link copied. It includes no candidate details.');}
 catch{window.prompt('Copy this public scenario link:',url.href);}
});
contextFields.forEach(id=>$(id).addEventListener('input',()=>{if(id==='values'||id==='companyName')renderContext();if(id==='roleTitle')updateHeroPreview();if(state.step==='brief')renderBrief();if(state.step==='portal')renderPortal();saveWorkspace()}));
$('openSelectedBrief').addEventListener('click',()=>openStep('brief'));
$('printReport').addEventListener('click',()=>{buildPrint();window.print()});
$('portalCandidate').addEventListener('change',e=>{state.portalSelected=e.target.value;$('portalConsent').checked=false;renderPortal()});
$('portalAction').addEventListener('click',()=>toast($('portalConsent').checked?'Consent selected for this preview. No personal data was submitted.':'No additional profile-sharing consent selected. Nothing was submitted.'));
$('addApplicantBtn').addEventListener('click',showModal);
$('addForm').addEventListener('submit',addCandidate);
document.querySelectorAll('[data-close="addModal"]').forEach(b=>b.addEventListener('click',closeModal));
$('addModal').addEventListener('click',e=>{if(e.target===$('addModal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('addModal').classList.contains('open'))closeModal()});
$('menuToggle').addEventListener('click',()=>{let nav=$('mainNav');nav.classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(nav.classList.contains('open')))});
$('mainNav').querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{$('mainNav').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false')}));
const initialScenario = params.get('scenario');
const saved = readWorkspace();
if (workspaceMode) {
 $('workspaceName').textContent = 'Nexcruit product workspace';
 $('workspaceDescription').textContent = 'Pilot the recruitment, onboarding and performance workflows with fictional records.';
 $('workspaceStorage').textContent = 'Saved in this browser. Use fictional records only.';
 $('resetDemo').textContent = 'Reset workspace';
 $('shareScenario').hidden = true;
 // One saved role keeps a scenario switch from replacing the pilot's records.
 $('scenario').disabled = true;
}
if (saved) {
 state = saved.state;
 for (const id of contextFields) $(id).value = saved.fields[id] ?? '';
 $('scenario').value = state.scenario;
 renderSliders();
 openStep('context');
} else {
 reset(Object.hasOwn(SCENARIOS, initialScenario) ? initialScenario : 'data');
}
if (params.get('mode') === 'demo') $('startTour').click();

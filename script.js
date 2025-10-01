/* script.js
   Lightweight SPA for GMP GDP interactive training.
   - Uses hash routing
   - localStorage for progress
   - PubSub for events
   - Accessible live region updates
   - Confetti on completion
*/
(() => {
  'use strict';

  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const qs = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sr = $('#srLive');

  // Simple PubSub
  const PubSub = {
    topics: {},
    emit(topic, data) { (this.topics[topic] || []).forEach(cb => cb(data)); },
    on(topic, cb) { (this.topics[topic] = this.topics[topic] || []).push(cb); },
  };

  // ---------- App State ----------
  const STORAGE_KEY = 'gmp-gdp-trainer-v1';
  const defaultState = {
    completed: {}, // moduleId: true
    badges: [],
    errors: 0,
    currentModule: 0,
  };
  let state = loadState();
  // DEV_MODE: allow quick bypass for testing (use ?dev=1 or #dev)
  const urlParams = new URLSearchParams(window.location.search);
  const DEV_MODE = urlParams.get('dev') === '1' || location.hash.includes('dev');
  if (DEV_MODE && !state.badges.includes('DEV')) state.badges.push('DEV');

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, defaultState, JSON.parse(raw));
    } catch (e) { console.warn('loadState', e); }
    return JSON.parse(JSON.stringify(defaultState));
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    PubSub.emit('state:updated', state);
  }

  // ---------- Data: Modules, scenarios, quizzes ----------
  const MODULES = [
    {
      id: 'gowning',
      title: 'Gowning & Prep',
      subtitle: 'Start with correct gowning; logs must be contemporaneous.',
      steps: [
        { type: 'intro', text: 'Welcome to gowning. Before entering, you must suit up and sign the gowning log.' },
        { type: 'scenario', q: 'A colleague says you can skip the log today to save time. What do you do?', options: [
          { t: 'Sign now (Contemporaneous)', good:true, tip:'Always contemporaneous — ALCOA+' },
          { t: 'Skip and sign later', good:false, tip:'Delaying records breaks contemporaneous requirement.' }
        ]},
        { type: 'quiz', questions: [
          { q:'Which ALCOA+ principle requires records to be legible?', a:['Attributable','Legible','Contemporaneous','Original'], correct:1 },
          { q:'Gowning logs should be signed:', a:['Immediately','End of shift','Never','When remembered'], correct:0 },
          { q:'Gowning cooldown simulates:', a:['Fatigue','Sterility time','Buffer prep','Audit'], correct:1 },
          { q:'Who may sign the gowning log?', a:['Any colleague','The operator','Vendor rep','No one'], correct:1 },
          { q:'Contemporaneous means:', a:['At same time as action','Within 24 hours','Next day','No need'], correct:0 }
        ]}
      ]
    },
    {
      id: 'culture',
      title: 'Cell Culture & Inoculation',
      subtitle: 'Prepare vessels and inoculate cells carefully.',
      steps: [
        { type:'intro', text:'Prepare media, check cell density, and inoculate.' },
        { type:'calc', label:'Dilution factor', prompt:'You need to make a 1:10 inoculum for 5 L from a stock. How many liters of stock are needed (decimal)?', answer:'0.5' },
        { type:'scenario', q:'Mid-inoculation the incubator alarm sounds. Do you:', options:[
          {t:'Pause and verify logs', good:true, tip:'Prioritize verification and safety.'},
          {t:'Ignore and continue', good:false, tip:'Ignoring alarms risks process and records.'}
        ]},
        { type:'quiz', questions: [
          { q:'Before inoculation you must document:', a:['Cell density','Weather','Lunch choice','TV show'], correct:0 },
          { q:'Inoculum calculations must be:', a:['Verified','Estimated','Skipped','Done later'], correct:0 },
          { q:'Which is a record keeping error?', a:['Back-dating','Signing contemporaneously','Double-checking','Timestamps'], correct:0 },
          { q:'Media prep labeling requires:', a:['Batch # & date','Only color','Nothing','Signature sticker'], correct:0 },
          { q:'Who verifies inoculation calculations?', a:['Peer or supervisor','Nobody','Vendor','Intern'], correct:0 }
        ]}
      ]
    },
    {
      id: 'harvest',
      title: 'Harvest & Clarification',
      subtitle: 'Handle harvest volumes and clarifications with care.',
      steps: [
        { type:'intro', text:'Harvest and clarify using appropriate filtration and hold times.'},
        { type:'scenario', q:'There is a pressure spike during TFF; your colleague asks you to keep working. Do you:', options:[
          {t:'Stop & annotate', good:true, tip:'Stop, annotate parameters immediately.'},
          {t:'Work faster to finish', good:false, tip:'Rushing can omit critical verifications.'}
        ]},
        { type:'calc', label:'Yield %', prompt:'If initial amount was 120 units and final is 90 units, what is the yield % (rounded to 1 decimal)?', answer:'75.0' },
        { type:'quiz', questions: [
          { q:'Clarification removes:', a:['Cells & debris','Product','Air','Operators'], correct:0 },
          { q:'Pressure spikes should be:', a:['Logged immediately','Ignored','Fixed later','Hidden'], correct:0 },
          { q:'Hold times are:', a:['Critical','Optional','Decorative','Unknown'], correct:0 },
          { q:'Clarification filters must be:', a:['Labeled','Unlabeled','Hidden','Discarded'], correct:0 },
          { q:'Who records clarification parameters?', a:['Operator','Random visitor','Manager only','Timekeeper'], correct:0 }
        ]}
      ]
    },
    {
      id: 'purification',
      title: 'Purification & Calculations',
      subtitle: 'Chromatography, buffer prep, and yield calculations.',
      steps: [
        { type:'intro', text:'Prepare buffers, set up chromatography, and calculate yields.' },
        { type:'miniGame', label:'Buffer Prep', hint:'Drag reagents into the vessel to reach target concentration of 100 mM total (toy example).', target:100 },
        { type:'scenario', q:'An interrupt arrives while you are calculating buffer molarity. You:', options:[
          {t:'Acknowledge & finish calculation', good:true, tip:'Finish calculations before moving on.'},
          {t:'Answer interrupt and forget to sign', good:false, tip:'Multitasking leads to missed verifications.'}
        ]},
        { type:'quiz', questions: [
          { q:'Chromatography steps must be recorded in:', a:['Batch record','Personal notes','Phone','Nowhere'], correct:0 },
          { q:'Buffer pH must be:', a:['Measured','Guessed','Estimated','Ignored'], correct:0 },
          { q:'Dilution calculations require:', a:['Double-checking','Trusting memory','No verification','Only verbal'], correct:0 },
          { q:'Filters should be labeled when:', a:['Always','Never','Sometimes','Rarely'], correct:0 },
          { q:'What is ALCOA+?', a:['A documentation quality set','A device','A chemical','A unit'], correct:0 }
        ]}
      ]
    },
    {
      id: 'filling',
      title: 'Filling & Inspection',
      subtitle: 'Sterile filling and visual inspection are critical.',
      steps: [
        { type:'intro', text:'Set up filling lines, verify sterile filters, and inspect vials.'},
        { type:'scenario', q:'You notice a small particle during inspection but are behind schedule. You:', options:[
          {t:'Quarantine and document', good:true, tip:'Conservative approach protects product.'},
          {t:'Continue to save time', good:false, tip:'Skipping inspections causes risk.'}
        ]},
        { type:'calc', label:'Dose per vial', prompt:'You have 30 mL final and 60 vials. How many mL per vial? (2 decimals)', answer:'0.50' },
        { type:'quiz', questions: [
          { q:'Visual inspection documents:', a:['Particle presence','Weather','Lunch','Phone battery'], correct:0 },
          { q:'Sterile filling requires:', a:['Records & controls','Only speed','No records','Music'], correct:0 },
          { q:'If deviation occurs, you should:', a:['Document & notify','Ignore','Hide','Delete records'], correct:0 },
          { q:'Inspection should be', a:['Contemporaneous','Delayed','Forgotten','Speculative'], correct:0 },
          { q:'Signatures should be', a:['Readable','Illegible','Scribbles','None'], correct:0 }
        ]}
      ]
    },
    {
      id: 'degown',
      title: 'De-Gowning & Documentation Review',
      subtitle: 'Final checks, handover, and batch documentation.',
      steps: [
        { type:'intro', text:'De-gown correctly and complete batch documentation.' },
        { type:'scenario', q:'You realize a shift earlier missed a signature. You:', options:[
          {t:'Raise deviation & investigate', good:true, tip:'Transparency is required.'},
          {t:'Back-sign to cover it', good:false, tip:'Back-dating is a severe GMP violation.'}
        ]},
        { type:'final', text:'Review all module badges and finalize the training.' }
      ]
    }
  ];

  // ---------- Rendering helpers ----------

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k.startsWith('aria-')) node.setAttribute(k, attrs[k]);
      else if (k === 'html') node.innerHTML = attrs[k];
      else node[k] = attrs[k];
    }
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  // ---------- UI Renderers ----------

  function renderDashboard() {
    $('#dashboardTitle').textContent = 'Dashboard';
    const list = $('#moduleList');
    list.innerHTML = '';
    MODULES.forEach((m, i) => {
      const li = el('li', {}, [
        el('div', {}, [ el('strong', { html: m.title }), el('div', { class: 'muted', html: m.subtitle }) ]),
        el('div', {}, [
          el('button', { innerText: state.completed[m.id] ? 'Review' : 'Start', onclick: () => navigateToModule(i) })
        ])
      ]);
      list.appendChild(li);
    });
    updateProgressUI();
  }

  function updateProgressUI() {
    const total = MODULES.length;
    const done = MODULES.reduce((acc,m) => acc + (state.completed[m.id] ? 1 : 0), 0);
    const pct = Math.round((done / total) * 100);
    $('#progressPercent').textContent = pct + '%';
    $('#progressFill').style.width = pct + '%';
    // badges
    const badgesWrap = $('#badges');
    badgesWrap.innerHTML = '';
    (state.badges || []).forEach(b => {
      const bEl = el('div', { class: 'badge', innerText: b });
      badgesWrap.appendChild(bEl);
    });
  }

  // Module rendering
  let currentModuleIndex = state.currentModule || 0;
  let currentStepIndex = 0;

  function navigateToModule(index) {
    // enforce gowning cooldown if entering a module and not completed gowning
    const module = MODULES[index];
    showModule(index);
  }

  function showModule(index) {
    currentModuleIndex = index;
    state.currentModule = index;
    saveState();
    const module = MODULES[index];
    $('#moduleTitle').textContent = module.title;
    $('#moduleSubtitle').textContent = module.subtitle;
    $('#dashboard').classList.add('hidden');
    $('#modulePage').classList.remove('hidden');
    currentStepIndex = 0;
    renderCurrentStep();
    focusMainContent();
  }

  function backToDashboard() {
    $('#modulePage').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    renderDashboard();
  }

  function renderCurrentStep() {
    const content = $('#moduleContent');
    const module = MODULES[currentModuleIndex];
    const step = module.steps[currentStepIndex];
    content.innerHTML = '';
    content.setAttribute('aria-busy','true');
    // small animation/fade
    content.style.opacity = 0;
    setTimeout(() => content.style.opacity = 1, 10);

    if (!step) {
      content.appendChild(el('p', {}, [ 'No content for this step.' ]));
      return;
    }

    if (step.type === 'intro' || step.type === 'final') {
      content.appendChild(el('p', { innerText: step.text }));
      if (step.type === 'final') {
        const finishBtn = el('button', { class: 'primary', innerText: 'Finalize Training', onclick: finalizeTraining });
        content.appendChild(finishBtn);
      }
    }

    // Gowning simulation
    if (step.type === 'gownSim') renderGownSim(step);

    // Scenario step
    if (step.type === 'scenario') {
      content.appendChild(el('p', { innerText: step.q }));
      const optWrap = el('div', {});
      step.options.forEach((opt, idx) => {
        const btn = el('button', { class: 'secondary', innerText: opt.t, onclick: () => handleScenarioChoice(opt) });
        btn.style.display = 'block';
        btn.style.margin = '8px 0';
        optWrap.appendChild(btn);
      });
      content.appendChild(optWrap);
    }

    // Calculation challenge
    if (step.type === 'calc') {
      content.appendChild(el('p', { innerText: step.prompt }));
      const input = el('input', { type: 'text', id: 'calcInput', placeholder: 'Enter value', 'aria-label':'calculation input' });
      const checkBtn = el('button', { class: 'primary', innerText: 'Check', onclick: () => checkCalc(step) });
      const hint = el('div', { id: 'calcFeedback', class:'muted' });
      content.appendChild(input);
      content.appendChild(checkBtn);
      content.appendChild(hint);
    }

    // Mini-game: simple drag-and-drop
    if (step.type === 'miniGame') {
      renderMiniGame(step);
    }

    // Quiz
    if (step.type === 'quiz') {
      renderQuiz(step.questions, module.id);
    }

    content.setAttribute('aria-busy','false');
    // footer buttons
    $('#prevStep').disabled = currentStepIndex === 0;
    $('#nextStep').disabled = false;
  }

  // ---------- Step handlers ----------
  function handleScenarioChoice(opt) {
    // visual feedback + state
    if (opt.good) {
      announce('Good choice. GDP tip: ' + opt.tip);
      showModal('Good decision', `<p style="color:var(--success)">${opt.tip}</p>`);
      awardBadge('Verification Virtuoso');
    } else {
      announce('Poor choice. Root-cause: ' + opt.tip);
      showModal('Issue detected', `<p style="color:var(--danger)">${opt.tip}</p>`);
      state.errors++;
      saveState();
    }
    // mark step complete
    markModuleProgressIfLastStep();
  }

  function checkCalc(step) {
    const val = ($('#calcInput').value || '').trim();
    const feedback = $('#calcFeedback');
    if (!val) { feedback.innerText = 'Please enter a value.'; return; }
    // Allow some tolerance for numeric answers
    const expected = step.answer;
    if (Number(parseFloat(val)).toFixed(2) === Number(expected).toFixed(2) || val === expected) {
      feedback.innerHTML = `<span style="color:var(--success)">Correct.</span> ${step.explain || ''}`;
      awardBadge('Calculation Ace');
      markModuleProgressIfLastStep();
    } else {
      feedback.innerHTML = `<span style="color:var(--danger)">Incorrect.</span> Expected: ${expected}`;
      state.errors++;
      saveState();
    }
  }

  // Mini-game: buffer drag-and-drop simplified
  function renderMiniGame(step) {
    const container = $('#moduleContent');
    container.innerHTML = '';
    container.appendChild(el('p',{innerText: step.hint}));
    const gameArea = el('div',{ class: 'mini-game', style:'display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap' });
    const reagents = [
      {name:'Reagent A', value:40},
      {name:'Reagent B', value:30},
      {name:'Reagent C', value:20},
      {name:'Diluent', value:10}
    ];
    const palette = el('div', { style:'min-width:160px' });
    reagents.forEach((r, idx) => {
      const item = el('div', { class:'mini-item', draggable:true, innerText:`${r.name} (${r.value})` });
      item.dataset.value = r.value;
      item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', r.value));
      palette.appendChild(item);
    });
    const vessel = el('div', { id:'vessel', style:'flex:1;min-height:140px;background:#f5f9ff;border-radius:8px;padding:8px' }, [
      el('strong',{innerText:'Vessel (drop reagents)'})
    ]);
    vessel.addEventListener('dragover', e => e.preventDefault());
    vessel.addEventListener('drop', e => {
      e.preventDefault();
      const val = Number(e.dataTransfer.getData('text/plain') || 0);
      const p = el('div',{ innerText: 'Added: ' + val });
      p.dataset.value = val;
      vessel.appendChild(p);
      updateMiniGameProgress(step);
    });
    const controls = el('div', { style:'width:220px' });
    const checkBtn = el('button', { class:'primary', innerText:'Check mixture', onclick: () => checkMiniGame(step) });
    controls.appendChild(checkBtn);
    gameArea.appendChild(palette);
    gameArea.appendChild(vessel);
    gameArea.appendChild(controls);
    container.appendChild(gameArea);
  }

  function updateMiniGameProgress(step) {
    // placeholder — nothing heavy
  }

  function checkMiniGame(step) {
    const vessel = $('#vessel');
    const items = qs('[data-value]', vessel).map(n => Number(n.dataset.value));
    const sum = items.reduce((a,b)=>a+b,0);
    const out = el('div', { innerText: `Total concentration units: ${sum}` });
    vessel.appendChild(out);
    if (sum === step.target) {
      showModal('Success', `<p style="color:var(--success)">Target reached (${sum}). Good buffer prep practice.</p>`);
      awardBadge('Buffer Builder');
      markModuleProgressIfLastStep();
    } else {
      showModal('Check your mixture', `<p style="color:var(--danger)">Total ${sum}. Target ${step.target}. Re-evaluate.</p>`);
      state.errors++;
      saveState();
    }
  }

  // Quiz rendering
  function renderQuiz(questions, moduleId) {
    const container = $('#moduleContent');
    container.innerHTML = '';
    const form = el('form', { id:'quizForm' });
    questions.forEach((q, idx) => {
      const qWrap = el('fieldset', { });
      qWrap.appendChild(el('legend', { innerText: `${idx+1}. ${q.q}` }));
      q.a.forEach((opt, oi) => {
        const id = `q${idx}o${oi}`;
        const label = el('label', { for:id, innerText: opt, style:'display:block;margin:6px 0' });
        const input = el('input', { type:'radio', name:`q${idx}`, id, value:oi });
        label.insertBefore(input, label.firstChild);
        qWrap.appendChild(label);
      });
      form.appendChild(qWrap);
    });
    const submit = el('button', { class:'primary', innerText:'Submit Quiz', type:'button', onclick: () => gradeQuiz(questions, moduleId) });
    container.appendChild(form);
    container.appendChild(submit);
  }

  function gradeQuiz(questions, moduleId) {
    const form = $('#quizForm');
    let score = 0;
    questions.forEach((q, idx) => {
      const val = form[`q${idx}`] ? form[`q${idx}`].value : undefined;
      if (String(val) === String(q.correct)) score++;
    });
    const pct = Math.round((score / questions.length) * 100);
    announce(`Quiz scored ${pct}%`);
    showModal('Quiz Results', `<p>Your score: <strong>${pct}%</strong></p><p>${pct>=80?'<span style="color:var(--success)">Passed</span>':'<span style="color:var(--danger)">Failed</span>'}</p>`);
    if (pct >= 80) {
      awardBadge('Quiz Master');
      markModuleComplete(MODULES[currentModuleIndex].id);
    } else {
      state.errors++;
      saveState();
    }
  }

  function renderGownSim(step) {
    // Immediately proceed without the gowning simulation
    announce('Gowning step complete. You may continue.');
    awardBadge('Well Gowned');
    markModuleProgressIfLastStep();
  }

  // Modal
  function showModal(title, html) {
    $('#modalTitle').innerText = title;
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
    $('#modalClose').focus();
  }
  $('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));

  // Announce for screen readers
  function announce(msg) {
    sr.textContent = msg;
  }

  // Navigation buttons
  $('#backToDashboard').addEventListener('click', backToDashboard);
  $('#prevStep').addEventListener('click', () => {
    currentStepIndex = Math.max(0, currentStepIndex - 1);
    renderCurrentStep();
  });
  $('#nextStep').addEventListener('click', () => {
    const module = MODULES[currentModuleIndex];
    if (currentStepIndex < module.steps.length - 1) {
      currentStepIndex++;
      // Random chance for interruptions when moving steps to simulate multitasking
      maybeTriggerInterrupt();
      renderCurrentStep();
    } else {
      // end of module
      markModuleComplete(module.id);
    }
  });

  // Interrupts
  function maybeTriggerInterrupt() {
    if (Math.random() < 0.35) {
      const texts = [
        'Equipment alarm: pressure spike detected.',
        'Phone call from supervisor: need update.',
        'Maintenance requests sign-off for filter lot.'
      ];
      const t = texts[Math.floor(Math.random() * texts.length)];
      $('#interruptText').textContent = t;
      $('#interrupt').classList.remove('hidden');
      $('#interruptAcknowledge').focus();
    }
  }
  $('#interruptAcknowledge').addEventListener('click', () => {
    $('#interrupt').classList.add('hidden');
    announce('Interrupt acknowledged.');
  });

  // Mark module complete/progress
  function markModuleComplete(moduleId) {
    state.completed[moduleId] = true;
    saveState();
    updateProgressUI();
    showConfetti();
    announce(`Module ${moduleId} completed.`);
    // return to dashboard after a short delay
    setTimeout(backToDashboard, 800);
  }
  function markModuleProgressIfLastStep() {
    const module = MODULES[currentModuleIndex];
    const last = currentStepIndex >= module.steps.length - 1;
    if (last) markModuleComplete(module.id);
  }

  function awardBadge(name) {
    if (!state.badges.includes(name)) {
      state.badges.push(name);
      saveState();
      updateProgressUI();
      announce(`Badge earned: ${name}`);
    }
  }

  // Reset (use non-blocking in-app modal instead of native confirm)
  $('#resetBtn').addEventListener('click', () => {
    // Show a lightweight in-app confirmation using the existing modal element
    showModal('Reset progress', `<p>Reset all progress? This action cannot be undone.</p>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button id="modalCancelInline" class="secondary">Cancel</button>
        <button id="modalConfirmReset" class="primary">Reset</button>
      </div>`);

    // Wire the modal buttons (they are created dynamically)
    const confirmBtn = document.getElementById('modalConfirmReset');
    const cancelBtn = document.getElementById('modalCancelInline');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        state = JSON.parse(JSON.stringify(defaultState));
        saveState();
        renderDashboard();
        announce('Progress reset.');
        $('#modal').classList.add('hidden');
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        $('#modal').classList.add('hidden');
      });
    }
  });

  // High contrast toggle
  $('#contrastToggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('high-contrast');
    const pressed = document.documentElement.classList.contains('high-contrast');
    $('#contrastToggle').setAttribute('aria-pressed', pressed);
    announce(pressed ? 'High contrast enabled' : 'High contrast disabled');
  });

  // Reset route on load
  window.addEventListener('hashchange', handleHashChange);
  function handleHashChange() {
    const hash = location.hash.replace('#','');
    if (!hash) {
      $('#modulePage').classList.add('hidden');
      $('#dashboard').classList.remove('hidden');
      renderDashboard();
    } else {
      const idx = MODULES.findIndex(m => m.id === hash);
      if (idx >= 0) showModule(idx);
    }
  }

  // Finalize training
  function finalizeTraining() {
    const earned = state.badges.length;
    showModal('Training Complete', `<p>You earned ${earned} badges.</p><p>Errors logged: ${state.errors}. Review badges and revisit modules as needed.</p>`);
    awardBadge('Training Complete');
  }

  // ---------- Confetti ----------
  const confettiCanvas = $('#confettiCanvas');
  let confettiCtx = confettiCanvas.getContext && confettiCanvas.getContext('2d');
  let confettiParticles = [];
  function resizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  function spawnConfetti() {
    confettiParticles = [];
    for (let i=0;i<80;i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        r: 6 + Math.random() * 6,
        d: Math.random() * 50,
        color: ['#ff4d6d','#ffd24a','#6ee7b7','#7cc6ff'][Math.floor(Math.random()*4)],
        tilt: (Math.random() * 10) - 10,
        tiltAngleIncremental: 0.07 + Math.random() * 0.1
      });
    }
    if (confettiInterval) clearInterval(confettiInterval);
    confettiInterval = setInterval(renderConfetti, 1000/60);
    setTimeout(() => { clearInterval(confettiInterval); confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height); }, 2500);
  }
  let confettiInterval = null;
  function renderConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p => {
      p.tilt += p.tiltAngleIncremental;
      p.y += (Math.sin(p.d) + 3 + p.r/2);
      p.x += Math.sin(p.d);
      confettiCtx.fillStyle = p.color;
      confettiCtx.beginPath();
      confettiCtx.ellipse(p.x, p.y, p.r, p.r/2, p.tilt, 0, Math.PI * 2);
      confettiCtx.fill();
    });
  }
  function showConfetti() {
    spawnConfetti();
  }

  // ---------- Keyboard & accessibility ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('#modal').classList.add('hidden');
      $('#interrupt').classList.add('hidden');
    }
  });

  function focusMainContent() {
    const mc = $('#moduleContent');
    if (mc) mc.focus();
  }

  // ---------- Init ----------
  function init() {
    renderDashboard();
    // Wire nav from module ids in hash
    updateProgressUI();
    // initial hash handling
    if (location.hash) handleHashChange();
    // set up SR initial
    announce('GMP GDP trainer ready. Use dashboard to start modules.');
    // set up small periodic simulated interruptions if user stays long
    setInterval(() => {
      // low-frequency interrupts while inside module
      if (!$('#dashboard').classList.contains('hidden') ) return;
      if (Math.random() < 0.08) maybeTriggerInterrupt();
    }, 8000);
  }

  // Save before unload
  window.addEventListener('beforeunload', saveState);

  // Start app
  init();

  // Expose for debugging (dev)
  window.Trainer = { state, MODULES, saveState, showModal };

})();

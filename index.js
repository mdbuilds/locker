(function(){
  "use strict";

  // ---------- Mode presets ----------
  const MODES = [
    { id:'zen', name:'Zen', min:1, max:100, maxAttempts:null, timeLimit:null, perGuessTime:null,
      color:'teal', tagline:'No clock, no cap. Just you and the number.' },
    { id:'suddendeath', name:'Sudden Death', min:1, max:200, maxAttempts:6, timeLimit:null, perGuessTime:null,
      color:'pink', tagline:'6 guesses total. Make every one count.' },
    { id:'blitz', name:'Blitz', min:1, max:150, maxAttempts:null, timeLimit:45, perGuessTime:null,
      color:'yellow', tagline:'45 seconds on the clock. Guess as many times as you can.' },
    { id:'lightning', name:'Lightning', min:1, max:100, maxAttempts:12, timeLimit:null, perGuessTime:5,
      color:'orange', tagline:'5 seconds per guess. Think fast or lose the turn.' },
    { id:'insane', name:'Insane', min:1, max:1000, maxAttempts:8, timeLimit:60, perGuessTime:null,
      color:'purple', tagline:'8 guesses. 60 seconds. Whichever runs out first.' },
  ];
  const COLOR_VARS = { teal:'var(--teal)', pink:'var(--pink)', yellow:'var(--yellow)', orange:'var(--orange)', purple:'var(--purple)', blue:'var(--blue)' };
  const COLOR_SOFT = { teal:'#E4F7F4', pink:'#FFE3EC', yellow:'#FFF6DA', orange:'#FFE8DB', purple:'#EFE8FE', blue:'#E6F2FC' };

  // ---------- State ----------
  let state = {
    min:1, max:100, maxAttempts:null, timeLimit:null, perGuessTime:null,
    modeName:'Zen', modeColor:'teal',
    secret:0, attempts:0, history:[],
    rtLow:1, rtHigh:100,
    overallTimeLeft:0, perGuessTimeLeft:0,
  };
  let selectedModeId = 'zen';
  let usingCustom = false;
  let overallInterval = null;
  let perGuessInterval = null;

  // ---------- Elements ----------
  const el = {};
  [
    'modeGrid','customToggle','customPanel','customMin','customMax','formError','startBtn','newGameLink',
    'screen-menu','screen-game','screen-win','screen-lose',
    'modePill','statAttempts','statRemaining','statTimer','perGuessBar','pgFill',
    'rtValue','rtSegment','rtMin','rtMax',
    'feedbackBanner','guessForm','guessInput','guessBtn','historyRow',
    'winSecret','winAttempts','winScore','gradeStrip','playAgainBtn','changeDiffBtn',
    'loseBadge','loseTitle','loseSecret','loseSubtitle','tryAgainBtn','changeDiffBtn2',
    'mascot','mascotBack','mouth',
    'chkAttempts','valAttempts','chkTime','valTime','chkPerGuess','valPerGuess',
    'toggleAttempts','toggleTime','togglePerGuess',
  ].forEach(id => { el[id] = document.getElementById(id); });

  // ---------- Numeric-only filtering (avoids native number-input quirks) ----------
  function makeNumericOnly(input){
    input.addEventListener('input', () => {
      const cursor = input.selectionStart;
      const before = input.value;
      const cleaned = before.replace(/[^0-9]/g, '');
      if (cleaned !== before){
        input.value = cleaned;
        const diff = before.length - cleaned.length;
        const pos = Math.max(0, (cursor || cleaned.length) - diff);
        input.setSelectionRange(pos, pos);
      }
    });
  }
  [el.guessInput, el.customMin, el.customMax, el.valAttempts, el.valTime, el.valPerGuess].forEach(makeNumericOnly);

  // ---------- Accent color helper ----------
  function setAccent(colorKey){
    document.documentElement.style.setProperty('--accent', COLOR_VARS[colorKey] || COLOR_VARS.teal);
    document.documentElement.style.setProperty('--accent-soft', COLOR_SOFT[colorKey] || COLOR_SOFT.teal);
  }

  // ---------- Mode grid ----------
  function renderModeGrid(){
    el.modeGrid.innerHTML = '';
    MODES.forEach(m => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mode-card' + (m.id === selectedModeId && !usingCustom ? ' selected' : '');
      card.style.setProperty('--dot', COLOR_VARS[m.color]);
      card.style.setProperty('--sel-bg', COLOR_SOFT[m.color]);
      const tags = [];
      tags.push(`${m.min}–${m.max.toLocaleString()}`);
      if (m.maxAttempts) tags.push(`${m.maxAttempts} tries`);
      if (m.timeLimit) tags.push(`${m.timeLimit}s`);
      if (m.perGuessTime) tags.push(`${m.perGuessTime}s/guess`);
      card.innerHTML = `
        <div class="mode-name">${m.name}</div>
        <div class="mode-tagline">${m.tagline}</div>
        <div class="mode-meta">${tags.map(t => `<span class="mode-tag">${t}</span>`).join('')}</div>
      `;
      card.addEventListener('click', () => {
        usingCustom = false;
        selectedModeId = m.id;
        el.customPanel.classList.remove('open');
        el.customToggle.classList.remove('active');
        el.formError.classList.remove('show');
        setAccent(m.color);
        renderModeGrid();
      });
      el.modeGrid.appendChild(card);
    });
  }
  renderModeGrid();
  setAccent('teal');

  el.customToggle.addEventListener('click', () => {
    usingCustom = !usingCustom;
    el.customToggle.classList.toggle('active', usingCustom);
    el.customPanel.classList.toggle('open', usingCustom);
    el.formError.classList.remove('show');
    if (usingCustom) setAccent('blue');
    renderModeGrid();
  });

  function wireToggle(chk, line, input){
    chk.addEventListener('change', () => {
      line.classList.toggle('on', chk.checked);
      if (chk.checked) setTimeout(() => input.focus(), 50);
    });
  }
  wireToggle(el.chkAttempts, el.toggleAttempts, el.valAttempts);
  wireToggle(el.chkTime, el.toggleTime, el.valTime);
  wireToggle(el.chkPerGuess, el.togglePerGuess, el.valPerGuess);

  function showError(msg){
    el.formError.textContent = msg;
    el.formError.classList.remove('show');
    void el.formError.offsetWidth;
    el.formError.classList.add('show');
  }

  // ---------- Start game ----------
  el.startBtn.addEventListener('click', () => {
    let min, max, maxAttempts, timeLimit, perGuessTime, modeName, modeColor;

    if (usingCustom){
      min = parseInt(el.customMin.value, 10);
      max = parseInt(el.customMax.value, 10);
      if (isNaN(min) || isNaN(max)){ showError('Enter both a minimum and a maximum number.'); return; }
      if (min >= max){ showError('Max needs to be greater than min.'); return; }
      if (max - min > 1000000){ showError("Let's keep the range under a million, for both our sakes."); return; }

      maxAttempts = null; timeLimit = null; perGuessTime = null;
      if (el.chkAttempts.checked){
        maxAttempts = parseInt(el.valAttempts.value, 10);
        if (isNaN(maxAttempts) || maxAttempts < 1){ showError('Attempt limit needs to be at least 1.'); return; }
      }
      if (el.chkTime.checked){
        timeLimit = parseInt(el.valTime.value, 10);
        if (isNaN(timeLimit) || timeLimit < 5){ showError('Overall timer needs to be at least 5 seconds.'); return; }
      }
      if (el.chkPerGuess.checked){
        perGuessTime = parseInt(el.valPerGuess.value, 10);
        if (isNaN(perGuessTime) || perGuessTime < 2){ showError('Per-guess timer needs to be at least 2 seconds.'); return; }
      }
      modeName = 'Custom'; modeColor = 'blue';
    } else {
      const m = MODES.find(x => x.id === selectedModeId);
      min = m.min; max = m.max; maxAttempts = m.maxAttempts; timeLimit = m.timeLimit; perGuessTime = m.perGuessTime;
      modeName = m.name; modeColor = m.color;
    }

    beginRound(min, max, maxAttempts, timeLimit, perGuessTime, modeName, modeColor);
  });

  function beginRound(min, max, maxAttempts, timeLimit, perGuessTime, modeName, modeColor){
    clearTimers();
    state.min = min; state.max = max;
    state.maxAttempts = maxAttempts; state.timeLimit = timeLimit; state.perGuessTime = perGuessTime;
    state.modeName = modeName; state.modeColor = modeColor;
    state.secret = Math.floor(Math.random() * (max - min + 1)) + min;
    state.attempts = 0; state.history = [];
    state.rtLow = min; state.rtHigh = max;
    state.overallTimeLeft = timeLimit || 0;
    state.perGuessTimeLeft = perGuessTime || 0;

    setAccent(modeColor);

    const tagBits = [`${min.toLocaleString()}–${max.toLocaleString()}`];
    if (maxAttempts) tagBits.push(`${maxAttempts} tries`);
    if (timeLimit) tagBits.push(`${timeLimit}s`);
    if (perGuessTime) tagBits.push(`${perGuessTime}s/guess`);
    el.modePill.textContent = `${modeName} · ${tagBits.join(' · ')}`;

    el.statAttempts.textContent = '0';
    el.statAttempts.classList.remove('warn');
    el.statRemaining.textContent = maxAttempts ? maxAttempts : '∞';
    el.statTimer.textContent = timeLimit ? formatTime(timeLimit) : '—';
    el.statTimer.classList.remove('warn');
    el.feedbackBanner.className = 'feedback-banner';
    el.feedbackBanner.textContent = 'Make your first guess';
    el.historyRow.innerHTML = '<div class="history-empty">Your guesses will show up here</div>';
    el.guessInput.value = '';

    el.perGuessBar.classList.toggle('show', !!perGuessTime);
    if (perGuessTime) resetPerGuessTimer();

    updateRangeTracker();
    setMascotState('idle');
    showScreen('game');
    el.newGameLink.classList.add('visible');
    setTimeout(() => el.guessInput.focus(), 350);

    if (timeLimit) startOverallTimer();
  }

  function formatTime(sec){
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}s`;
  }

  // ---------- Timers ----------
  function clearTimers(){
    if (overallInterval){ clearInterval(overallInterval); overallInterval = null; }
    if (perGuessInterval){ clearInterval(perGuessInterval); perGuessInterval = null; }
  }

  function startOverallTimer(){
    overallInterval = setInterval(() => {
      state.overallTimeLeft--;
      el.statTimer.textContent = formatTime(state.overallTimeLeft);
      el.statTimer.classList.toggle('warn', state.overallTimeLeft <= 10);
      if (state.overallTimeLeft <= 0){
        clearTimers();
        handleLose('time');
      }
    }, 1000);
  }

  function resetPerGuessTimer(){
    if (perGuessInterval) clearInterval(perGuessInterval);
    state.perGuessTimeLeft = state.perGuessTime;
    el.pgFill.style.width = '100%';
    el.pgFill.style.background = 'var(--orange)';
    const totalMs = state.perGuessTime * 1000;
    const startTs = Date.now();
    perGuessInterval = setInterval(() => {
      const elapsed = Date.now() - startTs;
      const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
      el.pgFill.style.width = pct + '%';
      if (pct < 30) el.pgFill.style.background = 'var(--pink)';
      if (elapsed >= totalMs){
        clearInterval(perGuessInterval);
        handleMissedTurn();
      }
    }, 60);
  }

  function handleMissedTurn(){
    state.attempts++;
    el.statAttempts.textContent = state.attempts;
    if (state.maxAttempts) el.statRemaining.textContent = Math.max(0, state.maxAttempts - state.attempts);

    state.history.unshift({ guess: null, dir: 'miss' });
    renderHistory();

    el.feedbackBanner.classList.remove('pulse');
    void el.feedbackBanner.offsetWidth;
    el.feedbackBanner.innerHTML = `Too slow! Turn skipped ⏱`;
    el.feedbackBanner.classList.add('pulse');
    setMascotState('lose');
    setTimeout(() => { if (el.mascot.classList.contains('lose')) setMascotState('idle'); }, 700);

    el.guessInput.value = '';

    if (state.maxAttempts && state.attempts >= state.maxAttempts){
      clearTimers();
      handleLose('attempts');
      return;
    }
    resetPerGuessTimer();
  }

  // ---------- Screens ----------
  function showScreen(name){
    [el['screen-menu'], el['screen-game'], el['screen-win'], el['screen-lose']].forEach(s => s.classList.remove('active'));
    ({menu: el['screen-menu'], game: el['screen-game'], win: el['screen-win'], lose: el['screen-lose']})[name].classList.add('active');
    if (name === 'menu'){ el.newGameLink.classList.remove('visible'); setAccent(usingCustom ? 'blue' : (MODES.find(m=>m.id===selectedModeId)||{}).color || 'teal'); }
  }

  el.newGameLink.addEventListener('click', () => {
    clearTimers();
    showScreen('menu');
    setMascotState('idle');
  });
  el.changeDiffBtn.addEventListener('click', () => { clearTimers(); showScreen('menu'); });
  el.changeDiffBtn2.addEventListener('click', () => { clearTimers(); showScreen('menu'); });

  // ---------- Mascot ----------
  function setMascotState(s){
    el.mascot.className = 'mascot ' + s;
    el.mascot.classList.add('bump');
    setTimeout(() => el.mascot.classList.remove('bump'), 500);
  }

  // ---------- Range tracker ("poll") ----------
  function updateRangeTracker(){
    const span = state.max - state.min;
    const lowPct = span > 0 ? ((state.rtLow - state.min) / span) * 100 : 0;
    const highPct = span > 0 ? ((state.rtHigh - state.min) / span) * 100 : 100;
    el.rtSegment.style.left = lowPct + '%';
    el.rtSegment.style.width = Math.max(1.5, highPct - lowPct) + '%';
    el.rtValue.textContent = `${state.rtLow.toLocaleString()} – ${state.rtHigh.toLocaleString()}`;
    el.rtMin.textContent = state.min.toLocaleString();
    el.rtMax.textContent = state.max.toLocaleString();
  }

  // ---------- Guessing ----------
  function submitGuess(){
    const raw = el.guessInput.value.trim();
    if (raw === ''){
      el.guessInput.classList.add('shake');
      setTimeout(() => el.guessInput.classList.remove('shake'), 400);
      return;
    }
    const guess = parseInt(raw, 10);
    if (isNaN(guess) || guess < state.min || guess > state.max){
      el.guessInput.classList.add('shake');
      setTimeout(() => el.guessInput.classList.remove('shake'), 400);
      el.feedbackBanner.textContent = `Stay between ${state.min.toLocaleString()} and ${state.max.toLocaleString()}`;
      return;
    }

    state.attempts++;
    el.statAttempts.textContent = state.attempts;
    if (state.maxAttempts){
      const remaining = Math.max(0, state.maxAttempts - state.attempts);
      el.statRemaining.textContent = remaining;
      el.statAttempts.classList.toggle('warn', remaining <= 2);
    }

    if (guess === state.secret){
      state.history.unshift({ guess, dir: 'hit' });
      renderHistory();
      clearTimers();
      handleWin();
      return;
    }

    const dir = guess < state.secret ? 'low' : 'high';
    if (dir === 'low') state.rtLow = Math.max(state.rtLow, guess + 1);
    else state.rtHigh = Math.min(state.rtHigh, guess - 1);
    updateRangeTracker();

    state.history.unshift({ guess, dir });
    renderHistory();

    el.feedbackBanner.classList.remove('pulse');
    void el.feedbackBanner.offsetWidth;
    if (dir === 'low'){
      el.feedbackBanner.innerHTML = `Too low! Try a higher number <span class="arrow">↑</span>`;
      setMascotState('low');
    } else {
      el.feedbackBanner.innerHTML = `Too high! Try a lower number <span class="arrow">↓</span>`;
      setMascotState('high');
    }
    el.feedbackBanner.classList.add('pulse');

    el.guessInput.value = '';
    el.guessInput.focus();

    if (state.perGuessTime) resetPerGuessTimer();

    if (state.maxAttempts && state.attempts >= state.maxAttempts){
      clearTimers();
      handleLose('attempts');
    }
  }

  el.guessBtn.addEventListener('click', submitGuess);
  el.guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){ e.preventDefault(); submitGuess(); }
  });

  function renderHistory(){
    el.historyRow.innerHTML = '';
    state.history.forEach(h => {
      const chip = document.createElement('div');
      chip.className = 'history-chip' + (h.dir === 'miss' ? ' miss' : '');
      let icon = h.dir === 'low' ? '↑' : h.dir === 'high' ? '↓' : h.dir === 'miss' ? '⏱' : '✓';
      let label = h.dir === 'miss' ? 'miss' : h.guess;
      chip.innerHTML = `${label} <span>${icon}</span>`;
      el.historyRow.appendChild(chip);
    });
  }

  // ---------- Win ----------
  function calcScore(){
    const rangeSize = state.max - state.min + 1;
    const optimal = Math.max(1, Math.ceil(Math.log2(rangeSize)));
    const over = Math.max(0, state.attempts - optimal);
    return Math.max(5, Math.round(100 - over * 12));
  }

  function handleWin(){
    setMascotState('win');
    el.winSecret.textContent = state.secret.toLocaleString();
    el.winAttempts.textContent = state.attempts;
    const score = calcScore();
    el.winScore.textContent = score;

    el.gradeStrip.innerHTML = '';
    const dots = 5;
    const lit = Math.max(1, Math.round((score / 100) * dots));
    for (let i = 0; i < dots; i++){
      const dot = document.createElement('div');
      dot.className = 'grade-dot' + (i < lit ? ' on' : '');
      el.gradeStrip.appendChild(dot);
    }

    showScreen('win');
    launchConfetti();
  }

  function startWithSameSettings(){
    beginRound(state.min, state.max, state.maxAttempts, state.timeLimit, state.perGuessTime, state.modeName, state.modeColor);
  }
  el.playAgainBtn.addEventListener('click', startWithSameSettings);
  el.tryAgainBtn.addEventListener('click', startWithSameSettings);

  // ---------- Lose ----------
  function handleLose(reason){
    setMascotState('lose');
    el.loseSecret.textContent = state.secret.toLocaleString();
    if (reason === 'time'){
      el.loseBadge.textContent = 'Out of time';
      el.loseTitle.textContent = "Time's up! ⏰";
      el.loseSubtitle.textContent = 'The clock beat you to it. Try a tighter search strategy next round.';
    } else {
      el.loseBadge.textContent = 'Out of attempts';
      el.loseTitle.textContent = 'So close… 😵';
      el.loseSubtitle.textContent = 'You used every guess you had. Narrow your range faster next time.';
    }
    showScreen('lose');
  }

  // ---------- Confetti ----------
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let confettiRunning = false;
  function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const CONFETTI_COLORS = ['#FF5A8A', '#FFC93C', '#17B8A6', '#FF7A3D', '#8B5CF6', '#4FA3E3'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function launchConfetti(){
    if (reduceMotion) return;
    const count = 100;
    for (let i = 0; i < count; i++){
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 130,
        y: canvas.height * 0.28,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -9 - 4,
        size: Math.random() * 8 + 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        life: 0,
      });
    }
    if (!confettiRunning){ confettiRunning = true; requestAnimationFrame(tickConfetti); }
  }

  function tickConfetti(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.rot += p.vrot; p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, 1 - p.life / 160);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size*0.6);
      else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    particles = particles.filter(p => p.life < 160 && p.y < canvas.height + 40);
    if (particles.length > 0) requestAnimationFrame(tickConfetti);
    else { confettiRunning = false; ctx.clearRect(0,0,canvas.width,canvas.height); }
  }

  // ---------- Idle blink ----------
  setInterval(() => {
    if (!el.mascot.classList.contains('idle')) return;
    el.mascot.querySelectorAll('.eye').forEach(e => e.style.transform = 'scaleY(0.15)');
    setTimeout(() => { el.mascot.querySelectorAll('.eye').forEach(e => e.style.transform = 'scaleY(1)'); }, 130);
  }, 3600);

})();
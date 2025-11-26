(function(){
  const steps = Array.from(document.querySelectorAll('.survey-step'));
  const nextBtn = document.getElementById('next-btn');
  const prevBtn = document.getElementById('prev-btn');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const verticalFill = document.getElementById('vertical-fill');
  const surveyClose = document.getElementById('survey-close');
  const summary = document.querySelector('.summary');

  let current = 0;
  const answers = {};

  function showStep(i){
    steps.forEach((s, idx)=>{
      s.hidden = idx !== i;
    });
    current = i;
    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === steps.length-1 ? 'Завершить' : 'Далее →';
    updateProgress();
    updateNextState();
    updateHeader();
    if(current === steps.length-1){ renderSummary() }
  }

  function updateHeader(){
    const title = document.getElementById('survey-title');
    const h = steps[current].querySelector('.step-question') || title;
    if(h && h.textContent) title.textContent = h.textContent === '' ? 'Опрос' : (current===0 ? 'Выберите, что вы хотите сделать' : h.textContent);
  }

  function updateProgress(){
    const pct = Math.round((current)/(steps.length-1)*100);
    progressFill.style.width = pct + '%';
    progressPercent.textContent = pct + '%';
    verticalFill.style.height = pct + '%';
  }

  function updateNextState(){
    // enable next only if answer selected for current (except summary)
    if(current === 0){
      const any = Array.from(steps[current].querySelectorAll('.option-card.active')).length > 0;
      nextBtn.disabled = !any;
    } else if(current < steps.length-1){
      const radios = steps[current].querySelectorAll('input[type=radio]');
      if(radios.length){
        const any = Array.from(radios).some(r=>r.checked);
        nextBtn.disabled = !any;
      } else {
        nextBtn.disabled = false;
      }
    } else {
      nextBtn.disabled = false;
    }
  }

  // Step 1: option-card clicks
  document.querySelectorAll('.option-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      // single-select behavior
      document.querySelectorAll('.option-card').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      answers['goal'] = btn.dataset.value;
      updateNextState();
    });
  });

  // radio inputs change
  document.querySelectorAll('.survey-step input[type=radio]').forEach(r=>{
    r.addEventListener('change', (e)=>{
      const name = e.target.name;
      answers[name] = e.target.value;
      updateNextState();
    });
  });

  nextBtn.addEventListener('click', ()=>{
    if(current < steps.length-1){
      // if no selection, do nothing
      if(nextBtn.disabled) return;
      showStep(current+1);
    } else {
      // finish
      // here you can post answers to server or redirect
      alert('Опрос завершен. Ответы: ' + JSON.stringify(answers));
      // close or redirect
      window.location.href = '/html/editor/index.html';
    }
  });

  prevBtn.addEventListener('click', ()=>{
    if(current > 0) showStep(current-1);
  });

  surveyClose.addEventListener('click', ()=>{
    window.history.back();
  });

  function renderSummary(){
    summary.innerHTML = '';
    for(const k in answers){
      const el = document.createElement('div');
      el.textContent = k + ': ' + answers[k];
      summary.appendChild(el);
    }
  }

  // initialize
  showStep(0);
})();

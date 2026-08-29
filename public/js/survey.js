(function() {
  'use strict';

  const form = document.getElementById('survey-form');
  if (!form) return;

  // ── Visual feedback when questions are answered ──────────────
  function updateQuestionState(input) {
    const block = input.closest('.question-block');
    if (!block) return;
    const checked = block.querySelector('input[type="radio"]:checked');
    if (checked) block.classList.add('answered');
    else block.classList.remove('answered');
  }

  document.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener('change', () => updateQuestionState(input));
  });

  // ── Progress indicator ───────────────────────────────────────
  const totalQuestions = 30;

  function getAnsweredCount() {
    const answered = new Set();
    document.querySelectorAll('input[type="radio"]:checked').forEach(input => {
      const match = input.name.match(/^q_(\d+)$/);
      if (match) answered.add(parseInt(match[1]));
    });
    return answered.size;
  }

  // ── Submission ───────────────────────────────────────────────
  const submitBtn = document.getElementById('submit-btn');
  const submitError = document.getElementById('submit-error');

  form.addEventListener('submit', function(e) {
    const answered = getAnsweredCount();

    if (answered < totalQuestions) {
      e.preventDefault();
      const missing = totalQuestions - answered;
      submitError.textContent = `Please answer all ${totalQuestions} questions. You have ${missing} question${missing===1?'':'s'} remaining.`;
      submitError.classList.remove('hidden');

      // Scroll to first unanswered question
      const firstUnanswered = findFirstUnanswered();
      if (firstUnanswered) {
        firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstUnanswered.style.borderColor = '#A94442';
        setTimeout(() => { firstUnanswered.style.borderColor = ''; }, 3000);
      }
      return;
    }

    // Disable button to prevent double submit
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    submitError.classList.add('hidden');
  });

  function findFirstUnanswered() {
    for (let n = 1; n <= totalQuestions; n++) {
      const checked = document.querySelector(`input[name="q_${n}"]:checked`);
      if (!checked) {
        return document.getElementById(`qb-${n}`);
      }
    }
    return null;
  }

  // ── Smooth scroll nav ────────────────────────────────────────
  // Add keyboard navigation between scale options
  document.querySelectorAll('.scale-row').forEach(row => {
    const options = row.querySelectorAll('input[type="radio"]');
    options.forEach((input, idx) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = options[idx + 1];
          if (next) { next.checked = true; next.focus(); updateQuestionState(next); }
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = options[idx - 1];
          if (prev) { prev.checked = true; prev.focus(); updateQuestionState(prev); }
        }
      });
    });
  });

})();

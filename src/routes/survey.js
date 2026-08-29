const express  = require('express');
const router   = express.Router();
const supabase = require('../db/client');
const { SECTIONS, SCALE_LABELS } = require('../questions');

// GET /survey/:token — show the survey form
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Look up rater by token
    const { data: rater, error } = await supabase
      .from('raters')
      .select('*, leaders(name, title, cycle_id, cycles(name, status))')
      .eq('token', token)
      .single();

    if (error || !rater) {
      return res.status(404).send(errorPage('Survey link not found. Please check your email for the correct link.'));
    }

    // Already completed
    if (rater.completed_at) {
      return res.send(completedPage(rater.leaders.name));
    }

    // Cycle must be active
    if (rater.leaders.cycles.status !== 'active') {
      return res.send(errorPage('This survey is not currently open. Please contact your HR team.'));
    }

    // For self-raters, questions use first person. For others, third person.
    const isSelf = rater.rater_group === 'self';

    res.send(surveyPage(rater, SECTIONS, isSelf, SCALE_LABELS));

  } catch (err) {
    console.error('Survey load error:', err);
    res.status(500).send(errorPage('Something went wrong loading your survey. Please try again.'));
  }
});

// POST /survey/:token — submit responses
router.post('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const body = req.body;

    // Verify rater
    const { data: rater, error } = await supabase
      .from('raters')
      .select('*, leaders(name, cycle_id, cycles(status))')
      .eq('token', token)
      .single();

    if (error || !rater) return res.status(404).send(errorPage('Invalid survey link.'));
    if (rater.completed_at) return res.send(completedPage(rater.leaders.name));
    if (rater.leaders.cycles.status !== 'active') return res.status(400).send(errorPage('Survey is not active.'));

    const leaderId = rater.leader_id;
    const raterId  = rater.id;

    // Build response rows from form data
    // Form fields: q_1, q_2, ... q_30 (scores)
    // Open text: ot_honor, ot_own, ot_model, ot_empower, ot_strengthen, ot_strategic, ot_values
    // SSC: start, stop, continue

    const responseRows = [];
    for (const section of SECTIONS) {
      for (const q of section.questions) {
        const score = parseInt(body[`q_${q.n}`]);
        if (score >= 1 && score <= 5) {
          responseRows.push({
            rater_id: raterId,
            leader_id: leaderId,
            question_number: q.n,
            section: section.id,
            score
          });
        }
      }
    }

    const openTextRows = SECTIONS.map(s => ({
      rater_id:  raterId,
      leader_id: leaderId,
      section:   s.id,
      response:  (body[`ot_${s.id}`] || '').trim() || null
    })).filter(r => r.response);

    const sscRow = {
      rater_id:      raterId,
      leader_id:     leaderId,
      start_text:    (body.start   || '').trim() || null,
      stop_text:     (body.stop    || '').trim() || null,
      continue_text: (body.continue || '').trim() || null
    };

    // Validate — must have answered all scored questions
    if (responseRows.length < 30) {
      return res.send(errorPage(`Please answer all questions. You answered ${responseRows.length} of 30.`));
    }

    // Insert everything
    const [r1, r2, r3] = await Promise.all([
      supabase.from('responses').insert(responseRows),
      openTextRows.length ? supabase.from('open_text').insert(openTextRows) : Promise.resolve(),
      supabase.from('start_stop_continue').insert([sscRow])
    ]);

    if (r1.error) throw r1.error;

    // Mark rater complete
    await supabase.from('raters').update({ completed_at: new Date().toISOString() }).eq('id', raterId);

    res.send(thankYouPage(rater.leaders.name));

  } catch (err) {
    console.error('Survey submit error:', err);
    res.status(500).send(errorPage('Something went wrong saving your responses. Please try again.'));
  }
});

// ── HTML BUILDERS ─────────────────────────────────────────────────────────────

function surveyPage(rater, sections, isSelf, scaleLabels) {
  const leaderName = rater.leaders.name;
  const groupLabel = {
    self: 'Self Assessment', supervisor: 'Supervisor', peer: 'Peer',
    direct_report: 'Direct Report', skip_level: 'Skip-Level'
  }[rater.rater_group] || rater.rater_group;

  // Flip first-person to third-person for non-self raters
  function qText(text) {
    if (isSelf) return text;
    return text
      .replace(/^I treat /,   'This leader treats ')
      .replace(/^I ensure /,  'This leader ensures ')
      .replace(/^I build /,   'This leader builds ')
      .replace(/^I make /,    'This leader makes ')
      .replace(/^I take /,    'This leader takes ')
      .replace(/^When something/, 'When something')
      .replace(/^I focus /,   'This leader focuses ')
      .replace(/^I proactively/, 'This leader proactively')
      .replace(/^I follow /,  'This leader follows ')
      .replace(/^I keep /,    'This leader keeps ')
      .replace(/^My daily /,  'This leader\'s daily ')
      .replace(/^My team /,   'This leader\'s team ')
      .replace(/^There is no gap between what I say/, 'There is no gap between what this leader says')
      .replace(/^I act /,     'This leader acts ')
      .replace(/^When I make/, 'When this leader makes')
      .replace(/^When my team/, 'When this leader\'s team')
      .replace(/^I listen /,  'This leader listens ')
      .replace(/^I delegate/, 'This leader delegates')
      .replace(/^When someone/, 'When someone')
      .replace(/^People can/, 'People can')
      .replace(/^I invest /,  'This leader invests ')
      .replace(/^I know /,    'This leader knows ')
      .replace(/^I identify/, 'This leader identifies')
      .replace(/^The feedback I give/, 'The feedback this leader gives')
      .replace(/^I coach /,   'This leader coaches ')
      .replace(/^I think /,   'This leader thinks ')
      .replace(/^I connect /,'This leader connects ')
      .replace(/^I actively/, 'This leader actively')
      .replace(/^I make /,    'This leader makes ')
      // Section 7 is already third person
      .replace(/ my /g, ' this leader\'s ')
      .replace(/ I /g,  ' this leader ')
      .replace(/ me\b/g,' this leader');
  }

  const sectionsHTML = sections.map(s => `
    <div class="survey-section" id="section-${s.id}">
      <div class="section-badge">Section ${s.number} of ${sections.length}</div>
      <h2 class="section-title">${s.title}</h2>
      <p class="section-subtitle">${s.subtitle}</p>

      <div class="questions">
        ${s.questions.map(q => `
          <div class="question-block" id="qb-${q.n}">
            <div class="question-text">
              <span class="q-num">${q.n}.</span>
              ${qText(q.text)}
            </div>
            <div class="scale-row">
              ${[1,2,3,4,5].map(v => `
                <label class="scale-option">
                  <input type="radio" name="q_${q.n}" value="${v}" required>
                  <span class="scale-dot"></span>
                  <span class="scale-val">${v}</span>
                  <span class="scale-lbl">${scaleLabels[v]}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="open-text-block">
        <label class="ot-label" for="ot-${s.id}">Open Text — optional</label>
        <p class="ot-prompt">${s.openText}</p>
        <textarea id="ot-${s.id}" name="ot_${s.id}" rows="3" placeholder="Share any specific examples or additional context..."></textarea>
      </div>
    </div>
  `).join('<div class="section-divider"></div>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>360 Survey — ${leaderName}</title>
<link rel="stylesheet" href="/css/survey.css"/>
</head>
<body>
<header class="survey-header">
  <div class="header-inner">
    <div class="header-brand">SEKISUI HOUSE &nbsp;·&nbsp; 360 Leadership Survey</div>
    <div class="header-context">
      <span class="context-label">Evaluating:</span>
      <span class="context-name">${leaderName}</span>
      <span class="context-sep">·</span>
      <span class="context-group">${groupLabel}</span>
    </div>
  </div>
</header>

<div class="survey-container">
  <div class="survey-intro">
    <h1>Your feedback matters.</h1>
    <p>You've been asked to provide 360 feedback for <strong>${leaderName}</strong>. This is a developmental tool — your responses help this leader understand how their leadership is experienced and where they have the greatest opportunity to grow.</p>
    <p>All responses are <strong>anonymous</strong>. Answer based on your direct, observed experience. The open-text sections are optional but are often the most valuable part of the feedback.</p>
    <div class="scale-legend">
      <div class="legend-title">Rating Scale</div>
      <div class="legend-items">
        ${[1,2,3,4,5].map(v=>`<div class="legend-item"><span class="legend-num">${v}</span><span>${scaleLabels[v]}</span></div>`).join('')}
      </div>
    </div>
  </div>

  <form method="POST" action="/survey/${rater.token}" id="survey-form" novalidate>
    ${sectionsHTML}

    <div class="section-divider"></div>

    <!-- Start Stop Continue -->
    <div class="survey-section" id="section-ssc">
      <div class="section-badge">Final Question</div>
      <h2 class="section-title">Start, Stop, Continue</h2>
      <p class="section-subtitle">Please share one specific thing you would like this leader to Start doing, one thing to Stop doing, and one thing to Continue doing. Be as specific as possible.</p>

      <div class="ssc-block">
        <div class="ssc-item">
          <label class="ssc-label ssc-start">▲ Start</label>
          <p class="ssc-prompt">Something this leader is not currently doing that would make them more effective.</p>
          <textarea name="start" rows="2" placeholder="Be specific about the behavior..."></textarea>
        </div>
        <div class="ssc-item">
          <label class="ssc-label ssc-stop">■ Stop</label>
          <p class="ssc-prompt">Something this leader is doing that is getting in the way of their effectiveness or the team's.</p>
          <textarea name="stop" rows="2" placeholder="Be specific about the behavior..."></textarea>
        </div>
        <div class="ssc-item">
          <label class="ssc-label ssc-continue">● Continue</label>
          <p class="ssc-prompt">Something this leader is doing well that they should keep doing — and ideally do more of.</p>
          <textarea name="continue" rows="2" placeholder="Be specific about the behavior..."></textarea>
        </div>
      </div>
    </div>

    <div class="submit-block">
      <p class="submit-note">Once submitted your responses cannot be changed. Please review before submitting.</p>
      <button type="submit" class="submit-btn" id="submit-btn">Submit My Feedback</button>
      <div id="submit-error" class="submit-error hidden"></div>
    </div>
  </form>
</div>

<script src="/js/survey.js"></script>
</body>
</html>`;
}

function completedPage(leaderName) {
  return statusPage('✓', 'Already submitted', `You have already completed the 360 feedback for <strong>${leaderName}</strong>. Thank you for your contribution.`, '#1F6B3A');
}

function thankYouPage(leaderName) {
  return statusPage('✓', 'Feedback submitted', `Thank you. Your feedback for <strong>${leaderName}</strong> has been received. Your responses are anonymous and will be included in their development report.`, '#1F6B3A');
}

function errorPage(msg) {
  return statusPage('!', 'Something went wrong', msg, '#A94442');
}

function statusPage(icon, title, msg, color) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#F7F9FC;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#fff;border-radius:8px;padding:48px 56px;max-width:520px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-top:4px solid ${color}}
  .icon{font-size:48px;color:${color};margin-bottom:16px}.title{font-size:22px;font-weight:bold;color:#1F3864;margin-bottom:12px}.msg{font-size:14px;color:#595959;line-height:1.7}
  .brand{margin-top:32px;font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase}</style></head>
  <body><div class="card"><div class="icon">${icon}</div><div class="title">${title}</div><div class="msg">${msg}</div>
  <div class="brand">Sekisui House US &nbsp;·&nbsp; 360 Leadership Survey</div></div></body></html>`;
}

module.exports = router;

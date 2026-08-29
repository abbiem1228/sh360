const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM    = process.env.FROM_EMAIL || 'noreply@sekisuihouse.com';

async function sendRaterInvite(rater, leader) {
  const surveyUrl = `${APP_URL}/survey/${rater.token}`;
  const isSelf    = rater.rater_group === 'self';

  const subject = isSelf
    ? `Your 360 Self-Assessment is ready — ${leader.name}`
    : `You've been asked to give 360 feedback for ${leader.name}`;

  const greeting = isSelf
    ? `Hi ${rater.name},`
    : `Hi ${rater.name},`;

  const intro = isSelf
    ? `As part of the Sekisui House US leadership development process, your 360 self-assessment is ready. This is your opportunity to reflect honestly on your own leadership and see how your perspective compares with those around you.`
    : `You've been selected to provide 360 feedback for <strong>${leader.name}</strong>${leader.title ? ` (${leader.title})` : ''}. Your feedback is anonymous, developmental in purpose, and genuinely valued.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#F2F6FA;margin:0;padding:40px 20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  
  <div style="background:#1F3864;padding:28px 36px">
    <div style="color:#9FB5CC;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Sekisui House US</div>
    <div style="color:#fff;font-size:20px;font-weight:bold">360 Leadership Survey</div>
  </div>

  <div style="padding:36px">
    <p style="color:#1a1a1a;font-size:14px;margin-bottom:16px">${greeting}</p>
    <p style="color:#333;font-size:14px;line-height:1.8;margin-bottom:24px">${intro}</p>

    <div style="background:#F7F9FC;border-left:4px solid #2E75B6;padding:14px 18px;border-radius:0 4px 4px 0;margin-bottom:28px">
      <div style="font-size:11px;font-weight:bold;color:#595959;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">What to expect</div>
      <ul style="margin:0;padding-left:18px;color:#333;font-size:13px;line-height:2">
        <li>30 questions across 7 sections — approximately 10 minutes</li>
        <li>Rating scale of 1 (Strongly Disagree) to 5 (Strongly Agree)</li>
        <li>Optional open-text feedback after each section</li>
        <li>One final Start / Stop / Continue question</li>
      </ul>
    </div>

    <div style="text-align:center;margin-bottom:28px">
      <a href="${surveyUrl}" style="display:inline-block;background:#2E75B6;color:#fff;padding:14px 36px;border-radius:4px;font-size:15px;font-weight:bold;text-decoration:none">
        ${isSelf ? 'Begin Self-Assessment' : 'Begin Survey'}
      </a>
    </div>

    <p style="color:#595959;font-size:12px;line-height:1.7">
      ${isSelf ? 'Your responses are stored securely and will be combined with feedback from your raters to create your full report.' 
               : 'Your responses are <strong>completely anonymous</strong>. Individual responses are never shared — only aggregate patterns are reported.'}
    </p>

    <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <span style="color:#2E75B6">${surveyUrl}</span>
    </p>
  </div>

  <div style="background:#F2F6FA;padding:16px 36px;text-align:center">
    <p style="color:#aaa;font-size:11px;margin:0">Sekisui House US &nbsp;·&nbsp; H.O.M.E.S. Leadership Blueprint &nbsp;·&nbsp; 360 Leadership Survey</p>
  </div>
</div>
</body>
</html>`;

  const text = `${greeting}\n\n${intro.replace(/<[^>]+>/g,'')}\n\nComplete your survey here: ${surveyUrl}\n\nThis link is unique to you. The survey takes approximately 10 minutes.\n\nSekisui House US`;

  await resend.emails.send({
    from: FROM,
    to:   rater.email,
    subject,
    html,
    text
  });
}

module.exports = { sendRaterInvite };

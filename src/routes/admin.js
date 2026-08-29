const express  = require('express');
const router   = express.Router();
const supabase = require('../db/client');
const { nanoid } = require('nanoid');
const { sendRaterInvite } = require('../email');

// ── Auth middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.adminAuth) return next();
  res.redirect('/admin/login');
}

// ── Login ─────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  res.send(loginPage(req.query.error));
});

router.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.adminAuth = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── Dashboard ─────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { data: cycles } = await supabase
    .from('cycles')
    .select('*, leaders(count)')
    .order('created_at', { ascending: false });

  res.send(dashboardPage(cycles || []));
});

// ── Cycles ────────────────────────────────────────────────────
router.get('/cycles/new', requireAuth, (req, res) => {
  res.send(cycleFormPage());
});

router.post('/cycles', requireAuth, async (req, res) => {
  const { name, description, opens_at, closes_at } = req.body;
  await supabase.from('cycles').insert([{ name, description, opens_at: opens_at||null, closes_at: closes_at||null }]);
  res.redirect('/admin');
});

router.post('/cycles/:id/status', requireAuth, async (req, res) => {
  await supabase.from('cycles').update({ status: req.body.status }).eq('id', req.params.id);
  res.redirect(`/admin/cycles/${req.params.id}`);
});

// ── Cycle detail ──────────────────────────────────────────────
router.get('/cycles/:id', requireAuth, async (req, res) => {
  const { data: cycle } = await supabase.from('cycles').select('*').eq('id', req.params.id).single();
  if (!cycle) return res.redirect('/admin');

  const { data: leaders } = await supabase
    .from('leaders')
    .select('*, raters(id, rater_group, completed_at, email_sent_at)')
    .eq('cycle_id', req.params.id)
    .order('name');

  res.send(cycleDetailPage(cycle, leaders || []));
});

// ── Leaders ───────────────────────────────────────────────────
router.get('/cycles/:cycleId/leaders/new', requireAuth, (req, res) => {
  res.send(leaderFormPage(req.params.cycleId));
});

router.post('/cycles/:cycleId/leaders', requireAuth, async (req, res) => {
  const { name, title, email, department } = req.body;
  const { data: leader } = await supabase
    .from('leaders')
    .insert([{ cycle_id: req.params.cycleId, name, title, email, department }])
    .select()
    .single();

  // Auto-create self rater
  if (leader) {
    await supabase.from('raters').insert([{
      leader_id: leader.id,
      name, email,
      rater_group: 'self',
      token: nanoid(24)
    }]);
  }

  res.redirect(`/admin/cycles/${req.params.cycleId}`);
});

// ── Raters ────────────────────────────────────────────────────
router.get('/leaders/:leaderId/raters/new', requireAuth, async (req, res) => {
  const { data: leader } = await supabase.from('leaders').select('*').eq('id', req.params.leaderId).single();
  res.send(raterFormPage(leader));
});

router.post('/leaders/:leaderId/raters', requireAuth, async (req, res) => {
  const { leaderId } = req.params;
  const { data: leader } = await supabase.from('leaders').select('cycle_id').eq('id', leaderId).single();

  // Support bulk add — one rater per line (name, email, group)
  const lines = (req.body.raters_text || '').trim().split('\n').filter(l => l.trim());
  const rows = [];

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      rows.push({
        leader_id:   leaderId,
        name:        parts[0],
        email:       parts[1],
        rater_group: parts[2],
        token:       nanoid(24)
      });
    }
  }

  if (rows.length) {
    await supabase.from('raters').insert(rows);
  }

  res.redirect(`/admin/cycles/${leader.cycle_id}`);
});

// ── Send emails ───────────────────────────────────────────────
router.post('/leaders/:leaderId/send-invites', requireAuth, async (req, res) => {
  const { leaderId } = req.params;
  const { data: leader } = await supabase.from('leaders').select('*, cycles(name)').eq('id', leaderId).single();
  const { data: raters } = await supabase.from('raters').select('*').eq('leader_id', leaderId).is('email_sent_at', null);

  if (raters && raters.length) {
    for (const rater of raters) {
      await sendRaterInvite(rater, leader);
      await supabase.from('raters').update({ email_sent_at: new Date().toISOString() }).eq('id', rater.id);
    }
  }

  const { data: l } = await supabase.from('leaders').select('cycle_id').eq('id', leaderId).single();
  res.redirect(`/admin/cycles/${l.cycle_id}?sent=1`);
});

// ── Generate report ───────────────────────────────────────────
router.post('/leaders/:leaderId/generate-report', requireAuth, async (req, res) => {
  res.redirect(`/report/generate/${req.params.leaderId}`);
});

// ── View leader detail ────────────────────────────────────────
router.get('/leaders/:leaderId', requireAuth, async (req, res) => {
  const { data: leader } = await supabase
    .from('leaders')
    .select('*, cycles(name,status)')
    .eq('id', req.params.leaderId)
    .single();

  const { data: raters } = await supabase
    .from('raters')
    .select('*')
    .eq('leader_id', req.params.leaderId)
    .order('rater_group');

  const { data: report } = await supabase
    .from('reports')
    .select('id, generated_at')
    .eq('leader_id', req.params.leaderId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const completedCount  = (raters||[]).filter(r=>r.completed_at).length;
  const totalCount      = (raters||[]).length;

  res.send(leaderDetailPage(leader, raters||[], report, completedCount, totalCount));
});

// ── Delete rater ──────────────────────────────────────────────
router.post('/raters/:raterId/delete', requireAuth, async (req, res) => {
  const { data: rater } = await supabase.from('raters').select('leader_id, leaders(cycle_id)').eq('id', req.params.raterId).single();
  await supabase.from('raters').delete().eq('id', req.params.raterId);
  res.redirect(`/admin/leaders/${rater.leader_id}`);
});


// ═══════════════════════════════════════════════════════════════
// HTML PAGES
// ═══════════════════════════════════════════════════════════════

const CSS = `
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#F2F6FA;color:#1a1a1a;font-size:14px}
a{color:#2E75B6;text-decoration:none}a:hover{text-decoration:underline}

/* Admin shell */
.admin-nav{background:#1F3864;padding:0 32px;display:flex;align-items:center;gap:32px;height:52px}
.nav-brand{color:#fff;font-weight:bold;font-size:15px;letter-spacing:0.5px}
.nav-link{color:#9FB5CC;font-size:13px;transition:color 0.2s}
.nav-link:hover{color:#fff;text-decoration:none}
.nav-spacer{flex:1}
.admin-main{max-width:1100px;margin:0 auto;padding:32px 24px}

/* Cards */
.card{background:#fff;border-radius:6px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.card-title{font-size:16px;font-weight:bold;color:#1F3864}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;border:none;transition:opacity 0.15s}
.btn:hover{opacity:0.88;text-decoration:none}
.btn-primary{background:#2E75B6;color:#fff}
.btn-navy{background:#1F3864;color:#fff}
.btn-green{background:#1F6B3A;color:#fff}
.btn-red{background:#A94442;color:#fff}
.btn-outline{background:transparent;color:#2E75B6;border:1px solid #2E75B6}
.btn-sm{padding:5px 11px;font-size:12px}

/* Tables */
.data-table{width:100%;border-collapse:collapse}
.data-table th{background:#1F3864;color:#fff;padding:10px 14px;text-align:left;font-size:12px;letter-spacing:0.5px;text-transform:uppercase}
.data-table td{padding:10px 14px;border-bottom:1px solid #eee;font-size:13px}
.data-table tr:last-child td{border-bottom:none}
.data-table tr:hover td{background:#F7F9FC}

/* Status badges */
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px}
.badge-draft{background:#E8E8E8;color:#595959}
.badge-active{background:#D4EDDA;color:#155724}
.badge-closed{background:#F8D7DA;color:#721C24}
.badge-complete{background:#D4EDDA;color:#155724}
.badge-pending{background:#FFF3CD;color:#856404}

/* Progress bar */
.progress-bar{height:6px;background:#E8E8E8;border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:#2E75B6;border-radius:3px;transition:width 0.3s}

/* Forms */
.form-group{margin-bottom:18px}
.form-label{display:block;font-size:13px;font-weight:bold;color:#1F3864;margin-bottom:6px}
.form-control{width:100%;padding:9px 12px;border:1px solid #C8D8E8;border-radius:4px;font-size:14px;font-family:Arial}
.form-control:focus{outline:none;border-color:#2E75B6;box-shadow:0 0 0 3px rgba(46,117,182,0.15)}
select.form-control{cursor:pointer}
.form-hint{font-size:12px;color:#595959;margin-top:4px}

/* Stats row */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px}
.stat-card{background:#fff;border-radius:6px;padding:18px 20px;border-left:4px solid #2E75B6;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.stat-num{font-size:28px;font-weight:bold;color:#1F3864}
.stat-lbl{font-size:12px;color:#595959;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px}

.page-title{font-size:22px;font-weight:bold;color:#1F3864;margin-bottom:6px}
.page-sub{font-size:14px;color:#595959;margin-bottom:24px}
.actions-row{display:flex;gap:10px;flex-wrap:wrap}
.section-label{font-size:11px;font-weight:bold;color:#595959;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}

/* Alert */
.alert{padding:12px 16px;border-radius:4px;margin-bottom:16px;font-size:13px}
.alert-success{background:#D4EDDA;color:#155724;border:1px solid #C3E6CB}
.alert-error{background:#F8D7DA;color:#721C24;border:1px solid #F5C6CB}
</style>`;

function adminShell(title, content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — SH360 Admin</title>${CSS}</head><body>
  <nav class="admin-nav">
    <span class="nav-brand">SH360</span>
    <a href="/admin" class="nav-link">Dashboard</a>
    <div class="nav-spacer"></div>
    <a href="/admin/logout" class="nav-link">Log out</a>
  </nav>
  <div class="admin-main">${content}</div></body></html>`;
}

function loginPage(error) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SH360 Admin Login</title>${CSS}
  <style>.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center}
  .login-card{background:#fff;border-radius:8px;padding:48px;width:380px;box-shadow:0 4px 24px rgba(0,0,0,0.1);border-top:4px solid #1F3864}
  .login-title{font-size:22px;font-weight:bold;color:#1F3864;margin-bottom:4px}
  .login-sub{font-size:13px;color:#595959;margin-bottom:28px}</style></head>
  <body><div class="login-wrap"><div class="login-card">
  <div class="login-title">SH360 Admin</div>
  <div class="login-sub">Sekisui House US · 360 Leadership Survey Platform</div>
  ${error ? '<div class="alert alert-error">Incorrect password. Please try again.</div>' : ''}
  <form method="POST" action="/admin/login">
    <div class="form-group"><label class="form-label">Password</label>
    <input class="form-control" type="password" name="password" autofocus required placeholder="Enter admin password"/></div>
    <button class="btn btn-navy" style="width:100%" type="submit">Sign In</button>
  </form></div></div></body></html>`;
}

function dashboardPage(cycles) {
  const activeCount = cycles.filter(c=>c.status==='active').length;
  const totalLeaders = cycles.reduce((sum,c)=>sum+(c.leaders?.[0]?.count||0),0);

  const cycleRows = cycles.map(c=>`
    <tr>
      <td><a href="/admin/cycles/${c.id}">${c.name}</a></td>
      <td>${c.description||'—'}</td>
      <td><span class="badge badge-${c.status}">${c.status}</span></td>
      <td>${c.opens_at ? new Date(c.opens_at).toLocaleDateString() : '—'}</td>
      <td>${c.closes_at ? new Date(c.closes_at).toLocaleDateString() : '—'}</td>
      <td><a href="/admin/cycles/${c.id}" class="btn btn-outline btn-sm">Manage</a></td>
    </tr>`).join('');

  return adminShell('Dashboard', `
    <div class="page-title">Dashboard</div>
    <div class="page-sub">Manage survey cycles, leaders, and raters.</div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-num">${cycles.length}</div><div class="stat-lbl">Total Cycles</div></div>
      <div class="stat-card"><div class="stat-num">${activeCount}</div><div class="stat-lbl">Active Cycles</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Survey Cycles</span>
        <a href="/admin/cycles/new" class="btn btn-primary">+ New Cycle</a>
      </div>
      ${cycles.length ? `<table class="data-table">
        <thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Opens</th><th>Closes</th><th></th></tr></thead>
        <tbody>${cycleRows}</tbody></table>` : '<p style="color:#595959;font-size:13px">No cycles yet. Create your first one.</p>'}
    </div>`);
}

function cycleFormPage() {
  return adminShell('New Cycle', `
    <div class="page-title">New Survey Cycle</div>
    <div class="page-sub">A cycle groups a set of leaders being assessed at the same time (e.g. "2026 Mid-Year").</div>
    <div class="card" style="max-width:560px">
      <form method="POST" action="/admin/cycles">
        <div class="form-group"><label class="form-label">Cycle Name *</label>
          <input class="form-control" name="name" required placeholder="e.g. 2026 Mid-Year 360"/></div>
        <div class="form-group"><label class="form-label">Description</label>
          <input class="form-control" name="description" placeholder="Optional notes"/></div>
        <div class="form-group"><label class="form-label">Opens At</label>
          <input class="form-control" type="datetime-local" name="opens_at"/>
          <div class="form-hint">Leave blank to open manually.</div></div>
        <div class="form-group"><label class="form-label">Closes At</label>
          <input class="form-control" type="datetime-local" name="closes_at"/>
          <div class="form-hint">Leave blank to close manually.</div></div>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit">Create Cycle</button>
          <a href="/admin" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </div>`);
}

function cycleDetailPage(cycle, leaders) {
  const statusActions = {
    draft:  [['active','Activate Cycle'],['closed','Close Cycle']],
    active: [['closed','Close Cycle'],['draft','Return to Draft']],
    closed: [['active','Re-activate'],['draft','Return to Draft']]
  }[cycle.status] || [];

  const leaderRows = leaders.map(l => {
    const total     = l.raters?.length || 0;
    const completed = l.raters?.filter(r=>r.completed_at).length || 0;
    const pct       = total ? Math.round(completed/total*100) : 0;
    return `<tr>
      <td><a href="/admin/leaders/${l.id}">${l.name}</a></td>
      <td>${l.title||'—'}</td>
      <td>${l.department||'—'}</td>
      <td>${total}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span>${completed}/${total}</span>
        </div>
      </td>
      <td>
        <div class="actions-row">
          <a href="/admin/leaders/${l.id}" class="btn btn-outline btn-sm">Manage</a>
          <form method="POST" action="/admin/leaders/${l.id}/send-invites" style="display:inline">
            <button class="btn btn-green btn-sm" type="submit">Send Invites</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  return adminShell(cycle.name, `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div class="page-title">${cycle.name}</div>
        <div class="page-sub"><span class="badge badge-${cycle.status}">${cycle.status}</span>${cycle.description ? ' · ' + cycle.description : ''}</div>
      </div>
      <div class="actions-row">
        ${statusActions.map(([s,l])=>`<form method="POST" action="/admin/cycles/${cycle.id}/status" style="display:inline">
          <input type="hidden" name="status" value="${s}"/>
          <button class="btn ${s==='active'?'btn-green':s==='closed'?'btn-red':'btn-outline'}" type="submit">${l}</button>
        </form>`).join('')}
        <a href="/admin/cycles/${cycle.id}/leaders/new" class="btn btn-primary">+ Add Leader</a>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Leaders in this Cycle (${leaders.length})</span></div>
      ${leaders.length ? `<table class="data-table">
        <thead><tr><th>Leader</th><th>Title</th><th>Department</th><th>Raters</th><th>Completion</th><th></th></tr></thead>
        <tbody>${leaderRows}</tbody></table>` : `<p style="color:#595959;font-size:13px">No leaders yet. <a href="/admin/cycles/${cycle.id}/leaders/new">Add the first leader.</a></p>`}
    </div>`);
}

function leaderFormPage(cycleId) {
  return adminShell('Add Leader', `
    <div class="page-title">Add Leader</div>
    <div class="page-sub">The leader being assessed in this cycle. A self-rater link will be created automatically.</div>
    <div class="card" style="max-width:560px">
      <form method="POST" action="/admin/cycles/${cycleId}/leaders">
        <div class="form-group"><label class="form-label">Full Name *</label>
          <input class="form-control" name="name" required placeholder="e.g. Chris Cady"/></div>
        <div class="form-group"><label class="form-label">Title</label>
          <input class="form-control" name="title" placeholder="e.g. Division President"/></div>
        <div class="form-group"><label class="form-label">Email *</label>
          <input class="form-control" type="email" name="email" required placeholder="leader@sekisuihouse.com"/></div>
        <div class="form-group"><label class="form-label">Department</label>
          <input class="form-control" name="department" placeholder="e.g. SHAWOOD Division"/></div>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit">Add Leader</button>
          <a href="/admin/cycles/${cycleId}" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </div>`);
}

function raterFormPage(leader) {
  if (!leader) return adminShell('Error', '<p>Leader not found.</p>');
  return adminShell('Add Raters', `
    <div class="page-title">Add Raters — ${leader.name}</div>
    <div class="page-sub">Add multiple raters at once. Each line: Name, Email, Group</div>
    <div class="card" style="max-width:640px">
      <form method="POST" action="/admin/leaders/${leader.id}/raters">
        <div class="form-group">
          <label class="form-label">Raters (one per line)</label>
          <textarea class="form-control" name="raters_text" rows="10"
            placeholder="Jane Smith, jane@sekisuihouse.com, supervisor
Tom Jones, tom@sekisuihouse.com, peer
Maria Garcia, maria@sekisuihouse.com, direct_report
Alex Chen, alex@sekisuihouse.com, skip_level"></textarea>
          <div class="form-hint">
            Valid groups: <code>supervisor</code> · <code>peer</code> · <code>direct_report</code> · <code>skip_level</code><br/>
            The leader's self-assessment link was created automatically when you added them.
          </div>
        </div>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit">Add Raters</button>
          <a href="/admin/leaders/${leader.id}" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </div>`);
}

function leaderDetailPage(leader, raters, report, completedCount, totalCount) {
  if (!leader) return adminShell('Error', '<p>Leader not found.</p>');
  const pct = totalCount ? Math.round(completedCount/totalCount*100) : 0;

  const groupOrder = ['self','supervisor','peer','direct_report','skip_level'];
  const sorted = [...raters].sort((a,b)=>groupOrder.indexOf(a.rater_group)-groupOrder.indexOf(b.rater_group));

  const raterRows = sorted.map(r=>`<tr>
    <td>${r.name}</td>
    <td>${r.email}</td>
    <td><span class="badge badge-${r.rater_group==='self'?'draft':'pending'}">${r.rater_group.replace('_',' ')}</span></td>
    <td>${r.email_sent_at ? '✓ Sent ' + new Date(r.email_sent_at).toLocaleDateString() : '—'}</td>
    <td><span class="badge ${r.completed_at?'badge-complete':'badge-pending'}">${r.completed_at?'Complete':'Pending'}</span></td>
    <td>
      <div class="actions-row">
        <a href="${process.env.APP_URL||''}/survey/${r.token}" target="_blank" class="btn btn-outline btn-sm">Open Link</a>
        ${!r.completed_at?`<form method="POST" action="/admin/raters/${r.id}/delete" style="display:inline" onsubmit="return confirm('Remove this rater?')">
          <button class="btn btn-red btn-sm">Remove</button></form>`:''}
      </div>
    </td>
  </tr>`).join('');

  return adminShell(leader.name, `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div class="page-title">${leader.name}</div>
        <div class="page-sub">${leader.title||''} ${leader.department?'· '+leader.department:''}</div>
      </div>
      <div class="actions-row">
        <a href="/admin/leaders/${leader.id}/raters/new" class="btn btn-primary">+ Add Raters</a>
        <form method="POST" action="/admin/leaders/${leader.id}/send-invites">
          <button class="btn btn-green" type="submit">Send Pending Invites</button>
        </form>
        ${completedCount>=3?`<form method="POST" action="/admin/leaders/${leader.id}/generate-report">
          <button class="btn btn-navy" type="submit">Generate AI Report</button>
        </form>`:'<span style="font-size:12px;color:#595959;align-self:center">Need 3+ responses to generate report</span>'}
        ${report?`<a href="/report/view/${report.id}" class="btn btn-outline" target="_blank">View Report</a>`:''}
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-num">${totalCount}</div><div class="stat-lbl">Total Raters</div></div>
      <div class="stat-card"><div class="stat-num">${completedCount}</div><div class="stat-lbl">Completed</div></div>
      <div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-lbl">Response Rate</div></div>
      ${report?`<div class="stat-card"><div class="stat-num" style="font-size:14px;padding-top:4px">✓</div><div class="stat-lbl">Report Generated</div></div>`:''}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Raters</span></div>
      ${raters.length?`<table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Group</th><th>Invite</th><th>Status</th><th></th></tr></thead>
        <tbody>${raterRows}</tbody></table>`:`<p style="color:#595959;font-size:13px">No raters added yet. <a href="/admin/leaders/${leader.id}/raters/new">Add raters.</a></p>`}
    </div>`);
}

module.exports = router;

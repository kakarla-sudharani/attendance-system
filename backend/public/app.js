'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const state = { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null') };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const curMonth = () => today().slice(0, 7);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtTime = (dt) => (dt ? dt.slice(11, 16) : '–');
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const STATUS = {
  present: ['🟢 Present', 'green'], absent: ['🔴 Absent', 'red'], leave: ['🔵 Leave', 'blue'], unapproved_leave: ['🟠 Unapproved', 'orange'],
  holiday: ['🏖 Holiday', 'purple'], weekend: ['Weekend', 'grey'], upcoming: ['–', 'grey'], not_marked: ['🟡 Not marked', 'amber'],
  pending: ['🟡 Pending', 'amber'], approved: ['🟢 Approved', 'green'], unapproved: ['🔴 Unapproved', 'red']
};
const pill = (s) => { const [l, c] = STATUS[s] || [s, 'grey']; return `<span class="pill ${c}">${esc(l)}</span>`; };

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 3200);
}

async function api(path, opts = {}) {
  const { method = 'GET', body, raw } = opts;
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.ok && raw) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logout(); throw new Error('Session expired, please log in again'); }
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.data = data; throw e; }
  return data;
}

async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

function openForm(title, html, onSubmit, submitLabel = 'Save') {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form id="dlgForm"><h3>${esc(title)}</h3>${html}<div class="row end"><button type="button" class="btn ghost" id="dlgCancel">Cancel</button><button class="btn">${submitLabel}</button></div></form>`;
  $('#dlgCancel').onclick = () => dlg.close();
  $('#dlgForm').onsubmit = async (e) => {
    e.preventDefault();
    try { await onSubmit(Object.fromEntries(new FormData(e.target))); dlg.close(); } catch (err) { toast(err.message, true); }
  };
  dlg.showModal();
}

const table = (head, rows, empty = 'Nothing to show') =>
  `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="muted">${empty}</td></tr>`}</tbody></table></div>`;

const ring = (p) => `<div class="ring" style="--p:${p}"><span>${p}%</span></div>`;

// icon + color per stat card
const statCard = (icon, tone, num, label) =>
  `<div class="stat-card"><div class="stat-ic ${tone}">${icon}</div><div><div class="stat-num">${num}</div><div class="stat-lbl">${label}</div></div></div>`;

const summaryCards = (s) => `<div class="stat-grid">${[
  ['📅', 'blue', s.working_days, 'Working days'], ['🟢', 'green', s.present_days, 'Present'], ['🔴', 'red', s.absent_days, 'Absent'],
  ['🔵', 'blue', s.approved_leaves, 'Approved leaves'], ['🟠', 'orange', s.unapproved_leaves, 'Unapproved leaves'], ['🏖', 'blue', s.holidays, 'Holidays'],
  ['🏢', 'blue', s.wfo_days, 'WFO days'], ['🏠', 'green', s.wfh_days, 'WFH days'], ['⏰', 'orange', s.late_days, 'Late arrivals']
].map(([ic, tone, v, l]) => statCard(ic, tone, v, l)).join('')}</div>`;

// Renders a title + month picker, then calls loader(year, month, box) whenever the month changes
function monthPage(root, title, loader, extra = '') {
  root.innerHTML = `<div class="page-head"><div><h2>${title}</h2></div><div class="row">${extra}<input type="month" id="mp" value="${curMonth()}"></div></div><div class="panel" id="box">Loading…</div>`;
  const run = async () => {
    const [y, m] = $('#mp').value.split('-').map(Number);
    try { await loader(y, m, $('#box')); } catch (e) { $('#box').innerHTML = `<p class="warn">${esc(e.message)}</p>`; }
  };
  $('#mp').onchange = run; run();
}

let charts = {};
function drawChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el.getContext('2d'), cfg);
}
const CHART_TEXT = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#64748b';

/* ---------- EMPLOYEE views ---------- */
const views = {};

views.today = async (root) => {
  const t = await api('/attendance/today');
  const [y, m] = t.date.split('-').map(Number);
  const sum = await api(`/summary/monthly?month=${m}&year=${y}`);
  const r = t.record;
  const checkedIn = r && r.login_time && r.status === 'present';
  const checkedOut = checkedIn && r.logout_time;
  const note = t.is_holiday ? `🏖 Holiday: ${esc(t.holiday_name)}` : t.is_weekend ? 'Weekend' : t.on_leave ? 'You are on leave today' : '';
  root.innerHTML = `
    <div class="page-head"><div><h2>Good day, ${esc(state.user.name.split(' ')[0])} 👋</h2><p class="muted">Here's your attendance for today</p></div></div>
    <div class="two-col">
      <div class="panel">
        <div class="row" style="justify-content:space-between">
          <div>
            <div class="muted">${t.date}</div>
            <div class="big">${checkedIn ? `${r.work_mode === 'WFH' ? '🏠' : '🏢'} ${r.work_mode}${r.is_late ? ' · ⏰ Late' : ''}` : 'Not checked in yet'}</div>
            <p class="muted">${note} ${checkedIn ? `In: <b>${fmtTime(r.login_time)}</b> &nbsp; Out: <b>${checkedOut ? fmtTime(r.logout_time) : '–'}</b>` : ''}</p>
            ${checkedIn && r.is_late ? `<p class="small muted">Late reason: ${esc(r.late_reason)}</p>` : ''}
          </div>
        </div>
        ${checkedIn ? '' : `
          <div class="row" style="margin-top:14px">
            <label>Work mode<select id="mode"><option>WFO</option><option>WFH</option></select></label>
          </div>
          <div id="lateBox" class="warn ${t.is_late_now ? '' : 'hidden'}">
            <b>⏰ Late login.</b> It is after ${t.late_after}. Please give a reason — attendance is recorded only after you do.
            <textarea id="reason" rows="2" style="width:100%;margin-top:8px" placeholder="Reason for late login"></textarea>
          </div>`}
        <div class="row" style="margin-top:14px">
          <button class="btn green" id="inBtn" ${checkedIn ? 'disabled' : ''}>Check In</button>
          <button class="btn red" id="outBtn" ${!checkedIn || checkedOut ? 'disabled' : ''}>Check Out</button>
        </div>
      </div>
      <div class="panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
        ${ring(sum.attendance_percentage)}
        <div class="muted small">Attendance this month</div>
      </div>
    </div>
    <div class="panel"><h3>${MONTHS[m - 1]} ${y} overview</h3>${summaryCards(sum)}
      <p class="muted small">Attendance % = present days ÷ working days so far this month.</p></div>`;

  const inBtn = $('#inBtn'), outBtn = $('#outBtn');
  if (!checkedIn) inBtn.onclick = async () => {
    try {
      const body = { work_mode: $('#mode').value, late_reason: ($('#reason') || {}).value || '' };
      const res = await api('/attendance/checkin', { method: 'POST', body });
      toast(res.is_late ? 'Checked in (late)' : 'Checked in'); views.today(root);
    } catch (e) {
      if (e.data && e.data.code === 'LATE_REASON_REQUIRED') { $('#lateBox').classList.remove('hidden'); $('#reason').focus(); toast(e.message, true); }
      else toast(e.message, true);
    }
  };
  outBtn.onclick = async () => {
    try { await api('/attendance/checkout', { method: 'POST' }); toast('Checked out'); views.today(root); } catch (e) { toast(e.message, true); }
  };
};

views.history = (root) => monthPage(root, 'Attendance History', async (y, m, box) => {
  const d = await api(`/attendance/history?month=${m}&year=${y}`);
  const rows = d.days.filter((x) => x.status !== 'upcoming').reverse().map((x) => `
    <tr class="${x.status === 'weekend' ? 'dim' : ''}"><td>${x.date} ${x.weekday}</td><td>${pill(x.status)}</td>
    <td>${x.work_mode || ''}</td><td>${fmtTime(x.login_time)}</td><td>${fmtTime(x.logout_time)}</td>
    <td>${x.is_late ? `Late: ${esc(x.late_reason)}` : ''}${esc(x.holiday_name || '')}${x.leave_type ? esc(x.leave_type) + ' leave' : ''}</td></tr>`);
  box.innerHTML = `<p class="muted">Present ${d.summary.present_days} · Absent ${d.summary.absent_days} · Leaves ${d.summary.approved_leaves + d.summary.unapproved_leaves} · Attendance ${d.summary.attendance_percentage}%</p>` +
    table(['Date', 'Status', 'Mode', 'In', 'Out', 'Notes'], rows);
});

views.summary = (root) => monthPage(root, 'Monthly Summary', async (y, m, box) => {
  const s = await api(`/summary/monthly?month=${m}&year=${y}`);
  box.innerHTML = `<div class="row" style="align-items:flex-start">${ring(s.attendance_percentage)}<div class="grow">${summaryCards(s)}</div></div>
    <p class="muted small">Attendance % = present days ÷ working days elapsed (working days = weekdays − holidays).</p>`;
});

views.late = (root) => monthPage(root, 'Late Attendance Report', async (y, m, box) => {
  const rows = await api(`/attendance/late-report?month=${m}&year=${y}`);
  box.innerHTML = table(['Date', 'Login time', 'Mode', 'Reason'],
    rows.map((r) => `<tr><td>${r.date}</td><td>${fmtTime(r.login_time)}</td><td>${r.work_mode || ''}</td><td>${esc(r.late_reason)}</td></tr>`), 'No late arrivals 🎉');
});

views.leaves = async (root) => {
  const list = await api('/leaves/mine');
  root.innerHTML = `<div class="page-head"><h2>My Leaves</h2><button class="btn" id="apply">+ Apply for leave</button></div>
    <div class="panel">${table(['From', 'To', 'Type', 'Reason', 'Status', ''], list.map((l) => `<tr><td>${l.date_from}</td><td>${l.date_to}</td><td>${l.leave_type}</td>
      <td>${esc(l.reason)}</td><td>${pill(l.status)}</td>
      <td>${l.status === 'pending' ? `<button class="btn ghost small" data-cancel="${l.id}">Cancel</button>` : ''}</td></tr>`))}</div>`;
  $('#apply').onclick = () => openForm('Apply for leave', `
    <label>From<input type="date" name="date_from" required min="${today()}"></label>
    <label>To<input type="date" name="date_to" required min="${today()}"></label>
    <label>Type<select name="leave_type"><option>casual</option><option>sick</option><option>earned</option><option>other</option></select></label>
    <label>Reason<input name="reason"></label>`,
  async (d) => { await api('/leaves/apply', { method: 'POST', body: d }); toast('Leave applied'); views.leaves(root); }, 'Apply');
  root.querySelectorAll('[data-cancel]').forEach((b) => { b.onclick = async () => {
    try { await api('/leaves/' + b.dataset.cancel, { method: 'DELETE' }); toast('Leave cancelled'); views.leaves(root); } catch (e) { toast(e.message, true); }
  }; });
};

// shared by employee (read only) and admin (add / delete)
views.holidays = async (root) => {
  const isAdmin = state.user.role === 'admin';
  root.innerHTML = `<div class="page-head"><h2>🏖 Holidays</h2><div class="row">
    <input type="number" id="yr" value="${new Date().getFullYear()}" min="2000" max="2100" style="width:100px">
    ${isAdmin ? '<button class="btn" id="addHol">+ Add holiday</button>' : ''}</div></div><div class="panel" id="box"></div>`;
  const load = async () => {
    const year = $('#yr').value;
    const [counts, list] = await Promise.all([api('/holidays/monthly-counts?year=' + year), api('/holidays?year=' + year)]);
    $('#box').innerHTML = `<h3>Holidays per month</h3><div class="mgrid">${counts.map((c) => `<div><b>${c.count}</b>${MONTHS[c.month - 1].slice(0, 3)}</div>`).join('')}</div>
      <h3 style="margin-top:18px">Total: ${list.count}</h3>${table(['Date', 'Holiday', ...(isAdmin ? [''] : [])],
      list.holidays.map((h) => `<tr><td>${h.holiday_date}</td><td>${esc(h.name)}</td>${isAdmin ? `<td><button class="btn ghost small" data-del="${h.id}">Delete</button></td>` : ''}</tr>`))}`;
    $('#box').querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Delete this holiday?')) return;
      try { await api('/holidays/' + b.dataset.del, { method: 'DELETE' }); toast('Holiday removed'); load(); } catch (e) { toast(e.message, true); }
    }; });
  };
  $('#yr').onchange = load;
  if (isAdmin) $('#addHol').onclick = () => openForm('Add holiday', `<label>Date<input type="date" name="holiday_date" required></label><label>Name<input name="name" required></label>`,
    async (d) => { await api('/holidays', { method: 'POST', body: d }); toast('Holiday added'); load(); }, 'Add');
  load();
};

/* ---------- ADMIN views ---------- */
views.dashboard = async (root) => {
  const s = await api('/admin/stats');
  const pend = await api('/admin/leaves?status=pending');
  const dayNote = s.is_holiday ? `<span class="pill purple">🏖 ${esc(s.holiday_name)}</span>` : s.is_weekend ? '<span class="pill grey">Weekend</span>' : '';
  root.innerHTML = `
    <div class="page-head"><div><h2>Good morning, ${esc(state.user.name.split(' ')[0])} 👋</h2><p class="muted">Here's your workforce overview for ${s.date} ${dayNote}</p></div></div>
    <div class="stat-grid">
      ${statCard('👥', 'blue', s.total_employees, 'Total employees')}
      ${statCard('🟢', 'green', s.present, 'Present today')}
      ${statCard('🔴', 'red', s.absent, 'Absent / not in yet')}
      ${statCard('🟠', 'orange', s.on_leave, 'On leave')}
      ${statCard('🏢', 'blue', s.wfo, 'Work from office')}
      ${statCard('🏠', 'green', s.wfh, 'Work from home')}
      ${statCard('⏰', 'orange', s.late, 'Late today')}
      ${statCard('📝', 'blue', s.pending_leaves, 'Pending leave requests')}
    </div>
    <div class="two-col">
      <div class="panel"><h3>Today's attendance split</h3><div class="chart-box"><canvas id="pieChart"></canvas></div></div>
      <div class="panel">
        <h3>Pending leave requests</h3>
        <div id="pendBox">${pend.length ? pend.map((l) => `
          <div class="leave-card"><div class="who"><span class="lbadge">${initials(l.employee_name)}</span>
            <div><b>${esc(l.employee_name)}</b><div class="muted small">${l.date_from} → ${l.date_to} · ${l.leave_type}</div></div></div>
            <div class="row"><button class="btn green small" data-a="approved" data-id="${l.id}">✓ Approve</button>
            <button class="btn red small" data-a="unapproved" data-id="${l.id}">✕ Reject</button></div></div>`).join('')
          : '<p class="muted">No pending requests 🎉</p>'}</div>
      </div>
    </div>`;
  drawChart('pieChart', {
    type: 'doughnut',
    data: { labels: ['Present', 'Absent', 'On leave'], datasets: [{ data: [s.present, s.absent, s.on_leave], backgroundColor: ['#16A34A', '#DC2626', '#F59E0B'], borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { color: CHART_TEXT } } }, cutout: '65%' }
  });
  $('#pendBox').querySelectorAll('[data-a]').forEach((b) => { b.onclick = async () => {
    try { await api(`/admin/leaves/${b.dataset.id}/review`, { method: 'PUT', body: { status: b.dataset.a } }); toast('Leave ' + b.dataset.a); views.dashboard(root); } catch (e) { toast(e.message, true); }
  }; });
};

views.aattendance = async (root) => {
  root.innerHTML = `<div class="page-head"><h2>📅 Employee Attendance</h2><input type="date" id="dt" value="${today()}"></div><div class="panel" id="box"></div>`;
  const load = async () => {
    const date = $('#dt').value;
    const rows = await api('/admin/attendance?date=' + date);
    $('#box').innerHTML = table(['Employee', 'Dept', 'Status', 'Mode', 'In', 'Out', 'Late reason', ''], rows.map((r, i) => `<tr>
      <td>${esc(r.name)}</td><td>${esc(r.department)}</td><td>${pill(r.status)}</td><td>${r.work_mode || ''}</td><td>${fmtTime(r.login_time)}</td>
      <td>${fmtTime(r.logout_time)}</td><td>${esc(r.late_reason)}</td>
      <td><button class="btn ghost small" data-edit="${i}">Edit</button> <button class="btn ghost small" data-clear="${i}">Clear</button></td></tr>`));
    $('#box').querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => {
      const r = rows[b.dataset.edit];
      openForm('Edit – ' + r.name + ' (' + date + ')', `
        <label>Status<select name="status"><option value="present" ${r.status === 'present' ? 'selected' : ''}>Present</option><option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Absent</option></select></label>
        <label>Work mode<select name="work_mode"><option ${r.work_mode !== 'WFH' ? 'selected' : ''}>WFO</option><option ${r.work_mode === 'WFH' ? 'selected' : ''}>WFH</option></select></label>
        <label>Login time<input type="time" name="login_time" value="${r.login_time ? fmtTime(r.login_time) : ''}"></label>
        <label>Logout time<input type="time" name="logout_time" value="${r.logout_time ? fmtTime(r.logout_time) : ''}"></label>
        <label>Late reason<input name="late_reason" value="${esc(r.late_reason)}"></label>`,
      async (d) => { await api('/admin/attendance', { method: 'PUT', body: { ...d, employee_id: r.employee_id, date } }); toast('Saved'); load(); });
    }; });
    $('#box').querySelectorAll('[data-clear]').forEach((b) => { b.onclick = async () => {
      const r = rows[b.dataset.clear];
      if (!confirm('Clear the record for ' + r.name + '?')) return;
      try { await api(`/admin/attendance?employee_id=${r.employee_id}&date=${date}`, { method: 'DELETE' }); toast('Cleared'); load(); } catch (e) { toast(e.message, true); }
    }; });
  };
  $('#dt').onchange = load; load();
};

views.aemployees = async (root) => {
  const list = await api('/admin/employees');
  root.innerHTML = `<div class="page-head"><h2>👥 Employees</h2><button class="btn" id="addEmp">+ Add employee</button></div>
    <div class="panel">${table(['', 'Name', 'Email', 'Department', 'Role', 'Joined', 'Status', ''], list.map((e) => `<tr class="${e.is_active ? '' : 'dim'}">
    <td><span class="lbadge" style="display:inline-grid">${initials(e.name)}</span></td><td>${esc(e.name)}</td><td>${esc(e.email)}</td>
    <td>${esc(e.department)}</td><td>${e.role}</td><td>${e.join_date}</td><td>${e.is_active ? '<span class="pill green">Active</span>' : '<span class="pill grey">Inactive</span>'}</td>
    <td><button class="btn ghost small" data-tog="${e.id}" data-act="${e.is_active ? 0 : 1}">${e.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>`))}</div>`;
  $('#addEmp').onclick = () => openForm('Add employee', `
    <label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label>
    <label>Password<input type="text" name="password" required minlength="6"></label><label>Department<input name="department"></label>
    <label>Join date<input type="date" name="join_date" value="${today()}"></label>
    <label>Role<select name="role"><option value="employee">Employee</option><option value="admin">Admin</option></select></label>`,
  async (d) => { await api('/admin/employees', { method: 'POST', body: d }); toast('Employee added'); views.aemployees(root); }, 'Add');
  root.querySelectorAll('[data-tog]').forEach((b) => { b.onclick = async () => {
    try { await api('/admin/employees/' + b.dataset.tog, { method: 'PUT', body: { is_active: Number(b.dataset.act) } }); views.aemployees(root); } catch (e) { toast(e.message, true); }
  }; });
};

views.aleaves = async (root) => {
  root.innerHTML = `<div class="page-head"><h2>📝 Leave Management</h2><div class="row">
    <select id="flt"><option value="">All</option><option value="pending" selected>Pending</option><option value="approved">Approved</option><option value="unapproved">Unapproved</option></select>
    <button class="btn" id="rec">+ Record leave</button></div></div><div id="box"></div>`;
  const load = async () => {
    const list = await api('/admin/leaves?status=' + $('#flt').value);
    $('#box').innerHTML = list.length ? list.map((l) => `
      <div class="leave-card"><div class="who"><span class="lbadge">${initials(l.employee_name)}</span>
        <div><b>${esc(l.employee_name)}</b><div class="muted small">${l.date_from} → ${l.date_to} · ${l.leave_type}${l.reason ? ' · ' + esc(l.reason) : ''}</div></div></div>
        <div class="row">${pill(l.status)}
        ${l.status !== 'approved' ? `<button class="btn green small" data-rv="approved" data-id="${l.id}">✓ Approve</button>` : ''}
        ${l.status !== 'unapproved' ? `<button class="btn red small" data-rv="unapproved" data-id="${l.id}">✕ Unapprove</button>` : ''}</div></div>`).join('')
      : '<div class="panel"><p class="muted">No leave requests match this filter.</p></div>';
    $('#box').querySelectorAll('[data-rv]').forEach((b) => { b.onclick = async () => {
      try { await api(`/admin/leaves/${b.dataset.id}/review`, { method: 'PUT', body: { status: b.dataset.rv } }); toast('Leave ' + b.dataset.rv); load(); } catch (e) { toast(e.message, true); }
    }; });
  };
  $('#flt').onchange = load;
  $('#rec').onclick = async () => {
    const emps = (await api('/admin/employees')).filter((e) => e.role === 'employee' && e.is_active);
    openForm('Record leave', `
      <label>Employee<select name="employee_id">${emps.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
      <label>From<input type="date" name="date_from" required value="${today()}"></label><label>To<input type="date" name="date_to" required value="${today()}"></label>
      <label>Type<select name="leave_type"><option>casual</option><option>sick</option><option>earned</option><option>other</option></select></label>
      <label>Reason<input name="reason"></label>
      <label>Record as<select name="status"><option value="approved">Approved leave</option><option value="unapproved">Unapproved leave</option></select></label>`,
    async (d) => { await api('/admin/leaves', { method: 'POST', body: d }); toast('Leave recorded'); load(); }, 'Record');
  };
  load();
};

views.reports = (root) => monthPage(root, '📊 Reports', async (y, m, box) => {
  const [mon, late] = await Promise.all([api(`/admin/reports/monthly?month=${m}&year=${y}`), api(`/admin/reports/late?month=${m}&year=${y}`)]);
  box.innerHTML = `<div class="chart-box" style="margin-bottom:22px"><canvas id="repChart"></canvas></div>
    <div class="row"><h3 class="grow">Monthly attendance summary</h3><button class="btn ghost small" id="csv1">⬇ Download CSV</button></div>
    ${table(['Employee', 'Working', 'Present', 'Absent', 'Appr. leave', 'Unappr. leave', 'Holidays', 'WFO', 'WFH', 'Late', 'Attendance %'], mon.map((r) => `<tr>
      <td>${esc(r.name)}<div class="muted small">${esc(r.department)}</div></td><td>${r.working_days}</td><td>${r.present_days}</td><td>${r.absent_days}</td><td>${r.approved_leaves}</td>
      <td>${r.unapproved_leaves}</td><td>${r.holidays}</td><td>${r.wfo_days}</td><td>${r.wfh_days}</td><td>${r.late_days}</td><td><b>${r.attendance_percentage}%</b></td></tr>`))}
    <div class="row" style="margin-top:24px"><h3 class="grow">Late attendance report</h3><button class="btn ghost small" id="csv2">⬇ Download CSV</button></div>
    ${table(['Date', 'Employee', 'Dept', 'Mode', 'Login', 'Reason'], late.map((r) => `<tr><td>${r.date}</td><td>${esc(r.employee_name)}</td><td>${esc(r.department)}</td><td>${r.work_mode || ''}</td>
      <td>${fmtTime(r.login_time)}</td><td>${esc(r.late_reason)}</td></tr>`), 'No late arrivals this month')}`;
  drawChart('repChart', {
    type: 'bar',
    data: { labels: mon.map((r) => r.name.split(' ')[0]), datasets: [{ label: 'Attendance %', data: mon.map((r) => r.attendance_percentage), backgroundColor: '#2563EB', borderRadius: 6 }] },
    options: { scales: { y: { beginAtZero: true, max: 100, ticks: { color: CHART_TEXT } }, x: { ticks: { color: CHART_TEXT } } }, plugins: { legend: { display: false } } }
  });
  $('#csv1').onclick = () => download(`/admin/reports/monthly?month=${m}&year=${y}&format=csv`, `attendance-${y}-${m}.csv`).catch((e) => toast(e.message, true));
  $('#csv2').onclick = () => download(`/admin/reports/late?month=${m}&year=${y}&format=csv`, `late-report-${y}-${m}.csv`).catch((e) => toast(e.message, true));
});

/* ---------- shell ---------- */
const NAV = {
  employee: [['today', '🏠', 'Today'], ['history', '📅', 'History'], ['summary', '📊', 'Summary'], ['leaves', '📝', 'Leaves'], ['holidays', '🏖', 'Holidays'], ['late', '⏰', 'Late Report']],
  admin: [['dashboard', '🏠', 'Dashboard'], ['aattendance', '📅', 'Attendance'], ['aemployees', '👥', 'Employees'], ['aleaves', '📝', 'Leaves'], ['holidays', '🏖', 'Holidays'], ['reports', '📊', 'Reports']]
};

async function show(name) {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.v === name));
  const main = $('#main'); main.innerHTML = '<p class="muted">Loading…</p>';
  closeSidebar();
  try { await views[name](main); } catch (e) { main.innerHTML = `<p class="warn">${esc(e.message)}</p>`; }
}

function closeSidebar() { $('.sidebar').classList.remove('open'); $('#scrim').classList.add('hidden'); }

function enter() {
  $('#loginScreen').classList.add('hidden'); $('#mainScreen').classList.remove('hidden');
  $('#whoName').textContent = state.user.name;
  $('#whoRole').textContent = state.user.role === 'admin' ? 'Administrator' : 'Employee';
  $('#avatarInit').textContent = initials(state.user.name);
  const items = NAV[state.user.role];
  $('#nav').innerHTML = items.map(([v, ic, l]) => `<button data-v="${v}"><span class="ic">${ic}</span>${l}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach((b) => { b.onclick = () => show(b.dataset.v); });
  show(items[0][0]);
}

function logout() {
  localStorage.removeItem('token'); localStorage.removeItem('user'); state.token = null; state.user = null;
  $('#mainScreen').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
}

$('#logoutBtn').onclick = logout;
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    state.token = res.token; state.user = res.employee;
    localStorage.setItem('token', res.token); localStorage.setItem('user', JSON.stringify(res.employee));
    e.target.reset(); enter();
  } catch (err) { toast(err.message, true); }
};

// dark mode
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; localStorage.setItem('theme', t); }
$('#themeBtn').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
applyTheme(localStorage.getItem('theme') || 'light');

// profile menu
$('#profileBtn').onclick = (e) => { e.stopPropagation(); $('#profileMenu').classList.toggle('hidden'); };
document.addEventListener('click', () => $('#profileMenu').classList.add('hidden'));
$('#pmLogout').onclick = logout;
$('#pmChangePw').onclick = () => openForm('Change password', `
  <label>Current password<input type="password" name="old_password" required></label>
  <label>New password<input type="password" name="new_password" required minlength="6"></label>`,
async (d) => { await api('/auth/change-password', { method: 'POST', body: d }); toast('Password changed'); }, 'Change');

// mobile sidebar toggle
$('#menuBtn').onclick = () => { $('.sidebar').classList.add('open'); $('#scrim').classList.remove('hidden'); };
$('#scrim').onclick = closeSidebar;

if (state.token && state.user) enter(); else $('#loginScreen').classList.remove('hidden');
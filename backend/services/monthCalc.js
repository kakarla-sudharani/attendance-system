const { pad, ymd, daysInMonth } = require('../utils/dates');

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Status of a single day for one employee.
// present | weekend | holiday | leave (approved) | unapproved_leave | absent | upcoming | not_marked
function dayStatus({ date, today, rec, holiday, leave, weekend }) {
  if (rec && rec.status === 'present') return 'present';
  if (weekend) return 'weekend';
  if (holiday) return 'holiday';
  if (leave) return leave.status === 'approved' ? 'leave' : 'unapproved_leave';
  if (rec && rec.status === 'absent') return 'absent';
  if (date > today) return 'upcoming';
  if (date === today) return 'not_marked'; // today: still time to check in
  return 'absent'; // past working day with no record = absent (automatic)
}

// approved leave wins over unapproved if both cover the same day; pending leaves are ignored
function findLeave(leaves, date) {
  let found = null;
  for (const l of leaves) {
    if (l.date_from <= date && date <= l.date_to) {
      if (l.status === 'approved') return l;
      found = found || l;
    }
  }
  return found;
}

function buildMonth(year, month, att, leaves, holidays, today = ymd(new Date())) {
  const n = daysInMonth(year, month);
  const attMap = {};
  att.forEach((a) => { attMap[a.date] = a; });
  const holMap = {};
  holidays.forEach((h) => { holMap[h.holiday_date] = h.name; });
  const activeLeaves = leaves.filter((l) => l.status === 'approved' || l.status === 'unapproved');

  const s = {
    month, year, total_days: n, weekends: 0, holidays: 0,
    working_days: 0, working_days_till_date: 0,
    present_days: 0, absent_days: 0, approved_leaves: 0, unapproved_leaves: 0,
    wfo_days: 0, wfh_days: 0, late_days: 0, extra_days_worked: 0
  };
  const days = [];

  for (let d = 1; d <= n; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const dow = new Date(year, month - 1, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const holiday = holMap[date] || null;
    const rec = attMap[date] || null;
    const leave = findLeave(activeLeaves, date);
    const status = dayStatus({ date, today, rec, holiday, leave, weekend });
    const working = !weekend && !holiday;

    if (weekend) s.weekends++;
    else if (holiday) s.holidays++; // a holiday that falls on a weekend is counted as weekend only
    if (working) {
      s.working_days++;
      if (date <= today) s.working_days_till_date++;
    }

    if (status === 'present') {
      if (working) s.present_days++; else s.extra_days_worked++;
      if (rec.work_mode === 'WFH') s.wfh_days++; else if (rec.work_mode === 'WFO') s.wfo_days++;
      if (rec.is_late) s.late_days++;
    } else if (status === 'absent') s.absent_days++;
    else if (status === 'leave') s.approved_leaves++;
    else if (status === 'unapproved_leave') s.unapproved_leaves++;

    days.push({
      date, weekday: WD[dow], status,
      work_mode: rec ? rec.work_mode : null,
      login_time: rec ? rec.login_time : null,
      logout_time: rec ? rec.logout_time : null,
      is_late: rec ? rec.is_late : 0,
      late_reason: rec ? rec.late_reason : null,
      holiday_name: holiday,
      leave_type: leave ? leave.leave_type : null
    });
  }

  // Attendance % = present working days / working days elapsed so far in the month
  // (for a finished month that is the whole month; for a future month it is 0).
  s.attendance_percentage = s.working_days_till_date > 0
    ? Math.min(100, Math.round((s.present_days / s.working_days_till_date) * 10000) / 100)
    : 0;

  return { days, summary: s };
}

module.exports = { dayStatus, findLeave, buildMonth, WD };

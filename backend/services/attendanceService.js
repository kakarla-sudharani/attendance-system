const pool = require('../config/db');
const { ymd, monthRange } = require('../utils/dates');
const { dayStatus, findLeave, buildMonth } = require('./monthCalc');

const pad = (n) => String(n).padStart(2, '0');
function threshold() {
  return { h: parseInt(process.env.LATE_THRESHOLD_HOUR || '9', 10), m: parseInt(process.env.LATE_THRESHOLD_MINUTE || '30', 10) };
}
const lateLabel = () => { const t = threshold(); return `${pad(t.h)}:${pad(t.m)}`; };
const isLateHM = (h, m) => { const t = threshold(); return h > t.h || (h === t.h && m > t.m); };
const isLateDate = (d) => isLateHM(d.getHours(), d.getMinutes());

async function getMonthData(empId, year, month) {
  const { start, end } = monthRange(year, month);
  const [att] = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?', [empId, start, end]);
  const [leaves] = await pool.query(
    "SELECT * FROM leaves WHERE employee_id = ? AND status IN ('approved','unapproved') AND date_from <= ? AND date_to >= ?",
    [empId, end, start]);
  const [hol] = await pool.query('SELECT * FROM holidays WHERE holiday_date BETWEEN ? AND ?', [start, end]);
  return buildMonth(year, month, att, leaves, hol);
}

// Status of every active employee on one date (used by admin screens)
async function getDayRows(date) {
  const [emps] = await pool.query("SELECT id, name, department FROM employees WHERE role = 'employee' AND is_active = 1 ORDER BY name");
  const [att] = await pool.query('SELECT * FROM attendance WHERE date = ?', [date]);
  const [lv] = await pool.query("SELECT * FROM leaves WHERE status IN ('approved','unapproved') AND date_from <= ? AND date_to >= ?", [date, date]);
  const [hol] = await pool.query('SELECT name FROM holidays WHERE holiday_date = ?', [date]);
  const dow = new Date(date + 'T00:00:00').getDay();
  const weekend = dow === 0 || dow === 6;
  const holiday = hol[0] ? hol[0].name : null;
  const today = ymd(new Date());
  const rows = emps.map((e) => {
    const rec = att.find((a) => a.employee_id === e.id) || null;
    const leave = findLeave(lv.filter((l) => l.employee_id === e.id), date);
    return {
      employee_id: e.id, name: e.name, department: e.department,
      status: dayStatus({ date, today, rec, holiday, leave, weekend }),
      work_mode: rec ? rec.work_mode : null,
      login_time: rec ? rec.login_time : null,
      logout_time: rec ? rec.logout_time : null,
      is_late: rec ? rec.is_late : 0,
      late_reason: rec ? rec.late_reason : null,
      holiday_name: holiday,
      leave_type: leave ? leave.leave_type : null
    };
  });
  return { rows, holiday, weekend };
}

module.exports = { getMonthData, getDayRows, lateLabel, isLateDate, isLateHM };

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/errors');
const { ymd, isDate, parseMonthYear, monthRange, combineDateTime } = require('../utils/dates');
const { getMonthData, getDayRows, isLateHM } = require('../services/attendanceService');
const toCsv = require('../utils/csv');

const router = express.Router();
router.use(verifyToken, requireAdmin);

// ---------- Dashboard numbers for today ----------
router.get('/stats', wrap(async (req, res) => {
  const date = ymd();
  const { rows, holiday, weekend } = await getDayRows(date);
  const s = { date, total_employees: rows.length, present: 0, absent: 0, on_leave: 0, wfo: 0, wfh: 0, late: 0,
    pending_leaves: 0, is_holiday: !!holiday, holiday_name: holiday, is_weekend: weekend };
  rows.forEach((r) => {
    if (r.status === 'present') {
      s.present++;
      if (r.work_mode === 'WFH') s.wfh++; else s.wfo++;
      if (r.is_late) s.late++;
    } else if (r.status === 'leave' || r.status === 'unapproved_leave') s.on_leave++;
    else if (r.status === 'absent' || r.status === 'not_marked') s.absent++;
  });
  const [[c]] = await pool.query("SELECT COUNT(*) AS c FROM leaves WHERE status = 'pending'");
  s.pending_leaves = c.c;
  res.json(s);
}));

// ---------- Employees ----------
router.get('/employees', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, department, join_date, is_active FROM employees ORDER BY role, name');
  res.json(rows);
}));

router.post('/employees', wrap(async (req, res) => {
  const { name, email, password, role, department, join_date } = req.body;
  if (!String(name || '').trim() || !String(email || '').trim() || !password) throw new HttpError(400, 'Name, email and password are required');
  if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  const joined = isDate(join_date) ? join_date : ymd();
  try {
    const [r] = await pool.query(
      'INSERT INTO employees (name, email, password_hash, role, department, join_date) VALUES (?, ?, ?, ?, ?, ?)',
      [String(name).trim(), String(email).trim().toLowerCase(), await bcrypt.hash(String(password), 10),
        role === 'admin' ? 'admin' : 'employee', department || null, joined]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already registered');
    throw e;
  }
}));

router.put('/employees/:id', wrap(async (req, res) => {
  const sets = [];
  const vals = [];
  const b = req.body;
  if (b.name) { sets.push('name = ?'); vals.push(String(b.name).trim()); }
  if (b.department !== undefined) { sets.push('department = ?'); vals.push(b.department || null); }
  if (b.role) { sets.push('role = ?'); vals.push(b.role === 'admin' ? 'admin' : 'employee'); }
  if (b.join_date && isDate(b.join_date)) { sets.push('join_date = ?'); vals.push(b.join_date); }
  if (b.is_active !== undefined) {
    if (String(req.params.id) === String(req.user.id) && !Number(b.is_active)) throw new HttpError(400, 'You cannot deactivate your own account');
    sets.push('is_active = ?'); vals.push(Number(b.is_active) ? 1 : 0);
  }
  if (b.password) {
    if (String(b.password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    sets.push('password_hash = ?'); vals.push(await bcrypt.hash(String(b.password), 10));
  }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  vals.push(req.params.id);
  await pool.query(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, vals);
  res.json({ message: 'Employee updated' });
}));

// "Delete" = deactivate, so attendance history is kept
router.delete('/employees/:id', wrap(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) throw new HttpError(400, 'You cannot deactivate your own account');
  await pool.query('UPDATE employees SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Employee deactivated' });
}));

// ---------- Attendance (view + edit, incl. WFO/WFH) ----------
router.get('/attendance', wrap(async (req, res) => {
  const date = req.query.date || ymd();
  if (!isDate(date)) throw new HttpError(400, 'Invalid date');
  const { rows } = await getDayRows(date);
  res.json(rows);
}));

router.put('/attendance', wrap(async (req, res) => {
  const { employee_id, date, status, work_mode, login_time, logout_time, late_reason } = req.body;
  if (!isDate(date)) throw new HttpError(400, 'Invalid date');
  if (!['present', 'absent'].includes(status)) throw new HttpError(400, 'Status must be present or absent');
  const [emp] = await pool.query("SELECT id FROM employees WHERE id = ? AND role = 'employee'", [employee_id]);
  if (!emp[0]) throw new HttpError(404, 'Employee not found');

  let mode = null, login = null, logout = null, late = 0, reason = null;
  if (status === 'present') {
    mode = work_mode || 'WFO';
    if (!['WFO', 'WFH'].includes(mode)) throw new HttpError(400, 'Work mode must be WFO or WFH');
    login = combineDateTime(date, login_time) || `${date} 09:00:00`;
    logout = combineDateTime(date, logout_time);
    if (logout && logout < login) throw new HttpError(400, 'Logout time cannot be before login time');
    late = isLateHM(parseInt(login.slice(11, 13), 10), parseInt(login.slice(14, 16), 10)) ? 1 : 0;
    reason = late ? String(late_reason || '').slice(0, 255) || null : null;
  }
  await pool.query(
    `INSERT INTO attendance (employee_id, date, login_time, logout_time, status, work_mode, is_late, late_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE login_time = VALUES(login_time), logout_time = VALUES(logout_time), status = VALUES(status),
       work_mode = VALUES(work_mode), is_late = VALUES(is_late), late_reason = VALUES(late_reason)`,
    [employee_id, date, login, logout, status, mode, late, reason]);
  res.json({ message: 'Attendance saved' });
}));

// Remove a manual record (day goes back to automatic status)
router.delete('/attendance', wrap(async (req, res) => {
  const { employee_id, date } = req.query;
  if (!isDate(date)) throw new HttpError(400, 'Invalid date');
  await pool.query('DELETE FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
  res.json({ message: 'Record cleared' });
}));

// ---------- Leaves ----------
router.get('/leaves', wrap(async (req, res) => {
  const params = [];
  let sql = 'SELECT l.*, e.name AS employee_name, e.department FROM leaves l JOIN employees e ON e.id = l.employee_id';
  if (['pending', 'approved', 'unapproved'].includes(req.query.status)) { sql += ' WHERE l.status = ?'; params.push(req.query.status); }
  sql += ' ORDER BY (l.status = \'pending\') DESC, l.date_from DESC, l.id DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// Admin records a leave directly as approved or unapproved
router.post('/leaves', wrap(async (req, res) => {
  const { employee_id, date_from, date_to, leave_type, reason, status } = req.body;
  if (!isDate(date_from) || !isDate(date_to) || date_to < date_from) throw new HttpError(400, 'Valid date range required');
  if (!['approved', 'unapproved'].includes(status)) throw new HttpError(400, 'Status must be approved or unapproved');
  const [emp] = await pool.query("SELECT id FROM employees WHERE id = ? AND role = 'employee'", [employee_id]);
  if (!emp[0]) throw new HttpError(404, 'Employee not found');
  const [r] = await pool.query(
    'INSERT INTO leaves (employee_id, date_from, date_to, leave_type, reason, status, reviewed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employee_id, date_from, date_to, leave_type || 'casual', String(reason || '').slice(0, 255) || null, status, req.user.id]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/leaves/:id/review', wrap(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'unapproved'].includes(status)) throw new HttpError(400, 'Status must be approved or unapproved');
  const [r] = await pool.query('UPDATE leaves SET status = ?, reviewed_by = ? WHERE id = ?', [status, req.user.id, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Leave not found');
  res.json({ message: `Leave marked ${status}` });
}));

// ---------- Reports ----------
router.get('/reports/monthly', wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  const [emps] = await pool.query("SELECT id, name, department FROM employees WHERE role = 'employee' AND is_active = 1 ORDER BY name");
  const rows = [];
  for (const e of emps) {
    const { summary } = await getMonthData(e.id, year, month);
    rows.push({ employee_id: e.id, name: e.name, department: e.department, ...summary });
  }
  if (req.query.format === 'csv') {
    const cols = [['name', 'Employee'], ['department', 'Department'], ['working_days', 'Working days'], ['present_days', 'Present'],
      ['absent_days', 'Absent'], ['approved_leaves', 'Approved leaves'], ['unapproved_leaves', 'Unapproved leaves'], ['holidays', 'Holidays'],
      ['wfo_days', 'WFO days'], ['wfh_days', 'WFH days'], ['late_days', 'Late arrivals'], ['attendance_percentage', 'Attendance %']]
      .map(([key, label]) => ({ key, label }));
    return res.type('text/csv').attachment(`attendance-${year}-${month}.csv`).send(toCsv(rows, cols));
  }
  res.json(rows);
}));

router.get('/reports/late', wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  const { start, end } = monthRange(year, month);
  const [rows] = await pool.query(
    `SELECT a.date, e.name AS employee_name, e.department, a.work_mode, a.login_time, a.late_reason
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     WHERE a.is_late = 1 AND a.date BETWEEN ? AND ? ORDER BY a.date, e.name`, [start, end]);
  if (req.query.format === 'csv') {
    const cols = [['date', 'Date'], ['employee_name', 'Employee'], ['department', 'Department'], ['work_mode', 'Work mode'],
      ['login_time', 'Login time'], ['late_reason', 'Reason']].map(([key, label]) => ({ key, label }));
    return res.type('text/csv').attachment(`late-report-${year}-${month}.csv`).send(toCsv(rows, cols));
  }
  res.json(rows);
}));

module.exports = router;

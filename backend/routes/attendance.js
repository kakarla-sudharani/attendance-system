const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/errors');
const { ymd, mysqlDT, parseMonthYear, monthRange } = require('../utils/dates');
const { dayStatus, findLeave } = require('../services/monthCalc');
const { getMonthData, isLateDate, lateLabel } = require('../services/attendanceService');

const router = express.Router();

function targetEmployee(req) {
  if (req.user.role === 'admin' && req.query.employee_id) return parseInt(req.query.employee_id, 10);
  return req.user.id;
}

// Today's state for the logged-in employee (drives the check-in screen)
router.get('/today', verifyToken, wrap(async (req, res) => {
  const now = new Date();
  const date = ymd(now);
  const [recs] = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [req.user.id, date]);
  const [hol] = await pool.query('SELECT name FROM holidays WHERE holiday_date = ?', [date]);
  const [lv] = await pool.query(
    "SELECT * FROM leaves WHERE employee_id = ? AND status IN ('approved','unapproved') AND date_from <= ? AND date_to >= ?",
    [req.user.id, date, date]);
  const dow = now.getDay();
  const weekend = dow === 0 || dow === 6;
  const rec = recs[0] || null;
  const holiday = hol[0] ? hol[0].name : null;
  const leave = findLeave(lv, date);
  res.json({
    date,
    server_time: mysqlDT(now),
    record: rec,
    status: dayStatus({ date, today: date, rec, holiday, leave, weekend }),
    is_holiday: !!holiday,
    holiday_name: holiday,
    is_weekend: weekend,
    on_leave: !!leave,
    late_after: lateLabel(),
    is_late_now: isLateDate(now)
  });
}));

// Check in (login time). Late logins must include a reason BEFORE anything is stored.
router.post('/checkin', verifyToken, wrap(async (req, res) => {
  const now = new Date();
  const date = ymd(now);
  const mode = req.body.work_mode;
  if (!['WFO', 'WFH'].includes(mode)) throw new HttpError(400, 'Work mode must be WFO or WFH');

  const late = isLateDate(now);
  const reason = String(req.body.late_reason || '').trim().slice(0, 255);
  if (late && !reason) {
    throw new HttpError(422, `You are logging in after ${lateLabel()}. Please give a reason for the late login.`,
      { code: 'LATE_REASON_REQUIRED', is_late: true, late_after: lateLabel() });
  }

  const [rows] = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [req.user.id, date]);
  if (rows[0] && rows[0].login_time) throw new HttpError(409, 'You have already checked in today');

  if (rows[0]) {
    await pool.query('UPDATE attendance SET status = ?, login_time = ?, work_mode = ?, is_late = ?, late_reason = ? WHERE id = ?',
      ['present', mysqlDT(now), mode, late ? 1 : 0, late ? reason : null, rows[0].id]);
  } else {
    await pool.query(
      'INSERT INTO attendance (employee_id, date, login_time, status, work_mode, is_late, late_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, date, mysqlDT(now), 'present', mode, late ? 1 : 0, late ? reason : null]);
  }
  res.status(201).json({ message: 'Checked in', is_late: late, time: mysqlDT(now) });
}));

// Check out (exit time)
router.post('/checkout', verifyToken, wrap(async (req, res) => {
  const now = new Date();
  const [rows] = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [req.user.id, ymd(now)]);
  const rec = rows[0];
  if (!rec || !rec.login_time || rec.status !== 'present') throw new HttpError(404, 'You have not checked in today');
  if (rec.logout_time) throw new HttpError(409, 'You have already checked out today');
  await pool.query('UPDATE attendance SET logout_time = ? WHERE id = ?', [mysqlDT(now), rec.id]);
  res.json({ message: 'Checked out', time: mysqlDT(now) });
}));

// Month-wise history: one entry for every calendar day + the month summary
router.get('/history', verifyToken, wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  const data = await getMonthData(targetEmployee(req), year, month);
  res.json({ month, year, days: data.days, summary: data.summary });
}));

// Late arrivals with reasons
router.get('/late-report', verifyToken, wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  const { start, end } = monthRange(year, month);
  const [rows] = await pool.query(
    'SELECT date, login_time, work_mode, late_reason FROM attendance WHERE employee_id = ? AND is_late = 1 AND date BETWEEN ? AND ? ORDER BY date',
    [targetEmployee(req), start, end]);
  res.json(rows);
}));

module.exports = router;

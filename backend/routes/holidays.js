const express = require('express');
const pool = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/errors');
const { isDate } = require('../utils/dates');

const router = express.Router();

// Holidays of a month (?month=&year=) or of a whole year (?year=)
router.get('/', verifyToken, wrap(async (req, res) => {
  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  let rows;
  if (req.query.month) {
    [rows] = await pool.query('SELECT * FROM holidays WHERE MONTH(holiday_date) = ? AND YEAR(holiday_date) = ? ORDER BY holiday_date',
      [parseInt(req.query.month, 10), year]);
  } else {
    [rows] = await pool.query('SELECT * FROM holidays WHERE YEAR(holiday_date) = ? ORDER BY holiday_date', [year]);
  }
  res.json({ count: rows.length, holidays: rows });
}));

// Number of holidays in EACH month of a year -> [{month:1,count:2}, ... 12 items]
router.get('/monthly-counts', verifyToken, wrap(async (req, res) => {
  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  const [rows] = await pool.query('SELECT MONTH(holiday_date) AS m, COUNT(*) AS c FROM holidays WHERE YEAR(holiday_date) = ? GROUP BY m', [year]);
  const out = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }));
  rows.forEach((r) => { out[r.m - 1].count = r.c; });
  res.json(out);
}));

router.post('/', verifyToken, requireAdmin, wrap(async (req, res) => {
  const { holiday_date, name } = req.body;
  if (!isDate(holiday_date) || !String(name || '').trim()) throw new HttpError(400, 'Date and holiday name are required');
  try {
    const [r] = await pool.query('INSERT INTO holidays (holiday_date, name) VALUES (?, ?)', [holiday_date, String(name).trim().slice(0, 150)]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A holiday already exists on that date');
    throw e;
  }
}));

router.delete('/:id', verifyToken, requireAdmin, wrap(async (req, res) => {
  await pool.query('DELETE FROM holidays WHERE id = ?', [req.params.id]);
  res.json({ message: 'Holiday removed' });
}));

module.exports = router;

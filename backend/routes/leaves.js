const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/errors');
const { isDate } = require('../utils/dates');

const router = express.Router();
const TYPES = ['casual', 'sick', 'earned', 'other'];

// Employee applies for leave (status starts as "pending")
router.post('/apply', verifyToken, wrap(async (req, res) => {
  const { date_from, date_to, leave_type, reason } = req.body;
  if (!isDate(date_from) || !isDate(date_to)) throw new HttpError(400, 'Valid from/to dates are required (YYYY-MM-DD)');
  if (date_to < date_from) throw new HttpError(400, 'End date cannot be before start date');
  const type = TYPES.includes(leave_type) ? leave_type : 'casual';
  const [result] = await pool.query(
    'INSERT INTO leaves (employee_id, date_from, date_to, leave_type, reason) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, date_from, date_to, type, String(reason || '').slice(0, 255) || null]);
  res.status(201).json({ id: result.insertId, status: 'pending' });
}));

router.get('/mine', verifyToken, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM leaves WHERE employee_id = ? ORDER BY date_from DESC, id DESC', [req.user.id]);
  res.json(rows);
}));

// Employee can cancel own leave while it is still pending
router.delete('/:id', verifyToken, wrap(async (req, res) => {
  const [result] = await pool.query("DELETE FROM leaves WHERE id = ? AND employee_id = ? AND status = 'pending'", [req.params.id, req.user.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Only your own pending leave can be cancelled');
  res.json({ message: 'Leave cancelled' });
}));

module.exports = router;

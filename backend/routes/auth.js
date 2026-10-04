const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/errors');
require('dotenv').config();

const router = express.Router();

// NOTE: there is intentionally no public "register" endpoint.
// Only an admin can create employees (POST /api/admin/employees).

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const [rows] = await pool.query('SELECT * FROM employees WHERE email = ?', [email]);
  const emp = rows[0];
  if (!emp || !(await bcrypt.compare(password, emp.password_hash))) throw new HttpError(401, 'Invalid email or password');
  if (!emp.is_active) throw new HttpError(403, 'Your account is deactivated. Contact the admin.');

  const token = jwt.sign({ id: emp.id, role: emp.role, email: emp.email, name: emp.name }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, employee: { id: emp.id, name: emp.name, email: emp.email, role: emp.role, department: emp.department } });
}));

router.get('/me', verifyToken, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, department, join_date FROM employees WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw new HttpError(404, 'User not found');
  res.json(rows[0]);
}));

router.post('/change-password', verifyToken, wrap(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!new_password || String(new_password).length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
  const [rows] = await pool.query('SELECT password_hash FROM employees WHERE id = ?', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(String(old_password || ''), rows[0].password_hash))) throw new HttpError(400, 'Old password is incorrect');
  await pool.query('UPDATE employees SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(new_password), 10), req.user.id]);
  res.json({ message: 'Password changed' });
}));

module.exports = router;

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { wrap } = require('../utils/errors');
const { parseMonthYear } = require('../utils/dates');
const { getMonthData } = require('../services/attendanceService');

const router = express.Router();

// Monthly summary: working days, present, absent, leaves, holidays, attendance %
router.get('/monthly', verifyToken, wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  const empId = req.user.role === 'admin' && req.query.employee_id ? parseInt(req.query.employee_id, 10) : req.user.id;
  const { summary } = await getMonthData(empId, year, month);
  res.json({ employee_id: empId, ...summary });
}));

module.exports = router;

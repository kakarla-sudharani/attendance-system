const { HttpError } = require('./errors');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mysqlDT = (d = new Date()) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const monthRange = (y, m) => ({ start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` });

// strict YYYY-MM-DD check that also rejects impossible dates like 2026-02-30
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(new Date(s + 'T00:00:00')) === s;

function parseMonthYear(q) {
  const now = new Date();
  const month = parseInt(q.month || now.getMonth() + 1, 10);
  const year = parseInt(q.year || now.getFullYear(), 10);
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) throw new HttpError(400, 'Invalid month or year');
  return { month, year };
}

// "HH:mm" or "YYYY-MM-DD HH:mm[:ss]" -> "YYYY-MM-DD HH:mm:ss" (or null)
function combineDateTime(date, t) {
  if (!t) return null;
  if (/^\d{2}:\d{2}$/.test(t)) return `${date} ${t}:00`;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/.exec(t);
  if (m) return `${m[1]} ${m[2]}${m[3] || ':00'}`;
  throw new HttpError(400, 'Time must be HH:mm');
}

module.exports = { pad, ymd, mysqlDT, daysInMonth, monthRange, isDate, parseMonthYear, combineDateTime };

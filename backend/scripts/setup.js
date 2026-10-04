// One command sets up everything:  npm run setup
// - creates the database and tables from schema.sql
// - creates the admin account, demo employees, holidays and sample attendance
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

(async () => {
  const dbName = process.env.DB_NAME || 'attendance_db';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', multipleStatements: true, dateStrings: true
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
  await conn.query(`USE \`${dbName}\``);
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8').replace(/^\s*(CREATE DATABASE|USE)\b.*$/gim, '');
  await conn.query(sql);
  console.log('Tables ready.');

  // ---- accounts ----
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const empHash = await bcrypt.hash('Employee@123', 10);
  const today = new Date();
  const joined = `${today.getFullYear() - 1}-01-15`;
  await conn.query("INSERT IGNORE INTO employees (name,email,password_hash,role,department,join_date) VALUES ('Admin','admin@company.com',?, 'admin','Management',?)", [adminHash, joined]);
  const demo = [['Ravi Kumar', 'ravi@company.com', 'Engineering'], ['Priya Sharma', 'priya@company.com', 'Engineering'],
    ['Anil Reddy', 'anil@company.com', 'Sales'], ['Sneha Rao', 'sneha@company.com', 'HR'], ['Kiran Patel', 'kiran@company.com', 'Finance']];
  for (const [n, e, d] of demo) {
    await conn.query("INSERT IGNORE INTO employees (name,email,password_hash,role,department,join_date) VALUES (?,?,?, 'employee',?,?)", [n, e, empHash, d, joined]);
  }

  // ---- holidays (current year) ----
  const y = today.getFullYear();
  const hol = [['01-01', "New Year's Day"], ['01-26', 'Republic Day'], ['03-14', 'Holi'], ['08-15', 'Independence Day'],
    ['10-02', 'Gandhi Jayanti'], ['10-20', 'Diwali'], ['12-25', 'Christmas']];
  for (const [md, name] of hol) await conn.query('INSERT IGNORE INTO holidays (holiday_date, name) VALUES (?, ?)', [`${y}-${md}`, name]);
  // one holiday in the current month so the demo always shows something
  const inMonth = new Date(y, today.getMonth(), 20);
  if (inMonth.getDay() !== 0 && inMonth.getDay() !== 6) {
    await conn.query('INSERT IGNORE INTO holidays (holiday_date, name) VALUES (?, ?)', [ymd(inMonth), 'Company Day Off']);
  }

  // ---- sample attendance for previous + current month (only if none exists yet) ----
  const [[cnt]] = await conn.query('SELECT COUNT(*) AS c FROM attendance');
  if (cnt.c === 0) {
    const [emps] = await conn.query("SELECT id FROM employees WHERE role='employee'");
    const [holRows] = await conn.query('SELECT holiday_date FROM holidays');
    const holSet = new Set(holRows.map((h) => h.holiday_date));
    const reasons = ['Heavy traffic', 'Bus delay', 'Doctor appointment', 'Power cut at home', 'Family emergency'];
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    for (let d = new Date(start); ymd(d) < ymd(today); d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6 || holSet.has(ymd(d))) continue;
      for (const e of emps) {
        const r = Math.random();
        if (r > 0.88) continue; // stays absent
        const late = Math.random() < 0.15;
        const inH = late ? 9 : 8, inM = late ? rnd(40, 59) : rnd(30, 59);
        const login = `${ymd(d)} ${pad(inH + (late ? 0 : 0))}:${pad(inM)}:00`;
        const logout = `${ymd(d)} ${pad(rnd(17, 18))}:${pad(rnd(0, 59))}:00`;
        await conn.query(
          'INSERT IGNORE INTO attendance (employee_id,date,login_time,logout_time,status,work_mode,is_late,late_reason) VALUES (?,?,?,?,?,?,?,?)',
          [e.id, ymd(d), login, logout, 'present', Math.random() < 0.35 ? 'WFH' : 'WFO', late ? 1 : 0, late ? reasons[rnd(0, 4)] : null]);
      }
    }
    // a few leaves
    const [e1, e2, e3] = emps;
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
    await conn.query("INSERT INTO leaves (employee_id,date_from,date_to,leave_type,reason,status) VALUES (?,?,?,?,?,'pending')", [e1.id, ymd(nextWeek), ymd(nextWeek), 'casual', 'Personal work']);
    if (e2) await conn.query("INSERT INTO leaves (employee_id,date_from,date_to,leave_type,reason,status) VALUES (?,?,?,?,?,'unapproved')", [e2.id, `${y}-${pad(today.getMonth() + 1)}-03`, `${y}-${pad(today.getMonth() + 1)}-03`, 'other', 'Left without approval']);
    if (e3) await conn.query("INSERT INTO leaves (employee_id,date_from,date_to,leave_type,reason,status) VALUES (?,?,?,?,?,'approved')", [e3.id, `${y}-${pad(today.getMonth() + 1)}-05`, `${y}-${pad(today.getMonth() + 1)}-06`, 'sick', 'Fever']);
    console.log('Sample attendance added.');
  }

  console.log('\nSetup complete!\n  Admin login:    admin@company.com / Admin@123\n  Employee login: ravi@company.com / Employee@123');
  await conn.end();
})().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });

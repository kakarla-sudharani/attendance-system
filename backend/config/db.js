const mysql = require('mysql2/promise');
require('dotenv').config();

// dateStrings:true => DATE/DATETIME come back as plain strings ("2026-09-28",
// "2026-09-28 09:15:00"), so there are no timezone surprises.
module.exports = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_db',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

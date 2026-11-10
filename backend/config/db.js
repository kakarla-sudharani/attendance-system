const mysql = require('mysql2/promise');
require('dotenv').config();

module.exports = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_db',

  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,

  // Secure connection for TiDB Cloud
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

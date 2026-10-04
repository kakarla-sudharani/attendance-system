-- Employee Attendance Management System - MySQL schema
CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4;
USE attendance_db;

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(100),
  join_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  login_time DATETIME NULL,
  logout_time DATETIME NULL,
  status ENUM('present','absent') NOT NULL DEFAULT 'present',
  work_mode ENUM('WFO','WFH') NULL,
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  late_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_emp_date (employee_id, date),
  INDEX idx_date (date)
);

CREATE TABLE IF NOT EXISTS leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  leave_type VARCHAR(30) NOT NULL DEFAULT 'casual',
  reason VARCHAR(255) NULL,
  status ENUM('pending','approved','unapproved') NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL,
  INDEX idx_leave_emp (employee_id, date_from, date_to)
);

CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL
);

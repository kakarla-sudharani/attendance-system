# AttendEase — Employee Attendance Management System

Three parts, one project:

| Folder | What it is |
|---|---|
| `backend/` | Node.js + Express + MySQL REST API **and** the web frontend (in `backend/public`) |
| `android/` | Complete native Android app (Java) for employees and admins |

Both the web app and the Android app talk to the same backend, so data is shared.

---
## PART 1 – Install the tools (one time)

1. **Node.js (LTS)** – https://nodejs.org
2. **MySQL Server** (+ MySQL Workbench optional) – https://dev.mysql.com/downloads/installer/
   Remember the **root password** you set during install.
3. **VS Code** (to view/edit files) – https://code.visualstudio.com
4. **Android Studio** – https://developer.android.com/studio (for the Android app)

## Web frontend
The web app (`backend/public`) is now styled as **AttendEase**: a dark-navy sidebar,
stat cards, a doughnut chart on the admin dashboard, a bar chart on Reports, a
split-screen login page, and a dark-mode toggle (moon/sun icon, top right). No
backend code changed — only `index.html`, `style.css` and `app.js` in `backend/public`.

## PART 2 – Run the backend + web app

Open the `backend` folder in VS Code → Terminal → New Terminal, then:

```
npm install
copy .env.example .env        (Mac/Linux: cp .env.example .env)
```
Open `.env` and set `DB_PASSWORD` to your MySQL root password. Then:

```
npm run setup      # creates the database, tables, admin account, demo data
npm start          # starts the server
```
You should see: `Attendance system running: http://localhost:5000`

Open **http://localhost:5000** in a browser.

| Role | Email | Password |
|---|---|---|
| Admin | admin@company.com | Admin@123 |
| Employee | ravi@company.com | Employee@123 |

(Other demo employees: priya@, anil@, sneha@, kiran@company.com – same password.)

## PART 3 – Run the Android app

1. Keep the backend running (Part 2).
2. Android Studio → **Open** → choose the `android` folder. Wait for Gradle sync (first time downloads a lot – needs internet).
   *If sync complains about the Gradle wrapper, click "OK/Use Gradle from Android Studio".*
3. Create/choose an emulator: **Device Manager → Create device** (e.g. Pixel 6, API 34).
4. Press the green **Run ▶** button.
5. On the login screen the server address is pre-filled with `http://10.0.2.2:5000`
   (that is how the emulator reaches your PC). Log in with the demo accounts above.

**Real phone instead of emulator:** phone and PC on the same Wi-Fi → find the PC's IP
(Windows: `ipconfig`, Mac/Linux: `ifconfig`) → type `http://192.168.x.x:5000` in the
server field on the login screen. Allow port 5000 in the PC firewall if needed.

---
## Features → where they are

| Requirement | Backend | Android | Web |
|---|---|---|---|
| Login & authentication (JWT, bcrypt, roles) | `routes/auth.js`, `middleware/auth.js` | LoginActivity | login screen |
| Daily attendance Present/Absent | `routes/attendance.js`, `services/monthCalc.js` (past days with no record = Absent automatically) | HomeActivity | Today |
| Login & logout time | `/attendance/checkin`, `/checkout` | HomeActivity | Today |
| Late login needs a reason **before** it is recorded | server returns `422 LATE_REASON_REQUIRED`, nothing is saved | dialog in HomeActivity | Today |
| Work mode WFO / WFH | `work_mode` column | radio buttons | dropdown |
| Leave management (approved / unapproved / pending) | `routes/leaves.js`, `routes/admin.js` | LeavesActivity, AdminLeavesActivity | Leaves |
| Holiday management + count per month | `routes/holidays.js` | HolidaysActivity | Holidays |
| Monthly summary (working, present, absent, leaves, holidays) | `routes/summary.js` | SummaryActivity | Summary |
| Attendance percentage (automatic) | `services/monthCalc.js` | Home + Summary | Today + Summary |
| Late attendance report with reasons | `/attendance/late-report`, `/admin/reports/late` | Late Report screen | Late Report / Reports |
| Attendance history month-wise | `/attendance/history` | HistoryActivity | History |
| Admin dashboard: attendance, leaves, holidays, WFH/WFO, reports, employees | `routes/admin.js` | AdminHome + 5 admin screens | Admin tabs (+ CSV export) |
| Secure storage | MySQL, parameterised queries, hashed passwords, JWT, role checks | token in app storage | – |

### Business rules (good to explain in your demo)
- **Working days** = weekdays (Mon–Fri) − holidays.
- **Late** = check-in after `LATE_THRESHOLD_HOUR:MINUTE` in `.env` (default 09:30).
- **Absent** = a past working day with no attendance, no holiday and no leave (no cron job needed – computed live).
- **Attendance %** = present days ÷ working days elapsed so far this month × 100.
- Leave flow: employee applies → *pending* → admin marks *approved* or *unapproved*. Admin can also record a leave directly.
- Admin can edit any employee's attendance, status and WFO/WFH for any date.
- "Deleting" an employee only deactivates them, so history is kept. There is no public sign-up – only admins create accounts.

## API summary (all under `/api`, JWT `Authorization: Bearer <token>`)
```
POST /auth/login                    GET  /auth/me         POST /auth/change-password
GET  /attendance/today              POST /attendance/checkin   POST /attendance/checkout
GET  /attendance/history?month&year GET  /attendance/late-report?month&year
GET  /summary/monthly?month&year
POST /leaves/apply   GET /leaves/mine   DELETE /leaves/:id
GET  /holidays?month&year   GET /holidays/monthly-counts?year   (admin) POST /holidays  DELETE /holidays/:id
(admin) GET /admin/stats
(admin) GET/POST /admin/employees   PUT/DELETE /admin/employees/:id
(admin) GET/PUT/DELETE /admin/attendance
(admin) GET/POST /admin/leaves   PUT /admin/leaves/:id/review
(admin) GET /admin/reports/monthly?month&year[&format=csv]   GET /admin/reports/late?month&year[&format=csv]
```

## Suggested demo order (5 minutes)
1. Web: log in as **admin** → Dashboard, Attendance (edit one row, switch WFH), Leaves (approve), Holidays, Reports (download CSV).
2. Android: log in as **ravi** → Check In (choose WFH). To show the late flow, set `LATE_THRESHOLD_HOUR=0` in `.env`, restart the server, and check in – the reason dialog appears.
3. Show Summary/History/Late Report/Holidays on the phone.
4. Explain the DB tables (`backend/schema.sql`) and the % formula.

## Troubleshooting
- **`npm run setup` says Access denied** → wrong `DB_PASSWORD` in `.env`.
- **App: "Cannot reach the server"** → backend not running, wrong server address, or (real phone) different Wi-Fi / firewall.
- **Emulator address** must be `http://10.0.2.2:5000`, *not* `localhost`.
- **Late-reason box never appears** → you checked in before the threshold time; lower `LATE_THRESHOLD_HOUR` to test.
- **Started the app but seeing old data** → run `npm run setup` again only adds missing data; to start fresh, drop the database in MySQL Workbench and re-run it.

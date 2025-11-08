import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs-extra";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

// Paths setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


const dataFile = path.join(__dirname, "../data/attendance.json");
let attendance = { history: [], active: {}, stats: {} };

// Load data if exists
if (fs.existsSync(dataFile)) {
  attendance = JSON.parse(fs.readFileSync(dataFile));
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(attendance, null, 2));
}

// Helper: calculate session duration
function getSecondsDiff(startTime, endTime) {
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
}

// Helper: format seconds into hh:mm:ss
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

// Handle voice events
app.post("/voice-event", (req, res) => {
  const { type, user, channel } = req.body;
  const timestamp = new Date().toISOString();

  if (type === "join") {
    attendance.active[user] = { channel, joinedAt: timestamp };
    attendance.history.unshift({ type, user, channel, time: timestamp });
  } else if (type === "leave") {
    if (attendance.active[user]) {
      const joinedAt = attendance.active[user].joinedAt;
      const duration = getSecondsDiff(joinedAt, timestamp);

      // Add to total stats
      if (!attendance.stats[user]) attendance.stats[user] = 0;
      attendance.stats[user] += duration;
    }

    delete attendance.active[user];
    attendance.history.unshift({ type, user, channel, time: timestamp });
  }

  io.emit("update", attendance);
  saveData();
  res.sendStatus(200);
});

// Get daily leaderboard
app.get("/leaderboard/daily", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const dailyStats = {};

  attendance.history.forEach((e) => {
    if (e.type === "leave" && e.time.startsWith(today)) {
      const joined = attendance.active[e.user]?.joinedAt || e.time;
      const duration = getSecondsDiff(joined, e.time);
      dailyStats[e.user] = (dailyStats[e.user] || 0) + duration;
    }
  });

  const leaderboard = Object.entries(dailyStats)
    .sort((a, b) => b[1] - a[1])
    .map(([user, seconds]) => ({ user, time: formatTime(seconds) }));

  res.json(leaderboard);
});

// Get weekly leaderboard
app.get("/leaderboard/weekly", (req, res) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const weeklyStats = {};
  attendance.history.forEach((e) => {
    if (e.type === "leave" && new Date(e.time) >= startOfWeek) {
      const joined = attendance.active[e.user]?.joinedAt || e.time;
      const duration = getSecondsDiff(joined, e.time);
      weeklyStats[e.user] = (weeklyStats[e.user] || 0) + duration;
    }
  });

  const leaderboard = Object.entries(weeklyStats)
    .sort((a, b) => b[1] - a[1])
    .map(([user, seconds]) => ({ user, time: formatTime(seconds) }));

  res.json(leaderboard);
});

// Export attendance as XLSX
app.get("/export/xlsx", async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");

  sheet.columns = [
    { header: "User", key: "user", width: 25 },
    { header: "Total VC Time", key: "time", width: 20 },
  ];

  for (const [user, seconds] of Object.entries(attendance.stats || {})) {
    sheet.addRow({ user, time: formatTime(seconds) });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="attendance.xlsx"'
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.send(Buffer.from(buffer));
});

// Root fallback (fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Realtime updates
io.on("connection", (socket) => {
  socket.emit("update", attendance);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🌐 Web server running on port ${PORT}`)
);

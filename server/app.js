import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs-extra";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dataFile = "./data/attendance.json";
let attendance = { history: [], active: {}, stats: {} };

// Load data if exists
if (fs.existsSync(dataFile)) {
  attendance = JSON.parse(fs.readFileSync(dataFile));
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(attendance, null, 2));
}

// Helper to calculate session duration
function getSecondsDiff(startTime, endTime) {
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
}

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

io.on("connection", (socket) => {
  socket.emit("update", attendance);
});

server.listen(3000, () => console.log("🌐 Web server running on port 3000"));

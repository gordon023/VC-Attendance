import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // allow all origins for testing
});

// In-memory attendance data
let attendance = {
  active: {}, // { username: { channel, joinedAt } }
  history: [] // [{ user, channel, type, time }]
};

// Serve static frontend
app.use(express.static("public"));
app.use(cors());

// Leaderboard route (example)
app.get("/leaderboard/:type", (req, res) => {
  const list = Object.entries(attendance.active).map(([user, info]) => ({
    user,
    time: Math.floor((Date.now() - info.joinedAt) / 1000) // seconds
  }));
  res.json(list);
});

// Mock export XLSX route
app.get("/export/xlsx", (req, res) => {
  res.send("Export functionality not implemented yet");
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected");

  // Send current attendance immediately
  socket.emit("update", attendance);

  // Example: mock join/leave events every 10 seconds
  // Replace with actual Discord bot events
  setInterval(() => {
    const users = ["Alice", "Bob", "Charlie"];
    const user = users[Math.floor(Math.random() * users.length)];
    const joined = Math.random() > 0.5;

    if (joined) {
      attendance.active[user] = { channel: "General", joinedAt: Date.now() };
      attendance.history.unshift({ user, channel: "General", type: "join", time: Date.now() });
      console.log(`📡 ${user} joined VC`);
    } else {
      delete attendance.active[user];
      attendance.history.unshift({ user, channel: "General", type: "left", time: Date.now() });
      console.log(`📡 ${user} left VC`);
    }

    // Broadcast to all connected clients
    io.emit("update", attendance);

  }, 10000); // every 10 seconds
});

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});

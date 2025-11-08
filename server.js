import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve frontend
app.use(express.static("public"));

// Attendance storage
let attendance = {
  active: {},     // { displayName: { channel, joinedAt } }
  history: [],    // [{ user, channel, type, time }]
  leaderboard: {} // { displayName: totalTimeMs }
};

// Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// Helper functions
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

function getLeaderboard() {
  return Object.entries(attendance.leaderboard)
    .map(([user, ms]) => ({ user, time: formatDuration(Math.floor(ms / 1000)) }))
    .sort((a,b)=>b.time.localeCompare(a.time));
}

function updateFrontend() {
  io.emit("update", {
    active: attendance.active,
    history: attendance.history.slice(0, 50),
    leaderboard: getLeaderboard()
  });
}

// Scan VC members already inside at bot start
async function scanInitialVCs() {
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.filter(c => c.isVoiceBased()).forEach(vc => {
      vc.members.forEach(member => {
        const displayName = member.nickname || member.user.username;
        if (!attendance.active[displayName]) {
          attendance.active[displayName] = { channel: vc.name, joinedAt: Date.now() };
        }
      });
    });
  });
  updateFrontend();
}

// Discord events
client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await scanInitialVCs();
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  const displayName = member.nickname || member.user.username;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  // Left VC
  if (oldChannel && !newChannel) {
    const joinedAt = attendance.active[displayName]?.joinedAt || now;
    const sessionTime = now - joinedAt;
    attendance.leaderboard[displayName] = (attendance.leaderboard[displayName] || 0) + sessionTime;
    delete attendance.active[displayName];

    attendance.history.unshift({
      user: displayName,
      channel: oldChannel.name,
      type: "left",
      time: now
    });

    console.log(`📡 ${displayName} left VC`);
  }

  // Joined VC
  if (!oldChannel && newChannel) {
    attendance.active[displayName] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({
      user: displayName,
      channel: newChannel.name,
      type: "join",
      time: now
    });
    console.log(`📡 ${displayName} joined VC`);
  }

  // Keep last 100 history entries
  if (attendance.history.length > 100) attendance.history = attendance.history.slice(0,100);

  updateFrontend();
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  updateFrontend();
});

// XLSX Export
app.get("/export/xlsx", (req,res) => {
  const rows = [];

  Object.entries(attendance.active).forEach(([user, info]) => {
    const now = Date.now();
    const duration = formatDuration(Math.floor((now - info.joinedAt)/1000));
    rows.push({ user, channel: info.channel, status: "Active", duration });
  });

  attendance.history.slice(0,100).forEach(h=>{
    rows.push({
      user: h.user,
      channel: h.channel,
      status: h.type,
      duration: "-"
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const filePath = path.join(process.cwd(),"attendance.xlsx");
  XLSX.writeFile(wb, filePath);
  res.download(filePath, "attendance.xlsx", ()=>fs.unlinkSync(filePath));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`🚀 Server running on http://localhost:${PORT}`));

// Login
client.login(process.env.BOT_TOKEN);

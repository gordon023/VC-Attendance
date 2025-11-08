import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config(); // Load BOT_TOKEN

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve frontend
app.use(express.static("public"));

// Attendance storage
let attendance = { active: {}, history: [] };

// Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Populate current active VC members on startup
  client.guilds.cache.forEach(guild => {
    guild.channels.cache
      .filter(ch => ch.isVoiceBased())
      .forEach(vc => {
        vc.members.forEach(member => {
          const nickname = member.nickname || member.user.username;
          attendance.active[nickname] = { channel: vc.name, joinedAt: Date.now() };
        });
      });
  });

  // Broadcast initial attendance
  io.emit("update", attendance);
});

// Listen to voice state updates
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member;
  const nickname = member.nickname || member.user.username;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  // User left VC
  if (oldChannel && !newChannel) {
    delete attendance.active[nickname];
    attendance.history.unshift({ user: nickname, channel: oldChannel.name, type: "left", time: now });
    console.log(`📡 ${nickname} left VC`);
  }

  // User joined VC
  if (!oldChannel && newChannel) {
    attendance.active[nickname] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({ user: nickname, channel: newChannel.name, type: "join", time: now });
    console.log(`📡 ${nickname} joined VC`);
  }

  // Broadcast to frontend
  io.emit("update", attendance);
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// Export attendance as CSV
app.get("/export/csv", (req, res) => {
  const rows = [["User", "Channel", "Joined At"]];
  Object.entries(attendance.active).forEach(([user, info]) => {
    rows.push([user, info.channel, new Date(info.joinedAt).toLocaleString()]);
  });

  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.BOT_TOKEN);

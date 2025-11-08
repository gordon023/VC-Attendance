import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config(); // for DISCORD_TOKEN

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

client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Listen to voice state updates
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  // Use server nickname if available, otherwise fallback to username
  const displayName = member.nickname || member.user.username;

  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  // User left VC
  if (oldChannel && !newChannel) {
    delete attendance.active[displayName];
    attendance.history.unshift({ user: displayName, channel: oldChannel.name, type: "left", time: now });
    console.log(`📡 ${displayName} left VC`);
  }

  // User joined VC
  if (!oldChannel && newChannel) {
    attendance.active[displayName] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({ user: displayName, channel: newChannel.name, type: "join", time: now });
    console.log(`📡 ${displayName} joined VC`);
  }

  // Broadcast to frontend
  io.emit("update", attendance);
});


// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.BOT_TOKEN);

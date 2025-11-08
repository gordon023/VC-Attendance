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

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Populate currently active VC members at startup
  for (const guild of client.guilds.cache.values()) {
    await guild.members.fetch(); // ensure all members cached
    for (const channel of guild.channels.cache.values()) {
      if (channel.isVoiceBased()) {
        for (const member of channel.members.values()) {
          const nickname = member.nickname;
          if (!nickname) continue; // skip if no server nickname
          attendance.active[nickname] = { channel: channel.name, joinedAt: Date.now() };
        }
      }
    }
  }

  // Broadcast initial state to frontend
  io.emit("update", attendance);
});

// Listen to voice state updates
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  const nickname = member.nickname;
  if (!nickname) return; // skip if no nickname
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

  // Broadcast update to frontend
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

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config(); // load DISCORD_TOKEN from .env

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public")); // serve frontend

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

  // Populate active VC members already in channels
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache
      .filter((ch) => ch.isVoiceBased())
      .forEach((vc) => {
        vc.members.forEach((member) => {
          if (member.user.bot) return;
          attendance.active[member.displayName] = {
            channel: vc.name,
            joinedAt: Date.now(),
          };
        });
      });
  });

  // Send initial data to frontend
  io.emit("update", attendance);
});

// Track join/leave/move events
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const nickname = member.displayName;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  // Left VC
  if (oldChannel && !newChannel) {
    delete attendance.active[nickname];
    attendance.history.unshift({ user: nickname, channel: oldChannel.name, type: "left", time: now });
    console.log(`📡 ${nickname} left VC`);
  }

  // Joined VC
  if (!oldChannel && newChannel) {
    attendance.active[nickname] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({ user: nickname, channel: newChannel.name, type: "join", time: now });
    console.log(`📡 ${nickname} joined VC`);
  }

  // Moved channels
  if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
    attendance.active[nickname] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({ user: nickname, channel: newChannel.name, type: "joined", time: now });
    attendance.history.unshift({ user: nickname, channel: oldChannel.name, type: "left", time: now });
    console.log(`📡 ${nickname} moved from ${oldChannel.name} to ${newChannel.name}`);
  }

  io.emit("update", attendance);
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// Login Discord bot
client.login(process.env.BOT_TOKEN);

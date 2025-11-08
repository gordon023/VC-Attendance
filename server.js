import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config(); // DISCORD_TOKEN, DISCORD_CHANNEL_ID

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve frontend
app.use(express.static("public"));
app.use(express.json({ limit: "50mb" })); // for large image payloads

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

  // Populate active VC members on bot start
  client.guilds.cache.forEach(guild => {
    guild.channels.cache
      .filter(ch => ch.isVoiceBased())
      .forEach(vc => {
        vc.members.forEach(member => {
          attendance.active[member.displayName] = {
            channel: vc.name,
            joinedAt: Date.now(), // approximate
          };
        });
      });
  });

  io.emit("update", attendance);
});

// Voice state updates
client.on("voiceStateUpdate", (oldState, newState) => {
  const memberName = newState.member.displayName;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  // Left VC
  if (oldChannel && !newChannel) {
    delete attendance.active[memberName];
    attendance.history.unshift({
      user: memberName,
      channel: oldChannel.name,
      type: "left",
      time: now,
    });
    console.log(`📡 ${memberName} left VC`);
  }

  // Joined VC
  if (!oldChannel && newChannel) {
    attendance.active[memberName] = { channel: newChannel.name, joinedAt: now };
    attendance.history.unshift({
      user: memberName,
      channel: newChannel.name,
      type: "join",
      time: now,
    });
    console.log(`📡 ${memberName} joined VC`);
  }

  io.emit("update", attendance);
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// ---------------- IMAGE UPLOAD ----------------
app.post("/upload-images", async (req, res) => {
  const images = req.body; // [{ name, dataURL }]
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const channel = client.channels.cache.get(channelId);

  if (!channel) return res.json({ success: false, error: "Discord channel not found" });

  try {
    for (const img of images) {
      // Convert base64 to buffer
      const base64Data = img.dataURL.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      // Send to Discord
      await channel.send({ files: [{ attachment: buffer, name: img.name }] });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.BOT_TOKEN);

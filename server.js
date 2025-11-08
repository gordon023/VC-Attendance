import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config(); // Loads DISCORD_TOKEN, DISCORD_CHANNEL_ID, etc.

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve frontend
app.use(express.static("public"));
app.use(express.json({ limit: "50mb" })); // Handle large image payloads

// Attendance storage
let attendance = { active: {}, history: [] };

// Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Populate current VC members when bot starts
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache
      .filter((ch) => ch.isVoiceBased())
      .forEach((vc) => {
        vc.members.forEach((member) => {
          attendance.active[member.displayName] = {
            channel: vc.name,
            joinedAt: Date.now(), // approximate join time
          };
        });
      });
  });

  io.emit("update", attendance);
});

// Handle join/leave VC
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

// Socket.IO connections
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// ---------------- IMAGE UPLOAD HANDLER ----------------
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1433449406056763557/nifC_lCD78cMTOoMY6ryDBlain76udKiIEVOitIWT_n8XqygjGj_GWU0zDEf8v6GTxGu";

app.post("/upload-images", async (req, res) => {
  try {
    const images = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, error: "No images provided" });
    }

    const formData = new FormData();
    images.forEach((img, i) => {
      const base64 = img.dataURL.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      formData.append(`files[${i}]`, new Blob([buffer]), img.name);
    });

    formData.append("content", "🖼️ New images uploaded from the VC Attendance dashboard!");

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Discord webhook error:", errText);
      return res.status(500).json({ success: false, error: errText });
    }

    console.log("✅ Images successfully uploaded to Discord");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.BOT_TOKEN);

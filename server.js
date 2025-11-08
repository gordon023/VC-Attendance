import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import fetch, { FormData, Blob } from "node-fetch";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));
app.use(express.json({ limit: "50mb" }));

// ====== ATTENDANCE STORAGE ======
let attendance = { active: {}, history: [] };

// ====== DISCORD CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Preload active VC members on startup
  client.guilds.cache.forEach(guild => {
    guild.channels.cache
      .filter(ch => ch.isVoiceBased())
      .forEach(vc => {
        vc.members.forEach(member => {
          attendance.active[member.displayName] = {
            channel: vc.name,
            joinedAt: Date.now(),
          };
        });
      });
  });

  io.emit("update", attendance);
});

// ====== VOICE STATE UPDATE ======
client.on("voiceStateUpdate", (oldState, newState) => {
  const memberName = newState.member.displayName;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

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

// ====== SOCKET.IO ======
io.on("connection", (socket) => {
  console.log("✅ Client connected");
  socket.emit("update", attendance);
});

// ====== IMAGE UPLOAD TO DISCORD WEBHOOK ======
app.post("/upload-images", async (req, res) => {
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  const images = req.body;

  if (!DISCORD_WEBHOOK_URL) {
    return res.status(500).json({ success: false, error: "Webhook URL not configured" });
  }
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ success: false, error: "No images provided" });
  }

  try {
    const formData = new FormData();

    for (const [i, img] of images.entries()) {
      const base64 = img.dataURL.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      const blob = new Blob([buffer], { type: "image/png" });
      formData.append(`files[${i}]`, blob, img.name);
    }

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

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

client.login(process.env.BOT_TOKEN);

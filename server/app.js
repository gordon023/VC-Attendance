import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import fs from "fs-extra";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, Events } from "discord.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dataFile = path.join(__dirname, "data", "attendance.json");
fs.ensureFileSync(dataFile);

let attendance = { history: [], active: {}, stats: {} };
// Load data if exists
if (fs.existsSync(dataFile)) {
  try {
    const content = fs.readFileSync(dataFile, "utf8");
    attendance = content ? JSON.parse(content) : { history: [], active: {}, stats: {} };
  } catch (err) {
    console.error("⚠️ Error reading attendance.json, resetting:", err.message);
    attendance = { history: [], active: {}, stats: {} };
  }
} else {
  attendance = { history: [], active: {}, stats: {} };
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(attendance, null, 2));
}
function getSecondsDiff(startTime, endTime) {
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
}
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

/* ------------------ REST API ------------------ */
app.post("/voice-event", (req, res) => {
  const { type, user, channel } = req.body;
  const timestamp = new Date().toISOString();

  if (type === "join") {
    attendance.active[user] = { channel, joinedAt: timestamp };
    attendance.history.unshift({ type, user, channel, time: timestamp });
    if (attendance.history.length > 100) attendance.history.pop(); // limit history size
  } else if (type === "leave") {
    if (attendance.active[user]) {
      const joinedAt = attendance.active[user].joinedAt;
      const duration = getSecondsDiff(joinedAt, timestamp);
      if (!attendance.stats[user]) attendance.stats[user] = 0;
      attendance.stats[user] += duration;
    }
    delete attendance.active[user];
    attendance.history.unshift({ type, user, channel, time: timestamp });
    if (attendance.history.length > 100) attendance.history.pop(); // limit history size
  }

  io.emit("update", attendance);
  saveData();
  res.sendStatus(200);
});

// TODO: Add your leaderboard and export routes here

io.on("connection", (socket) => {
  socket.emit("update", attendance);
});

/* ------------------ DISCORD BOT ------------------ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const WEB_API_URL = process.env.WEB_API_URL || "http://localhost:3000";

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎧 Tracking voice channel ID: ${VOICE_CHANNEL_ID}`);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const user = newState.member?.user?.username;
    if (!user) return;

    const guildId = newState.guild.id;
    const joinedChannel = newState.channelId;
    const leftChannel = oldState.channelId;

    if (guildId !== GUILD_ID) return;

    // User joined the target VC (including switch from another VC)
    if (joinedChannel === VOICE_CHANNEL_ID && leftChannel !== VOICE_CHANNEL_ID) {
      await sendEvent({ type: "join", user, channel: newState.channel.name });
      console.log(`📡 ${user} joined VC`);
    }

    // User left the target VC (including switch to another VC or disconnect)
    if (leftChannel === VOICE_CHANNEL_ID && joinedChannel !== VOICE_CHANNEL_ID) {
      await sendEvent({ type: "leave", user, channel: oldState.channel.name });
      console.log(`📡 ${user} left VC`);
    }
  } catch (err) {
    console.error("VoiceState error:", err);
  }
});

async function sendEvent(event) {
  try {
    const res = await fetch(`${WEB_API_URL}/voice-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.error(`Failed to send event: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("Failed to send event:", err.message);
  }
}

client.login(process.env.BOT_TOKEN);

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🌐 Web + Bot running on port ${PORT}`)
);

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
if (fs.existsSync(dataFile)) {
  attendance = JSON.parse(fs.readFileSync(dataFile));
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
  } else if (type === "leave") {
    if (attendance.active[user]) {
      const joinedAt = attendance.active[user].joinedAt;
      const duration = getSecondsDiff(joinedAt, timestamp);
      if (!attendance.stats[user]) attendance.stats[user] = 0;
      attendance.stats[user] += duration;
    }
    delete attendance.active[user];
    attendance.history.unshift({ type, user, channel, time: timestamp });
  }

  io.emit("update", attendance);
  saveData();
  res.sendStatus(200);
});

// Leaderboards & export endpoints are unchanged (omitted for brevity)
// ... include your daily/weekly/export routes here ...

io.on("connection", (socket) => socket.emit("update", attendance));

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

    // Only react if it's in the correct guild & voice channel
    if (guildId !== GUILD_ID) return;

    if (!leftChannel && joinedChannel === VOICE_CHANNEL_ID) {
      await sendEvent({ type: "join", user, channel: newState.channel.name });
      console.log(`📡 ${user} joined VC`);
    } else if (leftChannel === VOICE_CHANNEL_ID && !joinedChannel) {
      await sendEvent({ type: "leave", user, channel: oldState.channel.name });
      console.log(`📡 ${user} left VC`);
    }
  } catch (err) {
    console.error("VoiceState error:", err);
  }
});

async function sendEvent(event) {
  await fetch(`${WEB_API_URL}/voice-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}

client.login(process.env.BOT_TOKEN);

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🌐 Web + Bot running on port ${PORT}`)
);

import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import fetch from "node-fetch"; // make sure to install node-fetch v3+

dotenv.config();

// Read environment variables as strings
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const WEB_API_URL = process.env.WEB_API_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!GUILD_ID || !VOICE_CHANNEL_ID || !WEB_API_URL || !BOT_TOKEN) {
  console.error("❌ Missing required environment variables. Please check your .env file.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎧 Tracking voice channel ID: ${VOICE_CHANNEL_ID}`);
});

client.on("voiceStateUpdate", (oldState, newState) => {
  try {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const user = member.displayName || member.user.username;
    const guildId = newState.guild.id;

    if (guildId !== GUILD_ID) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Joined the target voice channel
    if (newChannelId === VOICE_CHANNEL_ID && oldChannelId !== VOICE_CHANNEL_ID) {
      sendEvent({ type: "join", user, channel: newState.channel.name, guildId });
    }

    // Left the target voice channel
    if (oldChannelId === VOICE_CHANNEL_ID && newChannelId !== VOICE_CHANNEL_ID) {
      sendEvent({ type: "leave", user, channel: oldState.channel.name, guildId });
    }
  } catch (error) {
    console.error("❌ Error in voiceStateUpdate event:", error);
  }
});

async function sendEvent(event) {
  try {
    const res = await fetch(`${WEB_API_URL}/voice-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (res.ok) {
      console.log(`📡 Sent ${event.type} event for ${event.user} in channel ${event.channel}`);
    } else {
      console.error(`❌ Failed to send event: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error("Response body:", text);
    }
  } catch (err) {
    console.error("❌ Failed to send event:", err.message);
  }
}

client.login(BOT_TOKEN);

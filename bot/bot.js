import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

// ✅ IDs and API URL from .env
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const WEB_API_URL = process.env.WEB_API_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

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
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const user = member.displayName || member.user.username;
  const guildId = newState.guild.id;

  if (guildId !== GUILD_ID) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  // Joined target voice channel
  if (newChannelId === VOICE_CHANNEL_ID && oldChannelId !== VOICE_CHANNEL_ID) {
    sendEvent({ type: "join", user, channel: newState.channel.name, guildId });
  }

  // Left target voice channel
  if (oldChannelId === VOICE_CHANNEL_ID && newChannelId !== VOICE_CHANNEL_ID) {
    sendEvent({ type: "leave", user, channel: oldState.channel.name, guildId });
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
      console.log(`📡 Sent ${event.type} event for ${event.user}`);
    } else {
      console.error(`❌ Failed to send event: ${res.statusText}`);
    }
  } catch (err) {
    console.error("❌ Failed to send event:", err.message);
  }
}

client.login(BOT_TOKEN);

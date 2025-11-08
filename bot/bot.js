import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

// ✅ CONFIG — ADD your server and voice channel IDs here
const GUILD_ID = process.env.GUILD_ID;          // e.g. "123456789012345678"
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;  // e.g. "987654321098765432"

const WEB_API_URL = process.env.WEB_API_URL; // e.g. https://vc-attendance.onrender.com/

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

client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const user = member.displayName || member.user.username;
  const guildId = newState.guild.id;

  // Only handle events from your target server and voice channel
  if (guildId !== GUILD_ID) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  // Joined target VC
  if (newChannelId === VOICE_CHANNEL_ID && oldChannelId !== VOICE_CHANNEL_ID) {
    sendEvent({ type: "join", user, channel: newState.channel.name, guildId });
  }

  // Left target VC
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

client.login(process.env.BOT_TOKEN);

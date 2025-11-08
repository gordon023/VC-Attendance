
import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";


dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

// 🆔 Set your Discord Server ID and Voice Channel ID here
const TARGET_GUILD_ID = "1038275000697901106";      // e.g. "123456789012345678"
const TARGET_VC_CHANNEL_ID = "1038275000697901110"; // e.g. "987654321098765432"

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎯 Tracking server: ${TARGET_GUILD_ID}`);
  console.log(`🎧 Tracking voice channel: ${TARGET_VC_CHANNEL_ID}`);
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const user = member.displayName || member.user.username;
  const guildId = newState.guild.id;

  // only track our target guild
  if (guildId !== TARGET_GUILD_ID) return;

  const newChannelId = newState.channelId;
  const oldChannelId = oldState.channelId;

  // only track join/leave for the target voice channel
  if (!oldChannelId && newChannelId === TARGET_VC_CHANNEL_ID) {
    // joined
    sendEvent({
      type: "join",
      user,
      channel: newState.channel?.name || "unknown",
      guildId,
    });
    console.log(`🟢 ${user} joined ${newState.channel?.name}`);
  } else if (oldChannelId === TARGET_VC_CHANNEL_ID && !newChannelId) {
    // left
    sendEvent({
      type: "leave",
      user,
      channel: oldState.channel?.name || "unknown",
      guildId,
    });
    console.log(`🔴 ${user} left ${oldState.channel?.name}`);
  }
});

async function sendEvent(event) {
  try {
    await fetch(process.env.WEB_API_URL + "voice-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    console.log(`📡 Sent ${event.type} event for ${event.user}`);
  } catch (err) {
    console.error("❌ Failed to send event:", err.message);
  }
}

client.login(process.env.BOT_TOKEN);

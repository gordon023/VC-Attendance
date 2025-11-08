import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember, Partials.User]
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Ensure guild members are cached so voiceStateUpdate fires correctly
  client.guilds.cache.forEach(async (guild) => {
    try {
      await guild.members.fetch();
      console.log(`📥 Cached members for guild: ${guild.name}`);
    } catch (err) {
      console.error(`⚠️ Failed to cache members for ${guild.name}:`, err.message);
    }
  });
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const user = member.displayName || member.user.username;
  const guildId = newState.guild.id;
  const newChannel = newState.channel ? newState.channel.name : null;
  const oldChannel = oldState.channel ? oldState.channel.name : null;

  if (!oldState.channelId && newState.channelId) {
    sendEvent({ type: "join", user, channel: newChannel, guildId });
  } else if (oldState.channelId && !newState.channelId) {
    sendEvent({ type: "leave", user, channel: oldChannel, guildId });
  }
});

async function sendEvent(event) {
  try {
    await fetch(process.env.WEB_API_URL + "voice-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
    console.log(`📡 Sent ${event.type} event for ${event.user}`);
  } catch (err) {
    console.error("❌ Failed to send event:", err.message);
  }
}

client.login(process.env.BOT_TOKEN);

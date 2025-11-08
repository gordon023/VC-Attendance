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
  partials: [Partials.GuildMember, Partials.User],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Cache all members for accurate detection
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await guild.members.fetch();
      console.log(`📥 Cached members for guild: ${guild.name}`);
    } catch (err) {
      console.error(`⚠️ Failed to cache members for ${guild.name}:`, err.message);
    }
  }

  // Start automatic voice tracking every 10 seconds
  setInterval(() => checkActiveVoiceMembers(), 10000);
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const user = member.displayName || member.user.username;
  const guildId = newState.guild.id;
  const newChannel = newState.channel ? newState.channel.name : null;
  const oldChannel = oldState.channel ? oldState.channel.name : null;

  if (!oldState.channelId && newState.channelId) {
    console.log(`🟢 ${user} joined ${newChannel}`);
    sendEvent({ type: "join", user, channel: newChannel, guildId });
  } else if (oldState.channelId && !newState.channelId) {
    console.log(`🔴 ${user} left ${oldChannel}`);
    sendEvent({ type: "leave", user, channel: oldChannel, guildId });
  }
});

// Background scanner (auto-detects all active voice members)
async function checkActiveVoiceMembers() {
  for (const [guildId, guild] of client.guilds.cache) {
    guild.channels.cache
      .filter((ch) => ch.type === 2) // voice channels only
      .forEach((vc) => {
        vc.members.forEach((member) => {
          if (member.user.bot) return;
          const user = member.displayName || member.user.username;
          sendEvent({ type: "join", user, channel: vc.name, guildId });
        });
      });
  }
}

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

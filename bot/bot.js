import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
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
    await fetch(process.env.WEB_API_URL, {
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

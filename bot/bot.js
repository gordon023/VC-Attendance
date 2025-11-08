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
  const user = newState.member.user.username;
  const guildId = newState.guild.id;
  const channel = newState.channel ? newState.channel.name : "none";

  if (!oldState.channelId && newState.channelId) {
    // Joined voice
    sendEvent({ type: "join", user, channel, guildId });
  } else if (oldState.channelId && !newState.channelId) {
    // Left voice
    sendEvent({ type: "leave", user, channel: oldState.channel.name, guildId });
  }
});

async function sendEvent(event) {
  try {
    await fetch("http://localhost:3000/voice-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
  } catch (err) {
    console.error("Failed to send event:", err.message);
  }
}

client.login(process.env.BOT_TOKEN);

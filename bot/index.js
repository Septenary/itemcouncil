require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Create a new Discord client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Fired when the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Respond to messages
client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.channel.send('Pong!');
  }
});

// Login using your bot token from .env
client.login(process.env.DISCORD_TOKEN);

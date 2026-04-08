const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    [GatewayIntentBits.Me](https://GatewayIntentBits.Me)ssageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const BOT_TOKEN = process.env.BOT_TOKEN;

client.once('ready', () => {
  console.log('Online as ' + client.user.tag);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'The Absolute Server', type: 0 }],
  });
});

client.on('messageCreate', async function(message) {
  if (message.author.bot) return;
  var content = message.content.trim();
  var channel = message.channel;

  if (content === '!ping') { channel.send('Pong. Still here.'); return; }

  if (content === '!help') {
    channel.send('**Serial Designation J — Commands**\n`!ping` — Check if online\n`!help` — Show this list\n`!info` — Server info\n`!rules` — Post rules\n`!warn @user reason` — Warn (mod only)\n`!clear [number]` — Delete messages (mod only)\n`!kick @user reason` — Kick (mod only)\n`!ban @user reason` — Ban (mod only)');
    return;
  }

  if (content === '!info') {
    var guild = message.guild;
    if (!guild) { channel.send('Server only.'); return; }
    channel.send('**' + guild.name + '**\nMembers: ' + [guild.me](https://guild.me)mberCount + '\nCreated: ' + guild.createdAt.toDateString());
    return;
  }

  if (content === '!rules') {
    channel.send('**Rules**\n1. Be respectful.\n2. No spam.\n3. Keep content appropriate.\n4. Follow Discord ToS.');
    return;
  }

  var isMod = [message.me](https://message.me)mber && [message.me](https://message.me)mber.permissions.has('ModerateMembers');

  if (content.startsWith('!warn')) {
    if (!isMod) { channel.send('No permission.'); return; }
    var warnTarget = [message.me](https://message.me)ntions.users.first();
    if (!warnTarget) { channel.send('Usage: !warn @user reason'); return; }
    var warnReason = content.replace('!warn', '').replace('<@' + warnTarget.id + '>', '').trim();
    channel.send('Warning issued to ' + warnTarget.username + (warnReason ? ' — ' + warnReason : ''));
    return;
  }

  if (content.startsWith('!clear')) {
    if (!isMod) { channel.send('No permission.'); return; }
    var amount = parseInt(content.split(' ')[1]);
    if (isNaN(amount) || amount < 1 || amount > 100) { channel.send('Usage: !clear 10'); return; }
    channel.bulkDelete(amount, true).catch(function() { channel.send('Failed. Messages may be older than 14 days.'); });
    return;
  }

  if (content.startsWith('!kick')) {
    if (!isMod) { channel.send('No permission.'); return; }
    var kickTarget = [message.mentions.me](https://message.mentions.me)mbers && [message.mentions.me](https://message.mentions.me)mbers.first();
    if (!kickTarget) { channel.send('Usage: !kick @user reason'); return; }
    kickTarget.kick().then(function() { channel.send(kickTarget.user.username + ' kicked.'); }).catch(function() { channel.send('Failed. Check permissions.'); });
    return;
  }

  if (content.startsWith('!ban')) {
    if (!isMod) { channel.send('No permission.'); return; }
    var banTarget = [message.mentions.me](https://message.mentions.me)mbers && [message.mentions.me](https://message.mentions.me)mbers.first();
    if (!banTarget) { channel.send('Usage: !ban @user reason'); return; }
    banTarget.ban().then(function() { channel.send(banTarget.user.username + ' banned.'); }).catch(function() { channel.send('Failed. Check permissions.'); });
    return;
  }
});

client.login(BOT_TOKEN);

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  [GatewayIntentBits.Me](https://GatewayIntentBits.Me)ssageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildMembers,
];

const client = new Client({ intents: INTENTS, partials: [Partials.Channel] });

const BOT_TOKEN = process.env.BOT_TOKEN;

client.once('ready', function() {
  console.log('Online as ' + client.user.tag);
});

client.on('messageCreate', function(message) {
  if (message.author.bot) return;
  var c = message.content.trim();
  var ch = message.channel;
  var isMod = [message.me](https://message.me)mber && [message.me](https://message.me)mber.permissions.has('ModerateMembers');

  if (c === '!ping') { ch.send('Pong.'); return; }
  if (c === '!help') { ch.send('Commands: !ping !help !info !rules !warn !clear !kick !ban'); return; }
  if (c === '!info') { ch.send('Server: ' + message.guild.name + ' | Members: ' + [message.guild.me](https://message.guild.me)mberCount); return; }
  if (c === '!rules') { ch.send('1. Be respectful.\n2. No spam.\n3. Follow Discord ToS.'); return; }

  if (c.startsWith('!warn')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var u = [message.me](https://message.me)ntions.users.first();
    if (!u) { ch.send('Usage: !warn @user reason'); return; }
    ch.send('Warning issued to ' + u.username);
    return;
  }

  if (c.startsWith('!clear')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var n = parseInt(c.split(' ')[1]);
    if (!n || n < 1 || n > 100) { ch.send('Usage: !clear 10'); return; }
    ch.bulkDelete(n, true).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!kick')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var m = [message.mentions.me](https://message.mentions.me)mbers.first();
    if (!m) { ch.send('Usage: !kick @user'); return; }
    m.kick().then(function() { ch.send('Kicked.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!ban')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var bm = [message.mentions.me](https://message.mentions.me)mbers.first();
    if (!bm) { ch.send('Usage: !ban @user'); return; }
    bm.ban().then(function() { ch.send('Banned.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }
});

client.login(BOT_TOKEN);

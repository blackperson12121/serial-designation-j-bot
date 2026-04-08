const DJS = require('discord.js');

const client = new DJS.Client({
  intents: [
    DJS.GatewayIntentBits.Guilds,
    DJS.GatewayIntentBits.GuildMessages,
    DJS.GatewayIntentBits.DirectMessages,
    DJS.GatewayIntentBits.GuildMembers,
    1 << 15,
  ],
  partials: [DJS.Partials.Channel],
});

client.once('ready', function() {
  console.log('Online as ' + client.user.tag);
});

client.on('messageCreate', function(msg) {
  if (msg.author.bot) return;
  var c = msg.content.trim();
  var ch = msg.channel;
  var mbr = [msg.me](https://msg.me)mber;
  var isMod = mbr && mbr.permissions.has('ModerateMembers');

  if (c === '!ping') { ch.send('Pong.'); return; }
  if (c === '!help') { ch.send('Commands: !ping !help !info !rules !warn !clear !kick !ban'); return; }
  if (c === '!info') { ch.send('Server: ' + msg.guild.name + ' | Members: ' + [msg.guild.me](https://msg.guild.me)mberCount); return; }
  if (c === '!rules') { ch.send('1. Be respectful.\n2. No spam.\n3. Follow Discord ToS.'); return; }

  if (c.startsWith('!warn')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var wu = [msg.me](https://msg.me)ntions.users.first();
    if (!wu) { ch.send('Usage: !warn @user reason'); return; }
    ch.send('Warning issued to ' + wu.username);
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
    var km = [msg.mentions.me](https://msg.mentions.me)mbers.first();
    if (!km) { ch.send('Usage: !kick @user'); return; }
    km.kick().then(function() { ch.send('Kicked.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!ban')) {
    if (!isMod) { ch.send('No permission.'); return; }
    var bm = [msg.mentions.me](https://msg.mentions.me)mbers.first();
    if (!bm) { ch.send('Usage: !ban @user'); return; }
    bm.ban().then(function() { ch.send('Banned.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }
});

client.login(process.env.BOT_TOKEN);

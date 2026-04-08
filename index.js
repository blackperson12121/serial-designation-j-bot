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

function isModerator(msg) {
  var guild = msg.guild;
  if (!guild) return false;
  var guildMod = guild.members.cache.get(msg.author.id);
  if (!guildMod) return false;
  return guildMod.permissions.has('ModerateMembers');
}

client.on('messageCreate', function(msg) {
  if (msg.author.bot) return;
  var c = msg.content.trim();
  var ch = msg.channel;

  if (c === '!ping') { ch.send('Pong.'); return; }
  if (c === '!help') { ch.send('Commands: !ping !help !info !rules !warn !clear !kick !ban'); return; }
  if (c === '!info') { ch.send('Server: ' + msg.guild.name + ' | Members: ' + msg.guild.memberCount); return; }
  if (c === '!rules') { ch.send('1. Be respectful.\n2. No spam.\n3. Follow Discord ToS.'); return; }

  if (c.startsWith('!warn')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var wu = msg.mentions.users.first();
    if (!wu) { ch.send('Usage: !warn @user reason'); return; }
    ch.send('Warning issued to ' + wu.username);
    return;
  }

  if (c.startsWith('!clear')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var n = parseInt(c.split(' ')[1]);
    if (!n || n < 1 || n > 100) { ch.send('Usage: !clear 10'); return; }
    ch.bulkDelete(n, true).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!kick')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var km = msg.mentions.members.first();
    if (!km) { ch.send('Usage: !kick @user'); return; }
    km.kick().then(function() { ch.send('Kicked.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!ban')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var bm = msg.mentions.members.first();
    if (!bm) { ch.send('Usage: !ban @user'); return; }
    bm.ban().then(function() { ch.send('Banned.'); }).catch(function() { ch.send('Failed.'); });
    return;
  }
});

client.login(process.env.BOT_TOKEN);

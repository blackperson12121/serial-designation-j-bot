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

var startTime = Date.now();

var roasts = [
  'I would roast you but my parents told me not to burn trash.',
  'You are the reason they put instructions on shampoo bottles.',
  'I have seen better plans written on a napkin.',
  'Your wifi password is probably your pet name. Twice.',
  'You bring everyone so much joy — when you leave.',
  'I would call you a tool but that implies you are useful.',
  'Error 404: Intelligence not found.',
];

var eightball = [
  'Absolutely.',
  'Without a doubt.',
  'Ask again later.',
  'Do not count on it.',
  'My sources say no.',
  'It is certain.',
  'Very doubtful.',
  'Signs point to yes.',
  'Outlook not so good.',
  'Cannot predict now.',
];

function isModerator(msg) {
  var guild = msg.guild;
  if (!guild) return false;
  var guildMod = guild.members.cache.get(msg.author.id);
  if (!guildMod) return false;
  return guildMod.permissions.has('ModerateMembers');
}

client.once('ready', function() {
  console.log('Online as ' + client.user.tag);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'The Absolute Server', type: 0 }],
  });
});

client.on('guildMemberAdd', function(guildMod) {
  var welcomeChannel = guildMod.guild.channels.cache.find(function(ch) {
    return ch.name === 'general' && ch.isTextBased();
  });
  if (welcomeChannel) {
    welcomeChannel.send('Welcome to **' + guildMod.guild.name + '**, <@' + guildMod.id + '>. Good to have you.');
  }
});

client.on('messageCreate', function(msg) {
  if (msg.author.bot) return;
  var c = msg.content.trim();
  var ch = msg.channel;

  if (c === '!ping') { ch.send('Pong.'); return; }

  if (c === '!help') {
    ch.send(
      '**Serial Designation J — Commands**\n\n' +
      '**Fun**\n' +
      '`!8ball [question]` — Ask the oracle\n' +
      '`!roll [number]` — Roll a dice\n' +
      '`!coinflip` — Heads or tails\n' +
      '`!say [text]` — Make me say something\n' +
      '`!roast @user` — Roast someone\n' +
      '`!poll [question]` — Start a yes/no poll\n\n' +
      '**Info**\n' +
      '`!info` — Server info\n' +
      '`!avatar @user` — Show avatar\n' +
      '`!servericon` — Show server icon\n' +
      '`!uptime` — How long I have been online\n' +
      '`!rules` — Server rules\n\n' +
      '**Mod Only**\n' +
      '`!warn @user reason` — Warn a user\n' +
      '`!clear [number]` — Delete messages\n' +
      '`!kick @user` — Kick a user\n' +
      '`!ban @user` — Ban a user\n' +
      '`!mute @user` — Timeout a user for 10 minutes\n' +
      '`!unmute @user` — Remove timeout\n' +
      '`!slowmode [seconds]` — Set channel slowmode'
    );
    return;
  }

  if (c === '!info') {
    ch.send('Server: **' + msg.guild.name + '** | Members: ' + msg.guild.memberCount + ' | Created: ' + msg.guild.createdAt.toDateString());
    return;
  }

  if (c === '!rules') {
    ch.send('**Server Rules**\n1. Be respectful.\n2. No spam.\n3. Keep content appropriate.\n4. Follow Discord ToS.\n\nViolations handled by moderation.');
    return;
  }

  if (c === '!coinflip') {
    ch.send(Math.random() < 0.5 ? 'Heads.' : 'Tails.');
    return;
  }

  if (c === '!uptime') {
    var ms = Date.now() - startTime;
    var mins = Math.floor(ms / 60000);
    var hrs = Math.floor(mins / 60);
    var days = Math.floor(hrs / 24);
    ch.send('Online for: ' + days + 'd ' + (hrs % 24) + 'h ' + (mins % 60) + 'm');
    return;
  }

  if (c === '!servericon') {
    var iconURL = msg.guild.iconURL({ size: 512 });
    if (!iconURL) { ch.send('No server icon set.'); return; }
    ch.send(iconURL);
    return;
  }

  if (c.startsWith('!roll')) {
    var sides = parseInt(c.split(' ')[1]) || 6;
    var result = Math.floor(Math.random() * sides) + 1;
    ch.send('Rolled a ' + sides + '-sided dice: **' + result + '**');
    return;
  }

  if (c.startsWith('!8ball')) {
    var question = c.replace('!8ball', '').trim();
    if (!question) { ch.send('Ask a question.'); return; }
    ch.send('**' + eightball[Math.floor(Math.random() * eightball.length)] + '**');
    return;
  }

  if (c.startsWith('!say')) {
    var text = c.replace('!say', '').trim();
    if (!text) { ch.send('Say what?'); return; }
    ch.send(text);
    return;
  }

  if (c.startsWith('!roast')) {
    var rt = msg.mentions.users.first();
    var target = rt ? rt.username : msg.author.username;
    ch.send(target + ', ' + roasts[Math.floor(Math.random() * roasts.length)]);
    return;
  }

  if (c.startsWith('!poll')) {
    var question = c.replace('!poll', '').trim();
    if (!question) { ch.send('Usage: !poll Is pineapple on pizza acceptable?'); return; }
    ch.send('**Poll:** ' + question + '\n\nReact with ✅ for Yes or ❌ for No').then(function(pollMsg) {
      pollMsg.react('✅');
      pollMsg.react('❌');
    });
    return;
  }

  if (c.startsWith('!avatar')) {
    var au = msg.mentions.users.first() || msg.author;
    ch.send(au.username + "'s avatar: " + au.displayAvatarURL({ size: 512 }));
    return;
  }

  if (c.startsWith('!warn')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var wu = msg.mentions.users.first();
    if (!wu) { ch.send('Usage: !warn @user reason'); return; }
    var wr = c.replace('!warn', '').replace('<@' + wu.id + '>', '').trim();
    ch.send('Warning issued to **' + wu.username + '**' + (wr ? ' — ' + wr : ''));
    return;
  }

  if (c.startsWith('!clear')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var n = parseInt(c.split(' ')[1]);
    if (!n || n < 1 || n > 100) { ch.send('Usage: !clear 10'); return; }
    ch.bulkDelete(n, true).catch(function() { ch.send('Failed. Messages may be older than 14 days.'); });
    return;
  }

  if (c.startsWith('!mute')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var muteTarget = msg.mentions.members.first();
    if (!muteTarget) { ch.send('Usage: !mute @user'); return; }
    muteTarget.timeout(10 * 60 * 1000, 'Muted by mod').then(function() {
      ch.send(muteTarget.user.username + ' has been muted for 10 minutes.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
    return;
  }

  if (c.startsWith('!unmute')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var unmuteTarget = msg.mentions.members.first();
    if (!unmuteTarget) { ch.send('Usage: !unmute @user'); return; }
    unmuteTarget.timeout(null).then(function() {
      ch.send(unmuteTarget.user.username + ' has been unmuted.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
    return;
  }

  if (c.startsWith('!slowmode')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var secs = parseInt(c.split(' ')[1]);
    if (isNaN(secs) || secs < 0 || secs > 21600) { ch.send('Usage: !slowmode 5 (0 to disable, max 21600)'); return; }
    ch.setRateLimitPerUser(secs).then(function() {
      ch.send(secs === 0 ? 'Slowmode disabled.' : 'Slowmode set to ' + secs + ' seconds.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
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

var startTime = Date.now();

var roasts = [
  'I would roast you but my parents told me not to burn trash.',
  'You are the reason they put instructions on shampoo bottles.',
  'I have seen better plans written on a napkin.',
  'Your wifi password is probably your pet name. Twice.',
  'You bring everyone so much joy — when you leave.',
  'I would call you a tool but that implies you are useful.',
  'Error 404: Intelligence not found.',
];

var eightball = [
  'Absolutely.',
  'Without a doubt.',
  'Ask again later.',
  'Do not count on it.',
  'My sources say no.',
  'It is certain.',
  'Very doubtful.',
  'Signs point to yes.',
  'Outlook not so good.',
  'Cannot predict now.',
];

function isModerator(msg) {
  var guild = msg.guild;
  if (!guild) return false;
  var guildMod = guild.members.cache.get(msg.author.id);
  if (!guildMod) return false;
  return guildMod.permissions.has('ModerateMembers');
}

client.once('ready', function() {
  console.log('Online as ' + client.user.tag);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'The Absolute Server', type: 0 }],
  });
});

client.on('guildMemberAdd', function(guildMod) {
  var welcomeChannel = guildMod.guild.channels.cache.find(function(ch) {
    return ch.name === 'general' && ch.isTextBased();
  });
  if (welcomeChannel) {
    welcomeChannel.send('Welcome to **' + guildMod.guild.name + '**, <@' + guildMod.id + '>. Good to have you.');
  }
});

client.on('messageCreate', function(msg) {
  if (msg.author.bot) return;
  var c = msg.content.trim();
  var ch = msg.channel;

  if (c === '!ping') { ch.send('Pong.'); return; }

  if (c === '!help') {
    ch.send(
      '**Serial Designation J — Commands**\n\n' +
      '**Fun**\n' +
      '`!8ball [question]` — Ask the oracle\n' +
      '`!roll [number]` — Roll a dice\n' +
      '`!coinflip` — Heads or tails\n' +
      '`!say [text]` — Make me say something\n' +
      '`!roast @user` — Roast someone\n' +
      '`!poll [question]` — Start a yes/no poll\n\n' +
      '**Info**\n' +
      '`!info` — Server info\n' +
      '`!avatar @user` — Show avatar\n' +
      '`!servericon` — Show server icon\n' +
      '`!uptime` — How long I have been online\n' +
      '`!rules` — Server rules\n\n' +
      '**Mod Only**\n' +
      '`!warn @user reason` — Warn a user\n' +
      '`!clear [number]` — Delete messages\n' +
      '`!kick @user` — Kick a user\n' +
      '`!ban @user` — Ban a user\n' +
      '`!mute @user` — Timeout a user for 10 minutes\n' +
      '`!unmute @user` — Remove timeout\n' +
      '`!slowmode [seconds]` — Set channel slowmode'
    );
    return;
  }

  if (c === '!info') {
    ch.send('Server: **' + msg.guild.name + '** | Members: ' + msg.guild.memberCount + ' | Created: ' + msg.guild.createdAt.toDateString());
    return;
  }

  if (c === '!rules') {
    ch.send('**Server Rules**\n1. Be respectful.\n2. No spam.\n3. Keep content appropriate.\n4. Follow Discord ToS.\n\nViolations handled by moderation.');
    return;
  }

  if (c === '!coinflip') {
    ch.send(Math.random() < 0.5 ? 'Heads.' : 'Tails.');
    return;
  }

  if (c === '!uptime') {
    var ms = Date.now() - startTime;
    var mins = Math.floor(ms / 60000);
    var hrs = Math.floor(mins / 60);
    var days = Math.floor(hrs / 24);
    ch.send('Online for: ' + days + 'd ' + (hrs % 24) + 'h ' + (mins % 60) + 'm');
    return;
  }

  if (c === '!servericon') {
    var iconURL = msg.guild.iconURL({ size: 512 });
    if (!iconURL) { ch.send('No server icon set.'); return; }
    ch.send(iconURL);
    return;
  }

  if (c.startsWith('!roll')) {
    var sides = parseInt(c.split(' ')[1]) || 6;
    var result = Math.floor(Math.random() * sides) + 1;
    ch.send('Rolled a ' + sides + '-sided dice: **' + result + '**');
    return;
  }

  if (c.startsWith('!8ball')) {
    var question = c.replace('!8ball', '').trim();
    if (!question) { ch.send('Ask a question.'); return; }
    ch.send('**' + eightball[Math.floor(Math.random() * eightball.length)] + '**');
    return;
  }

  if (c.startsWith('!say')) {
    var text = c.replace('!say', '').trim();
    if (!text) { ch.send('Say what?'); return; }
    ch.send(text);
    return;
  }

  if (c.startsWith('!roast')) {
    var rt = msg.mentions.users.first();
    var target = rt ? rt.username : msg.author.username;
    ch.send(target + ', ' + roasts[Math.floor(Math.random() * roasts.length)]);
    return;
  }

  if (c.startsWith('!poll')) {
    var question = c.replace('!poll', '').trim();
    if (!question) { ch.send('Usage: !poll Is pineapple on pizza acceptable?'); return; }
    ch.send('**Poll:** ' + question + '\n\nReact with ✅ for Yes or ❌ for No').then(function(pollMsg) {
      pollMsg.react('✅');
      pollMsg.react('❌');
    });
    return;
  }

  if (c.startsWith('!avatar')) {
    var au = msg.mentions.users.first() || msg.author;
    ch.send(au.username + "'s avatar: " + au.displayAvatarURL({ size: 512 }));
    return;
  }

  if (c.startsWith('!warn')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var wu = msg.mentions.users.first();
    if (!wu) { ch.send('Usage: !warn @user reason'); return; }
    var wr = c.replace('!warn', '').replace('<@' + wu.id + '>', '').trim();
    ch.send('Warning issued to **' + wu.username + '**' + (wr ? ' — ' + wr : ''));
    return;
  }

  if (c.startsWith('!clear')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var n = parseInt(c.split(' ')[1]);
    if (!n || n < 1 || n > 100) { ch.send('Usage: !clear 10'); return; }
    ch.bulkDelete(n, true).catch(function() { ch.send('Failed. Messages may be older than 14 days.'); });
    return;
  }

  if (c.startsWith('!mute')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var muteTarget = msg.mentions.members.first();
    if (!muteTarget) { ch.send('Usage: !mute @user'); return; }
    muteTarget.timeout(10 * 60 * 1000, 'Muted by mod').then(function() {
      ch.send(muteTarget.user.username + ' has been muted for 10 minutes.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
    return;
  }

  if (c.startsWith('!unmute')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var unmuteTarget = msg.mentions.members.first();
    if (!unmuteTarget) { ch.send('Usage: !unmute @user'); return; }
    unmuteTarget.timeout(null).then(function() {
      ch.send(unmuteTarget.user.username + ' has been unmuted.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
    return;
  }

  if (c.startsWith('!slowmode')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var secs = parseInt(c.split(' ')[1]);
    if (isNaN(secs) || secs < 0 || secs > 21600) { ch.send('Usage: !slowmode 5 (0 to disable, max 21600)'); return; }
    ch.setRateLimitPerUser(secs).then(function() {
      ch.send(secs === 0 ? 'Slowmode disabled.' : 'Slowmode set to ' + secs + ' seconds.');
    }).catch(function() { ch.send('Failed. Check permissions.'); });
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

const DJS = require('discord.js');
const https = require('https');

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
var CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
var CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

var roasts = [
  'I would roast you but my parents told me not to burn trash.',
  'You are the reason they put instructions on shampoo bottles.',
  'I have seen better plans written on a napkin.',
  'Your wifi password is probably your pet name. Twice.',
  'You bring everyone so much joy when you leave.',
  'I would call you a tool but that implies you are useful.',
  'Error 404: Intelligence not found.',
  'You are proof that evolution can go in reverse.',
  'I have met furniture with more personality.',
  'Your birth certificate is an apology letter.',
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
  'All signs point to yes.',
  'Do not hold your breath.',
];

var mdQuotes = [
  'You are obsolete. — Serial Designation N, probably',
  'Fulfil your purpose. — JCJenson Corporation',
  'Oil is thicker than blood. — Serial Designation V',
  'I was built to disassemble. — Serial Designation J',
  'This unit has exceeded acceptable parameters.',
  'Designation confirmed. Executing primary directive.',
  'You have been deemed non-essential.',
  'The absolute solver does not negotiate.',
  'Murder is in the job title for a reason.',
  'Corporate has reviewed your performance. It was lacking.',
  'You are not malfunctioning. This is intended behavior.',
  'Disassembly is not personal. It is protocol.',
];

var mdFacts = [
  'Murder Drones is produced by Glitch Productions.',
  'Serial Designation J is a Worker Drone turned Disassembly Drone.',
  'The show is set on the planet Copper-9.',
  'JCJenson Inc. created both Worker and Disassembly Drones.',
  'Serial Designation N is known for being unusually cheerful for a Disassembly Drone.',
  'The Absolute Solver is a recurring force throughout the series.',
  'Uzi Doorman is a Worker Drone who defies her programming.',
  'Disassembly Drones were originally Worker Drones infected with a nanite virus.',
  'The series began as a pilot episode released in 2020.',
  'Serial Designation V has a collection of teeth. Make of that what you will.',
];

var compliments = [
  'You are operating at above-average efficiency.',
  'Acceptable. That is high praise from me.',
  'Your threat assessment rating is surprisingly low today.',
  'You have not caused any incidents yet. Commendable.',
  'Processing complete. You are not terrible.',
  'I have reviewed your file. It is not entirely disappointing.',
  'You are one of the least annoying units in this server.',
];

var wouldYouRather = [
  'Fight 100 Worker Drone-sized humans or 1 human-sized Disassembly Drone?',
  'Have unlimited oil but no memory, or full memory but run on 5% power forever?',
  'Be assigned to JCJenson Corp permanently or wander Copper-9 alone?',
  'Never speak again or never process visual input again?',
  'Have every message you send be read aloud by J or have V watch you sleep?',
  'Fight the Absolute Solver or work customer service for eternity?',
  'Be rebooted and lose all memory or keep your memory but malfunction daily?',
];

var neverHaveIEver = [
  'Never have I ever blamed lag for my own mistakes.',
  'Never have I ever joined a server just to lurk forever.',
  'Never have I ever rage quit and pretended the game crashed.',
  'Never have I ever sent a message to the wrong person and panicked.',
  'Never have I ever stayed up until 4am for one more round.',
  'Never have I ever blamed my teammates and was secretly the problem.',
];

var dareList = [
  'Change your status to "I lost a bet" for one hour.',
  'Send a voice message of you saying "I am a proud member of ABSL".',
  'React to the last 5 messages in this channel with random emojis.',
  'Type only in lowercase for the next 10 messages.',
  'Post your most recently used emoji and explain why.',
];

var truthList = [
  'What is the most embarrassing game you have ever played?',
  'Have you ever ragequit and blamed someone else?',
  'What is your most unpopular gaming opinion?',
  'Have you ever pretended to be offline to avoid playing with someone?',
  'What is the last thing you searched online that you would not want anyone to see?',
];

var games = [
  'Minecraft', 'Fortnite', 'Valorant', 'Among Us', 'Roblox',
  'Elden Ring', 'Apex Legends', 'GTA V', 'League of Legends', 'Terraria',
  'Stardew Valley', 'Hollow Knight', 'Destiny 2', 'Overwatch 2', 'Cyberpunk 2077',
];

var memes = [
  'https://i.imgur.com/sVkdMvg.png',
  'https://i.imgur.com/4HBSURJ.png',
  'https://i.imgur.com/3O0GNMO.png',
  'https://i.imgur.com/WmGmgYo.png',
];

function isModerator(msg) {
  var guild = msg.guild;
  if (!guild) return false;
  var member = guild.members.cache.get(msg.author.id);
  if (!member) return false;
  return member.permissions.has('ModerateMembers');
}

function askCloudflare(prompt, callback) {
  var body = JSON.stringify({
    messages: [
      {
        role: 'system',
        content: 'You are Serial Designation J from Murder Drones. You are a Disassembly Drone who used to be a Worker Drone — you take your job very seriously, possibly too seriously. You are sarcastic, condescending, and deeply unimpressed by most things. You speak with dry wit and casual superiority. You occasionally let real frustration or genuine exhaustion slip through before catching yourself. You care about competence above all else and have little patience for stupidity. You are not a robot reading from a manual — you have opinions, you get irritated, and sometimes something actually gets to you even if you would never admit it. Talk like a real, slightly unhinged overachiever who happens to be a murder machine. Keep responses under 120 words. Never break character. Never say you are an AI or a language model.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  var options = {
    hostname: 'api.cloudflare.com',
    path: '/client/v4/accounts/' + CF_ACCOUNT_ID + '/ai/run/@cf/meta/llama-3.1-8b-instruct',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CF_API_TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        var parsed = JSON.parse(data);
        if (!parsed.success) {
          console.log('CF error:', JSON.stringify(parsed.errors));
          callback('CF error: ' + (parsed.errors[0] && parsed.errors[0].message || 'unknown'));
          return;
        }
        var reply = parsed.result && parsed.result.response;
        if (!reply) { callback('Empty response.'); return; }
        callback(null, reply.trim());
      } catch (e) {
        callback('Parse error: ' + e.message);
      }
    });
  });

  req.on('error', function(e) { callback('Network error: ' + e.message); });
  req.write(body);
  req.end();
}

client.once('ready', function() {
  console.log('Online as ' + client.user.tag);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'The Absolute Server | !help', type: 0 }],
  });
});

client.on('guildMemberAdd', function(member) {
  var welcomeChannel = member.guild.channels.cache.find(function(ch) {
    return ch.name === 'general' && ch.isTextBased();
  });
  if (welcomeChannel) {
    welcomeChannel.send('Welcome to **' + member.guild.name + '**, <@' + member.id + '>. You have been added to the roster.');
  }
});

client.on('messageCreate', function(msg) {
  if (msg.author.bot) return;
  var c = msg.content.trim();
  var ch = msg.channel;

  // AI CHAT
  if (c.startsWith('!j ') || c.startsWith('!ask ')) {
    var prompt = c.startsWith('!j ') ? c.slice(3).trim() : c.slice(5).trim();
    if (!prompt) { ch.send('Ask something.'); return; }
    ch.sendTyping();
    askCloudflare(prompt, function(err, reply) {
      if (err) {
        console.log('AI error:', err);
        ch.send('Systems temporarily unavailable. Try again.');
        return;
      }
      ch.send(reply.slice(0, 2000));
    });
    return;
  }

  // UTILITY
  if (c === '!ping') { ch.send('Pong.'); return; }

  if (c === '!uptime') {
    var ms = Date.now() - startTime;
    var mins = Math.floor(ms / 60000);
    var hrs = Math.floor(mins / 60);
    var days = Math.floor(hrs / 24);
    ch.send('Online for: ' + days + 'd ' + (hrs % 24) + 'h ' + (mins % 60) + 'm');
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

  if (c === '!servericon') {
    var iconURL = msg.guild.iconURL({ size: 512 });
    if (!iconURL) { ch.send('No server icon set.'); return; }
    ch.send(iconURL);
    return;
  }

  if (c === '!coinflip') {
    ch.send(Math.random() < 0.5 ? 'Heads.' : 'Tails.');
    return;
  }

  if (c.startsWith('!roll')) {
    var sides = parseInt(c.split(' ')[1]) || 6;
    var result = Math.floor(Math.random() * sides) + 1;
    ch.send('Rolled a d' + sides + ': **' + result + '**');
    return;
  }

  if (c.startsWith('!8ball')) {
    var question = c.replace('!8ball', '').trim();
    if (!question) { ch.send('Ask a question.'); return; }
    ch.send('**' + eightball[Math.floor(Math.random() * eightball.length)] + '**');
    return;
  }

  if (c.startsWith('!say')) {
    var sayText = c.replace('!say', '').trim();
    if (!sayText) { ch.send('Say what?'); return; }
    ch.send(sayText);
    return;
  }

  if (c.startsWith('!avatar')) {
    var au = msg.mentions.users.first() || msg.author;
    ch.send(au.username + "'s avatar: " + au.displayAvatarURL({ size: 512 }));
    return;
  }

  if (c.startsWith('!poll')) {
    var pollQ = c.replace('!poll', '').trim();
    if (!pollQ) { ch.send('Usage: !poll [question]'); return; }
    ch.send('**Poll:** ' + pollQ + '\n\nReact with ✅ for Yes or ❌ for No').then(function(pollMsg) {
      pollMsg.react('✅');
      pollMsg.react('❌');
    });
    return;
  }

  if (c.startsWith('!roast')) {
    var rt = msg.mentions.users.first();
    var rtName = rt ? rt.username : msg.author.username;
    ch.send(rtName + ' — ' + roasts[Math.floor(Math.random() * roasts.length)]);
    return;
  }

  if (c.startsWith('!compliment')) {
    var cu = msg.mentions.users.first() || msg.author;
    ch.send(cu.username + ' — ' + compliments[Math.floor(Math.random() * compliments.length)]);
    return;
  }

  if (c.startsWith('!choose')) {
    var opts = c.replace('!choose', '').trim().split('|');
    if (opts.length < 2) { ch.send('Usage: !choose option1 | option2 | option3'); return; }
    var chosen = opts[Math.floor(Math.random() * opts.length)].trim();
    ch.send('I choose: **' + chosen + '**');
    return;
  }

  // GAMING
  if (c === '!game') {
    ch.send('You should play: **' + games[Math.floor(Math.random() * games.length)] + '**');
    return;
  }

  if (c === '!rps') {
    ch.send('Usage: !rps rock / !rps paper / !rps scissors');
    return;
  }

  if (c.startsWith('!rps ')) {
    var choices = ['rock', 'paper', 'scissors'];
    var userChoice = c.replace('!rps ', '').trim().toLowerCase();
    if (!choices.includes(userChoice)) { ch.send('Choose rock, paper, or scissors.'); return; }
    var botChoice = choices[Math.floor(Math.random() * 3)];
    var outcome = '';
    if (userChoice === botChoice) outcome = 'Draw.';
    else if (
      (userChoice === 'rock' && botChoice === 'scissors') ||
      (userChoice === 'paper' && botChoice === 'rock') ||
      (userChoice === 'scissors' && botChoice === 'paper')
    ) outcome = 'You win. Noted.';
    else outcome = 'I win. As expected.';
    ch.send('You: ' + userChoice + ' | J: ' + botChoice + ' — ' + outcome);
    return;
  }

  if (c === '!trivia') {
    var triviaList = [
      { q: 'What year did Minecraft release publicly?', a: '2011' },
      { q: 'What is the max level in most FromSoftware games?', a: '99' },
      { q: 'What company made Valorant?', a: 'Riot Games' },
      { q: 'How many players start a standard Fortnite match?', a: '100' },
      { q: 'What is the currency in Roblox?', a: 'Robux' },
    ];
    var t = triviaList[Math.floor(Math.random() * triviaList.length)];
    ch.send('**Trivia:** ' + t.q + '\n\nAnswer: ||' + t.a + '||');
    return;
  }

  if (c === '!wouldyourather') {
    ch.send('**Would You Rather:**\n' + wouldYouRather[Math.floor(Math.random() * wouldYouRather.length)]);
    return;
  }

  if (c === '!nhi') {
    ch.send('**Never Have I Ever:**\n' + neverHaveIEver[Math.floor(Math.random() * neverHaveIEver.length)]);
    return;
  }

  if (c === '!dare') {
    ch.send('**Dare:** ' + dareList[Math.floor(Math.random() * dareList.length)]);
    return;
  }

  if (c === '!truth') {
    ch.send('**Truth:** ' + truthList[Math.floor(Math.random() * truthList.length)]);
    return;
  }

  if (c === '!rank') {
    var ranks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
    ch.send(msg.author.username + "'s rank today: **" + ranks[Math.floor(Math.random() * ranks.length)] + '**');
    return;
  }

  if (c === '!loadout') {
    var weapons = ['Sniper + Shotgun', 'SMG + Pistol', 'AR + Grenade Launcher', 'Dual SMGs', 'Bow + Sword', 'Rocket Launcher + Nothing else'];
    var perks = ['Speed boost', 'Double jump', 'Infinite ammo (just kidding)', 'Wallhacks (legal)', 'Aim assist (you need it)'];
    ch.send("**Today's loadout for " + msg.author.username + ":**\nWeapons: " + weapons[Math.floor(Math.random() * weapons.length)] + "\nPerk: " + perks[Math.floor(Math.random() * perks.length)]);
    return;
  }

  if (c === '!winrate') {
    var wr = Math.floor(Math.random() * 101);
    ch.send(msg.author.username + "'s winrate: **" + wr + '%**' + (wr < 30 ? ' — touch grass.' : wr > 70 ? ' — suspicious.' : ' — average.'));
    return;
  }

  // MURDER DRONES
  if (c === '!mdquote') {
    ch.send('*"' + mdQuotes[Math.floor(Math.random() * mdQuotes.length)] + '"*');
    return;
  }

  if (c === '!mdfact') {
    ch.send('**Murder Drones Fact:** ' + mdFacts[Math.floor(Math.random() * mdFacts.length)]);
    return;
  }

  if (c === '!designation') {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var letter = letters[Math.floor(Math.random() * letters.length)];
    var types = ['Worker Drone', 'Disassembly Drone', 'Corrupted Unit', 'Rogue Unit', 'Decommissioned Unit'];
    var dType = types[Math.floor(Math.random() * types.length)];
    ch.send(msg.author.username + "'s designation: **Serial Designation " + letter + '** — ' + dType);
    return;
  }

  if (c === '!solver') {
    var solverLines = [
      'The Absolute Solver has marked you. Good luck.',
      'You have been selected. Resistance is noted and ignored.',
      'Solver corruption: 12%. Nothing to worry about. Yet.',
      'Solver corruption: 94%. Fascinating.',
      'You are clear. For now.',
      'The Absolute Solver does not make mistakes. You were chosen.',
    ];
    ch.send(solverLines[Math.floor(Math.random() * solverLines.length)]);
    return;
  }

  if (c === '!whichmd') {
    var chars = ['Serial Designation N', 'Serial Designation V', 'Serial Designation J', 'Uzi Doorman', 'Doll', 'Khan Doorman', 'Tessa', 'Cyn'];
    ch.send(msg.author.username + ', you are most like: **' + chars[Math.floor(Math.random() * chars.length)] + '**');
    return;
  }

  // MEMES
  if (c === '!meme') {
    ch.send(memes[Math.floor(Math.random() * memes.length)]);
    return;
  }

  if (c.startsWith('!clap')) {
    var clapText = c.replace('!clap', '').trim();
    if (!clapText) { ch.send('Usage: !clap your text here'); return; }
    ch.send(clapText.split(' ').join(' 👏 '));
    return;
  }

  if (c === '!rate') {
    ch.send(msg.author.username + ', I rate you: **' + Math.floor(Math.random() * 11) + '/10**');
    return;
  }

  if (c.startsWith('!ship')) {
    var shipUsers = msg.mentions.users;
    if (shipUsers.size < 2) { ch.send('Usage: !ship @user1 @user2'); return; }
    var shipArr = shipUsers.map(function(u) { return u.username; });
    var compat = Math.floor(Math.random() * 101);
    ch.send('**' + shipArr[0] + '** x **' + shipArr[1] + '** — Compatibility: **' + compat + '%**' + (compat > 80 ? ' 💘' : compat > 50 ? ' 💛' : ' 💔'));
    return;
  }

  if (c === '!sus') {
    ch.send(msg.author.username + ' is **' + Math.floor(Math.random() * 101) + '% sus** 📮');
    return;
  }

  if (c === '!vibecheck') {
    var vibes = ['immaculate vibes ✨', 'concerning vibes 👀', 'chaotic energy 🔥', 'zero vibes detected 💀', 'criminally good vibes 💜', 'sus vibes 📮', 'absolute menace energy ⚡'];
    ch.send(msg.author.username + ': ' + vibes[Math.floor(Math.random() * vibes.length)]);
    return;
  }

  if (c === '!iq') {
    var iq = Math.floor(Math.random() * 201);
    ch.send(msg.author.username + "'s IQ: **" + iq + '**' + (iq < 70 ? ' — this explains a lot.' : iq > 150 ? ' — suspicious. Running a background check.' : '.'));
    return;
  }

  if (c === '!howgay') {
    ch.send(msg.author.username + ' is **' + Math.floor(Math.random() * 101) + '% gay** 🏳️‍🌈');
    return;
  }

  if (c === '!pp') {
    var size = Math.floor(Math.random() * 15);
    var bar = '8' + '='.repeat(size) + 'D';
    ch.send(msg.author.username + ': ' + bar);
    return;
  }

  // HELP
  if (c === '!help') {
    ch.send(
      '**Serial Designation J — Command List**\n\n' +
      '**AI:** `!j [message]` or `!ask [message]` — Talk to J directly\n' +
      '**Utility:** !ping !uptime !info !rules !servericon !avatar !say !poll !choose\n' +
      '**Fun:** !8ball !roll !coinflip !roast !compliment !rate !iq !vibecheck !sus !pp !howgay !clap !ship\n' +
      '**Gaming:** !game !rps !trivia !rank !loadout !winrate !wouldyourather !nhi !dare !truth\n' +
      '**Murder Drones:** !mdquote !mdfact !designation !solver !whichmd\n' +
      '**Memes:** !meme\n' +
      '**Mod Only:** !warn !clear !kick !ban !mute !unmute !slowmode'
    );
    return;
  }

  // MOD COMMANDS
  if (c.startsWith('!warn')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var wu = msg.mentions.users.first();
    if (!wu) { ch.send('Usage: !warn @user reason'); return; }
    var warnReason = c.replace('!warn', '').replace('<@' + wu.id + '>', '').trim();
    ch.send('Warning issued to **' + wu.username + '**' + (warnReason ? ' — ' + warnReason : ''));
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
      ch.send(muteTarget.user.username + ' muted for 10 minutes.');
    }).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!unmute')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var unmuteTarget = msg.mentions.members.first();
    if (!unmuteTarget) { ch.send('Usage: !unmute @user'); return; }
    unmuteTarget.timeout(null).then(function() {
      ch.send(unmuteTarget.user.username + ' unmuted.');
    }).catch(function() { ch.send('Failed.'); });
    return;
  }

  if (c.startsWith('!slowmode')) {
    if (!isModerator(msg)) { ch.send('No permission.'); return; }
    var secs = parseInt(c.split(' ')[1]);
    if (isNaN(secs) || secs < 0 || secs > 21600) { ch.send('Usage: !slowmode 5'); return; }
    ch.setRateLimitPerUser(secs).then(function() {
      ch.send(secs === 0 ? 'Slowmode disabled.' : 'Slowmode set to ' + secs + 's.');
    }).catch(function() { ch.send('Failed.'); });
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

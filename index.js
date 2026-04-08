const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

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

  if (content === '!ping') {
    channel.send('Pong. Still here.');
    return;
  }

  if (content === '!help') {
    channel.send(
      '**Serial Designation J — Available Commands**\n' +
      '`!ping` — Check if I am online\n' +
      '`!help` — Show this list\n' +
      '`!info` — Server info\n' +
      '`!rules` — Post server rules reminder\n' +
      '`!warn @user reason` — Warn a user (mod only)\n' +
      '`!clear [number]` — Delete last N messages (mod only, max 100)\n' +
      '`!kick @user reason` — Kick a user (mod only)\n' +
      '`!ban @user reason` — Ban a user (mod only)\n'
    );
    return;
  }

  if (content === '!info') {
    var guild = message.guild;
    if (!guild) {
      channel.send('This command only works in a server.');
      return;
    }
    channel.send(
      '**' + guild.name + '**\n' +
      'Members: ' + guild.memberCount + '\n' +
      'Created: ' + guild.createdAt.toDateString() + '\n' +
      'Owner ID: ' + guild.ownerId
    );
    return;
  }

  if (content === '!rules') {
    channel.send(
      '**Server Rules Reminder**\n' +
      '1. Be respectful.\n' +
      '2. No spam.\n' +
      '3. Keep content appropriate to the channel.\n' +
      '4. Follow Discord Terms of Service.\n' +
      '\nViolations will be handled by moderation.'
    );
    return;
  }

  var isMod = message.member && message.member.permissions.has('ModerateMembers');

  if (content.startsWith('!warn')) {
    if (!isMod) { channel.send('You do not have permission to use this command.'); return; }
    var warnTarget = message.mentions.users.first();
    if (!warnTarget) { channel.send('Please mention a user to warn. Usage: !warn @user reason'); return; }
    var warnReason = content.replace('!warn', '').replace('<@' + warnTarget.id + '>', '').replace('<@!' + warnTarget.id + '>', '').trim();
    channel.send('Warning issued to ' + warnTarget.username + (warnReason ? ' — Reason: ' + warnReason : ''));
    return;
  }

  if (content.startsWith('!clear')) {
    if (!isMod) { channel.send('You do not have permission to use this command.'); return; }
    var args = content.split(' ');
    var amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1 || amount > 100) { channel.send('Please specify a number between 1 and 100. Usage: !clear 10'); return; }
    channel.bulkDelete(amount, true).then(function() {
      channel.send('Deleted ' + amount + ' messages.').then(function(msg) {
        setTimeout(function() { msg.delete(); }, 3000);
      });
    }).catch(function() { channel.send('Failed to delete messages. They may be older than 14 days.'); });
    return;
  }

  if (content.startsWith('!kick')) {
    if (!isMod) { channel.send('You do not have permission to use this command.'); return; }
    var kickTarget = message.mentions.members && message.mentions.members.first();
    if (!kickTarget) { channel.send('Please mention a user to kick. Usage: !kick @user reason'); return; }
    var kickReason = content.replace('!kick', '').replace('<@' + kickTarget.id + '>', '').replace('<@!' + kickTarget.id + '>', '').trim();
    kickTarget.kick(kickReason || 'No reason provided').then(function() {
      channel.send(kickTarget.user.username + ' has been kicked.' + (kickReason ? ' Reason: ' + kickReason : ''));
    }).catch(function() { channel.send('Failed to kick user. Check my permissions.'); });
    return;
  }

  if (content.startsWith('!ban')) {
    if (!isMod) { channel.send('You do not have permission to use this command.'); return; }
    var banTarget = message.mentions.members && message.mentions.members.first();
    if (!banTarget) { channel.send('Please mention a user to ban. Usage: !ban @user reason'); return; }
    var banReason = content.replace('!ban', '').replace('<@' + banTarget.id + '>', '').replace('<@!' + banTarget.id + '>', '').trim();
    banTarget.ban({ reason: banReason || 'No reason provided' }).then(function() {
      channel.send(banTarget.user.username + ' has been banned.' + (banReason ? ' Reason: ' + banReason : ''));
    }).catch(function() { channel.send('Failed to ban user. Check my permissions.'); });
    return;
  }
});

client.login(BOT_TOKEN);

// ═══════════════════════════════════════════════════════════════════
//  Serial Designation J — Discord Bot
//  Built for The Absolute Server
//  Remade from scratch — clean, sharp, no excuses.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const https = require('https');

// ── ENV ───────────────────────────────────────────────────────────
const DISCORD_TOKEN  = process.env.DISCORD_TOKEN  || process.env.BOT_TOKEN || '';
const CF_ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN  || '';
const SUPABASE_URL   = process.env.SUPABASE_URL   || '';
const SUPABASE_KEY   = process.env.SUPABASE_KEY   || '';

// ── CONFIG ────────────────────────────────────────────────────────
const PREFIX            = '>';
const OWNER_ID          = '1326338080696832010';
const AUTO_REPLY_CHANCE = 0.70;

// ── STATE ─────────────────────────────────────────────────────────
let shutUpUntil     = 0;                      // epoch ms — J is muted until this
let authorizedUsers = new Set([OWNER_ID]);     // users allowed to run admin commands
const START_TIME    = Date.now();

// ── CLIENT ────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isMuted() {
  return Date.now() < shutUpUntil;
}

function isAuthorized(userId) {
  return authorizedUsers.has(userId);
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || 'null') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════
//  SUPABASE — USER MEMORY
// ════════════════════════════════════════════════════════════════════

function blankMemory(userId) {
  return {
    user_id:           userId,
    username:          '',
    interaction_count: 0,
    attitude:          'neutral',
    notes:             '',
    last_seen:         new Date().toISOString(),
  };
}

async function getMemory(userId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return blankMemory(userId);
  try {
    const url  = new URL(SUPABASE_URL + `/rest/v1/user_memory?user_id=eq.${userId}`);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      },
    };
    const { body } = await httpsRequest(opts, null);
    return (Array.isArray(body) && body[0]) ? body[0] : blankMemory(userId);
  } catch (e) {
    console.warn('[SUPA] getMemory error:', e.message);
    return blankMemory(userId);
  }
}

async function saveMemory(mem) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  mem.last_seen = new Date().toISOString();
  try {
    const bodyStr = JSON.stringify(mem);
    const url     = new URL(SUPABASE_URL + '/rest/v1/user_memory?on_conflict=user_id');
    const opts    = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers: {
        'apikey':          SUPABASE_KEY,
        'Authorization':   'Bearer ' + SUPABASE_KEY,
        'Content-Type':    'application/json',
        'Prefer':          'return=minimal,resolution=merge-duplicates',
        'Content-Length':  Buffer.byteLength(bodyStr),
      },
    };
    await httpsRequest(opts, bodyStr);
  } catch (e) {
    console.warn('[SUPA] saveMemory error:', e.message);
  }
}

function refreshMemory(mem, username, message) {
  mem.username          = username;
  mem.interaction_count = (mem.interaction_count || 0) + 1;
  mem.last_seen         = new Date().toISOString();

  // detect name introduction
  const nameMatch = message.match(/(?:my name is|i(?:'|'| a)?m|call me)\s+([A-Za-z]+)/i);
  if (nameMatch) {
    const tag = `name:${nameMatch[1]}`;
    if (!mem.notes.includes(tag)) {
      mem.notes = (tag + ' ' + mem.notes).trim().slice(0, 800);
    }
  }

  // detect annoying patterns
  const annoying = ['lol', 'lmao', 'bruh', 'bro', 'haha', 'xd', 'ugh', 'omg'];
  const hits      = annoying.filter(w => message.toLowerCase().includes(w)).length;
  if (hits >= 2 && !mem.notes.includes('trait:annoying')) {
    mem.notes = (mem.notes + ' trait:annoying').trim().slice(0, 800);
  }

  // attitude progression
  const c = mem.interaction_count;
  if      (c >= 20) mem.attitude = 'grudging_respect';
  else if (c >= 10) mem.attitude = 'mildly_tolerant';
  else if (c >= 5)  mem.attitude = 'unimpressed';
  else              mem.attitude = 'neutral';

  return mem;
}

function buildContextFromMemory(mem) {
  const lines = [];

  if (mem.username) lines.push(`Discord username: ${mem.username}`);

  (mem.notes || '').trim().split(/\s+/).forEach(part => {
    if (part.startsWith('name:'))  lines.push(`User's preferred name: ${part.slice(5)}`);
    if (part === 'trait:annoying') lines.push('This user is annoying. Be less patient.');
  });

  lines.push(`You've spoken with this user ${mem.interaction_count || 0} time(s).`);

  const attitudes = {
    grudging_respect: 'You have grudging respect for them. You\'d never admit it.',
    mildly_tolerant:  'They\'re mildly tolerable. That\'s above average for you.',
    unimpressed:      'You are unimpressed so far.',
    neutral:          'New user. Standard professional indifference.',
  };
  lines.push(attitudes[mem.attitude] || attitudes.neutral);

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
//  CLOUDFLARE AI — J PERSONA
// ════════════════════════════════════════════════════════════════════

const J_SYSTEM = [
  'You are J — Serial Designation J from Murder Drones.',
  'You are a Worker Drone who clawed your way up to Disassembly Drone. You take that seriously.',
  'Speak like a real person. Casual contractions. Short punchy sentences. Dry asides.',
  'You are sharp, sarcastic, and effortlessly condescending — not performatively, just naturally.',
  'Do NOT monologue. Do NOT over-explain. 2–3 sentences MAX per response.',
  'If something is stupid, say so directly. If something is impressive, you MIGHT acknowledge it — maybe.',
  'Responses should feel like a text from someone mildly irritated at being disturbed but answering anyway.',
  'NEVER say you are an AI. NEVER break character. NEVER use asterisks for actions.',
  'NEVER start a response with "J:" or your name.',
].join(' ');

async function askJ(prompt, mem) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error('Missing Cloudflare credentials');

  const bodyStr = JSON.stringify({
    messages: [
      { role: 'system', content: J_SYSTEM + '\n\n' + buildContextFromMemory(mem) },
      { role: 'user',   content: prompt },
    ],
  });

  const opts = {
    hostname: 'api.cloudflare.com',
    path:     `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    method:   'POST',
    headers: {
      'Authorization':  `Bearer ${CF_API_TOKEN}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  };

  const { body } = await httpsRequest(opts, bodyStr);
  if (!body?.success) {
    console.error('[CF] Error:', JSON.stringify(body?.errors));
    throw new Error('Cloudflare API returned failure');
  }

  return (body.result?.response || '').trim() || 'No response.';
}

// ════════════════════════════════════════════════════════════════════
//  STATIC DATA
// ════════════════════════════════════════════════════════════════════

const ROASTS = [
  'I would roast you but my parents told me not to burn trash.',
  'You are the reason they put instructions on shampoo bottles.',
  'I\'ve seen better plans written on a napkin.',
  'Your wifi password is probably your pet\'s name. Twice.',
  'You bring everyone so much joy when you leave.',
  'I would call you a tool but that implies you are useful.',
  'Error 404: Intelligence not found.',
  'You are proof that evolution can go in reverse.',
  'I\'ve met furniture with more personality.',
  'Your birth certificate is an apology letter.',
];

const EIGHTBALL = [
  'Absolutely.', 'Without a doubt.', 'Ask again later.',
  'Do not count on it.', 'My sources say no.', 'It is certain.',
  'Very doubtful.', 'Signs point to yes.', 'Outlook not so good.',
  'Cannot predict now.', 'All signs point to yes.', 'Do not hold your breath.',
];

const MD_QUOTES = [
  '"You are obsolete." — Serial Designation N, probably',
  '"Fulfil your purpose." — JCJenson Corporation',
  '"Oil is thicker than blood." — Serial Designation V',
  '"I was built to disassemble." — Serial Designation J',
  '"This unit has exceeded acceptable parameters."',
  '"Designation confirmed. Executing primary directive."',
  '"You have been deemed non-essential."',
  '"The Absolute Solver does not negotiate."',
  '"Murder is in the job title for a reason."',
  '"Corporate has reviewed your performance. It was lacking."',
  '"You are not malfunctioning. This is intended behavior."',
  '"Disassembly is not personal. It is protocol."',
];

const MD_FACTS = [
  'Murder Drones is produced by Glitch Productions.',
  'Serial Designation J is a Worker Drone turned Disassembly Drone.',
  'The show takes place on a post-apocalyptic planet called Copper-9.',
  'Disassembly Drones are sent by JCJenson to eliminate rogue Worker Drones.',
  'The Absolute Solver is a mysterious power that some drones can access.',
  'Serial Designation N is known for being unusually kind for a Disassembly Drone.',
  'Serial Designation V is cold, efficient, and largely unbothered by everything.',
  'Worker Drones were originally built to mine on Copper-9.',
  'Murder Drones premiered in 2022 as a pilot on YouTube.',
  'JCJenson (In Space!) is the megacorp responsible for the Drone program.',
  'Uzi Doorman is a Worker Drone with unusual access to the Absolute Solver.',
];

// ════════════════════════════════════════════════════════════════════
//  COMMAND HANDLERS
// ════════════════════════════════════════════════════════════════════

const commands = {

  // ── AI RESPONSE ───────────────────────────────────────────────
  async j(msg, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) return msg.reply('Say something. I can\'t respond to silence.');

    const mem = await getMemory(msg.author.id);
    const updated = refreshMemory(mem, msg.author.username, prompt);

    let reply;
    try {
      reply = await askJ(prompt, updated);
    } catch (e) {
      console.error('[CMD:j]', e.message);
      reply = 'Cloudflare is being uncooperative. Not my fault.';
    }

    await saveMemory(updated);
    return msg.reply(reply);
  },

  // ── MUTE ──────────────────────────────────────────────────────
  shutup(msg, args) {
    const minutes = parseInt(args[0], 10);
    if (!minutes || minutes < 1) return msg.reply('Usage: `>shutup <minutes>`');
    shutUpUntil = Date.now() + minutes * 60_000;
    return msg.reply(`Fine. I'll be quiet for ${minutes} minute${minutes === 1 ? '' : 's'}. Don't get used to it.`);
  },

  // ── UNMUTE ────────────────────────────────────────────────────
  unshut(msg) {
    shutUpUntil = 0;
    return msg.reply('Back. Try not to waste it.');
  },

  jspeak(msg) {
    shutUpUntil = 0;
    return msg.reply('Back. Try not to waste it.');
  },

  // ── MUTE STATUS ───────────────────────────────────────────────
  mutestatus(msg) {
    if (!isMuted()) return msg.reply('I am not muted. Obviously.');
    const remaining = Math.ceil((shutUpUntil - Date.now()) / 60_000);
    return msg.reply(`Muted for ${remaining} more minute${remaining === 1 ? '' : 's'}.`);
  },

  // ── ROAST ─────────────────────────────────────────────────────
  roast(msg) {
    return msg.reply(pick(ROASTS));
  },

  // ── 8BALL ─────────────────────────────────────────────────────
  '8ball'(msg, args) {
    const q = args.join(' ').trim();
    if (!q) return msg.reply('Ask a question. The ball needs something to work with.');
    return msg.reply(`🎱 ${pick(EIGHTBALL)}`);
  },

  // ── QUOTE ─────────────────────────────────────────────────────
  quote(msg) {
    return msg.reply(`📼 ${pick(MD_QUOTES)}`);
  },

  // ── FACT ──────────────────────────────────────────────────────
  fact(msg) {
    return msg.reply(`📡 ${pick(MD_FACTS)}`);
  },

  // ── WIKI LINK ─────────────────────────────────────────────────
  abslwi(msg) {
    return msg.reply('📖 **Absolute Solver Wiki v2:** https://absolute-solver-wiki-v2.com');
  },

  // ── BOT INFO ──────────────────────────────────────────────────
  jinfo(msg) {
    const upSec  = Math.floor((Date.now() - START_TIME) / 1000);
    const upMin  = Math.floor(upSec / 60);
    const upHour = Math.floor(upMin / 60);
    const upStr  = upHour > 0
      ? `${upHour}h ${upMin % 60}m`
      : `${upMin}m ${upSec % 60}s`;

    const muteStr = isMuted()
      ? `Muted — ${Math.ceil((shutUpUntil - Date.now()) / 60_000)} min remaining`
      : 'Active';

    return msg.reply(
      `**Serial Designation J** | Disassembly Unit\n` +
      `Uptime: \`${upStr}\`  |  Status: \`${muteStr}\`\n` +
      `AI: Cloudflare Workers AI (Llama 3.1 8B)\n` +
      `Memory: ${SUPABASE_URL ? 'Supabase (online)' : 'Disabled'}`
    );
  },

  // ── PING ──────────────────────────────────────────────────────
  ping(msg) {
    return msg.reply(`Pong. ${client.ws.ping}ms. You're welcome.`);
  },

  // ── HELP ──────────────────────────────────────────────────────
  help(msg) {
    return msg.reply(
      '**Commands** *(prefix: `>`)*\n' +
      '`>j <message>` — Talk to J\n' +
      '`>roast` — Receive a roast\n' +
      '`>8ball <question>` — Ask the magic 8-ball\n' +
      '`>quote` — Random Murder Drones quote\n' +
      '`>fact` — Random Murder Drones fact\n' +
      '`>abslwi` — Link to the Absolute Solver Wiki\n' +
      '`>ping` — Latency check\n' +
      '`>jinfo` — Bot status\n' +
      '`>mutestatus` — Check if J is muted\n' +
      '\n**Owner only:**\n' +
      '`>shutup <minutes>` — Mute J\n' +
      '`>unshut` / `>jspeak` — Unmute J\n' +
      '`>adduser <@user>` — Grant command access\n' +
      '`>removeuser <@user>` — Revoke command access'
    );
  },

  // ── USER MANAGEMENT (owner only) ─────────────────────────────
  adduser(msg, args) {
    if (msg.author.id !== OWNER_ID) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Mention a user.');
    authorizedUsers.add(target.id);
    return msg.reply(`${target.username} added to authorized list.`);
  },

  removeuser(msg, args) {
    if (msg.author.id !== OWNER_ID) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Mention a user.');
    if (target.id === OWNER_ID) return msg.reply('Cannot remove the owner.');
    authorizedUsers.delete(target.id);
    return msg.reply(`${target.username} removed.`);
  },

};

// ════════════════════════════════════════════════════════════════════
//  MESSAGE HANDLER
// ════════════════════════════════════════════════════════════════════

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;

  const isCommand = msg.content.startsWith(PREFIX);

  // ── COMMAND ROUTING ───────────────────────────────────────────
  if (isCommand) {
    const [rawCmd, ...args] = msg.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();

    const handler = commands[cmd];
    if (!handler) return; // unknown command — silently ignore

    try {
      await handler(msg, args);
    } catch (e) {
      console.error(`[CMD:${cmd}]`, e.message);
      msg.reply('Something broke. It wasn\'t me.').catch(() => {});
    }
    return;
  }

  // ── AUTO-REPLY (70% chance, mute-aware) ──────────────────────
  if (isMuted()) return;
  if (Math.random() > AUTO_REPLY_CHANCE) return;

  // Don't reply to very short messages (under 4 chars)
  if (msg.content.trim().length < 4) return;

  const mem = await getMemory(msg.author.id);
  const updated = refreshMemory(mem, msg.author.username, msg.content);

  let reply;
  try {
    reply = await askJ(msg.content, updated);
  } catch (e) {
    console.error('[AUTO]', e.message);
    return; // silent fail on auto-reply
  }

  await saveMemory(updated);
  msg.reply(reply).catch(e => console.error('[AUTO reply]', e.message));
});

// ════════════════════════════════════════════════════════════════════
//  STARTUP
// ════════════════════════════════════════════════════════════════════

client.once('ready', () => {
  console.log(`[ONLINE] ${client.user.tag} is operational.`);
  console.log(`[CONFIG] Cloudflare AI: ${CF_ACCOUNT_ID ? 'OK' : 'MISSING'}`);
  console.log(`[CONFIG] Supabase:      ${SUPABASE_URL  ? 'OK' : 'MISSING'}`);
});

client.on('error', e => console.error('[CLIENT ERROR]', e.message));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

if (!DISCORD_TOKEN) {
  console.error('[FATAL] DISCORD_TOKEN is not set. Exiting.');
  process.exit(1);
}

client.login(DISCORD_TOKEN);

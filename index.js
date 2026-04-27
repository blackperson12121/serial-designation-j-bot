// ═══════════════════════════════════════════════════════════════════
//  Serial Designation J — Discord Bot
//  Built for The Absolute Server
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const https = require('https');

// ── ENV ───────────────────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN  = process.env.CLOUDFLARE_API_TOKEN  || '';
const SUPABASE_URL  = process.env.SUPABASE_URL  || '';
const SUPABASE_KEY  = process.env.SUPABASE_KEY  || '';

// ── CONFIG ────────────────────────────────────────────────────────
const PREFIX      = '>';
const CHAT_PREFIX = '?';
const OWNER_ID    = '1326338080696832010';
const MAX_HISTORY = 20; // max messages kept in short-term chat memory

// ── STATE ─────────────────────────────────────────────────────────
let shutUpUntil     = 0;
let authorizedUsers = new Set([OWNER_ID]);
const START_TIME    = Date.now();

// Active chat sessions: Map<userId, { channelId, history: [{role, content}] }>
const activeSessions = new Map();

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

const pick         = arr => arr[Math.floor(Math.random() * arr.length)];
const isMuted      = ()  => Date.now() < shutUpUntil;
const isOwner      = id  => id === OWNER_ID;
const isAuthorized = id  => authorizedUsers.has(id);

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
        'apikey':         SUPABASE_KEY,
        'Authorization':  'Bearer ' + SUPABASE_KEY,
        'Content-Type':   'application/json',
        'Prefer':         'return=minimal,resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(bodyStr),
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

  const nameMatch = message.match(/(?:my name is|i(?:'|'| a)?m|call me)\s+([A-Za-z]+)/i);
  if (nameMatch) {
    const tag = `name:${nameMatch[1]}`;
    if (!(mem.notes || '').includes(tag)) {
      mem.notes = (tag + ' ' + (mem.notes || '')).trim().slice(0, 800);
    }
  }

  const annoying = ['lol', 'lmao', 'bruh', 'bro', 'haha', 'xd', 'ugh', 'omg'];
  const hits     = annoying.filter(w => message.toLowerCase().includes(w)).length;
  if (hits >= 2 && !(mem.notes || '').includes('trait:annoying')) {
    mem.notes = ((mem.notes || '') + ' trait:annoying').trim().slice(0, 800);
  }

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
    grudging_respect: "You have grudging respect for them. You'd never admit it.",
    mildly_tolerant:  "They're mildly tolerable. That's above average for you.",
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

// Standard single-turn AI call (used by >j)
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

// Multi-turn AI call (used by ?Jchat sessions) — passes full conversation history
async function askJWithHistory(history, mem) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error('Missing Cloudflare credentials');

  const messages = [
    { role: 'system', content: J_SYSTEM + '\n\n' + buildContextFromMemory(mem) },
    ...history,
  ];

  const bodyStr = JSON.stringify({ messages });

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
  "I would roast you but my parents told me not to burn trash.",
  "You are the reason they put instructions on shampoo bottles.",
  "I've seen better plans written on a napkin.",
  "Your wifi password is probably your pet's name. Twice.",
  "You bring everyone so much joy when you leave.",
  "I would call you a tool but that implies you are useful.",
  "Error 404: Intelligence not found.",
  "You are proof that evolution can go in reverse.",
  "I've met furniture with more personality.",
  "Your birth certificate is an apology letter.",
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
//  COMMANDS  (prefix: >)
//  ALL require authorization. Owner-only commands check isOwner().
// ════════════════════════════════════════════════════════════════════

const commands = {

  async j(msg, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) return msg.reply("Say something. I can't respond to silence.");

    const mem     = await getMemory(msg.author.id);
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

  shutup(msg, args) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const minutes = parseInt(args[0], 10);
    if (!minutes || minutes < 1) return msg.reply('Usage: `>shutup <minutes>`');
    shutUpUntil = Date.now() + minutes * 60_000;
    return msg.reply(`Fine. ${minutes} minute${minutes === 1 ? '' : 's'}. Don't get used to it.`);
  },

  unshut(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    shutUpUntil = 0;
    return msg.reply("Back. Try not to waste it.");
  },

  jspeak(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    shutUpUntil = 0;
    return msg.reply("Back. Try not to waste it.");
  },

  mutestatus(msg) {
    if (!isMuted()) return msg.reply('Not muted. Obviously.');
    const remaining = Math.ceil((shutUpUntil - Date.now()) / 60_000);
    return msg.reply(`Muted for ${remaining} more minute${remaining === 1 ? '' : 's'}.`);
  },

  adduser(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Mention a user. Usage: `>adduser @user`');
    authorizedUsers.add(target.id);
    return msg.reply(`✅ **${target.username}** is now authorized.`);
  },

  removeuser(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Mention a user. Usage: `>removeuser @user`');
    if (target.id === OWNER_ID) return msg.reply("Can't remove the owner.");
    authorizedUsers.delete(target.id);
    return msg.reply(`❌ **${target.username}** has been deauthorized.`);
  },

  listusers(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const ids = [...authorizedUsers].map(id => `\`${id}\``).join('\n') || 'None.';
    return msg.reply(`**Authorized users:**\n${ids}`);
  },

  roast(msg) {
    return msg.reply(pick(ROASTS));
  },

  '8ball'(msg, args) {
    const q = args.join(' ').trim();
    if (!q) return msg.reply('Ask a question.');
    return msg.reply(`🎱 ${pick(EIGHTBALL)}`);
  },

  quote(msg) {
    return msg.reply(`📼 ${pick(MD_QUOTES)}`);
  },

  fact(msg) {
    return msg.reply(`📡 ${pick(MD_FACTS)}`);
  },

  abslwi(msg) {
    return msg.reply('📖 **Absolute Solver Wiki v2:** https://absolute-solver-wiki-v2.com');
  },

  ping(msg) {
    return msg.reply(`Pong. ${client.ws.ping}ms.`);
  },

  jinfo(msg) {
    const upSec  = Math.floor((Date.now() - START_TIME) / 1000);
    const upMin  = Math.floor(upSec / 60);
    const upHour = Math.floor(upMin / 60);
    const upStr  = upHour > 0 ? `${upHour}h ${upMin % 60}m` : `${upMin}m ${upSec % 60}s`;
    const muteStr = isMuted()
      ? `Muted — ${Math.ceil((shutUpUntil - Date.now()) / 60_000)} min remaining`
      : 'Active';
    return msg.reply(
      `**Serial Designation J** | Disassembly Unit\n` +
      `Uptime: \`${upStr}\`  |  Status: \`${muteStr}\`\n` +
      `AI: Cloudflare Workers AI (Llama 3.1 8B)\n` +
      `Memory: ${SUPABASE_URL ? 'Supabase (online)' : 'Disabled'}\n` +
      `Authorized users: ${authorizedUsers.size}\n` +
      `Active chat sessions: ${activeSessions.size}`
    );
  },

  help(msg) {
    const ownerCmds = isOwner(msg.author.id)
      ? '\n**Owner only:**\n' +
        '`>shutup <minutes>` — Mute J\n' +
        '`>unshut` / `>jspeak` — Unmute J\n' +
        '`>adduser @user` — Authorize a user\n' +
        '`>removeuser @user` — Deauthorize a user\n' +
        '`>listusers` — Show all authorized users'
      : '';

    return msg.reply(
      '**Commands** *(prefix: `>`)*\n' +
      '`>j <message>` — Talk to J (single message)\n' +
      '`>roast` — Receive a roast\n' +
      '`>8ball <question>` — Ask the magic 8-ball\n' +
      '`>quote` — Random Murder Drones quote\n' +
      '`>fact` — Random Murder Drones fact\n' +
      '`>abslwi` — Absolute Solver Wiki link\n' +
      '`>ping` — Latency check\n' +
      '`>jinfo` — Bot status\n' +
      '`>mutestatus` — Check if J is muted\n' +
      '\n**Chat session** *(prefix: `?`)*\n' +
      '`?Jchat` — Start a private chat session with J\n' +
      '`?Jstop` — End your chat session' +
      ownerCmds
    );
  },
};

// ════════════════════════════════════════════════════════════════════
//  CHAT SESSION COMMANDS  (prefix: ?)
//  ?Jchat — start session
//  ?Jstop — end session
//  Any other message from a user in an active session → J responds
// ════════════════════════════════════════════════════════════════════

async function handleChatCommand(msg, cmd) {
  const userId = msg.author.id;

  // ── ?Jchat — START SESSION ────────────────────────────────────
  if (cmd === 'jchat') {
    if (!isAuthorized(userId)) {
      return msg.reply("You're not authorized to use this bot.").catch(() => {});
    }

    if (activeSessions.has(userId)) {
      return msg.reply("You already have an active session. Use `?Jstop` to end it first.");
    }

    activeSessions.set(userId, {
      channelId: msg.channel.id,
      history:   [],
    });

    return msg.reply(
      "Session started. Talk to me. I'll remember what you say until you use `?Jstop`.\n" +
      "*Just type normally — no prefix needed.*"
    );
  }

  // ── ?Jstop — END SESSION ──────────────────────────────────────
  if (cmd === 'jstop') {
    if (!activeSessions.has(userId)) {
      return msg.reply("You don't have an active session.");
    }

    const session = activeSessions.get(userId);
    const turns   = Math.floor(session.history.length / 2);
    activeSessions.delete(userId);

    return msg.reply(`Session ended. ${turns} exchange${turns === 1 ? '' : 's'} logged. Moving on.`);
  }
}

// ════════════════════════════════════════════════════════════════════
//  MESSAGE HANDLER
// ════════════════════════════════════════════════════════════════════

client.on('messageCreate', async msg => {
  try {
    if (msg.author.bot) return;

    const content = msg.content.trim();
    if (!content) return;

    const userId = msg.author.id;

    // ── ? PREFIX — CHAT SESSION COMMANDS ─────────────────────────
    if (content.startsWith(CHAT_PREFIX)) {
      const cmd = content.slice(CHAT_PREFIX.length).trim().toLowerCase();
      await handleChatCommand(msg, cmd);
      return;
    }

    // ── > PREFIX — STANDARD COMMANDS ─────────────────────────────
    if (content.startsWith(PREFIX)) {
      const [rawCmd, ...args] = content.slice(PREFIX.length).trim().split(/\s+/);
      const cmd     = rawCmd.toLowerCase();
      const handler = commands[cmd];

      if (!handler) return;

      if (!isAuthorized(userId)) {
        return msg.reply("You're not authorized to use this bot.").catch(() => {});
      }

      try {
        await handler(msg, args);
      } catch (e) {
        console.error(`[CMD:${cmd}]`, e.message);
        msg.reply("Something broke. It wasn't me.").catch(() => {});
      }
      return;
    }

    // ── ACTIVE CHAT SESSION — respond to plain messages ──────────
    const session = activeSessions.get(userId);
    if (!session) return; // not in a session — ignore

    // Only respond in the channel the session was started in
    if (msg.channel.id !== session.channelId) return;

    // Add user message to history
    session.history.push({ role: 'user', content });

    // Trim history to last MAX_HISTORY messages
    if (session.history.length > MAX_HISTORY) {
      session.history = session.history.slice(session.history.length - MAX_HISTORY);
    }

    const mem     = await getMemory(userId);
    const updated = refreshMemory(mem, msg.author.username, content);

    let reply;
    try {
      reply = await askJWithHistory(session.history, updated);
    } catch (e) {
      console.error('[CHAT SESSION]', e.message);
      reply = "Something went wrong on my end. Not ideal.";
    }

    // Add J's reply to history
    session.history.push({ role: 'assistant', content: reply });

    await saveMemory(updated);
    msg.reply(reply).catch(e => console.error('[CHAT reply]', e.message));

  } catch (e) {
    console.error('[MESSAGE HANDLER]', e.message);
  }
});

// ════════════════════════════════════════════════════════════════════
//  STARTUP
// ════════════════════════════════════════════════════════════════════

client.once('ready', () => {
  console.log(`[ONLINE] ${client.user.tag} is operational.`);
  console.log(`[CONFIG] Cloudflare: ${CF_ACCOUNT_ID ? 'OK' : 'MISSING'}`);
  console.log(`[CONFIG] Supabase:   ${SUPABASE_URL  ? 'OK' : 'MISSING'}`);
  console.log(`[CONFIG] Auth gate:  ENABLED — ${authorizedUsers.size} user(s) authorized`);
});

client.on('error', e => console.error('[CLIENT ERROR]', e.message));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

if (!DISCORD_TOKEN) {
  console.error('[FATAL] No Discord token found. Set DISCORD_TOKEN or BOT_TOKEN.');
  process.exit(1);
}

client.login(DISCORD_TOKEN);

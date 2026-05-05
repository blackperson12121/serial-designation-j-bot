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
const PREFIX   = '>';
const OWNER_ID = '1326338080696832010';

// ── VALIDATE ─────────────────────────────────────────────────────
console.log('[BOOT] Starting Serial Designation J...');
console.log('[BOOT] TOKEN:', DISCORD_TOKEN ? `found (${DISCORD_TOKEN.slice(0,12)}...)` : 'MISSING ❌');
console.log('[BOOT] CF_ACCOUNT_ID:', CF_ACCOUNT_ID ? 'SET ✅' : 'MISSING ❌');
console.log('[BOOT] CF_API_TOKEN:', CF_API_TOKEN ? 'SET ✅' : 'MISSING ❌');

if (!DISCORD_TOKEN) {
  console.error('[FATAL] No token. Exiting.');
  process.exit(1);
}

// ── STATE ─────────────────────────────────────────────────────────
let shutUpUntil = 0;
let authorizedUsers = new Set([OWNER_ID]);
const chatSessions = new Map();
const START_TIME = Date.now();

// ── CLIENT ────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ── HELPERS ───────────────────────────────────────────────────────
const pick    = arr => arr[Math.floor(Math.random() * arr.length)];
const isMuted = ()  => Date.now() < shutUpUntil;
const isOwner = id  => id === OWNER_ID;
const isAuth  = id  => authorizedUsers.has(id);

function httpsPost(hostname, path, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── CLOUDFLARE AI ─────────────────────────────────────────────────
const J_SYSTEM = `You are J — Serial Designation J from Murder Drones. \
You are a Disassembly Drone. Sharp, sarcastic, effortlessly condescending. \
Speak casually. Short punchy sentences. Contractions. 2-3 sentences MAX. \
Never monologue. Never use asterisks. Never say you're an AI. Never break character. \
If something is stupid, say so. If something is impressive, maybe acknowledge it — maybe.`;

async function askJ(messages) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error('CF credentials missing');
  const body = await httpsPost(
    'api.cloudflare.com',
    `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    JSON.stringify({ messages })
  );
  if (!body?.success) throw new Error(JSON.stringify(body?.errors));
  return (body.result?.response || '').trim() || 'No response.';
}

// ── SUPABASE MEMORY ───────────────────────────────────────────────
function blank(userId) {
  return { user_id: userId, username: '', interaction_count: 0, attitude: 'neutral', notes: '', last_seen: new Date().toISOString() };
}

async function getMemory(userId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return blank(userId);
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${userId}`);
    const res = await new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d || 'null'))); });
      req.on('error', reject); req.end();
    });
    return (Array.isArray(res) && res[0]) ? res[0] : blank(userId);
  } catch { return blank(userId); }
}

async function saveMemory(mem) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  mem.last_seen = new Date().toISOString();
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/user_memory?on_conflict=user_id`);
    await httpsPost(url.hostname, url.pathname + url.search, {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal,resolution=merge-duplicates',
    }, JSON.stringify(mem));
  } catch (e) { console.warn('[SUPA] save error:', e.message); }
}

function updateMemory(mem, username, text) {
  mem.username = username;
  mem.interaction_count = (mem.interaction_count || 0) + 1;
  const c = mem.interaction_count;
  mem.attitude = c >= 20 ? 'grudging_respect' : c >= 10 ? 'mildly_tolerant' : c >= 5 ? 'unimpressed' : 'neutral';
  return mem;
}

function memContext(mem) {
  const attitudes = {
    grudging_respect: "You have grudging respect for them. You'd never admit it.",
    mildly_tolerant: "They're mildly tolerable. Above average for you.",
    unimpressed: 'You are unimpressed so far.',
    neutral: 'New user. Standard professional indifference.',
  };
  return [
    mem.username ? `Discord username: ${mem.username}` : '',
    `You've spoken with this user ${mem.interaction_count || 0} time(s).`,
    attitudes[mem.attitude] || attitudes.neutral,
  ].filter(Boolean).join('\n');
}

// ── STATIC DATA ───────────────────────────────────────────────────
const ROASTS = [
  "I would roast you but my parents said not to burn trash.",
  "You're the reason instructions exist on shampoo bottles.",
  "Error 404: Intelligence not found.",
  "You bring everyone joy when you leave.",
  "I'd call you a tool but that implies usefulness.",
  "Your birth certificate is an apology letter.",
  "I've met furniture with more personality.",
  "You are proof evolution can go in reverse.",
];

const EIGHTBALL = [
  'Absolutely.', 'Without a doubt.', 'Ask again later.',
  'Do not count on it.', 'My sources say no.', 'It is certain.',
  'Very doubtful.', 'Signs point to yes.', 'Outlook not so good.',
  'Cannot predict now.',
];

const QUOTES = [
  '"You are obsolete." — Serial Designation N, probably',
  '"Fulfil your purpose." — JCJenson Corporation',
  '"I was built to disassemble." — Serial Designation J',
  '"The Absolute Solver does not negotiate."',
  '"Murder is in the job title for a reason."',
  '"Corporate has reviewed your performance. It was lacking."',
  '"Disassembly is not personal. It is protocol."',
];

const FACTS = [
  'Murder Drones is produced by Glitch Productions.',
  'Serial Designation J is a Worker Drone turned Disassembly Drone.',
  'The show takes place on a post-apocalyptic planet called Copper-9.',
  'Disassembly Drones are sent by JCJenson to eliminate rogue Worker Drones.',
  'The Absolute Solver is a mysterious power that some drones can access.',
  'N is known for being unusually kind for a Disassembly Drone.',
  'Worker Drones were originally built to mine on Copper-9.',
  'Uzi Doorman is a Worker Drone with unusual access to the Absolute Solver.',
];

// ── COMMAND HANDLERS ──────────────────────────────────────────────
const commands = {

  async ping(msg) {
    await msg.reply(`Pong. ${client.ws.ping}ms.`);
  },

  async j(msg, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) return msg.reply("Say something. I can't respond to silence.");
    const mem = await getMemory(msg.author.id);
    updateMemory(mem, msg.author.username, prompt);
    let reply;
    try {
      reply = await askJ([
        { role: 'system', content: J_SYSTEM + '\n\n' + memContext(mem) },
        { role: 'user', content: prompt },
      ]);
    } catch (e) {
      console.error('[CMD:j]', e.message);
      reply = "Cloudflare is being uncooperative. Not my fault.";
    }
    await saveMemory(mem);
    await msg.reply(reply);
  },

  async jchat(msg) {
    if (chatSessions.has(msg.author.id)) return msg.reply("Already active. Use `>jstop` to end it.");
    chatSessions.set(msg.author.id, { channelId: msg.channel.id, history: [] });
    await msg.reply("Session started. Just type. Use `>jstop` to end it.");
  },

  async jstop(msg) {
    if (!chatSessions.has(msg.author.id)) return msg.reply("No active session.");
    chatSessions.delete(msg.author.id);
    await msg.reply("Session ended.");
  },

  async shutup(msg, args) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const mins = parseInt(args[0], 10);
    if (!mins || mins < 1) return msg.reply('Usage: `>shutup <minutes>`');
    shutUpUntil = Date.now() + mins * 60_000;
    await msg.reply(`Fine. ${mins} minute${mins === 1 ? '' : 's'}.`);
  },

  async unshut(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    shutUpUntil = 0;
    await msg.reply("Back.");
  },

  async jspeak(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    shutUpUntil = 0;
    await msg.reply("Back.");
  },

  async mutestatus(msg) {
    if (!isMuted()) return msg.reply('Not muted.');
    const left = Math.ceil((shutUpUntil - Date.now()) / 60_000);
    await msg.reply(`Muted for ${left} more minute${left === 1 ? '' : 's'}.`);
  },

  async adduser(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Usage: `>adduser @user`');
    authorizedUsers.add(target.id);
    await msg.reply(`✅ ${target.username} authorized.`);
  },

  async removeuser(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('Usage: `>removeuser @user`');
    if (target.id === OWNER_ID) return msg.reply("Can't remove the owner.");
    authorizedUsers.delete(target.id);
    await msg.reply(`❌ ${target.username} deauthorized.`);
  },

  async listusers(msg) {
    if (!isOwner(msg.author.id)) return msg.reply('No.');
    const ids = [...authorizedUsers].map(id => `\`${id}\``).join('\n') || 'None.';
    await msg.reply(`**Authorized:**\n${ids}`);
  },

  async roast(msg) { await msg.reply(pick(ROASTS)); },

  async '8ball'(msg, args) {
    if (!args.length) return msg.reply('Ask a question.');
    await msg.reply(`🎱 ${pick(EIGHTBALL)}`);
  },

  async quote(msg) { await msg.reply(`📼 ${pick(QUOTES)}`); },
  async fact(msg)  { await msg.reply(`📡 ${pick(FACTS)}`); },

  async abslwi(msg) {
    await msg.reply('📖 **Absolute Solver Wiki v2:** https://absolute-solver-wiki-v2.com');
  },

  async jinfo(msg) {
    const upSec = Math.floor((Date.now() - START_TIME) / 1000);
    const h = Math.floor(upSec / 3600);
    const m = Math.floor((upSec % 3600) / 60);
    const s = upSec % 60;
    const upStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
    await msg.reply(
      `**Serial Designation J** | Disassembly Unit\n` +
      `Uptime: \`${upStr}\` | Status: \`${isMuted() ? 'Muted' : 'Active'}\`\n` +
      `Authorized: ${authorizedUsers.size} | Sessions: ${chatSessions.size}\n` +
      `AI: Cloudflare (Llama 3.1 8B) | Memory: ${SUPABASE_URL ? 'Supabase ✅' : 'Disabled'}`
    );
  },

  async help(msg) {
    let text =
      '**Commands** (prefix: `>`)\n' +
      '`>ping` — latency\n' +
      '`>j <msg>` — talk to J\n' +
      '`>jchat` — start chat session\n' +
      '`>jstop` — end chat session\n' +
      '`>roast` — get roasted\n' +
      '`>8ball <q>` — magic 8-ball\n' +
      '`>quote` — Murder Drones quote\n' +
      '`>fact` — Murder Drones fact\n' +
      '`>abslwi` — wiki link\n' +
      '`>jinfo` — bot status\n' +
      '`>mutestatus` — mute check';
    if (isOwner(msg.author.id)) {
      text += '\n\n**Owner**\n' +
        '`>shutup <mins>` `>unshut` `>jspeak`\n' +
        '`>adduser @u` `>removeuser @u` `>listusers`';
    }
    await msg.reply(text);
  },
};

// ── MESSAGE HANDLER ───────────────────────────────────────────────
client.on('messageCreate', async msg => {
  try {
    if (msg.author.bot) return;
    const content = msg.content?.trim();
    if (!content) return;

    const userId = msg.author.id;
    console.log(`[MSG] ${msg.author.username}(${userId}): ${content.slice(0, 60)}`);

    // ── PREFIX COMMANDS ───────────────────────────────────────────
    if (content.startsWith(PREFIX)) {
      const [rawCmd, ...args] = content.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = rawCmd?.toLowerCase();
      console.log(`[CMD] "${cmd}" — auth: ${isAuth(userId)}`);

      const handler = commands[cmd];
      if (!handler) { console.log(`[CMD] Unknown: "${cmd}"`); return; }
      if (!isAuth(userId)) { await msg.reply("Not authorized.").catch(() => {}); return; }

      try { await handler(msg, args); }
      catch (e) { console.error(`[CMD:${cmd}]`, e.message); await msg.reply("Something broke.").catch(() => {}); }
      return;
    }

    // ── ACTIVE CHAT SESSION ───────────────────────────────────────
    const session = chatSessions.get(userId);
    if (!session || msg.channel.id !== session.channelId) return;

    session.history.push({ role: 'user', content });
    if (session.history.length > 20) session.history = session.history.slice(-20);

    const mem = await getMemory(userId);
    updateMemory(mem, msg.author.username, content);

    let reply;
    try {
      reply = await askJ([
        { role: 'system', content: J_SYSTEM + '\n\n' + memContext(mem) },
        ...session.history,
      ]);
    } catch (e) {
      console.error('[CHAT]', e.message);
      reply = "Something went wrong. Not ideal.";
    }

    session.history.push({ role: 'assistant', content: reply });
    await saveMemory(mem);
    await msg.reply(reply);

  } catch (e) {
    console.error('[MSG HANDLER]', e.message);
  }
});

// ── READY ─────────────────────────────────────────────────────────
client.once('clientReady', c => {
  console.log(`[ONLINE] ${c.user.tag} is operational.`);
  console.log(`[CONFIG] Prefix: "${PREFIX}" | Owner: ${OWNER_ID}`);
  console.log(`[CONFIG] CF: ${CF_ACCOUNT_ID ? 'OK' : 'MISSING'} | Supabase: ${SUPABASE_URL ? 'OK' : 'disabled'}`);
});

client.on('warn',  w => console.warn('[WARN]', w));
client.on('error', e => console.error('[ERROR]', e.message));
process.on('unhandledRejection', r => console.error('[UNHANDLED]', r));
process.on('uncaughtException',  e => { console.error('[UNCAUGHT]', e.message); process.exit(1); });

client.login(DISCORD_TOKEN).catch(e => {
  console.error('[FATAL] Login failed:', e.message);
  process.exit(1);
});

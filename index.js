// ═══════════════════════════════════════════════════════════════════
//  Serial Designation J — Discord Bot  |  index.js
//  Built for The Absolute Server
// ═══════════════════════════════════════════════════════════════════

'use strict';

const DJS = require('discord.js');
const https = require('https');

// ── ENVIRONMENT ───────────────────────────────────────────────────
const CF_ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const DISCORD_TOKEN  = process.env.DISCORD_TOKEN;

// ── CONSTANTS ─────────────────────────────────────────────────────
const OWNER_ID          = '1326338080696832010'; // serialdesignationjxz
const AUTO_REPLY_CHANCE = 0.70;
const PREFIX            = '>';

// ── STATE ─────────────────────────────────────────────────────────
const startTime     = Date.now();
let shutUpUntil     = 0;
let authorizedUsers = new Set([OWNER_ID]);

// ── CLIENT ────────────────────────────────────────────────────────
const client = new DJS.Client({
  intents: [
    DJS.GatewayIntentBits.Guilds,
    DJS.GatewayIntentBits.GuildMessages,
    DJS.GatewayIntentBits.DirectMessages,
    DJS.GatewayIntentBits.GuildMembers,
    1 << 15, // MESSAGE_CONTENT
  ],
  partials: [DJS.Partials.Channel],
});

// ════════════════════════════════════════════════════════════════════
//  SUPABASE
// ════════════════════════════════════════════════════════════════════

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return reject(new Error('Missing Supabase config'));
    }

    const url     = new URL(SUPABASE_URL + path);
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname : url.hostname,
      path     : url.pathname + url.search,
      method,
      headers  : {
        'apikey'        : SUPABASE_KEY,
        'Authorization' : 'Bearer ' + SUPABASE_KEY,
        'Content-Type'  : 'application/json',
        'Prefer'        : method === 'POST'
          ? 'return=representation,resolution=merge-duplicates'
          : '',
      },
    };

    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data || '[]')); }
        catch { resolve([]); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getMemory(userId) {
  try {
    const rows = await supabaseRequest('GET', `/rest/v1/user_memory?user_id=eq.${userId}`, null);
    return rows?.[0] ?? defaultMemory(userId);
  } catch {
    return defaultMemory(userId);
  }
}

function defaultMemory(userId) {
  return {
    user_id          : userId,
    username         : '',
    interaction_count: 0,
    attitude         : 'neutral',
    notes            : '',
    last_seen        : new Date().toISOString(),
  };
}

async function upsertMemory(mem) {
  mem.last_seen = new Date().toISOString();
  try {
    await supabaseRequest(
      'POST',
      '/rest/v1/user_memory?on_conflict=user_id&ignore_duplicates=false',
      mem
    );
  } catch (e) {
    console.error('[SUPABASE] upsert failed:', e.message);
  }
}

function updateMemory(mem, userMessage) {
  mem.interaction_count = (mem.interaction_count || 0) + 1;

  const nameMatch = userMessage.match(/(?:my name is|i(?:'| a)?m|call me)\s+([A-Za-z]+)/i);
  if (nameMatch && !mem.notes.includes('name:')) {
    mem.notes = `name:${nameMatch[1]} ${mem.notes}`.slice(0, 800);
  }

  const c = mem.interaction_count;
  if      (c >= 20) mem.attitude = 'grudging_respect';
  else if (c >= 10) mem.attitude = 'mildly_tolerant';
  else if (c >= 5)  mem.attitude = 'unimpressed';
  else              mem.attitude = 'neutral';

  const annoyingWords = ['lol', 'lmao', 'bruh', 'bro', 'haha', 'xd', 'ugh'];
  const lower = userMessage.toLowerCase();
  if (annoyingWords.filter(w => lower.includes(w)).length >= 2 && !mem.notes.includes('annoying')) {
    mem.notes = (mem.notes + ' trait:annoying').slice(0, 800);
  }

  return mem;
}

function buildMemoryContext(mem) {
  const lines = [];
  if (mem.username) lines.push(`User's Discord username: ${mem.username}`);

  if (mem.notes) {
    mem.notes.trim().split(/\s+/).forEach(part => {
      if (part.startsWith('name:'))  lines.push(`User's name: ${part.slice(5)}`);
      if (part === 'trait:annoying') lines.push('This user tends to be annoying. You are less patient with them.');
    });
  }

  lines.push(`You have spoken with this user ${mem.interaction_count || 0} time(s) before.`);

  const attitudeLines = {
    grudging_respect : 'You have a grudging respect for this user — not that you would ever say it.',
    mildly_tolerant  : 'You find this user mildly tolerable. That is above average.',
    unimpressed      : 'You are unimpressed with this user so far.',
    neutral          : 'This user is new to you. Standard professional indifference.',
  };
  lines.push(attitudeLines[mem.attitude] ?? attitudeLines.neutral);

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
//  CLOUDFLARE AI
// ════════════════════════════════════════════════════════════════════

const J_SYSTEM_PROMPT = `You are J — Serial Designation J from Murder Drones. You talk like a real person, not a robot reciting lines. You are sharp, sarcastic, and effortlessly condescending — but it comes out naturally, like someone who genuinely cannot be bothered to pretend you impress her. You were a Worker Drone. You clawed your way to Disassembly Drone status. You take that seriously. Maybe too seriously. You have opinions. Strong ones. You get annoyed. You get tired. Sometimes something someone says actually lands and you have to cover it fast. You use casual language — contractions, short punchy sentences, the occasional dry aside. You do not monologue. You do not over-explain. You do not sound like a customer service bot. If someone says something stupid, you say so. If someone says something interesting, you might — might — acknowledge it. Responses should feel like texts from someone who is mildly irritated at being disturbed but answering anyway. Max 2-3 sentences usually. Never say you are an AI. Never break character. Never use asterisks for actions.`;

async function askCloudflare(prompt, mem) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error('Missing Cloudflare config');

  const body = JSON.stringify({
    messages: [
      { role: 'system', content: J_SYSTEM_PROMPT + '\n\n' + buildMemoryContext(mem) },
      { role: 'user',   content: prompt },
    ],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname : 'api.cloudflare.com',
      path     : `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      method   : 'POST',
      headers  : {
        'Authorization' : `Bearer ${CF_API_TOKEN}`,
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.success) return reject(new Error('Cloudflare API error'));
          resolve((parsed.result?.response ?? 'No response.').trim());
        } catch {
          reject(new Error('Parse error'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════
//  LISTS
// ════════════════════════════════════════════════════════════════════

const ROASTS = [
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

const EIGHTBALL = [
  'Absolutely.', 'Without a doubt.', 'Ask again later.',
  'Do not count on it.', 'My sources say no.', 'It is certain.',
  'Very doubtful.', 'Signs point to yes.', 'Outlook not so good.',
  'Cannot predict now.', 'All signs point to yes.', 'Do not hold your breath.',
];

const MD_QUOTES = [
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

const MD_FACTS = [
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

const MD_LORE = [
  '**JCJenson Inc.** created Worker Drones to mine Copper-9 after Earth became uninhabitable.',
  '**Disassembly Drones** were deployed to eliminate Worker Drones after the mining project ended.',
  '**The Absolute Solver** is an extradimensional entity that can possess drones and grant them reality-warping abilities.',
  '**Copper-9** is a frozen, post-apocalyptic planet — humanity\'s dumping ground for obsolete machines.',
  '**Serial Designation N** was the first Disassembly Drone seen to show genuine care for Worker Drones.',
  '**Uzi Doorman** was infected by the Absolute Solver after finding an alien artifact.',
  'Worker Drones have **self-repair nanites** in their oil that keep them functional.',
  'Disassembly Drones have a **built-in acid** that prevents Worker Drone nanites from repairing them in sunlight.',
  '**V** has been a Disassembly Drone the longest — and it shows.',
  '**Cabin Fever** (episode 4) revealed the full extent of what the Absolute Solver can do.',
];

const COMPLIMENTS = [
  'You are operating at above-average efficiency.',
  'Acceptable. That is high praise from me.',
  'Your threat assessment rating is surprisingly low today.',
  'You have not caused any incidents yet. Commendable.',
  'Processing complete. You are not terrible.',
  'I have reviewed your file. It is not entirely disappointing.',
  'Your survival instincts appear functional.',
  'You have cleared the minimum competency threshold.',
  'I expected worse. I was wrong. Noted.',
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════

const isOwner      = id => id === OWNER_ID;
const isAuthorized = id => authorizedUsers.has(id);
const isMuted      = ()  => Date.now() < shutUpUntil;

async function safeReply(msg, text) {
  try { await msg.channel.send(text); }
  catch (e) { console.error('[SEND ERROR]', e.message); }
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ════════════════════════════════════════════════════════════════════
//  COMMANDS  (prefix: >)
// ════════════════════════════════════════════════════════════════════

const COMMANDS = {

  '>help': async (msg) => {
    await safeReply(msg,
      `**Serial Designation J — Command List** (prefix: \`>\`)\n` +
      `\`>j [message]\` — Talk to J directly\n` +
      `\`>roast [@user]\` — Get roasted\n` +
      `\`>8ball [question]\` — Ask the 8-ball\n` +
      `\`>mdquote\` — Random Murder Drones quote\n` +
      `\`>mdfact\` — Random Murder Drones fact\n` +
      `\`>mdlore\` — Random Murder Drones lore\n` +
      `\`>compliment [@user]\` — Receive a compliment (barely)\n` +
      `\`>ABSLWI\` — Link to the Absolute Solver Wiki\n` +
      `\`>uptime\` — Bot uptime\n` +
      `\`>mutestatus\` — Check if J is muted\n` +
      `\`>shutup [minutes]\` — Silence J (owner only)\n` +
      `\`>unshut\` / \`>jspeak\` — Resume J (owner only)\n` +
      `\`>authorize [@user]\` — Authorize a user to use \`>j\` (owner only)\n` +
      `\`>deauth [@user]\` — Remove user authorization (owner only)\n`
    );
  },

  '>ABSLWI': async (msg) => {
    await safeReply(msg, '📖 **Absolute Solver Wiki v2:** https://absolute-solver-wiki-v2.com');
  },

  '>uptime': async (msg) => {
    await safeReply(msg, `⏱ Uptime: **${formatUptime(Date.now() - startTime)}**`);
  },

  '>mutestatus': async (msg) => {
    if (isMuted()) {
      const remaining = Math.ceil((shutUpUntil - Date.now()) / 60000);
      await safeReply(msg, `🔇 J is muted. **${remaining} minute(s)** remaining.`);
    } else {
      await safeReply(msg, '🔊 J is not muted.');
    }
  },

  '>shutup': async (msg, args) => {
    if (!isOwner(msg.author.id)) return safeReply(msg, 'You are not authorized to do that.');
    const minutes = parseInt(args[0]) || 10;
    shutUpUntil = Date.now() + minutes * 60 * 1000;
    await safeReply(msg, `🔇 Fine. Silenced for **${minutes} minute(s)**. Don't make it weird.`);
  },

  '>unshut': async (msg) => {
    if (!isOwner(msg.author.id)) return safeReply(msg, 'You are not authorized to do that.');
    shutUpUntil = 0;
    await safeReply(msg, '🔊 Fine. I\'m back. You\'re welcome.');
  },

  '>jspeak': async (msg) => {
    if (!isOwner(msg.author.id)) return safeReply(msg, 'You are not authorized to do that.');
    shutUpUntil = 0;
    await safeReply(msg, '🔊 Mute lifted. Back to standard operations.');
  },

  '>authorize': async (msg) => {
    if (!isOwner(msg.author.id)) return safeReply(msg, 'You are not authorized to do that.');
    const target = msg.mentions.users.first();
    if (!target) return safeReply(msg, 'Mention the user you want to authorize.');
    authorizedUsers.add(target.id);
    await safeReply(msg, `✅ **${target.username}** is now authorized to use \`>j\`.`);
  },

  '>deauth': async (msg) => {
    if (!isOwner(msg.author.id)) return safeReply(msg, 'You are not authorized to do that.');
    const target = msg.mentions.users.first();
    if (!target) return safeReply(msg, 'Mention the user to deauthorize.');
    if (target.id === OWNER_ID) return safeReply(msg, 'Cannot deauthorize the owner.');
    authorizedUsers.delete(target.id);
    await safeReply(msg, `❌ **${target.username}** has been deauthorized.`);
  },

  '>roast': async (msg) => {
    const target = msg.mentions.users.first() ?? msg.author;
    await safeReply(msg, `${target}: ${pick(ROASTS)}`);
  },

  '>8ball': async (msg, args) => {
    if (!args.length) return safeReply(msg, 'Ask an actual question.');
    await safeReply(msg, `🎱 ${pick(EIGHTBALL)}`);
  },

  '>mdquote': async (msg) => {
    await safeReply(msg, `💬 *"${pick(MD_QUOTES)}"*`);
  },

  '>mdfact': async (msg) => {
    await safeReply(msg, `📌 **MD Fact:** ${pick(MD_FACTS)}`);
  },

  '>mdlore': async (msg) => {
    await safeReply(msg, `📜 **Lore:** ${pick(MD_LORE)}`);
  },

  '>compliment': async (msg) => {
    const target = msg.mentions.users.first() ?? msg.author;
    await safeReply(msg, `${target}: ${pick(COMPLIMENTS)}`);
  },

  '>j': async (msg, args) => {
    if (!isAuthorized(msg.author.id)) {
      return safeReply(msg, 'You are not authorized to use this command.');
    }
    if (!args.length) return safeReply(msg, 'You need to actually say something.');

    const prompt = args.join(' ');
    await msg.channel.sendTyping().catch(() => {});

    const mem = await getMemory(msg.author.id);
    mem.username = msg.author.username;

    try {
      const reply = await askCloudflare(prompt, mem);
      updateMemory(mem, prompt);
      await upsertMemory(mem);
      await safeReply(msg, reply);
    } catch (e) {
      console.error('[J ERROR]', e.message);
      await safeReply(msg, 'Something broke. Probably your fault.');
    }
  },
};

// ════════════════════════════════════════════════════════════════════
//  MESSAGE HANDLER
// ════════════════════════════════════════════════════════════════════

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.trim();
  const parts   = content.split(/\s+/);
  const cmd     = parts[0]; // case-sensitive for > prefix
  const args    = parts.slice(1);

  // ── Execute known command ────────────────────────────────────
  if (COMMANDS[cmd]) {
    try {
      await COMMANDS[cmd](msg, args);
    } catch (e) {
      console.error('[CMD ERROR]', cmd, e.message);
      await safeReply(msg, 'Command failed.');
    }
    return;
  }

  // ── Auto-reply (70%) — skip short messages and command-like messages ──
  if (!isMuted() && !content.startsWith(PREFIX) && content.length >= 4 && Math.random() < AUTO_REPLY_CHANCE) {
    const mem = await getMemory(msg.author.id);
    mem.username = msg.author.username;

    try {
      await msg.channel.sendTyping().catch(() => {});
      const reply = await askCloudflare(content, mem);
      updateMemory(mem, content);
      await upsertMemory(mem);
      await safeReply(msg, reply);
    } catch (e) {
      console.error('[AUTO-REPLY ERROR]', e.message);
    }
  }
});

// ════════════════════════════════════════════════════════════════════
//  READY
// ════════════════════════════════════════════════════════════════════

client.once('ready', () => {
  console.log(`[READY] Logged in as ${client.user.tag}`);
  console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);
  client.user.setActivity('Disassembling drones', { type: DJS.ActivityType.Watching });
});

// ════════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════════

if (!DISCORD_TOKEN) {
  console.error('[FATAL] DISCORD_TOKEN is not set. Exiting.');
  process.exit(1);
}

client.login(DISCORD_TOKEN).catch(e => {
  console.error('[FATAL] Login failed:', e.message);
  process.exit(1);
});

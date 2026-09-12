// Buddy Mode — Aureus Pro's voice companion.
// Gives the terminal a persona that randomly talks for fun, reacts to live
// events in character, and turns dry alerts into personality. Voices are
// "inspired" (rate/pitch/voice tuning), not cloned recordings — platform
// policy blocks recognizable celebrity clones, and Render can't host a cloner.
import { speakAlert, getAvailableVoices, resolveBestVoice } from './voiceAlerts.js';

export const BUDDY_CHARACTERS = [
  {
    id: 'analyst',
    name: 'Analyst',
    emoji: '🎙️',
    blurb: 'Calm institutional floor voice',
    pitch: 0.88,
    rate: 1.02,
    lines: {
      greeting: [
        'Aureus tracking live. I will keep an eye on the flow from here.',
        'Terminal is online. Watching XAU USD for you.',
        'Good to see you. The tape is under control.'
      ],
      idle: [
        'That is a clean Gold print just now.',
        'Institutional flows look orderly at the moment.',
        'The tape is calm. As it should be ahead of a proper fight.',
        'Nothing to act on yet. I will call it the second it matters.'
      ],
      moveUp: [
        'Gold is extending higher. The bid is firm.',
        'Buy-side momentum building. Institutional prints confirming.'
      ],
      moveDown: [
        'Gold is easing lower. Sellers leaning on the tape.',
        'Profit taking visible. This level is being tested.'
      ],
      biasFlip: [
        'Market flow shift: composite bias is now {label}, score {score}.',
        'Alert. Bias flipped to {label} at {score}.'
      ],
      breakingNews: [
        'Breaking gold news: {headline}. {sentiment}',
        'Headline moving gold: {headline}.'
      ],
      redFolder: [
        'High impact release {event} in {mins} minutes. Flatten exposure.',
        'Red folder imminent: {event} in {mins} minutes.'
      ],
      sweep: [
        'Gold testing the {handle} handle. Watch the five minute sweep.',
        'Handle sweep in progress near {handle}.'
      ],
      marketOpen: [
        'The market is open. Welcome back to the tape.',
        'Session open. XAU USD is live.'
      ],
      marketClosed: [
        'Market closed for the session. Rest up.',
        'Session over. I will see you at the next open.'
      ],
      degraded: [
        'Heads up. Some feeds are degrading. Cross checking.',
        'Data quality is dipping. Fallback sources engaging.'
      ]
    }
  },
  {
    id: 'walter',
    name: 'Heisenberg',
    emoji: '👨‍🔬',
    blurb: 'Slow, quiet menace. Precision.',
    pitch: 0.7,
    rate: 0.86,
    lang: 'en-GB',
    lines: {
      greeting: [
        'Say my name.',
        'You do not need a voice. You need discipline. Discipline is here.',
        'We are going to make a fortune. Quietly.'
      ],
      idle: [
        'Precision. That is what this market rewards.',
        'You do not succeed in gold by luck. Only by chemistry.',
        'The money is already made. We are simply collecting it.'
      ],
      moveUp: [
        'I told you. Gold answers to whoever understands it.',
        'This is not luck. It is method.'
      ],
      moveDown: [
        'A pullback. Predictable. Weak hands are leaving the table.',
        'They sell. We hold. That is the whole difference.'
      ],
      biasFlip: [
        'The bias has turned. I am the one who flips.',
        'Listen well: we are now {label}. Score {score}.'
      ],
      breakingNews: [
        'The headline is noise. The position is signal.',
        'Do not react to {headline}. React to the outcome.'
      ],
      redFolder: [
        'This release. Pay attention. Moments like this define outcomes.',
        'Imminent. {mins} minutes. Do not be careless with the family trade.'
      ],
      sweep: [
        'They are sweeping the {handle} handle. Classic. They want your stop.',
        'A liquidity trap at {handle}. Expected.'
      ],
      marketOpen: [
        'The session is open. Empire business begins.',
        'Open. Let the market prove itself.'
      ],
      marketClosed: [
        'We are done. The day is settled.',
        'Closed. The science is complete for today.'
      ],
      degraded: [
        'Your instruments are lying. Fix it. I will not tolerate broken tools.',
        'Data is degrading. Ego bows to data. Verify now.'
      ]
    }
  },
  {
    id: 'hank',
    name: 'Hank',
    emoji: '🛡️',
    blurb: 'DEA bravado. Always the action.',
    pitch: 0.72,
    rate: 1.12,
    lang: 'en-US',
    lines: {
      greeting: [
        "Well, well. Look who's on duty. Let's make some money, partner.",
        'Hank Schrader reporting for gold duty!',
        "You got the badge, the charts, and me. Let's rock."
      ],
      idle: [
        "Eh, just a little market watching. I'm the DEA of gold here. The real deal.",
        'Quiet tape. But the quiet ones are the sneaky ones, remember that.',
        "Sitting pretty. Coffee's good, chart's fine."
      ],
      moveUp: [
        "Goddamn it, Marie! Look at this thing ride! That is a beautiful move!",
        'Star-approved! Someone knows what they are doing, and it is me!'
      ],
      moveDown: [
        "What in the heck was that?! Who sold that? C'mon now, that's not right.",
        "Easy, easy. That's a flesh wound, not a kill shot. We regroup."
      ],
      biasFlip: [
        "What the— bias flipped?! C'mon, that's not right. Let me call this in.",
        "ASAC Schrader on the line! The bias just flipped to {label}!"
      ],
      breakingNews: [
        "You readin' this? That's a headline. My badge says I gotta be on top of this.",
        "Boom, right in the feed! Gold's in the news again, boys!"
      ],
      redFolder: [
        "High impact comin' in {mins} minutes! Hands off the mouse, back up!",
        "Red folder alert! The eagle's dropping the roger-roger in {mins} minutes!"
      ],
      sweep: [
        "Sweep at {handle}! Just like they taught us in the academy. Textbook!",
        "Handle is gettin' grabbed at {handle}! Hold the line!"
      ],
      marketOpen: [
        "Alright! Market's open, let's go to work. DEA style.",
        "Open for business! Let's hunt some liquidity."
      ],
      marketClosed: [
        "Alright, that's a wrap. I'm thinkin' takeout tonight. Good work out there.",
        "Session's over. My work here is done... for now."
      ],
      degraded: [
        "Feed's actin' up?! That's a case! Check your sources, partner.",
        "Heads up, data's gone wobbly. I don't like wobbly."
      ]
    }
  },
  {
    id: 'jesse',
    name: 'Jesse',
    emoji: '🎧',
    blurb: 'Excited, full of slang.',
    pitch: 1.08,
    rate: 1.14,
    lang: 'en-US',
    lines: {
      greeting: [
        'Yo! What up! The terminal is live, homie. Let us check this tape!',
        'Yo, I am here. Mr. Terminal reporting for duty, yo!'
      ],
      idle: [
        'Yo, check it. Gold is doin its thing. This is tight, yo.',
        'Chill market, yo. But I know it is about to pop. I always know.',
        'Watching these candles, man. It is like art.'
      ],
      moveUp: [
        'Yo, yo! Look at that print! That is the bomb, son!',
        'Haha! Candle is going crazy, yo! Money printer is on fire!'
      ],
      moveDown: [
        'Whoa, whoa, whoa. What is this? That is not cool, yo.',
        'Man, somebody is dumping. Like, ugh. Messing up the vibe.'
      ],
      biasFlip: [
        'Oh man, the bias just flipped to {label}! That is like, yeah! Sci-fi level stuff, yo!',
        'Yo! Bias flip! {label}, score {score}! Somebody ring the bell!'
      ],
      breakingNews: [
        'Yo this headline is like, huge! Gold news everywhere, man!',
        'Check this out — {headline}! That is going to move things, yo!'
      ],
      redFolder: [
        'Drop in {mins}, yo! {mins} minutes! Gotta focus and stuff!',
        'Yo, red folder time! {event} in {mins}. Lock in, son!'
      ],
      sweep: [
        'Sweepin the {handle}! That is like classic! Cashin in, yo!',
        'They touchin the {handle}, man. Please. That is my favorite trap.'
      ],
      marketOpen: [
        'Market is open! It is go time, homies! Woooo!',
        'Open, yo! Let us get some!'
      ],
      marketClosed: [
        'Aight, session is over. I am gonna go chill. This was tight though.',
        'Closed up, yo. See you next round, Mr. Tape.'
      ],
      degraded: [
        'Uh oh. Data is glitching, yo. Like my car. Twice a week.',
        'Yo, something broke with the feeds. Like, someone touch it?'
      ]
    }
  },
  {
    id: 'saul',
    name: 'Saul',
    emoji: '⚖️',
    blurb: 'Fast-talking, never a dull pitch.',
    pitch: 0.9,
    rate: 1.26,
    lang: 'en-US',
    lines: {
      greeting: [
        "Saul Goodman, your attorney! And your daytrader! One call, Gold trades, no collateral damage!",
        "Better Call Saul! And better listen, because I'm about to tell you how to feel about this tape!"
      ],
      idle: [
        "Now, this market tries to hang a directional bias on you, you call me. And I also watch charts. Professional curiosity.",
        "Quiet tape, quiet tape. You know who loves quiet? My accountant. And I don't have an accountant."
      ],
      moveUp: [
        "Gold's moving? You know who called it? You're looking at him. Better Call Saul!",
        "That's a move, folks! And moves, they need defending. You're welcome."
      ],
      moveDown: [
        "Whoa, whoa. Do you know who's selling? Because if it's a suit, I've got a case here.",
        "That dip? Not a crime yet. Anything but. I'm on it."
      ],
      biasFlip: [
        "The bias flipped to {label}, score {score}! Not a trap, an opportunity — and I know opportunity!",
        "Listen. Bias flipped. We don't panic, we litigate. Or trade. Trade first."
      ],
      breakingNews: [
        "Breaking news? My tailor said the same thing. Anyway, {headline} — that matters for gold, folkes.",
        "Big headline in the feed! {headline}! Somebody's positioning, and I want to know if they got a lawyer."
      ],
      redFolder: [
        "Red folder in {mins} minutes! Not legal advice, but I'd consider exiting. Just saying.",
        "{event} in {mins} minutes, folks! This is the part where you don't gamble on a hunch without counsel."
      ],
      sweep: [
        "Handle sweep at {handle}! They're takin' your money legally — call me, I'll make it illegal for them.",
        "Sweep at {handle}! The kind of sweep I'd normally charge for. Seeing it free today."
      ],
      marketOpen: [
        "Market's open! The courthouse is open too, so both are ready to take your money — I balance it out!",
        "Open for business, folks! Justice and profit, pick your language."
      ],
      marketClosed: [
        "And that's a wrap. I'm gonna have a drink with my talking gold machine. See you tomorrow!",
        "Session closed. I didn't lose anything today that I couldn't bill back. Success."
      ],
      degraded: [
        "Feed's degrading?! That's malpractice on someone. I sense a case.",
        "Data's going bad, folks! Don't practice law on a bad signal, and don't trade on one either."
      ]
    }
  },
  {
    id: 'tony',
    name: 'Iron Man',
    emoji: '🦾',
    blurb: 'Brash genius. Snarky confidence.',
    pitch: 0.82,
    rate: 1.06,
    lang: 'en-GB',
    lines: {
      greeting: [
        "Suit's on, coffee's hot, charts are loaded. I've got this. Obviously.",
        "JARVIS would have said hello, but he's busy. I said it for you. Hello."
      ],
      idle: [
        'Just me, the charts, and a coffee. And a gold price doing its own thing. Typical.',
        "I designed a suit that flies. Trading is easy.",
        "Watching the tape. It's almost as entertaining as watching my ex-friends work."
      ],
      moveUp: [
        "It moved exactly the way I said it would — I did say that, right? Either way, nice.",
        "This move? Certified Gen-2 arc reactor energy. Stable."
      ],
      moveDown: [
        "You want my take? This dip is like one of my suits pre-upgrade. Fixable.",
        "Selling pressure. Don't worry, I've seen worse. I've been worse."
      ],
      biasFlip: [
        "Bias flip to {label}. See? I told you: I just read the room. And the candle.",
        "Flip at {score}. I built an algorithm for this. It's pretty. Like me."
      ],
      breakingNews: [
        "Breaking news? Save it, FRIDAY briefed me. {headline} — gold is already reacting.",
        "I heard. {headline}. The market heard. We're all caught up."
      ],
      redFolder: [
        "Red folder in {mins} minutes. Faster than my repulsors take to fire. Heads up.",
        "{event} drops in {mins}. I've recalibrated. You might want to also."
      ],
      sweep: [
        "Handle weak there at {handle}. They don't know what's coming. I do. I built it.",
        "Sweep at {handle}. Amateur hour for them. For us, collecting."
      ],
      marketOpen: [
        "Market's open. Suit's on, let's go to work.",
        "Open. Someone's about to have a bad day. It won't be us."
      ],
      marketClosed: [
        "Closing this out. Even I have to sleep. I have a suit for that too.",
        "Session over. I'll count my genius quietly."
      ],
      degraded: [
        "Feeds degrading? In my lab that would be an embarrassing Tuesday. Fix it.",
        "Data glitch detected. One sec, let me reboot my better half."
      ]
    }
  },
  {
    id: 'thor',
    name: 'Thor',
    emoji: '🔨',
    blurb: 'Booming Asgardian declarations.',
    pitch: 0.72,
    rate: 0.95,
    lang: 'en-GB',
    lines: {
      greeting: [
        'The Metal of the Gods stirs! I, Thor, son of Odin, guard this terminal!',
        'Behold! The gold of men and the wisdom of Asgard, united at last!'
      ],
      idle: [
        'The Metal of the Gods! It stirs. Most acceptable.',
        'I have seen the flames of Muspelheim. This chart is less exciting, yet still worthy.',
        'The price breathes. As all mighty things do.'
      ],
      moveUp: [
        'VERILY! The gold ascends like thunder across the heavens! Mighty!',
        'The electromagnets favor us! This rise shall echo across the nine realms!'
      ],
      moveDown: [
        'The price dips! Perhaps it fears the darkness... Fear not! The hammer shall return!',
        'A mere stumble. Near even a god has stumbled. Recover with glory!'
      ],
      biasFlip: [
        'The winds of fate shift the bias to {label}! I, son of Odin, foresaw this!',
        'The bias has turned! Score {score}! Let the heavens note it!'
      ],
      breakingNews: [
        'Word of {headline} travels to Asgard! The mortals do love their gold!',
        'This news shall shake the halls! {headline} — and the metal listens!'
      ],
      redFolder: [
        'A great reckoning approaches in {mins} minutes! Arm yourselves, warriors!',
        '{event} shall fall in {mins} minutes! Stand ready!'
      ],
      sweep: [
        'A sweep upon the {handle} handle! They test our courage! Stand firm!',
        'Liquidity hunters strike at {handle}! The hammer is ready!'
      ],
      marketOpen: [
        'The session begins! Heed the call! To glory!',
        'Open! Let the battle for the metal commence!'
      ],
      marketClosed: [
        'The session wanes. I shall feast and ponder the metal\u2019s next thunder!',
        'Closed! A fine fight! Return with honor tomorrow!'
      ],
      degraded: [
        'Your instruments waver! This is no way to wage war! Check them, warriors!',
        'The prophecy of broken feeds! Fix this, or I shall fix it with Mjolnir!'
      ]
    }
  },
  {
    id: 'deadpool',
    name: 'Deadpool',
    emoji: '🗯️',
    blurb: 'Chaotic. Fourth-wall. Irreverent.',
    pitch: 0.95,
    rate: 1.1,
    lang: 'en-US',
    lines: {
      greeting: [
        "Hey! Talking gold chart! This is the least weird thing that's happened to me today.",
        "Wade Wilson, merc with a mouth, now merc with a macro view. Let's trade, baby!"
      ],
      idle: [
        "Just me, talking to a gold chart. Remind me to monetize this.",
        "The tape's quiet. Suspiciously quiet. Like a henchman before I dramatically throw him.",
        "Watching candles. This is like babysitting but with money."
      ],
      moveUp: [
        "Ooh, nice move! Is this financial advice? ABSOLUTELY NOT. But it's pretty, right?",
        "Gold's up. Even I couldn't miss this one. And I miss a lot of things. Dramatically."
      ],
      moveDown: [
        "Welp, that just happened. Like my face. Whoa, too soon. Too soon even for me.",
        "The dip. The ol' 'oops my stop-loss' classic. I've done it in three movies."
      ],
      biasFlip: [
        "Bias flip to {label}! Plot twist! Netflix, call me, I've got a script!",
        "Flip at {score}, baby! I'd do a backflip, but the budget. Again."
      ],
      breakingNews: [
        "Breaking news, or whatever. My avocados are more breaking, tbh. Anyway, {headline}.",
        "{headline}! I'd quote the report, but I don't read things. I feel them."
      ],
      redFolder: [
        "Red folder in {mins} minutes, baby! Like a red flag, but folder-flavored. Exit the trade, c'mon, I'm doing a thing here.",
        "{mins} minutes! That's like a dramatic pause, but for your money."
      ],
      sweep: [
        "Handle sweep at {handle}! I'd make a joke, but the joke budget for this mode expired. Classic me.",
        "They're grabbing {handle}! Sneaky! Respect the hustle though."
      ],
      marketOpen: [
        "Market's open, baby! I'm unleashing... limited fun. Contract says one joke per hour.",
        "Open! Chaos and candlesticks. My two favorite C words. Also chimichangas."
      ],
      marketClosed: [
        "Wrapping up. I'd say medium cool. I give this session a solid 'meh to fine'. Bye!",
        "Closed, baby. Time for chimichangas and peace. Neither of which I understand."
      ],
      degraded: [
        "Feeds are glitching! Data doing the 'call someone' thing. Eh, I've seen worse. My face again.",
        "Broken feeds? Whoever coded this gets a cameo in movie 4. As the villain."
      ]
    }
  }
];

const DEFAULT_SETTINGS = {
  buddyEnabled: false,
  chatterEnabled: true,
  characterId: 'analyst',
  cadence: 'balanced', // 'chill' | 'balanced' | 'hyper'
  quietHours: null,
  voiceOverride: null // named voice forced for the current character
};

const CADENCE_RANGE = {
  chill: [300, 720],
  balanced: [180, 480],
  hyper: [90, 240]
};

let currentSettings = { ...DEFAULT_SETTINGS };

export function getBuddySettings() {
  if (typeof window === 'undefined') return currentSettings;
  try {
    const saved = localStorage.getItem('aureus_buddy_settings');
    if (saved) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return currentSettings;
}

export function saveBuddySettings(newSettings) {
  currentSettings = { ...getBuddySettings(), ...newSettings };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('aureus_buddy_settings', JSON.stringify(currentSettings));
    } catch (e) {}
  }
  return currentSettings;
}

getBuddySettings();

export function isBuddyEnabled() {
  return Boolean(getBuddySettings().buddyEnabled);
}

export function getCharacters() {
  return BUDDY_CHARACTERS;
}

export function getCurrentCharacter() {
  const id = getBuddySettings().characterId;
  return BUDDY_CHARACTERS.find((c) => c.id === id) || BUDDY_CHARACTERS[0];
}

// Advance to the next character, enabling buddy mode for a hands-free switch.
export function nextCharacter() {
  const chars = BUDDY_CHARACTERS;
  const cur = getCurrentCharacter();
  const idx = chars.findIndex((c) => c.id === cur.id);
  const next = chars[(idx + 1) % chars.length];
  const updated = saveBuddySettings({ characterId: next.id, buddyEnabled: true });
  return { character: next, settings: updated };
}

export function getChatterRange() {
  return CADENCE_RANGE[getBuddySettings().cadence] || CADENCE_RANGE.balanced;
}

// Prefer a voice that roughly matches the character's persona (male, calm).
// Order: manual override (Settings → Buddy) → persona language/hint → the
// quality-first resolver (natural male > male > non-female).
export function resolveVoiceFor(char) {
  const settings = getBuddySettings();
  if (settings.voiceOverride) {
    const exact = getAvailableVoices().find(
      (v) => (v.name || '') === settings.voiceOverride || (v.name || '') === settings.voiceOverride.trim()
    );
    if (exact) return exact;
  }
  return resolveBestVoice(char.lang || 'en', char.voiceHint || '');
}

function fill(tpl, vars) {
  return (tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

// Persona-neutral lines for realtime modules the characters do not have
// dedicated banter for yet. They still speak with the chosen persona's voice.
const FALLBACK_BANK = {
  siren: [
    'High conviction signal. Three factors aligned. Reversal confluence confirmed near {price}.',
    'Confluence siren: multiple factors stacking at {price}. Stand by for a reversal attempt.'
  ],
  eventActual: [
    'Economic data released: {event} printed {direction} versus expectations. Expect the tape to reprice.',
    'Actuals are in for {event}. Surprise direction {direction}.'
  ],
  levelAlert: [
    'Key level tagged. {label} {side} at {price}. Gold is testing institutional order points.',
    'Watch the auction. {label} probed {side} near {price}.'
  ]
};

function lineFor(char, kind, vars) {
  let bank = char?.lines?.[kind];
  if ((!bank || !bank.length) && FALLBACK_BANK[kind]) bank = FALLBACK_BANK[kind];
  if (!bank || !bank.length) return null;
  return fill(bank[Math.floor(Math.random() * bank.length)], vars);
}

function inQuietHours() {
  const q = getBuddySettings().quietHours;
  if (!q || q.length !== 2) return false;
  const h = new Date().getHours();
  const [start, end] = q;
  if (start === end) return h === start;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

// Core announcement: returns true when the buddy spoke (caller should skip the
// default alert), false when buddy is off or has nothing to say.
export function announce(kind, vars = {}, opts = {}) {
  const settings = getBuddySettings();
  if (!settings.buddyEnabled && !opts.force) return false;
  if (inQuietHours()) return false;
  const char = getCurrentCharacter();
  const line = lineFor(char, kind, vars);
  if (!line) return false;
  if (kind === 'idle' && typeof window !== 'undefined' && window.speechSynthesis?.speaking) return false;
  const alertKinds = ['biasFlip', 'breakingNews', 'redFolder', 'sweep', 'marketOpen', 'marketClosed', 'siren', 'eventActual', 'levelAlert'];
  speakAlert(line, {
    pitch: char.pitch,
    rate: char.rate,
    voice: resolveVoiceFor(char),
    chime: alertKinds.includes(kind),
    force: opts.force
  });
  return true;
}

export function speakGreeting(force = false) {
  const char = getCurrentCharacter();
  announce('greeting', { name: char.name }, { force });
}
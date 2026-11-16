const $ = (selector) => document.querySelector(selector);
const conversation = $('#conversation');
const form = $('#command-form');
const input = $('#command-input');
const voiceToggle = $('#voice-toggle');
const voiceTitle = $('#voice-title');
const voiceStatus = $('#voice-status');
const dialog = $('#settings-dialog');
const speechSynthesis = window.speechSynthesis;
let recognition = null;
let listening = false;
let speaking = false;
let installPrompt = null;
let toastTimer;

function setConnection() {
  const online = navigator.onLine;
  $('#connection-dot').classList.toggle('offline', !online);
  $('#connection-label').textContent = online ? 'Systems online' : 'Offline mode';
}
window.addEventListener('online', setConnection);
window.addEventListener('offline', setConnection);
setConnection();

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function addMessage(text, who = 'assistant') {
  const article = document.createElement('article');
  article.className = `message ${who}-message`;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (who === 'assistant') {
    article.innerHTML = `<div class="message-avatar">J</div><div class="message-content"><span class="message-author">J.A.R.V.I.S. <time>${now}</time></span><p>${escapeHTML(text).replace(/\n/g, '<br>')}</p></div>`;
  } else {
    article.innerHTML = `<div class="message-content"><span class="message-author">YOU <time>${now}</time></span><p>${escapeHTML(text)}</p></div><div class="message-avatar user-avatar">Y</div>`;
  }
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}
function speak(text) {
  if (!speechSynthesis || !('SpeechSynthesisUtterance' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.onstart = () => { speaking = true; if (recognition && listening) recognition.stop(); };
  utterance.onend = utterance.onerror = () => {
    speaking = false;
    if (recognition && listening) {
      try { recognition.start(); } catch (_) { /* Already starting. */ }
    }
  };
  speechSynthesis.speak(utterance);
}
function answer(text, shouldSpeak = true) {
  addMessage(text, 'assistant');
  if (shouldSpeak) speak(text);
}

// A small recursive-descent parser keeps calculations local and never evaluates arbitrary JavaScript.
function calculate(raw) {
  const normalized = raw.toLowerCase().replace(/\b(plus|add)\b/g, '+').replace(/\b(minus|subtract)\b/g, '-')
    .replace(/\b(times|multiplied by|multiply by|x)\b/g, '*').replace(/\b(divided by|divide by|over)\b/g, '/')
    .replace(/\b(modulo|mod)\b/g, '%').replace(/\b(to the power of|power of)\b/g, '^').replace(/,/g, ' ');
  if (!/^[\d\s.+*/%()^\-]+$/.test(normalized) || !/\d/.test(normalized)) return null;
  const tokens = normalized.match(/\d*\.?\d+|[()+*/%^\-]/g) || [];
  const compact = normalized.replace(/\s/g, '');
  if (tokens.join('') !== compact) return null;
  let index = 0;
  function primary() {
    if (tokens[index] === '+' || tokens[index] === '-') {
      const sign = tokens[index++] === '-' ? -1 : 1;
      return sign * primary();
    }
    if (tokens[index] === '(') {
      index++;
      const value = expression();
      if (tokens[index++] !== ')') throw new Error('parenthesis');
      return value;
    }
    const token = tokens[index++];
    if (!token || !/^\d*\.?\d+$/.test(token)) throw new Error('number');
    return Number(token);
  }
  function power() {
    const base = primary();
    if (tokens[index] === '^') { index++; return base ** power(); }
    return base;
  }
  function term() {
    let value = power();
    while (['*', '/', '%'].includes(tokens[index])) {
      const op = tokens[index++], right = power();
      if ((op === '/' || op === '%') && right === 0) throw new Error('zero');
      value = op === '*' ? value * right : op === '/' ? value / right : value % right;
    }
    return value;
  }
  function expression() {
    let value = term();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++], right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }
  try {
    const result = expression();
    if (index !== tokens.length || !Number.isFinite(result)) return null;
    return Number(result.toPrecision(10)).toString();
  } catch (_) { return null; }
}

const weatherDescriptions = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'foggy', 48: 'foggy',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers',
  85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorms', 96: 'thunderstorms with hail', 99: 'thunderstorms with hail'
};
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported by this browser.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}
async function getWeather() {
  if (!navigator.onLine) return 'Weather needs an internet connection. Your other basic commands still work offline.';
  let position;
  try { position = await getPosition(); }
  catch (error) {
    if (error.code === 1) return 'Location permission was denied. Allow location access in your browser settings to get local weather.';
    if (error.code === 3) return 'I couldn’t get your location in time. Please try again.';
    return 'I couldn’t get your location. Check that location services are enabled and try again.';
  }
  const { latitude, longitude } = position.coords;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather service unavailable');
    const data = await response.json();
    const current = data.current;
    const description = weatherDescriptions[current.weather_code] || 'current conditions';
    return `It’s ${Math.round(current.temperature_2m)}°C and ${description} near you, with a feels-like temperature of ${Math.round(current.apparent_temperature)}°C and wind at ${Math.round(current.wind_speed_10m)} km/h.`;
  } catch (_) { return 'I couldn’t reach the weather service. Check your connection and try again.'; }
}
function getStoredKey() {
  try { return localStorage.getItem('jarvis-gemini-key') || ''; } catch (_) { return ''; }
}
async function askGemini(prompt) {
  const key = getStoredKey();
  const model = ($('#model-name').value.trim() || localStorage.getItem('jarvis-gemini-model') || 'gemini-2.5-flash');
  if (!key) return 'I can answer basic commands offline. To ask general questions, add your optional Gemini API key in Online AI Configuration.';
  if (!navigator.onLine) return 'Online AI needs an internet connection. Try a time or calculation command while offline.';
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 700 } })
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message;
      if (response.status === 400 || response.status === 403) return `Gemini could not use that key or model${detail ? `: ${detail}` : '.'} Check the key, model name, project access, and free-tier quota in Google AI Studio.`;
      if (response.status === 429) return 'Gemini’s available quota has been reached. Check the project’s free-tier limits and try again later.';
      return `Gemini request failed${detail ? `: ${detail}` : '.'} Check your connection and configuration.`;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    return text || 'Gemini returned no response. Please try again.';
  } catch (_) { return 'I couldn’t connect to Gemini. Check your internet connection and try again.'; }
}

function localIntent(text) {
  const cleaned = text.toLowerCase().replace(/[?!.,]+$/g, '').trim();
  if (/^(help|what can you do|commands|what do you do)$/.test(cleaned) || /\b(help|what can you do)\b/.test(cleaned)) {
    return 'I can tell you the time and date, calculate arithmetic, get local weather with your permission, or open a DuckDuckGo search. Add a Gemini key in settings for optional online questions. Try “calculate 18 times 7” or “search for gold price”.';
  }
  if (/\b(time|clock)\b/.test(cleaned) && !/\b(weather|time zone)\b/.test(cleaned)) {
    return `It’s ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
  }
  if (/\b(date|day|today)\b/.test(cleaned) && !/\bweather\b/.test(cleaned)) {
    return `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  }
  if (/\b(weather|temperature|forecast)\b/.test(cleaned)) return { action: 'weather' };
  const search = cleaned.match(/\b(?:search(?:\s+the\s+web)?\s+for|look\s+up|google)\s+(.+)/);
  if (search) return { action: 'search', query: search[1] };
  const calcMatch = cleaned.match(/\b(?:calculate|compute|what is|what's)\s+(.+)/) || cleaned.match(/\b(\d[\d\s.+*/%()^\-]*(?:times|plus|minus|divided by|over|multiply by|\*|\/|\+|\^|%)\s*[-\d(][\d\s.+*/%()^\-]*)/);
  if (calcMatch) {
    const result = calculate(calcMatch[1]);
    if (result !== null) return `The answer is ${result}.`;
    if (/\b(?:calculate|compute|what is|what's)\b/.test(cleaned)) return 'I couldn’t parse that calculation. Try a format like “calculate 18 times 7” or “what is (12 + 8) divided by 4”.';
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)( jarvis)?$/.test(cleaned)) return 'Hello. How can I help?';
  if (/\b(thank you|thanks)\b/.test(cleaned)) return 'You’re welcome.';
  return null;
}
async function runCommand(rawText, fromVoice = false) {
  const text = rawText.trim();
  if (!text) return;
  addMessage(text, 'user');
  const command = fromVoice ? text.replace(/^\s*hey\s+jarvis[,.!\s]*/i, '').trim() : text;
  if (!command) { answer('I’m listening. What would you like me to do?'); return; }
  const intent = localIntent(command);
  if (typeof intent === 'string') { answer(intent); return; }
  if (intent?.action === 'weather') { answer(await getWeather()); return; }
  if (intent?.action === 'search') {
    answer(`Searching the web for ${intent.query}.`);
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(intent.query)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  const pending = addMessage('One moment while I check that…', 'assistant');
  const reply = await askGemini(command);
  pending.remove();
  answer(reply);
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value;
  input.value = '';
  runCommand(text);
});
document.querySelectorAll('.quick-card').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.command)));
$('#clear-chat').addEventListener('click', () => {
  conversation.innerHTML = '';
  addMessage('Conversation cleared. What can I do for you?');
});

function setListeningState(active, status = '') {
  voiceToggle.classList.toggle('active', active);
  $('#voice-indicator').classList.toggle('listening', active);
  voiceToggle.innerHTML = active ? '<span class="mic-icon" aria-hidden="true">●</span><span>Deactivate voice</span>' : '<span class="mic-icon" aria-hidden="true">⌁</span><span>Activate voice</span>';
  voiceTitle.textContent = active ? 'Listening for “Hey Jarvis”' : 'Voice is standing by';
  voiceStatus.textContent = status || (active ? 'Keep this page open and speak clearly' : 'Activate voice to speak a command');
}
function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const engine = new SpeechRecognition();
  engine.lang = navigator.language || 'en-US';
  engine.continuous = true;
  engine.interimResults = true;
  engine.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const spoken = event.results[i][0].transcript.trim();
      voiceStatus.textContent = spoken ? `Heard: “${spoken}”` : 'Listening for “Hey Jarvis”…';
      if (event.results[i].isFinal) transcript += `${spoken} `;
    }
    transcript = transcript.trim();
    if (transcript && /\bhey\s+jarvis\b/i.test(transcript)) runCommand(transcript, true);
  };
  engine.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      listening = false;
      setListeningState(false, 'Microphone access was denied. Check browser permissions.');
    } else if (event.error === 'audio-capture') {
      voiceStatus.textContent = 'No microphone was found. Check your device settings.';
    } else if (event.error === 'network') {
      voiceStatus.textContent = 'Speech recognition needs a network connection in this browser.';
    }
  };
  engine.onend = () => {
    if (listening && !speaking) setTimeout(() => { try { engine.start(); } catch (_) { /* Recognition is already active. */ } }, 350);
  };
  return engine;
}
voiceToggle.addEventListener('click', () => {
  if (listening) {
    listening = false;
    if (recognition) recognition.stop();
    setListeningState(false);
    return;
  }
  recognition = createRecognition();
  if (!recognition) {
    setListeningState(false, 'Speech recognition is not supported here. Try Chrome on Android or type a command.');
    return;
  }
  listening = true;
  setListeningState(true);
  try { recognition.start(); }
  catch (_) { listening = false; setListeningState(false, 'Could not start the microphone. Try again.'); }
});

function openSettings() {
  $('#api-key').value = getStoredKey();
  try { $('#model-name').value = localStorage.getItem('jarvis-gemini-model') || 'gemini-2.5-flash'; } catch (_) {}
  dialog.showModal();
}
$('#settings-open').addEventListener('click', openSettings);
$('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const key = $('#api-key').value.trim();
    const model = $('#model-name').value.trim() || 'gemini-2.5-flash';
    if (key) localStorage.setItem('jarvis-gemini-key', key);
    else localStorage.removeItem('jarvis-gemini-key');
    localStorage.setItem('jarvis-gemini-model', model);
    dialog.close();
    showToast(key ? 'AI settings saved on this device.' : 'Model setting saved. No API key is configured.');
  } catch (_) { showToast('Could not save settings. Check browser storage permissions.'); }
});
$('#remove-key').addEventListener('click', () => {
  try { localStorage.removeItem('jarvis-gemini-key'); $('#api-key').value = ''; showToast('API key removed from this browser.'); }
  catch (_) { showToast('Could not remove the key from browser storage.'); }
});
$('#reveal-key').addEventListener('click', () => {
  const field = $('#api-key');
  const reveal = field.type === 'password';
  field.type = reveal ? 'text' : 'password';
  $('#reveal-key').textContent = reveal ? 'Hide' : 'Show';
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('#install-button').hidden = false;
});
$('#install-button').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#install-button').hidden = true;
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

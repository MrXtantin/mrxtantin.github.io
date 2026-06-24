/* ============================================
   MISTER X – Global Game Engine
   State management, Avatar AI, TTS, Hints
   ============================================ */

// ─── GAME STATE ───────────────────────────────────────────────────────────────

const MX = {

  TOTAL_STATIONS: 15,

  // Station names (Pfad-Slug → Anzeigename)
  STATIONS: [
    { slug: 'eins',       name: 'Station 1 – Der Auftrag',        icon: '🗂️' },
    { slug: 'zwei',       name: 'Station 2 – Das Versteck',        icon: '🔦' },
    { slug: 'drei',       name: 'Station 3 – Die Spur',            icon: '🧩' },
    { slug: 'vier',       name: 'Station 4 – Die Botschaft',       icon: '📜' },
    { slug: 'fuenf',      name: 'Station 5 – Das Schloss',         icon: '🔐' },
    { slug: 'sechs',      name: 'Station 6 – Der Zeuge',           icon: '👁️' },
    { slug: 'sieben',     name: 'Station 7 – Das Labyrinth',       icon: '🌀' },
    { slug: 'acht',       name: 'Station 8 – Die Zeitkapsel',      icon: '⏳' },
    { slug: 'neun',       name: 'Station 9 – Der Spiegel',         icon: '🪞' },
    { slug: 'zehn',       name: 'Station 10 – Der Schlüssel',      icon: '🗝️' },
    { slug: 'elf',        name: 'Station 11 – Das Signal',         icon: '📡' },
    { slug: 'zwoelf',     name: 'Station 12 – Das Doppelspiel',    icon: '🎭' },
    { slug: 'dreizehn',   name: 'Station 13 – Die Falle',          icon: '🕸️' },
    { slug: 'vierzehn',   name: 'Station 14 – Der letzte Hinweis', icon: '🧭' },
    { slug: 'fuenfzehn',  name: 'Station 15 – Mister X entlarvt!',icon: '🎯' },
  ],

  // ─── State (gespeichert in localStorage) ────────────────────────────────
  state: {
    currentStation: 1,
    completedStations: [],
    stars: 0,
    hintsUsed: 0,
    teacherMode: false,
    startTime: null,
    totalTime: 0,
    playerName: '',
  },

  // ─── init ────────────────────────────────────────────────────────────────
  init() {
    this.loadState();
    this.renderTopbar();
    this.initScrollReveal();
    if (!this.state.startTime) {
      this.state.startTime = Date.now();
      this.saveState();
    }
  },

  // ─── Persistence ─────────────────────────────────────────────────────────
  saveState() {
    localStorage.setItem('mx_state', JSON.stringify(this.state));
  },

  loadState() {
    const raw = localStorage.getItem('mx_state');
    if (raw) {
      try { this.state = { ...this.state, ...JSON.parse(raw) }; } catch(e) {}
    }
  },

  resetState() {
    localStorage.removeItem('mx_state');
    location.href = '/';
  },

  // ─── Station Logic ────────────────────────────────────────────────────────
  completeStation(stationNum, hintsUsedThisRound = 0) {
    if (!this.state.completedStations.includes(stationNum)) {
      this.state.completedStations.push(stationNum);
      // Stars: 3 = no hints, 2 = 1-2 hints, 1 = more
      const earned = hintsUsedThisRound === 0 ? 3 : hintsUsedThisRound <= 2 ? 2 : 1;
      this.state.stars += earned;
      this.state.hintsUsed += hintsUsedThisRound;
      if (stationNum >= this.state.currentStation) {
        this.state.currentStation = stationNum + 1;
      }
      this.saveState();
      return earned;
    }
    return 0;
  },

  isCompleted(stationNum) {
    return this.state.completedStations.includes(stationNum);
  },

  progressPercent() {
    return Math.round((this.state.completedStations.length / this.TOTAL_STATIONS) * 100);
  },

  // ─── Topbar ───────────────────────────────────────────────────────────────
  renderTopbar() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    const pct = this.progressPercent();
    bar.innerHTML = `
      <div class="topbar-logo">MISTER X</div>
      <div style="flex:1; margin: 0 1rem;">
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="font-size:0.7rem; color:var(--c-muted); margin-top:3px; text-align:right;">
          ${this.state.completedStations.length} / ${this.TOTAL_STATIONS} Stationen
        </div>
      </div>
      <div class="star-counter">⭐ ${this.state.stars}</div>
    `;
  },

  // ─── Teacher Mode ─────────────────────────────────────────────────────────
  toggleTeacherMode(pin) {
    const TEACHER_PIN = '1234'; // ← HIER PIN ÄNDERN
    if (pin === TEACHER_PIN) {
      this.state.teacherMode = !this.state.teacherMode;
      this.saveState();
      const panel = document.getElementById('teacherPanel');
      if (panel) panel.classList.toggle('visible', this.state.teacherMode);
      return true;
    }
    return false;
  },

  // ─── Scroll Reveal ────────────────────────────────────────────────────────
  initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  },

};

// ─── AVATAR / AI COMPANION ────────────────────────────────────────────────────

const Avatar = {

  config: {
    name: 'Agent K',
    imgPath: '/assets/img/avatar.png', // eigenes Bild hinterlegen
    voice: null,        // Web Speech API voice
    apiEnabled: false,  // true = Anthropic API nutzen
    apiKey: '',         // NIEMALS im Code speichern – über Server-Proxy!
  },

  // Zeigt eine Nachricht (lokal oder per API)
  async speak(text, targetId = 'avatarBubble') {
    const bubble = document.getElementById(targetId);
    if (!bubble) return;
    bubble.classList.add('typing');
    bubble.textContent = '';
    await this._delay(900);
    bubble.classList.remove('typing');
    this._typewriter(bubble, text);
    this.tts(text);
  },

  // Typewriter-Effekt
  _typewriter(el, text, speed = 22) {
    let i = 0;
    el.textContent = '';
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(tick, speed);
      }
    };
    tick();
  },

  // Text-to-Speech (Web Speech API)
  tts(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang   = 'de-DE';
    utterance.rate   = 0.95;
    utterance.pitch  = 1.05;
    if (this.config.voice) utterance.voice = this.config.voice;
    speechSynthesis.speak(utterance);
  },

  // Stimmen laden (muss nach user interaction)
  loadVoices() {
    const voices = speechSynthesis.getVoices();
    const de = voices.find(v => v.lang.startsWith('de') && v.localService);
    if (de) this.config.voice = de;
  },

  // Optional: Anthropic API-Call (via Server-Proxy!)
  async askAI(userMessage, systemContext = '') {
    if (!this.config.apiEnabled) return null;
    try {
      const res = await fetch('/api/avatar', {   // ← eigener Proxy-Endpoint!
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context: systemContext })
      });
      const data = await res.json();
      return data.reply || null;
    } catch(e) {
      console.warn('AI not available:', e);
      return null;
    }
  },

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); },

};

// ─── HINT SYSTEM ──────────────────────────────────────────────────────────────

const Hints = {

  used: 0,

  init() {
    document.querySelectorAll('.hint-toggle').forEach(btn => {
      btn.addEventListener('click', () => this.toggle(btn));
    });
  },

  toggle(btn) {
    const body = btn.nextElementSibling;
    const isOpen = btn.classList.contains('open');
    if (!isOpen) {
      this.used++;
      const idx = parseInt(btn.dataset.hint || 0);
      MX.state.hintsUsed++;
      MX.saveState();
    }
    btn.classList.toggle('open', !isOpen);
    body.classList.toggle('open', !isOpen);
  },

};

// ─── CODE CHECKER ─────────────────────────────────────────────────────────────

const CodeChecker = {

  // Prüft Antwort (case-insensitive, leerzeichen-tolerant)
  check(input, answer) {
    const clean = str => str.trim().toLowerCase().replace(/\s+/g, '');
    return clean(input) === clean(answer);
  },

  // Schüttelt Animation bei Fehler
  shake(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake 0.4s ease';
  },

  // Digit-Input Navigation (Zahlen-Code)
  initDigitInputs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const inputs = container.querySelectorAll('.code-digit');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', (e) => {
        inp.value = inp.value.replace(/\D/g,'').slice(-1);
        if (inp.value && i < inputs.length - 1) inputs[i+1].focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i-1].focus();
      });
    });
  },

  getDigitValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    return Array.from(container.querySelectorAll('.code-digit')).map(i => i.value).join('');
  },

};

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────

const Success = {

  show(stationNum, stars, nextSlug, message = '') {
    const overlay = document.getElementById('successOverlay');
    if (!overlay) return;

    const starIcons = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    overlay.innerHTML = `
      <div class="success-icon">🎉</div>
      <h2 style="font-family:var(--font-head); color:var(--c-accent); text-align:center;">
        Station ${stationNum} gelöst!
      </h2>
      <div style="font-size:1.8rem; letter-spacing:0.2em;">${starIcons}</div>
      <p style="text-align:center; max-width:280px;">${message || 'Gut gemacht, Agent! Weiter zur nächsten Station.'}</p>
      <a href="/station/${nextSlug}" class="btn btn-primary btn-full" style="max-width:300px;">
        Weiter →
      </a>
    `;
    overlay.classList.add('show');
  },

  hide() {
    document.getElementById('successOverlay')?.classList.remove('show');
  },

};

// ─── QR SCANNER (via jsQR) ────────────────────────────────────────────────────

const QRScanner = {

  stream: null,

  async start(videoId, canvasId, onResult) {
    const video  = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    if (!video || !canvas) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = this.stream;
      video.play();
      this._scan(video, canvas, onResult);
    } catch(e) {
      console.warn('Kamera nicht verfügbar:', e);
    }
  },

  _scan(video, canvas, onResult) {
    const ctx = canvas.getContext('2d');
    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR?.(img.data, img.width, img.height);
        if (code) { onResult(code.data); return; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  },

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  },

};

// ─── CSS SHAKE KEYFRAME (inject) ──────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(6px)}
  }
`;
document.head.appendChild(_style);

// ─── AUTO INIT ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  MX.init();
  Hints.init();
  Avatar.loadVoices();
  speechSynthesis?.addEventListener?.('voiceschanged', () => Avatar.loadVoices());
});

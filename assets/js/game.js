cat > /home/claude/misterx/assets/js/game.js << 'JSEOF'
/* ============================================
   MISTER X – Game Engine v2
   State, Avatar+TTS, Hints, CodeChecker
   ============================================ */

// ─── GAME STATE ─────────────────────────────────────────────────────────────
const MX = {
  TOTAL_STATIONS: 15,
  STATIONS: [
    { slug:'eins',      name:'Station 1 – Der Auftrag',        icon:'🗂️' },
    { slug:'zwei',      name:'Station 2 – Das Versteck',        icon:'🔦' },
    { slug:'drei',      name:'Station 3 – Die Spur',            icon:'🧩' },
    { slug:'vier',      name:'Station 4 – Die Botschaft',       icon:'📜' },
    { slug:'fuenf',     name:'Station 5 – Das Schloss',         icon:'🔐' },
    { slug:'sechs',     name:'Station 6 – Der Zeuge',           icon:'👁️' },
    { slug:'sieben',    name:'Station 7 – Das Labyrinth',       icon:'🌀' },
    { slug:'acht',      name:'Station 8 – Die Zeitkapsel',      icon:'⏳' },
    { slug:'neun',      name:'Station 9 – Der Spiegel',         icon:'🪞' },
    { slug:'zehn',      name:'Station 10 – Der Schlüssel',      icon:'🗝️' },
    { slug:'elf',       name:'Station 11 – Das Signal',         icon:'📡' },
    { slug:'zwoelf',    name:'Station 12 – Das Doppelspiel',    icon:'🎭' },
    { slug:'dreizehn',  name:'Station 13 – Die Falle',          icon:'🕸️' },
    { slug:'vierzehn',  name:'Station 14 – Der letzte Hinweis', icon:'🧭' },
    { slug:'fuenfzehn', name:'Station 15 – Mister X entlarvt!',icon:'🎯' },
  ],
  state: {
    currentStation: 1,
    completedStations: [],
    stars: 0, hintsUsed: 0,
    teacherMode: false,
    startTime: null,
    playerName: '',
  },

  init() {
    this.loadState();
    this.renderTopbar();
    this.initScrollReveal();
    if (!this.state.startTime) { this.state.startTime = Date.now(); this.saveState(); }
  },
  saveState() { localStorage.setItem('mx_state', JSON.stringify(this.state)); },
  loadState() {
    const raw = localStorage.getItem('mx_state');
    if (raw) { try { this.state = {...this.state, ...JSON.parse(raw)}; } catch(e){} }
  },
  resetState() { localStorage.removeItem('mx_state'); location.href = '/'; },

  completeStation(num, hintsUsed = 0) {
    if (!this.state.completedStations.includes(num)) {
      this.state.completedStations.push(num);
      const earned = hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1;
      this.state.stars += earned;
      this.state.hintsUsed += hintsUsed;
      if (num >= this.state.currentStation) this.state.currentStation = num + 1;
      this.saveState();
      return earned;
    }
    return 0;
  },
  isCompleted(num) { return this.state.completedStations.includes(num); },
  progressPercent() { return Math.round((this.state.completedStations.length / this.TOTAL_STATIONS) * 100); },

  renderTopbar() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    const pct = this.progressPercent();
    bar.innerHTML = `
      <div class="topbar-logo">MISTER X</div>
      <div style="flex:1; margin:0 0.75rem;">
        <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div style="font-size:0.65rem; color:var(--c-dim); margin-top:3px; text-align:right;">
          ${this.state.completedStations.length}/${this.TOTAL_STATIONS}
        </div>
      </div>
      <div class="star-counter">⭐ ${this.state.stars}</div>`;
  },

  toggleTeacherMode(pin) {
    if (pin === '1234') {
      this.state.teacherMode = !this.state.teacherMode;
      this.saveState();
      document.getElementById('teacherPanel')?.classList.toggle('visible', this.state.teacherMode);
      return true;
    }
    return false;
  },

  initScrollReveal() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  },
};

// ─── AVATAR + TTS ────────────────────────────────────────────────────────────
const Avatar = {
  _voices: [],
  _deVoice: null,
  _speaking: false,

  // Muss nach einem echten User-Klick aufgerufen werden!
  loadVoices() {
    const load = () => {
      this._voices = speechSynthesis.getVoices();
      this._deVoice = this._voices.find(v => v.lang.startsWith('de') && v.localService)
                   || this._voices.find(v => v.lang.startsWith('de'))
                   || null;
    };
    load();
    speechSynthesis.onvoiceschanged = load;
  },

  // Spricht den Text laut (browser TTS) + Typewriter in Bubble
  speak(text, bubbleId = 'avatarBubble') {
    const bubble = document.getElementById(bubbleId);
    if (bubble) {
      // Typing dots
      bubble.className = 'avatar-bubble typing';
      bubble.innerHTML = '<div class="dot-typing"><span></span><span></span><span></span></div>';
      setTimeout(() => {
        bubble.className = 'avatar-bubble';
        this._typewriter(bubble, text);
      }, 800);
    }
    this._tts(text);

    // Speak-Button animieren
    const btn = document.getElementById('speakBtn');
    if (btn) {
      btn.classList.add('talking');
      btn.querySelector('.speaker-wave').textContent = '🔊';
    }
  },

  _typewriter(el, text, speed = 20) {
    let i = 0;
    el.textContent = '';
    const tick = () => { if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); }
      else {
        const btn = document.getElementById('speakBtn');
        if (btn) { btn.classList.remove('talking'); btn.querySelector('.speaker-wave').textContent = '🔈'; }
      }
    };
    tick();
  },

  _tts(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = 'de-DE';
    utt.rate  = 0.92;
    utt.pitch = 1.1;
    if (this._deVoice) utt.voice = this._deVoice;
    utt.onend = () => {
      const btn = document.getElementById('speakBtn');
      if (btn) { btn.classList.remove('talking'); }
    };
    // iOS Safari: muss synchron nach User-Event starten
    speechSynthesis.speak(utt);
  },

  stop() {
    speechSynthesis.cancel();
    const btn = document.getElementById('speakBtn');
    if (btn) btn.classList.remove('talking');
  },
};

// ─── HINTS ──────────────────────────────────────────────────────────────────
const Hints = {
  init() {
    document.querySelectorAll('.hint-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.nextElementSibling;
        const open = btn.classList.toggle('open');
        body.classList.toggle('open', open);
        if (open) { MX.state.hintsUsed++; MX.saveState(); }
      });
    });
  },
};

// ─── CODE CHECKER ────────────────────────────────────────────────────────────
const CodeChecker = {
  check(input, answer) {
    const c = s => s.trim().toLowerCase().replace(/\s+/g,'');
    return c(input) === c(answer);
  },
  shake(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
  },
  initDigitInputs(containerId) {
    const inputs = document.querySelectorAll(`#${containerId} .code-digit`);
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/,'').slice(-1);
        if (inp.value && i < inputs.length - 1) inputs[i+1].focus();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i-1].focus();
      });
    });
  },
  getDigitValue(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .code-digit`)).map(i => i.value).join('');
  },
};

// ─── SUCCESS ─────────────────────────────────────────────────────────────────
const Success = {
  show(num, stars, nextSlug, msg = '') {
    const o = document.getElementById('successOverlay');
    if (!o) return;
    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    o.innerHTML = `
      <div class="success-icon">🎉</div>
      <h2 style="font-family:var(--fh);background:linear-gradient(135deg,var(--gold),var(--cyan));
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                 background-clip:text;text-align:center;">Station ${num} gelöst!</h2>
      <div style="font-size:2rem;letter-spacing:0.2em;">${starStr}</div>
      <p style="text-align:center;max-width:280px;color:var(--c-dim);">${msg || 'Gut gemacht, Agent!'}</p>
      <a href="/station/${nextSlug}"
         class="btn btn-primary btn-full"
         style="max-width:300px;"
         onclick="Avatar.stop()">Weiter zur nächsten Station →</a>`;
    o.classList.add('show');
    Avatar.speak(`Fantastisch! Station ${num} abgehakt. Weiter geht es!`);
  },
};

// ─── QR SCANNER ──────────────────────────────────────────────────────────────
const QRScanner = {
  stream: null,
  async start(videoId, canvasId, onResult) {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    if (!video || !canvas) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = this.stream; video.play();
      const tick = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR?.(img.data, img.width, img.height);
          if (code) { onResult(code.data); return; }
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch(e) { console.warn('Kamera:', e); }
  },
  stop() { this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; },
};

// ─── BOOT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  MX.init();
  Hints.init();
  Avatar.loadVoices();
  if (MX.state.teacherMode) document.getElementById('teacherPanel')?.classList.add('visible');
  // Scan-line background effect
  const sl = document.createElement('div');
  sl.className = 'scan-line';
  document.body.appendChild(sl);
});
JSEOF
echo "JS written: $(wc -l < /home/claude/misterx/assets/js/game.js) lines"

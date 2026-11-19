/** Original eight-bar "Pinewood Passage" score, synthesized entirely in the browser. */
export function createAudio() {
  let volume = 0.5;
  let context: AudioContext | undefined;
  let output: GainNode | undefined;
  let music: BiquadFilterNode | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let enabled = false;
  let windGain: GainNode | undefined;
  let windFilter: BiquadFilterNode | undefined;
  let destroyed = false;
  let nextNote = 0;
  let step = 0;
  const eighth = 60 / 92 / 2;
  const melody = [
    74, 0, 69, 72, 74, 0, 77, 76,
    72, 0, 67, 69, 72, 0, 76, 74,
    71, 0, 74, 76, 79, 0, 76, 74,
    73, 0, 69, 71, 73, 0, 76, 0,
    74, 77, 81, 0, 79, 77, 76, 74,
    76, 0, 72, 74, 76, 0, 79, 0,
    79, 0, 74, 76, 77, 76, 74, 71,
    73, 0, 76, 0, 74, 0, 0, 0,
  ];
  const roots = [50, 48, 43, 45, 50, 48, 43, 45];
  const frequencies = (note: number) => 440 * 2 ** ((note - 69) / 12);

  function tone(note: number, at: number, length: number, volume: number, wave: OscillatorType = 'triangle', bend?: number) {
    if (!context || !output || !music) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequencies(note), at);
    if (bend !== undefined) oscillator.frequency.exponentialRampToValueAtTime(frequencies(bend), at + length);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(envelope);
    envelope.connect(music);
    oscillator.start(at);
    oscillator.stop(at + length + 0.03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  function schedule() {
    if (!context || !enabled || document.hidden || destroyed) return;
    if (nextNote < context.currentTime - 0.2) nextNote = context.currentTime + 0.025;
    while (nextNote < context.currentTime + 0.18) {
      const beat = step % 8;
      const root = roots[Math.floor(step / 8) % roots.length];
      if (melody[step]) tone(melody[step], nextNote, eighth * 1.4, 0.14, 'triangle');
      if (beat % 4 === 0) tone(root, nextNote, eighth * 3.5, 0.18);
      const interval = [12, 19, 24, 19][beat % 4];
      tone(root + interval, nextNote, eighth * 0.8, 0.027, 'square');
      step = (step + 1) % melody.length;
      nextNote += eighth;
    }
  }

  function silence() {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (context && output) {
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setTargetAtTime(0, context.currentTime, 0.025);
    }
  }

  async function start() {
    if (!context || !output || destroyed || !enabled || document.hidden) return;
    await context.resume();
    if (destroyed || !enabled || document.hidden) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(volume * 0.32, context.currentTime, 0.04);
    nextNote = context.currentTime + 0.04;
    if (!timer) timer = setInterval(schedule, 90);
    schedule();
  }

  const visibility = () => {
    if (document.hidden) silence();
    else if (enabled) void start().catch(silence);
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);

  return {
    setVolume(value: number) { volume = Math.max(0, Math.min(1, value)); if(context && output && enabled) output.gain.setTargetAtTime(volume * 0.32, context.currentTime, 0.04); },
    async setEnabled(value: boolean) {
      if (destroyed || typeof window === 'undefined') return;
      enabled = value;
      if (!value) { silence(); return; }
      if (!context) {
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) { enabled = false; return; }
        context = new Constructor();
        output = context.createGain();
        output.gain.value = 0;
        music = context.createBiquadFilter();
        music.type = 'lowpass';
        music.frequency.value = 2600;
        music.Q.value = 0.3;
        music.connect(output);
        output.connect(context.destination);
      }
      await start();
    },
    /** Wind and snow-scrape bed driven by the ride itself; works even with the music off. */
    setMotion(kmh: number, skid: number, airborne: boolean) {
      if (destroyed || typeof window === 'undefined' || document.hidden) return;
      if (!context) {
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        context = new Constructor();
        output = context.createGain();
        output.gain.value = 0;
        music = context.createBiquadFilter();
        music.type = 'lowpass';
        music.frequency.value = 2600;
        music.Q.value = 0.3;
        music.connect(output);
        output.connect(context.destination);
      }
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      if (!windGain) {
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = context.createBufferSource(); src.buffer = buffer; src.loop = true;
        windFilter = context.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.Q.value = 0.7; windFilter.frequency.value = 400;
        windGain = context.createGain(); windGain.gain.value = 0;
        src.connect(windFilter); windFilter.connect(windGain); windGain.connect(context.destination); src.start();
      }
      const t = context.currentTime, v = Math.min(1, kmh / 110), scrape = airborne ? 0 : Math.min(1, skid * 1.4) * Math.min(1, kmh / 30);
      windGain.gain.setTargetAtTime(volume * (0.02 + 0.22 * v * v + 0.12 * scrape), t, 0.12);
      windFilter!.frequency.setTargetAtTime(300 + 1500 * v + 900 * scrape, t, 0.12);
    },
    playEffect(kind: 'jump' | 'land' | 'trick' | 'crash') {
      if (!context || !enabled || document.hidden || destroyed) return;
      const now = context.currentTime;
      if (kind === 'jump') tone(57, now, 0.16, 0.16, 'triangle', 81);
      if (kind === 'land') tone(45, now, 0.11, 0.2, 'triangle', 32);
      if (kind === 'trick') [74, 78, 81].forEach((note, i) => tone(note, now + i * 0.055, 0.2, 0.12));
      if (kind === 'crash') { tone(52, now, 0.4, 0.16, 'sawtooth', 28); tone(53, now, 0.3, 0.08, 'triangle', 29); }
    },
    destroy() {
      destroyed = true;
      enabled = false;
      silence();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
      if (context && context.state !== 'closed') void context.close();
    },
  };
}

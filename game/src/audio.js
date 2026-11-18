// SOLMARA — synthesized sound and music.
// Everything is made with the Web Audio API: an engine hum that follows the
// car's speed, a two-tone police siren, gunshots, thuds, blips and a simple
// bass-and-hats music loop. No audio files. Nothing plays until the player
// has pressed a key or clicked, because browsers demand a gesture first.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let musicOn = false;

  // Build the graph on the first user gesture.
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A short bassline with a hat tick, one step every 140 ms.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  function musicTick() {
    if (!ctx || muted || !musicOn) return;
    const note = BASS[musicStep % BASS.length];
    musicStep += 1;
    if (note > 0) blip(note, 0.16, 'square', 0.10);
    if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
    if (musicStep % 16 === 0) blip(220, 0.3, 'sine', 0.05, 330);
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // The engine hum follows speed 0..1; silent on foot or parked.
    setEngine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.03 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
    },
    // The siren wails while the player is wanted.
    setSiren(on, time) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, ctx.currentTime, 0.1);
      if (on) sirenOsc.frequency.value = 660 + Math.sin(time * 5) * 220;
    },
    startMusic() {
      if (musicOn || !ensure()) return;
      musicOn = true;
      musicTimer = window.setInterval(musicTick, 140);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    shot() {
      noise(0.14, 0.5, 2800);
      blip(190, 0.09, 'square', 0.25, 60);
    },
    punch() {
      noise(0.09, 0.35, 500);
      blip(120, 0.08, 'sine', 0.3, 55);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      window.setTimeout(() => blip(990, 0.12, 'sine', 0.22), 70);
    },
    doorSlam() {
      noise(0.08, 0.3, 700);
      blip(90, 0.1, 'sine', 0.3, 45);
    },
    horn() {
      blip(370, 0.22, 'square', 0.12);
      blip(466, 0.22, 'square', 0.1);
    },
    crash() {
      noise(0.3, 0.5, 900);
    },
    mission() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => window.setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    // A cash-register cha-ching for paydays.
    cash() {
      blip(1320, 0.07, 'square', 0.14);
      window.setTimeout(() => blip(1760, 0.14, 'square', 0.14), 80);
    },
    busted() {
      const notes = [392, 330, 262, 196];
      notes.forEach((n, i) => window.setTimeout(() => blip(n, 0.3, 'sawtooth', 0.14), i * 150));
    },
    click() {
      blip(880, 0.05, 'sine', 0.15);
    },
  };
}

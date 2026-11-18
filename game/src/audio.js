// audio.js — every sound in SOLMARA, synthesized live with WebAudio.
// One file, one job: no audio files, no network, just oscillators and
// filtered noise. The music is a laid-back bass-and-hats groove in A
// minor that loops forever; the effects are short synth blips: gunshots,
// pickups, sirens, engine hum, mission fanfare. Everything is guarded:
// if the browser has no AudioContext (or it is suspended before the
// first click), the game plays silently instead of crashing.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let musicTimer = null;
  let noiseBuffer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let step = 0;
  let nextNoteTime = 0;

  // A minor groove: root notes per bar, hats on the off-beats.
  const BASS_LINE = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 82.41, 65.41, 0, 73.42, 65.41, 49];
  const STEP_SECONDS = 0.21;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch (err) {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function scheduleStep(when) {
    if (!ctx) return;
    const bassFreq = BASS_LINE[step % BASS_LINE.length];
    if (bassFreq > 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bassFreq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.5, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + STEP_SECONDS * 0.95);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(when);
      osc.stop(when + STEP_SECONDS);
    }
    // Hat on every step, louder on the off-beats.
    const hat = ctx.createBufferSource();
    hat.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const hg = ctx.createGain();
    const loud = step % 2 === 1 ? 0.12 : 0.05;
    hg.gain.setValueAtTime(loud, when);
    hg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    hat.connect(hp);
    hp.connect(hg);
    hg.connect(musicGain);
    hat.start(when);
    hat.stop(when + 0.06);
    step++;
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    resume();
    nextNoteTime = ctx.currentTime + 0.05;
    musicTimer = setInterval(() => {
      if (!ctx) return;
      while (nextNoteTime < ctx.currentTime + 0.25) {
        scheduleStep(nextNoteTime);
        nextNoteTime += STEP_SECONDS;
      }
    }, 90);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || !ctx) return;
    resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || !ctx) return;
    resume();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    // Call on the first user gesture (click / key) and once at boot.
    unlock() {
      resume();
      startMusic();
    },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noiseBurst(0.12, 0.5, 1800);
      blip(220, 0.08, 'square', 0.18, 60);
    },
    enemyShoot() {
      noiseBurst(0.1, 0.25, 1200);
    },
    pickup() {
      blip(660, 0.1, 'sine', 0.3);
      setTimeout(() => blip(990, 0.14, 'sine', 0.3), 90);
    },
    cash() {
      blip(880, 0.09, 'triangle', 0.3);
      setTimeout(() => blip(1174, 0.09, 'triangle', 0.3), 80);
      setTimeout(() => blip(1568, 0.18, 'triangle', 0.3), 160);
    },
    crash() {
      noiseBurst(0.25, 0.5, 500);
    },
    bust() {
      blip(330, 0.25, 'sawtooth', 0.25, 110);
      setTimeout(() => blip(220, 0.4, 'sawtooth', 0.25, 90), 200);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.32), i * 110));
    },
    missionStart() {
      blip(440, 0.12, 'triangle', 0.28);
      setTimeout(() => blip(587, 0.16, 'triangle', 0.28), 110);
    },
    door() {
      blip(180, 0.12, 'square', 0.2, 320);
    },
    // A continuous engine hum whose pitch follows the car's speed.
    engine(speed01) {
      if (!ensure() || !ctx) return;
      resume();
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        engineOsc.connect(lp);
        lp.connect(engineGain);
        engineGain.connect(sfxGain);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
    },
    // The police two-tone siren, on while wanted >= 1, off otherwise.
    siren(on) {
      if (!ensure() || !ctx) return;
      if (on && !sirenOsc) {
        resume();
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 720;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(sfxGain);
        sirenOsc.start();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.8;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc._lfo.stop();
          sirenOsc.stop();
        } catch (err) { /* already stopped */ }
        sirenOsc = null;
      }
    },
    stop() {
      stopMusic();
      this.siren(false);
      if (engineOsc) {
        try { engineOsc.stop(); } catch (err) { /* already stopped */ }
        engineOsc = null;
      }
    },
  };
}

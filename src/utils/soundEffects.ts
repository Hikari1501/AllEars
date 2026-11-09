// Cheerful, crystal-clear celebratory sound effect using the Web Audio API
// Synthesizes pleasant harmonic chimes with zero external file dependencies

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('AudioContext initialization note:', err);
    return null;
  }
}

/**
 * Plays a cheerful 3-note ascending victory chime (C5 -> E5 -> G5)
 * Triggered on student device whenever all correct answers are achieved for a question.
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + 0.02;

    // Harmonic arpeggio: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
    const tones = [
      { freq: 523.25, timeOffset: 0.00, duration: 0.12, volume: 0.18 },
      { freq: 659.25, timeOffset: 0.08, duration: 0.14, volume: 0.20 },
      { freq: 783.99, timeOffset: 0.17, duration: 0.35, volume: 0.24 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, startTime + tone.timeOffset);

      // Smooth attack and pleasant exponential decay
      const noteStart = startTime + tone.timeOffset;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(tone.volume, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + tone.duration + 0.05);
    });
  } catch (e) {
    console.warn('Could not play success audio chime:', e);
  }
}

/**
 * Plays a gentle, descending two-tone cue (261Hz -> 196Hz)
 * Triggered on student device whenever an incorrect answer is submitted.
 */
export function playWrongAnswerSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + 0.02;

    // Subdued descending tones: C4 (261.63Hz) -> G3 (196.00Hz)
    const tones = [
      { freq: 261.63, timeOffset: 0.00, duration: 0.12, volume: 0.15 },
      { freq: 196.00, timeOffset: 0.10, duration: 0.22, volume: 0.16 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Softer, warmer waveform for gentle feedback
      osc.frequency.setValueAtTime(tone.freq, startTime + tone.timeOffset);

      const noteStart = startTime + tone.timeOffset;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(tone.volume, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + tone.duration + 0.05);
    });
  } catch (e) {
    console.warn('Could not play wrong answer sound:', e);
  }
}

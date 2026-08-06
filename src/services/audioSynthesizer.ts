// Web Audio API Synthesizer for Phone Ringtones and Call Chimes
class CallAudioSynthesizer {
  private audioCtx: AudioContext | null = null;
  private ringInterval: number | null = null;
  private isPlayingRingtone = false;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play incoming ringtone (repeating dual-tone beep melody)
  public startIncomingRingtone() {
    if (this.isPlayingRingtone) return;
    this.isPlayingRingtone = true;

    const playRingtoneBurst = () => {
      if (!this.isPlayingRingtone) return;
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Dual frequency ringtone tone (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.setValueAtTime(0.2, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      } catch (err) {
        console.warn('Ringtone play error:', err);
      }
    };

    playRingtoneBurst();
    this.ringInterval = window.setInterval(playRingtoneBurst, 2500);
  }

  // Play outgoing dialing ring (classic US/Middle East phone ring: 440+480Hz 2sec on, 4sec off)
  public startOutgoingRing() {
    if (this.isPlayingRingtone) return;
    this.isPlayingRingtone = true;

    const playOutgoingBurst = () => {
      if (!this.isPlayingRingtone) return;
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 1.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      } catch (err) {
        console.warn('Outgoing ring error:', err);
      }
    };

    playOutgoingBurst();
    this.ringInterval = window.setInterval(playOutgoingBurst, 4000);
  }

  // Stop any active ringtone or dialing sound
  public stopRingtone() {
    this.isPlayingRingtone = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  // Play busy tone (480Hz + 620Hz, 0.5s on, 0.5s off 3 times)
  public playBusyTone() {
    try {
      this.stopRingtone();
      const ctx = this.getContext();
      let delay = 0;
      for (let i = 0; i < 3; i++) {
        const now = ctx.currentTime + delay;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(480, now);
        osc2.frequency.setValueAtTime(620, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.setValueAtTime(0.2, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);

        delay += 0.8;
      }
    } catch (e) {
      console.warn('Busy tone error', e);
    }
  }

  // Play brief chime when call connects
  public playCallConnectedChime() {
    try {
      this.stopRingtone();
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Connected chime error', e);
    }
  }

  // Play brief tone when call ends
  public playCallEndedChime() {
    try {
      this.stopRingtone();
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(350, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('End call chime error', e);
    }
  }
}

export const soundSynth = new CallAudioSynthesizer();

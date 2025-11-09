// ============================================================================
// DEMENTIA - Generative Sound System
// ============================================================================
// Persistent harmonic drone that degrades from Day 1 (clear) to Day 31 (distant)
// The memory of the sound remains, but the experience changes
// ============================================================================

class DementiaSound {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.oscillators = [];
        this.filters = [];
        this.reverbNode = null;
        this.noiseNode = null;
        this.isPlaying = false;
        this.currentDay = 1;

        // Melodic pattern - gentle, memorable progression
        // Like a music box or lullaby
        // Based on C major scale with some extensions
        this.melodyNotes = [
            { freq: 261.63, duration: 2.0 },  // C4
            { freq: 329.63, duration: 1.5 },  // E4
            { freq: 392.00, duration: 1.5 },  // G4
            { freq: 329.63, duration: 1.0 },  // E4
            { freq: 293.66, duration: 2.0 },  // D4
            { freq: 261.63, duration: 2.0 },  // C4
            { freq: 220.00, duration: 3.0 },  // A3
            { freq: 261.63, duration: 2.5 },  // C4
        ];

        // Ambient pad frequencies for warmth (always playing)
        this.padFrequencies = [
            130.81,  // C3
            164.81,  // E3
            196.00,  // G3
        ];
    }

    async init() {
        if (this.audioContext) {
            console.log('Audio context already initialized');
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Audio context created, state:', this.audioContext.state);

            // Resume audio context if suspended (required by browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            }

            // Master gain control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.2; // Increased from 0.15 for better audibility
            this.masterGain.connect(this.audioContext.destination);

            // Create reverb
            await this.createReverb();

            console.log('Sound system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    async createReverb() {
        // Create convolution reverb using impulse response
        this.reverbNode = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();

        // Create simple impulse response (simulates room reverb)
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 3; // 3 second reverb
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        this.reverbNode.buffer = impulse;
        this.reverbGain.connect(this.audioContext.destination);
        this.reverbNode.connect(this.reverbGain);
    }

    // Removed noise generator - keeping it clean and melodic

    getSoundParams(day) {
        // Progressive parameters based on day (1-31)
        // NO distortion - just gentle clarity loss
        const t = (day - 1) / 30;
        const easeIn = t * t * t;
        const easeOut = 1 - Math.pow(1 - t, 2);
        const easeMix = t * t * (3 - 2 * t);

        return {
            // Filter: Clear -> Slightly muffled (NOT harsh)
            filterFrequency: 12000 - easeOut * 8000,     // 12000Hz -> 4000Hz (still bright)
            filterQ: 0.7,                                 // Gentle, no resonance

            // Detune: Very subtle drift
            detuneAmount: 0 + easeMix * 5,                // 0 -> 5 cents (barely noticeable)
            detuneSpeed: 0.05 + easeOut * 0.15,           // Very slow drift

            // Reverb: Close -> Distant (main degradation)
            reverbMix: 0.1 + easeIn * 0.65,               // 10% -> 75% wet
            reverbDecay: 0.5 + easeIn * 2.5,              // 0.5s -> 3s decay

            // Overall presence: Clear -> Soft distant
            dryGain: 1.0 - easeOut * 0.5,                 // 100% -> 50% (still audible)
            melodyGain: 0.3 - easeOut * 0.1,              // Melody stays gentle

            // Vibrato: Subtle warmth
            vibratoDepth: 0.3 + easeMix * 0.7,            // Gentle throughout
            vibratoSpeed: 1.5 + easeOut * 1.0,            // 1.5Hz -> 2.5Hz (slow)

            // Melody timing: Normal -> Slightly slower
            playbackRate: 1.0 - easeIn * 0.2,             // 1.0 -> 0.8 (gentle time stretch)
        };
    }

    async start(day = 1) {
        if (this.isPlaying) {
            console.log('Sound already playing, updating to day', day);
            this.updateDay(day);
            return;
        }

        if (!this.audioContext) {
            console.error('Audio context not initialized. Call init() first.');
            return;
        }

        // Resume context if needed (browser requirement)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('Audio context resumed on start');
        }

        this.currentDay = day;
        this.isPlaying = true;

        console.log('Starting sound for day', day);

        const params = this.getSoundParams(day);
        const now = this.audioContext.currentTime;

        // Create ambient pad (soft background)
        this.padFrequencies.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            const lfo = this.audioContext.createOscillator(); // For vibrato
            const lfoGain = this.audioContext.createGain();

            // Pad oscillator setup
            osc.type = 'sine'; // Warm, soft pad
            osc.frequency.value = freq;

            // LFO for gentle vibrato
            lfo.type = 'sine';
            lfo.frequency.value = params.vibratoSpeed * 0.5; // Slower for pad
            lfoGain.gain.value = params.vibratoDepth * 0.5;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Gentle filter
            filter.type = 'lowpass';
            filter.frequency.value = params.filterFrequency;
            filter.Q.value = params.filterQ;

            // Soft volume
            const volume = 0.06 / this.padFrequencies.length; // Very subtle
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(volume * params.dryGain, now + 3.0);

            // Connect
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            // Reverb for warmth
            const reverbGain = this.audioContext.createGain();
            reverbGain.gain.value = params.reverbMix * 0.7;
            filter.connect(reverbGain);
            reverbGain.connect(this.reverbNode);

            osc.start(now);
            lfo.start(now);

            this.oscillators.push({
                osc, lfo, gain, filter, reverbGain, lfoGain,
                baseFreq: freq,
                detuneOffset: Math.random() * Math.PI * 2,
                isPad: true
            });
        });

        // Start melodic pattern
        this.playMelody(params);

        // Start detune modulation
        this.startDetuneModulation();

        console.log(`Sound started for Day ${day}`, params);
    }

    playMelody(params) {
        // Play the melodic pattern in a loop
        let currentTime = this.audioContext.currentTime + 1.0; // Start after 1 second

        const playNote = (noteIndex) => {
            if (!this.isPlaying) return;

            const note = this.melodyNotes[noteIndex];
            const nextNoteIndex = (noteIndex + 1) % this.melodyNotes.length;

            // Create oscillator for this note
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            // Bell-like tone
            osc.type = 'sine';
            osc.frequency.value = note.freq;

            // Filter
            filter.type = 'lowpass';
            filter.frequency.value = params.filterFrequency;
            filter.Q.value = params.filterQ;

            // ADSR envelope (gentle)
            const noteDuration = note.duration * params.playbackRate;
            const attackTime = 0.1;
            const decayTime = 0.2;
            const sustainLevel = params.melodyGain * 0.7;
            const releaseTime = 0.5;

            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(params.melodyGain, currentTime + attackTime);
            gain.gain.linearRampToValueAtTime(sustainLevel, currentTime + attackTime + decayTime);
            gain.gain.setValueAtTime(sustainLevel, currentTime + noteDuration - releaseTime);
            gain.gain.linearRampToValueAtTime(0, currentTime + noteDuration);

            // Connect
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            // Reverb
            const reverbGain = this.audioContext.createGain();
            reverbGain.gain.value = params.reverbMix;
            filter.connect(reverbGain);
            reverbGain.connect(this.reverbNode);

            // Play
            osc.start(currentTime);
            osc.stop(currentTime + noteDuration);

            // Schedule next note
            currentTime += noteDuration;
            setTimeout(() => playNote(nextNoteIndex), noteDuration * 1000);
        };

        // Start the melody
        playNote(0);
    }

    startDetuneModulation() {
        // Slowly modulate detune for organic, breathing quality
        const modulate = () => {
            if (!this.isPlaying) return;

            const params = this.getSoundParams(this.currentDay);
            const time = this.audioContext.currentTime;

            this.oscillators.forEach((oscData, index) => {
                // Subtle, slow frequency drift (like memory wavering)
                const drift = Math.sin(time * params.detuneSpeed + oscData.detuneOffset) * params.detuneAmount;
                oscData.osc.detune.value = drift;
            });

            requestAnimationFrame(modulate);
        };

        modulate();
    }

    updateDay(day) {
        if (!this.isPlaying || day === this.currentDay) return;

        this.currentDay = day;
        const params = this.getSoundParams(day);
        const now = this.audioContext.currentTime;
        const transitionTime = 1.0; // 1 second smooth transition

        console.log(`Updating sound to Day ${day}`, params);

        // Update filter (muffling effect)
        this.oscillators.forEach(oscData => {
            oscData.filter.frequency.linearRampToValueAtTime(
                params.filterFrequency,
                now + transitionTime
            );
            oscData.filter.Q.linearRampToValueAtTime(
                params.filterQ,
                now + transitionTime
            );

            // Update dry/wet mix
            const volume = 0.15 / this.baseFrequencies.length;
            oscData.gain.gain.linearRampToValueAtTime(
                volume * params.dryGain,
                now + transitionTime
            );
            oscData.reverbGain.gain.linearRampToValueAtTime(
                params.reverbMix,
                now + transitionTime
            );

            // Update vibrato
            oscData.lfo.frequency.linearRampToValueAtTime(
                params.vibratoSpeed,
                now + transitionTime
            );
            oscData.lfoGain.gain.linearRampToValueAtTime(
                params.vibratoDepth,
                now + transitionTime
            );
        });

        // Update noise
        if (this.noiseNode) {
            this.noiseNode.gain.gain.linearRampToValueAtTime(
                params.noiseLevel,
                now + transitionTime
            );
        }

        // Update reverb
        this.reverbGain.gain.linearRampToValueAtTime(
            params.reverbDecay,
            now + transitionTime
        );
    }

    stop() {
        if (!this.isPlaying) return;

        const now = this.audioContext.currentTime;
        const fadeTime = 2.0;

        // Fade out all oscillators
        this.oscillators.forEach(oscData => {
            oscData.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
            oscData.osc.stop(now + fadeTime);
            oscData.lfo.stop(now + fadeTime);
        });

        // Fade out noise
        if (this.noiseNode) {
            this.noiseNode.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
            this.noiseNode.source.stop(now + fadeTime);
        }

        this.oscillators = [];
        this.isPlaying = false;

        console.log('Sound stopped');
    }

    async toggle(day) {
        if (this.isPlaying) {
            this.stop();
        } else {
            await this.start(day);
        }
    }

    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
}

// Export for use in main script
window.DementiaSound = DementiaSound;

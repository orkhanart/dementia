# Sound System Documentation

## What It Does

The sound system creates a musical experience that **degrades over 31 days** to represent memory loss. Think of it like a music box playing a gentle melody - on Day 1, it's clear and close. By Day 31, it sounds distant and muffled, like a memory fading away.

### The Sound Has Two Parts:

1. **Ambient Pad** - A soft, warm background hum (3 sustained notes: C, E, G)
2. **Melodic Pattern** - A gentle repeating melody (8 notes in a simple progression)

Both play continuously and change based on which day you're viewing.

---

## How It Works (In Plain English)

### Starting the Sound

When you first interact with the page (click anywhere), the sound auto-starts. You can toggle it on/off anytime by pressing **'S'**.

### What Changes Between Days

The degradation happens in 4 main ways:

1. **Filter (Muffling)**
   - Day 1: Bright and clear (12000 Hz)
   - Day 31: Softer and muffled (4000 Hz)
   - Like putting a blanket over a speaker

2. **Reverb (Distance)**
   - Day 1: Close and dry (10% reverb, 0.5s decay)
   - Day 31: Far away and echoey (75% reverb, 3s decay)
   - Main degradation effect - makes it sound distant

3. **Detune (Drift)**
   - Day 1: Perfectly in tune
   - Day 31: Slight wavering (5 cents)
   - Like a slightly out-of-tune piano

4. **Playback Speed**
   - Day 1: Normal speed
   - Day 31: 20% slower
   - Time feels stretched

**Important**: The sound never gets harsh or distorted. It stays gentle and dreamlike throughout.

---

## File Structure

```
sound-system.js
├── class DementiaSound
│   ├── constructor() - Sets up melody notes and pad frequencies
│   ├── init() - Creates Web Audio API context
│   ├── getSoundParams(day) - Returns degradation values for a specific day
│   ├── start(day) - Begins playing sound
│   ├── playMelody(params) - Loops the 8-note pattern
│   ├── startDetuneModulation() - Adds gentle frequency drift
│   ├── updateDay(day) - Smoothly transitions to new day's parameters
│   ├── stop() - Fades out and stops
│   └── toggle(day) - Switches between start/stop
```

---

## The Parameters (What They Control)

| Parameter | Range | What It Does |
|-----------|-------|--------------|
| `filterFrequency` | 12000 → 4000 Hz | Cuts high frequencies (makes it muffled) |
| `detuneAmount` | 0 → 5 cents | Slight pitch drift (wavering) |
| `reverbMix` | 10% → 75% | Dry/wet balance (distance feeling) |
| `reverbDecay` | 0.5s → 3s | How long echoes last |
| `dryGain` | 100% → 50% | Direct sound volume |
| `vibratoSpeed` | 1.5 → 2.5 Hz | Speed of pitch wobble |
| `playbackRate` | 1.0 → 0.8 | Tempo (1.0 = normal, 0.8 = slower) |

---

## Editing with Claude/Cursor

### Common Customizations

#### 1. Change the Melody

**Location**: Lines 22-31 in `sound-system.js`

```javascript
this.melodyNotes = [
    { freq: 261.63, duration: 2.0 },  // C4
    { freq: 329.63, duration: 1.5 },  // E4
    // ... add more notes
];
```

**Instructions for Claude**:
```
"Change the melody to use these notes: D, F#, A, D (minor chord).
Each note should last 1.5 seconds."
```

#### 2. Adjust Degradation Curve

**Location**: Lines 96-128 in `sound-system.js` (inside `getSoundParams()`)

**Instructions for Claude**:
```
"Make the degradation happen faster - I want it to sound distant
by Day 15 instead of Day 31. Keep the same endpoints but steepen
the curve."
```

#### 3. Change the Ambient Pad Notes

**Location**: Lines 34-38 in `sound-system.js`

```javascript
this.padFrequencies = [
    130.81,  // C3
    164.81,  // E3
    196.00,  // G3
];
```

**Instructions for Claude**:
```
"Change the pad to a D minor chord (D, F, A) in the same octave."
```

#### 4. Adjust Master Volume

**Location**: Line 59 in `sound-system.js`

```javascript
this.masterGain.gain.value = 0.2; // 0.0 = silent, 1.0 = max
```

**Instructions for Claude**:
```
"Make the sound 50% louder."
```

#### 5. Make It More/Less Reverby

**Location**: Lines 113-114 in `sound-system.js`

```javascript
reverbMix: 0.1 + easeIn * 0.65,      // Day 1: 10%, Day 31: 75%
reverbDecay: 0.5 + easeIn * 2.5,     // Day 1: 0.5s, Day 31: 3s
```

**Instructions for Claude**:
```
"I want more reverb throughout. Change Day 1 to 25% reverb
and Day 31 to 90% reverb."
```

#### 6. Change Easing Functions

**Location**: Lines 99-102 in `sound-system.js`

The degradation uses three easing curves:
- `easeIn` - Starts slow, accelerates (used for blur, reverb)
- `easeOut` - Starts fast, decelerates (used for filter)
- `easeMix` - Balanced smoothstep (used for overall mix)

**Instructions for Claude**:
```
"I want the degradation to be linear instead of curved.
Replace all easing functions with simple linear progression (just use 't')."
```

---

## Audio Techniques Explained

### 1. **LFO (Low-Frequency Oscillator)**
Creates vibrato - a gentle wobble in pitch. Makes the sound feel more "alive" and organic.

### 2. **Convolution Reverb**
Simulates a 3D space using an "impulse response" (lines 71-92). Our reverb is a synthetic 3-second room.

### 3. **Feedback Loop in Melody**
The melody uses `setTimeout()` to schedule the next note recursively (line 270), creating an endless loop.

### 4. **ADSR Envelope**
Attack, Decay, Sustain, Release - shapes each note's volume over time for a natural sound (lines 240-251).

---

## Troubleshooting

### Sound Won't Play
**Cause**: Browsers require user interaction before playing audio.
**Solution**: Make sure you click or press a key first.

### Sound Stutters or Clicks
**Cause**: JavaScript blocking the audio thread.
**Solution**: Check browser console for errors. Try reducing `Quality` in blur functions.

### Wrong Day's Sound Playing
**Cause**: The `currentDay` variable might not be updating.
**Solution**: Check that `updateDay(day)` is being called when changing days.

### Volume Too Loud/Quiet
**Cause**: Gain values stacked incorrectly.
**Solution**: Adjust `masterGain.gain.value` (line 59) or individual `melodyGain`/`padGain`.

---

## Key Variables to Remember

| Variable | Where It's Used | What to Change |
|----------|----------------|----------------|
| `melodyNotes` | Line 22 | The 8-note pattern |
| `padFrequencies` | Line 34 | Background chord |
| `masterGain.gain.value` | Line 59 | Overall volume |
| `getSoundParams(day)` | Line 96 | All degradation curves |
| `time_scale` | Line 608 | Animation speed |

---

## Tips for Experimentation

1. **Start Small**: Change one parameter at a time and listen to the difference.
2. **Use Console Logs**: The system already logs parameters on start (line 213).
3. **Test Edge Cases**: Always test Day 1 and Day 31 to hear full range.
4. **Copy Before Editing**: Keep a backup of the original parameters.
5. **Use Musical Notes**: For melody changes, search "note frequencies" online.

---

## Musical Reference

Common note frequencies (for editing melodies):

| Note | Frequency |
|------|-----------|
| C4 | 261.63 Hz |
| D4 | 293.66 Hz |
| E4 | 329.63 Hz |
| F4 | 349.23 Hz |
| G4 | 392.00 Hz |
| A4 | 440.00 Hz |
| B4 | 493.88 Hz |
| C5 | 523.25 Hz |

For other octaves: multiply by 2 (up) or divide by 2 (down).

---

## Example Prompts for Claude

**Dramatic Change**:
```
"Make this sound system more aggressive. I want the degradation
to be harsh and glitchy by Day 31, not gentle. Add distortion
and random pitch jumps."
```

**Subtle Refinement**:
```
"The melody feels too fast. Slow it down by 30% and add a
0.2 second gap between notes."
```

**Complete Rebuild**:
```
"Replace the current melody with a random generative algorithm
that picks notes from a pentatonic scale. Keep the same
degradation system."
```

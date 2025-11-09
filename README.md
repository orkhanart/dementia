# Dementia

A generative art piece exploring memory degradation through progressive visual and audio distortion.

## Concept

**Dementia** is an interactive web-based artwork that represents the gradual fading of memory over 31 days. Each day presents the same image and melody, but experienced through an increasingly degraded filter - mirroring how dementia affects the retention and recall of memories.

### Visual Progression (Day 1 → 31)
- **Day 1**: Clear, sharp, present
- **Day 15**: Moderate blur, gentle distortion
- **Day 31**: Heavily blurred, dreamlike, distant

### Audio Progression (Day 1 → 31)
- **Day 1**: Clear melodic pattern, close and warm
- **Day 15**: Same melody with increased reverb and filtering
- **Day 31**: Same melody but distant, slower, heavily filtered

The core memory (image and melody) remains constant - only the clarity and presence changes, representing how dementia doesn't erase memories but transforms how they're experienced.

## Technical Implementation

### Visual System
- **WebGL Shaders**: Full implementation of multi-pass rendering pipeline
- **3D Simplex Noise**: Organic displacement mapping
- **Progressive Parameters**: Day-based interpolation using easing functions
- **Real-time Feedback Loop**: Continuous animation with temporal evolution

### Audio System
- **Web Audio API**: Real-time synthesis without external libraries
- **Harmonic Drone**: 3-voice ambient pad (C major chord)
- **Melodic Pattern**: 8-note repeating sequence (C-E-G-E-D-C-A-C)
- **Progressive Degradation**: Filter cutoff, reverb depth, playback rate

### Key Features
- Auto-starts visuals on page load
- Sound starts on first user interaction (browser requirement)
- Day-based parameter progression (1-31)
- Keyboard controls: 'C' for controls, 'S' for sound toggle
- Minimalistic UI with JetBrains Mono typography

## Usage

1. Open `index.html` in a modern web browser
2. Visuals start automatically
3. Click anywhere or press any key to start audio
4. Use Previous/Next buttons or date picker to navigate days
5. Press 'C' to toggle controls
6. Press 'S' to toggle sound

## Files Structure

```
terry/
├── index.html              # Main HTML file
├── style.css               # Minimalistic UI styling
├── script.js               # Main application logic
├── shader-calendar.js      # WebGL shader system
├── sound-system.js         # Web Audio API implementation
├── memory_01/              # 31 identical images (represents persistent memory)
│   ├── 1.jpg ... 31.jpg
└── shader/                 # Original REVERIES shader reference
```

## Technologies

- Pure JavaScript (ES6+)
- WebGL (GLSL 100)
- Web Audio API
- HTML5 Canvas
- CSS3

## Credits

**Artwork by**: SeeThrough
**Developed by**: [Orkhan](https://github.com/orkhanart)

Shader system inspired by ORKHAN's REVERIES series.

## License

MIT

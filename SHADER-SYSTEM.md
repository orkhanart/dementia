# Shader System Documentation

## What It Does

The shader system creates a **living, breathing image** that slowly degrades from Day 1 (almost normal) to Day 31 (heavily blurred and distorted). It's like watching a photograph dissolve in water over 31 days.

The system uses **WebGL shaders** (programs that run on your GPU) to create a feedback loop - the image continuously feeds back into itself with blur and displacement, creating an organic, dream-like effect.

---

## How It Works (In Plain English)

### The Basic Idea

Imagine taking a photo and:
1. Blurring it slightly
2. Stretching/warping parts of it based on patterns
3. Mixing the result back with the original
4. Repeating this 60 times per second

Over time, this creates a **cumulative effect** - small distortions compound into larger ones. The longer it runs, the more dreamlike it becomes.

### The Four Main Steps (Each Frame)

```
1. MAP GENERATION
   Creates a "displacement map" using noise patterns.
   This map tells the next step where to pull pixels from.

2. DISPLACEMENT
   Warps the image based on the map.
   Like pushing pixels around with invisible hands.

3. FEEDBACK LOOP
   The displaced image becomes the new source.
   This is what makes it accumulate over time.

4. DISPLAY
   Shows the result on screen.
```

---

## File Structure

```
shader-calendar.js
├── SHADERS (GPU Programs)
│   ├── vertexShader - Positions the geometry
│   ├── blitShader - Copies textures
│   ├── blurShader - Blurs images
│   ├── mapShader - Generates displacement maps
│   └── displaceShader - Warps the image
│
└── class ShaderCalendar
    ├── constructor() - Sets up WebGL
    ├── setupPrograms() - Compiles shaders
    ├── setupGeometry() - Creates full-screen quad
    ├── setupFramebuffers() - Creates off-screen textures
    ├── loadImage(src, day) - Loads a photo
    ├── getParams(day) - Returns degradation values for day
    ├── initialize() - Resets the feedback loop
    ├── render() - Runs the 4-step process
    └── startAnimation() - Begins 60fps loop
```

---

## The Parameters (What They Control)

### Core Parameters by Day

| Parameter | Day 1 | Day 31 | What It Does |
|-----------|-------|--------|--------------|
| `image_blur` | 0.1 | 32 | How blurry the image gets |
| `uv_scale` | 0.5 | 4.0 | Size of noise patterns |
| `depth_scale` | 0.2 | 4.0 | How much brightness affects warping |
| `rgb_mix` | 0.1 | 0.95 | How much colors influence displacement |
| `hard_weight` | 0.5 | 8.0 | Strength of pixelated displacement |
| `soft_weight` | 0.3 | 7.5 | Strength of smooth displacement |
| `time_scale` | 0.005 | 0.1 | Speed of animation |

### What These Mean Visually

- **Low values** = Subtle, barely visible
- **High values** = Strong, obvious effect
- **Blur** = Self-explanatory
- **Weights** = Think of them as "strength dials"
- **Scales** = Size/zoom of the underlying patterns

---

## Understanding the Shaders

### 1. **Blit Shader** (Copy Tool)

**What it does**: Simple texture copy. Like Photoshop's "paste".

**When it's used**:
- Copying the original image
- Moving results between textures
- Drawing to screen

**Key code** (lines 49-58):
```glsl
vec2 uv = vUV.xy;  // Get pixel position
gl_FragColor = texture2D(tex, uv);  // Copy pixel
```

---

### 2. **Blur Shader** (Softener)

**What it does**: Averages nearby pixels to create blur.

**How it works**:
- Samples pixels in 16 directions
- Each direction has 3 quality steps
- Total: 49 samples per pixel (16 × 3 + 1)

**Key variables**:
- `Directions` = How many angles to sample
- `Quality` = How far to reach in each direction
- `Size` = Blur radius in pixels

**Analogy**: Like taking 49 photos with slight camera shake and averaging them.

---

### 3. **Map Shader** (Pattern Generator)

**What it does**: Creates the "instructions" for where to move pixels.

**Uses Simplex Noise**:
- A mathematical function that creates organic, flowing patterns
- Like clouds or water ripples
- The `ns_simplex()` function (lines 170-228) is the brain

**Three outputs** (stored as RGB + Alpha):
- **Red channel**: Horizontal displacement
- **Green channel**: Vertical displacement
- **Blue channel**: Hard/soft mask
- **Alpha channel**: Source mask (what stays original)

**Key insight**: By using the image's own colors and brightness in the noise calculation, the displacement is **content-aware** - it warps differently based on what's in the photo.

---

### 4. **Displace Shader** (Warper)

**What it does**: Actually moves the pixels around.

**Two types of displacement**:
1. **Hard** - Pixelated, blocky (like old VHS glitches)
2. **Soft** - Smooth, flowing (like water ripples)

**How it works** (lines 330-340):
```glsl
// Read the map colors
vec2 dsp_hard = (map_blur.xy - 0.5) * hard_weight;
vec2 dsp_soft = (map_blur.xy - 0.5) * soft_weight;

// Pull pixels from displaced positions
vec4 displaced_hard = texture2D(image, uv + dsp_hard);
vec4 displaced_soft = texture2D(image, uv + dsp_soft);

// Mix based on mask
vec4 displaced = mix(displaced_hard, displaced_soft, hard_mask);
```

**Analogy**: The map is a recipe, this shader is the chef following it.

---

## The Feedback Loop (Most Important Concept)

### Why It's Powerful

Normal image filters are **one-time**: blur → done.

This system is **cumulative**: blur → use result → blur again → use result → ...

**Line 677-684** is where the magic happens:
```javascript
// Copy displaced result BACK to image texture
this.draw(this.programs.blit, this.fbos.image, {
    tex: { texture: this.fbos.displace.texture, unit: 0 },
    // ...
});
```

This creates a **feedback loop**:
```
Frame 1: Original image → Displaced (1% warped)
Frame 2: 1% warped image → Displaced (2% warped)
Frame 3: 2% warped image → Displaced (3% warped)
...
Frame 1000: Heavily warped → Even more warped
```

### Why It Doesn't Explode

The `source_mask` (alpha channel) protects parts of the original image, preventing total chaos. Think of it like a "anchor" that keeps some pixels stable.

---

## Easing Functions (Degradation Curves)

**Location**: Lines 572-577

Three curves control how parameters change:

```javascript
const easeIn = t * t * t;              // Slow start, fast end
const easeOut = 1 - Math.pow(1 - t, 2); // Fast start, slow end
const easeMix = t * t * (3 - 2 * t);    // Smooth (S-curve)
```

**Visual**:
```
easeIn:   ___/‾‾
easeOut:  ‾‾\___
easeMix:  __/‾‾
```

Different effects use different curves:
- Blur uses `easeIn` (starts subtle, ends extreme)
- Filter uses `easeOut` (changes quickly at first)
- Mix uses `easeMix` (balanced)

---

## Editing with Claude/Cursor

### Common Customizations

#### 1. Make It More/Less Blurry

**Location**: Line 581

```javascript
image_blur: 0.1 + easeIn * 31.9,  // Day 1: 0.1, Day 31: 32
```

**Instructions for Claude**:
```
"Increase the maximum blur to 50 pixels for Day 31."
```

#### 2. Change Degradation Speed

**Location**: Lines 572-577

**Instructions for Claude**:
```
"Make the degradation linear instead of curved. I want
consistent change from Day 1 to Day 31."
```

#### 3. Adjust Displacement Strength

**Location**: Lines 604-605

```javascript
hard_weight: 0.5 + easeIn * 7.5,  // 0.5 → 8.0
soft_weight: 0.3 + easeIn * 7.2,  // 0.3 → 7.5
```

**Instructions for Claude**:
```
"Reduce displacement by half - the warping is too strong."
```

#### 4. Freeze on Specific Day

**Instructions for Claude**:
```
"Lock the shader to Day 15 parameters permanently.
Remove the day progression system."
```

#### 5. Make It Glitchy Instead of Smooth

**Instructions for Claude**:
```
"In the displace shader, remove the soft displacement
and only keep hard displacement. I want a glitchy,
digital aesthetic."
```

#### 6. Add Color Shift

**Location**: Lines 337-340 in displace shader

**Instructions for Claude**:
```
"Add chromatic aberration - split the R, G, B channels
slightly in different directions based on displacement."
```

#### 7. Change Animation Speed

**Location**: Line 608

```javascript
time_scale: 0.005 + easeOut * 0.095,  // 0.005 → 0.1
```

**Instructions for Claude**:
```
"Make the animation 3x faster."
```

#### 8. Increase Blur Quality

**Location**: Lines 73-74 (blur shader)

```glsl
const int Directions = 16;
const int Quality = 3;
```

**Instructions for Claude**:
```
"Increase blur quality to 32 directions and 5 quality steps.
I don't care about performance."
```

---

## Key Concepts for Non-Shader People

### What is a Shader?

A **shader** is a program that runs on your GPU (graphics card) instead of CPU. It can process millions of pixels in parallel, which is why it's so fast.

Think of it like:
- **CPU (JavaScript)**: One chef cooking sequentially
- **GPU (Shader)**: 1000 chefs cooking simultaneously

### What is a Texture?

A **texture** is just an image stored in GPU memory. In this system, we have 4 textures:

1. `source` - Original clean image
2. `image` - Current state (gets modified each frame)
3. `map` - Displacement instructions
4. `displace` - Temporary working space

### What is a Framebuffer (FBO)?

A **framebuffer** is an off-screen canvas. Instead of drawing directly to the screen, you draw to a hidden texture. This lets you chain effects together.

**Analogy**: Like having 4 pieces of paper and tracing between them.

### What is UV?

**UV coordinates** are how you reference positions in a texture:
- `u` = horizontal (0 = left, 1 = right)
- `v` = vertical (0 = top, 1 = bottom)

Think of it like latitude/longitude for pixels.

---

## Visual Debugging Tips

### See What the Map Looks Like

**Temporary edit** (line 687):

```javascript
// Change this:
this.draw(this.programs.blit, null, {
    tex: { texture: this.fbos.image.texture, unit: 0 },

// To this:
this.draw(this.programs.blit, null, {
    tex: { texture: this.fbos.map.texture, unit: 0 },
```

Now you'll see the raw displacement map instead of the final image.

### Disable Feedback Loop

**Temporary edit**: Comment out lines 677-684.

This will show you the effect on just the original image (non-cumulative).

---

## Performance Notes

### If It's Slow

1. **Reduce blur quality** (lines 73-74)
2. **Lower canvas resolution** (lines 516-519)
3. **Reduce framerate** (change `requestAnimationFrame` to `setTimeout(..., 33)` for 30fps)

### If It's Using Too Much Memory

The system creates 4 textures at full image resolution. For a 2048×2048 image, that's ~64MB of GPU memory. Consider resizing images before loading.

---

## Common Issues & Solutions

### Image Looks Wrong on First Load

**Cause**: Framebuffers not initialized yet.
**Solution**: The `initialize()` function resets everything (line 615).

### Colors Look Weird

**Cause**: Premultiplied alpha settings.
**Solution**: Check line 355 - `premultipliedAlpha: false`.

### Effect Stops Accumulating

**Cause**: Feedback loop broke (image FBO not updating).
**Solution**: Check lines 677-684 are running every frame.

### Day Changes But Effect Doesn't

**Cause**: Need to call `initialize()` when day changes.
**Solution**: See lines 483-489 in `loadImage()`.

---

## Advanced Customization Ideas

### 1. Add Pixelation

**Instructions for Claude**:
```
"Add a pixelation effect that increases with day progression.
On Day 31, quantize UVs to create a 32×32 grid."
```

### 2. Color Degradation

**Instructions for Claude**:
```
"Add color desaturation. Day 1 should be full color,
Day 31 should be black and white."
```

### 3. Vignette Effect

**Instructions for Claude**:
```
"Darken the edges of the image based on distance from center.
Make this stronger as days progress."
```

### 4. Kaleidoscope

**Instructions for Claude**:
```
"In the map shader, add UV mirroring to create a
kaleidoscope effect. Mirror both horizontally and vertically."
```

### 5. Time-Based Pulses

**Instructions for Claude**:
```
"Make the displacement strength pulse with a sine wave
over time, creating a breathing effect."
```

---

## Parameter Reference Table

Complete list for copy-paste:

```javascript
{
    image_blur: 0.1 + easeIn * 31.9,
    uv_scale: 0.5 + easeMix * 3.5,
    depth_scale: 0.2 + easeIn * 3.8,
    rgb_scale: 0.3 + easeMix * 2.2,
    rgb_mix: 0.1 + easeOut * 0.85,
    src_weight: 6.0 - easeOut * 3.5,
    hard_level: 0.2 + easeMix * 2.5,
    hard_contrast: 0.98 - easeOut * 0.45,
    mask_level: 1.0 + easeOut * 2.0,
    mask_contrast: 0.9 - easeOut * 0.35,
    mask_weight: 0.8 - easeOut * 0.5,
    hard_weight: 0.5 + easeIn * 7.5,
    soft_weight: 0.3 + easeIn * 7.2,
    time_scale: 0.005 + easeOut * 0.095,
    map_blur: 2.0 + easeMix * 20.0
}
```

---

## Example Prompts for Claude

**Subtle Refinement**:
```
"The blur feels too aggressive. Reduce the maximum
blur to 15 pixels and slow down the easing curve."
```

**Dramatic Change**:
```
"Remove the blur entirely and focus only on displacement.
I want sharp, glitchy warping instead of dreamy blur."
```

**Complete Rebuild**:
```
"Replace the simplex noise with fractal Brownian motion (fBm)
for more detailed, layered patterns. Use 4 octaves."
```

**Aesthetic Shift**:
```
"Make this look like a CRT TV glitch instead of a dream.
Add scanlines, horizontal distortion, and RGB split."
```

**Optimization**:
```
"The blur shader is too expensive. Replace it with
a faster 2-pass Gaussian blur (horizontal + vertical)."
```

---

## Resources for Learning More

### Understanding Shaders
- **The Book of Shaders**: thebookofshaders.com (best beginner resource)
- **Shadertoy**: shadertoy.com (examples to learn from)

### Simplex Noise
- The noise function here is based on Stefan Gustavson's implementation
- It creates organic, flowing patterns without obvious repetition

### WebGL Basics
- **MDN WebGL Tutorial**: developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial
- Explains textures, framebuffers, and shader programs

---

## Quick Reference: Where to Find Things

| What You Want to Change | Line Number |
|------------------------|-------------|
| Blur amount | 581 |
| Displacement strength | 604-605 |
| Animation speed | 608 |
| Easing curves | 572-577 |
| Blur quality | 73-74 |
| Simplex noise code | 158-228 |
| Feedback loop | 677-684 |
| All parameters | 565-613 |

---

## Final Tips

1. **Start with blur** - It's the most visually obvious parameter.
2. **Change one thing at a time** - Easier to understand what each does.
3. **Use Day 1 and Day 31** - Always test the extremes.
4. **Read the console** - Parameters are logged on init (line 620).
5. **Save often** - Shader experiments can break things quickly.
6. **Compare with/without** - Comment out effects to see their impact.

The beauty of this system is that it's **highly modular** - you can swap out the noise, change the blur, adjust curves, or even replace entire shaders without breaking the pipeline.

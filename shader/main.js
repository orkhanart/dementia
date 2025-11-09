// ============================================================================
// REVERIES - WebGL Generative Art with Depth-Based Displacement
// ============================================================================

// Initialize WebGL context
const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });

if (!gl) {
    console.error("WebGL not supported!");
    document.body.innerHTML = '<div style="color: white; padding: 20px; font-family: sans-serif;">WebGL is not supported in your browser. Please try a different browser.</div>';
    throw new Error("WebGL not supported");
}


// ============================================================================
// TEXTURE & BUFFER UTILITIES
// ============================================================================

/**
 * Load an image and create a WebGL texture
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string} src - Image source URL
 * @returns {Promise<WebGLTexture>} Promise that resolves to a texture
 */
function loadTex(gl, src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "";
      img.onload = () => res(twgl.createTexture(gl, { src: img, mag: gl.LINEAR, min: gl.LINEAR }));
      img.onerror = rej;
      img.src = src;
    });
  }

/**
 * Create buffer info for a full-screen quad
 * Used for rendering shader effects to the entire canvas
 */
function makeBufferInfo(gl) {
    const arrays = {
        position: [
            -1, -1,  0,  // Bottom-left
             1, -1,  0,  // Bottom-right
            -1,  1,  0,  // Top-left
            -1,  1,  0,  // Top-left
             1, -1,  0,  // Bottom-right
             1,  1,  0   // Top-right
        ],
    };
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    return bufferInfo;
}
const bufferInfo = makeBufferInfo(gl);

/**
 * Create or resize a framebuffer object (FBO)
 * FBOs are used for off-screen rendering
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {Object} fbo - Existing framebuffer (or null to create new)
 * @param {number} width - Framebuffer width
 * @param {number} height - Framebuffer height
 * @returns {Object} Framebuffer info object
 */
function makeFbo(gl, fbo, width, height) {
    const attachments = [
        { format: gl.RGBA, type: gl.UNSIGNED_BYTE }
    ];
    if (fbo == null) {
        fbo = twgl.createFramebufferInfo(gl, attachments, width, height);
    } else {
        twgl.resizeFramebufferInfo(gl, fbo, attachments, width, height);
    }
    return fbo;
}


/**
 * Draw a full-screen quad with a shader program
 * @param {Object} program - Shader program info
 * @param {Object} fbo - Framebuffer to render to (null for screen)
 * @param {Object} uniforms - Uniform values to pass to shader
 */
function draw(program, fbo, uniforms) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program.program);
    twgl.setBuffersAndAttributes(gl, program, bufferInfo);
    twgl.setUniforms(program, uniforms);
    twgl.bindFramebufferInfo(gl, fbo);
    twgl.drawBufferInfo(gl, bufferInfo);
}

// ============================================================================
// INTERACTION & ANIMATION HELPERS
// ============================================================================

// Mouse/pointer tracking for interactive effects
const pointer = {
    x: 0,
    y: 0,
    val: 0  // Fade value (0 = no recent movement, 1 = active)
}
let pointer_fade = 0.1;

/**
 * Linear interpolation between two values
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getMousePos(event, canvas) {
    const rect = canvas.getBoundingClientRect(); // get canvas position and size in page coordinates
    const scaleX = canvas.width / rect.width;    // ratio of internal resolution to CSS size
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

window.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e, canvas);
    pointer.x = pos.x;
    pointer.y = pos.y;
    pointer.val = lerp(pointer.val, 1.0, pointer_fade);
});

function updatePointer() {
    pointer.val = lerp(pointer.val, 0.0, pointer_fade);
}


// ============================================================================
// FRAMEBUFFER SETUP
// ============================================================================

let width = 1024;
let height = 1024;

// Framebuffer objects for multi-pass rendering pipeline
let fbos = {
    source: null,     // Stores the source image
    depth: null,      // Stores the depth map
    image: null,      // Stores the working/feedback buffer
    map: null,        // Displacement map generated from noise
    displace: null,   // Final displaced result
}

function resizeFbos(width, height) {
    for (let key in fbos) {
        fbos[key] = makeFbo(gl, fbos[key], width, height);
    }
}

function downloadCanvas() {
    const link = document.createElement('a');
    link.href = document.getElementById('canvas').toDataURL();
    link.download = 'rêveries.png';
    link.click();
}


// ============================================================================
// SHADER PROGRAMS
// ============================================================================

const blitProgram = twgl.createProgramInfo(gl, [vertex_shader, blit_shader]);
const blurProgram = twgl.createProgramInfo(gl, [vertex_shader, blur_shader]);
const displaceProgram = twgl.createProgramInfo(gl, [vertex_shader, displace_shader]);
const mapProgram = twgl.createProgramInfo(gl, [vertex_shader, map_shader]);

// ============================================================================
// UI CONTROLS & PARAMETERS
// ============================================================================

const pane = new Tweakpane.Pane({
    title: 'CONTROLS'
});

// Effect parameters - these control the visual appearance
const params = {
    pre_blur: 0.0,
    image_blur: 8.0,
    map_blur: 8.0,
    uv_scale: 2.0,
    depth_scale: 2.0,
    rgb_scale: 1.0,
    rgb_mix: 0.5,
    src_weight: 4.0,
    noise_speed: -0.05,
    hard_level: 1.0,
    hard_contrast: 0.999,
    mask_level: 2.0,
    mask_contrast: 0.8,
    mask_weight: 0.5,
    hard_weight: 4.0,
    soft_weight: 2.0,
    time_scale: 0.05,
}


pane.addInput(params, 'image_blur', { min: 0, max: 32, label: 'IMAGE SOFTNESS' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'uv_scale', { min: 0, max: 4, label: 'TEXTURE DENSITY' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'depth_scale', { min: 0, max: 4, label: 'DEPTH INTENSITY' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'rgb_scale', { min: 0, max: 4, label: 'COLOR STRENGTH' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'rgb_mix', { min: 0, max: 1, label: 'COLOR BLEND' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'src_weight', { min: 0, max: 8, label: 'SOURCE IMPACT' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'noise_speed', { min: -1, max: 1, label: 'MOTION RATE' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'hard_level', { min: 0, max: 3, label: 'EDGE SHARPNESS' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'hard_contrast', { min: 0, max: 1, label: 'EDGE DEFINITION' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'mask_level', { min: 0, max: 3, label: 'MASK INTENSITY' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'mask_contrast', { min: 0, max: 1, label: 'MASK CLARITY' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'mask_weight', { min: 0, max: 1, label: 'MASK INFLUENCE' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'hard_weight', { min: 0, max: 8, label: 'HARD EFFECT STRENGTH' });
pane.addBlade({ view: 'separator' });
pane.addInput(params, 'soft_weight', { min: 0, max: 8, label: 'SOFT EFFECT STRENGTH' });



// ============================================================================
// PRESETS & RANDOMIZATION
// ============================================================================

const presets = {
    "Default": {
        image_blur: 8.0, uv_scale: 2.0, depth_scale: 2.0, rgb_scale: 1.0, rgb_mix: 0.5,
        src_weight: 4.0, hard_level: 1.0, hard_contrast: 0.999, mask_level: 2.0,
        mask_contrast: 0.8, mask_weight: 0.5, hard_weight: 4.0, soft_weight: 2.0, time_scale: 0.05,
        map_blur: 8.0
    },
    "Soft Dream": {
        image_blur: 16.0, uv_scale: 1.2, depth_scale: 1.0, rgb_scale: 0.6, rgb_mix: 0.7,
        src_weight: 3.0, hard_level: 0.5, hard_contrast: 0.6, mask_level: 1.0,
        mask_contrast: 0.6, mask_weight: 0.7, hard_weight: 2.0, soft_weight: 6.0, time_scale: 0.02,
        map_blur: 12.0
    },
    "Sharp Flow": {
        image_blur: 4.0, uv_scale: 2.8, depth_scale: 3.0, rgb_scale: 1.4, rgb_mix: 0.3,
        src_weight: 5.0, hard_level: 2.0, hard_contrast: 0.9, mask_level: 2.5,
        mask_contrast: 0.9, mask_weight: 0.4, hard_weight: 6.0, soft_weight: 2.0, time_scale: 0.08,
        map_blur: 6.0
    },
    "Noisy Warp": {
        image_blur: 10.0, uv_scale: 3.2, depth_scale: 1.8, rgb_scale: 1.8, rgb_mix: 0.9,
        src_weight: 2.0, hard_level: 1.5, hard_contrast: 0.7, mask_level: 2.0,
        mask_contrast: 0.7, mask_weight: 0.3, hard_weight: 5.5, soft_weight: 5.5, time_scale: 0.12,
        map_blur: 10.0
    },
    "Gentle Drift": {
        image_blur: 20.0, uv_scale: 0.8, depth_scale: 0.9, rgb_scale: 0.5, rgb_mix: 0.6,
        src_weight: 2.5, hard_level: 0.3, hard_contrast: 0.5, mask_level: 1.2,
        mask_contrast: 0.6, mask_weight: 0.8, hard_weight: 1.5, soft_weight: 7.0, time_scale: 0.015,
        map_blur: 18.0
    },
    "Deep Field": {
        image_blur: 6.0, uv_scale: 3.6, depth_scale: 3.5, rgb_scale: 1.2, rgb_mix: 0.45,
        src_weight: 6.0, hard_level: 2.5, hard_contrast: 0.95, mask_level: 2.8,
        mask_contrast: 0.85, mask_weight: 0.35, hard_weight: 7.5, soft_weight: 2.5, time_scale: 0.06,
        map_blur: 5.0
    },
    "Chromatic Veil": {
        image_blur: 14.0, uv_scale: 1.6, depth_scale: 1.4, rgb_scale: 2.2, rgb_mix: 0.85,
        src_weight: 3.5, hard_level: 1.2, hard_contrast: 0.7, mask_level: 1.6,
        mask_contrast: 0.65, mask_weight: 0.55, hard_weight: 3.0, soft_weight: 6.5, time_scale: 0.04,
        map_blur: 16.0
    },
    "Glass Melt": {
        image_blur: 12.0, uv_scale: 2.4, depth_scale: 1.2, rgb_scale: 1.6, rgb_mix: 0.4,
        src_weight: 4.5, hard_level: 1.8, hard_contrast: 0.8, mask_level: 2.2,
        mask_contrast: 0.75, mask_weight: 0.5, hard_weight: 5.0, soft_weight: 4.5, time_scale: 0.03,
        map_blur: 9.0
    },
    "Pulse Wave": {
        image_blur: 8.0, uv_scale: 2.2, depth_scale: 2.4, rgb_scale: 1.0, rgb_mix: 0.2,
        src_weight: 4.0, hard_level: 1.6, hard_contrast: 0.88, mask_level: 1.8,
        mask_contrast: 0.85, mask_weight: 0.45, hard_weight: 6.5, soft_weight: 1.5, time_scale: 0.1,
        map_blur: 7.0
    },
    "Nebula": {
        image_blur: 24.0, uv_scale: 1.0, depth_scale: 1.1, rgb_scale: 2.0, rgb_mix: 0.95,
        src_weight: 2.2, hard_level: 0.7, hard_contrast: 0.55, mask_level: 1.4,
        mask_contrast: 0.6, mask_weight: 0.7, hard_weight: 2.0, soft_weight: 7.5, time_scale: 0.018,
        map_blur: 20.0
    },
    "Ink Flow": {
        image_blur: 5.0, uv_scale: 3.8, depth_scale: 2.6, rgb_scale: 0.9, rgb_mix: 0.25,
        src_weight: 5.5, hard_level: 2.2, hard_contrast: 0.93, mask_level: 2.4,
        mask_contrast: 0.9, mask_weight: 0.4, hard_weight: 7.0, soft_weight: 3.5, time_scale: 0.05,
        map_blur: 6.0
    },
    "Granite": {
        image_blur: 3.0, uv_scale: 2.0, depth_scale: 3.8, rgb_scale: 0.7, rgb_mix: 0.15,
        src_weight: 6.5, hard_level: 2.8, hard_contrast: 0.97, mask_level: 2.9,
        mask_contrast: 0.92, mask_weight: 0.3, hard_weight: 8.0, soft_weight: 1.0, time_scale: 0.03,
        map_blur: 4.0
    },
    "Silk Motion": {
        image_blur: 22.0, uv_scale: 0.9, depth_scale: 1.3, rgb_scale: 1.3, rgb_mix: 0.75,
        src_weight: 2.8, hard_level: 0.9, hard_contrast: 0.6, mask_level: 1.3,
        mask_contrast: 0.65, mask_weight: 0.85, hard_weight: 1.8, soft_weight: 7.8, time_scale: 0.022,
        map_blur: 19.0
    },
    "Vivid Storm": {
        image_blur: 9.0, uv_scale: 3.4, depth_scale: 2.2, rgb_scale: 2.5, rgb_mix: 0.8,
        src_weight: 3.2, hard_level: 1.7, hard_contrast: 0.82, mask_level: 2.1,
        mask_contrast: 0.78, mask_weight: 0.5, hard_weight: 6.2, soft_weight: 3.8, time_scale: 0.11,
        map_blur: 8.0
    }
};

function applyParams(newParams) {
    Object.assign(params, newParams);
    pane.refresh();
}

function randomizeParams() {
    const rand = (min, max) => min + Math.random() * (max - min);
    applyParams({
        image_blur: rand(0, 32),
        uv_scale: rand(0, 4),
        depth_scale: rand(0, 4),
        rgb_scale: rand(0, 4),
        rgb_mix: rand(0, 1),
        src_weight: rand(0, 8),
        hard_level: rand(0, 3),
        hard_contrast: rand(0.3, 1),
        mask_level: rand(0, 3),
        mask_contrast: rand(0.3, 1),
        mask_weight: rand(0, 1),
        hard_weight: rand(0, 8),
        soft_weight: rand(0, 8),
        time_scale: rand(0.0, 0.2),
        map_blur: rand(0, 32),
    });
}

let presetOptions = Object.keys(presets).map((k) => ({ text: k.toUpperCase(), value: k }));
let presetBlade = pane.addBlade({ view: 'list', label: 'PRESET', options: presetOptions, value: 'Default' });
presetBlade.on('change', (ev) => {
    const val = ev.value;
    if (presets[val]) {
        applyParams(presets[val]);
    }
});
const randomizeBtn = pane.addBlade({ view: 'button', label: 'PARAMS', title: 'RANDOMIZE' });
randomizeBtn.on('click', () => randomizeParams());


// ============================================================================
// IMAGE UPLOAD & FILE HANDLING
// ============================================================================

const sourceFileInput = document.getElementById('sourceFileInput');
const depthFileInput = document.getElementById('depthFileInput');

const uploadSourceBtn = pane.addBlade({ view: 'button', label: 'IMAGES', title: 'UPLOAD IMAGE' });
uploadSourceBtn.on('click', () => sourceFileInput && sourceFileInput.click());

function fileToTexture(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(twgl.createTexture(gl, { src: img, mag: gl.LINEAR, min: gl.LINEAR }));
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

if (sourceFileInput) {
    sourceFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        sourceTex = await fileToTexture(file);
        initialize();
    });
}
if (depthFileInput) {
    depthFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        depthTex = await fileToTexture(file);
        initialize();
    });
}


const state = {
    mode: "fit", // fit, fill
    fit_size: 1024,
    fit_scale: 1.0,
    fill_scale: 1.0,
    play: true,
    download: false,
    reveal: false,
    reveal_val: 0.0
}

window.addEventListener('keydown', (e) => {
    if (e.key == 'o') {
        state.reveal = !state.reveal;
    }
    if (e.key == 'd') {
        state.download = true;
    }
    if (e.key == 'p') {
        state.play = !state.play;
    }
    if (e.key == 'f') {
        if (state.mode == "fit") {
            state.mode = "fill";
        } else {
            state.mode = "fit";
        }
        initState(state);
    }
    if (e.key == '=') {
        state.fit_scale *= 2.0;
        state.fill_scale *= 2.0;
        initState(state);
    }
    if (e.key == '-') {
        state.fit_scale /= 2.0;
        state.fit_scale = Math.max(state.fit_scale, 0.5);
        state.fill_scale /= 2.0;
        state.fill_scale = Math.max(state.fill_scale, 0.5);
        initState(state);
    }
});


function initState(state) {
    let cw, ch;
    let sw, sh;
    if (state.mode == "fit") {
        sw = Math.floor(state.fit_size * state.fit_scale);
        sh = Math.floor(state.fit_size * state.fit_scale);
        console.log(sw, sh);
        cw = sw;
        ch = sh;
        width = sw;
        height = sh;
        canvas.width = cw;
        canvas.height = ch;
        canvas.classList.remove('canvas-fill');
        canvas.classList.add('canvas-fit');
    } else {
        ww = window.innerWidth;
        wh = window.innerHeight;
        sw = Math.floor(ww * state.fill_scale);
        sh = Math.floor(wh * state.fill_scale);
        cw = sw;
        ch = sh;
        width = sw;
        height = sh;
        canvas.width = cw;
        canvas.height = ch;
        canvas.classList.remove('canvas-fit');
        canvas.classList.add('canvas-fill');
        console.log(cw, ch);
        console.log(sw, sh);
        console.log(width, height);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    initialize();
    resizeCanvas();
}

window.addEventListener('resize', () => {
    if (state.mode == "fill") {
        initState(state);
    }
    resizeCanvas();
});


function resizeCanvas() {

    let margin = 64;
    if (state.mode == "fill") {
        margin = 0;
    }
    const maxW = window.innerWidth - margin;
    const maxH = window.innerHeight - margin;

    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    canvas.style.width = canvas.width * scale + 'px';
    canvas.style.height = canvas.height * scale + 'px';
}


// ============================================================================
// INITIALIZATION & RENDERING PIPELINE
// ============================================================================

let initialized = false;
let sourceTex;
let depthTex;

let time = 0;
let seed = Math.random();

// Load a random texture from the tex/ directory
let tex_index = Math.floor(Math.random()*23)+1;
let index_str = tex_index.toString().padStart(5, '0');
let source_path = `./tex/source_${index_str}.jpg`;
let depth_path = `./tex/depth_${index_str}.jpg`;

/**
 * Main rendering step - runs every frame
 * Implements a multi-pass shader pipeline:
 * 1. Generate displacement map from noise
 * 2. Apply displacement to create effect
 * 3. Copy to screen
 */
function step() {

    // draw(blurProgram, blurFbo, {
    //     tex: fbos.image.attachments[0], 
    //     res: [width, height],
    //     size: params.pre_blur,
    // });

    draw(mapProgram, fbos.map, {
        source: fbos.source.attachments[0],
        depth: fbos.depth.attachments[0],
        image: fbos.image.attachments[0],
        time: time + seed*1000.0,
        uv_scale: [params.uv_scale, params.uv_scale, params.depth_scale],
        map_weight: params.rgb_scale,
        src_weight: params.src_weight,
        rgb_mix: params.rgb_mix,
        hard_level: params.hard_level,
        hard_contrast: params.hard_contrast,
        mask_level: params.mask_level,
        reveal: state.reveal_val,
        mask_contrast: params.mask_contrast,
        mask_weight: params.mask_weight,
        res: [width, height],
        pointer: [pointer.x, pointer.y, pointer.val],
        blur_size: params.image_blur,
        time_scale: params.time_scale,
    });

    draw(displaceProgram, fbos.displace, {
        source: fbos.source.attachments[0],
        image: fbos.image.attachments[0],
        map: fbos.map.attachments[0],
        res: [width, height],
        hard_weight: params.hard_weight,
        soft_weight: params.soft_weight,
        pointer: [pointer.x, pointer.y, pointer.val],
        blur_size: params.map_blur,
    });

    draw(blitProgram, fbos.image, {
        tex: fbos.displace.attachments[0],
        fit: false,
        nearest: false
    });

    draw(blitProgram, null, {
        tex: fbos.image.attachments[0],
        fit: false,
        res: [canvas.width, canvas.height],
        tex_res: [width, height],
        nearest: false
    });


    // draw(blitProgram, null, {
    //     tex: fbos.map.attachments[0]
    // });


    time += 1/60;
}

function initialize() {
    time = 0;
    resizeFbos(width, height);


    draw(blitProgram, fbos.source, {
        tex: sourceTex,
        res: [width, height],
        tex_res: [2048, 2048],
        fit: true,
        nearest: false
    });
    draw(blitProgram, fbos.depth, {
        tex: depthTex,
        res: [width, height],
        tex_res: [2048, 2048],
        fit: true,
        nearest: false
    });
    draw(blitProgram, fbos.image, {
        tex: fbos.source.attachments[0],
        fit: false,
        nearest: false
    });
    // for (let i = 0; i < 64; i++) {
    //     step();
    // }
}




Promise.all([
    loadTex(gl, source_path),
    loadTex(gl, depth_path)
  ]).then(([source, depth]) => {
    initialized = true;
    sourceTex = source;
    depthTex = depth;
    initState(state);
    requestAnimationFrame(update);
  }).catch((error) => {
    console.error('Failed to load textures:', error);
    console.error('Tried to load:', source_path, depth_path);
  });


function downloadSource() {
    let img_el = sourceTex.image;
    let link = document.createElement('a');
    link.href = img_el.src;
    link.download = 'source.jpg';
    link.click();
}


let aframe = 0;
let then = performance.now();
let fpsInterval = 1000/60;
function update() {
    requestAnimationFrame(update);

    gl.viewport(0, 0, canvas.width, canvas.height);

    let now = performance.now();
    let elapsed = now - then;
    let render_this = elapsed > fpsInterval;
    render_this = render_this && state.play;
    if (render_this) {
        then = now - (elapsed % fpsInterval);
        // console.log('fps', 1000/elapsed);


        if (state.reveal) {
            state.reveal_val = lerp(state.reveal_val, 1.0, 0.01);
        } else {
            state.reveal_val = lerp(state.reveal_val, 0.0, 0.2);
        }
 
        updatePointer();
        if (pointer.val < 0.01) {
            canvas.style.cursor = 'none';
        } else {
            canvas.style.cursor = 'default';
        }

        for (let i = 0; i < 1; i++) {
            step();
        }
        
        
    }
    if (state.download) {
        if (state.reveal) {
            downloadSource();
        } else {
            downloadCanvas();
        }
        state.download = false;
    }

    // const max = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    // console.log('Max renderbuffer size:', max);
}

// requestAnimationFrame(update);
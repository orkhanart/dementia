// ============================================================================
// SHADER-BASED CALENDAR - Full Implementation
// ============================================================================
// Based on REVERIES shader system with progressive day-based effects
// ============================================================================

// Vertex Shader
const vertexShader = `
#version 100
precision highp float;

attribute vec2 uv;
attribute vec3 position;
varying vec4 vUV;

void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
    vUV = vec4(position.xy*0.5+0.5, position.xy*0.5+0.5);
}
`;

// Blit Shader - Simple texture copy
const blitShader = `
#version 100
precision highp float;

varying vec4 vUV;
uniform sampler2D tex;
uniform vec2 tex_res;
uniform vec2 res;
uniform bool fit;
uniform bool nearest;

vec2 uv_norm(vec2 uv, vec2 res, vec2 tex_res) {
    float tex_aspect = tex_res.x / tex_res.y;
    float res_aspect = res.x / res.y;
    if (tex_aspect > res_aspect) {
        float scale = res_aspect / tex_aspect;
        uv.x = (uv.x - 0.5) * scale + 0.5;
    } else {
        float scale = tex_aspect / res_aspect;
        uv.y = (uv.y - 0.5) * scale + 0.5;
    }
    return uv;
}

void main() {
    vec2 uv = vUV.xy;
    if (fit) {
        uv = uv_norm(uv, res, tex_res);
    }
    if (nearest) {
        uv = floor(uv*tex_res+0.5)/tex_res;
    }
    gl_FragColor = texture2D(tex, uv);
}
`;

// Blur Shader
const blurShader = `
#version 100
precision highp float;

varying vec4 vUV;
uniform sampler2D tex;
uniform vec2 res;
uniform float size;

vec4 blur(sampler2D tex, vec2 uv, vec2 res) {
    const float Pi2 = 6.28318530718;
    const int Directions = 16;
    const int Quality = 3;
    float Size = size;

    vec2 radius = Size / res;
    vec4 Color = texture2D(tex, uv);

    for (int d = 0; d < Directions; ++d) {
        float angle = Pi2 * float(d) / float(Directions);
        vec2 dir = vec2(cos(angle), sin(angle));

        for (int i = 1; i <= Quality; ++i) {
            float offset = float(i) / float(Quality);
            Color += texture2D(tex, uv + dir * radius * offset);
        }
    }

    Color /= float(Quality * Directions + 1);
    return Color;
}

void main() {
    vec4 Color = blur(tex, vUV.xy, res);
    gl_FragColor = Color;
}
`;

// Map Shader - Generates displacement maps
const mapShader = `
#version 100
precision highp float;

varying vec4 vUV;
uniform sampler2D source;
uniform sampler2D image;
uniform float time;
uniform vec3 uv_scale;
uniform float map_weight;
uniform float src_weight;
uniform float rgb_mix;
uniform float hard_level;
uniform float hard_contrast;
uniform float mask_level;
uniform float mask_contrast;
uniform float mask_weight;
uniform vec2 res;
uniform float blur_size;
uniform float time_scale;

vec2 uv_norm(vec2 uv, vec2 res, vec2 tex_res) {
    float tex_aspect = tex_res.x / tex_res.y;
    float res_aspect = res.x / res.y;
    if (tex_aspect > res_aspect) {
        float scale = res_aspect / tex_aspect;
        uv.x = (uv.x - 0.5) * scale + 0.5;
    } else {
        float scale = tex_aspect / res_aspect;
        uv.y = (uv.y - 0.5) * scale + 0.5;
    }
    return uv;
}

vec4 blur(sampler2D tex, vec2 uv, vec2 res) {
    const float Pi2 = 6.28318530718;
    const int Directions = 16;
    const int Quality = 3;
    float Size = blur_size;

    vec2 radius = Size / res;
    vec4 Color = texture2D(tex, uv);

    for (int d = 0; d < Directions; ++d) {
        float angle = Pi2 * float(d) / float(Directions);
        vec2 dir = vec2(cos(angle), sin(angle));

        for (int i = 1; i <= Quality; ++i) {
            float offset = float(i) / float(Quality);
            Color += texture2D(tex, uv + dir * radius * offset);
        }
    }

    Color /= float(Quality * Directions + 1);
    return Color;
}

vec3 ns_simplex_mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 ns_simplex_mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 ns_simplex_permute(vec4 x) {
    return ns_simplex_mod289(((x*34.0)+10.0)*x);
}
vec4 ns_simplex_taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}
float ns_simplex(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = ns_simplex_mod289(i);
    vec4 p = ns_simplex_permute( ns_simplex_permute( ns_simplex_permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = ns_simplex_taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
    vec2 uv = vUV.xy;
    vec2 uvn = uv_norm(uv, res, vec2(2048.0, 2048.0));

    vec4 source_color = texture2D(source, uv);
    vec4 image_color = blur(image, uv, res);

    float t = mod(time, 111111.0);
    float t2 = mod(time*time_scale, 111111.0);

    // Use luminance as pseudo depth
    float depth = dot(source_color.rgb, vec3(0.299, 0.587, 0.114));

    vec3 nmap = vec3(uvn, depth) * uv_scale + vec3(0.0, 0.0, t2);
    vec3 rgb_map = image_color.xyz*map_weight + vec3(0.0, 0.0, t2);
    vec3 nmap_mask = nmap + source_color.xyz*src_weight;
    vec3 nmap_source = vec3(uvn, depth) + source_color.xyz*0.5 + vec3(0.0, 0.0, t*0.05);

    nmap_source = vec3(
        ns_simplex(nmap_source + vec3(69.0, 0.0, 0.0)),
        ns_simplex(nmap_source + vec3(69.0, 10.0, 0.0)),
        ns_simplex(nmap_source + vec3(69.0, 20.0, 0.0))
    );
    nmap_source = nmap_source + vec3(uvn, depth);

    float displace_x_1 = ns_simplex(nmap + vec3(0.0, 0.0, 000.0));
    float displace_y_1 = ns_simplex(nmap + vec3(0.0, 11.0, 111.1));
    float displace_x_2 = ns_simplex(rgb_map + vec3(0.0, 44.0, 444.0));
    float displace_y_2 = ns_simplex(rgb_map + vec3(0.0, 55.0, 555.1));

    float displace_x = mix(displace_x_1, displace_x_2, rgb_mix);
    float displace_y = mix(displace_y_1, displace_y_2, rgb_mix);

    float hard_mask = ns_simplex(nmap_mask + vec3(0.0, 22.0, 222.2));
    float source_mask = ns_simplex(nmap_source + vec3(0.0, 33.0, 333.3));

    displace_x = displace_x * 0.5 + 0.5;
    displace_y = displace_y * 0.5 + 0.5;

    hard_mask = hard_mask * 0.5 + 0.5;
    hard_mask = pow(hard_mask, pow(2.0, hard_level));
    hard_mask = smoothstep(hard_contrast*0.5, 1.0-hard_contrast*0.5, hard_mask);

    source_mask = source_mask * 0.5 + 0.5;
    source_mask = pow(source_mask, pow(2.0, mask_level));
    source_mask = smoothstep(mask_contrast*0.5, 1.0-mask_contrast*0.5, source_mask);

    source_mask = mix(source_mask, 1.0, 0.0);
    source_mask = mix(source_mask, 0.0, 1.0-mask_weight);

    vec4 color = vec4(displace_x, displace_y, hard_mask, 1.0-source_mask);

    gl_FragColor = color;
}
`;

// Displace Shader
const displaceShader = `
#version 100
precision highp float;

varying vec4 vUV;
uniform sampler2D source;
uniform sampler2D image;
uniform sampler2D map;
uniform vec2 res;
uniform float hard_weight;
uniform float soft_weight;
uniform float blur_size;

vec4 blur(sampler2D tex, vec2 uv, vec2 res) {
    const float Pi2 = 6.28318530718;
    const int Directions = 16;
    const int Quality = 3;
    float Size = blur_size;

    vec2 radius = Size / res;
    vec4 Color = texture2D(tex, uv);

    for (int d = 0; d < Directions; ++d) {
        float angle = Pi2 * float(d) / float(Directions);
        vec2 dir = vec2(cos(angle), sin(angle));

        for (int i = 1; i <= Quality; ++i) {
            float offset = float(i) / float(Quality);
            Color += texture2D(tex, uv + dir * radius * offset);
        }
    }

    Color /= float(Quality * Directions + 1);
    return Color;
}

void main() {
    vec2 uv = vUV.xy;

    vec4 source_color = texture2D(source, uv);
    vec4 map_color = texture2D(map, uv);
    vec4 map_blur = blur(map, uv, res);

    vec2 dsp_hard = (map_blur.xy - 0.5)*hard_weight*2.0 / res;
    dsp_hard = floor(dsp_hard*res+0.5)/res;
    vec2 dsp_soft = (map_blur.xy - 0.5)*soft_weight*2.0 / res;

    float hard_mask = map_blur.z;
    float source_mask = map_color.w;

    vec4 displaced_hard = texture2D(image, uv + dsp_hard);
    vec4 displaced_soft = texture2D(image, uv + dsp_soft);
    vec4 displaced = mix(displaced_hard, displaced_soft, hard_mask);
    vec4 result = mix(displaced, source_color, 1.0-source_mask);

    gl_FragColor = result;
}
`;

// ============================================================================
// WebGL Setup and Utilities
// ============================================================================

class ShaderCalendar {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            premultipliedAlpha: false
        });

        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        this.time = 0;
        this.animationId = null;
        this.currentDay = 1;
        this.currentImage = null;
        this.seed = Math.random();

        // Handle WebGL context loss/restore
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost');
            this.stopAnimation();
        });

        this.canvas.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored, reinitializing...');
            this.setupPrograms();
            this.setupGeometry();
            this.setupFramebuffers();

            // Re-set Y-flip after context restore
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

            if (this.currentImage) {
                this.createTexture(this.currentImage);
                this.initialize();
                this.startAnimation();
            }
        });

        this.setupPrograms();
        this.setupGeometry();
        this.setupFramebuffers();

        // Set Y-flip globally for all texture uploads
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    }

    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);

        if (!vs || !fs) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    setupPrograms() {
        this.programs = {
            blit: this.createProgram(vertexShader, blitShader),
            blur: this.createProgram(vertexShader, blurShader),
            map: this.createProgram(vertexShader, mapShader),
            displace: this.createProgram(vertexShader, displaceShader)
        };
    }

    setupGeometry() {
        const gl = this.gl;

        const positions = new Float32Array([
            -1, -1, 0,
             1, -1, 0,
            -1,  1, 0,
            -1,  1, 0,
             1, -1, 0,
             1,  1, 0
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    setupFramebuffers() {
        this.fbos = {
            source: null,
            image: null,
            map: null,
            displace: null
        };
    }

    createFramebuffer(width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        return { fbo, texture };
    }

    resizeFramebuffers(width, height) {
        const gl = this.gl;

        for (let key in this.fbos) {
            if (this.fbos[key]) {
                gl.deleteTexture(this.fbos[key].texture);
                gl.deleteFramebuffer(this.fbos[key].fbo);
            }
            this.fbos[key] = this.createFramebuffer(width, height);
        }
    }

    loadImage(src, day) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const dayChanged = this.currentDay !== day;
                this.currentDay = day;
                this.currentImage = img;

                // If it's the same image but different day, just reinitialize
                if (this.sourceTexture && img.src === this.lastImageSrc && dayChanged) {
                    this.initialize();
                } else {
                    this.createTexture(img);
                    this.initialize();
                }

                this.lastImageSrc = img.src;
                resolve();
            };

            img.onerror = reject;
            img.src = src;
        });
    }

    createTexture(img) {
        const gl = this.gl;

        if (this.sourceTexture) {
            gl.deleteTexture(this.sourceTexture);
        }

        this.sourceTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload texture (Y-flip is set globally in constructor)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        const size = Math.min(img.width, img.height);
        this.canvas.width = size;
        this.canvas.height = size;
        this.width = size;
        this.height = size;

        gl.viewport(0, 0, size, size);
        this.resizeFramebuffers(size, size);
    }

    draw(program, fbo, uniforms) {
        const gl = this.gl;

        gl.useProgram(program);

        // Bind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fbo : null);
        gl.viewport(0, 0, this.width, this.height);

        // Set attributes
        const posLoc = gl.getAttribLocation(program, 'position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        // Set uniforms
        for (let name in uniforms) {
            const loc = gl.getUniformLocation(program, name);
            const value = uniforms[name];

            if (loc === null) continue;

            if (typeof value === 'number') {
                gl.uniform1f(loc, value);
            } else if (value.length === 2) {
                gl.uniform2f(loc, value[0], value[1]);
            } else if (value.length === 3) {
                gl.uniform3f(loc, value[0], value[1], value[2]);
            } else if (value.texture !== undefined) {
                gl.activeTexture(gl.TEXTURE0 + value.unit);
                gl.bindTexture(gl.TEXTURE_2D, value.texture);
                gl.uniform1i(loc, value.unit);
            } else if (typeof value === 'boolean') {
                gl.uniform1i(loc, value ? 1 : 0);
            }
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    getParams(day) {
        // Progressive parameters based on day (1-31)
        // Day 1: Very subtle, almost imperceptible
        // Day 31: Maximum dreamy, blurry effect
        const t = (day - 1) / 30;

        // Use easing function for smoother progression
        // Cubic ease-in: starts very slow, accelerates toward the end
        const easeIn = t * t * t;
        // Quadratic ease-out: starts fast, decelerates
        const easeOut = 1 - Math.pow(1 - t, 2);
        // Mix of both for balanced curve
        const easeMix = t * t * (3 - 2 * t); // Smoothstep

        return {
            // Blur: Very minimal at start, exponential growth
            image_blur: 0.1 + easeIn * 31.9,          // 0.1 -> 32 (very subtle start)

            // Displacement strength: gentle start, strong end
            uv_scale: 0.5 + easeMix * 3.5,            // 0.5 -> 4.0
            depth_scale: 0.2 + easeIn * 3.8,          // 0.2 -> 4.0

            // Color influence: minimal to strong
            rgb_scale: 0.3 + easeMix * 2.2,           // 0.3 -> 2.5
            rgb_mix: 0.1 + easeOut * 0.85,            // 0.1 -> 0.95

            // Source weight: high (stable) to low (chaotic)
            src_weight: 6.0 - easeOut * 3.5,          // 6.0 -> 2.5

            // Edge definition: sharp to soft
            hard_level: 0.2 + easeMix * 2.5,          // 0.2 -> 2.7
            hard_contrast: 0.98 - easeOut * 0.45,     // 0.98 -> 0.53

            // Masking: subtle to prominent
            mask_level: 1.0 + easeOut * 2.0,          // 1.0 -> 3.0
            mask_contrast: 0.9 - easeOut * 0.35,      // 0.9 -> 0.55
            mask_weight: 0.8 - easeOut * 0.5,         // 0.8 -> 0.3

            // Displacement weights: gentle to extreme
            hard_weight: 0.5 + easeIn * 7.5,          // 0.5 -> 8.0
            soft_weight: 0.3 + easeIn * 7.2,          // 0.3 -> 7.5

            // Animation speed: very slow to moderate
            time_scale: 0.005 + easeOut * 0.095,      // 0.005 -> 0.1

            // Map blur: minimal to heavy
            map_blur: 2.0 + easeMix * 20.0            // 2.0 -> 22.0
        };
    }

    initialize() {
        const gl = this.gl;
        this.time = 0;

        console.log(`Initializing shader for Day ${this.currentDay}`);
        console.log('Parameters:', this.getParams(this.currentDay));

        // Copy source to source FBO (clean original)
        this.draw(this.programs.blit, this.fbos.source, {
            tex: { texture: this.sourceTexture, unit: 0 },
            res: [this.width, this.height],
            tex_res: [this.currentImage.width, this.currentImage.height],
            fit: false,
            nearest: false
        });

        // Reset image FBO to source (important: resets feedback loop)
        this.draw(this.programs.blit, this.fbos.image, {
            tex: { texture: this.fbos.source.texture, unit: 0 },
            res: [this.width, this.height],
            tex_res: [this.width, this.height],
            fit: false,
            nearest: false
        });
    }

    render() {
        const gl = this.gl;
        if (!this.sourceTexture) return;

        const params = this.getParams(this.currentDay);

        // Generate displacement map
        this.draw(this.programs.map, this.fbos.map, {
            source: { texture: this.fbos.source.texture, unit: 0 },
            image: { texture: this.fbos.image.texture, unit: 1 },
            time: this.time + this.seed * 1000.0,
            uv_scale: [params.uv_scale, params.uv_scale, params.depth_scale],
            map_weight: params.rgb_scale,
            src_weight: params.src_weight,
            rgb_mix: params.rgb_mix,
            hard_level: params.hard_level,
            hard_contrast: params.hard_contrast,
            mask_level: params.mask_level,
            mask_contrast: params.mask_contrast,
            mask_weight: params.mask_weight,
            res: [this.width, this.height],
            blur_size: params.image_blur,
            time_scale: params.time_scale
        });

        // Apply displacement
        this.draw(this.programs.displace, this.fbos.displace, {
            source: { texture: this.fbos.source.texture, unit: 0 },
            image: { texture: this.fbos.image.texture, unit: 1 },
            map: { texture: this.fbos.map.texture, unit: 2 },
            res: [this.width, this.height],
            hard_weight: params.hard_weight,
            soft_weight: params.soft_weight,
            blur_size: params.map_blur
        });

        // Copy displaced result back to image (feedback loop)
        this.draw(this.programs.blit, this.fbos.image, {
            tex: { texture: this.fbos.displace.texture, unit: 0 },
            res: [this.width, this.height],
            tex_res: [this.width, this.height],
            fit: false,
            nearest: false
        });

        // Draw to screen
        this.draw(this.programs.blit, null, {
            tex: { texture: this.fbos.image.texture, unit: 0 },
            res: [this.width, this.height],
            tex_res: [this.width, this.height],
            fit: false,
            nearest: false
        });

        this.time += 1 / 60;
    }

    startAnimation() {
        const animate = () => {
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setDay(day) {
        this.currentDay = day;
    }
}

window.ShaderCalendar = ShaderCalendar;

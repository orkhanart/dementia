// ============================================================================
// REVERIES - GLSL Shader Programs
// ============================================================================
// This file contains all WebGL shader code used for the visual effects.
// Shaders run on the GPU and process vertices and pixels in parallel.
// ============================================================================

/**
 * VERTEX SHADER
 * Processes each vertex of the geometry (full-screen quad)
 * Converts from clip space (-1 to 1) to UV coordinates (0 to 1)
 */
const vertex_shader = `
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

/**
 * BLIT SHADER
 * Simple texture copy with optional aspect-ratio fitting
 * Used to copy textures between framebuffers or to screen
 */
const blit_shader = `
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
            // texture is wider, crop horizontally
            float scale = res_aspect / tex_aspect;
            uv.x = (uv.x - 0.5) * scale + 0.5;
        } else {
            // texture is taller, crop vertically
            float scale = tex_aspect / res_aspect;
            uv.y = (uv.y - 0.5) * scale + 0.5;
        }
        return uv;
    }


    void main() {

        vec2 uv = vUV.xy;
        if (fit) {
            uv.y = 1.0 - uv.y;
            uv = uv_norm(uv, res, tex_res);
        }
        if (nearest) {
            uv = floor(uv*tex_res+0.5)/tex_res;
        }
        gl_FragColor = texture2D(tex, uv);
    }
    `;

/**
 * BLUR SHADER
 * Applies a radial Gaussian blur effect
 * Uses multi-directional sampling for smooth blur
 */
const blur_shader = `
    #version 100
    precision highp float;

    varying vec4 vUV;
    uniform sampler2D tex;
    uniform vec2 res;
    uniform float size;

    vec4 blur(sampler2D tex, vec2 uv, vec2 res) {

        // GAUSSIAN BLUR SETTINGS {{{
        const float Pi2 = 6.28318530718;
        const int Directions = 16;
        const int Quality = 3;
        float Size = size;
        // GAUSSIAN BLUR SETTINGS }}}

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
    }`;




/**
 * MAP SHADER
 * Generates displacement maps using 3D Simplex noise
 * Combines source image, depth map, and time to create animated displacement
 * This is the heart of the visual effect - it determines how pixels will move
 */
const map_shader = `
    #version 100
    precision highp float;

    varying vec4 vUV;
    uniform sampler2D source;
    uniform sampler2D depth;
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
    uniform vec3 pointer;
    uniform float blur_size;
    uniform float reveal;
    uniform float time_scale;

    vec2 uv_norm(vec2 uv, vec2 res, vec2 tex_res) {
        float tex_aspect = tex_res.x / tex_res.y;
        float res_aspect = res.x / res.y;
        if (tex_aspect > res_aspect) {
            // texture is wider, crop horizontally
            float scale = res_aspect / tex_aspect;
            uv.x = (uv.x - 0.5) * scale + 0.5;
        } else {
            // texture is taller, crop vertically
            float scale = tex_aspect / res_aspect;
            uv.y = (uv.y - 0.5) * scale + 0.5;
        }
        return uv;
    }



    vec4 blur(sampler2D tex, vec2 uv, vec2 res) {

        // GAUSSIAN BLUR SETTINGS {{{
        const float Pi2 = 6.28318530718;
        const int Directions = 16;
        const int Quality = 3;
        float Size = blur_size;
        // GAUSSIAN BLUR SETTINGS }}}

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
        vec4 depth_color = texture2D(depth, uv);
        // vec4 image_color = texture2D(image, uv);

        vec4 image_color = blur(image, uv, res);

        float t = mod(time, 111111.0);
        float t2 = mod(time*time_scale, 111111.0);








        vec3 nmap = vec3(uvn, depth_color.x) * uv_scale + vec3(0.0, 0.0, t2);
        vec3 rgb_map = image_color.xyz*map_weight + vec3(0.0, 0.0, t2);
        vec3 nmap_mask = nmap + source_color.xyz*src_weight;
        vec3 nmap_source = vec3(uvn, depth_color.x) + source_color.xyz*0.5  + vec3(0.0, 0.0, t*0.05);
        
        nmap_source = vec3(
            ns_simplex(nmap_source + vec3(69.0, 0.0, 0.0)),
            ns_simplex(nmap_source + vec3(69.0, 10.0, 0.0)),
            ns_simplex(nmap_source + vec3(69.0, 20.0, 0.0))
        );
        nmap_source = nmap_source + vec3(uvn, depth_color.x);

        float displace_x_1 = ns_simplex(nmap + vec3(0.0, 0.0, 000.0));
        float displace_y_1 = ns_simplex(nmap + vec3(0.0, 11.0, 111.1));
        float displace_x_2 = ns_simplex(rgb_map + vec3(0.0, 44.0, 444.0));
        float displace_y_2 = ns_simplex(rgb_map + vec3(0.0, 55.0, 555.1));





        float displace_x = mix(displace_x_1, displace_x_2, rgb_mix);
        float displace_y = mix(displace_y_1, displace_y_2, rgb_mix);
        

        float hard_mask = ns_simplex(nmap_mask + vec3(0.0, 22.0, 222.2));


        float source_mask = ns_simplex(nmap_source + vec3(0.0, 33.0, 333.3));



        vec2 pp = vec2(pointer.x/res.x, 1.0-pointer.y/res.y);
        pp = pp-uv;
        float res_ratio = res.x/res.y;
        if (res_ratio > 1.0) {
            pp.y /= res_ratio;
        } else {
            pp.x *= res_ratio;
        }
        float pdist = 0.1+0.4*pow(source_mask*0.5+0.5, 2.0);
        // pdist *= 0.75;
        float pval = 1.0-smoothstep(0.0, pdist, length(pp));
        pval = pow(pval, 4.0);
        pval *= pointer.z;
        // pval *= 0.5;




        displace_x = displace_x * 0.5 + 0.5;
        displace_y = displace_y * 0.5 + 0.5;

        hard_mask = hard_mask * 0.5 + 0.5;
        hard_mask = pow(hard_mask, pow(2.0, hard_level));
        hard_mask = smoothstep(hard_contrast*0.5, 1.0-hard_contrast*0.5, hard_mask);

        source_mask = source_mask * 0.5 + 0.5;
        source_mask = pow(source_mask, pow(2.0, mask_level));
        source_mask = smoothstep(mask_contrast*0.5, 1.0-mask_contrast*0.5, source_mask);
        source_mask = mix(source_mask, 1.0, pow(reveal, 3.0));

        source_mask = mix(source_mask, 0.0, 1.0-mask_weight);
        source_mask = mix(source_mask, 1.0, pval);


        vec4 color = vec4(displace_x, displace_y, hard_mask, 1.0-source_mask);

        gl_FragColor = color;
    }`;

/**
 * DISPLACE SHADER
 * Applies the displacement map to the image
 * Uses the map to offset UV coordinates and create the flowing effect
 * Combines hard (pixelated) and soft (smooth) displacement modes
 */
const displace_shader = `
    #version 100
    precision highp float;

    varying vec4 vUV;
    uniform sampler2D source;
    uniform sampler2D image;
    uniform sampler2D map;
    uniform vec2 res;
    uniform float hard_weight;
    uniform float soft_weight;
    uniform vec3 pointer;
    uniform float blur_size;

    vec4 blur(sampler2D tex, vec2 uv, vec2 res) {

        // GAUSSIAN BLUR SETTINGS {{{
        const float Pi2 = 6.28318530718;
        const int Directions = 16;
        const int Quality = 3;
        float Size = blur_size;
        // GAUSSIAN BLUR SETTINGS }}}

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


        vec2 pp = vec2(pointer.x/res.x, 1.0-pointer.y/res.y);
        pp = pp-uv;
        float res_ratio = res.x/res.y;
        if (res_ratio > 1.0) {
            pp.y /= res_ratio;
        } else {
            pp.x *= res_ratio;
        }
        float pdist = 0.1;
        float pval = 1.0-smoothstep(0.0, pdist, length(pp));
        pval *= pointer.z;


        vec2 dsp_hard = (map_blur.xy - 0.5)*hard_weight*2.0 / res;
        dsp_hard = floor(dsp_hard*res+0.5)/res;
        vec2 dsp_soft = (map_blur.xy - 0.5)*soft_weight*2.0 / res;

        float hard_mask = map_blur.z;
        float source_mask = map_color.w;

        vec4 displaced_hard = texture2D(image, uv + dsp_hard);
        vec4 displaced_soft = texture2D(image, uv + dsp_soft);
        vec4 displaced = mix(displaced_hard, displaced_soft, hard_mask);
        vec4 result = mix(displaced, source_color, 1.0-source_mask);

        // result = mix(result, vec4(1.0, 0.0, 0.0, 1.0), pval);


        gl_FragColor = result;

    }`;

// Stylised retro renderer for the model lab.
// Pass 1 renders at a low internal resolution into colour+depth textures with
// per-style lighting (PS1 snap/affine/dither, N64 blur, hand-painted wrap light,
// 1-bit print, ink cel bands) and metal reflections. Pass 2 upscales with
// hard pixels and, for ink styles, draws outlines from depth edges.
import { Mat4 } from "../core/math.ts";
import { TMesh } from "./tmesh.ts";

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV; layout(location=3) in float aMat; layout(location=4) in vec3 aCol;
uniform mat4 uModel, uVP; uniform vec2 uRes; uniform float uSnap, uVertexSpec;
uniform vec3 uLDir, uLCol, uAmb, uRim, uCam, uPPos, uPCol, uSkyUp, uSkyHor, uSkyDn; uniform float uPRad, uStyle; uniform vec2 uFogP;
out vec3 vAff; flat out vec2 vFlatUV; out vec3 vCol; out vec2 vUV; out vec3 vLight; out float vFog; out vec3 vN; out vec3 vW; out float vMat; out vec3 vSpec;
vec3 env(vec3 r){ float y = r.y; vec3 c = y > 0.0 ? mix(uSkyHor, uSkyUp, pow(y,0.6)) : mix(uSkyHor*0.6, uSkyDn, pow(-y,0.4)); c += uSkyHor * 0.8 * exp(-abs(y)*14.0); return c; }
void main(){
  vec4 w = uModel*vec4(aPos,1.0);
  vec4 p = uVP*w;
  if(uSnap > 0.5){ vec2 g = uRes*0.5; p.xy = floor(p.xy/p.w*g + 0.5)/g * p.w; }
  gl_Position = p;
  vUV = aUV; vAff = vec3(aUV*p.w, p.w);
  vec3 n = normalize(mat3(uModel)*aNor);
  vN = n; vW = w.xyz; vMat = aMat;
  vec3 v = normalize(uCam - w.xyz);
  float nd = dot(n,uLDir);
  float lam = uStyle == 2.0 ? nd*0.5+0.5 : max(nd,0.0);   // hand-painted: wrapped light
  vec3 l = uAmb * (0.75 + 0.25*n.y) + uLCol*lam;
  l += uRim * pow(1.0 - max(dot(n,v),0.0), 3.0);
  if(uPRad > 0.0){ vec3 d = uPPos - w.xyz; float a = clamp(1.0 - length(d)/uPRad,0.0,1.0); l += uPCol*a*a*max(dot(n,normalize(d)),0.15); }
  vLight = l;
  vSpec = vec3(0.0);
  if(uVertexSpec > 0.5 && aMat > 0.5){
    vec3 h = normalize(uLDir+v); float s = pow(max(dot(n,h),0.0), aMat > 1.5 ? 24.0 : 10.0);
    vSpec = uLCol*s*(aMat > 1.5 ? 0.9 : 0.4) + env(reflect(-v,n)) * (aMat > 1.5 ? 0.3 : 0.1);
    if(uPRad > 0.0){ vec3 d = normalize(uPPos - w.xyz); vSpec += uPCol * pow(max(dot(n, normalize(d+v)),0.0), 20.0) * 0.8 * clamp(1.0 - length(uPPos-w.xyz)/uPRad,0.0,1.0); }
  }
  vFog = clamp((length(uCam - w.xyz) - uFogP.x)/uFogP.y, 0.0, 1.0);
  vFlatUV = aUV; vCol = aCol;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vAff; flat in vec2 vFlatUV; in vec3 vCol; in vec2 vUV; in vec3 vLight; in float vFog; in vec3 vN; in vec3 vW; in float vMat; in vec3 vSpec;
uniform sampler2D uTex; uniform float uAffine, uDither, uWire, uStyle, uVertexSpec, uPRad; uniform vec3 uAmb;
uniform vec3 uFog, uLDir, uLCol, uCam, uSkyUp, uSkyHor, uSkyDn, uPPos, uPCol; uniform vec4 uWireCol;
out vec4 o;
float bayer(vec2 p){ ivec2 i = ivec2(mod(p,4.0)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[i.y*4+i.x])+0.5)/16.0; }
vec3 env(vec3 r){ float y = r.y; vec3 c = y > 0.0 ? mix(uSkyHor, uSkyUp, pow(y,0.6)) : mix(uSkyHor*0.6, uSkyDn, pow(-y,0.4)); c += uSkyHor * 0.8 * exp(-abs(y)*14.0); return c; }
void main(){
  if(uWire > 0.5){ o = uWireCol; return; }
  vec2 uv = uAffine > 0.5 ? vAff.xy/vAff.z : vUV;
  vec4 t = texture(uTex, uv);
  if(uStyle == 7.0){ vec4 tf = textureLod(uTex, vFlatUV, 8.0); t = vec4(mix(tf.rgb, t.rgb, 0.15), t.a); }
  // facet hybrids: one averaged colour per triangle, mixed with the pixel texture
  vec3 faceAvg = textureLod(uTex, vFlatUV, 2.0).rgb;
  if(uStyle == 9.0) t.rgb = mix(faceAvg, t.rgb, 0.45);
  if(uStyle == 10.0) t.rgb = vMat > 0.1 ? t.rgb : mix(faceAvg, t.rgb, 0.3);   // 0.25 = painted detail (face, heraldry)
  if(t.a < (uDither > 0.5 ? bayer(gl_FragCoord.xy) : 0.5)) discard;
  vec3 base = t.rgb * vCol;
  vec3 light = vLight;
  if(uStyle == 7.0){ vec3 fn = normalize(cross(dFdx(vW), dFdy(vW))); float nd = max(dot(fn, uLDir), 0.0); light = vLight*0.45 + uLCol*nd*0.75; }
  vec3 fN = normalize(cross(dFdx(vW), dFdy(vW)));
  if(uStyle >= 8.0){
    vec3 fl = uAmb*(0.75 + 0.25*fN.y) + uLCol*max(dot(fN,uLDir),0.0);
    if(uPRad > 0.0){ vec3 d = uPPos - vW; float a = clamp(1.0 - length(d)/uPRad,0.0,1.0); fl += uPCol*a*a*max(dot(fN,normalize(d)),0.15); }
    light = mix(vLight, fl, 0.8);
  }
  if(uStyle == 4.0){ // ink cel: three hard bands
    float L = dot(light, vec3(0.333));
    float b = L < 0.32 ? 0.28 : L < 0.75 ? 0.62 : 1.0;
    light = light / max(L,0.001) * b;
  }
  vec3 c = base * light;
  if(uStyle == 2.0){ float g = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(g), c, 1.25); }   // painted: richer colour
  // metal
  if(vMat > 2.5) c = base * 1.6;   // unlit / emissive (fire, embers)
  else if(vMat > 0.5){
    vec3 spec;
    if(uVertexSpec > 0.5) spec = vSpec;
    else {
      vec3 n = uStyle >= 8.0 ? fN : normalize(vN), v = normalize(uCam - vW), h = normalize(uLDir+v);
      float p = vMat > 1.5 ? 48.0 : 14.0;
      float s = pow(max(dot(n,h),0.0), p);
      if(uStyle == 4.0) s = step(0.45, s);
      spec = uLCol*s*(vMat > 1.5 ? 1.1 : 0.45) + env(reflect(-v,n)) * (vMat > 1.5 ? 0.32 : 0.1);
      if(uPRad > 0.0){ float a = clamp(1.0 - length(uPPos-vW)/uPRad,0.0,1.0); spec += uPCol * pow(max(dot(n, normalize(normalize(uPPos-vW)+v)),0.0), 32.0) * a; }
    }
    float lum = dot(base, vec3(0.333));
    // mail sparkles only on the bright ring tops; plate keeps its painted bands
    c += spec * (vMat > 1.5 ? (0.25 + lum * 0.8) : smoothstep(0.45, 0.75, lum) * 1.3);
    if(vMat > 1.5) c *= 0.85;
  }
  c = mix(c, uFog, vFog);
  if(uStyle == 3.0){   // 1-bit print
    float g = dot(c, vec3(0.299,0.587,0.114));
    float th = bayer(gl_FragCoord.xy);
    c = g * 1.35 > th ? vec3(0.86,0.83,0.74) : vec3(0.1,0.09,0.11);
  } else if(uDither > 0.5){
    c += (bayer(gl_FragCoord.xy) - 0.5) / 31.0;
    c = floor(clamp(c,0.0,1.0)*31.0 + 0.5)/31.0;
  }
  o = vec4(c, 1.0);
}`;

const POST_VS = `#version 300 es
out vec2 vP; void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vP = p; gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;
const POST_FS = `#version 300 es
precision highp float; in vec2 vP; uniform sampler2D uC, uD; uniform vec2 uRes; uniform float uOutline, uNear, uFar, uPost, uTime; uniform vec3 uInk; out vec4 o;
float bayer(vec2 p){ ivec2 i = ivec2(mod(p,4.0)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[i.y*4+i.x])+0.5)/16.0; }
const vec3 PAL[16] = vec3[16](vec3(0.067,0.059,0.071),vec3(0.149,0.122,0.118),vec3(0.267,0.208,0.176),vec3(0.420,0.322,0.231),vec3(0.596,0.486,0.341),vec3(0.792,0.725,0.580),
  vec3(0.165,0.180,0.200),vec3(0.310,0.329,0.361),vec3(0.502,0.522,0.549),vec3(0.737,0.749,0.765),vec3(0.329,0.090,0.071),vec3(0.565,0.161,0.110),
  vec3(0.208,0.235,0.153),vec3(0.365,0.380,0.235),vec3(0.722,0.502,0.275),vec3(0.180,0.216,0.290));
vec3 pal(vec3 c){ float bd = 1e9; vec3 b = c; for(int i=0;i<16;i++){ vec3 d = c-PAL[i]; float dd = dot(d,d); if(dd<bd){bd=dd;b=PAL[i];} } return b; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float lin(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }
void main(){
  vec2 px = floor(vP*uRes) + 0.5;
  vec3 c = texture(uC, px/uRes).rgb;
  if(uOutline > 0.5){
    float d0 = lin(texture(uD, px/uRes).r), e = 0.0;
    for(int i=0;i<8;i++){ vec2 off = (i==0?vec2(1,0):i==1?vec2(-1,0):i==2?vec2(0,1):i==3?vec2(0,-1):i==4?vec2(1,1):i==5?vec2(-1,1):i==6?vec2(1,-1):vec2(-1,-1)) * (uRes.y > 380.0 ? 1.5 : 1.0);
      float d = lin(texture(uD, (px+off)/uRes).r); e = max(e, d - d0); }
    if(d0 < 7.0 && e > 0.035 + d0*0.012) c = uInk;
  }
  if(uPost == 1.0){   // horror: crushed, sickly grade, grain, heavy vignette
    float g = dot(c, vec3(0.299,0.587,0.114));
    c = mix(vec3(g), c, 0.55) * vec3(0.95,1.0,0.86);
    c = pow(c, vec3(1.15));
    c += (hash(px + fract(uTime)*91.0) - 0.5) * 0.09;
    vec2 q = vP - 0.5; c *= 1.0 - dot(q,q)*1.6;
  } else if(uPost == 2.0){
    c = pal(c + (bayer(px) - 0.5) * 0.09);
  } else if(uPost == 3.0){   // grimdark: drained colour (blood keeps its red), cold shadows, sallow light, grain
    float g = dot(c, vec3(0.299,0.587,0.114));
    float red = clamp((c.r - max(c.g, c.b)) * 5.0 - 0.15, 0.0, 1.0);
    float fire = clamp((c.r - c.b) * 2.5 - 0.9, 0.0, 1.0) * step(0.55, c.r);
    c = mix(vec3(g), c, mix(0.38, 1.0, max(red, fire)));
    c = mix(c * vec3(0.84, 0.93, 0.97), c * vec3(1.06, 1.0, 0.84), smoothstep(0.12, 0.65, g));
    c = clamp((c - 0.4) * 1.1 + 0.41, 0.0, 1.0);
    c += (hash(px + fract(uTime) * 91.0) - 0.5) * 0.045;
    vec2 q = vP - 0.5; c *= 1.0 - dot(q, q) * 0.9;
  }
  o = vec4(c,1.0);
}`;

export interface GMesh { vao: WebGLVertexArrayObject; count: number; wvao: WebGLVertexArrayObject; wcount: number; tex: number }
export interface Light { dir: number[]; col: number[]; amb: number[]; rim: number[]; fog: number[]; sky: number[][]; point?: { pos: number[]; col: number[]; rad: number } }
export interface Mode { res: number; snap: boolean; affine: boolean; dither: boolean; bilinear: boolean; shader: number; outline: boolean; vertexSpec: boolean; post: number; fog: [number, number] }

function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const sh = (t: number, s: string) => { const x = gl.createShader(t)!; gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)!); return x; };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i)!; u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export class PSX {
  gl: WebGL2RenderingContext;
  main; post;
  texs: WebGLTexture[] = [];
  fb: WebGLFramebuffer | null = null; ctex: WebGLTexture | null = null; dtex: WebGLTexture | null = null;
  fw = 0; fh = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true })!;
    if (!gl) throw new Error("WebGL2 niedostępne");
    this.gl = gl;
    this.main = program(gl, VS, FS);
    this.post = program(gl, POST_VS, POST_FS);
    gl.vertexAttrib3f(4, 1, 1, 1);   // default vertex colour: white
  }

  setTexture(slot: number, img: ImageData, bilinear: boolean, repeat = false, mips = false) {
    const gl = this.gl;
    if (!this.texs[slot]) this.texs[slot] = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texs[slot]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const f = bilinear ? gl.LINEAR : gl.NEAREST;
    if (repeat || mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, repeat ? (bilinear ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST) : mips ? gl.NEAREST_MIPMAP_NEAREST : f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  }

  upload(t: { pos: number[]; nor: number[]; uv: number[]; mats: number[]; col?: number[] }, tex = 0, wire = true): GMesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = (data: number[], loc: number, size: number) => {
      const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(t.pos, 0, 3); buf(t.nor, 1, 3); buf(t.uv, 2, 2); buf(t.mats, 3, 1);
    if (t.col) buf(t.col, 4, 3); else gl.disableVertexAttribArray(4);
    const wp: number[] = [];
    for (let i = 0; wire && i < t.pos.length; i += 9) {
      const v = [t.pos.slice(i, i + 3), t.pos.slice(i + 3, i + 6), t.pos.slice(i + 6, i + 9)];
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) wp.push(...v[a], ...v[b]);
    }
    const wvao = gl.createVertexArray()!;
    gl.bindVertexArray(wvao);
    buf(wp, 0, 3);
    gl.vertexAttrib3f(1, 0, 1, 0); gl.vertexAttrib2f(2, 0, 0); gl.vertexAttrib1f(3, 0); gl.vertexAttrib3f(4, 1, 1, 1);
    gl.bindVertexArray(null);
    return { vao, count: t.pos.length / 3, wvao, wcount: wp.length / 3, tex };
  }

  private ensureFb(w: number, h: number) {
    if (this.fb && w === this.fw && h === this.fh) return;
    const gl = this.gl;
    if (this.fb) { gl.deleteFramebuffer(this.fb); gl.deleteTexture(this.ctex); gl.deleteTexture(this.dtex); }
    const mk = (internal: number, fmt: number, type: number) => {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.ctex = mk(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this.dtex = mk(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ctex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.dtex, 0);
    this.fw = w; this.fh = h;
  }

  size(mode: Mode) {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    return [Math.round(mode.res * aspect), mode.res];
  }

  render(mode: Mode, vp: Mat4, cam: number[], light: Light, items: { mesh: GMesh; model: Mat4 }[], wire: boolean, bg: number[], near: number, far: number) {
    const gl = this.gl;
    const [w, h] = this.size(mode);
    this.ensureFb(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const { p, u } = this.main;
    gl.useProgram(p);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uSnap, mode.snap ? 1 : 0);
    gl.uniform1f(u.uAffine, mode.affine ? 1 : 0);
    gl.uniform1f(u.uDither, mode.dither ? 1 : 0);
    gl.uniform1f(u.uStyle, mode.shader);
    gl.uniform1f(u.uVertexSpec, mode.vertexSpec ? 1 : 0);
    gl.uniform2f(u.uFogP, mode.fog[0], mode.fog[1]);
    gl.uniform3fv(u.uLDir, light.dir); gl.uniform3fv(u.uLCol, light.col); gl.uniform3fv(u.uAmb, light.amb);
    gl.uniform3fv(u.uRim, light.rim); gl.uniform3fv(u.uFog, light.fog); gl.uniform3fv(u.uCam, cam);
    gl.uniform3fv(u.uSkyUp, light.sky[0]); gl.uniform3fv(u.uSkyHor, light.sky[1]); gl.uniform3fv(u.uSkyDn, light.sky[2]);
    gl.uniform3fv(u.uPPos, light.point?.pos ?? [0, 0, 0]); gl.uniform3fv(u.uPCol, light.point?.col ?? [0, 0, 0]); gl.uniform1f(u.uPRad, light.point?.rad ?? 0);
    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.uWire, 0);
    let bound = -1;
    for (const it of items) {
      if (it.mesh.tex !== bound) { gl.bindTexture(gl.TEXTURE_2D, this.texs[it.mesh.tex]); bound = it.mesh.tex; }
      gl.uniformMatrix4fv(u.uModel, false, it.model); gl.bindVertexArray(it.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count);
    }
    if (wire) {
      gl.uniform1f(u.uWire, 1); gl.uniform4f(u.uWireCol, 0.95, 0.78, 0.35, 1);
      gl.disable(gl.DEPTH_TEST);
      for (const it of items) { if (it.mesh.wcount === 0) continue; gl.uniformMatrix4fv(u.uModel, false, it.model); gl.bindVertexArray(it.mesh.wvao); gl.drawArrays(gl.LINES, 0, it.mesh.wcount); }
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    // post: upscale + outlines
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.post.p);
    const pu = this.post.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ctex); gl.uniform1i(pu.uC, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dtex); gl.uniform1i(pu.uD, 1);
    gl.uniform2f(pu.uRes, w, h); gl.uniform1f(pu.uOutline, mode.outline ? 1 : 0); gl.uniform1f(pu.uPost, mode.post); gl.uniform1f(pu.uTime, performance.now() / 1000);
    gl.uniform1f(pu.uNear, near); gl.uniform1f(pu.uFar, far);
    gl.uniform3fv(pu.uInk, mode.shader === 3 ? [0.1, 0.09, 0.11] : [0.06, 0.05, 0.06]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}

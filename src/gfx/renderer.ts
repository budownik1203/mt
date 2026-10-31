// WebGL2 renderer: sky, flat-shaded lit meshes with sun shadow map, point
// lights (torches/fires), height fog, filmic grading; plus a line pass for rain.
import { Mat4, m4, mul, ortho, lookAt, invert, V3 } from "../core/math.ts";
import { MeshBuilder } from "./meshbuilder.ts";

export interface Mesh { vao: WebGLVertexArrayObject; svao: WebGLVertexArrayObject; count: number; }
export interface DrawItem { mesh: Mesh; model: Mat4; tint?: [number, number, number, number]; noShadow?: boolean; }

export interface Lighting {
  sunDir: V3;            // direction TO the sun
  sunColor: V3;
  skyColor: V3;          // ambient from above
  groundColor: V3;       // ambient from below
  fogColor: V3;
  fogDensity: number;
  zenith: V3;
  horizon: V3;
  night: number;         // 0..1 stars
  points: { pos: V3; color: V3; radius: number }[];
  exposure: number;
  wet: number;           // rain darkening
}

const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol;
uniform mat4 uModel, uVP, uLVP;
out vec3 vW; out vec3 vN; out vec3 vC; out vec4 vL;
void main(){
  vec4 w = uModel * vec4(aPos,1.0);
  vW = w.xyz; vN = mat3(uModel) * aNor; vC = aCol; vL = uLVP * w;
  gl_Position = uVP * w;
}`;

const LIT_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec3 vC; in vec4 vL;
uniform sampler2DShadow uShadow;
uniform vec3 uSunDir, uSunCol, uSky, uGround, uFog, uCam;
uniform float uFogD, uExposure, uWet; uniform vec4 uTint;
uniform vec3 uPPos[4]; uniform vec3 uPCol[4]; uniform float uPRad[4];
out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float shadow(){
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
  float s = 0.0; vec2 t = vec2(1.0/2048.0);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s += texture(uShadow, vec3(p.xy+vec2(x,y)*t*1.5, p.z-0.0015));
  return s/9.0;
}
void main(){
  vec3 n = normalize(vN);
  if(!gl_FrontFacing) n = -n;
  vec3 alb = vC * (1.0 - uWet*0.25);
  if(uTint.a > 0.0) alb = mix(alb, uTint.rgb, uTint.a);
  float nd = max(dot(n, uSunDir), 0.0);
  vec3 light = uSunCol * nd * shadow();
  light += mix(uGround, uSky, n.y*0.5+0.5);
  for(int i=0;i<4;i++){
    if(uPRad[i] <= 0.0) continue;
    vec3 d = uPPos[i]-vW; float dist = length(d);
    float att = clamp(1.0 - dist/uPRad[i], 0.0, 1.0); att *= att;
    light += uPCol[i] * att * (0.35 + 0.65*max(dot(n, d/dist), 0.0));
  }
  vec3 col = alb * light;
  // wet sheen on upward faces
  vec3 v = normalize(uCam - vW);
  col += uWet * 0.25 * uSunCol * pow(max(dot(reflect(-uSunDir,n), v),0.0), 24.0) * n.y;
  if(uTint.a < 0.0) col = uTint.rgb * (-uTint.a);
  float dist = length(uCam - vW);
  float hf = exp(-max(vW.y,0.0)*0.04);
  float f = 1.0 - exp(-dist*uFogD*(0.5+hf));
  col = mix(col, uFog, clamp(f,0.0,1.0));
  col = aces(col*uExposure);
  float g = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(g), col, 0.86);                 // grimdark desaturation
  col = pow(col, vec3(1.0/2.2));
  o = vec4(col, 1.0);
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uModel, uLVP;
void main(){ gl_Position = uLVP * uModel * vec4(aPos,1.0); }`;
const SH_FS = `#version 300 es
precision mediump float; void main(){}`;

const SKY_VS = `#version 300 es
out vec2 vP; void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2)*2.0-1.0; vP=p; gl_Position=vec4(p,0.9999,1.0); }`;
const SKY_FS = `#version 300 es
precision highp float; in vec2 vP; uniform mat4 uInvVP; uniform vec3 uZen, uHor, uSunDir, uSunCol, uFog; uniform float uNight, uFogD, uExposure;
out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float h(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec4 a = uInvVP*vec4(vP,-1.0,1.0), b = uInvVP*vec4(vP,1.0,1.0);
  vec3 d = normalize(b.xyz/b.w - a.xyz/a.w);
  float t = clamp(d.y*1.6, 0.0, 1.0);
  vec3 c = mix(uHor, uZen, pow(t, 0.6));
  float s = max(dot(d,uSunDir),0.0);
  c += uSunCol * (pow(s, 600.0)*6.0 + pow(s,8.0)*0.25);
  if(d.y>0.0){ vec3 q = floor(d*300.0); float st = step(0.9985, h(q)); c += vec3(st)*uNight*0.8*t; }
  c = mix(c, uFog, clamp(1.0-d.y*4.0, 0.0, 1.0)*clamp(uFogD*60.0,0.0,0.95));
  c = aces(c*uExposure);
  float g = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(g), c, 0.86);
  o = vec4(pow(c, vec3(1.0/2.2)),1.0);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP; void main(){ gl_Position = uVP*vec4(aPos,1.0); }`;
const LINE_FS = `#version 300 es
precision mediump float; uniform vec4 uCol; out vec4 o; void main(){ o = uCol; }`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => {
    const sh = gl.createShader(t)!;
    gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader");
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    const name = info.name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Renderer {
  gl: WebGL2RenderingContext;
  lit; sh; sky; line;
  shadowTex: WebGLTexture; shadowFb: WebGLFramebuffer;
  lineBuf: WebGLBuffer; lineVao: WebGLVertexArrayObject;
  view = m4(); proj = m4(); vp = m4(); lvp = m4(); invVp = m4();
  camPos: V3 = [0, 0, 0];
  readonly SH = 2048;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2");
    this.gl = gl;
    this.lit = compile(gl, LIT_VS, LIT_FS);
    this.sh = compile(gl, SH_VS, SH_FS);
    this.sky = compile(gl, SKY_VS, SKY_FS);
    this.line = compile(gl, LINE_VS, LINE_FS);
    this.shadowTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.SH, this.SH);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lineBuf = gl.createBuffer()!;
    this.lineVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  upload(b: MeshBuilder): Mesh {
    const gl = this.gl;
    const mk = (data: number[], loc: number) => {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      return buf;
    };
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const pb = mk(b.pos, 0); mk(b.nor, 1); mk(b.col, 2);
    const svao = gl.createVertexArray()!;
    gl.bindVertexArray(svao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, svao, count: b.count };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  setCamera(view: Mat4, proj: Mat4, pos: V3) {
    this.view.set(view); this.proj.set(proj); this.camPos = pos;
    mul(this.vp, proj, view);
    invert(this.invVp, this.vp);
  }

  frame(items: DrawItem[], L: Lighting, focus: V3, lines?: { data: Float32Array; color: [number, number, number, number] }) {
    const gl = this.gl;
    // --- shadow pass (orthographic, centred on focus) ---
    const R = 45;
    const sd = L.sunDir[1] > 0.05 ? L.sunDir : ([L.sunDir[0], 0.05, L.sunDir[2]] as V3);
    const eye: V3 = [focus[0] + sd[0] * 120, focus[1] + sd[1] * 120, focus[2] + sd[2] * 120];
    const lv = lookAt(m4(), eye, focus, Math.abs(sd[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
    const lp = ortho(m4(), -R, R, -R, R, 1, 300);
    mul(this.lvp, lp, lv);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.viewport(0, 0, this.SH, this.SH);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p);
    gl.uniformMatrix4fv(this.sh.u.uLVP, false, this.lvp);
    for (const it of items) {
      if (it.noShadow) continue;
      gl.uniformMatrix4fv(this.sh.u.uModel, false, it.model);
      gl.bindVertexArray(it.mesh.svao);
      gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- main pass ---
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(L.fogColor[0], L.fogColor[1], L.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.depthMask(false);
    gl.useProgram(this.sky.p);
    const su = this.sky.u;
    gl.uniformMatrix4fv(su.uInvVP, false, this.invVp);
    gl.uniform3fv(su.uZen, L.zenith); gl.uniform3fv(su.uHor, L.horizon);
    gl.uniform3fv(su.uSunDir, L.sunDir); gl.uniform3fv(su.uSunCol, L.sunColor); gl.uniform3fv(su.uFog, L.fogColor);
    gl.uniform1f(su.uNight, L.night); gl.uniform1f(su.uFogD, L.fogDensity); gl.uniform1f(su.uExposure, L.exposure);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);

    gl.useProgram(this.lit.p);
    const u = this.lit.u;
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniformMatrix4fv(u.uLVP, false, this.lvp);
    gl.uniform3fv(u.uSunDir, L.sunDir); gl.uniform3fv(u.uSunCol, L.sunColor);
    gl.uniform3fv(u.uSky, L.skyColor); gl.uniform3fv(u.uGround, L.groundColor);
    gl.uniform3fv(u.uFog, L.fogColor); gl.uniform1f(u.uFogD, L.fogDensity);
    gl.uniform3fv(u.uCam, this.camPos); gl.uniform1f(u.uExposure, L.exposure); gl.uniform1f(u.uWet, L.wet);
    const pp = new Float32Array(12), pc = new Float32Array(12), pr = new Float32Array(4);
    L.points.slice(0, 4).forEach((p, i) => { pp.set(p.pos, i * 3); pc.set(p.color, i * 3); pr[i] = p.radius; });
    gl.uniform3fv(u.uPPos, pp); gl.uniform3fv(u.uPCol, pc); gl.uniform1fv(u.uPRad, pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadow, 0);
    const none = [0, 0, 0, 0];
    for (const it of items) {
      gl.uniformMatrix4fv(u.uModel, false, it.model);
      gl.uniform4fv(u.uTint, it.tint || none);
      gl.bindVertexArray(it.mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count);
    }

    if (lines && lines.data.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.line.p);
      gl.uniformMatrix4fv(this.line.u.uVP, false, this.vp);
      gl.uniform4fv(this.line.u.uCol, lines.color);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lines.data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, lines.data.length / 3);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }
}

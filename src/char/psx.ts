// Retro renderer for the model lab: low internal resolution, vertex snapping,
// affine texture warp, Gouraud vertex lighting, 15-bit colour with ordered
// dithering, dithered (screen-door) transparency. Upscaled with nearest.
import { Mat4 } from "../core/math.ts";
import { TMesh } from "./tmesh.ts";

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV;
uniform mat4 uModel, uVP; uniform vec2 uRes; uniform float uSnap;
uniform vec3 uLDir, uLCol, uAmb, uRim, uCam, uPPos, uPCol; uniform float uPRad;
out vec3 vAff; out vec2 vUV; out vec3 vLight; out float vFog;
void main(){
  vec4 w = uModel*vec4(aPos,1.0);
  vec4 p = uVP*w;
  if(uSnap > 0.5){ vec2 g = uRes*0.5; p.xy = floor(p.xy/p.w*g + 0.5)/g * p.w; }
  gl_Position = p;
  vUV = aUV; vAff = vec3(aUV*p.w, p.w);
  vec3 n = normalize(mat3(uModel)*aNor);
  vec3 v = normalize(uCam - w.xyz);
  vec3 l = uAmb * (0.75 + 0.25*n.y) + uLCol*max(dot(n,uLDir),0.0);
  l += uRim * pow(1.0 - max(dot(n,v),0.0), 3.0);
  if(uPRad > 0.0){ vec3 d = uPPos - w.xyz; float a = clamp(1.0 - length(d)/uPRad,0.0,1.0); l += uPCol*a*a*max(dot(n,normalize(d)),0.15); }
  vLight = l;
  vFog = clamp((length(uCam - w.xyz) - 3.5)/9.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vAff; in vec2 vUV; in vec3 vLight; in float vFog;
uniform sampler2D uTex; uniform float uAffine, uDither, uWire; uniform vec3 uFog; uniform vec4 uWireCol;
out vec4 o;
float bayer(vec2 p){ ivec2 i = ivec2(mod(p,4.0)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[i.y*4+i.x])+0.5)/16.0; }
void main(){
  if(uWire > 0.5){ o = uWireCol; return; }
  vec2 uv = uAffine > 0.5 ? vAff.xy/vAff.z : vUV;
  vec4 t = texture(uTex, uv);
  if(t.a < (uDither > 0.5 ? bayer(gl_FragCoord.xy) : 0.5)) discard;
  vec3 c = t.rgb * vLight;
  c = mix(c, uFog, vFog);
  if(uDither > 0.5){
    c += (bayer(gl_FragCoord.xy) - 0.5) / 31.0;
    c = floor(clamp(c,0.0,1.0)*31.0 + 0.5)/31.0;   // 5 bits per channel
  }
  o = vec4(c, 1.0);
}`;

export interface GMesh { vao: WebGLVertexArrayObject; count: number; wvao: WebGLVertexArrayObject; wcount: number }
export interface Light { dir: number[]; col: number[]; amb: number[]; rim: number[]; fog: number[]; point?: { pos: number[]; col: number[]; rad: number } }
export interface Mode { res: number; snap: boolean; affine: boolean; dither: boolean; bilinear: boolean }

export class PSX {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> = {};
  tex: WebGLTexture;
  fb: WebGLFramebuffer | null = null; color: WebGLRenderbuffer | null = null; depth: WebGLRenderbuffer | null = null;
  fw = 0; fh = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true })!;
    if (!gl) throw new Error("WebGL2 niedostępne");
    this.gl = gl;
    const sh = (t: number, s: string) => { const x = gl.createShader(t)!; gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)!); return x; };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(this.prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.prog)!);
    const n = gl.getProgramParameter(this.prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(this.prog, i)!; this.u[a.name] = gl.getUniformLocation(this.prog, a.name); }
    this.tex = gl.createTexture()!;
  }

  setTexture(img: ImageData, bilinear: boolean) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const f = bilinear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  upload(t: TMesh): GMesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = (data: number[], loc: number, size: number) => {
      const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(t.pos, 0, 3); buf(t.nor, 1, 3); buf(t.uv, 2, 2);
    // wireframe: every triangle edge as a line
    const wp: number[] = [];
    for (let i = 0; i < t.pos.length; i += 9) {
      const v = [t.pos.slice(i, i + 3), t.pos.slice(i + 3, i + 6), t.pos.slice(i + 6, i + 9)];
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) wp.push(...v[a], ...v[b]);
    }
    const wvao = gl.createVertexArray()!;
    gl.bindVertexArray(wvao);
    buf(wp, 0, 3);
    gl.disableVertexAttribArray(1); gl.vertexAttrib3f(1, 0, 1, 0);
    gl.disableVertexAttribArray(2); gl.vertexAttrib2f(2, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: t.pos.length / 3, wvao, wcount: wp.length / 3 };
  }

  private ensureFb(w: number, h: number) {
    if (this.fb && w === this.fw && h === this.fh) return;
    const gl = this.gl;
    if (this.fb) { gl.deleteFramebuffer(this.fb); gl.deleteRenderbuffer(this.color); gl.deleteRenderbuffer(this.depth); }
    this.fb = gl.createFramebuffer(); this.color = gl.createRenderbuffer(); this.depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.color); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    this.fw = w; this.fh = h;
  }

  /** Internal size for the current canvas aspect. */
  size(mode: Mode) {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    return [Math.round(mode.res * aspect), mode.res];
  }

  render(mode: Mode, vp: Mat4, cam: number[], light: Light, items: { mesh: GMesh; model: Mat4 }[], wire: boolean, bg: number[]) {
    const gl = this.gl;
    const [w, h] = this.size(mode);
    this.ensureFb(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    const u = this.u;
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uSnap, mode.snap ? 1 : 0);
    gl.uniform1f(u.uAffine, mode.affine ? 1 : 0);
    gl.uniform1f(u.uDither, mode.dither ? 1 : 0);
    gl.uniform3fv(u.uLDir, light.dir); gl.uniform3fv(u.uLCol, light.col); gl.uniform3fv(u.uAmb, light.amb);
    gl.uniform3fv(u.uRim, light.rim); gl.uniform3fv(u.uFog, light.fog); gl.uniform3fv(u.uCam, cam);
    gl.uniform3fv(u.uPPos, light.point?.pos ?? [0, 0, 0]); gl.uniform3fv(u.uPCol, light.point?.col ?? [0, 0, 0]); gl.uniform1f(u.uPRad, light.point?.rad ?? 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uTex, 0);
    gl.uniform1f(u.uWire, 0);
    for (const it of items) { gl.uniformMatrix4fv(u.uModel, false, it.model); gl.bindVertexArray(it.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count); }
    if (wire) {
      gl.uniform1f(u.uWire, 1); gl.uniform4f(u.uWireCol, 0.95, 0.78, 0.35, 1);
      gl.disable(gl.DEPTH_TEST);
      for (const it of items) { if (it.mesh.wcount === 0) continue; gl.uniformMatrix4fv(u.uModel, false, it.model); gl.bindVertexArray(it.mesh.wvao); gl.drawArrays(gl.LINES, 0, it.mesh.wcount); }
      gl.enable(gl.DEPTH_TEST);
    }
    gl.bindVertexArray(null);
    // upscale with hard pixels
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

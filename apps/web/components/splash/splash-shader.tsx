'use client';

/**
 * WebGL shader backdrop for the Denimisia splash gate.
 *
 * A chromatic liquid-metal pool with warped noise fields; mouse pulls the
 * metal toward the cursor, rim chromatic highlight tightens with pressure.
 *
 * Renders a fullscreen <canvas>. Falls back silently to plain black if WebGL
 * is unavailable.
 */

import { useEffect, useRef } from 'react';

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FS = `
precision highp float;
varying vec2 vUv;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uPressed;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i+vec2(1.,0.));
  float c = hash(i+vec2(0.,1.)); float d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(uRes.x/uRes.y, 1.0);

  float t = uTime * 0.35;

  // warp field
  vec2 q = p*1.6;
  q += 0.5*vec2(fbm(q + t), fbm(q - t + 3.3));
  float n = fbm(q*1.4 + t*0.7);

  // pull toward mouse
  vec2 toM = m - p;
  float d = length(toM);
  float pull = 0.14 * (0.35 + 0.9*uPressed) / (d*d + 0.25);
  n += pull;

  // metal bands: cosine of warped height
  float bands = cos(n * 9.0 + t*0.6);

  // darker palette: near-black -> gunmetal -> dim pearl
  vec3 cA = vec3(0.010, 0.012, 0.020);
  vec3 cB = vec3(0.075, 0.100, 0.150);
  vec3 cC = vec3(0.42, 0.46, 0.54);
  vec3 col = mix(cA, cB, smoothstep(-0.2, 0.6, n));
  col = mix(col, cC, pow(smoothstep(0.55, 1.0, bands), 4.0));

  // chromatic rim near mouse (tighter, dimmer)
  float rim = smoothstep(0.45, 0.0, d);
  col += vec3(0.20, 0.32, 0.60) * rim * 0.14;

  // vignette
  float vg = smoothstep(1.05, 0.15, length(p));
  col *= mix(0.35, 0.88, vg);

  // subtle grain
  float g = hash(uv*uRes.xy + uTime*60.0) - 0.5;
  col += g * 0.025;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, src: string, type: number): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Splash shader compile error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function SplashShader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const vs = compile(gl, VS, gl.VERTEX_SHADER);
    const fs = compile(gl, FS, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Splash shader link error:', gl.getProgramInfoLog(prog));
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos        = gl.getAttribLocation(prog, 'aPos');
    const uRes        = gl.getUniformLocation(prog, 'uRes');
    const uTime       = gl.getUniformLocation(prog, 'uTime');
    const uMouse      = gl.getUniformLocation(prog, 'uMouse');
    const uPressed    = gl.getUniformLocation(prog, 'uPressed');

    const state = {
      mx: 0.5, my: 0.5, tmx: 0.5, tmy: 0.5,
      pressed: 0, pressedTarget: 0,
      time0: performance.now(),
      lastFrame: performance.now(),
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }
    resize();

    const onResize = () => resize();
    const onMove = (e: PointerEvent) => {
      state.tmx = e.clientX / window.innerWidth;
      state.tmy = 1.0 - e.clientY / window.innerHeight;
    };
    const onDown = () => { state.pressedTarget = 1; };
    const onUp = () => { state.pressedTarget = 0; };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerleave', onUp);

    let rafId = 0;
    let active = true;

    const render = () => {
      if (!active) return;
      const now = performance.now();
      state.lastFrame = now;

      state.mx += (state.tmx - state.mx) * 0.12;
      state.my += (state.tmy - state.my) * 0.12;
      state.pressed += (state.pressedTarget - state.pressed) * 0.12;

      const t = (now - state.time0) / 1000;

      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, state.mx, state.my);
      gl.uniform1f(uPressed, state.pressed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerleave', onUp);
      gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

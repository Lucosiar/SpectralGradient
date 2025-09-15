// Obtiene el canvas y el contexto WebGL (renderizador de GPU)
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl');
if(!gl){ alert('WebGL no soportado'); }

// DPI/retina: usamos un factor máximo de 2 para no disparar el coste en pantallas muy densas
const DPR = Math.min(window.devicePixelRatio || 1, 2);

// Ajusta el tamaño REAL del canvas (en píxeles) y el viewport de WebGL
function resize(){
  const w = Math.floor(innerWidth * DPR);
  const h = Math.floor(innerHeight * DPR);
  canvas.width = w;           // tamaño del lienzo en píxeles reales
  canvas.height = h;
  canvas.style.width = innerWidth + 'px';   // tamaño CSS (visual)
  canvas.style.height = innerHeight + 'px';
  gl.viewport(0,0,w,h);       // dice a WebGL el área sobre la que dibujar
}
addEventListener('resize', resize);
resize(); // llamamos una vez al inicio

// --- Shaders -----------------------------------------------------------------

// Vertex shader: dibuja un triángulo gigante de pantalla completa.
// No transforma nada: pasa directamente posiciones clip-space.
const vert = `
attribute vec2 a_pos;            // atributo: posición 2D del vértice
void main(){
  gl_Position = vec4(a_pos, 0.0, 1.0); // posición final del vértice (clip-space)
}`;

// Fragment shader: genera el degradado espectral animado con ruido procedural.
// Tiene pan, zoom, tono, y velocidad de flujo configurables.
const frag = `
precision highp float;

uniform vec2  u_res;    // resolución del framebuffer (px)
uniform float u_time;   // tiempo en segundos (para animación)
uniform vec2  u_center; // desplazamiento (pan) en "coordenadas de mundo"
uniform float u_zoom;   // factor de zoom (1.0 = base)
uniform float u_hue;    // desplazamiento de tono [0..1]
uniform float u_flow;   // factor de velocidad del campo

// --- Value noise 2D + fbm ----------------------------------------------------
// hash: genera un pseudoaleatorio estable a partir de una posición 2D
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }

// noise: ruido interpolado entre esquinas de la celda
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f); // suaviza la interpolación (Hermite)
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

// fbm: "fractal brownian motion": suma de varios octavos de ruido con distinta escala
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){
    v += a * noise(p);
    p *= 2.0;   // duplica frecuencia
    a *= 0.5;   // reduce amplitud
  }
  return v;
}

// --- Utilidad: HSV -> RGB -----------------------------------------------------
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0., 2./3., 1./3.))*6. - 3.);
  vec3 rgb = clamp(p - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Paleta espectral: toma un valor [0..1] (t) y aplica desplazamiento de tono.
vec3 spectral(float t, float hueShift){
  float h = fract(t + hueShift);   // tono 0..1 (rueda de color)
  float s = 0.9;                   // saturación alta
  float v = 1.0;                   // brillo máximo
  return hsv2rgb(vec3(h, s, v));
}

void main(){
  // Coordenadas normalizadas de -1..1 preservando aspecto
  vec2 uv = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
  uv.x *= u_res.x / u_res.y;

  // Pan + zoom sobre el "mundo" procedural
  vec2 p = (uv / u_zoom) + u_center;

  // Warping del campo para sensación de fluido/niebla
  float t = u_time * u_flow;
  vec2 w1 = vec2(fbm(p*1.2 + t*0.06), fbm(p*1.3 - t*0.05));
  vec2 w2 = vec2(fbm(p*2.4 - t*0.09), fbm(p*2.0 + t*0.04));
  vec2 warp = (w1 + w2 - 1.0) * 0.6;

  // Ruido final con el warp aplicado
  float n = fbm(p*2.0 + warp + t*0.03);

  // Ajusta contraste + anti-banding (suaviza extremos)
  n = smoothstep(0.15, 0.95, n);

  // Coloriza con paleta espectral y desplazamiento de tono
  vec3 col = spectral(n, u_hue);

  // Viñeta suave hacia bordes para centrar la atención
  float vign = smoothstep(1.35, 0.0, dot(uv,uv));
  col *= mix(0.85, 1.0, vign);

  gl_FragColor = vec4(col, 1.0);
}`;

// --- Compilación y enlace del programa WebGL ---------------------------------

// Compila un shader (vertex o fragment) y devuelve el objeto shader
function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw gl.getShaderInfoLog(s);  // si falla, mostramos el error de compilación
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS))
  throw gl.getProgramInfoLog(prog); // error de enlace del programa
gl.useProgram(prog); // activamos el programa para dibujar

// --- Geometría: triángulo de pantalla completa -------------------------------
// Técnica del "full-screen triangle": 3 vértices que cubren toda la pantalla.
// Es más eficiente que un quad (evita bordes/diagonales).
const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1,-1,   // v0
   3,-1,   // v1
  -1, 3    // v2
]), gl.STATIC_DRAW);

// Vincula el buffer al atributo a_pos del vertex shader
const a_pos = gl.getAttribLocation(prog,'a_pos');
gl.enableVertexAttribArray(a_pos);
gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

// --- Uniforms: ubicaciones ----------------------------------------------------
const u_res    = gl.getUniformLocation(prog,'u_res');
const u_time   = gl.getUniformLocation(prog,'u_time');
const u_center = gl.getUniformLocation(prog,'u_center');
const u_zoom   = gl.getUniformLocation(prog,'u_zoom');
const u_hue    = gl.getUniformLocation(prog,'u_hue');
const u_flow   = gl.getUniformLocation(prog,'u_flow');

// --- Estado interactivo (pan/zoom/tono/velocidad) ----------------------------
const state = {
  centerX: 0.0,  // desplazamiento horizontal del campo procedural
  centerY: 0.0,  // desplazamiento vertical del campo procedural
  zoom: 1.0,     // factor de zoom (1 = normal)
  hue: 0.0,      // desplazamiento de tono (0..1)
  flow: 1.0      // velocidad de la animación del campo
};

// --- Interacción: arrastrar para pan -----------------------------------------
let dragging = false, lastX = 0, lastY = 0;

canvas.addEventListener('mousedown', e => {
  dragging = true;
  lastX = e.clientX; lastY = e.clientY;
  document.body.classList.add('dragging'); // cambia el cursor (opcional, si tienes CSS)
});

addEventListener('mouseup', () => {
  dragging = false;
  document.body.classList.remove('dragging');
});

addEventListener('mousemove', e => {
  if(!dragging) return;
  const dx = (e.clientX - lastX);
  const dy = (e.clientY - lastY);
  lastX = e.clientX; lastY = e.clientY;

  // Escala el pan según tamaño de ventana y zoom para que el movimiento sea "natural"
  const scale = 1 / (Math.min(innerWidth, innerHeight) * 0.5) * state.zoom;
  state.centerX -= dx * scale;  // mover a la izquierda con drag derecho
  state.centerY += dy * scale;  // mover hacia arriba con drag arriba
});

// --- Interacción: rueda para zoom --------------------------------------------
// Con la rueda hacemos zoom exponencial suave (no lineal) para mejor sensación
addEventListener('wheel', e => {
  const k = Math.exp(-e.deltaY * 0.001);        // factor de zoom por rueda
  state.zoom = Math.min(5, Math.max(0.4, state.zoom * k)); // clamp entre 0.4 y 5
});

// --- Interacción: teclado para cambiar tono (+ y -) --------------------------
// Nota: en algunos teclados, "+" puede ser "=" con Shift. Si quieres soportarlo,
// añade:  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') ...
addEventListener('keydown', e => {
  if(e.key === '-'){ state.hue = (state.hue - 0.01 + 1) % 1; } // tono hacia atrás
  if(e.key === '+'){ state.hue = (state.hue + 0.01) % 1; }     // tono hacia adelante
});

// --- Bucle de render: envía uniforms y dibuja cada frame ---------------------
let start = performance.now();
function frame(){
  const t = (performance.now() - start) / 1000; // tiempo en segundos

  // Actualiza uniforms cada frame
  gl.uniform2f(u_res, canvas.width, canvas.height);
  gl.uniform1f(u_time, t);
  gl.uniform2f(u_center, state.centerX, state.centerY);
  gl.uniform1f(u_zoom, state.zoom);
  gl.uniform1f(u_hue, state.hue);
  gl.uniform1f(u_flow, state.flow);

  // Dibuja el triángulo (que cubre toda la pantalla)
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Pide el siguiente frame
  requestAnimationFrame(frame);
}
frame();

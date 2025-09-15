# Spectral Gradient — fondo interactivo (WebGL)

Fondo “espectral/futurista” en WebGL que puedes mover (drag), hacer zoom (rueda) y cambiar el tono (+/−). Sin librerías.

## ✨ Demo rápida

Arrastra con el ratón → desplazamiento

Rueda del ratón → zoom

Teclas + / − → tono color

### Requiere navegador con WebGL habilitado.

## 📦 Estructura
/spectralgradient
├─ index.html     # Lienzo y UI mínima
├─ styles.css     # Estilos básicos
└─ script.js      # WebGL + shaders + interacción


index.html incluye un <canvas id="gl"> a pantalla completa y carga styles.css y script.js.

script.js crea el shader “espectral” (ruido procedural + paleta HSV), maneja pan/zoom/tono y dibuja cada frame.

styles.css fija el canvas a viewport completo y añade una mini ayuda visual.

## 🚀 Puesta en marcha

Copia los 3 archivos en la misma carpeta.

Abre index.html en el navegador (doble clic).

(Opcional) Sirve en local con un server estático:

```bash
  npx serve .
```
o
```bash
  python3 -m http.server 8080
```

## 🎮 Controles

Arrastrar (mouse): mueve el campo (deslizamientro).

Rueda del ratón: zoom suave (exponencial).

Teclas:

+ aumenta el tono

- reduce el tono

## ⚙️ Parámetros útiles

En script.js:

Resolución / rendimiento

```bash
const DPR = Math.min(window.devicePixelRatio || 1, 2); // baja a 1 para más FPS
```

Estado inicial
```bash
const state = {
  centerX: 0.0,   // pan inicial X
  centerY: 0.0,   // pan inicial Y
  zoom: 1.0,      // 0.4–5 aprox
  hue: 0.0,       // 0..1
  flow: 1.0       // velocidad del campo
};
```

En el fragment shader (frag dentro de script.js):

Octavas de FBM (calidad vs rendimiento): cambia for (int i=0;i<5;i++) a 4 o 3.

Contraste/suavizado

```bash
n = smoothstep(0.15, 0.95, n); // ajusta umbrales
```

Paleta (saturación y brillo)

```bash
float s = 0.9;  // saturación
float v = 1.0;  // brillo
```

Viñeta

```bash
float vign = smoothstep(1.35, 0.0, dot(uv,uv));
col *= mix(0.85, 1.0, vign);
```

## 🧩 Integración como fondo bajo tu landing
A) Solo visual (sin interacción)

Si no necesitas drag/zoom/teclas y quieres que la UI de tu página reciba el ratón:

```bash
#gl { pointer-events: none; position: fixed; inset: 0; z-index: -1; }
```

Coloca tu contenido normal encima.

B) Interactivo (drag/zoom activos)

Deja el canvas con eventos (como está) y pon tu contenido en un contenedor con pointer-events: none solo en elementos que no necesiten clic. Alterna pointer-events según lo que deba ser clicable.

📱 Soporte táctil (opcional)

Añade esto a script.js para pan con toque:

```bash
let tLastX=0, tLastY=0, tActive=false;
canvas.addEventListener('touchstart', (e)=>{
  const t=e.touches[0]; tActive=true; tLastX=t.clientX; tLastY=t.clientY;
}, {passive:true});
canvas.addEventListener('touchmove', (e)=>{
  if(!tActive) return;
  const t=e.touches[0];
  const dx=t.clientX - tLastX, dy=t.clientY - tLastY;
  tLastX=t.clientX; tLastY=t.clientY;
  const scale = 1 / (Math.min(innerWidth, innerHeight) * 0.5) * state.zoom;
  state.centerX -= dx * scale;
  state.centerY += dy * scale;
}, {passive:true});
canvas.addEventListener('touchend', ()=>{ tActive=false; });
```

## 🛠️ Problemas comunes

Pantalla negra / nada se ve:

Abre la consola: si hay error de shader, el throw muestra el log.

Asegúrate de que WebGL está habilitado (config del navegador / hardware acceleration).

Rendimiento bajo:

Baja DPR a 1, reduce octavas FBM (de 5 → 4), baja el zoom por defecto.

Rueda desplaza la página:

Añade un handler con passive:false y e.preventDefault() (solo si lo necesitas):

```bash
addEventListener('wheel', (e)=>{ e.preventDefault(); /* ... */ }, { passive:false });
```

## 📄 Licencia
MIT — úsalo, modifícalo y combínalo libremente en tu landing.
Cualquier mejora u optimización es agradecida.

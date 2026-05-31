/**
 * cinematic.js  v2 — LOVE.web
 * Scroll-driven frame sequence + atmospheric layer
 * ─────────────────────────────────────────────────
 * Requires: GSAP + ScrollTrigger already loaded in index.html
 * Frames:   /public/frames/frame0001.jpg … frame0080.jpg
 */

(function () {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────
  const TOTAL_FRAMES   = 80;
  const FRAME_PATH     = '/frames/';
  const FRAME_PREFIX   = 'frame';
  const FRAME_EXT      = '.jpg';
  const SCRUB_SPEED    = 0.8;             // faster scrub = snappier feel
  const CANVAS_ALPHA   = 0.92;
  const PARTICLE_COUNT = 40;
  const SPACER_VH      = 160;            // total intro height in vh (~1.6 screens)

  // ─── HELPERS ─────────────────────────────────────────────
  const pad4 = n => String(n).padStart(4, '0');
  const frameURL = i => `${FRAME_PATH}${FRAME_PREFIX}${pad4(i)}${FRAME_EXT}`;

  // ─── INJECT STYLES ───────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #cv-frame    { position:fixed; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; }
    #cv-fog      { position:fixed; inset:0; width:100%; height:100%; z-index:1; pointer-events:none; opacity:0; transition:opacity 2s ease; }
    #cv-particles{ position:fixed; inset:0; width:100%; height:100%; z-index:2; pointer-events:none; }
    #cv-loader   { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center;
                   justify-content:center; background:#000; z-index:9999; pointer-events:none;
                   transition:opacity 1s ease; }
    #cv-loader p { color:rgba(255,200,230,0.7); font-family:sans-serif; font-size:13px; margin-top:14px; letter-spacing:2px; }
    #cv-loader-bar-wrap { width:180px; height:2px; background:rgba(255,255,255,0.1); border-radius:2px; }
    #cv-loader-bar      { height:100%; width:0%; background:linear-gradient(90deg,#ff69b4,#bf5fff); border-radius:2px; transition:width 0.1s linear; }
  `;
  document.head.appendChild(style);

  // ─── LOADING SCREEN ──────────────────────────────────────
  const loader = document.createElement('div');
  loader.id = 'cv-loader';
  loader.innerHTML = `
    <div id="cv-loader-bar-wrap"><div id="cv-loader-bar"></div></div>
    <p>LOADING MEMORIES…</p>
  `;
  document.body.appendChild(loader);
  const loaderBar = document.getElementById('cv-loader-bar');

  // ─── CANVAS — FRAME LAYER ────────────────────────────────
  const frameCanvas = document.createElement('canvas');
  frameCanvas.id = 'cv-frame';
  document.body.prepend(frameCanvas);
  const fCtx = frameCanvas.getContext('2d');

  // ─── CANVAS — FOG LAYER ──────────────────────────────────
  const fogCanvas = document.createElement('canvas');
  fogCanvas.id = 'cv-fog';
  document.body.insertBefore(fogCanvas, frameCanvas.nextSibling);
  const fogCtx = fogCanvas.getContext('2d');

  // ─── CANVAS — PARTICLE LAYER ─────────────────────────────
  const partCanvas = document.createElement('canvas');
  partCanvas.id = 'cv-particles';
  document.body.appendChild(partCanvas);
  const pCtx = partCanvas.getContext('2d');

  // Lift all original body content above our layers
  document.querySelectorAll('body > *:not(#cv-frame):not(#cv-fog):not(#cv-particles):not(#cv-loader)').forEach(el => {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    if (Number(el.style.zIndex || 0) < 3) el.style.zIndex = '3';
  });

  // ─── RESIZE ──────────────────────────────────────────────
  let W, H;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    [frameCanvas, fogCanvas, partCanvas].forEach(c => {
      c.width  = W;
      c.height = H;
    });
    if (lastFrameImg) drawFrame(lastFrameImg);
  }
  window.addEventListener('resize', resize);

  // ─── FRAME RENDERING ─────────────────────────────────────
  let lastFrameImg = null;

  function drawFrame(img) {
    if (!img || !img.complete || !img.naturalWidth) return;
    fCtx.clearRect(0, 0, W, H);

    // Cover-fit the frame
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dx    = (W - img.naturalWidth  * scale) / 2;
    const dy    = (H - img.naturalHeight * scale) / 2;
    fCtx.globalAlpha = CANVAS_ALPHA;
    fCtx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
    fCtx.globalAlpha = 1;

    // Dark vignette overlay
    const vig = fCtx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    fCtx.fillStyle = vig;
    fCtx.fillRect(0, 0, W, H);
  }

  // ─── FRAME PRELOADING ────────────────────────────────────
  const frames = new Array(TOTAL_FRAMES).fill(null);
  let   loaded = 0;

  function preloadFrames(onReady) {
    let firstFrameReady = false;

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = i;

      img.onload = () => {
        frames[idx] = img;
        loaded++;

        // Show first frame immediately
        if (idx === 0 && !firstFrameReady) {
          firstFrameReady = true;
          lastFrameImg = img;
          resize();          // sets W/H and draws frame 0
          drawFrame(img);
        }

        // Progress bar
        const pct = (loaded / TOTAL_FRAMES) * 100;
        loaderBar.style.width = pct + '%';

        // All loaded
        if (loaded === TOTAL_FRAMES) {
          setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 1000);
            onReady();
          }, 400);
        }
      };

      img.onerror = () => {
        console.warn(`[cinematic] Failed to load: ${frameURL(i + 1)}`);
        loaded++;
        loaderBar.style.width = (loaded / TOTAL_FRAMES * 100) + '%';
        if (loaded === TOTAL_FRAMES) onReady();
      };

      img.src = frameURL(i + 1);   // frame0001 … frame0080
    }
  }

  // ─── SCROLL-DRIVEN SEQUENCE ──────────────────────────────
  let currentIdx = 0;

  function initScrollSequence() {
    gsap.registerPlugin(ScrollTrigger);

    // Compact spacer — only SPACER_VH tall, sits above site content
    const spacer = document.createElement('div');
    spacer.id = 'cv-spacer';
    spacer.style.cssText = `
      height: ${SPACER_VH}vh;
      pointer-events: none;
      position: relative;
      z-index: 0;
      flex-shrink: 0;
    `;
    const site = document.getElementById('site') || document.querySelector('[class*="site"]') || document.body.firstElementChild;
    if (site) document.body.insertBefore(spacer, site);

    const proxy = { frame: 0 };

    // ── Frame sequence scrub ──────────────────────────────
    gsap.to(proxy, {
      frame: TOTAL_FRAMES - 1,
      ease:  'none',
      scrollTrigger: {
        trigger:  spacer,
        start:    'top top',
        end:      'bottom top',
        scrub:    SCRUB_SPEED,
        pin:      true,
        anticipatePin: 1,
        onUpdate(self) {
          const i = Math.min(TOTAL_FRAMES - 1, Math.round(self.progress * (TOTAL_FRAMES - 1)));
          if (i !== currentIdx && frames[i]) {
            currentIdx   = i;
            lastFrameImg = frames[i];
            drawFrame(frames[i]);
          }

          // Start fading canvas out at 70% through the sequence
          // so content bleeds in while animation still plays
          if (self.progress > 0.7) {
            const fadeOut = (self.progress - 0.7) / 0.3; // 0→1 over last 30%
            frameCanvas.style.opacity = Math.max(0.15, CANVAS_ALPHA - fadeOut * (CANVAS_ALPHA - 0.15));
            fogCanvas.style.opacity   = Math.max(0,    1 - fadeOut * 0.8);
          } else {
            frameCanvas.style.opacity = CANVAS_ALPHA;
          }
        },
        onLeave() {
          // Canvas becomes a soft dark background layer behind content
          gsap.to(frameCanvas, { opacity: 0.12, duration: 1.2, ease: 'power2.out' });
          gsap.to(fogCanvas,   { opacity: 0,    duration: 1.0 });
        },
        onEnterBack() {
          gsap.to(frameCanvas, { opacity: CANVAS_ALPHA, duration: 0.6 });
          gsap.to(fogCanvas,   { opacity: 1,            duration: 0.8 });
        }
      }
    });

    // ── Content bleeds in early — at 60% scroll through intro ──
    const site2 = document.getElementById('site') || document.querySelector('[class*="site"]');
    if (site2) {
      gsap.fromTo(site2,
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1, y: 0,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger:      spacer,
            start:        '60% top',       // content starts appearing at 60% of intro
            end:          'bottom top',
            scrub:        false,
            toggleActions: 'play none none reverse'
          }
        }
      );
      // Initially hide site content until bleed-in point
      site2.style.opacity = '0';
    }
  }

  // ─── AMBIENT FOG ─────────────────────────────────────────
  let fogT = 0;
  function fogLoop() {
    fogCtx.clearRect(0, 0, W, H);
    fogT += 0.003;
    for (let i = 0; i < 4; i++) {
      const cx = W * (0.15 + 0.7 * Math.sin(fogT + i * 1.4));
      const cy = H * (0.2  + 0.6 * Math.cos(fogT * 0.6 + i));
      const r  = W * (0.3  + 0.1 * Math.sin(fogT * 0.4 + i));
      const g  = fogCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const hue = 300 + i * 20;
      g.addColorStop(0, `hsla(${hue},75%,55%,0.05)`);
      g.addColorStop(1, `hsla(${hue},75%,45%,0)`);
      fogCtx.fillStyle = g;
      fogCtx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(fogLoop);
  }
  setTimeout(() => { fogCanvas.style.opacity = '1'; }, 2500);

  // ─── PARTICLES (ANTIGRAVITY) ─────────────────────────────
  class Particle {
    constructor(scatter) { this.init(scatter); }
    init(scatter) {
      this.x     = Math.random() * (W || 800);
      this.y     = scatter ? Math.random() * (H || 600) : (H || 600) + 10;
      this.r     = Math.random() * 2.2 + 0.6;
      this.vy    = -(Math.random() * 0.6 + 0.2);
      this.vx    = (Math.random() - 0.5) * 0.35;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.fade  = Math.random() * 0.0006 + 0.0002;
      this.heart = Math.random() < 0.15;
      this.hue   = Math.random() < 0.55 ? 330 : 275;
      this.sway  = Math.random() * Math.PI * 2;
    }
    tick() {
      this.sway += 0.013;
      this.x    += this.vx + Math.sin(this.sway) * 0.25;
      this.y    += this.vy;
      this.alpha -= this.fade;
      if (this.y < -15 || this.alpha <= 0) this.init(false);
    }
    draw() {
      pCtx.save();
      pCtx.globalAlpha = Math.max(0, this.alpha);
      if (this.heart) {
        pCtx.translate(this.x, this.y);
        pCtx.fillStyle = `hsl(${this.hue},100%,72%)`;
        pCtx.shadowColor = `hsl(${this.hue},100%,72%)`;
        pCtx.shadowBlur  = 8;
        const s = this.r * 2;
        pCtx.beginPath();
        pCtx.moveTo(0, 0);
        pCtx.bezierCurveTo(-s, -s, -s*2, s*0.6,  0, s*2.2);
        pCtx.bezierCurveTo( s*2, s*0.6, s, -s,   0, 0);
        pCtx.fill();
      } else {
        const g = pCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 3);
        g.addColorStop(0, `hsl(${this.hue},100%,85%)`);
        g.addColorStop(1, `hsla(${this.hue},100%,60%,0)`);
        pCtx.fillStyle = g;
        pCtx.beginPath();
        pCtx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
        pCtx.fill();
      }
      pCtx.restore();
    }
  }

  const particles = [];
  function particleLoop() {
    pCtx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.tick(); p.draw(); });
    requestAnimationFrame(particleLoop);
  }

  // Click spawns hearts
  document.addEventListener('click', e => {
    for (let i = 0; i < 7; i++) {
      const p = new Particle(true);
      p.x    = e.clientX + (Math.random() - 0.5) * 28;
      p.y    = e.clientY;
      p.vy   = -(Math.random() * 1.8 + 0.8);
      p.heart = true;
      p.alpha = 0.85;
      p.fade  = 0.006;
      particles.push(p);
    }
  });

  // ─── SECTION BLUR-IN TRANSITIONS ─────────────────────────
  function initSections() {
    document.querySelectorAll('section, .chapter, .timeline-item, .polaroid, .reason-card').forEach(el => {
      if (el.dataset.cin) return;
      el.dataset.cin = '1';
      gsap.fromTo(el,
        { autoAlpha: 0, filter: 'blur(10px)', y: 30 },
        { autoAlpha: 1, filter: 'blur(0px)',  y: 0,
          duration: 1.2, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
        }
      );
    });
  }

  // ─── BOOT SEQUENCE ───────────────────────────────────────
  resize(); // size canvases before loading

  preloadFrames(() => {
    // All frames ready — start everything
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle(true));

    fogLoop();
    particleLoop();

    // Wait for GSAP (already loaded in <head> but just in case)
    function boot(attempts) {
      if (window.gsap && window.ScrollTrigger) {
        initScrollSequence();
        initSections();
      } else if (attempts < 50) {
        setTimeout(() => boot(attempts + 1), 100);
      } else {
        console.error('[cinematic] GSAP not available.');
      }
    }
    boot(0);
  });

})();
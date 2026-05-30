/**
 * cinematic.js  v3 — LOVE.web
 * Real-time 3D WebGL environment — Three.js r128
 * ─────────────────────────────────────────────
 * Replaces frame-sequence playback with a live-rendered 3D scene.
 * Camera travels through the environment as the user scrolls.
 * No pre-rendered frames needed.
 *
 * Add ONE line before </body> in index.html:
 *   <script src="/cinematic.js"></script>
 */

(function () {
  'use strict';

  // ─── STYLES ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #cv-canvas   { position:fixed; inset:0; z-index:0; pointer-events:none; }
    #cv-2d       { position:fixed; inset:0; z-index:2; pointer-events:none; }
    #cv-loader   {
      position:fixed; inset:0; z-index:9999;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:#000008; transition:opacity 1.8s ease; pointer-events:none;
    }
    #cv-loader-track { width:160px; height:1px; background:rgba(255,255,255,0.08); margin-bottom:18px; }
    #cv-loader-fill  { height:100%; width:0%; background:linear-gradient(90deg,#334,#88f); transition:width 0.3s; }
    #cv-loader span  { color:rgba(180,170,210,0.45); font:11px/1 sans-serif; letter-spacing:4px; text-transform:uppercase; }
  `;
  document.head.appendChild(style);

  // ─── LOADER UI ───────────────────────────────────────────
  const loader = document.createElement('div');
  loader.id = 'cv-loader';
  loader.innerHTML = `
    <div id="cv-loader-track"><div id="cv-loader-fill"></div></div>
    <span>Rendering scene…</span>`;
  document.body.appendChild(loader);
  const fill = document.getElementById('cv-loader-fill');

  // ─── 2D OVERLAY CANVAS (particles) ───────────────────────
  const cv2d = document.createElement('canvas');
  cv2d.id = 'cv-2d';
  document.body.appendChild(cv2d);
  const c2 = cv2d.getContext('2d');
  let W2 = cv2d.width  = window.innerWidth;
  let H2 = cv2d.height = window.innerHeight;

  // ─── LIFT EXISTING CONTENT ───────────────────────────────
  document.querySelectorAll('body > *:not(#cv-canvas):not(#cv-2d):not(#cv-loader)').forEach(el => {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    if (Number(el.style.zIndex || 0) < 3) el.style.zIndex = '3';
  });

  // ─── LOAD THREE.JS THEN BOOT ─────────────────────────────
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload = boot;
  document.head.appendChild(s);

  // ═══════════════════════════════════════════════════════════
  function boot() {
    const T = window.THREE;

    // Body must be deep dark — not transparent (avoids white flash)
    document.body.style.background = '#000008';
    document.body.style.backgroundColor = '#000008';
    document.documentElement.style.background = '#000008';

    // Make site wrapper + all sections transparent so canvas shows through
    const transparentTargets = [
      '#site', '#intro', '#wrapper', '#main', '#app',
      '.site-hidden', 'section', '.section', '.chapter',
      '.story-section', '.hero', '.timeline', '.gallery',
      '.letter-section', '.finale', '.quiet-section'
    ];
    transparentTargets.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.backgroundColor = 'transparent';
        el.style.background = 'transparent';
      });
    });

    // Inject global override for any background set via stylesheet
    const bgOverride = document.createElement('style');
    bgOverride.textContent = `
      html, body { background: #000008 !important; }
      #site, section, .section, .chapter, .story-section,
      .hero, .timeline, .gallery, .letter-section,
      .finale, .quiet-section, .intro-section, #intro {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(bgOverride);

    // Wait for full layout before reading dimensions
    let W = document.documentElement.clientWidth;
    let H = document.documentElement.clientHeight;

    // ── RENDERER ───────────────────────────────────────────
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x00000f, 1);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;
    Object.assign(renderer.domElement.style, {
      position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none'
    });
    renderer.domElement.id = 'cv-canvas';
    document.body.prepend(renderer.domElement);

    // ── SCENE ──────────────────────────────────────────────
    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0x02000f, 0.004);

    // ── CAMERA ─────────────────────────────────────────────
    const cam = new T.PerspectiveCamera(55, W / H, 0.1, 3000);
    cam.position.set(0, 2.5, 55);

    // Smooth camera state — scroll drives TARGET, RAF lerps ACTUAL
    const tgt = { x:0, y:2.5, z:55, lx:0, ly:-0.5 };
    const cur = { x:0, y:2.5, z:55, lx:0, ly:-0.5 };

    // ── LIGHTS ─────────────────────────────────────────────
    scene.add(new T.AmbientLight(0x334466, 1.5));

    const moonLight = new T.DirectionalLight(0xaabbff, 4.0);
    moonLight.position.set(-30, 80, -20);
    scene.add(moonLight);

    const rimLight = new T.DirectionalLight(0x6644aa, 1.2);
    rimLight.position.set(40, 10, 60);
    scene.add(rimLight);

    const horizonLight = new T.PointLight(0x5533aa, 40, 800);
    horizonLight.position.set(0, -4, -300);
    scene.add(horizonLight);

    // Fill light so scene is never pure black
    const fillLight = new T.PointLight(0x112244, 20, 500);
    fillLight.position.set(0, 30, 50);
    scene.add(fillLight);

    // ── BACKGROUND SPHERE (sky/nebula) ─────────────────────
    const skyGeo = new T.SphereGeometry(1400, 32, 32);
    const skyMat = new T.MeshBasicMaterial({ color: 0x080615, side: T.BackSide });
    scene.add(new T.Mesh(skyGeo, skyMat));

    // ── STARFIELD ──────────────────────────────────────────
    const STAR_N = 7000;
    const sPos = new Float32Array(STAR_N * 3);
    const sBri = new Float32Array(STAR_N);
    for (let i = 0; i < STAR_N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 900 + Math.random() * 300;
      sPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      sPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      sPos[i*3+2] = r * Math.cos(ph);
      sBri[i] = Math.random();
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.BufferAttribute(sPos, 3));
    const starMat = new T.PointsMaterial({
      color: 0xffffff, size: 2.5, sizeAttenuation: true,
      transparent: true, opacity: 1.0
    });
    scene.add(new T.Points(starGeo, starMat));

    // ── WATER PLANE ────────────────────────────────────────
    const wGeo = new T.PlaneGeometry(1000, 800, 200, 120);
    // Subtle initial wave displacement
    const wPA = wGeo.attributes.position.array;
    for (let i = 0; i < wPA.length; i += 3) {
      wPA[i+2] = (Math.random() - 0.5) * 0.15;
    }
    const wMat = new T.MeshStandardMaterial({
      color: 0x010510, metalness: 0.98, roughness: 0.04,
    });
    const water = new T.Mesh(wGeo, wMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2.5;
    scene.add(water);

    // Moonlight reflection strip on water
    const refGeo = new T.PlaneGeometry(3, 120);
    const refMat = new T.MeshBasicMaterial({
      color: 0x3355aa, transparent: true, opacity: 0.3,
      blending: T.AdditiveBlending, depthWrite: false
    });
    const refMesh = new T.Mesh(refGeo, refMat);
    refMesh.rotation.x = -Math.PI / 2;
    refMesh.position.set(0, -2.4, 10);
    scene.add(refMesh);

    // ── HORIZON GLOW PLANE ─────────────────────────────────
    const hGeo = new T.PlaneGeometry(800, 40);
    const hMat = new T.MeshBasicMaterial({
      color: 0x9944ff, transparent: true, opacity: 0.9,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    });
    const hMesh = new T.Mesh(hGeo, hMat);
    hMesh.position.set(0, 2, -200);
    scene.add(hMesh);

    // Second glow layer — warm amber
    const hGeo2 = new T.PlaneGeometry(600, 25);
    const hMat2 = new T.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.25,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    });
    const hMesh2 = new T.Mesh(hGeo2, hMat2);
    hMesh2.position.set(0, -1, -210);
    scene.add(hMesh2);

    // ── VOLUMETRIC FOG PLANES (depth layers) ───────────────
    const fogLayers = [];
    const fogColors = [0x0a0520, 0x080318, 0x06021a, 0x050215, 0x040112, 0x030110];
    for (let i = 0; i < 12; i++) {
      const fg = new T.PlaneGeometry(280 + i*20, 40 + i*5);
      const fm = new T.MeshBasicMaterial({
        color: fogColors[i % fogColors.length],
        transparent: true,
        opacity: 0.06 + Math.random() * 0.07,
        blending: T.AdditiveBlending,
        side: T.DoubleSide, depthWrite: false
      });
      const fp = new T.Mesh(fg, fm);
      fp.position.set(
        (Math.random() - 0.5) * 80,
        -1 + Math.random() * 10,
        -15 - i * 35
      );
      fp.rotation.y = (Math.random() - 0.5) * 0.4;
      scene.add(fp);
      fogLayers.push({ m: fp, spd: 0.002 + Math.random() * 0.003, ph: Math.random() * Math.PI * 2 });
    }

    // ── 3D DEPTH PARTICLES ─────────────────────────────────
    const PN = 300;
    const pGeo = new T.BufferGeometry();
    const pPos = new Float32Array(PN * 3);
    const pV   = [];
    for (let i = 0; i < PN; i++) {
      pPos[i*3]   = (Math.random() - 0.5) * 200;
      pPos[i*3+1] = Math.random() * 40 - 2;
      pPos[i*3+2] = (Math.random() - 0.5) * 200;
      pV.push({ dy: 0.008 + Math.random() * 0.015, dx: (Math.random()-0.5)*0.003 });
    }
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
    const pMat = new T.PointsMaterial({
      color: 0x8866bb, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.45, blending: T.AdditiveBlending
    });
    const pSys = new T.Points(pGeo, pMat);
    scene.add(pSys);

    // ── SCROLL CAMERA PATH ─────────────────────────────────
    // Each keyframe: camera pos + lookAt target
    const path = [
      { z:55,  y:2.5,  lz:-10, ly:-0.5 },   // 0%  — water level, intimate
      { z:20,  y:7,    lz:-40, ly:1    },   // 30% — rising, pushing forward
      { z:-15, y:18,   lz:-80, ly:6    },   // 60% — above fog layer
      { z:-60, y:38,   lz:-150,ly:14   },   // 100%— high, god-view, cinematic
    ];

    function lerp(a, b, t) { return a + (b - a) * t; }
    function smoothstep(t) { return t*t*(3-2*t); }

    function setCameraTarget(p) {
      const segs  = path.length - 1;
      const si    = Math.min(segs - 1, Math.floor(p * segs));
      const t     = smoothstep((p * segs) - si);
      const a = path[si], b = path[si + 1];
      tgt.z  = lerp(a.z,  b.z,  t);
      tgt.y  = lerp(a.y,  b.y,  t);
      tgt.lz = lerp(a.lz, b.lz, t);
      tgt.ly = lerp(a.ly, b.ly, t);
    }

    // ── GSAP SCROLL TRIGGER ────────────────────────────────
    function waitGSAP(cb, n=0) {
      if (window.gsap && window.ScrollTrigger) return cb();
      if (n > 80) return;
      setTimeout(() => waitGSAP(cb, n+1), 100);
    }

    waitGSAP(() => {
      gsap.registerPlugin(ScrollTrigger);

      const spacer = document.createElement('div');
      spacer.id = 'cv-spacer';
      spacer.style.cssText = 'height:180vh;pointer-events:none;position:relative;z-index:0;';
      const site = document.getElementById('site') || document.body.firstElementChild;
      if (site && site !== renderer.domElement && site !== cv2d && site !== loader) {
        document.body.insertBefore(spacer, site);
      }

      ScrollTrigger.create({
        trigger: spacer,
        start:   'top top',
        end:     'bottom top',
        pin:     true,
        scrub:   1.2,
        anticipatePin: 1,
        onUpdate(self) {
          setCameraTarget(self.progress);
          // Canvas fade into content
          if (self.progress > 0.72) {
            const f = (self.progress - 0.72) / 0.28;
            renderer.domElement.style.opacity = Math.max(0.12, 1 - f * 0.88).toFixed(3);
          } else {
            renderer.domElement.style.opacity = '1';
          }
        },
        onLeave()      { gsap.to(renderer.domElement, { opacity: 0.1, duration: 1.2 }); },
        onEnterBack()  { gsap.to(renderer.domElement, { opacity: 1,   duration: 0.7 }); }
      });

      // Content bleeds in at 68% through intro
      const siteEl = document.getElementById('site');
      if (siteEl) {
        gsap.set(siteEl, { autoAlpha: 0, y: 50 });
        ScrollTrigger.create({
          trigger: spacer,
          start:   '68% top',
          onEnter:     () => gsap.to(siteEl, { autoAlpha:1, y:0, duration:1.6, ease:'power3.out' }),
          onLeaveBack: () => gsap.to(siteEl, { autoAlpha:0, y:50, duration:0.8 })
        });
      }
    });

    // ── MOUSE MICRO-PARALLAX ──────────────────────────────
    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
      mx = (e.clientX / W - 0.5);
      my = (e.clientY / H - 0.5);
    });

    // ── 2D PARTICLE OVERLAY (canvas fallback layer) ────────
    class P2 {
      constructor(scatter) { this.r(scatter); }
      r(scatter) {
        this.x  = Math.random() * W2;
        this.y  = scatter ? Math.random() * H2 : H2 + 5;
        this.sz = Math.random() * 1.4 + 0.4;
        this.vy = -(Math.random() * 0.5 + 0.15);
        this.vx = (Math.random() - 0.5) * 0.2;
        this.a  = Math.random() * 0.35 + 0.08;
        this.da = Math.random() * 0.0004 + 0.0001;
        this.sw = Math.random() * Math.PI * 2;
      }
      tick() {
        this.sw += 0.01;
        this.x  += this.vx + Math.sin(this.sw) * 0.18;
        this.y  += this.vy;
        this.a  -= this.da;
        if (this.y < -5 || this.a <= 0) this.r(false);
      }
      draw() {
        c2.save();
        c2.globalAlpha = Math.max(0, this.a);
        const g = c2.createRadialGradient(this.x,this.y,0,this.x,this.y,this.sz*3);
        g.addColorStop(0,'hsl(270,60%,80%)');
        g.addColorStop(1,'hsla(270,60%,60%,0)');
        c2.fillStyle = g;
        c2.beginPath();
        c2.arc(this.x, this.y, this.sz*3, 0, Math.PI*2);
        c2.fill();
        c2.restore();
      }
    }
    const p2s = Array.from({length:45}, () => new P2(true));

    function p2loop() {
      c2.clearRect(0,0,W2,H2);
      p2s.forEach(p => { p.tick(); p.draw(); });
      requestAnimationFrame(p2loop);
    }
    p2loop();

    // ── CLOCK ─────────────────────────────────────────────
    const clock = new T.Clock();

    // ── RENDER LOOP ───────────────────────────────────────
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const lf = 0.032; // camera lerp factor — cinematic lag

      // Lerp camera toward scroll target
      cur.z  += (tgt.z  - cur.z)  * lf;
      cur.y  += (tgt.y  - cur.y)  * lf;
      cur.lz  = tgt.lz !== undefined ? cur.lz + (tgt.lz - cur.lz) * lf : cur.lz;
      cur.ly += (tgt.ly - cur.ly) * lf;

      // Apply mouse micro-parallax on top
      cam.position.set(cur.x + mx * 2.5, cur.y + my * -1.2, cur.z);
      cam.lookAt(mx * 2, cur.ly, cur.lz !== undefined ? cur.lz : -30);

      // Fog plane drift
      fogLayers.forEach(({ m, spd, ph }) => {
        m.position.x += Math.sin(t * spd + ph) * 0.05;
        m.material.opacity = 0.05 + Math.sin(t * spd * 0.4 + ph) * 0.025;
      });

      // Water surface shimmer
      refMesh.material.opacity = 0.22 + Math.sin(t * 0.5) * 0.10;
      const wA = wGeo.attributes.position.array;
      for (let i = 0; i < wA.length; i += 3) {
        wA[i+2] = Math.sin(t*0.25 + i*0.04) * 0.07 + Math.cos(t*0.15 + i*0.07) * 0.04;
      }
      wGeo.attributes.position.needsUpdate = true;
      wGeo.computeVertexNormals();

      // 3D particle float
      const pA = pGeo.attributes.position.array;
      for (let i = 0; i < PN; i++) {
        pA[i*3+1] += pV[i].dy * 0.4;
        pA[i*3]   += pV[i].dx;
        if (pA[i*3+1] > 40) {
          pA[i*3+1] = -2;
          pA[i*3]   = (Math.random()-0.5)*200;
        }
      }
      pGeo.attributes.position.needsUpdate = true;

      // Star slow rotation (camera drift illusion)
      starMat.opacity = 0.75 + Math.sin(t*0.12)*0.06;

      // Horizon pulse
      horizonLight.intensity = 10 + Math.sin(t * 0.18) * 3;

      renderer.render(scene, cam);
    }
    animate();

    // ── RESIZE ────────────────────────────────────────────
    window.addEventListener('resize', () => {
      W = document.documentElement.clientWidth;
      H = document.documentElement.clientHeight;
      W2 = cv2d.width  = W;
      H2 = cv2d.height = H;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
    // Force correct size immediately after DOM settles
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);

    // ── DISMISS LOADER ────────────────────────────────────
    let prog = 0;
    const pi = setInterval(() => {
      prog = Math.min(100, prog + 4);
      fill.style.width = prog + '%';
      if (prog >= 100) {
        clearInterval(pi);
        setTimeout(() => {
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 1800);
        }, 300);
      }
    }, 40);

  } // end boot()

})();
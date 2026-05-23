'use strict';

/* ════════════════════════════════════════
   app.js — Birthday Website for Shruti
   Requires: GSAP + ScrollTrigger (loaded in HTML)
════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────
   1. INTRO PARTICLE CANVAS
   Mouse-reactive floating dots on black screen
───────────────────────────────────────── */
(function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], mouse = { x: -999, y: -999 };

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Create particles
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.5 + 0.3,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.5 + 0.1
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        particles.forEach(p => {
            // Drift
            p.x += p.dx;
            p.y += p.dy;

            // Wrap edges
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H;
            if (p.y > H) p.y = 0;

            // Mouse attraction (subtle)
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140) {
                p.x += dx * 0.004;
                p.y += dy * 0.004;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    draw();
})();


/* ─────────────────────────────────────────
   2. CINEMATIC INTRO SEQUENCE (GSAP)
───────────────────────────────────────── */
(function runIntroSequence() {
    const tl = gsap.timeline();

    // "July 21" fades in
    tl.to('#intro-date', { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0.4)
        // Hold for 2s then fade out
        .to('#intro-date', { opacity: 0, duration: 1.2, ease: 'power2.in' }, 3.2)

        // "This isn't just a birthday page." fades in
        .to('#intro-line1', { opacity: 1, duration: 1.4, ease: 'power2.out' }, 4.8)
        .to('#intro-line1', { opacity: 0, duration: 1.2, ease: 'power2.in' }, 7.2)

        // "It's about someone..." fades in
        .to('#intro-line2', { opacity: 1, duration: 1.4, ease: 'power2.out' }, 8.6)
        .to('#intro-line2', { opacity: 0, duration: 1.2, ease: 'power2.in' }, 11.4)

        // "Begin" button appears
        .to('#introBtn', { opacity: 1, duration: 1.4, ease: 'power2.out' }, 12.6);

    // BEGIN BUTTON click
    document.getElementById('introBtn').addEventListener('click', () => {
        gsap.to('#intro', {
            opacity: 0,
            duration: 1.2,
            ease: 'power2.inOut',
            onComplete: () => {
                document.getElementById('intro').style.display = 'none';
                const site = document.getElementById('site');
                site.classList.remove('site-hidden');
                site.classList.add('site-visible');
                buildStars();
                loadAllData();
                initScrollAnimations();
            }
        });
    });
})();


/* ─────────────────────────────────────────
   3. STAR FIELD
───────────────────────────────────────── */
function buildStars() {
    const container = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        const size = Math.random() * 1.8 + 0.3;
        s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      --d:${2 + Math.random() * 4}s;
      --dd:${Math.random() * 6}s;
    `;
        container.appendChild(s);
    }
}


/* ─────────────────────────────────────────
   4. FETCH JSON DATA & BUILD DOM
───────────────────────────────────────── */
async function loadAllData() {
    try {
        const [timeline, messages, chat] = await Promise.all([
            fetch('/api/timeline').then(r => r.json()),
            fetch('/api/messages').then(r => r.json()),
            fetch('/api/chat').then(r => r.json())
        ]);

        buildTimeline(timeline);
        buildReasons(messages);
        buildChat(chat);

        // Re-run ScrollTrigger after DOM is populated
        ScrollTrigger.refresh();
        initTimelineAnimations();
        initReasonAnimations();
    } catch (err) {
        console.warn('Could not load JSON data. Are you running the Node server?', err);
        // Fallback: still animate whatever is in the DOM
        ScrollTrigger.refresh();
    }
}

/* Build timeline cards */
function buildTimeline(data) {
    const list = document.getElementById('timelineList');
    list.innerHTML = '';

    data.forEach((item, idx) => {
        const isLast = idx === data.length - 1;
        const isQuiet = item.quiet;

        list.innerHTML += `
      <div class="tl-item" style="--accent:${item.accent};">
        <div class="tl-spine">
          <div class="tl-dot"></div>
          ${!isLast ? '<div class="tl-stem"></div>' : ''}
        </div>
        <div class="tl-card ${isQuiet ? 'tl-card--quiet' : ''}">
          <div class="tl-phase">${item.phase}</div>
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </div>
      </div>
    `;
    });
}

/* Build reason cards */
function buildReasons(data) {
    const grid = document.getElementById('reasonsGrid');
    grid.innerHTML = '';

    data.forEach(item => {
        grid.innerHTML += `
      <div class="reason-card">
        <div class="reason-icon">${item.icon}</div>
        <div class="reason-text">${item.title}</div>
      </div>
    `;
    });
}

/* Build chat bubbles & auto-reveal */
let chatData = [];
let chatTimers = [];

function buildChat(data) {
    chatData = data;
    const win = document.getElementById('chatWindow');
    win.innerHTML = '';

    data.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${msg.sender}`;
        bubble.textContent = msg.text;
        bubble.dataset.delay = msg.delay;
        win.appendChild(bubble);
    });
}

function playChatSequence() {
    // Clear previous timers
    chatTimers.forEach(t => clearTimeout(t));
    chatTimers = [];

    // Hide all bubbles
    document.querySelectorAll('.chat-bubble').forEach(b => {
        b.classList.remove('show');
    });

    // Reveal each bubble after its delay
    document.querySelectorAll('.chat-bubble').forEach(bubble => {
        const delay = parseInt(bubble.dataset.delay) || 0;
        const t = setTimeout(() => {
            bubble.classList.add('show');
        }, delay);
        chatTimers.push(t);
    });
}

document.getElementById('chatReplayBtn')?.addEventListener('click', playChatSequence);


/* ─────────────────────────────────────────
   5. GSAP SCROLL ANIMATIONS
───────────────────────────────────────── */
function initScrollAnimations() {
    // Generic fade-up elements
    gsap.utils.toArray('.gsap-fade').forEach(el => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Polaroids stagger in
    gsap.utils.toArray('.gsap-polaroid').forEach((el, i) => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            rotation: parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0,
            duration: 1,
            delay: i * 0.12,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 90%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Chat section — auto-play when enters viewport
    ScrollTrigger.create({
        trigger: '.section--chat',
        start: 'top 70%',
        once: true,
        onEnter: () => playChatSequence()
    });
}

function initTimelineAnimations() {
    gsap.utils.toArray('.tl-item').forEach((el, i) => {
        gsap.to(el, {
            opacity: 1,
            x: 0,
            y: 0,
            duration: 1,
            delay: i * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none'
            }
        });

        // Set initial x for slide-in effect
        gsap.set(el, { x: -20, y: 20 });
    });
}

function initReasonAnimations() {
    gsap.utils.toArray('.reason-card').forEach((el, i) => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: i * 0.08,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 92%',
                toggleActions: 'play none none none'
            }
        });
    });
}


/* ─────────────────────────────────────────
   6. MUSIC TOGGLE
───────────────────────────────────────── */
(function initMusic() {
    const music = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    let playing = false;

    musicBtn?.addEventListener('click', () => {
        const hasSrc = music?.querySelector('source[src]');
        if (!hasSrc) return;
        if (playing) {
            music.pause();
            musicBtn.textContent = '♪';
            playing = false;
        } else {
            music.play().catch(() => { });
            musicBtn.textContent = '♫';
            playing = true;
        }
    });
})();


/* ─────────────────────────────────────────
   7. HEART PARTICLES ON CLICK
───────────────────────────────────────── */
document.addEventListener('click', e => {
    if (e.target.closest('#intro')) return;

    const hearts = ['❤️', '🤍', '💕', '💗'];
    for (let i = 0; i < 4; i++) {
        const heart = document.createElement('div');
        heart.className = 'heart-particle';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = (e.clientX + Math.random() * 24 - 12) + 'px';
        heart.style.top = (e.clientY - 8) + 'px';
        heart.style.animationDuration = (1.2 + Math.random() * 0.8) + 's';
        heart.style.fontSize = (14 + Math.random() * 8) + 'px';
        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 2200);
    }
});


/* ─────────────────────────────────────────
   8. EASTER EGG
───────────────────────────────────────── */
document.getElementById('secretZone')?.addEventListener('click', () => {
    document.getElementById('secretMsg')?.classList.toggle('show');
});


/* ─────────────────────────────────────────
   9. FINALE BUTTON + CONFETTI
───────────────────────────────────────── */
document.getElementById('finalBtn')?.addEventListener('click', e => {
    e.stopPropagation();

    const btn = document.getElementById('finalBtn');
    btn.querySelector('span').textContent = '🎉 Always remembered ❤️';

    gsap.to(btn, {
        borderColor: 'rgba(201,168,76,0.7)',
        boxShadow: '0 0 80px rgba(201,168,76,0.18)',
        duration: 0.8,
        ease: 'power2.out'
    });

    launchConfetti();
});

function launchConfetti() {
    const colors = ['#f0c4d4', '#c9a84c', '#c4b5e8', '#ffffff', '#f5c2c2'];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        const size = 4 + Math.random() * 6;
        const dur = 1.8 + Math.random() * 2;
        const delay = Math.random() * 1;
        p.style.cssText = `
      width:${size}px; height:${size * 1.5}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      left:${Math.random() * 100}vw; top:-10px;
      --cf-d:${dur}s; --cf-delay:${delay}s;
    `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), (dur + delay + 0.5) * 1000);
    }
}
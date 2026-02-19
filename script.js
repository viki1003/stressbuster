/* ========================================
   STRESSBUSTER — Full Feature Build
   ======================================== */
const { Engine, World, Bodies, Body } = Matter;

document.addEventListener('DOMContentLoaded', () => {
    // ── Canvases ──
    const wallCvs = document.getElementById('wall-canvas');
    const imgCvs = document.getElementById('img-canvas');
    const splatCvs = document.getElementById('splat-canvas');
    const fxCvs = document.getElementById('fx-canvas');
    const wallCtx = wallCvs.getContext('2d');
    const imgCtx = imgCvs.getContext('2d');
    const splatCtx = splatCvs.getContext('2d');
    const fxCtx = fxCvs.getContext('2d');
    const wallArea = document.getElementById('wall-area');

    // ── Matter.js ──
    const engine = Engine.create({ gravity: { x: 0, y: 2 } });
    const MAX_DEBRIS = 80;

    // ── State (must be declared before resize) ──
    let currentTool = 'tomato';
    let mouseX = 0, mouseY = 0;
    let isDown = false;
    let hitCount = 0;
    let sprayColor = '#ff1744';
    let uploadedImage = null;
    const projectiles = [];
    const debris = [];

    let W, H;
    const resize = () => {
        W = window.innerWidth; H = window.innerHeight;
        [wallCvs, imgCvs, splatCvs, fxCvs].forEach(c => { c.width = W; c.height = H; });
        drawBrickWall();
        if (uploadedImage) drawUploadedImage();
    };
    window.addEventListener('resize', resize);
    resize();

    // ── Audio ──
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function sfx(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        if (type === 'splat') {
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.frequency.setValueAtTime(80, now); o.frequency.exponentialRampToValueAtTime(20, now + 0.15);
            g.gain.setValueAtTime(0.35, now); g.gain.linearRampToValueAtTime(0, now + 0.2);
            o.connect(g).connect(audioCtx.destination); o.start(); o.stop(now + 0.2);
            // wet layer
            const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.06, audioCtx.sampleRate);
            const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
            const n = audioCtx.createBufferSource(); n.buffer = b;
            const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.12, now); ng.gain.linearRampToValueAtTime(0, now + 0.06);
            n.connect(ng).connect(audioCtx.destination); n.start(); n.stop(now + 0.06);
        } else if (type === 'shatter') {
            const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.12, audioCtx.sampleRate);
            const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.4);
            const n = audioCtx.createBufferSource(); n.buffer = b;
            const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, now); g.gain.linearRampToValueAtTime(0, now + 0.12);
            const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
            n.connect(hp).connect(g).connect(audioCtx.destination); n.start(); n.stop(now + 0.12);
        } else if (type === 'pop') {
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.frequency.setValueAtTime(350, now); o.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            g.gain.setValueAtTime(0.3, now); g.gain.linearRampToValueAtTime(0, now + 0.12);
            o.connect(g).connect(audioCtx.destination); o.start(); o.stop(now + 0.12);
        } else if (type === 'hiss') {
            const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
            const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
            const n = audioCtx.createBufferSource(); n.buffer = b;
            const g = audioCtx.createGain(); g.gain.setValueAtTime(0.05, now); g.gain.linearRampToValueAtTime(0, now + 0.04);
            const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600;
            n.connect(bp).connect(g).connect(audioCtx.destination); n.start(); n.stop(now + 0.04);
        } else if (type === 'laser') {
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(800 + Math.random() * 200, now);
            g.gain.setValueAtTime(0.06, now); g.gain.linearRampToValueAtTime(0, now + 0.03);
            o.connect(g).connect(audioCtx.destination); o.start(); o.stop(now + 0.03);
        } else if (type === 'flame') {
            const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
            const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
            const n = audioCtx.createBufferSource(); n.buffer = b;
            const g = audioCtx.createGain(); g.gain.setValueAtTime(0.06, now); g.gain.linearRampToValueAtTime(0, now + 0.05);
            const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
            n.connect(lp).connect(g).connect(audioCtx.destination); n.start(); n.stop(now + 0.05);
        }
    }

    // ═══ BRICK WALL ═══
    function drawBrickWall() {
        const bw = 78, bh = 34, gap = 3;
        const cols = ['#8B4513', '#A0522D', '#6B3410', '#7B3F1A', '#994422', '#804020', '#6E3916', '#9B5B30', '#7A3B18', '#884620'];
        wallCtx.fillStyle = '#2a1408'; wallCtx.fillRect(0, 0, W, H);
        let row = 0;
        for (let y = 0; y < H; y += bh + gap) {
            const off = (row % 2) ? bw / 2 : 0;
            for (let x = -bw; x < W + bw; x += bw + gap) {
                const bx = x + off;
                const c = cols[Math.floor(Math.random() * cols.length)];
                wallCtx.fillStyle = c;
                const vw = bw + (Math.random() * 4 - 2), vh = bh + (Math.random() * 2 - 1);
                wallCtx.fillRect(bx, y, vw, vh);
                // texture
                for (let i = 0; i < 10; i++) {
                    wallCtx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${Math.random() * 0.1})` : `rgba(0,0,0,${Math.random() * 0.12 + 0.03})`;
                    wallCtx.fillRect(bx + Math.random() * vw, y + Math.random() * vh, Math.random() * 5 + 1, Math.random() * 3 + 1);
                }
                wallCtx.fillStyle = 'rgba(255,220,180,0.06)'; wallCtx.fillRect(bx, y, vw, 2);
                wallCtx.fillStyle = 'rgba(0,0,0,0.12)'; wallCtx.fillRect(bx, y + vh - 2, vw, 2);
            }
            row++;
        }
        const v = wallCtx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
        wallCtx.fillStyle = v; wallCtx.fillRect(0, 0, W, H);
    }

    // ═══ IMAGE UPLOAD ═══
    const uploadInput = document.getElementById('image-upload');
    const clearImgBtn = document.getElementById('clear-img-btn');

    uploadInput.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => { uploadedImage = img; drawUploadedImage(); clearImgBtn.style.display = 'inline-block'; };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    clearImgBtn.addEventListener('click', () => {
        uploadedImage = null;
        imgCtx.clearRect(0, 0, W, H);
        clearImgBtn.style.display = 'none';
        uploadInput.value = '';
    });

    function drawUploadedImage() {
        if (!uploadedImage) return;
        imgCtx.clearRect(0, 0, W, H);
        // Fit image centered on wall
        const scale = Math.min(W * 0.7 / uploadedImage.width, H * 0.7 / uploadedImage.height);
        const iw = uploadedImage.width * scale;
        const ih = uploadedImage.height * scale;
        imgCtx.drawImage(uploadedImage, (W - iw) / 2, (H - ih) / 2, iw, ih);
    }

    // ═══ TOOL SELECTION ═══
    const tools = document.querySelectorAll('.tool');
    const sprayColorsEl = document.getElementById('spray-colors');
    const sprayColorBtns = document.querySelectorAll('.spray-color');

    tools.forEach(btn => {
        btn.addEventListener('click', () => {
            tools.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            sprayColorsEl.style.display = currentTool === 'spray' ? 'flex' : 'none';
        });
    });

    sprayColorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sprayColorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sprayColor = btn.dataset.color;
        });
    });

    // ═══ RANDOM COLORS ═══
    const BALLOON_COLORS = ['#e91e63', '#29b6f6', '#66bb6a', '#ff9800', '#ab47bc', '#ef5350', '#26c6da', '#d4e157'];
    const CAKE_COLORS = [
        { frosting: '#f48fb1', sponge: '#8d6e63', cream: '#ffffff' },
        { frosting: '#80cbc4', sponge: '#a1887f', cream: '#e0f7fa' },
        { frosting: '#ce93d8', sponge: '#795548', cream: '#f3e5f5' },
        { frosting: '#fff176', sponge: '#6d4c41', cream: '#fffde7' },
        { frosting: '#ff8a65', sponge: '#5d4037', cream: '#fbe9e7' },
        { frosting: '#81d4fa', sponge: '#8d6e63', cream: '#e1f5fe' },
    ];

    // ═══ PROJECTILE ═══
    class Projectile {
        constructor(tx, ty, tool) {
            this.tool = tool;
            this.tx = tx; this.ty = ty;
            this.sx = W / 2 + (Math.random() - 0.5) * 120;
            this.sy = H + 60;
            this.t = 0;
            this.duration = 0.4 + Math.random() * 0.1;
            this.rot = 0;
            this.rotV = (Math.random() - 0.5) * 14;
            this.trail = [];
            // Tool-specific colors
            if (tool === 'balloon') {
                this.balloonColor = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
            }
            if (tool === 'cake') {
                this.cakeStyle = CAKE_COLORS[Math.floor(Math.random() * CAKE_COLORS.length)];
            }
        }
        update(dt) {
            this.t += dt / this.duration;
            if (this.t >= 1) return true;
            const ease = 1 - Math.pow(1 - this.t, 3);
            this.x = this.sx + (this.tx - this.sx) * ease + Math.sin(this.t * Math.PI * 2) * 25 * (1 - this.t);
            this.y = this.sy + (this.ty - this.sy) * ease - Math.sin(this.t * Math.PI) * 100;
            this.scale = 3.5 - 2.8 * ease;
            this.rot += this.rotV * dt;
            this.trail.push({ x: this.x, y: this.y, a: 1 }); if (this.trail.length > 6) this.trail.shift();
            this.trail.forEach(p => p.a -= dt * 5);
            return false;
        }
        draw(ctx) {
            // Trail
            this.trail.forEach(p => {
                if (p.a <= 0) return;
                ctx.globalAlpha = p.a * 0.12;
                ctx.fillStyle = '#888';
                ctx.beginPath(); ctx.arc(p.x, p.y, 6 * this.scale, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
            // Shadow
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
            const s = this.scale;
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath(); ctx.ellipse(2 * s, 4 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
            // Shape
            this._drawShape(ctx, s);
            ctx.restore();
        }
        _drawShape(ctx, s) {
            if (this.tool === 'tomato') {
                ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-3 * s, -3 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#4caf50'; ctx.fillRect(-2 * s, -13 * s, 4 * s, 4 * s);
            } else if (this.tool === 'egg') {
                ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-2 * s, -3 * s, 3 * s, 5 * s, -0.3, 0, Math.PI * 2); ctx.fill();
            } else if (this.tool === 'bottle') {
                ctx.globalAlpha = 0.75; ctx.fillStyle = '#388e3c';
                ctx.beginPath(); ctx.roundRect(-6 * s, -4 * s, 12 * s, 20 * s, 3 * s); ctx.fill();
                ctx.fillRect(-3 * s, -12 * s, 6 * s, 10 * s);
                ctx.globalAlpha = 1; ctx.fillStyle = '#1b5e20'; ctx.fillRect(-2.5 * s, -15 * s, 5 * s, 4 * s);
                ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-1.5 * s, -3 * s, 2.5 * s, 16 * s);
            } else if (this.tool === 'cake') {
                const cs = this.cakeStyle;
                ctx.fillStyle = cs.sponge; ctx.beginPath(); ctx.roundRect(-10 * s, -1 * s, 20 * s, 12 * s, 3 * s); ctx.fill();
                ctx.fillStyle = cs.frosting; ctx.beginPath(); ctx.roundRect(-10 * s, -5 * s, 20 * s, 7 * s, 3 * s); ctx.fill();
                ctx.fillStyle = '#fff9c4'; ctx.fillRect(-1 * s, -14 * s, 2 * s, 10 * s);
                ctx.fillStyle = '#ff9800'; ctx.beginPath(); ctx.arc(0, -15 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
            } else if (this.tool === 'balloon') {
                ctx.fillStyle = this.balloonColor; ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-3 * s, -4 * s, 4 * s, 6 * s, -0.4, 0, Math.PI * 2); ctx.fill();
                // Knot
                const darker = this.balloonColor; ctx.fillStyle = darker;
                ctx.beginPath(); ctx.moveTo(-2 * s, 13 * s); ctx.lineTo(2 * s, 13 * s); ctx.lineTo(0, 17 * s); ctx.fill();
            }
        }
    }

    // ═══ IMPACT ═══
    function impact(proj) {
        const { tx: x, ty: y, tool } = proj;
        hitCount++; document.getElementById('hit-count').textContent = hitCount;

        if (tool === 'tomato') {
            drawTomatoSplat(x, y, Math.random() < 0.3); // 30% chance sticks whole
            spawnDroplets(x, y, '#cc0000', '#ff6659', 8);
            sfx('splat');
        } else if (tool === 'egg') {
            const halfBoiled = Math.random() < 0.5;
            drawEggSplat(x, y, halfBoiled);
            spawnDroplets(x, y, '#fafafa', '#ffcc00', 6);
            sfx('splat');
        } else if (tool === 'bottle') {
            drawBottleSplat(x, y);
            spawnShards(x, y, 16);
            sfx('shatter');
        } else if (tool === 'cake') {
            drawCakeSplat(x, y, proj.cakeStyle);
            spawnDroplets(x, y, proj.cakeStyle.frosting, proj.cakeStyle.sponge, 10);
            sfx('splat');
        } else if (tool === 'balloon') {
            drawBalloonSplat(x, y, proj.balloonColor);
            spawnWaterBurst(x, y, proj.balloonColor, 20);
            sfx('pop');
        }
    }

    // ═══ SPLATS ═══
    function drawTomatoSplat(x, y, stickWhole) {
        const ctx = splatCtx; ctx.save(); ctx.translate(x, y);
        const r = 30 + Math.random() * 25;
        if (stickWhole) {
            // Whole splatted tomato stuck to wall
            ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(0, -1, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(-4, -4, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4caf50'; ctx.fillRect(-3, -18, 6, 5);
            // Small splatter around
            const sg = ctx.createRadialGradient(0, 0, 14, 0, 0, r);
            sg.addColorStop(0, 'rgba(200,0,0,0.4)'); sg.addColorStop(1, 'rgba(150,0,0,0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        } else {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, 'rgba(220,20,20,0.9)'); g.addColorStop(0.5, 'rgba(180,10,10,0.6)'); g.addColorStop(1, 'rgba(120,0,0,0)');
            ctx.fillStyle = g; blob(ctx, 0, 0, r, 10);
            for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.8; ctx.fillStyle = `rgba(${170 + Math.random() * 40},${Math.random() * 20},0,${0.5 + Math.random() * 0.3})`; blob(ctx, Math.cos(a) * d, Math.sin(a) * d, 4 + Math.random() * 7, 5); }
            ctx.fillStyle = '#ffe0b2'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(Math.random() * r * 0.5 - r * 0.25, Math.random() * r * 0.5 - r * 0.25); ctx.rotate(Math.random() * Math.PI); ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
            // Drip
            ctx.strokeStyle = 'rgba(180,10,10,0.35)'; ctx.lineWidth = 2 + Math.random();
            for (let i = 0; i < 3; i++) { const sx = (Math.random() - 0.5) * r * 0.6; ctx.beginPath(); ctx.moveTo(sx, r * 0.2); ctx.quadraticCurveTo(sx + Math.random() * 8 - 4, r * 0.5 + Math.random() * 15, sx + Math.random() * 4 - 2, r * 0.4 + 20 + Math.random() * 35); ctx.stroke(); }
        }
        ctx.restore();
    }

    function drawEggSplat(x, y, halfBoiled) {
        const ctx = splatCtx; ctx.save(); ctx.translate(x, y);
        const r = 30 + Math.random() * 20;
        // White
        ctx.fillStyle = 'rgba(250,250,245,0.82)'; blob(ctx, 0, 0, r * 0.85, 9);
        // Yolk
        if (halfBoiled) {
            // Cooked yolk: solid, slightly darker
            ctx.fillStyle = '#f9a825';
            ctx.beginPath(); ctx.arc(Math.random() * 8 - 4, Math.random() * 8 - 4, r * 0.28, 0, Math.PI * 2); ctx.fill();
        } else {
            // Runny yolk
            const yx = Math.random() * 8 - 4, yy = Math.random() * 8 - 4;
            const yg = ctx.createRadialGradient(yx - 2, yy - 2, 2, yx, yy, r * 0.32);
            yg.addColorStop(0, '#fff176'); yg.addColorStop(0.6, '#fbc02d'); yg.addColorStop(1, '#f57f17');
            ctx.fillStyle = yg; ctx.beginPath(); ctx.arc(yx, yy, r * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        // Shell fragments (sometimes stick)
        if (Math.random() < 0.6) {
            ctx.fillStyle = 'rgba(220,210,190,0.7)';
            for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                ctx.save(); ctx.translate(Math.random() * r - r / 2, Math.random() * r - r / 2); ctx.rotate(Math.random() * Math.PI);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5 + Math.random() * 4, -(2 + Math.random() * 3)); ctx.lineTo(7 + Math.random() * 3, 2 + Math.random() * 2); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }
        ctx.restore();
    }

    function drawBottleSplat(x, y) {
        const ctx = splatCtx; ctx.save(); ctx.translate(x, y);
        const r = 35 + Math.random() * 20;
        const wg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
        wg.addColorStop(0, 'rgba(200,240,200,0.12)'); wg.addColorStop(1, 'rgba(200,240,200,0)');
        ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, l = 10 + Math.random() * 20; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
        ctx.restore();
    }

    function drawCakeSplat(x, y, cs) {
        const ctx = splatCtx; ctx.save(); ctx.translate(x, y);
        const r = 30 + Math.random() * 20;
        ctx.fillStyle = cs.frosting; blob(ctx, 0, 0, r * 0.65, 8);
        ctx.fillStyle = cs.sponge;
        for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(Math.random() * r - r / 2, Math.random() * r - r / 2, 2 + Math.random() * 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = cs.cream; ctx.globalAlpha = 0.5; blob(ctx, 4, -4, r * 0.25, 6); ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawBalloonSplat(x, y, color) {
        const ctx = splatCtx; ctx.save(); ctx.translate(x, y);
        const r = 40 + Math.random() * 25;
        const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        pg.addColorStop(0, hexToRgba(color, 0.45)); pg.addColorStop(0.7, hexToRgba(color, 0.15)); pg.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = pg; blob(ctx, 0, 0, r, 10);
        // Latex scraps
        ctx.fillStyle = color; ctx.globalAlpha = 0.7;
        for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(Math.random() * r - r / 2, Math.random() * r - r / 2); ctx.rotate(Math.random() * Math.PI); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -4, 12, 1); ctx.quadraticCurveTo(6, 3, 0, 0); ctx.fill(); ctx.restore(); }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function blob(ctx, cx, cy, radius, pts) {
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) { const a = (i / pts) * Math.PI * 2, r = radius * (0.7 + Math.random() * 0.45); const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fill();
    }

    function hexToRgba(hex, a) {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    // ═══ PHYSICS DEBRIS ═══
    function spawnShards(x, y, count) {
        trimDebris();
        for (let i = 0; i < count; i++) {
            const sz = 3 + Math.random() * 9;
            const body = Bodies.rectangle(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16, sz, sz * 0.5, { friction: 0.3, restitution: 0.5, angle: Math.random() * Math.PI * 2 });
            Body.setVelocity(body, { x: (Math.random() - 0.5) * 12, y: -Math.random() * 7 - 2 });
            Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
            World.add(engine.world, body);
            debris.push({ body, sz, type: 'shard', color: `rgba(${110 + Math.random() * 80},${190 + Math.random() * 65},${130 + Math.random() * 60},${0.5 + Math.random() * 0.3})`, shine: Math.random() > 0.4 });
        }
    }

    function spawnDroplets(x, y, c1, c2, count) {
        trimDebris();
        for (let i = 0; i < count; i++) {
            const sz = 2 + Math.random() * 4;
            const body = Bodies.circle(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 16, sz, { friction: 0.7, restitution: 0.05 });
            Body.setVelocity(body, { x: (Math.random() - 0.5) * 6, y: Math.random() * 2 - 0.5 });
            World.add(engine.world, body);
            debris.push({ body, sz, type: 'drop', color: Math.random() > 0.4 ? c1 : c2 });
        }
    }

    function spawnWaterBurst(x, y, color, count) {
        trimDebris();
        for (let i = 0; i < count; i++) {
            const sz = 2 + Math.random() * 3;
            const body = Bodies.circle(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16, sz, { friction: 0.04, restitution: 0.25 });
            Body.setVelocity(body, { x: (Math.random() - 0.5) * 16, y: -Math.random() * 10 - 2 });
            World.add(engine.world, body);
            debris.push({ body, sz, type: 'drop', color: hexToRgba(color, 0.6) });
        }
    }

    function trimDebris() {
        while (debris.length > MAX_DEBRIS) {
            const d = debris.shift();
            World.remove(engine.world, d.body);
        }
    }

    // ═══ CONTINUOUS TOOLS (hold) ═══
    function doLaser(x, y) {
        // Burn mark on splat canvas (dark char)
        splatCtx.save();
        splatCtx.fillStyle = 'rgba(30,20,10,0.15)';
        splatCtx.beginPath(); splatCtx.arc(x, y, 8, 0, Math.PI * 2); splatCtx.fill();
        // Scorch ring
        splatCtx.strokeStyle = 'rgba(60,30,0,0.1)';
        splatCtx.lineWidth = 2;
        splatCtx.beginPath(); splatCtx.arc(x, y, 12, 0, Math.PI * 2); splatCtx.stroke();
        splatCtx.restore();
        if (Math.random() > 0.7) sfx('laser');
    }

    function doFlame(x, y) {
        // Wider burn
        splatCtx.save();
        const g = splatCtx.createRadialGradient(x, y, 0, x, y, 25);
        g.addColorStop(0, 'rgba(40,20,5,0.08)');
        g.addColorStop(0.5, 'rgba(60,30,5,0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        splatCtx.fillStyle = g;
        splatCtx.fillRect(x - 25, y - 25, 50, 50);
        splatCtx.restore();
        if (Math.random() > 0.7) sfx('flame');
    }

    function doSpray(x, y) {
        splatCtx.save();
        splatCtx.fillStyle = sprayColor;
        for (let i = 0; i < 6; i++) {
            const ox = x + (Math.random() - 0.5) * 20;
            const oy = y + (Math.random() - 0.5) * 20;
            splatCtx.globalAlpha = 0.06 + Math.random() * 0.06;
            splatCtx.beginPath(); splatCtx.arc(ox, oy, 2 + Math.random() * 4, 0, Math.PI * 2); splatCtx.fill();
        }
        splatCtx.globalAlpha = 1;
        splatCtx.restore();
        if (Math.random() > 0.9) sfx('hiss');
    }

    function doHose(x, y) {
        // Erase splat canvas in a circle
        splatCtx.save();
        splatCtx.globalCompositeOperation = 'destination-out';
        splatCtx.beginPath(); splatCtx.arc(x, y, 30, 0, Math.PI * 2); splatCtx.fill();
        splatCtx.restore();
        if (Math.random() > 0.8) sfx('hiss');
    }

    // ═══ FX DRAWING ═══
    function drawLaserFx(ctx, x, y) {
        // Beam from top of screen
        const grd = ctx.createLinearGradient(x, 0, x, y);
        grd.addColorStop(0, 'rgba(255,0,0,0)');
        grd.addColorStop(0.7, 'rgba(255,50,50,0.4)');
        grd.addColorStop(1, 'rgba(255,100,100,0.8)');
        ctx.strokeStyle = grd;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
        // Core
        ctx.strokeStyle = 'rgba(255,200,200,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
        // Impact glow
        ctx.fillStyle = 'rgba(255,80,30,0.6)';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,100,0.8)';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        // Sparks
        ctx.fillStyle = 'rgba(255,200,50,0.8)';
        for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 15;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random(), 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawFlameFx(ctx, x, y) {
        // Flame particles
        for (let i = 0; i < 12; i++) {
            const ox = x + (Math.random() - 0.5) * 30;
            const oy = y - Math.random() * 40;
            const sz = 3 + Math.random() * 8;
            const t = Math.random();
            ctx.globalAlpha = 0.3 + Math.random() * 0.4;
            if (t < 0.3) ctx.fillStyle = '#ff6f00';
            else if (t < 0.6) ctx.fillStyle = '#ffab00';
            else ctx.fillStyle = '#ff3d00';
            ctx.beginPath(); ctx.arc(ox, oy, sz, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Base glow
        ctx.fillStyle = 'rgba(255,100,0,0.15)';
        ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
    }

    function drawHoseFx(ctx, x, y) {
        // Static jet spray lines from left edge
        const startX = 0, startY = H * 0.5;
        // Main stream
        ctx.strokeStyle = 'rgba(100,200,255,0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(x * 0.5, startY + (y - startY) * 0.3, x, y);
        ctx.stroke();
        // Core
        ctx.strokeStyle = 'rgba(180,230,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(x * 0.5, startY + (y - startY) * 0.3, x, y);
        ctx.stroke();
        // Splash at impact
        ctx.fillStyle = 'rgba(100,200,255,0.4)';
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 18;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
        }
        // Mist
        ctx.fillStyle = 'rgba(180,230,255,0.08)';
        ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
    }

    function drawSprayFx(ctx, x, y) {
        ctx.fillStyle = sprayColor;
        for (let i = 0; i < 10; i++) {
            ctx.globalAlpha = 0.1 + Math.random() * 0.15;
            const ox = x + (Math.random() - 0.5) * 24, oy = y + (Math.random() - 0.5) * 24;
            ctx.beginPath(); ctx.arc(ox, oy, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Cone indicator
        ctx.strokeStyle = sprayColor;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // ═══ MAIN LOOP ═══
    let lastTime = performance.now();

    function loop(time) {
        const dt = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;

        Engine.update(engine, dt * 1000);

        // Update projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            if (projectiles[i].update(dt)) {
                impact(projectiles[i]);
                projectiles.splice(i, 1);
            }
        }

        // Drip viscosity
        debris.forEach(d => {
            if (d.type === 'drop') {
                const v = d.body.velocity;
                Body.setVelocity(d.body, { x: v.x * 0.95, y: Math.min(v.y * 0.92 + 0.08, 1.8) });
            }
        });

        // Remove offscreen debris
        for (let i = debris.length - 1; i >= 0; i--) {
            if (debris[i].body.position.y > H + 60) {
                World.remove(engine.world, debris[i].body);
                debris.splice(i, 1);
            }
        }

        // Continuous tools
        if (isDown) {
            if (currentTool === 'hose') doHose(mouseX, mouseY);
            if (currentTool === 'laser') doLaser(mouseX, mouseY);
            if (currentTool === 'flame') doFlame(mouseX, mouseY);
            if (currentTool === 'spray') doSpray(mouseX, mouseY);
        }

        // Draw FX
        fxCtx.clearRect(0, 0, W, H);

        // Projectiles
        projectiles.forEach(p => p.draw(fxCtx));

        // Debris
        debris.forEach(d => {
            const p = d.body.position, a = d.body.angle;
            fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(a);
            fxCtx.fillStyle = d.color;
            if (d.type === 'shard') {
                const s = d.sz;
                fxCtx.beginPath(); fxCtx.moveTo(-s, -s * 0.3); fxCtx.lineTo(s * 0.2, -s); fxCtx.lineTo(s, s * 0.4); fxCtx.lineTo(-s * 0.3, s * 0.6); fxCtx.closePath(); fxCtx.fill();
                if (d.shine) { fxCtx.strokeStyle = 'rgba(255,255,255,0.4)'; fxCtx.lineWidth = 0.5; fxCtx.stroke(); }
            } else {
                fxCtx.beginPath(); fxCtx.arc(0, 0, d.sz, 0, Math.PI * 2); fxCtx.fill();
                fxCtx.fillStyle = 'rgba(255,255,255,0.3)'; fxCtx.beginPath(); fxCtx.arc(-d.sz * 0.2, -d.sz * 0.2, d.sz * 0.25, 0, Math.PI * 2); fxCtx.fill();
            }
            fxCtx.restore();
        });

        // Continuous tool FX overlays
        if (isDown) {
            if (currentTool === 'laser') drawLaserFx(fxCtx, mouseX, mouseY);
            if (currentTool === 'flame') drawFlameFx(fxCtx, mouseX, mouseY);
            if (currentTool === 'hose') drawHoseFx(fxCtx, mouseX, mouseY);
            if (currentTool === 'spray') drawSprayFx(fxCtx, mouseX, mouseY);
        }

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // ═══ INPUT ═══
    wallArea.addEventListener('mousedown', e => {
        mouseX = e.clientX; mouseY = e.clientY;
        isDown = true;
        const throwables = ['tomato', 'egg', 'bottle', 'cake', 'balloon'];
        if (throwables.includes(currentTool)) {
            projectiles.push(new Projectile(e.clientX, e.clientY, currentTool));
        }
    });
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseup', () => { isDown = false; });
    wallArea.addEventListener('contextmenu', e => e.preventDefault());
});

/**
 * LidarView — 360° radar-style canvas visualization of lidar distances.
 * Draws concentric range rings, angle markers, and distance dots in polar coordinates.
 * Supports pan (drag) and zoom (scroll) interactions.
 */
export class LidarView {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private maxRange = 4000; // max distance in mm
    private animFrameId: number | null = null;
    private distances: number[] = new Array(360).fill(0);

    // Pan & zoom state
    private zoom = 1;
    private panX = 0;
    private panY = 0;
    private isPanning = false;
    private lastPointerX = 0;
    private lastPointerY = 0;

    private static readonly MIN_ZOOM = 0.5;
    private static readonly MAX_ZOOM = 10;
    private static readonly ZOOM_SENSITIVITY = 0.001;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        // Use ResizeObserver so the canvas is sized correctly on first layout
        // (not just after a window resize)
        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this.canvas.parentElement!);

        this.initInteraction();
    }

    /* ------------------------------------------------------------------ */
    /*  Interaction setup                                                  */
    /* ------------------------------------------------------------------ */
    private initInteraction() {
        const c = this.canvas;

        // --- Wheel → zoom centred on cursor ---
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = c.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // World‑space position under the cursor before zoom
            const wx = (mx - this.panX) / this.zoom;
            const wy = (my - this.panY) / this.zoom;

            const delta = -e.deltaY * LidarView.ZOOM_SENSITIVITY;
            const newZoom = Math.min(
                LidarView.MAX_ZOOM,
                Math.max(LidarView.MIN_ZOOM, this.zoom * (1 + delta))
            );

            // Adjust pan so the same world point stays under the cursor
            this.panX = mx - wx * newZoom;
            this.panY = my - wy * newZoom;
            this.zoom = newZoom;
            this.scheduleDraw();
        }, { passive: false });

        // --- Pointer drag → pan ---
        c.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;           // left‑button only
            this.isPanning = true;
            this.lastPointerX = e.clientX;
            this.lastPointerY = e.clientY;
            c.setPointerCapture(e.pointerId);
            c.style.cursor = 'grabbing';
        });

        c.addEventListener('pointermove', (e) => {
            if (!this.isPanning) return;
            const dx = e.clientX - this.lastPointerX;
            const dy = e.clientY - this.lastPointerY;
            this.lastPointerX = e.clientX;
            this.lastPointerY = e.clientY;
            this.panX += dx;
            this.panY += dy;
            this.scheduleDraw();
        });

        const endPan = () => {
            this.isPanning = false;
            c.style.cursor = 'grab';
        };
        c.addEventListener('pointerup', endPan);
        c.addEventListener('pointercancel', endPan);

        // --- Double‑click → reset view ---
        c.addEventListener('dblclick', () => {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this.scheduleDraw();
        });

        // Touch: pinch‑to‑zoom support
        let lastTouchDist = 0;
        let lastTouchMidX = 0;
        let lastTouchMidY = 0;

        c.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const [a, b] = [e.touches[0], e.touches[1]];
                lastTouchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                lastTouchMidX = (a.clientX + b.clientX) / 2;
                lastTouchMidY = (a.clientY + b.clientY) / 2;
            }
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const [a, b] = [e.touches[0], e.touches[1]];
                const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                const midX = (a.clientX + b.clientX) / 2;
                const midY = (a.clientY + b.clientY) / 2;
                const rect = c.getBoundingClientRect();
                const mx = midX - rect.left;
                const my = midY - rect.top;

                // Zoom
                const scale = dist / lastTouchDist;
                const wx = (mx - this.panX) / this.zoom;
                const wy = (my - this.panY) / this.zoom;
                const newZoom = Math.min(
                    LidarView.MAX_ZOOM,
                    Math.max(LidarView.MIN_ZOOM, this.zoom * scale)
                );
                this.panX = mx - wx * newZoom;
                this.panY = my - wy * newZoom;
                this.zoom = newZoom;

                // Pan (finger midpoint movement)
                this.panX += midX - lastTouchMidX;
                this.panY += midY - lastTouchMidY;

                lastTouchDist = dist;
                lastTouchMidX = midX;
                lastTouchMidY = midY;
                this.scheduleDraw();
            }
        }, { passive: false });

        c.style.cursor = 'grab';
        c.style.touchAction = 'none';   // prevent browser gestures on the canvas
    }

    /** Reset pan & zoom to defaults. */
    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.scheduleDraw();
    }

    private resize() {
        const parent = this.canvas.parentElement!;
        const w = Math.max(parent.clientWidth, 100);
        const h = Math.max(parent.clientHeight, 100);
        const dpr = window.devicePixelRatio || 1;

        // Set the bitmap size to match physical pixels
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);

        // Set display size via CSS to fill the parent
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        this.draw();
    }

    update(distances: number[]) {
        this.distances = distances;
        this.scheduleDraw();
    }

    private scheduleDraw() {
        if (!this.animFrameId) {
            this.animFrameId = requestAnimationFrame(() => {
                this.draw();
                this.animFrameId = null;
            });
        }
    }

    private draw() {
        const { ctx, canvas } = this;
        const dpr = window.devicePixelRatio || 1;

        // Logical (CSS-pixel) dimensions
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 20;

        // Clear entire canvas (identity = physical pixels)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Base transform: DPR scale so we draw in CSS-pixel coords
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Background (full logical area)
        ctx.fillStyle = '#0c1222';
        ctx.fillRect(0, 0, w, h);

        // Apply pan & zoom on top of DPR base
        ctx.setTransform(
            dpr * this.zoom, 0,
            0, dpr * this.zoom,
            dpr * this.panX, dpr * this.panY
        );

        // Range rings
        const ringCount = 4;
        for (let i = 1; i <= ringCount; i++) {
            const r = (radius / ringCount) * i;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.lineWidth = 1 / this.zoom; // keep 1px visual width
            ctx.stroke();

            // Range label
            const rangeVal = Math.round((this.maxRange / ringCount) * i);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
            const fontSize = 10 / this.zoom;
            ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`${rangeVal}mm`, cx, cy - r + 12 / this.zoom);
        }

        // Angle lines (every 45°)
        for (let deg = 0; deg < 360; deg += 45) {
            const rad = (deg - 90) * (Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.lineWidth = 1 / this.zoom;
            ctx.stroke();

            // Angle label
            const labelR = radius + 12 / this.zoom;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const angleFontSize = 9 / this.zoom;
            ctx.font = `${angleFontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${deg}°`, cx + Math.cos(rad) * labelR, cy + Math.sin(rad) * labelR);
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3 / this.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        // Scan sweep fill (polygon)
        ctx.beginPath();
        let hasPoints = false;
        for (let deg = 0; deg < 360; deg++) {
            const d = this.distances[deg];
            if (d <= 0) continue;
            const clampedD = Math.min(d, this.maxRange);
            const r = (clampedD / this.maxRange) * radius;
            const rad = (deg - 90) * (Math.PI / 180);
            const px = cx + Math.cos(rad) * r;
            const py = cy + Math.sin(rad) * r;
            if (!hasPoints) {
                ctx.moveTo(px, py);
                hasPoints = true;
            } else {
                ctx.lineTo(px, py);
            }
        }
        if (hasPoints) {
            ctx.closePath();
            ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.lineWidth = 1 / this.zoom;
            ctx.stroke();
        }

        // Distance dots
        const dotRadius = 2 / this.zoom;
        for (let deg = 0; deg < 360; deg++) {
            const d = this.distances[deg];
            if (d <= 0) continue;
            const clampedD = Math.min(d, this.maxRange);
            const r = (clampedD / this.maxRange) * radius;
            const rad = (deg - 90) * (Math.PI / 180);
            const px = cx + Math.cos(rad) * r;
            const py = cy + Math.sin(rad) * r;

            // Color: green for far, yellow/red for close
            const ratio = clampedD / this.maxRange;
            const red = Math.round(255 * (1 - ratio));
            const green = Math.round(200 * ratio);
            ctx.beginPath();
            ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${red}, ${green}, 80)`;
            ctx.fill();
        }

        // --- HUD overlay (screen‑space, DPR only, no pan/zoom) ---
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Title
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('LIDAR', 8, 8);

        // Zoom indicator (bottom‑right)
        const zoomPct = Math.round(this.zoom * 100);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${zoomPct}%`, w - 8, h - 8);

        // Hint when zoomed / panned
        if (this.zoom !== 1 || this.panX !== 0 || this.panY !== 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = '9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('dbl‑click to reset', w - 8, h - 22);
        }
    }
}


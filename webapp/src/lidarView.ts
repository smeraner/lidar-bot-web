/**
 * LidarView — 360° radar-style canvas visualization of lidar distances.
 * Draws concentric range rings, angle markers, and distance dots in polar coordinates.
 */
export class LidarView {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private maxRange = 4000; // max distance in mm
    private animFrameId: number | null = null;
    private distances: number[] = new Array(360).fill(0);

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private resize() {
        const parent = this.canvas.parentElement!;
        const w = parent.offsetWidth - 24;  // subtract padding
        const h = parent.offsetHeight - 24;
        const size = Math.max(Math.min(w, h), 200); // minimum 200px fallback
        this.canvas.width = size;
        this.canvas.height = size;
        this.draw();
    }

    update(distances: number[]) {
        this.distances = distances;
        if (!this.animFrameId) {
            this.animFrameId = requestAnimationFrame(() => {
                this.draw();
                this.animFrameId = null;
            });
        }
    }

    private draw() {
        const { ctx, canvas } = this;
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 20;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0c1222';
        ctx.fillRect(0, 0, w, h);

        // Range rings
        const ringCount = 4;
        for (let i = 1; i <= ringCount; i++) {
            const r = (radius / ringCount) * i;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Range label
            const rangeVal = Math.round((this.maxRange / ringCount) * i);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${rangeVal}mm`, cx, cy - r + 12);
        }

        // Angle lines (every 45°)
        for (let deg = 0; deg < 360; deg += 45) {
            const rad = (deg - 90) * (Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Angle label
            const labelR = radius + 12;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${deg}°`, cx + Math.cos(rad) * labelR, cy + Math.sin(rad) * labelR);
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
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
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Distance dots
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
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${red}, ${green}, 80)`;
            ctx.fill();
        }

        // Title
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('LIDAR', 8, 8);
    }
}

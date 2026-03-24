/**
 * SimulationView — A 2D canvas visualization of the virtual LidarBot.
 * Tracks position (x, y) and heading (rotation).
 * Updates based on robot movement commands.
 */
export class SimulationView {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animFrameId: number | null = null;

    // Bot state
    private posX = 0; // mm
    private posY = 0; // mm
    private heading = 0; // degrees, 0 is North/Up
    private path: { x: number, y: number }[] = [];
    private lidarDistances: number[] = new Array(360).fill(0);
    private ledColor = '#1e293b'; 
    private ledShowInterval: any = null;

    // Kinematics (estimation for simulation)
    // Adjusted: Speed 1 (kinematic) ≈ 150mm/s, 45deg/s
    private readonly TRANS_SCALE = 150; 
    private readonly ROT_SCALE = 45;

    // View state
    private zoom = 1;
    private panX = 0;
    private panY = 0;
    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this.canvas.parentElement!);
        
        this.setupInteractions();
        this.reset();
    }

    private setupInteractions() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(0.1, Math.min(this.zoom, 10));
            this.scheduleDraw();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = (e.clientX - this.lastMouseX) / this.zoom;
            const dy = (e.clientY - this.lastMouseY) / this.zoom;
            this.panX += dx;
            this.panY += dy;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.scheduleDraw();
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    private commandQueue: { x: number, y: number, z: number, duration: number }[] = [];
    private isProcessingQueue = false;

    reset() {
        this.stopLedShow();
        this.posX = 0;
        this.posY = 0;
        this.heading = 0;
        this.path = [{ x: 0, y: 0 }];
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.lidarDistances.fill(0);
        this.ledColor = '#1e293b';
        this.commandQueue = [];
        this.isProcessingQueue = false;
        this.scheduleDraw();
    }

    setLidarData(distances: number[]) {
        this.lidarDistances = [...distances];
        this.scheduleDraw();
    }

    setLedColor(r: number, g: number, b: number) {
        this.stopLedShow();
        this.ledColor = `rgb(${r},${g},${b})`;
        this.scheduleDraw();
    }

    ledShow() {
        this.stopLedShow();
        let count = 0;
        this.ledShowInterval = setInterval(() => {
            count++;
            if (count > 10) { // 1 second (10 * 100ms)
                this.stopLedShow();
                this.ledColor = '#1e293b'; // Off
            } else {
                this.ledColor = count % 2 === 0 ? 'rgb(255,255,255)' : '#1e293b';
            }
            this.scheduleDraw();
        }, 100);
    }

    private stopLedShow() {
        if (this.ledShowInterval) {
            clearInterval(this.ledShowInterval);
            this.ledShowInterval = null;
        }
    }

    async updateCommand(x: number, y: number, z: number, duration: number) {
        console.log(`Sim: Command received x=${x}, y=${y}, z=${z}, dur=${duration}`);
        this.commandQueue.push({ x, y, z, duration });
        this.processQueue();
    }

    private async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.commandQueue.length > 0) {
            const { x, y, z, duration } = this.commandQueue.shift()!;
            await this.runCommand(x, y, z, duration);
        }

        this.isProcessingQueue = false;
    }

    private async runCommand(x: number, y: number, z: number, duration: number) {
        if (duration === 0) return;

        const steps = Math.max(1, Math.floor(60 * (duration / 1000)));
        const dx = (x * this.TRANS_SCALE) / 60;
        const dy = (y * this.TRANS_SCALE) / 60;
        const dz = (z * this.ROT_SCALE) / 60;

        for (let i = 0; i < steps; i++) {
            this.heading += dz;
            const rad = (this.heading - 90) * (Math.PI / 180);
            const moveX = dy * Math.cos(rad) + dx * Math.cos(rad + Math.PI/2);
            const moveY = dy * Math.sin(rad) + dx * Math.sin(rad + Math.PI/2);
            
            this.posX += moveX;
            this.posY += moveY;

            // Update path every few steps
            if (i % 5 === 0) {
                this.path.push({ x: this.posX, y: this.posY });
                if (this.path.length > 500) this.path.shift();
            }

            this.scheduleDraw();
            await new Promise(r => setTimeout(r, 1000/60));
        }
    }

    public resize() {
        const parent = this.canvas.parentElement!;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        const dpr = window.devicePixelRatio || 1;

        if (w === 0 || h === 0) return;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        this.draw();
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
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const cx = w / 2;
        const cy = h / 2;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        this.drawGrid(ctx, w, h);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.panX, this.panY);

        // Draw Path
        if (this.path.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 2 / this.zoom;
            ctx.moveTo(this.path[0].x / 10, -this.path[0].y / 10);
            for (let i = 1; i < this.path.length; i++) {
                ctx.lineTo(this.path[i].x / 10, -this.path[i].y / 10);
            }
            ctx.stroke();
        }

        // Draw Bot
        ctx.save();
        ctx.translate(this.posX / 10, -this.posY / 10);

        // Draw Lidar Points
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        for (let i = 0; i < 360; i++) {
            const dist = this.lidarDistances[i];
            if (dist > 0 && dist < 4000) { // Max 4m for visualization
                const angleRad = ((i + this.heading - 90) * Math.PI) / 180;
                const lx = (dist / 10) * Math.cos(angleRad);
                const ly = (dist / 10) * Math.sin(angleRad);
                ctx.beginPath();
                ctx.arc(lx, ly, 1.5 / this.zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.rotate((this.heading * Math.PI) / 180);

        // Bot Body
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(-15, -20, 30, 40, 5);
        ctx.fill();

        // Heading Indicator (Arrow)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(8, -12);
        ctx.lineTo(-8, -12);
        ctx.closePath();
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-18, -15, 6, 12);
        ctx.fillRect(12, -15, 6, 12);
        ctx.fillRect(-18, 5, 6, 12);
        ctx.fillRect(12, 5, 6, 12);

        // LEDs (drawn as distinct circles)
        ctx.fillStyle = this.ledColor;
        const ledPositions = [[-12, -12], [12, -12], [-12, 12], [12, 12]];
        for (const [lx, ly] of ledPositions) {
            ctx.beginPath();
            ctx.arc(lx, ly, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.restore();

        // HUD Info
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px Inter';
        ctx.fillText(`X: ${Math.round(this.posX)}mm Y: ${Math.round(this.posY)}mm H: ${Math.round(this.heading)}° Z: ${this.zoom.toFixed(2)}x`, 10, h - 10);
    }

    private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
        ctx.save();
        ctx.translate(w/2, h/2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.panX, this.panY);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1 / this.zoom;
        const cellSize = 50; // 500mm grid
        
        const startX = Math.floor((-w/2 / this.zoom - this.panX) / cellSize) * cellSize;
        const endX = Math.ceil((w/2 / this.zoom - this.panX) / cellSize) * cellSize;
        const startY = Math.floor((-h/2 / this.zoom - this.panY) / cellSize) * cellSize;
        const endY = Math.ceil((h/2 / this.zoom - this.panY) / cellSize) * cellSize;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += cellSize) {
            ctx.moveTo(x, startY); ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += cellSize) {
            ctx.moveTo(startX, y); ctx.lineTo(endX, y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

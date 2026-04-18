export type Obstacle =
  | { type: 'circle'; x: number; y: number; radius: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number };

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
  private path: { x: number; y: number }[] = [];
  private lidarDistances: number[] = new Array(360).fill(0);
  private ledColor = '#1e293b';
  private ledShowInterval: any = null;

  // Visual effects
  private bumpEffect = 0; // 0 to 1

  // Obstacles
  private obstacles: Obstacle[] = [];
  private draggingObstacleIndex: number | null = null;

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
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Convert click to simulation coordinates
      const w = this.canvas.width / dpr;
      const h = this.canvas.height / dpr;
      const simX = ((mx - w / 2) / this.zoom - this.panX) * 10;
      const simY = -((my - h / 2) / this.zoom - this.panY) * 10;

      // Check if clicked on an obstacle
      const idx = this.obstacles.findIndex((obs) => {
        if (obs.type === 'circle') {
          const dist = Math.sqrt((simX - obs.x) ** 2 + (simY - obs.y) ** 2);
          return dist < obs.radius + 50; // extra tolerance
        } else {
          return (
            simX > obs.x - obs.width / 2 - 50 &&
            simX < obs.x + obs.width / 2 + 50 &&
            simY > obs.y - obs.height / 2 - 50 &&
            simY < obs.y + obs.height / 2 + 50
          );
        }
      });

      if (idx !== -1) {
        this.draggingObstacleIndex = idx;
        this.isDragging = false; // Disable panning if dragging obstacle
      } else {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.draggingObstacleIndex !== null) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        this.obstacles[this.draggingObstacleIndex].x = ((mx - w / 2) / this.zoom - this.panX) * 10;
        this.obstacles[this.draggingObstacleIndex].y = -((my - h / 2) / this.zoom - this.panY) * 10;
        this.scheduleDraw();
        return;
      }

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
      this.draggingObstacleIndex = null;
    });
  }

  private commandQueue: { x: number; y: number; z: number; duration: number }[] = [];
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
    this.bumpEffect = 0;
    this.lidarDistances.fill(0);
    this.ledColor = '#1e293b';
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.scheduleDraw();
  }

  setLidarData(distances: number[]) {
    this.lidarDistances = distances;
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
      if (count > 10) {
        // 1 second (10 * 100ms)
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

  addObstacle(type: 'circle' | 'rect' = 'circle') {
    const simX = -this.panX * 10 + (Math.random() - 0.5) * 500;
    const simY = this.panY * 10 + (Math.random() - 0.5) * 500;
    if (type === 'circle') {
      this.obstacles.push({
        type: 'circle',
        x: simX,
        y: simY,
        radius: 150 + Math.random() * 100,
      });
    } else {
      this.obstacles.push({
        type: 'rect',
        x: simX,
        y: simY,
        width: 300 + Math.random() * 200,
        height: 100 + Math.random() * 100,
      });
    }
    this.scheduleDraw();
  }

  getVirtualLidarData(): number[] {
    const distances = new Array(360).fill(0);
    // Capture state for visual alignment
    for (let i = 0; i < 360; i++) {
      // Angle 0 is Front. North is 90 on unit circle.
      const angleDeg = 90 - (this.heading + i);
      const angleRad = (angleDeg * Math.PI) / 180;
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);

      let minDoc = 4000; // Max range 4m

      for (const obs of this.obstacles) {
        if (obs.type === 'circle') {
          // Ray-Circle Intersection
          const ocX = this.posX - obs.x;
          const ocY = this.posY - obs.y;

          const a = dirX * dirX + dirY * dirY;
          const b = 2 * (ocX * dirX + ocY * dirY);
          const c = ocX * ocX + ocY * ocY - obs.radius * obs.radius;

          const discriminant = b * b - 4 * a * c;
          if (discriminant > 0) {
            const t = (-b - Math.sqrt(discriminant)) / (2 * a);
            if (t > 0 && t < minDoc) {
              minDoc = t;
            }
          }
        } else if (obs.type === 'rect') {
          // Ray-Rect Expansion / AABB
          const minX = obs.x - obs.width / 2;
          const maxX = obs.x + obs.width / 2;
          const minY = obs.y - obs.height / 2;
          const maxY = obs.y + obs.height / 2;

          let tmin = -Infinity,
            tmax = Infinity;

          if (Math.abs(dirX) < 1e-5) {
            if (this.posX < minX || this.posX > maxX) continue;
          } else {
            const t1 = (minX - this.posX) / dirX;
            const t2 = (maxX - this.posX) / dirX;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
          }

          if (Math.abs(dirY) < 1e-5) {
            if (this.posY < minY || this.posY > maxY) continue;
          } else {
            const t1 = (minY - this.posY) / dirY;
            const t2 = (maxY - this.posY) / dirY;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
          }

          if (tmax >= tmin && tmax >= 0) {
            const t = tmin > 0 ? tmin : tmax;
            if (t > 0 && t < minDoc) {
              minDoc = t;
            }
          }
        }
      }
      distances[i] = minDoc < 4000 ? Math.round(minDoc) : 0;
    }
    return distances;
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
    const botRadius = 25; // collision radius

    for (let i = 0; i < steps; i++) {
      this.heading += dz;
      const rad = (90 - this.heading) * (Math.PI / 180);

      const moveX = dy * Math.cos(rad) + dx * Math.cos(rad - Math.PI / 2);
      const moveY = dy * Math.sin(rad) + dx * Math.sin(rad - Math.PI / 2);

      const nextX = this.posX + moveX;
      const nextY = this.posY + moveY;
      let collision = false;

      // Collision Check
      for (const obs of this.obstacles) {
        if (obs.type === 'circle') {
          const dist = Math.sqrt((nextX - obs.x) ** 2 + (nextY - obs.y) ** 2);
          if (dist < botRadius + obs.radius) {
            collision = true;
            break;
          }
        } else if (obs.type === 'rect') {
          const rectMinX = obs.x - obs.width / 2;
          const rectMaxX = obs.x + obs.width / 2;
          const rectMinY = obs.y - obs.height / 2;
          const rectMaxY = obs.y + obs.height / 2;
          const closestX = Math.max(rectMinX, Math.min(nextX, rectMaxX));
          const closestY = Math.max(rectMinY, Math.min(nextY, rectMaxY));
          const dist = Math.sqrt((nextX - closestX) ** 2 + (nextY - closestY) ** 2);
          if (dist < botRadius) {
            collision = true;
            break;
          }
        }
      }

      if (!collision) {
        this.posX = nextX;
        this.posY = nextY;
      } else {
        this.bumpEffect = 1.0;
      }

      if (this.bumpEffect > 0) this.bumpEffect = Math.max(0, this.bumpEffect - 0.05);

      // Update path every few steps
      if (i % 5 === 0) {
        this.path.push({ x: this.posX, y: this.posY });
        if (this.path.length > 500) this.path.shift();
      }

      this.scheduleDraw();
      await new Promise((r) => setTimeout(r, 1000 / 60));
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

    // Subtle background for premium look
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Flash screen on bump
    if (this.bumpEffect > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${this.bumpEffect * 0.2})`;
      ctx.fillRect(0, 0, w, h);
    }

    this.drawGrid(ctx, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.panX, this.panY);

    // Draw Fading Path
    if (this.path.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const len = this.path.length;
      for (let i = 1; i < len; i++) {
        ctx.beginPath();
        const op = i / len;
        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.pow(op, 2) * 0.7})`; // non-linear fade
        ctx.lineWidth = 3 / this.zoom;
        ctx.moveTo(this.path[i - 1].x / 10, -this.path[i - 1].y / 10);
        ctx.lineTo(this.path[i].x / 10, -this.path[i].y / 10);
        ctx.stroke();
      }
    }

    // Draw Obstacles (Premium styling)
    for (const obs of this.obstacles) {
      ctx.save();
      const isDragged = this.obstacles.indexOf(obs) === this.draggingObstacleIndex;

      // Glow / Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = (isDragged ? 30 : 15) / this.zoom;
      ctx.shadowOffsetY = (isDragged ? 10 : 5) / this.zoom;

      // Gradient Fill
      let grad;
      if (obs.type === 'circle') {
        const cxO = obs.x / 10;
        const cyO = -obs.y / 10;
        const oR = obs.radius / 10;
        grad = ctx.createRadialGradient(cxO - oR * 0.2, cyO - oR * 0.2, oR * 0.1, cxO, cyO, oR);
      } else {
        const minX = (obs.x - obs.width / 2) / 10;
        const minY = -(obs.y + obs.height / 2) / 10;
        grad = ctx.createLinearGradient(minX, minY, minX, minY + obs.height / 10);
      }

      grad.addColorStop(0, '#94a3b8'); // lighter top
      grad.addColorStop(1, '#475569'); // darker bottom

      ctx.fillStyle = grad;
      ctx.strokeStyle = isDragged ? '#f8fafc' : '#64748b';
      ctx.lineWidth = 2 / this.zoom;

      ctx.beginPath();
      if (obs.type === 'circle') {
        ctx.arc(obs.x / 10, -obs.y / 10, obs.radius / 10, 0, Math.PI * 2);
      } else {
        ctx.roundRect(
          (obs.x - obs.width / 2) / 10,
          -(obs.y + obs.height / 2) / 10,
          obs.width / 10,
          obs.height / 10,
          8 / this.zoom,
        );
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Lidar Sweep Rays — anchored to current bot position/heading
    ctx.save();
    ctx.translate(this.posX / 10, -this.posY / 10);
    for (let i = 0; i < 360; i++) {
      const dist = this.lidarDistances[i];
      if (dist > 0 && dist < 4000) {
        const worldAngle = this.heading + i;
        const unitAngle = (90 - worldAngle) * (Math.PI / 180);
        const lx = (dist / 10) * Math.cos(unitAngle);
        const ly = -(dist / 10) * Math.sin(unitAngle);

        // Sweeping ray
        ctx.beginPath();
        const rayGrad = ctx.createLinearGradient(0, 0, lx, ly);
        rayGrad.addColorStop(0, 'rgba(239, 68, 68, 0.0)');
        rayGrad.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
        ctx.strokeStyle = rayGrad;
        ctx.lineWidth = 1 / this.zoom;
        ctx.moveTo(0, 0);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        // Impact dot
        ctx.beginPath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.arc(lx, ly, 1.5 / this.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Draw Bot
    ctx.save();
    ctx.translate(this.posX / 10, -this.posY / 10);
    ctx.rotate((this.heading * Math.PI) / 180);

    // Bot Chassis Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 12 / this.zoom;
    ctx.shadowOffsetY = 6 / this.zoom;

    // Bot Gradient
    const botGrad = ctx.createLinearGradient(0, -20, 0, 20);
    botGrad.addColorStop(0, '#38bdf8'); // light blue
    botGrad.addColorStop(1, '#0284c7'); // sky blue
    ctx.fillStyle = botGrad;
    ctx.beginPath();
    ctx.roundRect(-15, -20, 30, 40, 6);
    ctx.fill();
    ctx.restore(); // remove shadow for internal details

    // Glassy border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Heading Arrow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(6, -9);
    ctx.lineTo(-6, -9);
    ctx.closePath();
    ctx.fill();

    // Wheels Matrix
    ctx.fillStyle = '#0f172a'; // very dark slate
    const wheelPos = [
      [-21, -15],
      [15, -15],
      [-21, 5],
      [15, 5],
    ];
    for (const [wx, wy] of wheelPos) {
      // Base wheel
      ctx.beginPath();
      ctx.roundRect(wx, wy, 6, 12, 2);
      ctx.fill();
      // Tread pattern
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let t = wy + 2; t < wy + 11; t += 3) {
        ctx.beginPath();
        ctx.moveTo(wx, t);
        ctx.lineTo(wx + 6, t);
        ctx.stroke();
      }
    }

    // Lidar Dome on top
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spinning Lidar "eye"
    ctx.save();
    // Use Date.now() for continuous spin instead of frame count for smoothness
    ctx.translate(0, 5);
    ctx.rotate(((Date.now() % 2000) / 2000) * Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(6, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // LEDs with Glow
    ctx.save();
    const ledPositions = [
      [-11, -12],
      [11, -12],
      [-11, 12],
      [11, 12],
    ];
    ctx.fillStyle = this.ledColor;
    if (this.ledColor !== '#1e293b') {
      ctx.shadowColor = this.ledColor;
      ctx.shadowBlur = 12;
    }
    for (const [lx, ly] of ledPositions) {
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // end bot rotation
    ctx.restore(); // end zoom/pan

    // HUD Info Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillText(
      `X: ${Math.round(this.posX)}mm | Y: ${Math.round(this.posY)}mm | H: ${Math.round(this.heading)}° | Z: ${this.zoom.toFixed(2)}x`,
      12,
      h - 12,
    );

    // Re-schedule draw if bot is moving or bump effect is active to ensure smooth animation
    if (this.bumpEffect > 0 || (this.isProcessingQueue && this.commandQueue.length > 0)) {
      this.scheduleDraw();
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.panX, this.panY);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1 / this.zoom;
    const cellSize = 50; // 500mm grid

    const startX = Math.floor((-w / 2 / this.zoom - this.panX) / cellSize) * cellSize;
    const endX = Math.ceil((w / 2 / this.zoom - this.panX) / cellSize) * cellSize;
    const startY = Math.floor((-h / 2 / this.zoom - this.panY) / cellSize) * cellSize;
    const endY = Math.ceil((h / 2 / this.zoom - this.panY) / cellSize) * cellSize;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += cellSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += cellSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    // Draw center crosshair
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)'; // faint blue at origin
    ctx.beginPath();
    ctx.moveTo(-100, 0);
    ctx.lineTo(100, 0);
    ctx.moveTo(0, -100);
    ctx.lineTo(0, 100);
    ctx.stroke();

    ctx.restore();
  }
}

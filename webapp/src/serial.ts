import { Toast } from './toast';

export interface IBridgeTransport {
  readonly isConnected: boolean;
  readonly robotStatus: 'connected' | 'disconnected' | 'searching';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(x: number, y: number, z: number, duration?: number): Promise<void>;
  sendLedShow(): Promise<void>;
  sendLedColor(r: number, g: number, b: number): Promise<void>;
  pair(): Promise<void>;
  requestStatus(): Promise<void>;
  onLidarData(callback: (points: { angle: number; distance: number }[]) => void): void;
  onImuData(callback: (pitch: number, roll: number, yaw: number) => void): void;
  onRobotStatus(callback: (status: 'connected' | 'disconnected' | 'searching') => void): void;
}

export class SerialBridge implements IBridgeTransport {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<string> | null = null;
  private _isConnected: boolean = false;
  private _robotStatus: 'connected' | 'disconnected' | 'searching' = 'disconnected';
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private abortController: AbortController | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private lidarCallback: ((points: { angle: number; distance: number }[]) => void) | null = null;
  private imuCallback: ((pitch: number, roll: number, yaw: number) => void) | null = null;
  private robotStatusCallback:
    | ((status: 'connected' | 'disconnected' | 'searching') => void)
    | null = null;

  get isConnected() {
    return this._isConnected;
  }

  get robotStatus() {
    return this._robotStatus;
  }

  async connect() {
    try {
      const port = await navigator.serial.requestPort();
      this.port = port;
      await port.open({ baudRate: 500000 });

      if (!port.writable || !port.readable) {
        throw new Error('Serial port is not writable/readable');
      }

      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable, { signal }).catch((e) => {
        if (e.name !== 'AbortError') console.error('Serial write pipe error', e);
      });
      this.writer = textEncoder.writable.getWriter();

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable as any, { signal }).catch((e) => {
        if (e.name !== 'AbortError') console.error('Serial read pipe error', e);
      });
      this.reader = textDecoder.readable.getReader();

      this._isConnected = true;
      this.readLoopPromise = this.readLoop();

      // Request initial status
      await this.requestStatus();

      console.log('Connected to ESP32 Bridge');
    } catch (e: any) {
      this._isConnected = false;
      console.error('Serial Connection Failed', e);
      Toast.error(`Serial Connection Failed: ${e?.message || e}`);
    }
  }

  constructor() {
    if (navigator.serial) {
      navigator.serial.addEventListener('disconnect', (event) => {
        if (this.port === event.target) {
          console.warn('Serial device disconnected');
          Toast.warn('Serial device disconnected');
          this.disconnect();
        }
      });
    }
  }

  private async readLoop() {
    let buffer = '';
    while (this._isConnected && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            this.handleIncomingLine(line.trim());
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Read error', e);
        }
        break;
      }
    }
  }

  private handleIncomingLine(line: string) {
    if (line.startsWith('lidar:')) {
      const dataStr = line.substring(6);
      const data = dataStr.split(',');
      const points: { angle: number; distance: number }[] = [];
      for (let i = 0; i < data.length - 1; i += 2) {
        const rawAngle = parseInt(data[i]);
        const distance = parseInt(data[i + 1]);
        if (!isNaN(rawAngle) && !isNaN(distance)) {
          // Adjust 90+7.45 degrees so physical front (270) aligns with UI Front (0)
          // including the +0.13 rad (+7.45 deg) offset used in LidarCar.cpp
          const angle = (rawAngle + 97.45) % 360;
          points.push({ angle, distance });
        }
      }
      if (this.lidarCallback) {
        this.lidarCallback(points);
      }

      // If we receive lidar data, the robot is definitely connected
      if (this._robotStatus !== 'connected') {
        this._robotStatus = 'connected';
        if (this.robotStatusCallback) this.robotStatusCallback('connected');
      }
    } else if (line.startsWith('imu:')) {
      const dataStr = line.substring(4);
      const data = dataStr.split(',');
      if (data.length === 3 && this.imuCallback) {
        const pitch = parseFloat(data[0]);
        const roll = parseFloat(data[1]);
        const yaw = parseFloat(data[2]);
        if (!isNaN(pitch) && !isNaN(roll) && !isNaN(yaw)) {
          this.imuCallback(pitch, roll, yaw);
        }
      }
    } else if (line.startsWith('status:')) {
      const statusMatch = line.match(
        /^status:(robot_connected|robot_disconnected|robot_searching)$/,
      );
      if (statusMatch) {
        const status = statusMatch[1];
        if (status === 'robot_connected') {
          this._robotStatus = 'connected';
          if (this.robotStatusCallback) this.robotStatusCallback('connected');
        } else if (status === 'robot_disconnected') {
          this._robotStatus = 'disconnected';
          if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
        } else if (status === 'robot_searching') {
          this._robotStatus = 'searching';
          if (this.robotStatusCallback) this.robotStatusCallback('searching');
        }
      }
    } else if (line.startsWith('debug:')) {
      console.log('Bridge Debug:', line.substring(6));
    }
  }

  onLidarData(callback: (points: { angle: number; distance: number }[]) => void) {
    this.lidarCallback = callback;
  }

  onImuData(callback: (pitch: number, roll: number, yaw: number) => void) {
    this.imuCallback = callback;
  }

  onRobotStatus(callback: (status: 'connected' | 'disconnected' | 'searching') => void) {
    this.robotStatusCallback = callback;
  }

  async disconnect() {
    if (!this._isConnected && !this.port) return;

    this._isConnected = false;
    this._robotStatus = 'disconnected';

    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch (e) {
        console.warn('Read loop error during disconnect:', e);
      }
      this.readLoopPromise = null;
    }

    if (this.reader) {
      try {
        this.reader.releaseLock();
      } catch (e) {
        console.warn('Error releasing reader lock:', e);
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch (e) {
        console.warn('Error releasing writer lock:', e);
      }
      this.writer = null;
    }

    this.abortController = null;

    if (this.port) {
      try {
        // Wait a small amount of time for the streams to be released by the browser
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.port.close();
      } catch (e) {
        console.error('Error closing serial port:', e);
      }
      this.port = null;
    }

    console.log('Disconnected from Serial Bridge');
    if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
  }

  async sendCommand(x: number, y: number, z: number, duration: number = 0) {
    if (this.writer) {
      const command = duration > 0 ? `${x},${y},${z},${duration}\n` : `${x},${y},${z}\n`;
      await this.writer.write(command);
    } else {
      console.warn('Serial port not connected');
    }
  }

  async sendLedShow() {
    if (this.writer) {
      await this.writer.write('ledshow\n');
    }
  }

  async sendLedColor(r: number, g: number, b: number) {
    if (this.writer) {
      await this.writer.write(`ledcolor:${r},${g},${b}\n`);
    }
  }

  async pair() {
    if (this.writer) {
      await this.writer.write('pair\n');
    }
  }

  async requestStatus() {
    if (this.writer) {
      await this.writer.write('status?\n');
    }
  }
}

export const serialBridge = new SerialBridge();

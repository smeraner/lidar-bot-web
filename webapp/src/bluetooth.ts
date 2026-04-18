import { Toast } from './toast';

// Nordic UART Service UUIDs (must match firmware)

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Bridge → App (Notify)
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // App → Bridge (Write)

export class BluetoothBridge {
  private device: BluetoothDevice | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private _isConnected: boolean = false;
  private _robotStatus: 'connected' | 'disconnected' | 'searching' = 'disconnected';
  private lidarCallback: ((points: { angle: number; distance: number }[]) => void) | null = null;
  private imuCallback: ((pitch: number, roll: number, yaw: number) => void) | null = null;
  private robotStatusCallback:
    | ((status: 'connected' | 'disconnected' | 'searching') => void)
    | null = null;
  private buffer: string = '';
  private encoder = new TextEncoder();

  get isConnected() {
    return this._isConnected;
  }

  get robotStatus() {
    return this._robotStatus;
  }

  async connect() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [NUS_SERVICE_UUID] }],
        optionalServices: [NUS_SERVICE_UUID],
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

      const server = await device.gatt!.connect();

      const service = await server.getPrimaryService(NUS_SERVICE_UUID);

      // TX: notifications from bridge
      this.txChar = await service.getCharacteristic(NUS_TX_CHAR_UUID);
      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
        this.onTxNotification(event);
      });

      // RX: write commands to bridge
      this.rxChar = await service.getCharacteristic(NUS_RX_CHAR_UUID);

      this._isConnected = true;
      this.buffer = '';

      // Request initial status
      await this.requestStatus();

      console.log('Connected to LidarBot-Bridge via BLE');
    } catch (e: any) {
      this._isConnected = false;
      console.error('BLE Connection Failed', e);
      Toast.error(`BLE Connection Failed: ${e?.message || e}`);
    }
  }

  private onTxNotification(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const chunk = new TextDecoder().decode(value);
    this.buffer += chunk;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.handleIncomingLine(line.trim());
    }
  }

  private handleIncomingLine(line: string) {
    if (/^lidar:(?:\d+,\d+,?)+$/.test(line)) {
      const dataStr = line.substring(6);
      const data = dataStr.endsWith(',')
        ? dataStr.substring(0, dataStr.length - 1).split(',')
        : dataStr.split(',');
      const points: { angle: number; distance: number }[] = [];
      for (let i = 0; i < data.length; i += 2) {
        const rawAngle = parseInt(data[i]);
        const distance = parseInt(data[i + 1]);
        if (!isNaN(rawAngle) && !isNaN(distance)) {
          // Adjust 90 degrees so physical front (270) aligns with UI Front (0)
          const angle = (rawAngle + 90) % 360;
          points.push({ angle, distance });
        }
      }
      if (this.lidarCallback) {
        this.lidarCallback(points);
      }
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
      console.log('Bridge Debug (BLE):', line.substring(6));
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

  private onDisconnected() {
    this._isConnected = false;
    this._robotStatus = 'disconnected';
    this.txChar = null;
    this.rxChar = null;

    console.log('BLE disconnected');
    if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
  }

  async disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this._isConnected = false;
    this._robotStatus = 'disconnected';
    this.device = null;

    this.txChar = null;
    this.rxChar = null;
    this.buffer = '';
    console.log('Disconnected from BLE Bridge');
    if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
  }

  private writeQueue: string[] = [];
  private isWriting = false;

  private async bleWrite(data: string) {
    this.writeQueue.push(data);
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      while (this.writeQueue.length > 0) {
        const currentData = this.writeQueue.shift()!;
        if (!this.rxChar) continue;
        const bytes = this.encoder.encode(currentData);
        const CHUNK = 20;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const slice = bytes.slice(i, i + CHUNK);
          await this.rxChar.writeValueWithoutResponse(slice);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  async sendCommand(x: number, y: number, z: number, duration: number = 0) {
    const command = duration > 0 ? `${x},${y},${z},${duration}\n` : `${x},${y},${z}\n`;
    await this.bleWrite(command);
  }

  async sendLedShow() {
    await this.bleWrite('ledshow\n');
  }

  async sendLedColor(r: number, g: number, b: number) {
    await this.bleWrite(`ledcolor:${r},${g},${b}\n`);
  }

  async pair() {
    await this.bleWrite('pair\n');
  }

  async requestStatus() {
    await this.bleWrite('status?\n');
  }
}

export const bluetoothBridge = new BluetoothBridge();

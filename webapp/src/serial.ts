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
    onLidarData(callback: (points: { angle: number, distance: number }[]) => void): void;
    onRobotStatus(callback: (status: 'connected' | 'disconnected' | 'searching') => void): void;
}

export class SerialBridge implements IBridgeTransport {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter<string> | null = null;
    private _isConnected: boolean = false;
    private _robotStatus: 'connected' | 'disconnected' | 'searching' = 'disconnected';
    private reader: ReadableStreamDefaultReader<string> | null = null;
    private lidarCallback: ((points: { angle: number, distance: number }[]) => void) | null = null;
    private robotStatusCallback: ((status: 'connected' | 'disconnected' | 'searching') => void) | null = null;

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
                throw new Error("Serial port is not writable/readable");
            }

            const textEncoder = new TextEncoderStream();
            textEncoder.readable.pipeTo(port.writable);
            this.writer = textEncoder.writable.getWriter();

            const textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable as any);
            this.reader = textDecoder.readable.getReader();
            
            this._isConnected = true;
            this.readLoop();
            
            // Request initial status
            await this.requestStatus();
            
            console.log("Connected to ESP32 Bridge");
        } catch (e: any) {
            this._isConnected = false;
            console.error("Serial Connection Failed", e);
            alert(`Serial Connection Failed: ${e?.message || e}`);
        }
    }

    private async readLoop() {
        let buffer = "";
        while (this._isConnected && this.reader) {
            try {
                const { value, done } = await this.reader.read();
                if (done) break;
                buffer += value;
                let lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    this.handleIncomingLine(line.trim());
                }
            } catch (e) {
                console.error("Read error", e);
                break;
            }
        }
    }

    private handleIncomingLine(line: string) {
        if (line.startsWith("lidar:")) {
            const data = line.substring(6).split(",");
            const points: { angle: number, distance: number }[] = [];
            for (let i = 0; i < data.length; i += 2) {
                const angle = parseInt(data[i]);
                const distance = parseInt(data[i + 1]);
                if (!isNaN(angle) && !isNaN(distance)) {
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
        } else if (line.startsWith("status:")) {
            const status = line.substring(7);
            if (status === "robot_connected") {
                this._robotStatus = 'connected';
                if (this.robotStatusCallback) this.robotStatusCallback('connected');
            } else if (status === "robot_disconnected") {
                this._robotStatus = 'disconnected';
                if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
            } else if (status === "robot_searching") {
                this._robotStatus = 'searching';
                if (this.robotStatusCallback) this.robotStatusCallback('searching');
            }
        } else if (line.startsWith("debug:")) {
            console.log("Bridge Debug:", line.substring(6));
        }
    }

    onLidarData(callback: (points: { angle: number, distance: number }[]) => void) {
        this.lidarCallback = callback;
    }

    onRobotStatus(callback: (status: 'connected' | 'disconnected' | 'searching') => void) {
        this.robotStatusCallback = callback;
    }

    async disconnect() {
        this._isConnected = false;
        this._robotStatus = 'disconnected';
        if (this.reader) {
            await this.reader.cancel();
            this.reader = null;
        }
        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }
        if (this.port) {
            await this.port.close();
            this.port = null;
        }
        console.log("Disconnected from Serial Bridge");
        if (this.robotStatusCallback) this.robotStatusCallback('disconnected');
    }

    async sendCommand(x: number, y: number, z: number, duration: number = 0) {
        if (this.writer) {
            const command = duration > 0 ? `${x},${y},${z},${duration}\n` : `${x},${y},${z}\n`;
            await this.writer.write(command);
        } else {
            console.warn("Serial port not connected");
        }
    }

    async sendLedShow() {
        if (this.writer) {
            await this.writer.write("ledshow\n");
        }
    }

    async sendLedColor(r: number, g: number, b: number) {
        if (this.writer) {
            await this.writer.write(`ledcolor:${r},${g},${b}\n`);
        }
    }

    async pair() {
        if (this.writer) {
            await this.writer.write("pair\n");
        }
    }

    async requestStatus() {
        if (this.writer) {
            await this.writer.write("status?\n");
        }
    }
}

export const serialBridge = new SerialBridge();
export class SerialBridge {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter<string> | null = null;
    private _isConnected: boolean = false;
    private reader: ReadableStreamDefaultReader<string> | null = null;
    private lidarCallback: ((points: { angle: number, distance: number }[]) => void) | null = null;

    get isConnected() {
        return this._isConnected;
    }

    async connect() {
        try {
            const port = await navigator.serial.requestPort();
            this.port = port;
            await port.open({ baudRate: 115200 });
            
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
            
            console.log("Connected to ESP32 Bridge");
        } catch (e) {
            this._isConnected = false;
            console.error("Serial Connection Failed", e);
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
                points.push({
                    angle: parseInt(data[i]),
                    distance: parseInt(data[i + 1])
                });
            }
            if (this.lidarCallback) {
                this.lidarCallback(points);
            }
        }
    }

    onLidarData(callback: (points: { angle: number, distance: number }[]) => void) {
        this.lidarCallback = callback;
    }

    async disconnect() {
        if (this.port) {
            this._isConnected = false;
            if (this.reader) await this.reader.cancel();
            await this.port.close();
            this.port = null;
            this.writer = null;
            this.reader = null;
            console.log("Disconnected from Serial Bridge");
        }
    }

    async sendCommand(x: number, y: number, z: number) {
        if (this.writer) {
            const command = `${x},${y},${z}\n`;
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
}

export const serialBridge = new SerialBridge();
export class SerialBridge {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter<string> | null = null;
    private _isConnected: boolean = false;

    get isConnected() {
        return this._isConnected;
    }

    async connect() {
        try {
            const port = await navigator.serial.requestPort();
            this.port = port;
            await port.open({ baudRate: 115200 });
            
            if (!port.writable) {
                throw new Error("Serial port is not writable");
            }

            const textEncoder = new TextEncoderStream();
            textEncoder.readable.pipeTo(port.writable);
            this.writer = textEncoder.writable.getWriter();
            this._isConnected = true;
            
            console.log("Connected to ESP32 Bridge");
        } catch (e) {
            this._isConnected = false;
            console.error("Serial Connection Failed", e);
        }
    }

    async disconnect() {
        if (this.port) {
            await this.port.close();
            this.port = null;
            this.writer = null;
            this._isConnected = false;
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
}

export const serialBridge = new SerialBridge();
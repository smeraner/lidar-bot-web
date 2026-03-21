Here is a comprehensive implementation plan to build a PoC web app for remote-controlling the M5 LidarBot (v1) using Blockly, Web Serial (USB), and an ESP32 bridge.

### Architecture Overview
1. **Web App (Browser):** A TypeScript-based Single Page Application (SPA) using Blockly for visual programming. It uses the **Web Serial API** to communicate with the ESP32 Bridge via USB.
2. **ESP32 Bridge:** An ESP32 connected to the PC via USB. It reads serial commands from the Web App, packages them into ESP-NOW structures, and broadcasts them.
3. **M5 LidarBot:** Receives the ESP-NOW packets and executes the motor commands (no changes needed to its default firmware if you mimic the original remote's data structure).

---

### 1. Project Structure
We will use a monorepo approach to keep the firmware and the web app together.

```text
lidarbot-blockly-poc/
├── firmware/                  # ESP32 Bridge Firmware (PlatformIO / Arduino IDE)
│   ├── src/
│   │   └── main.cpp           # Main ESP32 bridge logic
│   └── platformio.ini         # PlatformIO configuration
└── webapp/                    # Web Application
    ├── index.html
    ├── package.json
    ├── vite.config.ts         # Vite bundler config
    ├── src/
    │   ├── main.ts            # Application entry point
    │   ├── serial.ts          # Web Serial API wrapper
    │   ├── blockly/
    │   │   ├── blocks.ts      # Custom Blockly block definitions
    │   │   └── generator.ts   # Code generator (Blocks -> JS/Serial commands)
    │   └── ui/                # UI logic (connect button, blockly workspace)
    └── tsconfig.json
```

---

### 2. ESP32 Bridge Firmware (Arduino/C++)

The bridge will read JSON or simple delimited strings from the USB Serial port and forward them via ESP-NOW. Based on the original LidarBot repository, the remote control typically sends a struct containing X, Y, and Z (rotation) joystick values.

**`firmware/src/main.cpp`**
```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>

// MAC Address of the LidarBot. Replace with your LidarBot's MAC, 
// or use Broadcast Address {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF} for PoC
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Data structure matching the LidarBot's expected ESP-NOW payload
typedef struct struct_message {
    int8_t x_value;
    int8_t y_value;
    int8_t z_value;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  // Register peer
  memcpy(peerInfo.peer_addr, lidarBotAddress, 6);
  peerInfo.channel = 0;  
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    Serial.println("Failed to add peer");
    return;
  }
}

void loop() {
  // Read simple comma-separated commands from Web Serial API (e.g., "0,100,0\n")
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    
    int firstComma = input.indexOf(',');
    int secondComma = input.indexOf(',', firstComma + 1);
    
    if (firstComma > 0 && secondComma > 0) {
      myData.x_value = input.substring(0, firstComma).toInt();
      myData.y_value = input.substring(firstComma + 1, secondComma).toInt();
      myData.z_value = input.substring(secondComma + 1).toInt();
      
      // Send message via ESP-NOW
      esp_now_send(lidarBotAddress, (uint8_t *) &myData, sizeof(myData));
    }
  }
}
```

---

### 3. SPA Web App (TypeScript + Blockly)

Initialize the project using Vite: `npm create vite@latest webapp -- --template vanilla-ts`

#### A. Web Serial Implementation
We need a module to handle the USB connection to the ESP32 bridge.

**`webapp/src/serial.ts`**
```typescript
export class SerialBridge {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  async connect() {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();
      console.log("Connected to ESP32 Bridge");
    } catch (e) {
      console.error("Serial Connection Failed", e);
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
```

#### B. Blockly Custom Blocks
Define custom blocks representing robot movements.

**`webapp/src/blockly/blocks.ts`**
```typescript
import * as Blockly from 'blockly';

export function defineBlocks() {
  Blockly.Blocks['lidarbot_move'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Move")
          .appendField(new Blockly.FieldDropdown([
            ["Forward", "FORWARD"], 
            ["Backward", "BACKWARD"], 
            ["Left", "LEFT"], 
            ["Right", "RIGHT"]
          ]), "DIRECTION")
          .appendField("Speed")
          .appendField(new Blockly.FieldNumber(50, 0, 100), "SPEED");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    }
  };

  Blockly.Blocks['lidarbot_stop'] = {
    init: function() {
      this.appendDummyInput().appendField("Stop LidarBot");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
    }
  };
}
```

#### C. Code Generation
Convert the visual blocks into executable JavaScript that calls our `SerialBridge`. Because Blockly executes synchronously but our movements take time, we wrap the commands in asynchronous delays.

**`webapp/src/blockly/generator.ts`**
```typescript
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

export function defineGenerators() {
  javascriptGenerator.forBlock['lidarbot_move'] = function(block: any) {
    const direction = block.getFieldValue('DIRECTION');
    const speed = block.getFieldValue('SPEED');
    
    let x=0, y=0, z=0;
    if (direction === 'FORWARD') y = speed;
    if (direction === 'BACKWARD') y = -speed;
    if (direction === 'LEFT') x = -speed;
    if (direction === 'RIGHT') x = speed;

    // Generate code to send command, wait 1 second (as an example)
    const code = `
      await serialBridge.sendCommand(${x}, ${y}, ${z});
      await new Promise(r => setTimeout(r, 1000));
    `;
    return code;
  };

  javascriptGenerator.forBlock['lidarbot_stop'] = function() {
    return `await serialBridge.sendCommand(0, 0, 0);\n`;
  };
}
```

#### D. Application Entry Point
Tie the UI, Blockly workspace, and Web Serial together.

**`webapp/src/main.ts`**
```typescript
import * as Blockly from 'blockly';
import { serialBridge } from './serial';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { javascriptGenerator } from 'blockly/javascript';

defineBlocks();
defineGenerators();

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: `
    <xml>
      <block type="lidarbot_move"></block>
      <block type="lidarbot_stop"></block>
    </xml>
  `
});

document.getElementById('connectBtn')?.addEventListener('click', () => {
  serialBridge.connect();
});

document.getElementById('runBtn')?.addEventListener('click', async () => {
  const code = javascriptGenerator.workspaceToCode(workspace);
  // Expose serialBridge to the eval context
  (window as any).serialBridge = serialBridge; 
  
  try {
    // Wrap in an async IIFE to support await in generated code
    const AsyncFunction = async function () {}.constructor as any;
    const execute = new AsyncFunction(code);
    await execute();
  } catch (e) {
    console.error("Execution error", e);
  }
});
```

### Next Steps for the PoC
1. **Flash the ESP32**: Upload the `main.cpp` via Arduino IDE or PlatformIO to a generic ESP32 board.
2. **Find MAC Address**: You might need to retrieve the exact MAC Address of your LidarBot and replace the `0xFF...` broadcast array in the C++ code to prevent cross-talk if other ESP-NOW devices are nearby.
3. **Run Web App**: Run `npm install` and `npm run dev` in the `webapp` folder.
4. **Test**: Click "Connect" (ensure you are using a Chromium-based browser like Chrome or Edge that supports Web Serial), select your ESP32's COM port, drag blocks into the workspace, and click "Run".
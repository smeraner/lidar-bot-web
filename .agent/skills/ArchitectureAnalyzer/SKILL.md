---
name: ArchitectureAnalyzer
description: Explains the communication flow and data structures for the LidarBotWeb project.
---

# ArchitectureAnalyzer Skill

This skill explains how the different parts of the LidarBotWeb project interact, enabling assistants to analyze architectural changes.

## 🌉 Communication Chain
1. **Web App (Vite/TS/Blockly)**: Generates JavaScript code from visual blocks.
2. **Web Serial (SerialBridge)**: Sends ASCII strings (e.g., `"x,y,z\n"`) to the ESP32.
3. **ESP32 Bridge**: Parses the Serial string, updates the `struct_message` payload.
4. **ESP-NOW**: Direct wireless broadcast from ESP32 to LidarBot.
5. **M5 LidarBot**: Processes receipt of the `struct_message` and controls the motors.

## 📦 Data Structures

### ESP-NOW Payload (`struct_message`)
This structure matches the LidarBot's expectations:
```cpp
typedef struct struct_message {
    int8_t x_value;  // Left/Right steering (-128 to 127)
    int8_t y_value;  // Forward/Backward speed (-128 to 127)
    int8_t z_value;  // Rotation/Z-axis controls (-128 to 127)
} struct_message;
```

### Serial Command Format
The `webapp/src/serial.ts` class sends comma-separated integers followed by a newline:
`[x_value],[y_value],[z_value]\n`
Example: `0,100,0\n` (Move forward with speed 100).

## 🔌 Web Serial State Management
The `SerialBridge` in `webapp/src/serial.ts` manages:
- **`port`**: The `SerialPort` object requested via `navigator.serial.requestPort()`.
- **`writer`**: The `WritableStreamDefaultWriter` used for synchronous-like `write` operations.

## 🧰 Custom Blockly Generators
The `webapp/src/blockly/generator.ts` uses an asynchronous design to wait for robot movement:
```typescript
const code = `
  await serialBridge.sendCommand(${x}, ${y}, ${z});
  await new Promise(r => setTimeout(r, 1000));
`;
```
This approach prevents flooding the serial buffer and allows timed movements.

## 🧪 Testing and Verification
For end-to-end testing of this architecture, refer to the [**web-testing workflow**](file:///d:/Projekte/LidarBotWeb/.agent/workflows/web-testing.md).

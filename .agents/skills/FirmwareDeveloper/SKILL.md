---
name: FirmwareDeveloper
description: Expert guidance on developing, building, and flashing the ESP32 bridge firmware for LidarBotWeb.
---

# FirmwareDeveloper Skill

This skill provides the necessary technical details and workflows for developing the **ESP32 Bridge Firmware** located in the `firmware-bridge/` directory, and the **LidarBot Firmware** located in `firmware-lidarbot/`.

## 🛠 Development Environment

The firmware is built using **PlatformIO** and the **Arduino framework**.

### Configuration (`platformio.ini`)
The Bridge project is optimized for the **M5 Stick-C (ESP32)**:
- **Board**: `m5stick-c`
- **Framework**: `arduino`
- **Libraries**: `m5stack/M5StickC` (for LCD and Button support)
- **Serial Speed**: `115200` baud (Monitor and App communication)

## 🚀 Build and Flash Workflow

For a fully automated deployment, refer to the **firmware-upload workflow** (`.agents/workflows/firmware-upload.md`).

Instead of invoking `pio` directly, use the provided npm scripts at the project root for convenience:
- **Compile and Upload Bridge**: `npm run flash-bridge`
- **Serial Monitor Bridge**: `npm run monitor-bridge`
- **Compile and Upload LidarBot**: `npm run flash-bot`
- **Serial Monitor LidarBot**: `npm run monitor-bot`
- **Check/Lint Firmware**: `npm run lint-firmware`
- **Test Firmware**: `npm run test-firmware`

## 📡 Bridge Logic (ESP-NOW)

The bridge acts as a protocol translator between **USB Serial** and **ESP-NOW**.

### Incoming Serial Parsing
The firmware reads `\n` terminated strings from `Serial`.
- Expected format: `x,y,z\n` (integers from -100 to 100).
- Special command: `ledshow\n` (triggers the LidarBot's RGB animation).

### ESP-NOW Transmission
- **Mode**: `WIFI_STA` (required for ESP-NOW).
- **Protocol**: Broadcast by default (`{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}`).
- **Payload**: `struct_message` (3 bytes for movement, 4 bytes for LED show).

## 📺 UI and Debugging (M5 Stick-C)

The M5 Stick-C's 80x160 TFT display is used for local status monitoring:
- **Yellow Header**: Indicates the bridge is ready.
- **Green Text**: Shows the last command received over Serial.
- **Red Highlight**: Indicates an Emergency Stop triggered by **Button A**.
- **Packet Counter**: Shows the number of Lidar data packets received via ESP-NOW.

## 🔬 Debugging Tips

1. **Monitor the Serial Console**: Use `npm run monitor-bridge` to see raw Lidar data packets (`lidar:angle,dist,...`) coming from the robot.
2. **LCD Echo**: If the Web UI says it's sending data but the robot doesn't move, check the M5 Stick-C's screen to see if the command was actually received by the bridge.
3. **MAC Binding**: For high-interference environments, replace the broadcast MAC with the specific MAC address of the LidarBot in `main.cpp`.

## ⚠️ Known Issues
- **ESP-NOW Versioning**: Depending on the ESP32 core version, the `esp_now_register_recv_cb` signature may need to be updated. The current implementation uses the classic `(mac, data, len)` signature.
- **Power Management**: The bridge remains powered via USB from the PC. Ensure the LidarBot has enough battery for stable ESP-NOW reception.

---
name: FirmwareDeveloper
description: Expert guidance on developing, building, and flashing the ESP32 bridge firmware for LidarBotWeb.
---

# FirmwareDeveloper Skill

This skill provides the necessary technical details and workflows for developing the **ESP32 Bridge Firmware** located in the `firmware/` directory.

## 🛠 Development Environment

The firmware is built using **PlatformIO** and the **Arduino framework**.

### Configuration (`platformio.ini`)
The project is optimized for the **M5 Stick-C (ESP32)**:
- **Board**: `m5stick-c`
- **Framework**: `arduino`
- **Libraries**: `m5stack/M5StickC` (for LCD and Button support)
- **Serial Speed**: `115200` baud (Monitor and App communication)

## 🚀 Build and Flash Workflow

For a fully automated deployment, use the [**/firmware-upload workflow**](file:///d:/Projekte/LidarBotWeb/.agent/workflows/firmware-upload.md).

Since `pio` might not be in the system PATH, use the full path to the PlatformIO core executable found in the user's profile.

### Common Commands (PowerShell)
- **Compile and Upload**:
  ```powershell
  & "C:\Users\$env:USERNAME\.platformio\penv\Scripts\pio.exe" run --target upload
  ```
- **Serial Monitor**:
  ```powershell
  & "C:\Users\$env:USERNAME\.platformio\penv\Scripts\pio.exe" device monitor -b 115200
  ```
- **List Devices**:
  ```powershell
  & "C:\Users\$env:USERNAME\.platformio\penv\Scripts\pio.exe" device list
  ```

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

1.  **Monitor the Serial Console**: Use `pio device monitor` to see raw Lidar data packets (`lidar:angle,dist,...`) coming from the robot.
2.  **LCD Echo**: If the Web UI says it's sending data but the robot doesn't move, check the M5 Stick-C's screen to see if the command was actually received by the bridge.
3.  **MAC Binding**: For high-interference environments, replace the broadcast MAC with the specific MAC address of the LidarBot in `main.cpp`.

## ⚠️ Known Issues
- **ESP-NOW Versioning**: Depending on the ESP32 core version, the `esp_now_register_recv_cb` signature may need to be updated. The current implementation uses the classic `(mac, data, len)` signature.
- **Power Management**: The bridge remains powered via USB from the PC. Ensure the LidarBot has enough battery for stable ESP-NOW reception.

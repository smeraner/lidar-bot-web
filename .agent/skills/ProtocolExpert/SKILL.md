---
name: ProtocolExpert
description: Defines and explains the communication protocols between Web UI, Bridge, and LidarBot.
---

# ProtocolExpert Skill

This skill provides a detailed reference for all communication protocols used in the LidarBotWeb project.

## 📡 Overall Communication Flow

```mermaid
graph LR
    A[Web App] -- Web Serial --> B[ESP32 Bridge]
    B -- ESP-NOW --> C[LidarBot]
    C -- ESP-NOW --> B
    B -- Web Serial --> A
```

---

## 💻 Web App ↔ ESP32 Bridge (Serial)

The Web App communicates with the ESP32 Bridge via the **Web Serial API** at **115,200 baud**.

### 🔼 Outgoing: Web → Bridge
All commands are ASCII strings terminated with a newline (`\n`).

| Command | Format | Example | Description |
| :--- | :--- | :--- | :--- |
| **Move** | `x,y,z\n` | `0,100,0\n` | Sends movement values (-100 to 100). |
| **LED Show** | `ledshow\n` | `ledshow\n` | Triggers the LidarBot's disco animation. |

### 🔽 Incoming: Bridge → Web
Data from the bridge is prefixed with a type identifier.

| Type | Format | Description |
| :--- | :--- | :--- |
| **Lidar** | `lidar:a1,d1,a2,d2,...,a45,d45\n` | 45 Lidar points (Angle, Distance) per line. |

---

## 📶 Bridge ↔ LidarBot (ESP-NOW)

The ESP32 Bridge acts as a relay between the Web App and the LidarBot using the **ESP-NOW** protocol.

### 🔼 Outgoing: Bridge → LidarBot
The payload length determines the interpretation on the LidarBot.

| Payload Size | Interpretation | Data Structure |
| :--- | :--- | :--- |
| **3 Bytes** | Movement | `int8_t x, y, z` values. |
| **4 Bytes** | LED Show | Any 4-byte payload triggers the animation. |
| **7 Bytes** | Handshake | Used for initial pairing (Broadcast). |

### 🔽 Incoming: LidarBot → Bridge
The LidarBot continuously broadcasts its scan data.

| Payload Size | Data Structure |
| :--- | :--- |
| **180 Bytes** | **45 Scan Points**. Each point is **4 bytes**: |
| | - Byte 0-1: Angle (uint16_t, Little Endian) |
| | - Byte 2-3: Distance (uint16_t, Little Endian, in mm) |

---

## 🛠 Parsing & State Management

### Lidar Data Parsing (Web side)
The `SerialBridge` class in `webapp/src/serial.ts` uses a line-based buffer to parse `lidar:` messages and updates the `LidarStore`.

### LidarStore
The `LidarStore` (`webapp/src/lidarStore.ts`) maintains an array of 360 distances, updating indices based on the received angles.

---

## ⚠️ Important Implementation Notes
- **Endianness**: ESP-NOW Lidar data is sent in **Little Endian**.
- **Broadcast**: The bridge currently uses `{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}` as the destination MAC for broadcast communication.
- **Buffer Safety**: The Blockly generator adds a delay after movement commands to ensure the Serial buffer is not overwhelmed and the bot has time to execute the instruction.

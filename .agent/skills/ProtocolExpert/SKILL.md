---
name: ProtocolExpert
description: Defines and explains the communication protocols between Web UI, Bridge, and LidarBot (V1 Hardware).
---

# ProtocolExpert Skill

This skill provides a detailed reference for all communication protocols used in the LidarBotWeb project, specifically tailored for the **first hardware version** of the M5Stack LidarBot and its interaction with the ESP32 Bridge.

## 📡 Overall Communication Flow

```mermaid
graph LR
    A[Web App] -- Web Serial --> B[ESP32 Bridge]
    B -- ESP-NOW Broadcast --> C[LidarBot V1]
    C -- ESP-NOW --> B
    B -- Web Serial --> A
````

-----

## 💻 Web App ↔ ESP32 Bridge (Serial)

The Web App communicates with the ESP32 Bridge via the **Web Serial API** at **115,200 baud**.

### 🔼 Outgoing: Web → Bridge

All commands are ASCII strings terminated with a newline (`\n`).

| Command | Format | Example | Description |
| :--- | :--- | :--- | :--- |
| **Move** | `x,y,z\n` | `0,100,0\n` | Sends movement values (-100 to 100). `x` = strafe, `y` = forward/back, `z` = rotation. |
| **LED Show** | `ledshow\n` | `ledshow\n` | Triggers the LidarBot's RGB LED disco animation. |
| **Pair** | `pair\n` | `pair\n` | Manually forces the bridge to send a pairing handshake to the bot. |
| **Status Query**| `status?\n` | `status?\n` | Requests the current connection state of the robot. |

### 🔽 Incoming: Bridge → Web

Data from the bridge is prefixed with a type identifier for easy parsing on the frontend.

| Type | Format | Description |
| :--- | :--- | :--- |
| **Lidar** | `lidar:a1,d1,a2,d2,...,a45,d45\n` | 45 Lidar points (Angle, Distance) per line. |
| **Status** | `status:robot_connected\n` <br> `status:robot_disconnected\n` <br> `status:robot_searching\n` | Reports LidarBot connection and pairing status changes. |

-----

## 📶 Bridge ↔ LidarBot V1 (ESP-NOW)

The ESP32 Bridge acts as a relay between the Web App and the LidarBot using the **ESP-NOW** protocol on **Channel 1**. The original V1 LidarBot firmware relies heavily on **payload length** to determine the type of incoming command rather than explicit headers.

### 🔄 Pairing & Handshake Process (V1)

Because ESP-NOW is connectionless, "pairing" is handled via a broadcast handshake and a timeout-based heartbeat.

1.  **Broadcast Handshake:** The Bridge sends data to the broadcast MAC address: `FF:FF:FF:FF:FF:FF`.
2.  **Auto-Pairing Loop:** If the Bridge has not received data from the LidarBot in the last 2000ms, it considers the bot "Disconnected." While disconnected, the Bridge automatically broadcasts a **7-byte handshake payload** (`{0, 0, 0, 0, 0, 0, 0}`) every 3 seconds.
3.  **Bot Registration:** When the original V1 LidarBot firmware receives this 7-byte packet, it registers the sender's MAC address and begins transmitting its Lidar telemetry back to the Bridge.
4.  **Connection Heartbeat:** As long as the Bridge receives the 180-byte Lidar payload at least once every 2 seconds, the connection state is maintained as `botConnected = true`.

### 🔼 Outgoing: Bridge → LidarBot

Because the V1 firmware routes logic based on packet length, the Bridge sends exact byte sizes:

| Payload Size | Interpretation | Data Structure |
| :--- | :--- | :--- |
| **3 Bytes** | Movement | `int8_t x, y, z` values. Sent directly into the bot's kinematics solver. |
| **4 Bytes** | LED Show | Payload of `{0, 0, 0, 0}` triggers the pre-programmed LED animation. |
| **7 Bytes** | Handshake | Payload of `{0, 0, 0, 0, 0, 0, 0}` sent via broadcast to initiate pairing. |

### 🔽 Incoming: LidarBot → Bridge

The LidarBot continuously broadcasts its scan data once paired.

| Payload Size | Data Structure |
| :--- | :--- |
| **180 Bytes** | **45 Scan Points**. Each point is **4 bytes**: <br> - Byte 0-1: Angle (`uint16_t`, Little Endian) <br> - Byte 2-3: Distance (`uint16_t`, Little Endian, in mm) |

-----

## 🛠 Parsing & State Management

### Lidar Data Parsing (Web side)

The `SerialBridge` class in `webapp/src/serial.ts` uses a line-based buffer to parse `lidar:` messages and updates the `LidarStore`.

### LidarStore

The `LidarStore` (`webapp/src/lidarStore.ts`) maintains an array of 360 distances, updating indices based on the received angles mapped from the Little Endian `uint16_t` values.

-----

## ⚠️ Important Implementation Notes

  - **Endianness**: ESP-NOW Lidar data is sent in **Little Endian**. The ESP32 Bridge parses this using bitwise shifts (e.g., `incomingData[i*4] | (incomingData[i*4+1] << 8)`).
  - **Broadcast MAC**: The bridge currently relies *entirely* on `{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}` as the destination MAC. This means any V1 LidarBot on Channel 1 will respond to the commands.
  - **Emergency Stop**: Pressing `BtnA` on the M5StickC Bridge immediately broadcasts a 3-byte payload of `0, 0, 0` to halt the bot, overriding any buffered web commands.
  - **Buffer Safety**: The web frontend (or Blockly generator) must add a delay after movement commands to ensure the Serial buffer is not overwhelmed and the LidarBot's kinematic loop has time to execute the instruction.


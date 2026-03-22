---
name: ProjectOverview
description: Quick reference for the LidarBotWeb project structure, tech stack, and entry points.
---

# ProjectOverview Skill

This skill provides a high-level overview of the LidarBotWeb project, enabling assistants to quickly orient themselves within the codebase.

## 🗼 Structure
The project is a monorepo consisting of:
- `firmware-bridge/`: ESP32 bridge code (Arduino/C++).
- `firmware-lidarbot/`: ESP32 LidarBot code (Arduino/C++).
- `webapp/`: Vite-powered Single Page Application (TypeScript).

### Key Files
- `firmware-bridge/src/main.cpp`: ESP32 bridge logic (Serial to ESP-NOW).
- `firmware-lidarbot/src/main.cpp`: ESP32 LidarBot logic (ESP-NOW to Motor/Lidar).
- `webapp/src/main.ts`: Web app entry point, initializes Blockly and UI.
- `webapp/src/serial.ts`: Web Serial API wrapper for communication.
- `webapp/src/blockly/`: Contains custom block definitions and code generators.
- `readme.md`: The canonical source for the project requirements and implementation plan.

## 🛠 Tech Stack
- **Frontend**: Vite, TypeScript, Blockly, Web Serial API.
- **Backend/Bridge**: ESP32, ESP-NOW, Arduino Framework.
- **Communication**: ESP-NOW protocol (Low-latency/Direct), USB Serial.

## 🚀 Common Commands
- **Web App**: `npm run dev` in `webapp/` (starts the development server).
- **Firmware**: PlatformIO or Arduino IDE to flash the ESP32.

## 🏃 Common Procedures
Refer to the following workflows for standard tasks:
- **[/web-testing](file:///d:/Projekte/LidarBotWeb/.agent/workflows/web-testing.md)**: Web application testing and validation.
- **[/firmware-upload](file:///d:/Projekte/LidarBotWeb/.agent/workflows/firmware-upload.md)**: Building and flashing the ESP32 bridge.

## 🎯 Important Note
The `webapp` communicates with the `firmware` via Web Serial. Browser support is limited to Chromium-based browsers (Chrome, Edge).

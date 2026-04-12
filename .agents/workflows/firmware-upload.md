---
description: How to build, flash, and verify the ESP32 bridge firmware.
---

# Firmware Upload Workflow

Follow these steps to deploy and verify changes to the firmware:

// turbo
1. **Linting and Static Analysis**:
   Before compiling and uploading, verify the firmware passes Cppcheck.
   ```powershell
   npm run lint-firmware
   ```

2. **Build and Upload**:
   You can use the new npm wrapper script from the project root to automatically compile and flash the connected M5 Stick-C (ensure it is connected).
   ```powershell
   npm run flash-bridge
   ```
   *(Alternatively, run the PlatformIO command directly: `cd firmware-bridge && & "C:\Users\Simon\.platformio\penv\Scripts\pio.exe" run --target upload`)*

3. **Verify Execution**:
   After a successful upload, open the serial monitor to ensure the bridge is running correctly. Look for the "Bridge Ready" state or status updates.
   ```powershell
   npm run monitor-bridge
   ```
   *Expected Output*: You should see `status:robot_searching` if the robot is not yet paired, or `status:robot_connected` if it is.

3. **Check Physical UI**:
   If possible, verify that the M5 Stick-C display shows "Bridge Ready" in yellow.

4. **Test Communication**:
   Type `pair` into the serial monitor.
   *Expected Output*: `debug:sent_pair_handshake`.

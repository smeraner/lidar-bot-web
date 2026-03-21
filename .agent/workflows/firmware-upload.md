---
description: How to build, flash, and verify the ESP32 bridge firmware.
---

# Firmware Upload Workflow

Follow these steps to deploy and verify changes to the firmware:

// turbo
1. **Build and Upload**:
   Run the PlatformIO upload command from the project root. This will automatically compile and flash the connected M5 Stick-C.
   ```powershell
   cd firmware
   & "C:\Users\Simon\.platformio\penv\Scripts\pio.exe" run --target upload
   ```

2. **Verify Execution**:
   After a successful upload, open the serial monitor to ensure the bridge is running correctly. Look for the "Bridge Ready" state or status updates.
   ```powershell
   & "C:\Users\Simon\.platformio\penv\Scripts\pio.exe" device monitor -b 115200
   ```
   *Expected Output*: You should see `status:robot_searching` if the robot is not yet paired, or `status:robot_connected` if it is.

3. **Check Physical UI**:
   If possible, verify that the M5 Stick-C display shows "Bridge Ready" in yellow.

4. **Test Communication**:
   Type `pair` into the serial monitor.
   *Expected Output*: `debug:sent_pair_handshake`.

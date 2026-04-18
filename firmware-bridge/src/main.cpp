#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <M5StickC.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLESecurity.h>
#include <string>

// ──── BLE UART Service (Nordic UART Service UUIDs) ────
#define SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_TX_UUID        "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // Bridge → App (Notify)
#define CHAR_RX_UUID        "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // App → Bridge (Write)

BLEServer *pServer = nullptr;
BLECharacteristic *pTxCharacteristic = nullptr;
bool bleClientConnected = false;
bool lastBleClientConnected = false;
#define BLE_RX_BUF_SIZE 512
char bleRxBuffer[BLE_RX_BUF_SIZE];
int bleRxIndex = 0;
unsigned long lastBleRxTime = 0;

// BLE MTU for chunked sends (conservative, minus ATT overhead)
static const int BLE_CHUNK_SIZE = 200;

// ──── ESP-NOW ────
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
esp_now_peer_info_t peerInfo;

int packetCount = 0;
unsigned long lastRecvTime = 0;
bool lastBotConnected = false;

bool isPairingWindowActive = false;
unsigned long pairingWindowStartTime = 0;

// ──── Heartbeat / Safety Watchdog ────
int8_t lastManualX = 0;
int8_t lastManualY = 0;
int8_t lastManualZ = 0;
unsigned long lastWebTrafficTime = 0;
unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL = 200;
const unsigned long WEB_UI_TIMEOUT = 2000;

// ──── Non-blocking Serial RX buffer ────
#define SERIAL_RX_BUF_SIZE 256
char serialRxBuffer[SERIAL_RX_BUF_SIZE];
int serialRxIndex = 0;

// ──── Deferred Lidar data (filled in ISR, formatted in loop) ────
volatile bool lidarDataReady = false;
uint8_t lidarRawBuffer[180];
volatile int lidarPacketCount = 0;

// ──── Deferred IMU data ────
volatile bool imuDataReady = false;
float imuPitch = 0, imuRoll = 0, imuYaw = 0;

// ──── BLE Callbacks ────
class BleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleClientConnected = true;
  }
  void onDisconnect(BLEServer* pServer) override {
    bleClientConnected = false;
    // Restart advertising so the next client can find us
    pServer->startAdvertising();
  }
};

class BleRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    std::string rxValue = pCharacteristic->getValue();
    for (char c : rxValue) {
        if (bleRxIndex < BLE_RX_BUF_SIZE - 1) {
            bleRxBuffer[bleRxIndex++] = c;
        }
    }
    bleRxBuffer[bleRxIndex] = '\0';
    lastBleRxTime = millis();
  }
};

// ──── Helpers ────

// Send a string to all outputs (USB Serial + BLE TX if connected)
void writeAll(const String &msg) {
  Serial.print(msg);
  if (bleClientConnected && pTxCharacteristic) {
    // BLE notifications must be chunked to fit within MTU
    int len = msg.length();
    for (int i = 0; i < len; i += BLE_CHUNK_SIZE) {
      int chunkLen = min(BLE_CHUNK_SIZE, len - i);
      pTxCharacteristic->setValue((uint8_t*)msg.c_str() + i, chunkLen);
      pTxCharacteristic->notify();
      if (chunkLen == BLE_CHUNK_SIZE) delay(5); // small delay between chunks
    }
  }
}

void writeAllLn(const String &msg) {
  writeAll(msg + "\n");
}

// Process a single command string (shared between USB Serial and BLE inputs)
void processCommand(String input) {
  input.trim();
  if (input.length() == 0) return;

  lastWebTrafficTime = millis();

  // LCD echo
  M5.Lcd.fillRect(0, 25, 160, 20, BLACK);
  M5.Lcd.setCursor(0, 25);
  M5.Lcd.setTextColor(GREEN);
  M5.Lcd.print("> ");
  M5.Lcd.println(input);

  if (input == "pair") {
    isPairingWindowActive = true;
    pairingWindowStartTime = millis();
    uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    uint8_t handshake[7] = {'P', 'A', 'I', 'R', 0, 0, 0};
    for (int i = 0; i < 6; i++) {
      esp_now_send(broadcastMac, handshake, 7);
      delay(100);
    }
    writeAllLn("debug:pair_sent");
  } else if (input == "status?") {
    writeAllLn(lastBotConnected ? "status:robot_connected" : "status:robot_disconnected");
  } else if (input == "ledshow") {
    uint8_t showData[4] = {0, 0, 0, 0};
    esp_now_send(lidarBotAddress, showData, 4);
  } else if (input.startsWith("ledcolor:")) {
    int r, g, b;
    if (sscanf(input.c_str(), "ledcolor:%d,%d,%d", &r, &g, &b) == 3) {
      uint8_t colorData[5] = {(uint8_t)r, (uint8_t)g, (uint8_t)b, 0, 0};
      esp_now_send(lidarBotAddress, colorData, 5);
    }
  } else {
    int x = 0, y = 0, z = 0, duration = 0;
    int parsedArgs = sscanf(input.c_str(), "%d,%d,%d,%d", &x, &y, &z, &duration);

    if (parsedArgs >= 3) {
      // Robot V1 Mapping:
      // X (data[0]) = Forward/Backward Translation in robot's wheel map
      // Y (data[1]) = Rotation OR Side-Translation depending on A flag
      // Actually, looking at LidarCar.cpp:
      // X is rotation (Normal mode) or side-move (Lateral mode)
      // Y is forward/back
      // A (data[2]) is the flag: 0=Normal (Rotate), 1=Lateral (Strafe)

      int8_t robotX = 0;
      int8_t robotY = (int8_t)constrain(y, -7, 7);
      int8_t robotA = 0;

      if (z != 0) {
        // Rotation takes priority or is mixed
        robotX = (int8_t)constrain(z, -7, 7);
        robotA = 0; // Normal mode
      } else if (x != 0) {
        // Strafe mode
        robotX = (int8_t)constrain(x, -7, 7);
        robotA = 1; // Lateral mode
      }

      if (parsedArgs == 4 && duration > 0) {
        // Timed movement (6-byte packet)
        uint8_t moveDataArray[6] = {0, 0, 0, 0, 0, 0};
        moveDataArray[0] = (uint8_t)robotX;
        moveDataArray[1] = (uint8_t)robotY;
        moveDataArray[2] = (uint8_t)robotA;
        moveDataArray[3] = (uint8_t)(duration >> 8);
        moveDataArray[4] = (uint8_t)(duration & 0xFF);
        esp_now_send(lidarBotAddress, moveDataArray, 6);

        // Reset heartbeat state for timed moves
        lastManualX = 0;
        lastManualY = 0;
        lastManualZ = 0;
      } else {
        // Continuous movement (3-byte packet)
        lastManualX = robotX;
        lastManualY = robotY;
        lastManualZ = robotA;

        uint8_t moveDataArray[3];
        moveDataArray[0] = (uint8_t)lastManualX;
        moveDataArray[1] = (uint8_t)lastManualY;
        moveDataArray[2] = (uint8_t)lastManualZ;
        esp_now_send(lidarBotAddress, moveDataArray, 3);
      }
    }
  }
}



// ──── ESP-NOW Callbacks ────

// Intentionally empty – verbose logging here was blocking loop() and
// causing the bot's 500ms watchdog to fire ("start then stop" symptom).
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  (void)mac_addr;
  (void)status;
}

void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  lastRecvTime = millis();

  // Save the bot's MAC address if it's new
  bool isNewMac = false;
  for (int i=0; i<6; i++) {
    if (lidarBotAddress[i] != mac[i]) isNewMac = true;
  }
  if (isNewMac) {
    if (isPairingWindowActive && (millis() - pairingWindowStartTime <= 30000)) {
      memcpy(lidarBotAddress, mac, 6);
      if (esp_now_is_peer_exist(lidarBotAddress)) {
          esp_now_del_peer(lidarBotAddress);
      }
      memcpy(peerInfo.peer_addr, lidarBotAddress, 6);
      peerInfo.channel = 1;
      peerInfo.encrypt = false;
      esp_now_add_peer(&peerInfo);
    }
  }

  if (len == 4) {
    lastBotConnected = true;
  }
  else if (len == 12) {
    // Defer IMU formatting to loop() – just copy raw floats
    memcpy(&imuPitch, incomingData, 4);
    memcpy(&imuRoll, incomingData + 4, 4);
    memcpy(&imuYaw, incomingData + 8, 4);
    imuDataReady = true;
  }
  else if (len == 180) {
    packetCount++;

    // Throttle: send every 4th packet (~10Hz)
    if (packetCount % 4 != 0) return;

    // Copy raw bytes for deferred formatting in loop()
    memcpy(lidarRawBuffer, incomingData, 180);
    lidarPacketCount = packetCount;
    lidarDataReady = true;
  }
}

// ──── Setup ────

void setup() {
  M5.begin();
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);

  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(YELLOW);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(2);
  M5.Lcd.println("Bridge v0.5");
  M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.println("USB + BLE Ready");
  
  M5.Lcd.setCursor(0, 50);
  M5.Lcd.setTextColor(RED);
  M5.Lcd.print("Bot: Disconnected");

  Serial.begin(500000);

  // ── BLE UART Init ──
  BLEDevice::init("LidarBot-Bridge");
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT);
  BLESecurity *pSecurity = new BLESecurity();
  pSecurity->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_BOND);
  pSecurity->setCapability(ESP_IO_CAP_NONE);
  pSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new BleServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // TX Characteristic (Bridge → App): Notify
  pTxCharacteristic = pService->createCharacteristic(
    CHAR_TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX Characteristic (App → Bridge): Write
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    CHAR_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new BleRxCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  // ── Wi-Fi + ESP-NOW Init ──
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("Slave_3", "12345678", 1, 0);
  WiFi.disconnect();
  
  writeAll("debug:bridge_mac:");
  writeAllLn(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    M5.Lcd.setTextColor(RED);
    M5.Lcd.println("ESP-NOW Error");
    return;
  }
  writeAllLn("debug:esp_now_init_success");

  esp_now_register_recv_cb(OnDataRecv);
  esp_now_register_send_cb(OnDataSent);
  
  memset(&peerInfo, 0, sizeof(peerInfo));

  uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  memcpy(peerInfo.peer_addr, broadcastMac, 6);
  peerInfo.channel = 1;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  writeAllLn("status:robot_disconnected");
}

// ──── Loop ────

void loop() {
  M5.update();

  // Robot connection check (heartbeat)
  bool botConnected = (millis() - lastRecvTime < 2000) && (lastRecvTime > 0);

  if (botConnected != lastBotConnected) {
    lastBotConnected = botConnected;
    writeAllLn(botConnected ? "status:robot_connected" : "status:robot_disconnected");

    M5.Lcd.fillRect(0, 48, 160, 12, BLACK);
    M5.Lcd.setCursor(0, 50);
    M5.Lcd.setTextColor(botConnected ? GREEN : RED);
    M5.Lcd.printf("Bot: %s", botConnected ? "Connected" : "Disconnected");

    if (!botConnected) {
        digitalWrite(10, HIGH);
    }
  }

  // BLE connection status on LCD
  if (bleClientConnected != lastBleClientConnected) {
    lastBleClientConnected = bleClientConnected;
    M5.Lcd.fillRect(120, 0, 40, 16, BLACK);
    M5.Lcd.setCursor(120, 4);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(bleClientConnected ? CYAN : DARKGREY);
    M5.Lcd.print(bleClientConnected ? "BLE" : "---");
  }

  // Auto-Pairing Loop
  static unsigned long lastAutoPairTime = 0;
  if (!botConnected && (millis() - lastAutoPairTime > 3000)) {
    lastAutoPairTime = millis();
    uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    uint8_t handshake[7] = {'P', 'A', 'I', 'R', 0, 0, 0};
    esp_now_send(broadcastMac, handshake, 7);
  }

  // Emergency Stop via Physical Button
  if (M5.BtnA.wasPressed()) {
    uint8_t stopData[3] = {0, 0, 0};
    esp_now_send(lidarBotAddress, stopData, 3);

    M5.Lcd.fillRect(0, 25, 160, 20, RED);
    M5.Lcd.setCursor(0, 25);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.println("STOP (BtnA)");
  }

  // ── Process USB Serial input (non-blocking, char-by-char) ──
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialRxIndex > 0) {
        serialRxBuffer[serialRxIndex] = '\0';
        processCommand(String(serialRxBuffer));
        serialRxIndex = 0;
      }
    } else if (serialRxIndex < SERIAL_RX_BUF_SIZE - 1) {
      serialRxBuffer[serialRxIndex++] = c;
    }
  }

  // ── Process BLE input ──
  if (bleRxIndex > 0) {
    if (millis() - lastBleRxTime > 1000) {
      bleRxIndex = 0;
      bleRxBuffer[0] = '\0';
    } else {
      for (int i = 0; i < bleRxIndex; i++) {
        if (bleRxBuffer[i] == '\n') {
          bleRxBuffer[i] = '\0';
          String line = String(bleRxBuffer);
          processCommand(line);
          int remaining = bleRxIndex - (i + 1);
          if (remaining > 0) {
            memmove(bleRxBuffer, &bleRxBuffer[i + 1], remaining);
            bleRxIndex = remaining;
          } else {
            bleRxIndex = 0;
          }
          bleRxBuffer[bleRxIndex] = '\0';
          i = -1;
        }
      }
      if (bleRxIndex >= BLE_RX_BUF_SIZE - 1) {
        processCommand(String(bleRxBuffer));
        bleRxIndex = 0;
        bleRxBuffer[0] = '\0';
      }
    }
  }

  // ── Send deferred IMU data ──
  if (imuDataReady) {
    imuDataReady = false;
    char imuBuf[64];
    snprintf(imuBuf, sizeof(imuBuf), "imu:%.2f,%.2f,%.2f", imuPitch, imuRoll, imuYaw);
    writeAllLn(String(imuBuf));
  }

  // ── Send deferred Lidar data ──
  if (lidarDataReady) {
    lidarDataReady = false;
    int pktCount = lidarPacketCount;

    // Build lidar string using snprintf (faster than String concatenation)
    char lidarBuf[512];
    int pos = 0;
    pos += snprintf(lidarBuf + pos, sizeof(lidarBuf) - pos, "lidar:");
    for (int i = 0; i < 45; i++) {
      uint16_t angle = (lidarRawBuffer[i*4] << 8) + lidarRawBuffer[i*4+1];
      uint16_t distance = (lidarRawBuffer[i*4+2] << 8) + lidarRawBuffer[i*4+3];
      pos += snprintf(lidarBuf + pos, sizeof(lidarBuf) - pos,
                      i < 44 ? "%u,%u," : "%u,%u", angle, distance);
    }
    writeAllLn(String(lidarBuf));

    // Show pulse on LCD and LED
    if ((pktCount / 4) % 5 == 0) {
        digitalWrite(10, LOW);
        M5.Lcd.setCursor(0, 65);
        M5.Lcd.fillRect(0, 65, 160, 15, BLACK);
        M5.Lcd.printf("Lidar PKTs: %d", pktCount);
    } else if ((pktCount / 4) % 5 == 2) {
        digitalWrite(10, HIGH);
    }
  }

  // ── Process Heartbeat (Repeat last manual command) ──
  if (millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = millis();

    // Check for Web UI timeout (safety)
    if (millis() - lastWebTrafficTime > WEB_UI_TIMEOUT && lastWebTrafficTime > 0) {
      if (lastManualX != 0 || lastManualY != 0 || lastManualZ != 0) {
        lastManualX = 0; lastManualY = 0; lastManualZ = 0;
      }
    }

    // Always send current manual state if robot is connected.
    // This satisfies the bot's 500ms watchdog even if X/Y/Z are 0.
    if (botConnected) {
      uint8_t hbData[3] = { (uint8_t)lastManualX, (uint8_t)lastManualY, (uint8_t)lastManualZ };
      esp_now_send(lidarBotAddress, hbData, 3);
    }
  }
}
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
std::string bleRxBuffer = "";
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
    bleRxBuffer += rxValue;
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
    writeAllLn("debug:sent_pair_handshake_broadcast_6_times");
  } else if (input == "status?") {
    writeAll("status:");
    writeAllLn(lastBotConnected ? "robot_connected" : "robot_disconnected");
  } else if (input == "ledshow") {
    uint8_t showData[4] = {0, 0, 0, 0};
    esp_now_send(lidarBotAddress, showData, 4);
    writeAllLn("debug:sent_ledshow_payload_4_bytes");
  } else if (input.startsWith("ledcolor:")) {
    String rgb = input.substring(9);
    int c1 = rgb.indexOf(',');
    int c2 = rgb.indexOf(',', c1 + 1);
    if (c1 > 0 && c2 > 0) {
      uint8_t r = (uint8_t)rgb.substring(0, c1).toInt();
      uint8_t g = (uint8_t)rgb.substring(c1 + 1, c2).toInt();
      uint8_t b = (uint8_t)rgb.substring(c2 + 1).toInt();
      uint8_t colorData[5] = {r, g, b, 0, 0};
      esp_now_send(lidarBotAddress, colorData, 5);
      writeAll("debug:sent_ledcolor_r");
      writeAll(String(r));
      writeAll("_g");
      writeAll(String(g));
      writeAll("_b");
      writeAllLn(String(b));
    }
  } else {
    // Check for move command: x,y,z[,duration]
    int firstComma = input.indexOf(',');
    int secondComma = input.indexOf(',', firstComma + 1);
    int thirdComma = input.indexOf(',', secondComma + 1);

    if (firstComma > 0 && secondComma > 0) {
      int x = input.substring(0, firstComma).toInt();
      int y = input.substring(firstComma + 1, secondComma).toInt();
      
      int z, duration = 0;
      if (thirdComma > 0) {
        z = input.substring(secondComma + 1, thirdComma).toInt();
        duration = input.substring(thirdComma + 1).toInt();
      } else {
        z = input.substring(secondComma + 1).toInt();
      }

      x = constrain(x, -7, 7);
      y = constrain(y, -7, 7);

      if (duration > 0) {
        writeAll("debug:bridge_move_timed_x"); writeAll(String(x));
        writeAll("_y"); writeAll(String(y));
        writeAll("_dur"); writeAllLn(String(duration));

        uint8_t moveDataArray[6] = {0, 0, 0, 0, 0, 0};
        moveDataArray[0] = (uint8_t)(int8_t)x;
        moveDataArray[1] = (uint8_t)(int8_t)y;
        moveDataArray[2] = (uint8_t)(z > 0 ? 1 : 0);
        moveDataArray[3] = (uint8_t)(duration >> 8);
        moveDataArray[4] = (uint8_t)(duration & 0xFF);
        esp_now_send(lidarBotAddress, moveDataArray, 6);
        // Commands with duration clear the repeating manual command to avoid interference
        lastManualX = 0;
        lastManualY = 0;
        lastManualZ = 0;
      } else {
        writeAll("debug:bridge_move_simple_x"); writeAll(String(x));
        writeAll("_y"); writeAllLn(String(y));

        lastManualX = (int8_t)x;
        lastManualY = (int8_t)y;
        lastManualZ = (int8_t)z;

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

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  String msg = "debug:sent_to:";
  for (int i = 0; i < 6; i++) {
    char hex[4];
    snprintf(hex, sizeof(hex), "%02X", mac_addr[i]);
    msg += hex;
    if (i < 5) msg += ":";
  }
  msg += "_status:";
  msg += (status == ESP_NOW_SEND_SUCCESS ? "Success" : "Fail");
  writeAllLn(msg);
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
    } else {
      writeAllLn("debug:ignored_new_mac_pairing_window_closed");
    }
  }

  if (len == 6) {
    writeAllLn("debug:received_6b_broadcast_mac_saved");
  } 
  else if (len == 4) {
    lastBotConnected = true;
    writeAllLn("debug:received_4b_confirmation_paired_successfully");
  } 
  else if (len == 180) {
    packetCount++;
    
    // Throttle Lidar data reporting to prevent Serial/BLE congestion.
    // At ~40 packets/sec (5Hz rotation), sending every 4th packet gives ~10Hz updates.
    if (packetCount % 4 != 0) return;

    String lidarMsg = "lidar:";
    for (int i = 0; i < 45; i++) {
      uint16_t angle = (incomingData[i*4] << 8) + incomingData[i*4+1];
      uint16_t distance = (incomingData[i*4+2] << 8) + incomingData[i*4+3];
      
      lidarMsg += String(angle);
      lidarMsg += ",";
      lidarMsg += String(distance);
      if (i < 44) lidarMsg += ",";
    }
    writeAllLn(lidarMsg);

    // Show pulse on LCD and LED
    if ((packetCount / 4) % 5 == 0) {
        digitalWrite(10, LOW);
        M5.Lcd.setCursor(0, 65);
        M5.Lcd.fillRect(0, 65, 160, 15, BLACK);
        M5.Lcd.printf("Lidar PKTs: %d", packetCount);
    } else if ((packetCount / 4) % 5 == 2) {
        digitalWrite(10, HIGH);
    }
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
  M5.Lcd.println("Bridge v0.4");
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
    writeAll("status:");
    writeAllLn(botConnected ? "robot_connected" : "robot_disconnected");
    
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

  // ── Process USB Serial input ──
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    processCommand(input);
  }

  // ── Process BLE input ──
  if (bleRxBuffer.length() > 0) {
    if (millis() - lastBleRxTime > 1000) {
      bleRxBuffer.clear();
    } else {
      size_t nlPos;
      while ((nlPos = bleRxBuffer.find('\n')) != std::string::npos) {
        String line = String(bleRxBuffer.substr(0, nlPos).c_str());
        bleRxBuffer.erase(0, nlPos + 1);
        processCommand(line);
      }
      if (bleRxBuffer.length() >= 256) {
        processCommand(String(bleRxBuffer.c_str()));
        bleRxBuffer.clear();
      }
    }
  }
  // ── Process Heartbeat (Repeat last manual command) ──
  if (millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = millis();

    // Check for Web UI timeout (safety)
    if (millis() - lastWebTrafficTime > WEB_UI_TIMEOUT && lastWebTrafficTime > 0) {
      if (lastManualX != 0 || lastManualY != 0 || lastManualZ != 0) {
        writeAllLn("debug:web_ui_timeout_stalling_bot");
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
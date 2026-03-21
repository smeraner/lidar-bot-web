#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <M5StickC.h>

// MAC Address of the LidarBot. 
// Starts empty, will be populated during the passive broadcast handshake.
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
esp_now_peer_info_t peerInfo;

int packetCount = 0;
unsigned long lastRecvTime = 0;
bool lastBotConnected = false;

// Callback when data is sent from the Bridge
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("debug:sent_to:");
  for (int i = 0; i < 6; i++) {
    Serial.printf("%02X", mac_addr[i]);
    if (i < 5) Serial.print(":");
  }
  Serial.print("_status:");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Success" : "Fail");
}

// Callback when data is received from LidarBot
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  lastRecvTime = millis();
  
  // Save the bot's MAC address if it's new
  bool isNewMac = false;
  for (int i=0; i<6; i++) {
    if (lidarBotAddress[i] != mac[i]) isNewMac = true;
  }
  if (isNewMac) {
    memcpy(lidarBotAddress, mac, 6);
    if (esp_now_is_peer_exist(lidarBotAddress)) {
        esp_now_del_peer(lidarBotAddress);
    }
    memcpy(peerInfo.peer_addr, lidarBotAddress, 6);
    peerInfo.channel = 1;
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
  }

  // 1. Bot is broadcasting its MAC (Step 1 of Handshake)
  if (len == 6) {
    // Wait for manual pair trigger from the UI to actually send the handshake.
    // LidarBot_RemoteController uses delay(100) and loops 6 times; we do this
    // from the main loop so we don't stall the OnDataRecv callback task.
    Serial.println("debug:received_6b_broadcast_mac_saved");
  } 
  
  // 2. Bot confirms connection (Step 3 of Handshake)
  else if (len == 4) {
    lastBotConnected = true;
    Serial.println("debug:received_4b_confirmation_paired_successfully");
  } 
  
  // 3. Lidar Data Reception
  else if (len == 180) {
    packetCount++;
    
    // Lidar Data: 45 points, each 4 bytes (2 angle, 2 distance)
    Serial.print("lidar:");
    for (int i = 0; i < 45; i++) {
      // Fixed: Big-Endian parsing matching original LidarBot INO
      uint16_t angle = (incomingData[i*4] << 8) + incomingData[i*4+1];
      uint16_t distance = (incomingData[i*4+2] << 8) + incomingData[i*4+3];
      
      Serial.print(angle);
      Serial.print(",");
      Serial.print(distance);
      if (i < 44) Serial.print(",");
    }
    Serial.println();

    // Show pulse on LCD and LED
    if (packetCount % 5 == 0) {
        digitalWrite(10, LOW); // LED ON (Active Low)
        M5.Lcd.setCursor(0, 65);
        M5.Lcd.fillRect(0, 65, 160, 15, BLACK);
        M5.Lcd.printf("Lidar PKTs: %d", packetCount);
    } else if (packetCount % 5 == 2) {
        digitalWrite(10, HIGH); // LED OFF
    }
  }
}

void setup() {
  M5.begin();
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH); // LED OFF

  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(YELLOW);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(2);
  M5.Lcd.println("Bridge v0.3");
  M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.println("Waiting for Bot Handshake...");
  
  M5.Lcd.setCursor(0, 50);
  M5.Lcd.setTextColor(RED);
  M5.Lcd.print("Bot: Disconnected");

  Serial.begin(115200);

  // Force the Wi-Fi radio to stay awake and lock to Channel 1 using the SoftAP trick
  // (Prevents the ESP32 from putting the radio to sleep in disconnected STA mode)
  WiFi.mode(WIFI_AP_STA);
  // Original remote creates SoftAP: Slave_3 on channel 1
  WiFi.softAP("Slave_3", "12345678", 1, 0); 
  WiFi.disconnect(); // Disconnect STA to prevent roaming, but AP keeps radio alive
  
  Serial.print("debug:bridge_mac:");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    M5.Lcd.setTextColor(RED);
    M5.Lcd.println("ESP-NOW Error");
    return;
  }
  Serial.println("debug:esp_now_init_success");

  esp_now_register_recv_cb(OnDataRecv);
  esp_now_register_send_cb(OnDataSent); // Register the send callback
  
  // Prepare peer structure zeroed out
  memset(&peerInfo, 0, sizeof(peerInfo));

  // Register the Broadcast MAC so we can manually blast pairing requests
  uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  memcpy(peerInfo.peer_addr, broadcastMac, 6);
  peerInfo.channel = 1;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  // Tell the Web UI we are disconnected initially
  Serial.println("status:robot_disconnected");
}

void loop() {
  M5.update();

  // Check robot connection (if we got data in the last 2 seconds)
  bool botConnected = (millis() - lastRecvTime < 2000) && (lastRecvTime > 0);
  
  if (botConnected != lastBotConnected) {
    lastBotConnected = botConnected;
    Serial.print("status:");
    Serial.println(botConnected ? "robot_connected" : "robot_disconnected");
    
    // Update display
    M5.Lcd.fillRect(0, 48, 160, 12, BLACK);
    M5.Lcd.setCursor(0, 50);
    M5.Lcd.setTextColor(botConnected ? GREEN : RED);
    M5.Lcd.printf("Bot: %s", botConnected ? "Connected" : "Disconnected");
    
    if (!botConnected) {
        digitalWrite(10, HIGH); // Ensure LED is off if disconnected
    }
  }

  // Auto-Pairing Loop
  static unsigned long lastAutoPairTime = 0;
  if (!botConnected && (millis() - lastAutoPairTime > 3000)) {
    lastAutoPairTime = millis();
    uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    uint8_t handshake[7];
    esp_read_mac(handshake, ESP_MAC_WIFI_STA);
    handshake[6] = 0;
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

  // Process Web UI serial inputs
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    M5.Lcd.fillRect(0, 25, 160, 20, BLACK);
    M5.Lcd.setCursor(0, 25);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.print("> ");
    M5.Lcd.println(input);

    if (input == "pair") {
      // Send the 7-byte handshake via broadcast 6 times with 100ms delays
      uint8_t broadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
      
      uint8_t handshake[7];
      esp_read_mac(handshake, ESP_MAC_WIFI_STA);
      handshake[6] = 0;
      
      for (int i = 0; i < 6; i++) {
        esp_now_send(broadcastMac, handshake, 7);
        delay(100);
      }
      Serial.println("debug:sent_pair_handshake_broadcast_6_times");
    } else if (input == "status?") {
      Serial.print("status:");
      Serial.println(lastBotConnected ? "robot_connected" : "robot_disconnected");
    } else if (input.length() > 0) {
      
      // Check for move command: x,y,z
      int firstComma = input.indexOf(',');
      int secondComma = input.indexOf(',', firstComma + 1);
      
      if (firstComma > 0 && secondComma > 0) {
        int x = input.substring(0, firstComma).toInt();
        int y = input.substring(firstComma + 1, secondComma).toInt();
        int z = input.substring(secondComma + 1).toInt();
        
        // Clamp to LidarBot bounds (-7 to 7)
        x = constrain(x, -7, 7);
        y = constrain(y, -7, 7);

        // Map data directly into the strict 3-byte payload
        uint8_t moveDataArray[3];
        moveDataArray[0] = (uint8_t)(int8_t)x; // Ensure negative two's complement is preserved
        moveDataArray[1] = (uint8_t)(int8_t)y;
        moveDataArray[2] = (uint8_t)(z > 0 ? 1 : 0); // Original expects 0 or 1 for button flag
        
        esp_now_send(lidarBotAddress, moveDataArray, 3);
      }
    }
  }
}
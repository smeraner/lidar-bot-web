#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <M5StickC.h>

// MAC Address of the LidarBot.
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

typedef struct struct_message {
    int8_t x_value;
    int8_t y_value;
    int8_t z_value;
} struct_message;

struct_message moveData;
esp_now_peer_info_t peerInfo;

int packetCount = 0;
unsigned long lastRecvTime = 0;
unsigned long lastPairTime = 0;
bool lastBotConnected = false;

// Callback when data is received from LidarBot
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  lastRecvTime = millis();
  if (len == 180) {
    packetCount++;
    // Lidar Data: 45 points, each 4 bytes (2 angle, 2 distance)
    Serial.print("lidar:");
    for (int i = 0; i < 45; i++) {
      uint16_t angle = incomingData[i*4] | (incomingData[i*4+1] << 8);
      uint16_t distance = incomingData[i*4+2] | (incomingData[i*4+3] << 8);
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
  M5.Lcd.println("Bridge Ready");
  M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.println("Waiting for Web UI...");
  
  M5.Lcd.setCursor(0, 50);
  M5.Lcd.setTextColor(RED);
  M5.Lcd.print("Bot: Disconnected");

  Serial.begin(115200);
  WiFi.mode(WIFI_STA);

  // Set channel manually to 1 (standard for ESP-NOW)
  if (esp_now_init() != ESP_OK) {
    M5.Lcd.setTextColor(RED);
    M5.Lcd.println("ESP-NOW Error");
    return;
  }

  esp_now_register_recv_cb(OnDataRecv);

  // Register peer (Broadcast)
  memcpy(peerInfo.peer_addr, lidarBotAddress, 6);
  peerInfo.channel = 1;  
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    M5.Lcd.setTextColor(RED);
    M5.Lcd.println("Failed to add peer");
    return;
  }
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

  // Auto-pair logic: if not connected, send handshake every 3 seconds
  if (!botConnected && (millis() - lastPairTime > 3000)) {
    lastPairTime = millis();
    uint8_t handshake[7] = {0, 0, 0, 0, 0, 0, 0};
    esp_now_send(lidarBotAddress, handshake, 7);
    
    // Notify Web UI
    Serial.println("status:robot_searching");
    
    // Visual feedback for pairing attempt
    M5.Lcd.setCursor(100, 50);
    M5.Lcd.setTextColor(BLUE);
    M5.Lcd.print("Pair..");
    delay(50); // Minimal delay for visual
    M5.Lcd.fillRect(100, 50, 60, 10, BLACK);
  }

  // Emergency Stop via Physical Button
  if (M5.BtnA.wasPressed()) {
    moveData.x_value = 0;
    moveData.y_value = 0;
    moveData.z_value = 0;
    esp_now_send(lidarBotAddress, (uint8_t *) &moveData, sizeof(moveData));
    M5.Lcd.fillRect(0, 25, 160, 20, RED);
    M5.Lcd.setCursor(0, 25);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.println("STOP (BtnA)");
  }

  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    M5.Lcd.fillRect(0, 25, 160, 20, BLACK);
    M5.Lcd.setCursor(0, 25);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.print("> ");
    M5.Lcd.println(input);

    if (input == "ledshow") {
      uint8_t ledMsg[4] = {0, 0, 0, 0};
      esp_now_send(lidarBotAddress, ledMsg, 4);
    } else if (input == "pair") {
      uint8_t handshake[7] = {0, 0, 0, 0, 0, 0, 0};
      esp_now_send(lidarBotAddress, handshake, 7);
      Serial.println("debug:sent_pair_handshake");
    } else if (input == "status?") {
      Serial.print("status:");
      Serial.println(lastBotConnected ? "robot_connected" : "robot_disconnected");
    } else if (input.length() > 0) {
      // Check for move command: x,y,z
      int firstComma = input.indexOf(',');
      int secondComma = input.indexOf(',', firstComma + 1);
      
      if (firstComma > 0 && secondComma > 0) {
        moveData.x_value = input.substring(0, firstComma).toInt();
        moveData.y_value = input.substring(firstComma + 1, secondComma).toInt();
        moveData.z_value = input.substring(secondComma + 1).toInt();
        esp_now_send(lidarBotAddress, (uint8_t *) &moveData, sizeof(moveData));
      }
    }
  }
}

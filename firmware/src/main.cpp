#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>

// MAC Address of the LidarBot.
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

typedef struct struct_message {
    int8_t x_value;
    int8_t y_value;
    int8_t z_value;
} struct_message;

struct_message moveData;
esp_now_peer_info_t peerInfo;

// Callback when data is received from LidarBot
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  if (len == 180) {
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
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  esp_now_register_recv_cb(OnDataRecv);

  // Register peer
  memcpy(peerInfo.peer_addr, lidarBotAddress, 6);
  peerInfo.channel = 0;  
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    Serial.println("Failed to add peer");
    return;
  }
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input == "ledshow") {
      uint8_t ledMsg[4] = {0, 0, 0, 0};
      esp_now_send(lidarBotAddress, ledMsg, 4);
    } else {
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
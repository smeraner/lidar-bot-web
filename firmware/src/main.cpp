#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>

// MAC Address of the LidarBot. Replace with your LidarBot's MAC, 
// or use Broadcast Address {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF} for PoC
uint8_t lidarBotAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Data structure matching the LidarBot's expected ESP-NOW payload
typedef struct struct_message {
    int8_t x_value;
    int8_t y_value;
    int8_t z_value;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

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
  // Read simple comma-separated commands from Web Serial API (e.g., "0,100,0\n")
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    
    int firstComma = input.indexOf(',');
    int secondComma = input.indexOf(',', firstComma + 1);
    
    if (firstComma > 0 && secondComma > 0) {
      myData.x_value = input.substring(0, firstComma).toInt();
      myData.y_value = input.substring(firstComma + 1, secondComma).toInt();
      myData.z_value = input.substring(secondComma + 1).toInt();
      
      // Send message via ESP-NOW
      esp_now_send(lidarBotAddress, (uint8_t *) &myData, sizeof(myData));
    }
  }
}
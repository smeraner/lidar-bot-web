#include <M5Stack.h>
#include <esp_now.h>
#include "espnow.h"
#include "LidarCar.h"
#include "RprTrack.h"
#include "iic.h"
#include "AccessService.h"

I2C i2c;
Espnow espnow;
LidarCar lidarcar;
AccessService service;

extern const unsigned char gImage_logo[];

void Service(void * pvParameters) {

    for(;;) {
        service.Listen();
        vTaskDelay(pdMS_TO_TICKS(2)); 
    }
    vTaskDelete(NULL);
}

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status);
void OnDataRecv(const uint8_t *mac_addr, const uint8_t *data, int data_len);

void setup() {
  m5.begin();
  Serial1.begin(230400, SERIAL_8N1, 16, 2);  //Lidar
  Serial2.begin(115200);                     //motor

  //!logo
  M5.Lcd.fillScreen(TFT_BLACK);
  m5.lcd.pushImage(0, 0, 320, 240, (uint16_t *)gImage_logo);
  M5.Lcd.setCursor(240, 1, 4);    
  M5.Lcd.printf("V 0.0.2");
  delay(2000);
  M5.Lcd.fillScreen(TFT_BLACK);
  
  //!esp
  espnow.BotInit();
  esp_now_register_recv_cb(OnDataRecv);
  esp_now_register_send_cb(OnDataSent);

  //!service
  service.Init();
  
  M5.Lcd.setCursor(240, 220, 2);    
  M5.Lcd.printf("mode");

  //!Motor
  lidarcar.Init();

  //!Camrea
  i2c.master_start();

  //!Service
  
  xTaskCreatePinnedToCore(
                    Service,
                    "Service",
                    40960,
                    NULL, 
                    5,        
                    NULL,
                    0); 
   
}

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status){
  
}
int flag = 0;
void OnDataRecv(const uint8_t *mac_addr, const uint8_t *data, int data_len)
{
  if(espnow.OnBotRecv(mac_addr,data,data_len)){
    return;
  }
  
 if((data_len == 3) && (!flag)) {
    Serial.printf("debug:bot_move_3b x=%d y=%d z=%d\n", (int8_t)data[0], (int8_t)data[1], data[2]);
    lidarcar.ControlWheel(data[0], data[1], data[2], 0);
 }

 if((data_len == 6) && (!flag)) {
    uint16_t duration = (data[3] << 8) | data[4];
    Serial.printf("debug:bot_move_6b x=%d y=%d z=%d dur=%d\n", (int8_t)data[0], (int8_t)data[1], data[2], duration);
    lidarcar.ControlWheel(data[0], data[1], data[2], duration);
 }

 if((data_len == 4) && (!flag)) {
    lidarcar.LedShow();
 }

 if((data_len == 5) && (!flag)) {
    lidarcar.SetColor(data[0], data[1], data[2]);
 }
  
}

void loop()
{
  espnow.BotConnectUpdate();
  lidarcar.MapDisplay();
  lidarcar.Update();
  //lidarcar.ControlMode();
  
  if(digitalRead(37) == LOW){
   flag++;
   if(flag >= 4) flag = 0;
   while(digitalRead(37) == LOW);
  }
  
  if(flag == 0){ 
    i2c.master_hangs();
    //esp_now_send(espnow.peer_addr, lidarcar.mapdata, 180);
    esp_err_t addStatus = esp_now_send(espnow.peer_addr, lidarcar.mapdata, 180);
    if(addStatus != ESP_OK){
      //lidarcar.ControlWheel(0, 0, 0);
    }
    M5.Lcd.setCursor(240, 0);    
    M5.Lcd.printf("Remote");
  }
  
  if(flag == 1) {
    i2c.master_hangs();
    esp_now_send(espnow.peer_addr, lidarcar.mapdata, 180);
    lidarcar.CarMaze();
    M5.Lcd.setCursor(240, 0);    
    M5.Lcd.printf("Maze  ");
 }
                 
  if(flag == 3) {
    i2c.master_recovery();
    lidarcar.CarCamera();
    M5.Lcd.setCursor(240, 0);    
    M5.Lcd.printf("Camera  ");
  }

   if(flag == 2) {
    i2c.master_hangs();
    lidarcar.TrackControl();
    M5.Lcd.setCursor(240, 0);    
    M5.Lcd.printf("Track  ");
  }
                 
}

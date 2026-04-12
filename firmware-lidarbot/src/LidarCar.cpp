#include "LidarCar.h"

uint8_t rent_pp[29];
Rprtrack rprtrack;


/*!
 * \brief LidarCar::LidarCar
 * \param 
 * - Initial values for the class
 */
LidarCar::LidarCar(){
  commandStatus = 0;
  ver = 0;
  dataLength = 0;
  lidarSpeed = 0;
  angleOffset = 0;
  startAngle = 0;
  packCount = 0;
  showAngle = 0;
}

/*!
 * \brief LidarCar::Init
 * \param 
 * - LidarCar initialization
 */
void LidarCar::Init(void){

  for (int i = 0; i < 16; i++){
    setLedColor(i, 20, 20, 20);
    delay(15);
  }
  for (int i = 0; i < 16; i++)
  {
    setLedColor(i, 0, 0, 0);
    delay(15);
  }
  setLedAll(0, 0, 0); delay(100); setLedAll(20, 20, 20); delay(50);
  setLedAll(0, 0, 0); delay(100); setLedAll(20, 20, 20); delay(120);
  setLedAll(0, 0, 0); delay(100); setLedAll(20, 20, 20); delay(50);
  setLedAll(0, 0, 0); delay(100); setLedAll(20, 20, 20); delay(120);
  setLedAll(0, 0, 0); delay(100); setLedAll(20, 20, 20); delay(50);
  setLedAll(0, 0, 0);
}


/*!
 * \brief LidarCar::LedShow
 * \param 
 * - Light show
 */
void LidarCar::LedShow(void){

  for (int i = 0; i < 16; i++){
    setLedColor(i, 250, 250, 250);
    delay(10);
  }
  for (int i = 0; i < 16; i++)
  {
    setLedColor(i, 250, 250, 250);
    delay(10);
  }

  for (int i = 0; i < 16; i++){
    setLedColor(15-i, 250, 250, 250);
    delay(10);
  }
  for (int i = 0; i < 16; i++)
  {
    setLedColor(15-i, 0, 0, 0);
    delay(10);
  }


  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(50);
  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(120);
  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(50);
  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(120);
  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(50);
  setLedAll(0, 0, 0);

  setLedAll(0, 0, 0); delay(100); setLedAll(255, 255, 255); delay(50);
}

void LidarCar::SetColor(byte r, byte g, byte b){
  setLedAll(r, g, b);
}

/*!
 * \brief LidarCar::setLedColor
 * \param 
 *      i   index of the light (range 0-15)
 *      r   color Red value
 *      g   color Green value
 *      b   color Blue value
 * - Set the color of a specific light
 */
void LidarCar::setLedColor(byte i, byte r, byte g, byte b){
  Serial2.write(0xAB);
  Serial2.write(i);
  Serial2.write(r);
  Serial2.write(g);
  Serial2.write(b);
  Serial2.write(0x55);
}
/*!
 * \brief LidarCar::setFrontLedBar
 * \param 
 *      r   color Red value
 *      g   color Green value
 *      b   color Blue value
 * - Set the color of the front light bar
 */
void LidarCar::setFrontLedBar(byte r, byte g, byte b)
{
  Serial2.write(0xAC);
  Serial2.write(r);
  Serial2.write(g);
  Serial2.write(b);
  Serial2.write(0x55);
}
/*!
 * \brief LidarCar::setBackLedBar
 * \param 
 *      r   color Red value
 *      g   color Green value
 *      b   color Blue value
 * - Set the color of the back light bar
 */
void LidarCar::setBackLedBar( byte r, byte g, byte b)
{
  Serial2.write(0xAD);
  Serial2.write(r);
  Serial2.write(g);
  Serial2.write(b);
  Serial2.write(0x55);
}
/*!
 * \brief LidarCar::setLedAll
 * \param 
 *      r   color Red value
 *      g   color Green value
 *      b   color Blue value
 * - Set the color of all lights
 */
void LidarCar::setLedAll( byte r, byte g, byte b)
{
  Serial2.write(0xAE);
  Serial2.write(r);
  Serial2.write(g);
  Serial2.write(b);
  Serial2.write(0x55);
}
/*!
 * \brief LidarCar::setServo0Angle
 * \param 
 *     angle   angle range 0 - 180 
 * - Set the angle of servo 0
 */
void LidarCar::setServo0Angle(uint8_t angle)
{
  if(angle > 180) angle = 180;
  Serial2.write(0xAF);
  Serial2.write(angle);
  Serial2.write(0x55);
}

/*!
 * \brief LidarCar::setServo1Angle
 * \param 
 *     angle   angle range 0 - 180
 * - Set the angle of servo 1
 */
void LidarCar::setServo1Angle(uint8_t angle)// angle: 0 ~ 180
{
  if(angle > 180) angle = 180;
  Serial2.write(0xB0);
  Serial2.write(angle);
  Serial2.write(0x55);
}


/*!
 * \brief LidarCar::ControlWheel
 * \param 
 *      X   range -7 to 7
 *      Y   range -7 to 7
 *      A   range 0/1 lateral movement flag, when 1 the car can move sideways left/right
 * - Car direction and speed control
 */
void LidarCar::ControlWheel(int8_t X, int8_t Y, byte A, uint16_t durationMs)// X, Y, A: -7 ~ 7
{
  // Safety clamping for X and Y inputs to prevent out-of-bounds array access
  if (X < -7) X = -7;
  if (X > 7) X = 7;
  if (Y < -7) Y = -7;
  if (Y > 7) Y = 7;

  if (durationMs > 0) {    _stopTime = millis() + durationMs;
  } else {
    // Any command without a duration (including a stop command) clears the timer
    _stopTime = 0;
  }

  // Convert parameters to four motor values using the controlMap table
  //! controlMapX is the data table for lateral movement
  //! controlMap is the data table for normal movement
  if (A == 0x01){
    wheelPowerA = controlMapX[7 + Y][X + 7];
    wheelPowerB = controlMapY[7 + Y][X + 7];
    wheelPowerC = controlMapY[7 + Y][X + 7];
    wheelPowerD = controlMapX[7 + Y][X + 7];
  }else{
    wheelPowerA = controlMap[-Y + 7][X + 7];
    wheelPowerB = controlMap[-Y + 7][14 - X - 7];
    wheelPowerC = controlMap[-Y + 7][X + 7];
    wheelPowerD = controlMap[-Y + 7][14 - X - 7];
  }
   
  // Send commands via serial
  Serial2.write(0xAA);
  Serial2.write(wheelPowerA);
  Serial2.write(wheelPowerB);
  Serial2.write(wheelPowerC);
  Serial2.write(wheelPowerD);
  Serial2.write(0x55);

  if (wheelPowerA != 0 || wheelPowerB != 0 || wheelPowerC != 0 || wheelPowerD != 0) {
    Serial.printf("debug:wheel_power A=%d B=%d C=%d D=%d\n", (int8_t)wheelPowerA, (int8_t)wheelPowerB, (int8_t)wheelPowerC, (int8_t)wheelPowerD);
  } else {
    Serial.println("debug:wheel_power STOP (0,0,0,0)");
  }

  // Light setting, lights change according to car direction and speed
  if(Y>0){
    if (A == 0x01)
     setLedAll(Y,0,0);
    else
     setLedAll(0,0,Y);
  }else{
   if(A == 0x01)
      setLedAll(-Y,0,0);
   else
      setLedAll(0,0,-Y);
  }

}

void LidarCar::Update(void) {
  if (_stopTime > 0 && millis() > _stopTime) {
    Serial.printf("debug:timer_expired! curr=%u stop=%u\n", millis(), _stopTime);
    _stopTime = 0;
    ControlWheel(0, 0, 0, 0);
  }
}

/*!
 * \brief LidarCar::MapDisplay
 * \param 
 * - Processing and display of radar scanned map
 */
void LidarCar::MapDisplay(void){

  // Data length per frame / Lidar rotation speed / Number of data frames
  M5.Lcd.setCursor(0, 0, 2);
  M5.Lcd.print(dataLength);
  M5.Lcd.print("D/");
  M5.Lcd.print(lidarSpeed);
  M5.Lcd.print("S/");
  M5.Lcd.print(packCount);

  
  for(int i = 0; i < 45; i++)
  { 
    // Control_flag: flag for maze mode
    // Flag set when a data frame is successfully retrieved
    if (showAngle >=  359){
       Cortrol_flag = true;
       count++;
    }
      
    if(showAngle >= 359)
      showAngle = 0;
    else
      showAngle++;
    //Serial.print("showAngle = ");Serial.println(showAngle);
    // distance[showAngle] is the linear distance scanned by lidar, decompose it into x and y directions using cos and sin
    disX[showAngle] = ( 80 + (distance[showAngle] / 70) * cos(3.14159 * showAngle / 180 + 0.13))*2;
    disY[showAngle] = (100 + (distance[showAngle] / 70) * sin(3.14159 * showAngle / 180 + 0.13))*2;
    // Display on screen
    M5.Lcd.drawPixel(oldDisX[showAngle] , oldDisY[showAngle], BLACK);
    if(distance[showAngle] == 250)
      M5.Lcd.drawPixel(disX[showAngle] , disY[showAngle], BLUE);
    else
      M5.Lcd.drawPixel(disX[showAngle] , disY[showAngle], YELLOW);
    oldDisX[showAngle] = disX[showAngle];
    oldDisY[showAngle] = disY[showAngle];

    //Serial.print(" distance[showAngle] = ");Serial.print(distance[showAngle]);Serial.print(" disX[showAngle] = ");Serial.print(disX[showAngle]);Serial.print(" disY[showAngle] = ");Serial.println(disY[showAngle]);
    #if 1
    mapdata[i * 4 + 0] = showAngle / 256;
    mapdata[i * 4 + 1] = showAngle % 256;
    mapdata[i * 4 + 2] = distance[showAngle] / 256;
    mapdata[i * 4 + 3] = distance[showAngle] % 256;
    #else
    mapdata[i * 4 + 0] = 233;
    mapdata[i * 4 + 1] = 233;
    mapdata[i * 4 + 2] = 236;
    mapdata[i * 4 + 3] = 236;
    #endif
	
	  // Maze valid data acquisition: Get data for angles 180 to 360
	  if((showAngle >= 180) && (showAngle <= 360)){
      if((distance[showAngle] == 250)||(distance[showAngle] == 0)||(distance[showAngle] >= 10000))
      {
         Dis[showAngle - 180][0] = 0;
         Dis[showAngle - 180][1] = 0;
      }
      else
      {
        Dis[showAngle - 180][0] = disX[showAngle];
        Dis[showAngle - 180][1] = disY[showAngle];
      } 
     }
       
   }

  // Get lidar data
  GetData();

}

// Camera module
void LidarCar::CarCamera(void){

   Serial.print(" rent_pp = ");
   for(int i = 9; i < 29;i++){
    Serial.print(i);
    Serial.print(" = ");
    Serial.println(rent_pp[i]);
   }
    uint8_t max_data = rent_pp[0];
    uint8_t max_num = 0;
#if 0     
  for(int i = 1; i < 9; i++){
    if(rent_pp[i]>max_data){
      max_data = rent_pp[i];
      max_num = i;
    }
  }
  /*
  Serial.print(" max_data = ");
  Serial.println(max_data);
  Serial.print(" max_num = ");
  Serial.println(max_num);
*/
  
  if(max_data <= 5){
    last_motor_out = motor_out;
  }else{
    motor_out = (max_num % 3 - 1);
  }
  if(max_data > 95){
   ControlWheel(0,-2,0);
  }
  else{
    if(max_data <= 5)
      ControlWheel(last_motor_out,0, 0);
    else
      ControlWheel(motor_out,2, 0);
  } 
#else
  for(int i = 1; i < 9; i++){
    if(rent_pp[i]>max_data){
      max_data = rent_pp[i];
      //max_num = i;
    }
  }
  uint8_t max_data_ = rent_pp[9];
  for(int i = 9; i < 29; i++){
    if(i <= 19){
      if(rent_pp[i]>=max_data_){
        max_data_ = rent_pp[i];
        max_num = i - 9;
      }
    }
    else
    {
      if(rent_pp[i]>max_data_){
        max_data_ = rent_pp[i];
        max_num = i - 9;
      }
    }
  }
  int line = 0;
  if(max_data_ < 50){
    line = last_line;
  }
  else
  {
    line = max_num - 10;
    last_line = line;   
  }
  if(line > 50 || line < -50)  return;
  //M5.Lcd.setCursor(300, 0, 2);
  //M5.Lcd.printf("%2d",line);
  //Serial.print(" line = ");Serial.println(line);
 if((max_data > 40) || ((max_data < 5)&&(!line))){
    if(max_data > 55)
    ControlWheel(0, -2, 0);
    else
    ControlWheel(0, 0, 0);
  }else{
  if(abs(line) < 2)
     ControlWheel(0, 2, 0);
  else if(abs(line) < 5){
    if(line >= 0)
     ControlWheel(2,1, 0);
     else
     ControlWheel(-2, 1, 0);
  }else{
     if(line >= 0)
       ControlWheel(2 ,2, 0);
     else
       ControlWheel(-2 ,2, 0);
     }
  }
  
 // last_line = line;
#endif     
}


//! Line tracking module
void LidarCar::TrackControl(void){
  
  rprtrack.SensorStatus();
  rprtrack.CalTrackDev();
 // Serial.print(" OffsetLine = ");Serial.println(rprtrack.OffsetLine);
  //M5.Lcd.setCursor(300, 0, 2);
  //M5.Lcd.print(rprtrack.OffsetLine);
  if(abs(rprtrack.OffsetLine) == 0)
   ControlWheel(rprtrack.OffsetLine,4, 0);
  else if(abs(rprtrack.OffsetLine) == 1)
   ControlWheel(rprtrack.OffsetLine,2, 0);
  else if(abs(rprtrack.OffsetLine) == 2)
   ControlWheel(rprtrack.OffsetLine,2, 0);
  else 
   ControlWheel(rprtrack.OffsetLine,1, 0);
}


//! Maze mode
void LidarCar::CarMaze(void){
if((Cortrol_flag) && (count >= 10))
  {
   CarCortrol();
   Cortrol_flag = false;
   count = 10;
  }
  if((count >= 10))
    ControlWheel(motor_out, motor_y_out, 0); 
}

// Maze processing
void LidarCar::CarCortrol(void)
{    
    // Judge left, right, and front distances
    float left_line = 0,right_line = 0,front_line = 0;
    int buf = 0; 
    
    int count = 0;
    for(int i = 0;i < 55;i++)
    {
       if(Dis[i][0])
       {
        buf += Dis[i][0];
         //Serial.print(" left_line = ");Serial.println(left_line);
        count++;
        //delay(1);
       }
    }
   // Serial.print("left_line  count = "),Serial.println(count);
    if(count == 0)count = 1;
    // Left distance
    left_line = (float)buf/count;
 
    buf = 0;
    count = 0;
    for(int i = 55;i < 105;i++)
    {
       if(Dis[i][1])
       {
         buf += Dis[i][1];
         count++;
       }
      
    }//Serial.print("front_line  count = "),Serial.println(count);
    if(count == 0)count = 1;
    // Front distance
    front_line = (float)buf/count;

    count = 0;
    buf = 0;
    for(int i = 105;i < 180;i++)
    {
      if(Dis[i][0])
       {
        buf += Dis[i][0];
        count++;
       }
    }//Serial.print("right_line  count = "),Serial.println(count);
    if(count == 0)count = 1;
    // Right distance
    right_line = buf /count;

    /* PID quantization formula is
    *      out = kp * error + kd * (error - last_error)
    *      Only kp value is used here, kd mode is 0, you can try adding kd value
    *      Basic PID concept: http://blog.sina.cn/dpool/blog/s/blog_80f7b8e90101ikk8.html?md=gd
    */ 

    // Adjust kp value based on left and right distances
    float kp = 0.4;motor_y_out = 7;
    if((right_line <= 1.0) || (left_line <= 1.0))
    {
      kp = 1;
      motor_y_out = 4;
    }
    if((front_line >= 170.0) || (front_line <= 1.0))
    {
      kp = 1;
      motor_y_out = 3;
    }
    
    //! Calculate the position deviation of the current road
    float error_line = (left_line + right_line)/2.0 - 157.80;
    if((left_line == 0) || (right_line == 0))error_line = last_error_line;
    last_error_line = error_line;
    //if(error_line)
    //common
    int ret = 0;
    // Check for dead zone (dead end)
    ret = MazaCom(error_line ,left_line,right_line,front_line) ;
    if(!ret){
      if(go_flag)
    motor_out =  -kp  * error_line/2;
    else
    motor_out =  kp  * error_line;
    // Output
    if(motor_out >= 4.0)motor_out = 4.0;
    else if(motor_out <= -4.0)motor_out = -4.0;
    ControlWheel(motor_out,motor_y_out, 0);
    }
}


// Dead zone detection: detect no way forward, turn around and return
int LidarCar::MazaCom(float error_line,float left_line,float right_line,float front_line)
{
   //Serial.print(" error_line = ");Serial.print(error_line);Serial.print(" left_line = ");Serial.print(left_line);Serial.print(" right_line = ");Serial.print(right_line);Serial.print(" front_line = ");Serial.println(front_line);

   static int stop_count;
   if(((abs(error_line) <= 4.0) &&  (front_line >= 180.0))  &&(((right_line <= 190)) || (left_line >= 120.0)))
   {
      motor_out = 0;
      motor_y_out = 0;
      stop_count++;
      
      if(stop_count>=50)
      {
        motor_out = 1;
        motor_y_out = 0;
        stop_count = 50;
      }
      setLedAll(20, 0, 0);
      return 1;
   }

   if((stop_count >= 50) && ((abs(error_line) >= 5.0) ||  ((front_line >= 160.0)  ||  (front_line <= 1.0))))
   {
        motor_out = 1;
        motor_y_out = 0;
        return 1;
   }
   setLedAll(0, 0, 0);
   stop_count = 0;
   return 0;   
}


//! Lidar car mode control
void LidarCar::ControlMode(void){

  //!mode flag
  if(digitalRead(37) == LOW){
   contro_mode++;
   if(contro_mode >= 4) contro_mode = 0;
   while(digitalRead(37) == LOW);
  }

  Serial.print("contro_mode = ");Serial.println(contro_mode);

  switch(contro_mode){
    case 0:break;
    default:break;
  }
}

// Lidar data acquisition
void LidarCar::GetData(void){

  while(Serial1.available()){
    uint16_t r = Serial1.read();
    switch (commandStatus){
      case 0: if (r == 0xAA){
                commandStatus = 1;
              }else{
                commandStatus = 0;
              }
              break;
      case 1: if(r == 0x00) {
               commandStatus = 2;
               }
              else{
                commandStatus = 0;
              }
              break;
       case 2:commandStatus = 3;break;
       case 3: ver = r; commandStatus = 4; break;
       case 4:if(r == 0x61){
                commandStatus = 5;
              }
              else{
                commandStatus = 0;
              }
              break;
        case 5:if(r == 0xAD){
                commandStatus = 6;
               }else{
                commandStatus = 0;
               }
               break;
        case 6: commandStatus = 7;  break;
        case 7: dataLength = (r - 5) / 3; commandStatus = 8; break;
        case 8: lidarSpeed = r;  commandStatus = 9; break;
        case 9: angleOffset = r * 256; commandStatus = 10; break;
        case 10: angleOffset += r; commandStatus = 11;  break;
        case 11: startAngle = r * 256; commandStatus = 12; break;
        case 12: startAngle += r; commandStatus = 13;  break;

    default:
        if (commandStatus == ( 14 + 3 * 44)) //finish.
        {
          packCount++;
          commandStatus = 0;
          return;
        }
        {
          int index = (startAngle / 2250) * 22 + ((commandStatus - 13) / 6);
          switch ((commandStatus - 13) % 6)
          {
            case 0: if (index >= 0 && index < 360) signalValue[index] = r;  commandStatus++; break;
            case 1: temp = r * 256;  commandStatus++; break;
            case 2: temp += r; if (index >= 0 && index < 360) distance[index] = temp > 2 ? temp : 250;  commandStatus++; break;
            case 3: commandStatus++; break;
            case 4: commandStatus++; break;
            case 5: commandStatus++; break;
          }
        } break;
    }
  }
}

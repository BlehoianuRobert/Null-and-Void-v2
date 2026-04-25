#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ---------- CONFIG ----------
const char* ssid = "moto g54 5G_7572";
const char* password = "123456789";
const char* mqtt_server = "10.136.37.252";
const int mqtt_port = 1883;

const char* topicDistance = "senzor/distanta";
const char* topicAccel = "senzor/acceleratie";
const char* topicBmp = "senzor/bmp280";

// ---------- PINS ESP32-C6 ----------
const int trigPin = 18;
const int echoPin = 5;
const int buzzerPin = 19;
const int sdaPin = 2;  // LP_I2C_SDA
const int sclPin = 3;  // LP_I2C_SCL

// ---------- OBJECTS ----------
WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;
Adafruit_BMP280 bmp;  // I2C BMP280

// ---------- HELPERS ----------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("WiFi MAC: ");
  Serial.println(WiFi.macAddress());
}

void connectMQTT() {
  while (!client.connected()) {
    String cid = "ESP32C6_" + WiFi.macAddress();
    cid.replace(":", "");

    Serial.print("Connecting MQTT...");
    if (client.connect(cid.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retry in 2s");
      delay(2000);
    }
  }
}

float readDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);  // timeout 30ms
  if (duration <= 0) return -1.0f;

  return duration * 0.034f / 2.0f;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(buzzerPin, OUTPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Quick buzzer test
  digitalWrite(buzzerPin, HIGH);
  delay(200);
  digitalWrite(buzzerPin, LOW);

  // I2C
  Serial.println("Initializing I2C on pins 2 and 3...");
  Wire.begin(sdaPin, sclPin);

  // MPU6050 init
  if (!mpu.begin(0x68)) {
    Serial.println("ERROR: MPU6050 not detected at 0x68. Check wiring!");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 initialized successfully");
  }

  // BMP280 init (try both common I2C addresses)
  bool bmpOk = bmp.begin(0x76);
  if (!bmpOk) bmpOk = bmp.begin(0x77);

  if (!bmpOk) {
    Serial.println("ERROR: BMP280 not detected (0x76/0x77). Check wiring!");
  } else {
    Serial.println("BMP280 initialized successfully");
    bmp.setSampling(
      Adafruit_BMP280::MODE_NORMAL,
      Adafruit_BMP280::SAMPLING_X2,   // temperature
      Adafruit_BMP280::SAMPLING_X16,  // pressure
      Adafruit_BMP280::FILTER_X16,
      Adafruit_BMP280::STANDBY_MS_500
    );
  }

  connectWiFi();
  client.setServer(mqtt_server, mqtt_port);
  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!client.connected()) connectMQTT();
  client.loop();

  // Read sensors
  float distanceCm = readDistanceCm();

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float bmpTempC = bmp.readTemperature();
  float bmpPressurePa = bmp.readPressure();
  float bmpPressureHpa = bmpPressurePa / 100.0f;

  // Buzzer logic
  if (distanceCm > 2.0f && distanceCm < 50.0f) {
    digitalWrite(buzzerPin, HIGH);
  } else {
    digitalWrite(buzzerPin, LOW);
  }

  // Serial output
  Serial.printf("Dist: %.1f cm | Accel X: %.2f m/s2 | Temp: %.2f C | Press: %.2f hPa\n",
                distanceCm, a.acceleration.x, bmpTempC, bmpPressureHpa);

  // Publish accelerometer X
  char aStr[16];
  dtostrf(a.acceleration.x, 1, 2, aStr);
  client.publish(topicAccel, aStr);

  // Publish distance as JSON with MAC
  int dcm = (distanceCm < 0) ? 0 : (int)(distanceCm + 0.5f);
  if (dcm > 500) dcm = 500;

  String mac = WiFi.macAddress();

  char distJson[160];
  snprintf(distJson, sizeof(distJson),
           "{\"distanceCm\":%d,\"deviceMac\":\"%s\"}",
           dcm, mac.c_str());
  client.publish(topicDistance, distJson);

  // Publish BMP280 JSON
  char bmpJson[180];
  snprintf(bmpJson, sizeof(bmpJson),
           "{\"deviceMac\":\"%s\",\"tempC\":%.2f,\"pressureHpa\":%.2f}",
           mac.c_str(), bmpTempC, bmpPressureHpa);
  client.publish(topicBmp, bmpJson);

  delay(500);
}
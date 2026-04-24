#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- CONFIGURARE ---
const char* ssid = "moto g54 5G_7572";
const char* password = "123456789";
const char* mqtt_server = "10.136.37.252"; 

// --- PINI (VERIFICĂ ACESTE CONEXIUNI!) ---
const int trigPin = 18;
const int echoPin = 5;
const int buzzerPin = 19; // Verifică dacă firul e bine înfipt aici
const int sdaPin = 21;
const int sclPin = 22;

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // TEST RAPID BUZZER LA PORNIRE
  pinMode(buzzerPin, OUTPUT);
  Serial.println("Test Buzzer: Ar trebui sa sune 500ms acum...");
  digitalWrite(buzzerPin, HIGH);
  delay(500);
  digitalWrite(buzzerPin, LOW);

  // Initializare I2C
  Wire.begin(sdaPin, sclPin);
  
  // Initializare WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectat");
  Serial.print("WiFi MAC (must match My users / DEVICE_SERIAL): ");
  Serial.println(WiFi.macAddress());

  client.setServer(mqtt_server, 1883);

  // Initializare Senzori
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  if (!mpu.begin()) {
    Serial.println("Eroare: MPU6050 nu raspunde!");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 Initializat");
  }
}

void loop() {
  if (!client.connected()) {
    if (client.connect("ESP32_Final")) {
      Serial.println("MQTT Conectat");
    }
  }
  client.loop();

  // --- CITIRE DISTANTA ---
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  float distanceCm = pulseIn(echoPin, HIGH) * 0.034 / 2;

  // --- CITIRE ACCELERATIE ---
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // --- LOGICA BUZZER SI AFISARE ---
  Serial.print("Distanta: "); Serial.print(distanceCm); Serial.print(" cm | ");
  Serial.print("Accel X: "); Serial.println(a.acceleration.x);

  // Daca distanta e intre 2 si 50 cm
  if (distanceCm > 2 && distanceCm < 50) {
    digitalWrite(buzzerPin, HIGH);
    Serial.println("!!! ALERTA BUZZER PORNIT !!!");
  } else {
    digitalWrite(buzzerPin, LOW);
  }

  // --- MQTT PUBLISH ---
  // JSON so the server can route without relying on worker DEVICE_SERIAL (MAC must match My users).
  char aStr[12];
  dtostrf(a.acceleration.x, 1, 2, aStr);
  client.publish("senzor/acceleratie", aStr);

  char json[160];
  String mac = WiFi.macAddress();
  int dcm = (int)(distanceCm + 0.5f);
  if (dcm < 0) dcm = 0;
  if (dcm > 500) dcm = 500;
  snprintf(json, sizeof(json), "{\"distanceCm\":%d,\"deviceMac\":\"%s\"}", dcm, mac.c_str());
  client.publish("senzor/distanta", json);

  delay(500);
}
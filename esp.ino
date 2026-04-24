#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h> // Biblioteca pentru MQTT

// --- CONFIGURARE WI-FI SI MQTT ---
const char* ssid = "moto g54 5G_7572";
const char* password = "123456789";
const char* mqtt_server = "10.136.37.252"; // Exemplu: "192.168.1.15"

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;

// --- PINI ---
const int trigPin = 18;
const int echoPin = 5; 
const int buzzerPin = 19;
const int sdaPin = 21; 
const int sclPin = 22; 

#define SOUND_SPEED 0.034

void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectat!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Incercare conectare MQTT...");
    if (client.connect("ESP32_Senzori")) {
      Serial.println("conectat");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  Wire.begin(sdaPin, sclPin);
  pinMode(trigPin, OUTPUT); 
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  mpu.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // --- CITIRE DISTANTA ---
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  float distanceCm = pulseIn(echoPin, HIGH) * SOUND_SPEED / 2;

  // --- CITIRE ACCELERAȚIE ---
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // --- LOGICĂ BUZZER (50 CM) ---
  if (distanceCm > 0 && distanceCm < 50) {
    digitalWrite(buzzerPin, HIGH);
  } else {
    digitalWrite(buzzerPin, LOW);
  }

  // --- TRIMITERE DATE CATRE RASPBERRY PI ---
  // Convertim valorile in string-uri pentru a le trimite
  char distStr[8];
  dtostrf(distanceCm, 1, 2, distStr);
  client.publish("senzor/distanta", distStr);

  char accelStr[8];
  dtostrf(a.acceleration.x, 1, 2, accelStr);
  client.publish("senzor/acceleratie", accelStr);

  Serial.print("Date trimise: "); Serial.println(distStr);
  delay(500);
}
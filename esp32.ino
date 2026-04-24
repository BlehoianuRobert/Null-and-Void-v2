#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
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

// ---------- PINS ----------
const int trigPin = 18;
const int echoPin = 5;
const int buzzerPin = 19;
const int sdaPin = 21;
const int sclPin = 22;

// ---------- OBJECTS ----------
WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;

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
  Serial.print("WiFi MAC (register this in My users): ");
  Serial.println(WiFi.macAddress());
}

void connectMQTT() {
  while (!client.connected()) {
    String cid = "ESP32_" + WiFi.macAddress();
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

  long duration = pulseIn(echoPin, HIGH, 30000); // timeout 30ms
  if (duration <= 0) return -1.0f;

  float distance = duration * 0.034f / 2.0f;
  return distance;
}

void setup() {
  Serial.begin(115200);
  delay(800);

  pinMode(buzzerPin, OUTPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // quick buzzer test
  Serial.println("Buzzer test 500ms");
  digitalWrite(buzzerPin, HIGH);
  delay(500);
  digitalWrite(buzzerPin, LOW);

  // I2C + MPU6050
  Wire.begin(sdaPin, sclPin);
  if (!mpu.begin()) {
    Serial.println("ERROR: MPU6050 not detected");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 initialized");
  }

  connectWiFi();

  client.setServer(mqtt_server, mqtt_port);
  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();

  // Read sensors
  float distanceCm = readDistanceCm();

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Buzzer logic
  if (distanceCm > 2.0f && distanceCm < 50.0f) {
    digitalWrite(buzzerPin, HIGH);
  } else {
    digitalWrite(buzzerPin, LOW);
  }

  // Serial output
  Serial.print("Distance: ");
  Serial.print(distanceCm);
  Serial.print(" cm | Accel X: ");
  Serial.println(a.acceleration.x);

  // Publish accel as plain number (worker handles this)
  char aStr[16];
  dtostrf(a.acceleration.x, 1, 2, aStr);
  client.publish(topicAccel, aStr);

  // Publish distance as JSON with MAC (important for backend routing)
  int dcm = (distanceCm < 0) ? 0 : (int)(distanceCm + 0.5f);
  if (dcm > 500) dcm = 500;

  String mac = WiFi.macAddress();
  char json[180];
  snprintf(
    json,
    sizeof(json),
    "{\"distanceCm\":%d,\"deviceMac\":\"%s\"}",
    dcm,
    mac.c_str()
  );

  client.publish(topicDistance, json);

  delay(500);
}
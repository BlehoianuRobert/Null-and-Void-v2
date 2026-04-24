Project: The Digital Twin Hat

An Advanced Haptic Navigation System for the Visually Impaired

Project Vision

The Digital Twin Hat is a wearable assistive technology designed to replace the traditional walking stick. By moving the "sensing point" from the ground to the head and utilizing real-time sensor fusion, the project aims to provide a hands-free, intuitive navigation experience.



The goal is to move beyond simple obstacle detection and create a system that understands the user's movement context—effectively upgrading the "blind stick" into a smart, digital companion.

Hardware Stack

Microcontrollers: \* Raspberry Pi 5: Acts as the central brain for complex data processing and sensor fusion.



ESP32-C6: Handles low-latency sensor data and wireless communication.



Sensors:



HC-SR04 (Ultrasonic): Measures distance to obstacles in the front-facing direction.



MPU6050 (6-Axis Gyro/Accelerometer): Tracks the wearer's gait, speed, and head orientation.



Feedback:



Buzzer: Provides auditory alerts based on proximity and movement speed.

Core Logic \& Features

1\. Dynamic Proximity Alert

The system monitors the area directly in front of the wearer.



The Threshold: A constant alert triggers when an object is within 50cm.



The Feedback: A sustained, loud "BEEP" to signal an immediate stop-point.



2\. Velocity-Aware Sensing (The MPU6050 Integration)

Unlike a standard stick, this hat adjusts its logic based on how fast the user is moving.



By using the MPU6050, the system calculates the user's current walking speed.



The proximity calculation becomes dynamic: if a user is walking faster, the "warning zone" can expand to account for human reaction time, providing a safer buffer than a static stick.



3\. Digital Twin Concept

The hat functions as a "digital twin" of the walking stick by:



Mapping the physical environment into digital data.



Replacing physical "tapping" with ultrasonic pings.



Providing a higher vantage point for detection, helping avoid head-level obstacles that traditional sticks often miss.

Future Roadmap

Haptic Feedback: Integrating vibration motors for a silent, tactile experience.



AI Integration: Utilizing the RPi 5 power for object recognition (distinguishing between a wall and a person).



Cloud Connectivity: Using the ESP32-C6's Wi-Fi 6 capabilities for emergency location tracking.




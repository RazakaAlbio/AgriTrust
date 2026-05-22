#include "HX711.h"

// ==========================================
// Agri-Trust: ESP32 Sensor Node Firmware
// Reads Weight (HX711) & Gas (MQ-135)
// Sends JSON string over USB Serial to Jetson
// ==========================================

// --- HX711 Load Cell ---
const int LOADCELL_DOUT_PIN = 4;
const int LOADCELL_SCK_PIN = 5;
HX711 scale;

// Calibration factor (You MUST calibrate this!)
// 1. Set to 1.0, upload, place known weight.
// 2. Read output, divide output by known weight.
// 3. Put that number here.
float CALIBRATION_FACTOR = 2280.f; 

// --- MQ-135 Gas Sensor ---
const int MQ135_PIN = 34; // ADC1 channel on ESP32

void setup() {
  Serial.begin(115200);
  
  // Initialize HX711
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR); 
  scale.tare(); // Reset the scale to 0
}

void loop() {
  // 1. Read Weight
  // Take average of 5 readings for stability
  float weight_g = scale.get_units(5); 
  
  // Prevent negative readings floating around zero
  if (weight_g < 0) {
    weight_g = 0;
  }
  
  // Convert grams to kg
  float weight_kg = weight_g / 1000.0;

  // 2. Read Gas (MQ-135)
  // Read analog value (12-bit ADC on ESP32: 0-4095)
  int gas_raw = analogRead(MQ135_PIN);
  
  // Convert raw ADC to a rough PPM estimate for Demo purposes.
  // In a real environment, you need an R0 baseline calibration algorithm.
  // Mapping 0-4095 to 10-1000 ppm
  float gas_ppm = map(gas_raw, 0, 4095, 10, 1000); 

  // 3. Output JSON over Serial
  // Format: {"weight_kg": 0.150, "gas_ppm": 45}
  Serial.print("{\"weight_kg\": ");
  Serial.print(weight_kg, 3); // 3 decimal places
  Serial.print(", \"gas_ppm\": ");
  Serial.print(gas_ppm, 0);   // 0 decimal places
  Serial.println("}");
  
  // Send data twice a second
  delay(500);
}

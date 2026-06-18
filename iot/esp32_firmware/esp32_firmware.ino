#include "HX711.h"
#include <SPI.h>
#include <MFRC522.h>

// ==========================================
// Agri-Trust: ESP32 Sensor Node Firmware
// Reads Weight (HX711), Gas (MQ-135), & RFID (RC522)
// Sends JSON string over USB Serial to Jetson
// ==========================================

// --- HX711 Load Cell ---
const int LOADCELL_DOUT_PIN = 4;
const int LOADCELL_SCK_PIN = 5;
HX711 scale;

// Calibration factor
float CALIBRATION_FACTOR = -1033.3; 

// --- MQ-135 Gas Sensor ---
const int MQ135_PIN = 34; // ADC1 channel on ESP32

// --- RFID RC522 ---
#define RST_PIN 22
#define SS_PIN  21 // SDA / CS Pin (Ganti ke D21 karena D5 dipakai Load Cell)
MFRC522 mfrc522(SS_PIN, RST_PIN);

// Helper variable to remember the last scanned card to avoid spamming
String last_scanned_uid = "";
unsigned long last_scan_time = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize HX711
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR); 
  scale.tare(); // Reset the scale to 0
  
  // Initialize SPI & RFID
  SPI.begin();
  mfrc522.PCD_Init();
}

void loop() {
  // 1. Read Weight
  float weight_g = scale.get_units(5); 
  if (weight_g < 0) { weight_g = 0; }
  float weight_kg = weight_g / 1000.0;

  // 2. Read Gas (MQ-135)
  int gas_raw = analogRead(MQ135_PIN);
  float gas_ppm = map(gas_raw, 0, 4095, 10, 1000); 

  // 3. Read RFID
  String rfid_uid = "";
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      rfid_uid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
      rfid_uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    rfid_uid.toUpperCase();
    
    // Simpan uid agar tidak dobel scan berulang, bisa diganti sesuai kebutuhan
    last_scanned_uid = rfid_uid;
    last_scan_time = millis();
    
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
  }

  // Jika kartu sudah dicabut dan lewat dari 2 detik, kosongkan memori UID terakhir
  if (millis() - last_scan_time > 2000) {
      last_scanned_uid = "";
  }

  // 4. Output JSON over Serial
  // Format: {"weight_kg": 0.150, "gas_ppm": 45, "rfid_uid": "A1B2C3D4"}
  Serial.print("{\"weight_kg\": ");
  Serial.print(weight_kg, 3);
  Serial.print(", \"gas_ppm\": ");
  Serial.print(gas_ppm, 0);
  Serial.print(", \"rfid_uid\": \"");
  Serial.print(rfid_uid); // Akan kosong ("") jika tidak ada kartu, berisi ID jika ada kartu baru
  Serial.println("\"}");
  
  // Send data twice a second
  delay(500);
}

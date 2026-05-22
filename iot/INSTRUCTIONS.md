# Agri-Trust IoT Setup Guide

This guide covers the final 5 stages of the hardware integration for the Agri-Trust Edge-AI Commodity Grading System.

## Stage 6: Transfer `best.pt` to Jetson Nano
1. You have already trained the YOLOv8 model on your PC. 
2. Locate the file `python/runs/agritrust_v3/weights/best.pt`.
3. Transfer this file to your Jetson Nano using SCP, a USB drive, or by pushing to GitHub and pulling it on the Jetson.
4. Place it in the `iot/jetson_inference/` directory on the Jetson Nano.

## Stage 7: Export to TensorRT (`best.engine`)
TensorRT will optimize the model to run at maximum FPS on the Jetson Nano's GPU.
1. SSH into your Jetson Nano or open a terminal on it.
2. Ensure you have the `ultralytics` package installed on the Jetson.
3. Run the export script (you can copy `python/export_tensorrt.py` to the Jetson, or run this Python command):
   ```bash
   yolo export model=best.pt format=engine half=True device=0
   ```
4. This will generate `best.engine`. Update your inference script to use this `.engine` file instead of `.pt` for a massive speed boost.

## Stage 8: Flash ESP32 Firmware
The ESP32 acts as a dedicated sensor node to read the load cell (weight) and MQ-135 (gas), sending the data via USB Serial to the Jetson.
1. Open the Arduino IDE.
2. Install the **"HX711 Arduino Library"** via the Library Manager.
3. Open `iot/esp32_firmware/esp32_firmware.ino`.
4. Connect the ESP32 via USB and flash the code.
5. **Important:** You will need to calibrate the HX711 scale factor in the code with a known weight.

## Stage 9: Wire All IoT Components
Follow the wiring schematic from the `README.md`.

### ESP32 Wiring:
*   **HX711:** DOUT to GPIO 4, SCK to GPIO 5. VCC to 3.3V/5V.
*   **MQ-135:** AOUT (Analog) to GPIO 34. VCC to 5V.
*   Connect the ESP32 to the Jetson Nano using a Micro-USB/USB-C cable.

### Jetson Nano Wiring:
*   **Camera:** Connect the Raspberry Pi Cam OV5647 to the CSI port.
*   **RFID RC522:** Connect to SPI pins (Pin 19 MOSI, Pin 21 MISO, Pin 23 SCLK, Pin 24 CE0, Pin 22 RST). 3.3V Power.
*   **OLED 0.91":** Connect to I2C pins (Pin 3 SDA, Pin 5 SCL). 3.3V Power.
*   **Buzzer:** Connect to GPIO 13 (Pin 33). 5V Power.

## Stage 10: Run the Jetson Nano Inference Loop
1. Navigate to `iot/jetson_inference/` on your Jetson Nano.
2. Install dependencies:
   ```bash
   pip install ultralytics opencv-python pyserial requests mfrc522 Jetson.GPIO luma.oled luma.core pillow
   ```
3. Update `main.py` with your Supabase URL and Anon Key.
4. Run the script:
   ```bash
   sudo python3 main.py
   ```
   *(Note: `sudo` is often required for GPIO and SPI access on the Jetson).*

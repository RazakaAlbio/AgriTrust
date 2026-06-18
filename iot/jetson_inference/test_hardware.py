import sys
import Jetson.GPIO as GPIO
import time
import cv2
import serial
import json
import glob
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from luma.core.render import canvas
from PIL import ImageFont

print("==================================")
print("   AGRI-TRUST HARDWARE TESTER     ")
print("==================================")

# 1. TEST OLED
print("\n[*] 1. Testing OLED 0.91 (128x32)...")
try:
    serial_i2c = i2c(port=1, address=0x3C)
    oled = ssd1306(serial_i2c, width=128, height=32)
    font = ImageFont.load_default()
    
    with canvas(oled) as draw:
        draw.text((0, 0), "OLED TEST OK", font=font, fill="white")
        draw.text((0, 16), "Testing modules...", font=font, fill="white")
    print("  [+] OLED initialized and displaying text.")
    time.sleep(2)
except Exception as e:
    print(f"  [-] OLED Error: {e}")


# 2. TEST CAMERA
print("\n[*] 2. Testing Rexus SW10 USB Webcam (1080p/30fps MJPEG)...")
try:
    print("  [?] Opening USB webcam at /dev/video0 with MJPEG @ 1920x1080 30fps...")
    
    cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
    if not cap.isOpened():
        print("  [!] CAP_V4L2 failed, retrying with auto backend...")
        cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("  [-] Could not open /dev/video0. Is the webcam plugged in?")
    else:
        # Configure Rexus SW10: MJPEG @ 1080p 30fps
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
        cap.set(cv2.CAP_PROP_FPS, 30)

        actual_w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"  [i] Negotiated: {actual_w}x{actual_h} @ {actual_fps:.0f}fps")

        # Discard first few frames to allow auto-exposure to settle
        for _ in range(5):
            cap.grab()

        ret, frame = cap.read()
        if ret:
            print(f"  [+] Frame captured successfully! Shape: {frame.shape}")
        else:
            print("  [-] Webcam opened, but failed to grab frame.")
        cap.release()
except Exception as e:
    print(f"  [-] Camera Error: {e}")


# 3. TEST ESP32 (Sensors & RFID via USB)
print("\n[*] 3. Testing ESP32 Sensors (Weight, Gas, RFID via USB)...")
print("  [?] Please ensure ESP32 is connected via USB and hold an RFID card near the reader...")
try:
    # Find ESP32 USB Serial port
    usb_ports = glob.glob('/dev/ttyUSB*') + glob.glob('/dev/ttyACM*')
    if not usb_ports:
        print("  [-] No ESP32 detected on USB. Is it plugged in?")
    else:
        esp_port = usb_ports[0]
        print(f"  [+] Found ESP32 at {esp_port}. Connecting...")
        ser = serial.Serial(esp_port, 115200, timeout=2)
        
        # Read a few lines to flush incomplete data
        for _ in range(5):
            ser.readline()
            
        # Read 20 valid lines to show real-time changes
        valid_reads = 0
        admin_registered = False
        
        print("  [>] Reading stream from ESP32 (Press CTRL+C to skip early):")
        try:
            while valid_reads < 20:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("{") and line.endswith("}"):
                    try:
                        data = json.loads(line)
                        weight = data.get("weight_kg", 0.0)
                        gas = data.get("gas_ppm", 0)
                        rfid = data.get("rfid_uid", "")
                        
                        print(f"      -> Weight: {weight:.3f} kg | Gas: {gas} ppm | RFID UID: '{rfid}'")
                        valid_reads += 1
                        
                        if rfid != "" and not admin_registered:
                            print(f"\n  [!] KARTU RFID TERDETEKSI: {rfid}")
                            ans = input(f"      Apakah kamu ingin mendaftarkan '{rfid}' sebagai Kartu Admin di accounts.json? (y/n): ")
                            if ans.lower() == 'y':
                                try:
                                    import os
                                    accounts_path = "accounts.json"
                                    accounts = {}
                                    if os.path.exists(accounts_path):
                                        with open(accounts_path, "r") as f:
                                            accounts = json.load(f)
                                    
                                    # Hapus placeholder lama jika ada
                                    if "ADMIN_CARD_UID" in accounts:
                                        del accounts["ADMIN_CARD_UID"]
                                        
                                    accounts[rfid] = {"role": "admin", "name": "System Admin"}
                                    
                                    with open(accounts_path, "w") as f:
                                        json.dump(accounts, f, indent=2)
                                        
                                    print("  [+] Berhasil! Kartu Admin telah disimpan ke accounts.json.")
                                except Exception as e:
                                    print(f"  [-] Gagal menyimpan ke accounts.json: {e}")
                            admin_registered = True
                            
                    except json.JSONDecodeError:
                        pass
        except KeyboardInterrupt:
            print("\n  [i] Pembacaan dilewati oleh pengguna.")
            
        ser.close()
        print("  [+] ESP32 USB Serial test complete.")
        
except Exception as e:
    print(f"  [-] ESP32 USB Error: {e}")


# 4. TEST IR RECEIVER
print("\n[*] 4. Testing IR Receiver (Pin 7 / GPIO 4)...")
IR_PIN = 7
print("  [?] Please press any button on the IR remote...")

try:
    # Ensure BOARD mode is set
    GPIO.setmode(GPIO.BOARD)
    GPIO.setup(IR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    
    # Wait for the pin to go LOW (IR signal received)
    print("  Waiting for IR signal (Timeout in 10s)...")
    channel = GPIO.wait_for_edge(IR_PIN, GPIO.FALLING, timeout=10000)
    
    if channel is None:
        print("  [-] IR Test timed out. No signal detected.")
    else:
        print("  [+] IR Signal Detected!")
            
except Exception as e:
    print(f"  [-] IR Receiver Error: {e}")
finally:
    GPIO.cleanup()

print("\n==================================")
print("        TESTING COMPLETE          ")
print("==================================")

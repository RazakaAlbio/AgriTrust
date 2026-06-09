import time
import cv2
import Jetson.GPIO as GPIO
from mfrc522 import SimpleMFRC522
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

def gstreamer_pipeline(sensor_id=0, capture_width=1280, capture_height=720, display_width=640, display_height=480, framerate=30, flip_method=0):
    return (
        "nvarguscamerasrc sensor-id=%d ! "
        "video/x-raw(memory:NVMM), "
        "width=(int)%d, height=(int)%d, "
        "format=(string)NV12, framerate=(fraction)%d/1 ! "
        "nvvidconv flip-method=%d ! "
        "video/x-raw, width=(int)%d, height=(int)%d, format=(string)BGRx ! "
        "videoconvert ! "
        "video/x-raw, format=(string)BGR ! appsink"
        % (sensor_id, capture_width, capture_height, framerate, flip_method, display_width, display_height)
    )

# 2. TEST CAMERA
print("\n[*] 2. Testing RPi Cam 5MP (CSI Camera)...")
try:
    print("  [?] Trying GStreamer pipeline for Jetson CSI Camera (Port 0)...")
    cap = cv2.VideoCapture(gstreamer_pipeline(sensor_id=0, flip_method=0), cv2.CAP_GSTREAMER)
    
    if not cap.isOpened():
        print("  [-] Port 0 failed. Trying GStreamer pipeline for Jetson CSI Camera (Port 1)...")
        cap = cv2.VideoCapture(gstreamer_pipeline(sensor_id=1, flip_method=0), cv2.CAP_GSTREAMER)

    if not cap.isOpened():
        print("  [-] GStreamer failed. Trying fallback to USB WebCam (/dev/video0)...")
        cap = cv2.VideoCapture(0)
        
    if not cap.isOpened():
        print("  [-] Could not open camera. Is it plugged in correctly?")
    else:
        ret, frame = cap.read()
        if ret:
            print(f"  [+] Camera captured frame successfully! Shape: {frame.shape}")
        else:
            print("  [-] Camera opened, but failed to grab frame.")
        cap.release()
except Exception as e:
    print(f"  [-] Camera Error: {e}")

# 3. TEST RFID
print("\n[*] 3. Testing RFID RC522 (SPI)...")
print("  [?] Please hold an RFID card near the reader...")
try:
    # Need to setup GPIO for MFRC522
    # SimpleMFRC522 internally calls GPIO.setmode(GPIO.BOARD)
    reader = SimpleMFRC522()
    
    with canvas(oled) as draw:
        draw.text((0, 0), "SCAN RFID NOW", font=font, fill="white")
        
    id, text = reader.read()
    print(f"  [+] RFID Scanned! ID: {id}")
    
    with canvas(oled) as draw:
        draw.text((0, 0), "RFID TEST OK", font=font, fill="white")
        draw.text((0, 16), f"ID: {id}", font=font, fill="white")
    time.sleep(2)
except Exception as e:
    print(f"  [-] RFID Error: {e}")

# 4. TEST IR RECEIVER
print("\n[*] 4. Testing IR Receiver (Pin 7 / GPIO 4)...")
IR_PIN = 7
print("  [?] Please press any button on the IR remote...")

try:
    # Ensure BOARD mode is set
    GPIO.setmode(GPIO.BOARD)
    GPIO.setup(IR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    
    with canvas(oled) as draw:
        draw.text((0, 0), "PRESS IR REMOTE", font=font, fill="white")
    
    # Wait for the pin to go LOW (IR signal received)
    print("  Waiting for IR signal (Timeout in 10s)...")
    channel = GPIO.wait_for_edge(IR_PIN, GPIO.FALLING, timeout=10000)
    
    if channel is None:
        print("  [-] IR Test timed out. No signal detected.")
    else:
        print("  [+] IR Signal Detected!")
        with canvas(oled) as draw:
            draw.text((0, 0), "IR TEST OK", font=font, fill="white")
            
except Exception as e:
    print(f"  [-] IR Receiver Error: {e}")
finally:
    GPIO.cleanup()

print("\n==================================")
print("        TESTING COMPLETE          ")
print("==================================")

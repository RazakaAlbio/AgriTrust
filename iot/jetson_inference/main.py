import time
import json
import datetime
import requests
import serial
import os
from collections import Counter
from ultralytics import YOLO
import cv2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- HARDWARE MODULES (Jetson Only) ---
# Wrapping in try-except so your Windows IDE doesn't throw "missing-import" errors
try:
    import Jetson.GPIO as GPIO
    from mfrc522 import SimpleMFRC522
    from luma.core.interface.serial import i2c
    from luma.oled.device import ssd1306
    from luma.core.render import canvas
    from PIL import ImageFont
    HARDWARE_AVAILABLE = True
except ImportError:
    print("[!] Hardware modules not found. Running in MOCK mode (Windows).")
    HARDWARE_AVAILABLE = False

# ---------------------------------------------------------
# Agri-Trust: Jetson Nano Edge Inference & Sensor Fusion
# ---------------------------------------------------------

# --- CONFIGURATION ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
FARMER_ID = "DEMO_FARMER_UUID"  # In a real app, fetched via RFID
SERIAL_PORT = "/dev/ttyUSB0"    # or /dev/ttyACM0 (ESP32 connection)
BAUD_RATE = 115200

# --- INITIALIZATION ---
print("[*] Initializing YOLOv8 Model (TensorRT Engine)...")
# Load the TensorRT engine for max FPS on Jetson (fallback to .pt if needed)
try:
    model = YOLO("best.engine")
except Exception:
    print("[!] best.engine not found, falling back to best.pt")
    model = YOLO("best.pt")

print("[*] Connecting to ESP32 Serial...")
try:
    esp32 = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
except Exception as e:
    print(f"[!] Serial error: {e}")
    esp32 = None

# --- HARDWARE INITIALIZATION ---
print("[*] Initializing Hardware Modules...")
BUZZER_PIN = 33  # Physical Pin 33 (GPIO 13)
oled = None
reader = None

if HARDWARE_AVAILABLE:
    try:
        GPIO.setmode(GPIO.BOARD)
        GPIO.setup(BUZZER_PIN, GPIO.OUT, initial=GPIO.LOW)
        
        # Initialize RFID
        reader = SimpleMFRC522()
        
        # Initialize OLED (I2C Bus 1 usually on Jetson)
        serial_i2c = i2c(port=1, address=0x3C)
        oled = ssd1306(serial_i2c, width=128, height=32)
        font = ImageFont.load_default()
    except Exception as e:
        print(f"[!] Hardware initialization error: {e}")

def beep(times=1, duration=0.2):
    """Beeps the buzzer N times"""
    if not HARDWARE_AVAILABLE: return
    try:
        for _ in range(times):
            GPIO.output(BUZZER_PIN, GPIO.HIGH)
            time.sleep(duration)
            GPIO.output(BUZZER_PIN, GPIO.LOW)
            time.sleep(0.1)
    except:
        pass

def display_text(text1, text2=""):
    """Displays 2 lines of text on the OLED"""
    if oled is None: return
    try:
        with canvas(oled) as draw:
            draw.text((0, 0), text1, font=font, fill="white")
            if text2:
                draw.text((0, 16), text2, font=font, fill="white")
    except:
        pass

# --- SENSOR FUSION GRADING LOGIC ---
def calculate_final_grade(ai_counts, total_weight_kg, gas_ppm):
    """
    Implements the logic defined in README.md Section 8.
    ai_counts is a dictionary like {'ripe': 2, 'mold': 0}
    """
    tomato_count = sum(ai_counts.values())
    if tomato_count == 0:
        return "Reject" # No tomatoes detected
        
    avg_weight = total_weight_kg / tomato_count
    
    # 1. Critical Rejects (Mold / Rot / High Gas)
    if ai_counts.get("mold", 0) > 0 or ai_counts.get("rotten", 0) > 0 or ai_counts.get("blossom_end_rot", 0) > 0 or ai_counts.get("fruit_cracking", 0) > 0:
        return "Reject"
    if gas_ppm > 150:
        return "Reject"
        
    # 2. Determine Grade based on Ripeness and Size (Weight)
    is_fully_ripe = ai_counts.get("ripe", 0) == tomato_count
    
    if is_fully_ripe and avg_weight >= 0.15 and gas_ppm < 100:
        return "Grade A"
    elif avg_weight >= 0.10 and gas_ppm < 120:
        return "Grade B"
    else:
        return "Grade C"

# --- OFFLINE FIRST ARCHITECTURE ---
OFFLINE_QUEUE_FILE = "offline_queue.json"

def save_to_offline_queue(payload):
    print(f"[*] Saving {payload['batch_id']} to offline queue...")
    queue = []
    if os.path.exists(OFFLINE_QUEUE_FILE):
        try:
            with open(OFFLINE_QUEUE_FILE, "r") as f:
                queue = json.load(f)
        except:
            pass
    queue.append(payload)
    with open(OFFLINE_QUEUE_FILE, "w") as f:
        json.dump(queue, f)

def sync_offline_queue():
    if not os.path.exists(OFFLINE_QUEUE_FILE):
        return
        
    try:
        with open(OFFLINE_QUEUE_FILE, "r") as f:
            queue = json.load(f)
    except:
        return
        
    if not queue:
        return
        
    print(f"[*] Found {len(queue)} items in offline queue. Attempting sync...")
    
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    endpoint = f"{SUPABASE_URL}/rest/v1/scans"
    
    synced_indices = []
    for i, payload in enumerate(queue):
        try:
            res = requests.post(endpoint, headers=headers, json=payload, timeout=3)
            if res.status_code == 201:
                print(f"  [+] Synced {payload['batch_id']} from offline queue!")
                synced_indices.append(i)
            else:
                print(f"  [!] Failed to sync {payload['batch_id']}: {res.status_code}")
                break # Stop trying if network still bad
        except Exception as e:
            print(f"  [!] Network still offline, halting sync.")
            break
            
    # Remove synced items
    remaining_queue = [q for i, q in enumerate(queue) if i not in synced_indices]
    with open(OFFLINE_QUEUE_FILE, "w") as f:
        json.dump(remaining_queue, f)


# --- SUPABASE POST ---
def post_to_supabase(batch_id, overall_grade, ai_detections, weight_kg, gas_ppm):
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    payload = {
        "batch_id": batch_id,
        "farmer_id": FARMER_ID,
        "overall_grade": overall_grade,
        "weight_kg": weight_kg,
        "gas_ppm": gas_ppm,
        "ai_detections": ai_detections,
        # tx_hash is left null initially; admin anchors it later
    }
    
    endpoint = f"{SUPABASE_URL}/rest/v1/scans"
    try:
        res = requests.post(endpoint, headers=headers, json=payload, timeout=3)
        if res.status_code == 201:
            print(f"[+] Successfully posted {batch_id} to Supabase!")
            sync_offline_queue() # If successful, try to sync any old backlog
        else:
            print(f"[!] Supabase POST failed: {res.status_code} - {res.text}")
            save_to_offline_queue(payload)
    except Exception as e:
        print(f"[!] Network error posting to Supabase: {e}")
        save_to_offline_queue(payload)


# --- MAIN LOOP ---
def main():
    print("[*] System Ready. Waiting for trigger...")
    display_text("System Ready", "Scan RFID to start")
    
    while True:
        try:
            print("\n[ RFID ] Please scan your ID card...")
            
            rfid_id = "DEMO_FARMER_123"
            if HARDWARE_AVAILABLE and reader is not None:
                rfid_id, rfid_text = reader.read()
            else:
                input("Press ENTER to simulate RFID scan: ")
                
            print(f"[ RFID ] Authenticated Farmer ID: {rfid_id}")
            
            # Acknowledge scan
            beep(1, 0.1)
            display_text("Scanning...", "Processing AI")
            
            print("\n--- NEW BATCH SCAN ---")
            batch_id = f"BATCH_{datetime.datetime.now().strftime('%Y_%H%M%S')}"
            
            # 1. READ SENSORS FROM ESP32
            weight_kg = 0.0
            gas_ppm = 0.0
            if esp32:
                esp32.reset_input_buffer()
                time.sleep(0.5) # Wait for a fresh reading
                line = esp32.readline().decode('utf-8').strip()
                try:
                    data = json.loads(line)
                    weight_kg = float(data.get("weight_kg", 0.0))
                    gas_ppm = float(data.get("gas_ppm", 0.0))
                    print(f"[ Sensor ] Weight: {weight_kg}kg | Gas: {gas_ppm}ppm")
                except Exception as e:
                    print(f"[!] Failed to parse ESP32 JSON: {line} ({e})")
            else:
                # Mock data if ESP32 is not connected
                weight_kg = 0.35 
                gas_ppm = 45.0
                print(f"[ Sensor ] MOCK - Weight: {weight_kg}kg | Gas: {gas_ppm}ppm")

            # 2. RUN AI INFERENCE
            print("[ Camera ] Capturing frame and running YOLOv8 inference...")
            # We use source=0 for the CSI camera (or USB webcam)
            results = model.predict(source=0, show=False, save=False, conf=0.20)
            
            # Process detections
            detections = []
            ai_counts = Counter()
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    cls_name = model.names[cls_id]
                    
                    ai_counts[cls_name] += 1
                    detections.append({
                        "aiClass": cls_name,
                        "confidence": conf,
                        "count": 1 # To match web dashboard schema expectations
                    })
            
            # Group detections for the web schema (aggregate counts)
            grouped_detections = []
            for cls_name, count in ai_counts.items():
                # Find max confidence for this class
                max_conf = max([d["confidence"] for d in detections if d["aiClass"] == cls_name])
                grouped_detections.append({
                    "aiClass": cls_name,
                    "confidence": max_conf,
                    "count": count
                })
                
            print(f"[ AI ] Detections: {dict(ai_counts)}")

            # 3. SENSOR FUSION GRADING
            overall_grade = calculate_final_grade(ai_counts, weight_kg, gas_ppm)
            print(f"[ System ] FINAL GRADE: {overall_grade}")
            
            # 4. UPLOAD TO SUPABASE
            post_to_supabase(batch_id, overall_grade, grouped_detections, weight_kg, gas_ppm)
            
            # 5. HARDWARE FEEDBACK
            display_text(f"Grade: {overall_grade}", f"{weight_kg}kg | {gas_ppm}ppm")
            
            if overall_grade == "Reject":
                beep(3, 0.2)  # 3 short beeps for reject
            else:
                beep(1, 0.5)  # 1 long beep for success
                
            time.sleep(3) # Hold display for 3 seconds
            display_text("System Ready", "Scan RFID to start")
            
        except KeyboardInterrupt:
            print("\nExiting...")
            if HARDWARE_AVAILABLE:
                try:
                    GPIO.cleanup()
                except:
                    pass
            break

if __name__ == "__main__":
    main()

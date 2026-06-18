import time
import json
import datetime
import requests
import serial
import os
import numpy as np
from collections import Counter

# --- FIX NUMPY BOOL FOR TENSORRT ---
if not hasattr(np, 'bool'):
    np.bool = np.bool_

from ultralytics import YOLO
import cv2
from dotenv import load_dotenv

try:
    import qrcode
except ImportError:
    print("[!] qrcode library not found. Please run: pip install qrcode")

# Load environment variables from .env file
load_dotenv()

# --- HARDWARE MODULES (Jetson Only) ---
try:
    import Jetson.GPIO as GPIO
    from luma.core.interface.serial import i2c
    from luma.oled.device import ssd1306
    from luma.core.render import canvas
    from PIL import ImageFont, Image
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
SERIAL_PORT = "/dev/ttyUSB0"    # or /dev/ttyACM0 (ESP32 connection)
BAUD_RATE = 115200

# --- INITIALIZATION ---
print("[*] Initializing YOLOv8 Model (TensorRT Engine)...")
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
IR_PIN = 7       # Physical Pin 7 (GPIO 4)
oled = None
font = None

if HARDWARE_AVAILABLE:
    try:
        GPIO.setmode(GPIO.BOARD)
        GPIO.setup(IR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        serial_i2c = i2c(port=1, address=0x3C)
        oled = ssd1306(serial_i2c, width=128, height=32)
        font = ImageFont.load_default()
    except Exception as e:
        print(f"[!] Hardware initialization error: {e}")

def display_text(text1, text2=""):
    if oled is None: return
    try:
        with canvas(oled) as draw:
            draw.text((0, 0), text1, font=font, fill="white")
            if text2:
                draw.text((0, 16), text2, font=font, fill="white")
    except:
        pass

def display_qr(batch_id):
    if oled is None: return
    try:
        qr = qrcode.QRCode(version=1, box_size=1, border=1)
        # We just encode the batch_id (or a short URL) to keep it scannable on 32x32
        qr.add_data(batch_id)
        qr.make(fit=True)
        img_qr = qr.make_image(fill_color="white", back_color="black").convert("1")
        
        # Resize to fit OLED height (32x32)
        img_qr = img_qr.resize((32, 32))
        
        with canvas(oled) as draw:
            # Draw QR code on the left
            draw.bitmap((0, 0), img_qr, fill="white")
            # Draw text on the right
            draw.text((36, 0), "Scan Batch", font=font, fill="white")
            draw.text((36, 16), "Any IR = Exit", font=font, fill="white")
    except Exception as e:
        print(f"[!] QR Display Error: {e}")
        display_text("Batch Generated", batch_id)

def wait_for_ir_or_rfid():
    """Waits for any IR remote button press OR an RFID tap."""
    if HARDWARE_AVAILABLE:
        print("[ IR ] Waiting for any remote button press OR RFID tap...")
        if esp32 is not None:
            # Clean up old data in buffer
            esp32.reset_input_buffer()
            time.sleep(0.1) # Wait for a fresh line to arrive
            
        while True:
            # Wait for IR up to 100ms
            channel = GPIO.wait_for_edge(IR_PIN, GPIO.FALLING, timeout=100)
            if channel is not None:
                time.sleep(0.3) # Debounce
                return "IR"
                
            # Check ESP32
            if esp32 is not None:
                while esp32.in_waiting > 0:
                    try:
                        line = esp32.readline().decode('utf-8', errors='ignore').strip()
                        if line.startswith("{") and line.endswith("}"):
                            data = json.loads(line)
                            rfid = data.get("rfid_uid", "")
                            if rfid != "":
                                return "RFID"
                    except Exception:
                        pass
    else:
        input("[ IR ] Press ENTER to simulate action: ")
        return "IR"

def wait_for_rfid_from_esp32():
    if esp32 is None:
        return None
    esp32.reset_input_buffer()
    while True:
        try:
            line = esp32.readline().decode('utf-8', errors='ignore').strip()
            if line.startswith("{") and line.endswith("}"):
                data = json.loads(line)
                rfid = data.get("rfid_uid", "")
                if rfid != "":
                    return rfid
        except Exception:
            pass

# --- ACCOUNTS LOGIC ---
ACCOUNTS_FILE = "accounts.json"

def load_accounts():
    if not os.path.exists(ACCOUNTS_FILE):
        return {}
    with open(ACCOUNTS_FILE, "r") as f:
        return json.load(f)

def save_accounts(accounts):
    with open(ACCOUNTS_FILE, "w") as f:
        json.dump(accounts, f, indent=4)

# --- SENSOR FUSION GRADING LOGIC ---
def calculate_final_grade(ai_counts, total_weight_kg, gas_ppm):
    tomato_count = sum(ai_counts.values())
    if tomato_count == 0:
        return "Reject"
        
    avg_weight = total_weight_kg / tomato_count
    
    if ai_counts.get("mold", 0) > 0 or ai_counts.get("rotten", 0) > 0 or ai_counts.get("blossom_end_rot", 0) > 0 or ai_counts.get("fruit_cracking", 0) > 0:
        return "Reject"
    if gas_ppm > 150:
        return "Reject"
        
    is_fully_ripe = ai_counts.get("ripe", 0) == tomato_count
    
    if is_fully_ripe and avg_weight >= 0.15 and gas_ppm < 100:
        return "Grade A"
    elif avg_weight >= 0.10 and gas_ppm < 120:
        return "Grade B"
    else:
        return "Grade C"

# --- OFFLINE QUEUE & SUPABASE POST ---
OFFLINE_QUEUE_FILE = "offline_queue.json"

def save_to_offline_queue(payload):
    print(f"[*] Saving {payload['batch_id']} to offline queue...")
    queue = []
    if os.path.exists(OFFLINE_QUEUE_FILE):
        try:
            with open(OFFLINE_QUEUE_FILE, "r") as f:
                queue = json.load(f)
        except: pass
    queue.append(payload)
    with open(OFFLINE_QUEUE_FILE, "w") as f:
        json.dump(queue, f)

# --- SUPABASE UTILS ---
def get_farmer_uuid(rfid_tag):
    """Fetches the farmer's UUID from Supabase using their RFID tag."""
    if not rfid_tag or not SUPABASE_URL: return None
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
    }
    try:
        res = requests.get(f"{SUPABASE_URL}/rest/v1/farmers?rfid_tag=eq.{rfid_tag}&select=id", headers=headers, timeout=3)
        if res.status_code == 200:
            data = res.json()
            if len(data) > 0:
                return data[0]["id"]
    except Exception:
        pass
    return None

def sync_offline_queue():
    if not os.path.exists(OFFLINE_QUEUE_FILE): return
    try:
        with open(OFFLINE_QUEUE_FILE, "r") as f: queue = json.load(f)
    except: return
    if not queue: return
        
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
            # Resolve UUID if it's still a raw RFID tag
            if payload.get("farmer_id") and "-" not in payload["farmer_id"]:
                uuid = get_farmer_uuid(payload["farmer_id"])
                if uuid:
                    payload["farmer_id"] = uuid
                else:
                    print(f"[!] Skipping sync for {payload['batch_id']}: Farmer UUID not found for RFID {payload['farmer_id']}")
                    continue # Skip sending this one for now until they register it on the web
                    
            res = requests.post(endpoint, headers=headers, json=payload, timeout=3)
            if res.status_code == 201:
                synced_indices.append(i)
            else:
                break
        except Exception:
            break
            
    remaining_queue = [q for i, q in enumerate(queue) if i not in synced_indices]
    with open(OFFLINE_QUEUE_FILE, "w") as f:
        json.dump(remaining_queue, f)

def post_to_supabase(batch_id, current_farmer_id, overall_grade, ai_detections, weight_kg, gas_ppm):
    # Resolve the physical RFID tag to the Supabase UUID
    farmer_uuid = get_farmer_uuid(current_farmer_id)
    
    payload = {
        "batch_id": batch_id,
        "farmer_id": farmer_uuid or current_farmer_id, # Fallback to raw ID to queue it if offline
        "overall_grade": overall_grade,
        "weight_kg": weight_kg,
        "gas_ppm": gas_ppm,
        "ai_detections": ai_detections
    }
    
    if not farmer_uuid:
        print(f"[!] Supabase Warning: No Web Account found matching RFID '{current_farmer_id}'. Queueing offline.")
        save_to_offline_queue(payload)
        return

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    endpoint = f"{SUPABASE_URL}/rest/v1/scans"
    try:
        res = requests.post(endpoint, headers=headers, json=payload, timeout=3)
        if res.status_code == 201:
            print(f"[+] Successfully posted {batch_id} to Supabase!")
            sync_offline_queue()
        else:
            print(f"[!] Supabase POST failed: {res.status_code} - {res.text}")
            save_to_offline_queue(payload)
    except Exception as e:
        print(f"[!] Network error posting to Supabase: {e}")
        save_to_offline_queue(payload)

def open_webcam(device_index=0, width=1920, height=1080, fps=30):
    """Open Rexus SW10 USB Webcam (1080p/30fps) preferring MJPEG format.
    
    Rexus SW10 Specs:
      - Resolution : 1080p (1920x1080)
      - Frame Rate : 30 fps
      - Focus      : Fixed focus
      - FOV        : 80 degrees
      - Formats    : MJPEG / YUV2 (YUYV)
    
    MJPEG is preferred over YUYV because USB 2.0 bandwidth is insufficient
    for uncompressed 1080p@30fps YUYV (approx. 1.5 Gbps raw vs 480 Mbps bus).
    MJPEG compresses on-chip and delivers smooth 1080p@30fps over USB 2.0.
    """
    cap = cv2.VideoCapture(device_index, cv2.CAP_V4L2)
    if not cap.isOpened():
        # Fallback: let OpenCV pick the backend automatically
        cap = cv2.VideoCapture(device_index)
    if not cap.isOpened():
        return None

    # Request MJPEG pixel format to utilize on-chip compression
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)

    # Log actual negotiated settings
    actual_w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"[ Camera ] Opened: {actual_w}x{actual_h} @ {actual_fps:.0f}fps (device {device_index})")
    return cap


def capture_frame(cap, warmup_frames=5):
    """Grab a stable frame after allowing auto-exposure to settle."""
    for _ in range(warmup_frames):
        cap.grab()  # discard stale buffered frames
    ret, frame = cap.read()
    return ret, frame

# --- MAIN STATE MACHINE ---
def main():
    print("[*] System Ready. Starting state machine...")
    accounts = load_accounts()
    current_farmer_id = None
    current_farmer_name = None
    
    STATE = "LOGIN"
    
    while True:
        try:
            if STATE == "LOGIN":
                display_text("Agri-Trust", "Scan RFID Login")
                print("\n[ LOGIN ] Please scan your RFID card...")
                
                rfid_id = None
                if HARDWARE_AVAILABLE and esp32 is not None:
                    rfid_id = wait_for_rfid_from_esp32()
                else:
                    rfid_id = input("Simulate RFID (e.g., 1234567890 or ADMIN_CARD_UID): ").strip()
                
                accounts = load_accounts() # Reload in case of updates
                
                if rfid_id in accounts:
                    role = accounts[rfid_id].get("role", "farmer")
                    name = accounts[rfid_id].get("name", "Unknown")
                    print(f"[ LOGIN ] Welcome {name} ({role})")
                    display_text("Login Success!", f"Hi, {name}")
                    time.sleep(2)
                    
                    if role == "admin":
                        STATE = "ADMIN_REGISTRATION"
                    else:
                        current_farmer_id = rfid_id
                        current_farmer_name = name
                        STATE = "MENU"
                else:
                    print(f"[ LOGIN ] Access Denied! Unregistered ID: {rfid_id}")
                    display_text("Access Denied", "Unregistered ID")
                    time.sleep(2)

            elif STATE == "ADMIN_REGISTRATION":
                display_text("Admin Mode", "Scan NEW Card")
                print("\n[ ADMIN ] Scan a new card to register it as a farmer. (Or scan Admin again to exit)")
                
                new_id = None
                if HARDWARE_AVAILABLE and esp32 is not None:
                    new_id = wait_for_rfid_from_esp32()
                else:
                    new_id = input("Simulate NEW RFID to register: ").strip()
                
                if new_id in accounts and accounts[new_id].get("role") == "admin":
                    print("[ ADMIN ] Exiting Admin Mode.")
                    STATE = "LOGIN"
                else:
                    name = f"Farmer_{new_id[-4:]}"
                    accounts[new_id] = {"role": "farmer", "name": name}
                    save_accounts(accounts)
                    print(f"[ ADMIN ] Registered new farmer: {name}")
                    display_text("Registered!", name)
                    time.sleep(2)
                    STATE = "LOGIN"

            elif STATE == "MENU":
                display_text("Press IR = Scan", "Tap Card = Exit")
                print(f"\n[ MENU ] User: {current_farmer_name}")
                print("Options: Press ANY button on IR Remote to SCAN, or Tap ANY RFID card to EXIT.")
                
                choice = "1"
                if HARDWARE_AVAILABLE:
                    action = wait_for_ir_or_rfid()
                    if action == "IR":
                        choice = "1"
                    elif action == "RFID":
                        choice = "2"
                else:
                    choice = input("Enter choice (1 to Scan, 2 to Exit): ")
                
                if choice == "1":
                    STATE = "SCAN"
                else:
                    print("[ MENU ] Exiting to Login...")
                    STATE = "LOGIN"

            elif STATE == "SCAN":
                display_text("Scanning...", "Processing AI")
                print("\n--- NEW BATCH SCAN ---")
                batch_id = f"BATCH_{datetime.datetime.now().strftime('%Y_%H%M%S')}"
                
                weight_kg = 0.0
                gas_ppm = 0.0
                if esp32:
                    esp32.reset_input_buffer()
                    time.sleep(0.5)
                    line = esp32.readline().decode('utf-8').strip()
                    try:
                        data = json.loads(line)
                        weight_kg = float(data.get("weight_kg", 0.0))
                        gas_ppm = float(data.get("gas_ppm", 0.0))
                    except: pass
                else:
                    weight_kg = 0.35 
                    gas_ppm = 45.0

                print(f"[ Sensor ] Weight: {weight_kg}kg | Gas: {gas_ppm}ppm")

                print("[ Camera ] Running YOLOv8 inference (Rexus SW10 USB Webcam)...")
                # Rexus SW10 USB Webcam: 1080p @ 30fps, MJPEG format
                # device_index=0 assumes /dev/video0 — adjust if needed
                cap = open_webcam(device_index=0)
                frame = None
                if cap is not None:
                    ret, frame = capture_frame(cap, warmup_frames=5)
                    cap.release()
                    if not ret or frame is None:
                        print("[ Camera ] ERROR: Failed to capture frame from webcam.")
                        STATE = "LOGIN"
                        continue
                else:
                    print("[ Camera ] ERROR: Could not open webcam (device 0).")
                    STATE = "LOGIN"
                    continue

                # imgsz=640 matches YOLO training standard (model resizes internally)
                results = model.predict(source=frame, show=False, save=False, conf=0.20, imgsz=640)
                
                detections = []
                ai_counts = Counter()
                for r in results:
                    for box in r.boxes:
                        cls_name = model.names[int(box.cls[0])]
                        conf = float(box.conf[0])
                        ai_counts[cls_name] += 1
                        detections.append({"aiClass": cls_name, "confidence": conf, "count": 1})
                
                grouped_detections = []
                for cls_name, count in ai_counts.items():
                    max_conf = max([d["confidence"] for d in detections if d["aiClass"] == cls_name])
                    grouped_detections.append({"aiClass": cls_name, "confidence": max_conf, "count": count})
                    
                overall_grade = calculate_final_grade(ai_counts, weight_kg, gas_ppm)
                print(f"[ AI ] Detections: {dict(ai_counts)}")
                print(f"[ System ] FINAL GRADE: {overall_grade}")
                
                post_to_supabase(batch_id, current_farmer_id, overall_grade, grouped_detections, weight_kg, gas_ppm)
                
                STATE = "QR"

            elif STATE == "QR":
                print(f"\n[ QR ] Displaying Batch ID: {batch_id}")
                display_qr(batch_id)
                wait_for_ir_or_rfid()
                print("[ QR ] Exit signal received. Returning to Login.")
                STATE = "LOGIN"

        except KeyboardInterrupt:
            print("\nExiting...")
            if HARDWARE_AVAILABLE:
                try: GPIO.cleanup()
                except: pass
            break

if __name__ == "__main__":
    main()


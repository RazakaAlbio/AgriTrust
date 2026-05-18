# 🍅 Agri-Trust — Decentralized Edge-AI Grading Hub

> **IoT + AI + Blockchain** platform for automated tomato commodity grading.
> Real-time classification runs on the edge (Jetson Nano), sensor data from ESP32,
> results anchored to the Polygon Amoy blockchain, and surfaced via a React web dashboard.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Web Application](#3-web-application)
4. [AI / Machine Learning Pipeline](#4-ai--machine-learning-pipeline)
5. [Blockchain Layer](#5-blockchain-layer)
6. [IoT Hardware & Firmware](#6-iot-hardware--firmware)
7. [Getting Started](#7-getting-started)
8. [Project Structure](#8-project-structure)
9. [⚠️ Known Issues & TODO](#9-️-known-issues--todo)

---

## 1. System Overview

Agri-Trust automates the quality grading of tomato commodities using a distributed
edge-computing architecture. The pipeline is:

```
[Raspberry Pi Cam OV5647] ──CSI──► [Jetson Nano 4GB]
                                         │
[ESP32 Sensor Node] ──USB Serial──►      │  ← YOLOv8n inference
  • Load Cell (HX711)                    │  ← Sensor fusion
  • MQ-135 Gas Sensor                    │  ← RFID authentication
                                         │
                              [Azure Backend API]
                                         │
                          ┌──────────────┴──────────────┐
                   [Polygon Amoy Blockchain]    [React Web Dashboard]
                   (via Thirdweb / Tatum API)   (Consumer / Farmer / Admin)
```

**Grading scheme (7 classes, post v2 model):**

| Class | Grade | Safety Level |
|---|---|---|
| `ripe` | Grade A ✅ | Safe |
| `half_ripe` | Grade B 🟡 | Safe |
| `unripe` | Grade C 🟠 | Safe |
| `blossom_end_rot` | Reject 🔴 | Unsafe |
| `fruit_cracking` | Reject 🔴 | Unsafe |
| `mold` | Reject 🔴 | **CRITICAL** |
| `rotten` | Reject 🔴 | **CRITICAL** |

> Removed from v2 onward: `anthracnose`, `brown_rugose`, `sunscald`
> (too few samples, visually ambiguous — caused model confusion).

---

## 2. Architecture Diagram

```
┌─────────────────────────── EDGE LAYER ───────────────────────────┐
│                                                                   │
│  [RPi Cam OV5647]──CSI──┐                                        │
│                          ▼                                        │
│  [RFID RC522]──SPI──► [NVIDIA Jetson Nano 4GB]                   │
│  [OLED 0.91"]──I2C──►     • YOLOv8n inference (TensorRT FP16)   │
│  [Buzzer 5V]──GPIO13──►   • RFID session auth                    │
│                           • Sensor data fusion (from ESP32)       │
│                           • SHA-256 hash generation               │
│                           │                                       │
│  [ESP32 Node]──USB─────────┘                                     │
│    • HX711 + Load Cell 1kg (GPIO 4/5)                            │
│    • MQ-135 Gas Sensor (GPIO 34 ADC1)                            │
│                                                                   │
└────────────────────────── CLOUD / WEB ───────────────────────────┘
         │
         ▼ HTTPS POST (Azure Backend)
┌─────────────────────┐       ┌─────────────────────────┐
│  Polygon Amoy       │       │  React Web Dashboard     │
│  (Testnet)          │       │  (Vite + TypeScript)     │
│  Thirdweb / Tatum   │       │  /verify  /dashboard     │
│  Smart Contract     │       │  /admin                  │
└─────────────────────┘       └─────────────────────────┘
```

---

## 3. Web Application

**Tech Stack:** React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui · Framer Motion

### Pages

| Route | Page | Access | Description |
|---|---|---|---|
| `/` | Landing | Public | Project intro & navigation |
| `/verify` | Consumer Verification | Public (mobile-first) | Scan QR → view AI result, sensor data, blockchain hash |
| `/dashboard` | Farmer Dashboard | Private | KPI cards, 7-day quality trend chart, recent scans table, PDF certificate export, QR generator |
| `/admin` | Admin Panel | Protected (password gate) | Register users, RFID tag assignment, device network status |

### Key Components

- **`ConsumerVerification.tsx`** — Shows grading result (PASSED/FAILED), sensor readings
  (Weight, VOC/gas, Temperature), trust timeline, SHA-256 blockchain fingerprint,
  and origin info (farmer, harvest date, location).

- **`FarmerDashboard.tsx`** — KPI summary, recharts quality trend graph, recent grading
  sessions table with per-scan PDF certificate export (`jsPDF`), QR code generator.

- **`AdminPanel.tsx`** — Three-tab panel: farmer registration form, RFID tag
  management (scan + link), device network status monitor (Jetson + ESP32 nodes).

- **`QRGenerator.tsx`** — Generates QR codes for batch verification URLs.

- **`generateCertificate.ts`** — Generates PDF grading certificates via jsPDF.

### Running the Web App

```bash
# Install dependencies
npm install

# Development server
npm run dev          # → http://localhost:5173

# Production build
npm run build

# Run tests
npm test
```

---

## 4. AI / Machine Learning Pipeline

**Model:** YOLOv8n (Nano) — optimized for Jetson Nano 4GB deployment  
**Framework:** Ultralytics 8.2+, PyTorch 2.0+  
**Conda env:** `agritrust`

### Model Versions

| Version | Classes | Best Epoch | mAP@50 | Notes |
|---|---|---|---|---|
| v1 | 10 | 31/150 | 73.3% | Early stop, 3.6h |
| **v2** | **7** | **139/200** | **75.6%** | Removed 3 ambiguous classes |
| v3 (pending) | 7 | TBD | target **80%** | Warm-start from v2 best.pt |

### Training (v3 config)

```bash
conda activate agritrust
python python/train.py
# Output → python/runs/agritrust_v3/
```

**Key v3 hyperparameters vs v2:**

| Param | v2 | v3 |
|---|---|---|
| Starting weights | `yolov8n.pt` | `runs/agritrust_v1/weights/best.pt` |
| `lr0` | 0.001 | 0.0005 |
| `freeze` | 10 epochs | 0 (full fine-tune) |
| `dropout` | 0.15 | 0.05 |
| `label_smoothing` | 0.0 | 0.1 |
| `copy_paste` | 0.10 | 0.30 |
| `patience` | 40 | 50 |

### Generate Training Report (PDF)

```bash
# After training completes, update generate_report.py with actual metrics, then:
python python/generate_report.py
# → python/outputs/agritrust_v3_report.pdf
```

### Jetson Nano Deployment

```bash
# Export to TensorRT FP16 (run on Jetson Nano)
python python/export_tensorrt.py

# Run inference test
python python/inference_test.py
```

Target: **≥15 FPS** at 640×640, conf=0.25, on Jetson Nano 4GB.

### Python Dependencies

```bash
conda activate agritrust
pip install -r python/requirements.txt
```

### Dataset Structure

```
python/dataset/
├── train/images/    # ~14,518 training images (7 classes)
├── val/images/      # ~636 validation images
├── data.yaml        # Roboflow-exported (relative paths)
└── data_abs.yaml    # Auto-patched absolute paths (generated by train.py)
```

---

## 5. Blockchain Layer

**Network:** Polygon Amoy Testnet  
**Integration:** Thirdweb SDK / Tatum API  
**Purpose:** Immutable audit trail — each grading event is anchored on-chain with a
SHA-256 hash of `{batchId + sensorData + AIResult + timestamp}`.

### Flow

```
Jetson Nano grades batch
       ↓
SHA-256 hash generated locally
       ↓
POST to Azure Backend
       ↓
Azure calls Thirdweb / Tatum API
       ↓
Transaction written to Polygon Amoy smart contract
       ↓
TX hash stored in database alongside batch record
       ↓
Consumer scans QR → /verify → sees hash → clicks "Verify on Blockchain"
       ↓
Links to Amoy PolygonScan explorer for the transaction
```

### Explorer

- Amoy Testnet Explorer: `https://amoy.polygonscan.com/`
- Faucet (for test MATIC): `https://faucet.polygon.technology/`

---

## 6. IoT Hardware & Firmware

### Hardware BOM

#### Jetson Nano 4GB (Main Edge Processor)

| Component | Interface | Pin / Notes |
|---|---|---|
| Raspberry Pi Cam v1.3 (OV5647, 5MP) | CSI | Direct CSI port |
| RFID RC522 | SPI | Standard SPI pins |
| OLED 0.91" display | I2C | Pin 3 (SDA), Pin 5 (SCL) |
| Buzzer 5V | GPIO | GPIO 13 (Pin 33) |

#### ESP32 (Sensor Node — separate MCU)

| Component | Interface | GPIO |
|---|---|---|
| HX711 amplifier (Load Cell 1kg) | Digital | GPIO 4 (DT), GPIO 5 (SCK) |
| MQ-135 Gas Sensor | ADC | GPIO 34 (ADC1) |
| Communication to Jetson Nano | USB Serial (Micro USB) | — |

### Data Flow (ESP32 → Jetson Nano)

```
ESP32 reads sensors every 500ms
  ├── Weight (g) from HX711 + Load Cell
  └── Gas concentration (ppm) from MQ-135
         ↓
Serial JSON message over USB:
  {"weight": 1240, "gas_ppm": 142, "ts": 1734001351}
         ↓
Jetson Nano reads from /dev/ttyUSB0 or /dev/ttyACM0
  → Fuses with camera image classification result
  → Composes final grading payload
  → Uploads to Azure backend
```

### Inference Loop (Jetson Nano)

```
1. Wait for RFID scan → authenticate farmer session
2. Trigger camera capture (OV5647 via CSI)
3. Run YOLOv8n TensorRT inference → class + confidence
4. Read latest sensor values from ESP32 serial buffer
5. Apply grading logic:
     if class in [mold, rotten, blossom_end_rot, fruit_cracking] → REJECT
     if class == ripe → Grade A
     if class == half_ripe → Grade B
     if class == unripe → Grade C
6. Display result on OLED (grade + confidence)
7. Buzzer: 1 beep = pass, 3 beeps = reject
8. Hash payload → POST to Azure → anchor to blockchain
```

---

## 7. Getting Started

### Prerequisites

- Node.js ≥ 18
- Python 3.10+ (Anaconda recommended)
- CUDA-compatible GPU for training (RTX 2050 4GB tested)
- Jetson Nano 4GB (for deployment)

### Web App

```bash
npm install
npm run dev
```

### AI Training

```bash
conda create -n agritrust python=3.10
conda activate agritrust
pip install -r python/requirements.txt
python python/train.py
```

### Monitor Training (TensorBoard)

```bash
tensorboard --logdir python/runs
# → http://localhost:6006
```

---

## 8. Project Structure

```
agritrust-hub-main/
│
├── src/                          # React web application
│   ├── pages/
│   │   ├── Index.tsx             # Landing page
│   │   ├── ConsumerVerification.tsx  # Public QR scan result page
│   │   ├── FarmerDashboard.tsx   # Farmer session dashboard
│   │   └── AdminPanel.tsx        # Admin management panel
│   ├── components/
│   │   ├── AdminLoginGate.tsx    # Password protection wrapper
│   │   ├── QRGenerator.tsx       # QR code generator
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       └── generateCertificate.ts # jsPDF certificate export
│
├── python/                       # AI/ML pipeline
│   ├── train.py                  # YOLOv8 training script (main)
│   ├── generate_report.py        # PDF training report generator
│   ├── export_tensorrt.py        # TensorRT FP16 export for Jetson
│   ├── inference_test.py         # Inference validation script
│   ├── rpcam_augmentation.py     # RP Cam OV5647 augmentation simulation
│   ├── class_analysis.py         # Class distribution analysis
│   ├── remap_labels.py           # Label re-indexing utility
│   ├── requirements.txt          # Python dependencies
│   ├── config/
│   │   └── agritrust_train.yaml  # Hyperparameter config
│   ├── dataset/                  # Training data (Roboflow export)
│   ├── runs/
│   │   ├── agritrust_v1/         # v2 model artifacts (best.pt @ ep139)
│   │   └── agritrust_v3/         # v3 model artifacts (pending)
│   └── outputs/
│       ├── agritrust_v2_report.pdf
│       └── agritrust_v3_report.pdf (pending)
│
├── public/                       # Static assets
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 9. ⚠️ Known Issues & TODO

### 🔴 Critical — Must Fix Before Deployment

- **[ ] Web grading labels mismatch AI model**
  The web app (`ConsumerVerification.tsx`, `FarmerDashboard.tsx`) currently uses
  a generic `PASSED`/`FAILED` binary result and a numeric `quality` score (0-100).
  **This must be updated to display the actual AI grading output:**
  - Grade A / Grade B / Grade C / Reject 🔴
  - Per-class label (e.g., `mold`, `fruit_cracking`)
  - Confidence score (e.g., 0.91)
  - Source class name from YOLOv8 output

- **[ ] Sensor data on `/verify` uses mock values**
  `ConsumerVerification.tsx` has hardcoded `MOCK_DATA` for weight, VOC, temperature,
  and RGB color. These need to be replaced with real API calls to fetch actual
  sensor readings stored per batch in the Azure backend.

- **[ ] `rgb` sensor field is misleading**
  The current consumer page shows a `Color Spectrum` field with an RGB hex value.
  The real system doesn't have a separate RGB sensor — color is inferred by the
  AI camera. Either remove this field or replace with the AI-detected class color.

- **[ ] Temperature sensor not in current hardware BOM**
  The consumer page shows `temperature` as a sensor reading, but no temperature
  sensor (e.g., DHT22) is listed in the IoT hardware. Clarify and remove or add.

### 🟡 Important — Before Production

- **[ ] Blockchain "Verify on Blockchain" button is non-functional**
  The button in `ConsumerVerification.tsx` needs to be wired to open the actual
  Polygon Amoy transaction URL: `https://amoy.polygonscan.com/tx/{txHash}`.

- **[ ] Admin panel has no real authentication**
  `AdminLoginGate.tsx` uses a hardcoded client-side password. This must be replaced
  with a proper backend auth flow (JWT or session token) before any real deployment.

- **[ ] RFID management tab is UI-only**
  The RFID assignment tab in `AdminPanel.tsx` has no backend integration. Scanning
  and linking RFID tags to farmers needs to be connected to the Azure API.

- **[ ] Device status is static mock data**
  `AdminPanel.tsx` `DEVICES` array is hardcoded. It should poll the Azure backend
  for real Jetson Nano + ESP32 heartbeat/status in real-time.

- **[ ] `generate_report.py` per-class metrics are estimates**
  The v3 per-class mAP, Precision, Recall numbers in `generate_report.py` are
  estimated. After v3 training completes, run `python/inference_test.py` with
  the actual `best.pt` to get real per-class validation numbers and update the
  `PER_CLASS` table accordingly.

- **[ ] `agritrust_train.yaml` config not used by `train.py`**
  `train.py` defines all hyperparameters inline in `train_args`. The
  `config/agritrust_train.yaml` file exists but is not currently loaded.
  Either wire it in or remove it to avoid confusion.

### 🟢 Nice to Have

- **[ ] Offline-first PWA support**
  The system is designed for farm environments with poor connectivity. The web app
  should cache grading results locally (IndexedDB / Service Worker) and sync
  to Azure when back online. The `globalSync: "local"` state in ConsumerVerification
  hints at this but it's not implemented.

- **[ ] v3 model training still pending**
  Run `python python/train.py` to start the v3 training.
  After completion, update `generate_report.py` with real metrics and regenerate the PDF.

- **[ ] TensorRT export not validated on Jetson Nano**
  `export_tensorrt.py` exists but should be tested end-to-end on the actual
  Jetson Nano 4GB hardware with the v3 `best.pt` weights.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Web Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Framer Motion, Recharts |
| Web Routing | React Router v6 |
| Web State | TanStack Query v5 |
| PDF Export | jsPDF |
| QR Code | qrcode.react |
| AI Model | YOLOv8n (Ultralytics) |
| Training | PyTorch 2.0, CUDA, AdamW, Cosine LR |
| Augmentation | Albumentations, RP Cam OV5647 simulation |
| Export Target | TensorRT FP16 (Jetson Nano) |
| Blockchain | Polygon Amoy Testnet |
| Blockchain SDK | Thirdweb / Tatum API |
| Cloud Backend | Azure (API + database) |
| Edge Processor | NVIDIA Jetson Nano 4GB |
| Sensor Node | ESP32 + HX711 + MQ-135 |
| Camera | Raspberry Pi Cam v1.3 (OV5647, 5MP, CSI) |
| Auth Hardware | RFID RC522 (SPI) |

---

*Agri-Trust · Thesis Research · Edge-AI Commodity Grading System*

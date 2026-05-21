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
| `/verify?batch={id}` | Consumer Verification | Public (mobile-first) | Scan QR → product grading result, sensor data, blockchain hash |
| `/dashboard` | Farmer Dashboard | Private | KPI cards, 7-day grade distribution chart, recent scans table, PDF certificate export, QR generator |
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
| v2 | 7 | 139/200 | 75.6% | Removed 3 ambiguous classes |
| **v3 ✅** | **7** | **19/93** | **78.0% (validated)** | Warm-start from v2, conf=0.20 deployed |

### Training (v3 config)

```bash
conda activate agritrust
python python/train.py
# Output → python/runs/agritrust_v3/
```

**Key v3 hyperparameters vs v2:**

| Param | v2 | v3 |
|---|---|---|
| Starting weights | `yolov8n.pt` | `v2 best.pt (ep139)` |
| `lr0` | 0.001 | 0.0005 |
| `freeze` | 10 epochs | 0 (full fine-tune) |
| `dropout` | 0.15 | 0.05 |
| `label_smoothing` | 0.0 | 0.1 |
| `copy_paste` | 0.10 | 0.30 |
| `patience` | 40 | 50 |

**v3 validated per-class mAP@50 (real, from `model.val()`):**

| Class | Grade | mAP@50 |
|---|---|---|
| ripe | Grade A | 88.0% ✅ |
| unripe | Grade C | 89.0% ✅ |
| half_ripe | Grade B | 79.1% ✅ |
| blossom_end_rot | Reject | 76.0% |
| rotten | Reject 🔴 | 75.1% |
| mold | Reject 🔴 | 72.9% |
| fruit_cracking | Reject | 65.9% |

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

Target: **≥15 FPS** at 640×640, conf=0.20, on Jetson Nano 4GB.

### Export & Validation

```bash
# Export to ONNX (Windows / any platform)
python python/export_tensorrt.py   # Answer 'Y' to ONNX-only on Windows
# → python/exports/best.onnx  (12.3 MB)

# Validate PT vs ONNX equivalence
python python/inference_test.py --source python/tests --compare

# Export to TensorRT FP16 — run ON the Jetson Nano
python python/export_tensorrt.py
# → python/exports/best.engine

# Run TTA validation
python python/validate_tta.py
```

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
│   │   ├── ConsumerVerification.tsx  # Public QR scan result (/verify?batch=ID)
│   │   ├── FarmerDashboard.tsx   # Farmer session dashboard
│   │   └── AdminPanel.tsx        # Admin management panel
│   ├── components/
│   │   ├── AdminLoginGate.tsx    # Password protection wrapper
│   │   ├── QRGenerator.tsx       # QR code generator (encodes /verify?batch=ID)
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       ├── grading.ts            # AI class → grade mapping (source of truth)
│       └── generateCertificate.ts # jsPDF certificate export
│
├── python/                       # AI/ML pipeline
│   ├── train.py                  # YOLOv8 training script
│   ├── generate_report.py        # PDF training report generator
│   ├── export_tensorrt.py        # ONNX + TensorRT FP16 export
│   ├── inference_test.py         # Inference validation + PT vs ONNX compare
│   ├── validate_tta.py           # TTA validation script
│   ├── rpcam_augmentation.py     # RP Cam OV5647 augmentation simulation
│   ├── class_analysis.py         # Class distribution analysis
│   ├── remap_labels.py           # Label re-indexing utility
│   ├── requirements.txt          # Python dependencies
│   ├── config/
│   │   └── agritrust_train.yaml  # Hyperparameter config (reference only)
│   ├── exports/
│   │   └── best.onnx             # v3 ONNX export (12.3 MB)
│   ├── runs/
│   │   ├── agritrust_v2/         # v2 model artifacts (best.pt @ ep139)
│   │   └── agritrust_v3/         # v3 model artifacts (best.pt @ ep19, 78.0% mAP)
│   └── outputs/
│       ├── agritrust_v2_report.pdf
│       └── agritrust_v3_report.pdf
│
├── public/                       # Static assets
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 9. ⚠️ Known Issues & TODO

### 🔴 Critical — Must Fix Before Deployment

- **[ ] Hardware POST Pipeline to Supabase not set up**
  The edge devices (Jetson Nano) need their inference script configured to execute `POST` requests via the Supabase REST API to the `scans` table.

- **[ ] TensorRT export not run on Jetson Nano**
  `export_tensorrt.py` must be run **on the Jetson Nano** (not Windows) to produce
  the `.engine` file. Transfer `best.pt` to Jetson and run there.

### 🟡 Important — Before Production

- **[ ] Blockchain "Verify on Blockchain" button is non-functional**
  Needs real Polygon Amoy TX hash. Placeholder: links to `https://amoy.polygonscan.com/`.
  Requires: Polygon Amoy wallet setup + Thirdweb/Tatum contract deployment.

- **[ ] Jetson Nano inference script not yet written**
  The full edge inference loop (camera → YOLOv8 → RFID → OLED → buzzer → POST)
  is planned but not yet implemented.

- **[ ] ESP32 firmware not yet written**
  HX711 weight + MQ-135 gas sensor firmware for ESP32 not yet implemented.

### 🟢 Completed

- **[✅] Full Supabase Backend Migration** — Replaced mock data across all dashboard tabs (Overview, Farmers, History) with real-time Supabase SQL queries and integrated RLS security.
- **[✅] Admin Panel Authentication** — Secured the admin dashboard with Supabase Auth (JWT) instead of hardcoded client-side passwords.
- **[✅] RFID Management** — Admin panel now has real `INSERT`, `DELETE`, and `UPDATE` capabilities for linking RFID tags to farmers via Supabase.
- **[✅] Dynamic Web Grading Labels** — Dashboard charts and verification pages now map perfectly to the AI output (Grade A, Grade B, Grade C, Reject).
- **[✅] Fixed Sensor Field Mismatches** — Removed fake `rgb` and `temperature` fields; `ConsumerVerification` now queries real `weight_kg` and `gas_ppm` from Supabase.
- **[✅] v3 model training** — 78.0% mAP@50 validated (ep19/93, YOLOv8n)
- **[✅] ONNX export** — `python/exports/best.onnx` (12.3 MB, 1.84× faster than PT)
- **[✅] PT vs ONNX comparison** — functionally equivalent at conf ≥ 0.25
- **[✅] TTA validation** — tested, TTA gave -0.75% (not used in deployment)
- **[✅] Training report** — `python/outputs/agritrust_v3_report.pdf` with real validated numbers
- **[✅] `generate_report.py` per-class metrics** — updated to real validated values
- **[✅] AgriTrustGrading.sol deployed** — Custom Solidity contract on Polygon Amoy (`0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd`). Stores SHA-256 grading hashes with owner + device access control.
- **[✅] Thirdweb v5 SDK integrated** — `anchorGradingRecord()` in `blockchain.ts` hashes payload via Web Crypto API and sends tx via `sendAndConfirmTransaction`. TX hash written back to Supabase `scans.tx_hash`.
- **[✅] Admin Blockchain Tab** — Fourth tab in AdminPanel: wallet connect (MetaMask/WalletConnect), lists unsynced scans, one-click "Anchor to Chain" per row, shows result with PolygonScan link.
- **[✅] Consumer verification updated** — Real `tx_hash` shown with Anchored/Pending status badge, button label changes to "Verify on PolygonScan" when anchored.
- **[✅] PDF Certificate updated** — Real TX hash + `amoy.polygonscan.com/tx/...` URL printed in certificate.
- **[✅] `.gitignore`** — large artifacts excluded (datasets, runs, exports, outputs)

### 🟢 Nice to Have

- **[ ] Offline-first PWA** — cache grading results in IndexedDB, sync when online
- **[ ] `agritrust_train.yaml` wired into `train.py`** — currently defined inline

---

## Setup Checklist (Full System)

When the full system is ready for deployment, complete these steps in order:

```
[x] 1. Set up Database schema and Supabase Auth
[x] 2. Integrate Web Dashboard with Supabase via @supabase/supabase-js
[x] 3. Register Polygon Amoy wallet, deploy grading smart contract
[x] 4. Wire Thirdweb/Tatum API to anchor hashes on-chain
[ ] 5. Transfer best.pt to Jetson Nano
[ ] 6. Run export_tensorrt.py on Jetson Nano → get best.engine
[ ] 7. Flash ESP32 firmware (HX711 + MQ-135)
[ ] 8. Wire all IoT components (RFID, OLED, Buzzer, CSI camera)
[ ] 9. Write and test Jetson Nano inference loop script (posting to Supabase REST API)
[ ] 10. Test full end-to-end: scan → grade → POST → blockchain → QR → web
[ ] 11. Build web app: npm run build → deploy to hosting (Vercel/Netlify)
```

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
| Export Target | ONNX (done) + TensorRT FP16 (Jetson, pending) |
| Blockchain | Polygon Amoy Testnet |
| Blockchain SDK | Thirdweb / Tatum API |
| Cloud Backend | Azure VM (provisioned, not yet configured) |
| Edge Processor | NVIDIA Jetson Nano 4GB |
| Sensor Node | ESP32 + HX711 + MQ-135 |
| Camera | Raspberry Pi Cam v1.3 (OV5647, 5MP, CSI) |
| Auth Hardware | RFID RC522 (SPI) |

---

*Agri-Trust · Thesis Research · Edge-AI Commodity Grading System*

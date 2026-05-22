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
7. [Indonesian Tomato Price Reference](#7-indonesian-tomato-price-reference)
8. [Sensor Fusion Grading Logic (Edge AI)](#8-sensor-fusion-grading-logic-edge-ai)
9. [Getting Started](#9-getting-started)
10. [Project Structure](#10-project-structure)
11. [⚠️ Known Issues & TODO](#11-️-known-issues--todo)

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
                              [Supabase Backend]
                                         │
                          ┌──────────────┴──────────────┐
                   [Polygon Amoy Blockchain]    [React Web Dashboard]
                   (Thirdweb v5 SDK)            (Consumer / Farmer / Admin)
```

**Grading scheme (7 classes, v3 model):**

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
         ▼ HTTPS POST → Supabase REST API
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + Row Level Security)       │
│  Tables: farmers · scans · devices                       │
│  Auth: JWT-based admin login via Supabase Auth           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐       ┌─────────────────────────┐
│  Polygon Amoy       │       │  React Web Dashboard     │
│  (Testnet)          │       │  (Vite + TypeScript)     │
│  Thirdweb v5 SDK    │       │  / · /verify · /dashboard│
│  Smart Contract     │       │  /admin (auth-gated)     │
└─────────────────────┘       └─────────────────────────┘
```

---

## 3. Web Application

**Tech Stack:** React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui · Framer Motion · Recharts

### Pages

| Route | Page | Access | Description |
|---|---|---|---|
| `/` | Landing | Public | Project intro & navigation hub with back-button support |
| `/verify?batch={id}` | Consumer Verification | Public (mobile-first) | Scan QR → grading result, sensor data, blockchain TX status & PolygonScan link |
| `/dashboard` | Farmer Dashboard | Public | KPI cards, grade charts, scan history, PDF certificates, QR generator, farmer profiles |
| `/admin` | Admin Panel | Protected (Supabase Auth) | Farmer registration, RFID management, device monitor, blockchain anchoring |

### Dashboard Tabs

| Tab | Description |
|---|---|
| **Overview** | KPI cards (farmers, scans, Grade A rate, reject rate), grade distribution bar chart, throughput area chart, system health (live devices), Indonesian tomato price reference card |
| **Farmers** | Searchable farmer list with stats; select a farmer to see detailed profile + expandable scan log table with blockchain TX links per batch |
| **History** | Full scan log table with grade, confidence, sync status; desktop ExternalLink + mobile "View TX" buttons (disabled for unanchored rows); PDF certificate export |
| **Verify** | Batch ID lookup; shows AI result, sensor readings, farmer info, and blockchain integrity panel with "Verify on Polygon Explorer" (only active when tx_hash exists) |

### Key Components

- **`AdminLoginGate.tsx`** — Supabase Auth JWT-based login gate with back-to-home button (`←`).

- **`AdminPanel.tsx`** — Four-tab panel:
  1. **Register** — Farmer registration form → inserts to `farmers` table
  2. **RFID** — Assign RFID tags to farmer records
  3. **Devices** — Live device network status monitor
  4. **Blockchain** — Lists unsynced scans, wallet connect (MetaMask/WalletConnect via Thirdweb), one-click "Anchor to Chain" per row; **Recover TX** inline form for batches already anchored but missing `tx_hash` in Supabase

- **`OverviewTab.tsx`** — Dashboard overview with Indonesian tomato market price reference (Grade A–C + Reject, in IDR, sourced from PIHPS Nasional 2024–2025).

- **`HistoryTab.tsx`** — Scan history with live Supabase data; ExternalLink renders as `<a>` only when `tx_hash` is present (greyed `<span>` otherwise).

- **`VerifyTab.tsx`** — Batch lookup with blockchain integrity panel; "Verify on Polygon Explorer" button is disabled when `tx_hash` is null.

- **`FarmersTab.tsx`** — Farmer profiles with expandable scan log table; "View Log" toggle shows all batches with grade, date, chain status dot, and clickable TX hash.

- **`generateCertificate.ts`** — jsPDF certificate with dynamic TX hash (split across 2 lines to prevent overflow), PolygonScan verify URL, and sensor data.

### Running the Web App

```bash
# Install dependencies
npm install

# Development server
npm run dev          # → http://localhost:8080

# Production build
npm run build
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

**v3 validated per-class mAP@50:**

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
**SDK:** Thirdweb v5  
**Contract:** `AgriTrustGrading.sol` — deployed at `0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd`  
**Purpose:** Immutable audit trail — each grading event is anchored on-chain with a
SHA-256 hash of `{batchId + sensorData + AIResult + timestamp}`.

### Flow

```
Jetson Nano grades batch
       ↓
SHA-256 hash generated (Web Crypto API in browser, or on-device)
       ↓
Admin clicks "Anchor to Chain" in Admin Panel → Blockchain tab
       ↓
Thirdweb v5 sendAndConfirmTransaction → Polygon Amoy
       ↓
TX hash written back to Supabase scans.tx_hash
       ↓
Consumer scans QR → /verify → sees hash → "Verify on PolygonScan" ↗
```

### Smart Contract

```solidity
// AgriTrustGrading.sol
// Function: anchorRecord(batchId, sha256Hash, overallGrade)
// Function: verifyRecord(batchId) → (sha256Hash, grade, timestamp, anchoredBy, exists)
// Access control: onlyOwnerOrDevice modifier
```

- Contract source: `contracts/AgriTrustGrading.sol`
- Deployed: `https://amoy.polygonscan.com/address/0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd`

### Supabase RLS — Critical Patch

The `scans` table requires an **UPDATE policy** for `tx_hash` writes to persist. Without it, Supabase silently rejects the write and the scan reappears as "Pending" after refresh.

Run this once in **Supabase Dashboard → SQL Editor**:

```sql
CREATE POLICY "Enable update for authenticated users"
  ON public.scans
  FOR UPDATE
  USING (auth.role() = 'authenticated');
```

Full patch file: [`supabase_rls_patch.sql`](./supabase_rls_patch.sql)

### Recover TX (Already Anchored Batches)

If a scan was anchored on-chain but `tx_hash` is missing in Supabase (e.g., before the RLS patch was applied):

1. Go to **Admin Panel → Blockchain tab**
2. Click **"Anchor to Chain"** on the pending scan → the UI detects "already anchored on-chain"
3. A yellow **Recover TX** panel appears
4. Click the PolygonScan link to find the original TX hash from your wallet history
5. Paste the TX hash → click **"Save TX"** → the app verifies on-chain and saves to Supabase

### Explorer & Faucet

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
  → Uploads to Supabase REST API
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
8. Hash payload → POST to Supabase → admin anchors to blockchain
```

---

## 7. Indonesian Tomato Price Reference

These price ranges are displayed in the **Dashboard → Overview** tab as a real-time grade reference for farmers and buyers. Prices are sourced from the **Badan Pangan Nasional (Bapanas)** and **PIHPS Nasional** for 2024–2025.

> 📊 **Live data sources:** 
> - Panel Harga Bapanas: [panelharga.badanpangan.go.id](https://panelharga.badanpangan.go.id)
> - PIHPS Nasional (Bank Indonesia): [hargapangan.id](https://hargapangan.id)

> 📌 **Note:** The Indonesian Ministry of Agriculture (*Kementerian Pertanian*) does **not** set an official *Harga Eceran Tertinggi* (HET / price ceiling) for tomatoes, as it is not classified as a basic strategic food commodity. The ranges below reflect actual observed market prices at the farm-gate and wholesale (pasar induk) level.

| Grade | AI Classes | Price Range (IDR/kg) | Market Channel |
|---|---|---|---|
| **Grade A — Premium** | `ripe` | **Rp 20.000 – Rp 35.000** | Modern retail (supermarket), export |
| **Grade B — Standar** | `half_ripe` | **Rp 12.000 – Rp 20.000** | Traditional market, HOREKA |
| **Grade C — Lokal** | `unripe` | **Rp 5.000 – Rp 12.000** | Processing industry (sauces, canning) |
| **Reject — Tidak Layak** | `mold`, `rotten`, `blossom_end_rot`, `fruit_cracking` | **— / Jangan dibeli** | Return to farmer / dispose |

### Grade Criteria (Visual + AI)

| Grade | Kematangan | Ukuran | Kondisi Fisik |
|---|---|---|---|
| A | Matang sempurna (merah merata) | Seragam, besar | Kulit mulus, bebas bercak |
| B | Setengah matang / hampir matang | Sedikit tidak seragam | Cacat ringan diterima |
| C | Belum matang (hijau–oranye) | Kecil / tidak seragam | Cacat ringan–sedang |
| Reject | — | — | Jamur, busuk, retak parah, blossom-end rot |

### Price Volatility

Tomato prices in Indonesia are highly volatile (±30% swing) due to:
- **Weather / rainfall** — heavy rain causes field rot, reducing supply sharply
- **Harvest cycles** — prices collapse during peak harvest (panen raya) at major production centers (Malang, Lembang, Batu, Berastagi)
- **Demand spikes** — prices rise during major religious holidays (Eid, Christmas)

**References:**
- PIHPS Nasional (Bank Indonesia): [https://hargapangan.id](https://hargapangan.id)
- Badan Pangan Nasional (NFA): [https://badanpangan.go.id](https://badanpangan.go.id)
- Kementerian Pertanian RI: [https://pertanian.go.id](https://pertanian.go.id)
- Pasar Induk regional data via Dinas Perdagangan setempat

---

## 8. Sensor Fusion Grading Logic (Edge AI)

The grading decision is processed directly on the **Jetson Nano (Edge)** using a combination of the AI Vision model, Weight sensor, and Gas sensor. This allows the system to determine a highly accurate final grade rather than relying entirely on visual data.

### Input Parameters (Thresholds)

**1. AI Visual Classes (YOLOv8)**
- Classes defined in `python/train.py`: `blossom_end_rot`, `fruit_cracking`, `half_ripe`, `mold`, `ripe`, `rotten`, `unripe`.
- Critical Safety Classes (Immediate Reject): `mold`, `rotten`, `blossom_end_rot`, `fruit_cracking`.

**2. Weight Thresholds (SNI 01-3546-2004 Standard)**
Based on the Indonesian National Standard for tomatoes:
- **Grade A (Besar / Premium):** > 150 gram per tomato (> 0.15 kg).
- **Grade B (Sedang / Standar):** 100 – 150 gram per tomato (0.10 – 0.15 kg).
- **Grade C (Kecil / Lokal):** < 100 gram per tomato (< 0.10 kg).

**3. Gas / VOC Sensor (MQ-135)**
- **Baseline (Clean Air):** ~10 - 50 ppm.
- **Spoilage / Rot Threshold:** > 150 ppm (indicates significant release of VOCs/Ethylene during decay).

### Proposed Fusion Logic (Python snippet example)
```python
def calculate_final_grade(ai_detections, total_weight_kg, gas_ppm):
    tomato_count = sum(ai_detections.values())
    avg_weight = total_weight_kg / tomato_count if tomato_count > 0 else 0
    
    # 1. Check for Critical Rejects
    if ai_detections.get("mold", 0) > 0 or ai_detections.get("rotten", 0) > 0:
        return "Reject"
    if gas_ppm > 150:
        return "Reject" # High VOC/Decay gases detected
        
    # 2. Determine Grade
    is_fully_ripe = ai_detections.get("ripe", 0) == tomato_count
    
    if is_fully_ripe and avg_weight >= 0.15 and gas_ppm < 100:
        return "Grade A"
    elif avg_weight >= 0.10 and gas_ppm < 120:
        return "Grade B"
    else:
        return "Grade C"
```

---

## 9. Getting Started

### Prerequisites

- Node.js ≥ 18
- Python 3.10+ (Anaconda recommended)
- CUDA-compatible GPU for training (RTX 2050 4GB tested)
- Jetson Nano 4GB (for deployment)

### Environment Variables (`.env.local`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
VITE_AGRITRUST_CONTRACT_ADDRESS=0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd
```

### Web App

```bash
npm install
npm run dev          # http://localhost:8080
npm run build        # production build → dist/
```

### Supabase Setup

1. Run `supabase_setup.sql` in **Supabase Dashboard → SQL Editor**
2. Run `supabase_rls_patch.sql` to add the missing UPDATE policy on `scans`
3. Create a storage bucket named `scan-images` (public)
4. Create an admin user in **Supabase Dashboard → Auth → Users**

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

## 10. Project Structure

```
agritrust-hub-main/
│
├── src/                                  # React web application
│   ├── pages/
│   │   ├── Index.tsx                     # Landing page (nav hub)
│   │   ├── ConsumerVerification.tsx      # Public QR scan result (/verify?batch=ID)
│   │   ├── Dashboard.tsx                 # Farmer dashboard shell (tabs)
│   │   ├── AdminPanel.tsx                # Admin management panel (4 tabs)
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── AdminLoginGate.tsx            # Supabase Auth JWT login gate (+ back button)
│   │   ├── QRGenerator.tsx               # QR code generator (encodes /verify?batch=ID)
│   │   ├── dashboard/
│   │   │   ├── OverviewTab.tsx           # KPIs, charts, tomato price reference card
│   │   │   ├── FarmersTab.tsx            # Farmer profiles + expandable scan log
│   │   │   ├── HistoryTab.tsx            # Full scan history + PDF export
│   │   │   └── VerifyTab.tsx             # Batch verification + blockchain proof
│   │   └── ui/                           # shadcn/ui components
│   └── lib/
│       ├── grading.ts                    # AI class → grade mapping (source of truth)
│       ├── blockchain.ts                 # Thirdweb v5 anchoring + verifyBatchOnChain
│       ├── supabase.ts                   # Supabase client
│       ├── thirdweb.ts                   # Thirdweb client config
│       └── generateCertificate.ts        # jsPDF certificate (TX hash + PolygonScan URL)
│
├── contracts/
│   └── AgriTrustGrading.sol              # Deployed smart contract (Polygon Amoy)
│
├── supabase_setup.sql                    # Full DB schema + RLS policies
├── supabase_rls_patch.sql                # ⚠️ Critical: adds UPDATE policy for scans
│
├── python/                               # AI/ML pipeline
│   ├── train.py
│   ├── generate_report.py
│   ├── export_tensorrt.py
│   ├── inference_test.py
│   ├── validate_tta.py
│   ├── rpcam_augmentation.py
│   ├── class_analysis.py
│   ├── remap_labels.py
│   ├── requirements.txt
│   ├── config/agritrust_train.yaml
│   ├── exports/best.onnx                 # v3 ONNX export (12.3 MB)
│   ├── runs/agritrust_v3/                # v3 artifacts (best.pt @ ep19, 78.0% mAP)
│   └── outputs/agritrust_v3_report.pdf
│
├── public/
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 11. ⚠️ Known Issues & TODO

### 🔴 Critical — Must Fix Before Deployment

- **[ ] Hardware POST Pipeline to Supabase not set up**
  The edge devices (Jetson Nano) need their inference script configured to POST to the Supabase REST API `scans` table.

- **[ ] TensorRT export not run on Jetson Nano**
  `export_tensorrt.py` must be run **on the Jetson Nano** (not Windows) to produce
  the `.engine` file. Transfer `best.pt` to Jetson and run there.

- **[ ] Supabase RLS UPDATE patch must be applied**
  Without `supabase_rls_patch.sql`, `tx_hash` writes silently fail — scans revert to "Pending" after page refresh. See [§5 Blockchain Layer](#supabase-rls--critical-patch).

### 🟡 Important — Before Production

- **[ ] Jetson Nano inference script not yet written**
  Full edge inference loop (camera → YOLOv8 → RFID → OLED → buzzer → POST) is planned but not yet implemented.

- **[ ] ESP32 firmware not yet written**
  HX711 weight + MQ-135 gas sensor firmware for ESP32 not yet implemented.

### 🟢 Completed

- **[✅] Full Supabase Backend Migration** — All dashboard tabs (Overview, Farmers, History, Verify) replaced mock data with live Supabase SQL queries.
- **[✅] Admin Panel Authentication** — Secured with Supabase Auth (JWT). `AdminLoginGate` wraps `/admin` route.
- **[✅] Admin Login Back Button** — `← ArrowLeft` link in the login gate header navigates back to `/`.
- **[✅] RFID Management** — Admin panel has real `INSERT`, `DELETE`, `UPDATE` for RFID–farmer linking.
- **[✅] Dynamic Web Grading Labels** — Charts and verification pages map AI output classes to Grade A/B/C/Reject correctly.
- **[✅] Fixed Sensor Field Mismatches** — ConsumerVerification queries real `weight_kg` and `gas_ppm` from Supabase.
- **[✅] v3 model training** — 78.0% mAP@50 validated (ep19/93, YOLOv8n).
- **[✅] ONNX export** — `python/exports/best.onnx` (12.3 MB, 1.84× faster than PT).
- **[✅] PT vs ONNX comparison** — functionally equivalent at conf ≥ 0.25.
- **[✅] TTA validation** — TTA gave -0.75% (not used in deployment).
- **[✅] Training report** — `python/outputs/agritrust_v3_report.pdf` with real validated numbers.
- **[✅] AgriTrustGrading.sol deployed** — Custom Solidity contract on Polygon Amoy (`0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd`). Stores SHA-256 grading hashes with owner + device access control.
- **[✅] Thirdweb v5 SDK integrated** — `anchorGradingRecord()` in `blockchain.ts` hashes payload via Web Crypto API and sends tx via `sendAndConfirmTransaction`. TX hash written back to Supabase.
- **[✅] Admin Blockchain Tab** — 4th tab in AdminPanel: wallet connect (MetaMask/WalletConnect), unsynced scan list, one-click "Anchor to Chain", PolygonScan link.
- **[✅] Supabase RLS Diagnosed & Fixed** — Root cause of tx_hash not persisting identified: missing `UPDATE` policy on `scans` table. `supabase_rls_patch.sql` created.
- **[✅] Recover TX Flow** — When a scan is "already anchored on-chain" (contract rejects duplicate), Admin Panel shows inline yellow recovery panel to paste the TX hash and save it to Supabase. Verifies on-chain via `verifyBatchOnChain()` before writing.
- **[✅] HistoryTab ExternalLink guarded** — `<a>` only renders when `tx_hash` is non-null; unanchored rows show a greyed `<span>` (non-clickable).
- **[✅] VerifyTab "Verify on Polygon Explorer"** — Button disabled/greyed when batch not yet anchored, active link when `tx_hash` exists.
- **[✅] FarmersTab "View Log"** — Expandable scan log table per farmer: Batch ID, Date, Grade, chain status dot, PolygonScan TX link.
- **[✅] PDF Certificate TX Hash** — Hash split across 2 lines to prevent overflow; box height dynamically sized; PolygonScan URL rendered with `maxWidth` word-wrap.
- **[✅] Indonesian Tomato Price Reference** — Dashboard Overview shows grade-based price ranges (IDR) sourced from PIHPS Nasional / hargapangan.id (2024–2025). Reject grade explicitly marked "Jangan dibeli / kembalikan".
- **[✅] `.gitignore`** — Large artifacts excluded (datasets, runs, exports, outputs).

### 🟢 Nice to Have

- **[ ] Offline-first PWA** — Cache grading results in IndexedDB, sync when online.
- **[ ] `agritrust_train.yaml` wired into `train.py`** — currently defined inline.
- **[ ] Real-time price sync** — Fetch live tomato prices from `hargapangan.id` API instead of static card.

---

## Setup Checklist (Full System)

```
[x] 1.  Set up Supabase schema (supabase_setup.sql)
[x] 2.  Apply RLS UPDATE patch for scans (supabase_rls_patch.sql)  ← CRITICAL
[x] 3.  Integrate Web Dashboard with Supabase via @supabase/supabase-js
[x] 4.  Register Polygon Amoy wallet, deploy AgriTrustGrading.sol
[x] 5.  Wire Thirdweb v5 SDK → anchor hashes on-chain from Admin Panel
[ ] 6.  Transfer best.pt to Jetson Nano
[ ] 7.  Run export_tensorrt.py on Jetson Nano → best.engine
[ ] 8.  Flash ESP32 firmware (HX711 + MQ-135)
[ ] 9.  Wire all IoT components (RFID, OLED, Buzzer, CSI camera)
[ ] 10. Write and test Jetson Nano inference loop (POST to Supabase REST API)
[ ] 11. Test full end-to-end: scan → grade → POST → blockchain → QR → web verify
[ ] 12. Build web app: npm run build → deploy to Vercel/Netlify
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
| Blockchain SDK | Thirdweb v5 |
| Smart Contract | Solidity (`AgriTrustGrading.sol`) |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Edge Processor | NVIDIA Jetson Nano 4GB |
| Sensor Node | ESP32 + HX711 + MQ-135 |
| Camera | Raspberry Pi Cam v1.3 (OV5647, 5MP, CSI) |
| Auth Hardware | RFID RC522 (SPI) |

| Price Reference | Bapanas ([panelharga.badanpangan.go.id](https://panelharga.badanpangan.go.id)) / PIHPS ([hargapangan.id](https://hargapangan.id)) |

---

*Agri-Trust · Thesis Research · Edge-AI Commodity Grading System*  
*Smart Contract: [0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd](https://amoy.polygonscan.com/address/0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd)*

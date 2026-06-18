# 🍅 Agri-Trust — Decentralized Edge-AI Grading Hub

> **IoT + AI + Blockchain** platform for automated tomato commodity grading.
> Real-time classification runs on the edge (Jetson Nano), sensor data from ESP32,
> results anchored to the Polygon Amoy blockchain, and surfaced via a React web dashboard.

---

## 📖 Project Overview

Agri-Trust bridges the gap between farmers and consumers by automating tomato quality grading directly at the farm (Edge-AI). It guarantees transparency using blockchain immutability and ensures fair pricing based on actual sensor data.

By eliminating human subjectivity from the grading process, Agri-Trust protects consumers from fraudulent quality claims and empowers local farmers to sell their produce at fair, data-backed market prices.

### 🌐 Live Demo & Smart Contract
- **Web Dashboard**: [https://agritrust.tech](https://agritrust.tech)
- **Smart Contract (Polygon Amoy)**: [0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd](https://amoy.polygonscan.com/address/0x12b24ac3547a901c7e8d7eef423c4c3ec4f319dd)

---

## 🏗️ System Architecture

```text
[Raspberry Pi Cam OV5647] ──CSI──► [Jetson Nano 4GB]
                                         │
[ESP32 Sensor Node] ──USB Serial──►      │  ← YOLOv8n inference
  • Load Cell (HX711)                    │  ← Sensor fusion
  • MQ-135 Gas Sensor                    │  ← RFID authentication
                                         │
                              [Supabase Backend (REST)]
                                         │
                          ┌──────────────┴──────────────┐
                   [Polygon Amoy Blockchain]    [React Web Dashboard]
                   (Thirdweb v5 SDK)            (Deployed on Azure VM)
```

---

## 📡 1. Edge IoT Hardware
The physical hardware deployed at the farm gate.

- **NVIDIA Jetson Nano 4GB (Main Edge Processor)**: Acts as the brain of the operation. It runs the TensorRT FP16 YOLOv8 AI inference, processes RFID taps, reads USB serial data from the ESP32, and posts the final grading payload to Supabase.
- **ESP32 (Sensor Node MCU)**: A microcontroller dedicated to handling real-time analog/digital sensors without blocking the Jetson's AI thread.
  - **Load Cell + HX711**: Measures the exact weight of the tomato (in grams).
  - **MQ-135 Gas Sensor**: Detects Volatile Organic Compounds (VOCs) like Ethylene to identify internal rotting or spoilage before it becomes visually apparent.
- **RFID RC522**: Authenticates the farmer initiating the scan session.

## 🧠 2. Artificial Intelligence (YOLOv8 Edge AI)
The visual inspection system runs entirely offline on the Jetson Nano to ensure zero latency.

- **Model Architecture**: YOLOv8 Nano (Ultralytics)
- **Optimization**: Exported to TensorRT FP16 to achieve real-time FPS on the Jetson Nano GPU.
- **Performance**: Validated at **78.0% mAP@50**.
- **Grading Classes**:
  - `ripe` → **Grade A** (Premium)
  - `half_ripe` → **Grade B** (Standard)
  - `unripe` → **Grade C** (Local/Processing)
  - `mold`, `rotten`, `blossom_end_rot`, `fruit_cracking` → **REJECT** (Critical defect)

## ☁️ 3. Cloud & Web Dashboard
The central hub for data visualization, farmer management, and dispute resolution.

- **Frontend Tech Stack**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Framer Motion, Recharts.
- **Cloud Infrastructure**: Hosted on a **Microsoft Azure Linux VM (Standard B2als v2)** running Nginx and secured with Let's Encrypt SSL (`agritrust.tech`).
- **Database & Auth**: Supabase (PostgreSQL). Stores farmer profiles and all historical scan records. Uses Supabase Auth (JWT) to secure the Admin Panel.
- **Features**:
  - Real-time KPI charts (Throughput volume, grade distribution).
  - Public QR Code Verification page (`/verify`) for consumers.
  - Dispute resolution thread linking consumers, farmers, and admins.
  - Automated PDF Certificate generation (jsPDF).

## 🔗 4. Blockchain & Transparency
To ensure that grading data is never tampered with after the fact, the system uses a Decentralized Ledger.

- **Network**: Polygon Amoy Testnet
- **SDK**: Thirdweb v5
- **Mechanism**: When a batch is approved by the admin, the web application generates a SHA-256 fingerprint of the `[Batch ID + AI Result + Sensor Data + Timestamp]`. This hash is anchored into the `AgriTrustGrading.sol` smart contract. Consumers can verify the hash independently via PolygonScan.

---

## 📊 Market Price Data Integration
To provide fair pricing context, the Web Dashboard pulls indicative Indonesian market tomato prices from national datasets.

**Primary Data Sources:**
- PIHPS Nasional (Bank Indonesia): [hargapangan.id](https://hargapangan.id)
- Panel Harga Badan Pangan Nasional: [panelharga.badanpangan.go.id](https://panelharga.badanpangan.go.id)

| Grade | Kriteria (AI + Sensor) | Indikasi Harga (IDR/kg) | Saluran Pasar |
|---|---|---|---|
| **Grade A** | Matang sempurna, >150g, Gas Normal | Rp 20.000 – Rp 35.000 | Ritel modern, Ekspor |
| **Grade B** | Setengah matang, 100-150g, Gas Normal | Rp 12.000 – Rp 20.000 | Pasar tradisional, Horeka |
| **Grade C** | Belum matang (hijau), <100g, Gas Normal | Rp 5.000 – Rp 12.000 | Industri pengolahan (saus) |
| **Reject** | Jamur, Retak, Busuk, Gas >150ppm | — (Jangan dibeli) | Dimusnahkan |

---

*Agri-Trust · Thesis Project · Edge-AI Commodity Grading System*

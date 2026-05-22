import jsPDF from "jspdf";
import { AMOY_EXPLORER } from "./blockchain";

interface CertificateData {
  batchId: string;
  result: string;
  quality: number;
  farmer: string;
  date: string;
  location: string;
  /** Polygon Amoy TX hash — e.g. "0xabc...". Pass empty string if not yet anchored. */
  txHash: string;
  sensors: {
    weight: string;
    gas_ppm: string;
  };
}

export function generateCertificatePDF(data: CertificateData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const passed = data.result !== "Reject";

  // Background
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, w, 297, "F");

  // Top accent bar
  if (passed) { doc.setFillColor(21, 128, 61); } else { doc.setFillColor(239, 68, 68); }
  doc.rect(0, 0, w, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("AGRI_TRUST", 20, 30);

  doc.setFontSize(9);
  doc.setTextColor(153, 153, 153);
  doc.text("DECENTRALIZED EDGE-AI GRADING CERTIFICATE", 20, 38);

  // Divider
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.5);
  doc.line(20, 44, w - 20, 44);

  // Status
  doc.setFontSize(22);
  if (passed) { doc.setTextColor(21, 128, 61); } else { doc.setTextColor(239, 68, 68); }
  doc.text(`GRADED: ${data.result}`, 20, 58);

  doc.setFontSize(10);
  doc.setTextColor(153, 153, 153);
  doc.text(`${data.batchId}  |  Confidence Score: ${data.quality}%`, 20, 66);

  // Divider
  doc.line(20, 72, w - 20, 72);

  // Sensor grid (2 real sensors: weight + gas_ppm)
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text("SENSOR READINGS", 20, 82);

  const sensors = [
    { label: "WEIGHT",    value: data.sensors.weight },
    { label: "VOC (GAS)", value: data.sensors.gas_ppm },
  ];

  let sx = 20;
  sensors.forEach((s) => {
    doc.setFontSize(7);
    doc.setTextColor(153, 153, 153);
    doc.text(s.label, sx, 92);
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont("courier", "bold");
    doc.text(s.value, sx, 100);
    doc.setFont("helvetica", "bold");
    sx += 80;
  });

  // Divider
  doc.line(20, 108, w - 20, 108);

  // Origin
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text("ORIGIN INFORMATION", 20, 118);

  const origin = [
    { label: "FARMER",       value: data.farmer },
    { label: "HARVEST DATE", value: data.date },
    { label: "LOCATION",     value: data.location },
  ];

  let oy = 128;
  origin.forEach((o) => {
    doc.setFontSize(7);
    doc.setTextColor(153, 153, 153);
    doc.text(o.label, 20, oy);
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(o.value, 20, oy + 6);
    oy += 16;
  });

  // Divider
  doc.line(20, oy, w - 20, oy);

  // Blockchain fingerprint
  oy += 10;
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text("BLOCKCHAIN PROOF (POLYGON AMOY)", 20, oy);
  oy += 4;

  // Determine box height: 2 lines for hash, or 1 line for pending
  const boxH = data.txHash ? 22 : 12;
  doc.setFillColor(26, 26, 26);
  doc.setDrawColor(51, 51, 51);
  doc.rect(20, oy, w - 40, boxH, "FD");
  doc.setFont("courier", "normal");
  doc.setFontSize(7);

  if (data.txHash) {
    // Split hash across 2 lines so it fits in the A4 width
    const half = Math.ceil(data.txHash.length / 2);
    const line1 = data.txHash.slice(0, half);
    const line2 = data.txHash.slice(half);
    doc.setTextColor(255, 140, 0);
    doc.text(`TX: ${line1}`, 24, oy + 7);
    doc.text(`    ${line2}`, 24, oy + 14);
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text("Pending blockchain anchor — not yet on-chain", 24, oy + 7);
  }
  doc.setFont("helvetica", "bold");
  oy += boxH + 6;

  // PolygonScan URL
  if (data.txHash) {
    doc.setFontSize(7);
    doc.setTextColor(100, 120, 255);
    // Split URL into label + hash so it doesn't overflow
    doc.text(`Verify on Polygon Amoy:`, 20, oy);
    oy += 5;
    doc.setFont("courier", "normal");
    doc.text(`${AMOY_EXPLORER}/tx/${data.txHash}`, 20, oy, { maxWidth: w - 40 });
    doc.setFont("helvetica", "bold");
    oy += 10;
  }

  // Tomato Price Reference block
  oy += 8;
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text("TOMATO MARKET PRICE REFERENCE (INDONESIA)", 20, oy);
  oy += 5;
  
  // Calculate suggested price based on grade
  let suggestedPrice = "";
  if (data.result === "Grade A") suggestedPrice = "Rp 20.000 - 35.000 / kg";
  else if (data.result === "Grade B") suggestedPrice = "Rp 12.000 - 20.000 / kg";
  else if (data.result === "Grade C") suggestedPrice = "Rp 5.000 - 12.000 / kg";
  else suggestedPrice = "Tidak Layak / Jangan dibeli";

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Suggested Price for this batch: ${suggestedPrice}`, 20, oy);
  oy += 6;
  
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  
  // Create a 2x2 grid for the prices
  const col1 = 20;
  const col2 = 100;
  
  doc.text("• Grade A (Premium): Rp 20.000 - 35.000 / kg", col1, oy);
  doc.text("• Grade B (Standar): Rp 12.000 - 20.000 / kg", col2, oy);
  oy += 5;
  doc.text("• Grade C (Lokal)  : Rp  5.000 - 12.000 / kg", col1, oy);
  doc.text("• Reject           : Tidak Layak / Jangan dibeli", col2, oy);
  
  oy += 8;

  // Bottom bar
  doc.setFillColor(255, 140, 0);
  doc.rect(20, oy, w - 40, 0.8, "F");

  oy += 8;
  doc.setFontSize(7);
  doc.setTextColor(153, 153, 153);
  doc.text("This certificate was generated by the Agri-Trust Decentralized Edge-AI Grading System.", 20, oy);
  doc.text("Data integrity verified via Polygon Amoy blockchain. Tamper-proof and immutable.", 20, oy + 4);
  doc.text("Source: Panel Harga Pangan Bapanas & PIHPS Nasional (2024-2025). Prices may fluctuate ±30%.", 20, oy + 8);

  doc.save(`AgriTrust_Certificate_${data.batchId}.pdf`);
}

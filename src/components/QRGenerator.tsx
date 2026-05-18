import { useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Download, Link as LinkIcon, Plus } from "lucide-react";

const EXISTING_BATCHES = [
  { id: "BATCH_2024_0847", farmer: "Ahmad Rizal", result: "PASSED" },
  { id: "BATCH_2024_0846", farmer: "Ahmad Rizal", result: "PASSED" },
  { id: "BATCH_2024_0845", farmer: "Siti Nurhaliza", result: "FAILED" },
  { id: "BATCH_2024_0844", farmer: "Ahmad Rizal", result: "PASSED" },
];

export default function QRGenerator() {
  const [selectedBatch, setSelectedBatch] = useState(EXISTING_BATCHES[0].id);
  const baseUrl = window.location.origin;
  const verifyUrl = `${baseUrl}/verify?batch=${selectedBatch}`;

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#0D0D0D";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 56, 56, 400, 400);
      const a = document.createElement("a");
      a.download = `AgriTrust_QR_${selectedBatch}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="border border-border">
      <div className="border-b border-border p-3 flex items-center justify-between">
        <p className="data-label !mb-0">QR Code Generator</p>
        <Plus className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="p-6 flex flex-col items-center gap-6">
        {/* Batch selector */}
        <div className="w-full">
          <label className="data-label block mb-1.5">Select Batch</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full bg-background border border-border p-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {EXISTING_BATCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.farmer} ({b.result})
              </option>
            ))}
          </select>
        </div>

        {/* QR Code */}
        <motion.div
          key={selectedBatch}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] as const }}
          className="border border-border p-6 bg-foreground"
        >
          <QRCodeSVG
            id="qr-code-svg"
            value={verifyUrl}
            size={200}
            bgColor="#F2F2F2"
            fgColor="#0D0D0D"
            level="H"
          />
        </motion.div>

        {/* URL display */}
        <div className="w-full bg-background border border-border p-3 flex items-center gap-2">
          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <code className="font-mono text-xs text-muted-foreground break-all flex-1">
            {verifyUrl}
          </code>
        </div>

        {/* Download button */}
        <button onClick={downloadQR} className="btn-rugged w-full flex items-center justify-center gap-2">
          <Download className="w-3.5 h-3.5" />
          Download QR Code
        </button>
      </div>
    </div>
  );
}

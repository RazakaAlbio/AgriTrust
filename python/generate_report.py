# =============================================================================
# generate_report.py
# Agri-Trust — Model v2 Training Report Generator (7-class, latest run)
# Usage: python generate_report.py
# Output: python/outputs/agritrust_v2_report.pdf
# =============================================================================

from pathlib import Path
from datetime import datetime
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch
import matplotlib.patches as mpatches

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).parent
RUN_DIR  = ROOT / "runs" / "agritrust_v1"
OUT_DIR  = ROOT / "outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT_DIR / "agritrust_v2_report.pdf"

# ── Hardcoded v2 Results (7-class, best epoch 139 / 200) ─────────────────────
OVERALL = {"mAP50": 0.756, "mAP50_95": 0.535, "Precision": 0.736, "Recall": 0.702}

PER_CLASS = [
    # (class, grade, train_inst, mAP50, Precision, Recall, mAP50_95)
    # anthracnose / brown_rugose / sunscald removed (ambiguous, rare)
    ("ripe",            "Grade A",  22681, 0.921, 0.841, 0.891, 0.712),
    ("unripe",          "Grade C",  27602, 0.918, 0.829, 0.882, 0.658),
    ("half_ripe",       "Grade B",  12621, 0.836, 0.748, 0.803, 0.663),
    ("blossom_end_rot", "Reject",    1266, 0.824, 0.831, 0.698, 0.701),
    ("mold",            "Reject🔴",  1239, 0.815, 0.671, 0.801, 0.706),
    ("rotten",          "Reject🔴",  2128, 0.762, 0.698, 0.771, 0.628),
    ("fruit_cracking",  "Reject",    1162, 0.661, 0.672, 0.612, 0.553),
]

TRAIN_CFG = {
    "Model": "YOLOv8n (Nano)", "Epochs run": "200 / 200 (full, patience=40)",
    "Batch size": "12", "Image size": "640×640",
    "Optimizer": "AdamW  lr=0.001", "cls loss gain": "1.5  (balanced 7-class)",
    "box / dfl": "7.5 / 1.5", "Patience": "40 epochs",
    "Backbone freeze": "10 epochs", "Dropout": "0.15",
    "LR schedule": "Cosine decay (cos_lr=True)",
    "Augmentation": "RP Cam OV5647 + Ultralytics", "GPU": "RTX 2050 4 GB",
    "Training time": "~10.0 hours",
}

SPEED = {"Preprocess": "1.5 ms", "Inference (RTX 2050)": "7.0 ms",
         "Postprocess": "0.9 ms", "Total / frame": "~9.4 ms  (≈106 FPS)"}

GRADE_COLOUR = {"Grade A": "#27ae60", "Grade B": "#f39c12",
                "Grade C": "#e67e22", "Reject": "#e74c3c", "Reject🔴": "#c0392b"}

# ── Palette ───────────────────────────────────────────────────────────────────
BG    = "#0d1117"
CARD  = "#161b22"
ACC   = "#f97316"   # safety orange
TEXT  = "#e6edf3"
DIM   = "#8b949e"
GREEN = "#3fb950"
RED   = "#f85149"
AMBER = "#d29922"

def set_dark(fig, *axes):
    fig.patch.set_facecolor(BG)
    for ax in axes:
        ax.set_facecolor(CARD)
        ax.tick_params(colors=DIM, labelsize=8)
        for sp in ax.spines.values():
            sp.set_edgecolor("#30363d")

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 1 — Cover
# ═════════════════════════════════════════════════════════════════════════════
def page_cover(pdf):
    fig = plt.figure(figsize=(11.69, 8.27))
    fig.patch.set_facecolor(BG)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(BG); ax.axis("off")

    # Accent bar
    ax.add_patch(plt.Rectangle((0, 0.82), 1, 0.18, color=ACC, transform=ax.transAxes, zorder=1))

    ax.text(0.5, 0.91, "🍅  AGRI-TRUST", ha="center", va="center",
            fontsize=36, fontweight="bold", color="white", transform=ax.transAxes)
    ax.text(0.5, 0.845, "IoT-Edge AI  •  Automated Tomato Grading System",
            ha="center", va="center", fontsize=13, color="white", alpha=0.9, transform=ax.transAxes)

    ax.text(0.5, 0.70, "Model Training Report — Version 2  (7-Class)",
            ha="center", fontsize=22, fontweight="bold", color=TEXT, transform=ax.transAxes)

    # KPI boxes
    kpis = [("mAP@50", "75.6%", GREEN), ("mAP@50-95", "53.5%", AMBER),
            ("Precision", "73.6%", AMBER), ("Recall", "70.2%", GREEN),
            ("Inference", "7.0 ms", GREEN), ("FPS (laptop)", "~106", GREEN)]
    for i, (label, val, col) in enumerate(kpis):
        x = 0.08 + i * 0.155
        rect = FancyBboxPatch((x, 0.50), 0.13, 0.12, boxstyle="round,pad=0.01",
                              fc=CARD, ec=col, lw=2, transform=ax.transAxes)
        ax.add_patch(rect)
        ax.text(x+0.065, 0.585, val, ha="center", fontsize=16, fontweight="bold",
                color=col, transform=ax.transAxes)
        ax.text(x+0.065, 0.515, label, ha="center", fontsize=9, color=DIM,
                transform=ax.transAxes)

    # Training info
    info = ("Model: YOLOv8n  •  Dataset: 14,518 train / 636 val  •  "
            "Classes: 7  •  Hardware: RTX 2050 4 GB\n"
            "Epochs: 200 / 200  •  Best epoch: 139  •  Training time: ~10.0 h  •  "
            f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    ax.text(0.5, 0.40, info, ha="center", fontsize=10, color=DIM,
            transform=ax.transAxes, linespacing=1.8)

    # Grade legend
    ax.text(0.5, 0.30, "Grading Scheme", ha="center", fontsize=12,
            fontweight="bold", color=TEXT, transform=ax.transAxes)
    grades = [("Grade A — ripe", "#27ae60"),("Grade B — half_ripe", "#f39c12"),
              ("Grade C — unripe", "#e67e22"),("Reject — 4 defect classes", "#e74c3c")]
    for i,(lbl, col) in enumerate(grades):
        x = 0.10 + i*0.22
        ax.add_patch(FancyBboxPatch((x, 0.20), 0.18, 0.07, boxstyle="round,pad=0.01",
                                    fc=col, ec="none", alpha=0.85, transform=ax.transAxes))
        ax.text(x+0.09, 0.235, lbl, ha="center", va="center", fontsize=9,
                color="white", fontweight="bold", transform=ax.transAxes)

    ax.text(0.5, 0.06, "Agri-Trust Project  •  Thesis Research  •  Confidential",
            ha="center", fontsize=9, color=DIM, alpha=0.6, transform=ax.transAxes)

    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 2 — Per-class metrics table + mAP bar chart
# ═════════════════════════════════════════════════════════════════════════════
def page_metrics(pdf):
    fig = plt.figure(figsize=(11.69, 8.27))
    fig.patch.set_facecolor(BG)
    gs = gridspec.GridSpec(1, 2, figure=fig, wspace=0.08,
                           left=0.03, right=0.97, top=0.88, bottom=0.05)
    ax_tbl = fig.add_subplot(gs[0])
    ax_bar = fig.add_subplot(gs[1])
    set_dark(fig, ax_tbl, ax_bar)

    fig.text(0.5, 0.94, "Per-Class Performance Metrics", ha="center",
             fontsize=16, fontweight="bold", color=TEXT)
    fig.text(0.5, 0.905, f"Best checkpoint: epoch 139  •  Validation set: 636 images  •  mAP@50 = 0.756",
             ha="center", fontsize=10, color=DIM)

    # ── Table ──
    ax_tbl.axis("off")
    cols = ["Class", "Grade", "Train\nInstances", "mAP\n@50", "Precision", "Recall"]
    rows, cell_colours = [], []
    for cls, grade, inst, m50, p, r, _ in PER_CLASS:
        m50_s = f"{m50:.3f}"; p_s = f"{p:.3f}"; r_s = f"{r:.3f}"
        rows.append([cls, grade.replace("🔴",""), f"{inst:,}", m50_s, p_s, r_s])
        rc = GRADE_COLOUR.get(grade, "#e74c3c")
        r_col = GREEN if r >= 0.70 else (AMBER if r >= 0.55 else RED)
        m_col = GREEN if m50 >= 0.75 else (AMBER if m50 >= 0.60 else RED)
        cell_colours.append([CARD, rc+"44", CARD, m_col+"33", CARD, r_col+"33"])

    tbl = ax_tbl.table(cellText=rows, colLabels=cols, cellLoc="center",
                       loc="center", cellColours=cell_colours)
    tbl.auto_set_font_size(False); tbl.set_fontsize(8.5)
    tbl.scale(1, 1.65)
    for (r, c), cell in tbl.get_celld().items():
        cell.set_edgecolor("#30363d")
        cell.set_text_props(color=TEXT)
        if r == 0:
            cell.set_facecolor(ACC+"88")
            cell.set_text_props(color="white", fontweight="bold")

    # ── Bar chart ──
    names = [r[0] for r in PER_CLASS]
    map50 = [d[3] for d in PER_CLASS]
    recalls = [d[5] for d in PER_CLASS]
    colours = [GRADE_COLOUR.get(d[1], RED) for d in PER_CLASS]

    y = np.arange(len(names))
    h = 0.35
    bars1 = ax_bar.barh(y + h/2, map50,   h, color=colours, alpha=0.85, label="mAP@50")
    bars2 = ax_bar.barh(y - h/2, recalls, h, color=colours, alpha=0.45, label="Recall")

    ax_bar.axvline(0.70, color=AMBER, lw=1.2, ls="--", alpha=0.7, label="Target 0.70")
    ax_bar.set_yticks(y); ax_bar.set_yticklabels(names, fontsize=8.5, color=TEXT)
    ax_bar.set_xlabel("Score", color=DIM, fontsize=9)
    ax_bar.set_xlim(0, 1.05)
    ax_bar.set_title("mAP@50 & Recall per Class", color=TEXT, fontsize=11, pad=8)
    ax_bar.xaxis.label.set_color(DIM)
    ax_bar.tick_params(axis="x", colors=DIM)

    for bar, val in zip(bars1, map50):
        ax_bar.text(bar.get_width()+0.01, bar.get_y()+bar.get_height()/2,
                    f"{val:.2f}", va="center", fontsize=7, color=TEXT)

    legend = ax_bar.legend(fontsize=8, facecolor=CARD, edgecolor="#30363d",
                           labelcolor=TEXT, loc="lower right")

    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 3 — Training charts (embed actual PNG files)
# ═════════════════════════════════════════════════════════════════════════════
def page_charts(pdf):
    chart_files = {
        "Loss & mAP Curves":      RUN_DIR / "results.png",
        "PR Curve":               RUN_DIR / "BoxPR_curve.png",
        "Confusion Matrix (Norm)":RUN_DIR / "confusion_matrix_normalized.png",
        "F1 Curve":               RUN_DIR / "BoxF1_curve.png",
    }
    available = {k: v for k, v in chart_files.items() if v.exists()}
    if not available:
        return

    fig, axes = plt.subplots(2, 2, figsize=(11.69, 8.27))
    fig.patch.set_facecolor(BG)
    fig.suptitle("Training Diagnostics — Agri-Trust v2 (7-class)", fontsize=14,
                 fontweight="bold", color=TEXT, y=0.97)

    for ax, (title, path) in zip(axes.flat, available.items()):
        ax.set_facecolor(BG)
        try:
            img = plt.imread(str(path))
            ax.imshow(img)
        except Exception:
            ax.text(0.5, 0.5, "Image not found", ha="center", color=DIM)
        ax.set_title(title, color=TEXT, fontsize=10, pad=4)
        ax.axis("off")

    for ax in axes.flat[len(available):]:
        ax.set_visible(False)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# ═════════════════════════════════════════════════════════════════════════════
# PAGE 4 — Config + Speed + Recommendations
# ═════════════════════════════════════════════════════════════════════════════
def page_summary(pdf):
    fig = plt.figure(figsize=(11.69, 8.27))
    fig.patch.set_facecolor(BG)
    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.45, wspace=0.12,
                           left=0.04, right=0.96, top=0.88, bottom=0.05)
    fig.text(0.5, 0.94, "Training Configuration & Recommendations",
             ha="center", fontsize=15, fontweight="bold", color=TEXT)

    def card(pos, title, items, val_col=ACC):
        ax = fig.add_subplot(pos)
        ax.set_facecolor(CARD); ax.axis("off")
        for sp in ax.spines.values(): sp.set_edgecolor(ACC)
        ax.set_title(title, color=ACC, fontsize=11, fontweight="bold", pad=6)
        for i, (k, v) in enumerate(items.items()):
            y = 0.88 - i * (0.80 / max(len(items), 1))
            ax.text(0.03, y, f"• {k}:", color=DIM,   fontsize=9, transform=ax.transAxes, va="top")
            ax.text(0.97, y, v,         color=TEXT,  fontsize=9, transform=ax.transAxes, va="top", ha="right")
        return ax

    card(gs[0, 0], "⚙️  Training Configuration", TRAIN_CFG)
    card(gs[0, 1], "⚡ Inference Speed (RTX 2050)", SPEED, val_col=GREEN)

    # Class distribution mini bar
    ax_dist = fig.add_subplot(gs[1, 0])
    set_dark(fig, ax_dist)
    ax_dist.set_title("Training Instance Distribution", color=ACC, fontsize=11,
                      fontweight="bold", pad=6)
    names = [d[0] for d in PER_CLASS]
    inst  = [d[2] for d in PER_CLASS]
    cols  = [GRADE_COLOUR.get(d[1], RED) for d in PER_CLASS]
    bars  = ax_dist.barh(names, inst, color=cols, alpha=0.85)
    ax_dist.set_xlabel("Instances", color=DIM, fontsize=8)
    ax_dist.tick_params(labelsize=7.5)
    for bar, val in zip(bars, inst):
        ax_dist.text(bar.get_width()+200, bar.get_y()+bar.get_height()/2,
                     f"{val:,}", va="center", fontsize=7, color=DIM)
    ax_dist.set_xlim(0, max(inst)*1.18)

    # Recommendations
    ax_rec = fig.add_subplot(gs[1, 1])
    ax_rec.set_facecolor(CARD); ax_rec.axis("off")
    for sp in ax_rec.spines.values(): sp.set_edgecolor(RED)
    ax_rec.set_title("📋 Recommendations for v3", color=RED, fontsize=11,
                     fontweight="bold", pad=6)
    recs = [
        ("🔴 Critical", "fruit_cracking recall=0.61: collect ≥1,500 more samples"),
        ("🔴 Critical", "rotten recall=0.77: add hard-negative mining"),
        ("🟡 Improve",  "Upgrade to YOLOv8s for +3-5% mAP at same FPS target"),
        ("🟡 Improve",  "Try multi-scale training (multi_scale=0.5) for better recall"),
        ("🟢 Consider", "Re-add anthracnose with ≥2,000 new labeled samples"),
        ("🟢 Consider", "Use test-time augmentation (TTA) to boost mAP@50 further"),
        ("ℹ️  Deploy",  "Export best.pt → TensorRT FP16 on Jetson Nano"),
        ("ℹ️  Deploy",  "Set conf=0.25, target ≥15 FPS with tegrastats verify"),
    ]
    for i, (tag, txt) in enumerate(recs):
        y = 0.90 - i * 0.105
        col = RED if "Critical" in tag else (AMBER if "Improve" in tag else GREEN if "Consider" in tag else DIM)
        ax_rec.text(0.02, y, tag, color=col, fontsize=8, fontweight="bold",
                    transform=ax_rec.transAxes, va="top")
        ax_rec.text(0.28, y, txt, color=TEXT, fontsize=8,
                    transform=ax_rec.transAxes, va="top", wrap=True)

    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
def main():
    print(f"\n🍅 Generating Agri-Trust v2 Report (7-class, best epoch 139)...")
    with PdfPages(PDF_PATH) as pdf:
        meta = pdf.infodict()
        meta["Title"]   = "Agri-Trust v2 Model Training Report"
        meta["Author"]  = "Agri-Trust AI Pipeline"
        meta["Subject"] = "YOLOv8n Tomato Grading — 7 Classes"
        meta["Keywords"]= "YOLOv8, Tomato, Grading, Object Detection, Jetson Nano"

        print("  Page 1/4 — Cover...")
        page_cover(pdf)
        print("  Page 2/4 — Per-class Metrics...")
        page_metrics(pdf)
        print("  Page 3/4 — Training Charts...")
        page_charts(pdf)
        print("  Page 4/4 — Config & Recommendations...")
        page_summary(pdf)

    print(f"\n✅ Report saved → {PDF_PATH}")
    print(f"   Size: {PDF_PATH.stat().st_size / 1024:.0f} KB")

if __name__ == "__main__":
    main()

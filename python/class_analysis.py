# =============================================================================
# class_analysis.py
# Agri-Trust — Dataset Class Distribution Analyzer
#
# Scans the YOLO-format label files in dataset/train/labels/ to count
# bounding-box instances per class. Outputs:
#   • Console table with instance counts and percentages
#   • Bar chart saved to python/outputs/class_distribution.png
#   • Inverse-frequency class weights for cls_loss balancing
#
# Usage:
#   python class_analysis.py
#   python class_analysis.py --labels python/dataset/train/labels
# =============================================================================

import argparse
import os
from collections import Counter
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# ---------------------------------------------------------------------------
# Constants — must match data.yaml class order (alphabetical from Roboflow)
# ---------------------------------------------------------------------------
CLASS_NAMES = [
    "anthracnose",       # 0
    "blossom_end_rot",   # 1
    "brown_rugose",      # 2
    "fruit_cracking",    # 3
    "half_ripe",         # 4
    "mold",              # 5
    "ripe",              # 6
    "rotten",            # 7
    "sunscald",          # 8
    "unripe",            # 9
]

# Grade mapping (used in the legend for context)
GRADE_MAP = {
    "ripe":             "Grade A",
    "half_ripe":        "Grade B",
    "unripe":           "Grade C",
    "mold":             "Reject",
    "rotten":           "Reject",
    "anthracnose":      "Reject",
    "blossom_end_rot":  "Reject",
    "brown_rugose":     "Reject",
    "fruit_cracking":   "Reject",
    "sunscald":         "Reject",
}

# Colour per grade for the chart bars
GRADE_COLOURS = {
    "Grade A": "#27ae60",   # green
    "Grade B": "#f39c12",   # amber
    "Grade C": "#e67e22",   # orange
    "Reject":  "#e74c3c",   # red
}


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def count_instances(labels_dir: Path) -> Counter:
    """
    Count bounding-box instances per class from YOLO .txt label files.

    Args:
        labels_dir: Path to the directory containing *.txt label files.

    Returns:
        Counter mapping class_index (int) → instance count.
    """
    counts = Counter()

    txt_files = list(labels_dir.glob("*.txt"))
    if not txt_files:
        raise FileNotFoundError(
            f"No .txt label files found in: {labels_dir}\n"
            "Make sure the path points to the labels/ folder, not images/."
        )

    for txt_file in txt_files:
        with open(txt_file, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    class_idx = int(line.split()[0])
                    counts[class_idx] += 1

    return counts


def compute_class_weights(counts: Counter) -> dict:
    """
    Compute inverse-frequency class weights to compensate for imbalance.

    Formula: w_i = N_total / (n_classes * n_i)
    where n_i = instance count for class i.

    Rare classes get a higher weight; dominant classes get < 1.

    Returns:
        dict mapping class_name → weight (float, rounded to 4 dp).
    """
    n_classes = len(CLASS_NAMES)
    total = sum(counts[i] for i in range(n_classes))

    weights = {}
    for idx, name in enumerate(CLASS_NAMES):
        n_i = counts.get(idx, 0)
        if n_i == 0:
            weights[name] = 0.0  # class absent from training set
        else:
            weights[name] = round(total / (n_classes * n_i), 4)

    return weights


def print_report(counts: Counter, weights: dict) -> None:
    """Print a formatted console report."""
    total = sum(counts.values())

    header = f"{'Class':<20} {'Grade':<10} {'Instances':>10} {'%':>7} {'Weight':>8}"
    separator = "-" * len(header)

    print("\n" + "=" * len(header))
    print("  AGRI-TRUST — Class Distribution Report")
    print("=" * len(header))
    print(header)
    print(separator)

    for idx, name in enumerate(CLASS_NAMES):
        n = counts.get(idx, 0)
        pct = (n / total * 100) if total > 0 else 0.0
        grade = GRADE_MAP.get(name, "—")
        weight = weights.get(name, 0.0)

        flag = " ⚠️  RARE" if n < total * 0.03 else ""
        print(
            f"{name:<20} {grade:<10} {n:>10,} {pct:>6.1f}% {weight:>8.4f}{flag}"
        )

    print(separator)
    print(f"{'TOTAL':<20} {'':<10} {total:>10,} {'100.0%':>7}")
    print("=" * len(header))

    print("\n📋 Recommended cls_loss weight overrides (in train.py):")
    for name, w in weights.items():
        marker = " ← high-risk class" if name in ("mold", "rotten", "anthracnose") else ""
        print(f"   {name:<22}: {w:.4f}{marker}")


def plot_distribution(counts: Counter, output_path: Path) -> None:
    """Save a colour-coded bar chart of class distribution."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    names = CLASS_NAMES
    values = [counts.get(i, 0) for i in range(len(names))]
    colours = [GRADE_COLOURS[GRADE_MAP[n]] for n in names]

    fig, ax = plt.subplots(figsize=(14, 6))
    bars = ax.bar(names, values, color=colours, edgecolor="white", linewidth=0.8)

    # Value labels on bars
    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(values) * 0.01,
            f"{val:,}",
            ha="center", va="bottom", fontsize=9, fontweight="bold",
        )

    ax.set_title(
        "Agri-Trust — Training Set Class Distribution",
        fontsize=14, fontweight="bold", pad=15,
    )
    ax.set_xlabel("Class", fontsize=11)
    ax.set_ylabel("Bounding-Box Instances", fontsize=11)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
    ax.tick_params(axis="x", rotation=30)

    # Legend for grade colours
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor=GRADE_COLOURS["Grade A"], label="Grade A (ripe)"),
        Patch(facecolor=GRADE_COLOURS["Grade B"], label="Grade B (half_ripe)"),
        Patch(facecolor=GRADE_COLOURS["Grade C"], label="Grade C (unripe)"),
        Patch(facecolor=GRADE_COLOURS["Reject"],  label="Reject (defects)"),
    ]
    ax.legend(handles=legend_elements, loc="upper right", framealpha=0.9)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n✅ Chart saved → {output_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Agri-Trust class distribution analyzer"
    )
    parser.add_argument(
        "--labels",
        type=str,
        default=str(
            Path(__file__).parent / "dataset" / "train" / "labels"
        ),
        help="Path to training labels directory (default: dataset/train/labels)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(Path(__file__).parent / "outputs" / "class_distribution.png"),
        help="Path to save the distribution chart PNG",
    )
    args = parser.parse_args()

    labels_dir = Path(args.labels)
    output_path = Path(args.output)

    print(f"\n🔍 Scanning labels: {labels_dir}")
    counts = count_instances(labels_dir)
    weights = compute_class_weights(counts)

    print_report(counts, weights)
    plot_distribution(counts, output_path)

    # Also return weights for programmatic use from train.py
    return weights


if __name__ == "__main__":
    main()

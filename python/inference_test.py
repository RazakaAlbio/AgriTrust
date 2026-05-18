# =============================================================================
# inference_test.py
# Agri-Trust — Standalone Inference & Tomato Grading Script
#
# Features:
#   • Accepts images, videos, or entire folders as input
#   • Grading logic with colour-coded overlays:
#       Grade A → ripe          (green)
#       Grade B → half_ripe     (yellow)
#       Grade C → unripe        (orange)
#       Reject  → 7 defect classes (red + ⚠ warning)
#   • Per-frame inference latency logger (ms) with CSV export
#   • Summary statistics: mean, P95, max latency
#   • Annotated output saved to python/tests/output/
#
# Usage:
#   python inference_test.py --source python/tests/sample.jpg
#   python inference_test.py --source python/tests/ --model runs/agritrust_v1/weights/best.pt
#   python inference_test.py --source python/tests/video.mp4 --conf 0.35
# =============================================================================

import argparse
import csv
import time
from pathlib import Path
import sys

import cv2
import numpy as np

# Ensure project root on path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Must match data.yaml alphabetical order
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

# Grading rules (name-based, not index-based for safety)
GRADE_CONFIG = {
    "ripe": {
        "grade":  "Grade A",
        "symbol": "✓",
        "color":  (34, 197, 94),    # RGB green
        "bgr":    (94, 197, 34),    # BGR for OpenCV
    },
    "half_ripe": {
        "grade":  "Grade B",
        "symbol": "~",
        "color":  (234, 179, 8),    # RGB amber
        "bgr":    (8, 179, 234),
    },
    "unripe": {
        "grade":  "Grade C",
        "symbol": "○",
        "color":  (249, 115, 22),   # RGB orange
        "bgr":    (22, 115, 249),
    },
    # All defect classes → Reject
    "mold":             {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "rotten":           {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "anthracnose":      {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "blossom_end_rot":  {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "brown_rugose":     {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "fruit_cracking":   {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
    "sunscald":         {"grade": "Reject", "symbol": "✗", "bgr": (0, 0, 220)},
}

# High-risk defects get an extra ⚠ prefix on the label
HIGH_RISK = {"mold", "rotten", "anthracnose"}

# Grade box background colours (BGR)
GRADE_BOX_COLOURS = {
    "Grade A": (40, 167, 69),    # green
    "Grade B": (40, 167, 220),   # amber  (appears correct in BGR space)
    "Grade C": (0, 120, 230),    # orange
    "Reject":  (0, 0, 200),      # red
}

# Supported image extensions
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}


# ---------------------------------------------------------------------------
# Argument Parser
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Agri-Trust — YOLOv8 Tomato Grading Inference",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--source", type=str, required=True,
        help="Input: image path, video path, or folder of images"
    )
    parser.add_argument(
        "--model", type=str,
        default=str(PROJECT_ROOT / "runs" / "agritrust_v1" / "weights" / "best.pt"),
        help="Path to trained YOLOv8 .pt weights"
    )
    parser.add_argument(
        "--conf", type=float, default=0.30,
        help="Confidence threshold (0–1)"
    )
    parser.add_argument(
        "--iou", type=float, default=0.70,
        help="NMS IoU threshold"
    )
    parser.add_argument(
        "--imgsz", type=int, default=640,
        help="Inference image size"
    )
    parser.add_argument(
        "--output-dir", type=str,
        default=str(PROJECT_ROOT / "tests" / "output"),
        help="Directory to save annotated results"
    )
    parser.add_argument(
        "--no-save", action="store_true",
        help="Do not save annotated output files"
    )
    parser.add_argument(
        "--show", action="store_true",
        help="Display results in a window (requires display)"
    )
    parser.add_argument(
        "--device", type=str, default=None,
        help="Device: '0' (GPU), 'cpu'. Auto-detects if omitted."
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Overlay Drawing
# ---------------------------------------------------------------------------

def draw_grade_overlay(
    frame: np.ndarray,
    box: tuple,
    class_name: str,
    confidence: float,
) -> np.ndarray:
    """
    Draw a colour-coded bounding box with grade label on the frame.

    Args:
        frame      : BGR numpy image.
        box        : (x1, y1, x2, y2) pixel coordinates.
        class_name : Detected class name.
        confidence : Detection confidence (0–1).

    Returns:
        Annotated frame (modified in-place and returned).
    """
    cfg = GRADE_CONFIG.get(class_name, {
        "grade": "Unknown", "symbol": "?", "bgr": (128, 128, 128)
    })

    grade    = cfg["grade"]
    symbol   = cfg["symbol"]
    box_bgr  = cfg["bgr"]
    warn_pfx = "⚠ " if class_name in HIGH_RISK else ""

    x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])

    # ── Bounding Box ─────────────────────────────────────────────────────────
    thickness = 3 if grade == "Reject" else 2
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_bgr, thickness)

    # ── Label Background ─────────────────────────────────────────────────────
    label_top = f"{warn_pfx}{grade}  {symbol}"
    label_bot = f"{class_name}  {confidence:.0%}"

    font       = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    font_thick = 1
    pad        = 5

    (w_top, h_top), _ = cv2.getTextSize(label_top, font, font_scale, font_thick)
    (w_bot, h_bot), _ = cv2.getTextSize(label_bot, font, font_scale, font_thick)

    label_w = max(w_top, w_bot) + pad * 2
    label_h = h_top + h_bot + pad * 3

    # Ensure label stays within frame
    lx1 = max(0, x1)
    ly1 = max(0, y1 - label_h - 2)
    lx2 = min(frame.shape[1], lx1 + label_w)
    ly2 = ly1 + label_h

    cv2.rectangle(frame, (lx1, ly1), (lx2, ly2), box_bgr, cv2.FILLED)

    # Text colour: white for Reject/Grade C, black for Grade A/B (better contrast)
    text_colour = (255, 255, 255) if grade in ("Reject", "Grade C") else (0, 0, 0)

    cv2.putText(
        frame, label_top,
        (lx1 + pad, ly1 + pad + h_top),
        font, font_scale, text_colour, font_thick, cv2.LINE_AA,
    )
    cv2.putText(
        frame, label_bot,
        (lx1 + pad, ly1 + pad * 2 + h_top + h_bot),
        font, font_scale, text_colour, font_thick, cv2.LINE_AA,
    )

    return frame


# ---------------------------------------------------------------------------
# Latency Logger
# ---------------------------------------------------------------------------

class LatencyLogger:
    """Records per-frame inference latency and exports a summary CSV."""

    def __init__(self, output_csv: Path):
        self.output_csv = output_csv
        self.records: list[dict] = []

    def log(
        self,
        frame_id: int,
        source: str,
        preprocess_ms: float,
        inference_ms: float,
        postprocess_ms: float,
        n_detections: int,
    ) -> None:
        total_ms = preprocess_ms + inference_ms + postprocess_ms
        self.records.append({
            "frame_id":       frame_id,
            "source":         source,
            "preprocess_ms":  round(preprocess_ms, 2),
            "inference_ms":   round(inference_ms, 2),
            "postprocess_ms": round(postprocess_ms, 2),
            "total_ms":       round(total_ms, 2),
            "fps_equiv":      round(1000.0 / total_ms, 1) if total_ms > 0 else 0.0,
            "n_detections":   n_detections,
        })

    def save(self) -> None:
        if not self.records:
            return
        self.output_csv.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=self.records[0].keys())
            writer.writeheader()
            writer.writerows(self.records)
        print(f"\n✅ Latency log saved → {self.output_csv}")

    def print_summary(self) -> None:
        if not self.records:
            return
        totals = [r["total_ms"] for r in self.records]
        n = len(totals)
        mean_ms  = np.mean(totals)
        p95_ms   = np.percentile(totals, 95)
        max_ms   = np.max(totals)
        mean_fps = 1000.0 / mean_ms if mean_ms > 0 else 0.0

        rt_ok = "✅ Yes" if mean_fps >= 15.0 else "⚠️  No (target ≥ 15 FPS)"

        print("\n" + "=" * 52)
        print("  Agri-Trust — Inference Latency Summary")
        print("=" * 52)
        print(f"  Frames processed : {n:,}")
        print(f"  Mean latency     : {mean_ms:.1f} ms  ({mean_fps:.1f} FPS)")
        print(f"  P95  latency     : {p95_ms:.1f} ms")
        print(f"  Max  latency     : {max_ms:.1f} ms")
        print(f"  Real-time ready  : {rt_ok}")
        print("=" * 52)


# ---------------------------------------------------------------------------
# Source Resolver
# ---------------------------------------------------------------------------

def resolve_sources(source: str) -> tuple[list[Path], str]:
    """
    Resolve the --source argument to a list of file paths and a type tag.

    Returns:
        (list of Paths, type_tag)  where type_tag ∈ {'image', 'video', 'mixed'}
    """
    p = Path(source)
    if not p.exists():
        raise FileNotFoundError(f"Source not found: {source}")

    if p.is_file():
        if p.suffix.lower() in IMAGE_EXTS:
            return [p], "image"
        elif p.suffix.lower() in VIDEO_EXTS:
            return [p], "video"
        else:
            raise ValueError(f"Unsupported file type: {p.suffix}")

    # Directory: collect all images and videos
    files = []
    for ext in IMAGE_EXTS | VIDEO_EXTS:
        files.extend(p.glob(f"*{ext}"))
        files.extend(p.glob(f"*{ext.upper()}"))
    files = sorted(set(files))

    if not files:
        raise FileNotFoundError(f"No supported files found in: {source}")

    types = set(
        "image" if f.suffix.lower() in IMAGE_EXTS else "video" for f in files
    )
    return files, "mixed" if len(types) > 1 else types.pop()


# ---------------------------------------------------------------------------
# Inference Engine
# ---------------------------------------------------------------------------

def run_inference(
    model,
    source_files: list[Path],
    source_type: str,
    output_dir: Path,
    conf: float,
    iou: float,
    imgsz: int,
    save: bool,
    show: bool,
    device: str,
    logger: LatencyLogger,
) -> None:
    """Run inference on all source files with grading overlays."""

    output_dir.mkdir(parents=True, exist_ok=True)
    frame_counter = 0

    for src_path in source_files:
        print(f"\n📂 Processing: {src_path.name}")

        is_video = src_path.suffix.lower() in VIDEO_EXTS

        if is_video:
            cap = cv2.VideoCapture(str(src_path))
            fps_native = cap.get(cv2.CAP_PROP_FPS) or 30.0
            width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            writer = None
            if save:
                out_path = output_dir / f"{src_path.stem}_graded.mp4"
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                writer = cv2.VideoWriter(str(out_path), fourcc, fps_native, (width, height))

            frame_idx = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                annotated, lat = process_frame(
                    model, frame, conf, iou, imgsz, device
                )
                logger.log(
                    frame_id=frame_counter,
                    source=src_path.name,
                    preprocess_ms=lat["preprocess"],
                    inference_ms=lat["inference"],
                    postprocess_ms=lat["postprocess"],
                    n_detections=lat["n_det"],
                )

                if show:
                    cv2.imshow("Agri-Trust Grading", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                if writer:
                    writer.write(annotated)

                frame_idx += 1
                frame_counter += 1

                if frame_idx % 30 == 0:
                    print(
                        f"  Frame {frame_idx}/{total_frames}  "
                        f"| Latency: {lat['total']:.1f} ms"
                    )

            cap.release()
            if writer:
                writer.release()
                print(f"  ✅ Saved → {out_path}")

        else:
            # Static image
            frame = cv2.imread(str(src_path))
            if frame is None:
                print(f"  ⚠️  Could not read: {src_path}")
                continue

            annotated, lat = process_frame(
                model, frame, conf, iou, imgsz, device
            )
            logger.log(
                frame_id=frame_counter,
                source=src_path.name,
                preprocess_ms=lat["preprocess"],
                inference_ms=lat["inference"],
                postprocess_ms=lat["postprocess"],
                n_detections=lat["n_det"],
            )

            print(
                f"  Latency: {lat['total']:.1f} ms  "
                f"| Detections: {lat['n_det']}"
            )

            if save:
                out_path = output_dir / f"{src_path.stem}_graded{src_path.suffix}"
                cv2.imwrite(str(out_path), annotated)
                print(f"  ✅ Saved → {out_path}")

            if show:
                cv2.imshow(f"Agri-Trust — {src_path.name}", annotated)
                cv2.waitKey(0)
                cv2.destroyAllWindows()

            frame_counter += 1

    if show:
        cv2.destroyAllWindows()


def process_frame(
    model,
    frame: np.ndarray,
    conf: float,
    iou: float,
    imgsz: int,
    device: str,
) -> tuple[np.ndarray, dict]:
    """
    Run YOLOv8 on a single frame and draw grade overlays.

    Returns:
        (annotated_frame, latency_dict)
    """
    import torch

    # ── Pre-process timing ────────────────────────────────────────────────────
    t0 = time.perf_counter()
    # Ultralytics handles preprocessing internally; we measure the full call
    t1 = time.perf_counter()

    # ── Inference ────────────────────────────────────────────────────────────
    t_inf_start = time.perf_counter()
    results = model.predict(
        source=frame,
        conf=conf,
        iou=iou,
        imgsz=imgsz,
        device=device,
        verbose=False,
    )
    t_inf_end = time.perf_counter()

    # ── Post-process: draw overlays ──────────────────────────────────────────
    t_post_start = time.perf_counter()

    annotated = frame.copy()
    result = results[0]
    n_det = 0

    if result.boxes is not None and len(result.boxes) > 0:
        boxes  = result.boxes.xyxy.cpu().numpy()    # (N, 4)
        confs  = result.boxes.conf.cpu().numpy()    # (N,)
        clsids = result.boxes.cls.cpu().numpy().astype(int)  # (N,)

        n_det = len(boxes)
        for box, conf_val, cls_id in zip(boxes, confs, clsids):
            cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"
            annotated = draw_grade_overlay(annotated, box, cls_name, conf_val)

    t_post_end = time.perf_counter()

    # Extract Ultralytics' own speed breakdown if available
    speed = getattr(result, "speed", {})
    pre_ms  = speed.get("preprocess", (t1 - t0) * 1000)
    inf_ms  = speed.get("inference",  (t_inf_end - t_inf_start) * 1000)
    post_ms = speed.get("postprocess", (t_post_end - t_post_start) * 1000)
    total_ms = pre_ms + inf_ms + post_ms

    return annotated, {
        "preprocess":  pre_ms,
        "inference":   inf_ms,
        "postprocess": post_ms,
        "total":       total_ms,
        "n_det":       n_det,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    # ── Model loading ─────────────────────────────────────────────────────────
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"❌ Model not found: {model_path}")
        print("   Train first with: python train.py")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    import torch
    device = args.device
    if device is None:
        device = "0" if torch.cuda.is_available() else "cpu"

    print(f"\n🍅 Agri-Trust — Inference Engine")
    print(f"   Model  : {model_path}")
    print(f"   Source : {args.source}")
    print(f"   Device : {device}  |  Conf: {args.conf}  |  IoU: {args.iou}\n")

    model = YOLO(str(model_path))

    # ── Source resolution ─────────────────────────────────────────────────────
    try:
        source_files, source_type = resolve_sources(args.source)
    except (FileNotFoundError, ValueError) as e:
        print(f"❌ {e}")
        sys.exit(1)

    print(f"📁 Found {len(source_files)} file(s) | Type: {source_type}")

    # ── Latency logger setup ──────────────────────────────────────────────────
    output_dir = Path(args.output_dir)
    latency_csv = output_dir / "latency_log.csv"
    logger = LatencyLogger(latency_csv)

    # ── Run inference ─────────────────────────────────────────────────────────
    run_inference(
        model=model,
        source_files=source_files,
        source_type=source_type,
        output_dir=output_dir,
        conf=args.conf,
        iou=args.iou,
        imgsz=args.imgsz,
        save=not args.no_save,
        show=args.show,
        device=device,
        logger=logger,
    )

    # ── Report ────────────────────────────────────────────────────────────────
    logger.print_summary()
    logger.save()


if __name__ == "__main__":
    main()

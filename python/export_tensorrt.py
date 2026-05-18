# =============================================================================
# export_tensorrt.py
# Agri-Trust — TensorRT FP16 Export Script for NVIDIA Jetson Nano
#
# Pipeline:
#   1. Platform check (warns if not running on Jetson / Linux CUDA machine)
#   2. Load trained best.pt
#   3. Export to ONNX (intermediate, validated)
#   4. Export to TensorRT engine (FP16 quantisation)
#   5. Validate TensorRT engine with a dummy inference
#   6. Print file sizes and estimated FPS
#
# ⚠️  IMPORTANT: Run this script ON THE JETSON NANO itself (or a machine
#     with the exact same CUDA + TensorRT version). A TensorRT engine is
#     NOT portable between machines or CUDA versions.
#
# Usage (on Jetson Nano):
#   conda activate agritrust
#   python export_tensorrt.py
#   python export_tensorrt.py --weights runs/agritrust_v1/weights/best.pt
#   python export_tensorrt.py --weights best.pt --imgsz 320   # faster on Jetson
# =============================================================================

import argparse
import platform
import sys
import time
from pathlib import Path

# Ensure project root on path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

EXPORTS_DIR = PROJECT_ROOT / "exports"


# ---------------------------------------------------------------------------
# Argument Parser
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Agri-Trust — TensorRT FP16 Export for Jetson Nano",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--weights", type=str,
        default=str(PROJECT_ROOT / "runs" / "agritrust_v1" / "weights" / "best.pt"),
        help="Path to trained YOLOv8 .pt weights"
    )
    parser.add_argument(
        "--imgsz", type=int, default=640,
        help="Input image size for TensorRT engine"
    )
    parser.add_argument(
        "--batch", type=int, default=1,
        help="Batch size for TensorRT engine (1 for real-time single-frame)"
    )
    parser.add_argument(
        "--workspace", type=int, default=4,
        help="TensorRT workspace size in GB (use 2 for Jetson Nano 4GB)"
    )
    parser.add_argument(
        "--skip-onnx-validate", action="store_true",
        help="Skip ONNX model validation step"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Skip platform check and force export (use with caution)"
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Platform Check
# ---------------------------------------------------------------------------

def check_platform(force: bool = False) -> bool:
    """
    Warn the user if this script is not running on the target Jetson platform.

    Returns:
        True if safe to proceed, False if should abort.
    """
    system = platform.system()
    machine = platform.machine()
    is_jetson = (system == "Linux" and machine == "aarch64")
    is_linux_x86 = (system == "Linux" and "64" in machine)

    print("\n" + "=" * 60)
    print("  Platform Check")
    print("=" * 60)
    print(f"  OS      : {system}")
    print(f"  Arch    : {machine}")

    if is_jetson:
        print("  Status  : ✅ Running on ARM64/aarch64 (Jetson detected)")
        print("  NOTE    : Engine will be optimised for this Jetson device.")
    elif is_linux_x86:
        print("  Status  : ⚠️  Running on Linux x86_64")
        print(
            "  WARNING : Engine will be built for this x86 GPU.\n"
            "            It will NOT run on Jetson Nano.\n"
            "            Transfer best.pt to Jetson and run this script there."
        )
        if not force:
            answer = input("\n  Continue anyway? (y/N): ").strip().lower()
            if answer != "y":
                print("  Aborted. Transfer best.pt to Jetson and re-run.")
                return False
    else:
        print(f"  Status  : 🔴 Non-Linux platform ({system})")
        print(
            "  WARNING : TensorRT is only supported on Linux (NVIDIA CUDA).\n"
            "            On Windows, TensorRT export is not supported by Ultralytics.\n"
            "            → Transfer best.pt to Jetson Nano and run this script there.\n"
            "            → Alternatively, export to ONNX below for cross-platform use."
        )
        if not force:
            answer = input("\n  Export ONNX only instead? (Y/n): ").strip().lower()
            if answer == "n":
                print("  Aborted.")
                return False
            print("  Will export ONNX only.")
            return "onnx_only"

    print("=" * 60)
    return True


# ---------------------------------------------------------------------------
# ONNX Export & Validation
# ---------------------------------------------------------------------------

def export_onnx(model, imgsz: int, batch: int) -> Path:
    """
    Export the YOLOv8 model to ONNX format.

    Args:
        model : Ultralytics YOLO object.
        imgsz : Input image size.
        batch : Batch size.

    Returns:
        Path to the exported .onnx file.
    """
    print("\n[1/4] Exporting to ONNX...")
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

    onnx_path = model.export(
        format="onnx",
        imgsz=imgsz,
        batch=batch,
        dynamic=False,          # Fixed-shape for Jetson TensorRT compatibility
        simplify=True,          # ONNX graph simplification
        opset=17,               # Opset 17 recommended for TensorRT 8.x
        half=False,             # FP32 for ONNX; FP16 applied at TensorRT stage
    )

    onnx_path = Path(onnx_path)
    # Move to exports dir
    dest = EXPORTS_DIR / onnx_path.name
    if onnx_path != dest:
        import shutil
        shutil.copy2(onnx_path, dest)
        onnx_path = dest

    size_mb = onnx_path.stat().st_size / 1e6
    print(f"  ✅ ONNX saved → {onnx_path}  ({size_mb:.1f} MB)")
    return onnx_path


def validate_onnx(onnx_path: Path, imgsz: int) -> None:
    """Run a dummy inference through the ONNX model to confirm it's valid."""
    try:
        import onnx
        import onnxruntime as ort
        import numpy as np

        print("\n[2/4] Validating ONNX model...")

        # Check model structure
        onnx_model = onnx.load(str(onnx_path))
        onnx.checker.check_model(onnx_model)
        print("  ✅ ONNX graph check passed")

        # Run dummy inference
        session = ort.InferenceSession(
            str(onnx_path),
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        inp_name = session.get_inputs()[0].name
        dummy = np.zeros((1, 3, imgsz, imgsz), dtype=np.float32)
        outputs = session.run(None, {inp_name: dummy})
        print(f"  ✅ ONNX inference passed  | Output shape: {outputs[0].shape}")

    except ImportError:
        print("  ⚠️  onnx or onnxruntime not installed — skipping ONNX validation")
    except Exception as e:
        print(f"  ❌ ONNX validation failed: {e}")


# ---------------------------------------------------------------------------
# TensorRT Export
# ---------------------------------------------------------------------------

def export_tensorrt(model, imgsz: int, batch: int, workspace_gb: int) -> Path:
    """
    Export the YOLOv8 model to a TensorRT FP16 engine.

    Args:
        model         : Ultralytics YOLO object.
        imgsz         : Input image size.
        batch         : Batch size.
        workspace_gb  : TensorRT workspace allocation in GB.

    Returns:
        Path to the exported .engine file.
    """
    print(f"\n[3/4] Exporting to TensorRT FP16 engine...")
    print(f"      imgsz={imgsz}  batch={batch}  workspace={workspace_gb}GB")
    print("      ⏳ This may take 5–30 minutes on first run (engine build)...")

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    t_start = time.time()

    engine_path = model.export(
        format="engine",         # TensorRT
        imgsz=imgsz,
        batch=batch,
        half=True,               # FP16 quantisation for Jetson GPU acceleration
        device=0,                # Must use GPU for TensorRT export
        workspace=workspace_gb,  # GB allocated for TensorRT optimisation
        simplify=True,
        dynamic=False,           # Fixed-shape engine (required for FP16)
    )

    elapsed = time.time() - t_start
    engine_path = Path(engine_path)

    # Move to exports dir
    dest = EXPORTS_DIR / engine_path.name
    if engine_path != dest:
        import shutil
        shutil.copy2(engine_path, dest)
        engine_path = dest

    size_mb = engine_path.stat().st_size / 1e6
    print(f"  ✅ TensorRT engine saved → {engine_path}")
    print(f"     Size    : {size_mb:.1f} MB")
    print(f"     Build time: {elapsed:.0f} s")
    return engine_path


# ---------------------------------------------------------------------------
# TensorRT Validation
# ---------------------------------------------------------------------------

def validate_tensorrt(engine_path: Path, imgsz: int) -> None:
    """Load the TensorRT engine and run a timed dummy inference."""
    print("\n[4/4] Validating TensorRT engine...")
    try:
        from ultralytics import YOLO
        import numpy as np

        trt_model = YOLO(str(engine_path))
        dummy_img = np.zeros((imgsz, imgsz, 3), dtype=np.uint8)

        # Warm-up runs (first inference is slower due to CUDA initialisation)
        print("  Running 3 warm-up inferences...")
        for _ in range(3):
            trt_model.predict(dummy_img, verbose=False)

        # Benchmark 10 frames
        times_ms = []
        for _ in range(10):
            t0 = time.perf_counter()
            trt_model.predict(dummy_img, verbose=False)
            t1 = time.perf_counter()
            times_ms.append((t1 - t0) * 1000)

        mean_ms  = sum(times_ms) / len(times_ms)
        mean_fps = 1000.0 / mean_ms

        print(f"\n  ✅ TensorRT engine validated")
        print(f"     Mean latency : {mean_ms:.1f} ms")
        print(f"     Throughput   : {mean_fps:.1f} FPS  (target ≥ 15 FPS)")
        if mean_fps >= 15.0:
            print("     Status       : ✅ Real-time capable!")
        else:
            print(
                "     Status       : ⚠️  Below 15 FPS.\n"
                "     Suggestions  :\n"
                "       • Reduce --imgsz to 320\n"
                "       • Use --batch 1 (already default)\n"
                "       • Ensure GPU mode is active (sudo nvpmodel -m 0)"
            )
    except Exception as e:
        print(f"  ❌ TensorRT validation failed: {e}")


# ---------------------------------------------------------------------------
# Summary Printer
# ---------------------------------------------------------------------------

def print_deployment_guide(exports_dir: Path, engine_name: str, imgsz: int) -> None:
    """Print actionable next steps for Jetson deployment."""
    print("\n" + "=" * 60)
    print("  📦 Deployment Guide — Jetson Nano")
    print("=" * 60)
    print()
    print("  1. Transfer files to Jetson Nano:")
    print(f"     scp {exports_dir}/{engine_name} user@jetson:/home/user/agritrust/")
    print(f"     scp python/inference_test.py user@jetson:/home/user/agritrust/")
    print()
    print("  2. On Jetson Nano:")
    print("     sudo nvpmodel -m 0        # Max performance mode")
    print("     sudo jetson_clocks        # Lock clocks for stable FPS")
    print()
    print("  3. Run inference:")
    print(f"     python inference_test.py \\")
    print(f"       --model /home/user/agritrust/{engine_name} \\")
    print(f"       --source /dev/video0 \\  # Pi Cam stream")
    print(f"       --imgsz {imgsz}")
    print()
    print("  4. Monitor GPU:")
    print("     tegrastats")
    print()
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    print("=" * 60)
    print("  🍅 Agri-Trust — TensorRT FP16 Export")
    print("=" * 60)
    print(f"  Weights  : {args.weights}")
    print(f"  Image sz : {args.imgsz}")
    print(f"  Batch    : {args.batch}")
    print(f"  FP16     : Yes (TensorRT)")
    print(f"  Workspace: {args.workspace} GB")

    # ── Platform check ──────────────────────────────────────────────────────
    platform_result = check_platform(force=args.force)
    if platform_result is False:
        sys.exit(0)

    onnx_only = (platform_result == "onnx_only")

    # ── Load model ──────────────────────────────────────────────────────────
    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"\n❌ Weights not found: {weights_path}")
        print("   Train first: python train.py")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    print(f"\n📦 Loading weights: {weights_path}")
    model = YOLO(str(weights_path))

    # ── ONNX export ─────────────────────────────────────────────────────────
    onnx_path = export_onnx(model, args.imgsz, args.batch)

    if not args.skip_onnx_validate:
        validate_onnx(onnx_path, args.imgsz)

    if onnx_only:
        print("\n✅ ONNX export complete (TensorRT skipped on non-Linux platform).")
        print(f"   Transfer {onnx_path} and best.pt to Jetson Nano,")
        print("   then run this script on the Jetson to build the TRT engine.")
        return

    # ── TensorRT export ─────────────────────────────────────────────────────
    engine_path = export_tensorrt(
        model, args.imgsz, args.batch, args.workspace
    )

    validate_tensorrt(engine_path, args.imgsz)

    print_deployment_guide(EXPORTS_DIR, engine_path.name, args.imgsz)


if __name__ == "__main__":
    main()

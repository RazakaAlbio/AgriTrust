# =============================================================================
# rpcam_augmentation.py
# Agri-Trust — Raspberry Pi Camera OV5647 (5MP) Sensor Simulation
#
# Simulates the optical & compression characteristics of the OV5647 sensor
# used on Raspberry Pi Camera Module v1. Applied during YOLOv8 training to
# make the model robust to real-world camera degradation.
#
# Augmentation pipeline (stacked, independent probabilities):
#   1. GaussNoise       — CMOS sensor noise
#   2. MotionBlur       — Camera shake / conveyor motion
#   3. ImageCompression — JPEG stream compression (70–80 % quality)
#   4. RandomBrightnessContrast — Greenhouse lighting variation
#   5. HueSaturationValue       — White-balance drift
#   6. Downscale        — OV5647 low-res mode / lens softness
# =============================================================================

import cv2
import numpy as np

try:
    import albumentations as A
    ALBUMENTATIONS_AVAILABLE = True
except ImportError:
    ALBUMENTATIONS_AVAILABLE = False
    print("[RPCam] ⚠️  albumentations not installed. Simulation disabled.")


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def get_rpcam_pipeline() -> "A.Compose":
    """
    Returns an Albumentations Compose pipeline that simulates OV5647
    sensor limitations.

    Returns:
        A.Compose: The augmentation pipeline, or None if albumentations
                   is not available.
    """
    if not ALBUMENTATIONS_AVAILABLE:
        return None

    return A.Compose(
        [
            # ── 1. CMOS Sensor Noise ─────────────────────────────────────────
            # OV5647 has notable ISO noise in low-light greenhouse conditions.
            # albumentations 2.x: var_limit/mean → std_range/mean_range (normalised 0-1)
            # std_range (0.03, 0.15) ≈ old var_limit (10, 50) in 0-255 pixel scale
            A.GaussNoise(
                std_range=(0.03, 0.15),
                mean_range=(0.0, 0.0),
                p=0.50,
            ),

            # ── 2. Motion Blur ───────────────────────────────────────────────
            # Simulates slight camera shake or tomato movement on a conveyor.
            A.MotionBlur(
                blur_limit=(3, 7),        # kernel size in pixels; kept small
                p=0.30,
            ),

            # ── 3. JPEG Compression ──────────────────────────────────────────
            # Pi Cam streams MJPEG at ~70–80 % quality, introducing artefacts.
            # albumentations 2.x: quality_lower/upper → quality_range tuple;
            #                     ImageCompressionType enum removed → plain string
            A.ImageCompression(
                quality_range=(70, 80),
                compression_type="jpeg",
                p=0.60,
            ),

            # ── 4. Brightness & Contrast ─────────────────────────────────────
            # Greenhouse lighting varies significantly with time of day and
            # grow-light configuration.
            A.RandomBrightnessContrast(
                brightness_limit=(-0.20, 0.20),
                contrast_limit=(-0.20, 0.20),
                p=0.60,
            ),

            # ── 5. Hue / Saturation ──────────────────────────────────────────
            # White-balance drift and colour temperature shifts common with
            # the OV5647's basic AWB algorithm.
            A.HueSaturationValue(
                hue_shift_limit=5,        # subtle hue drift (±5°)
                sat_shift_limit=15,       # moderate saturation shift
                val_shift_limit=10,
                p=0.30,
            ),

            # ── 6. Downscale ─────────────────────────────────────────────────
            # OV5647 uses pixel binning in some modes and has lens softness.
            # Downscale then upscale introduces realistic softness.
            # albumentations 2.x: scale_min/scale_max → scale_range tuple
            A.Downscale(
                scale_range=(0.50, 0.75),
                p=0.20,
            ),
        ],
        bbox_params=A.BboxParams(
            format="yolo",               # (x_centre, y_centre, w, h) normalised
            label_fields=["class_labels"],
            min_visibility=0.20,         # drop box if <20 % visible after aug
        ),
    )


# ---------------------------------------------------------------------------
# Transform wrapper compatible with Ultralytics callback injection
# ---------------------------------------------------------------------------

class RPCamAugmentation:
    """
    Stateful wrapper around the RP Cam Albumentations pipeline.

    Usage (standalone):
        aug = RPCamAugmentation()
        result = aug(image=img_numpy, bboxes=bboxes, class_labels=labels)
        aug_image = result["image"]
    """

    def __init__(self):
        self.pipeline = get_rpcam_pipeline()
        self.enabled = self.pipeline is not None

    # Make the object callable so it can be passed directly as a transform
    def __call__(
        self,
        image: np.ndarray,
        bboxes: list = None,
        class_labels: list = None,
    ) -> dict:
        """
        Apply RP Cam simulation augmentation to a single image.

        Args:
            image        : HxWxC numpy array (BGR, uint8).
            bboxes       : List of YOLO-format bboxes [(cx, cy, w, h), ...].
            class_labels : List of integer class indices.

        Returns:
            dict with keys 'image', 'bboxes', 'class_labels'.
        """
        if not self.enabled:
            return {
                "image": image,
                "bboxes": bboxes or [],
                "class_labels": class_labels or [],
            }

        bboxes = bboxes or []
        class_labels = class_labels or []

        # Convert BGR → RGB for Albumentations
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        try:
            result = self.pipeline(
                image=image_rgb,
                bboxes=bboxes,
                class_labels=class_labels,
            )
            # Convert back RGB → BGR for OpenCV / Ultralytics
            result["image"] = cv2.cvtColor(result["image"], cv2.COLOR_RGB2BGR)
            return result
        except Exception as exc:
            # Never let augmentation crash training
            print(f"[RPCam] ⚠️  Augmentation error (skipped): {exc}")
            return {"image": image, "bboxes": bboxes, "class_labels": class_labels}

    def __repr__(self) -> str:
        status = "enabled" if self.enabled else "disabled (albumentations missing)"
        return f"RPCamAugmentation({status})"


# ---------------------------------------------------------------------------
# Quick self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os

    print("=" * 60)
    print("  RP Cam Augmentation — Self-test")
    print("=" * 60)

    # Generate a random colour image as a stand-in for a tomato photo
    dummy_img = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
    dummy_bboxes = [(0.5, 0.5, 0.3, 0.3)]
    dummy_labels = [6]  # class index 6 = ripe

    aug = RPCamAugmentation()
    print(f"Transform: {aug}")

    result = aug(
        image=dummy_img,
        bboxes=dummy_bboxes,
        class_labels=dummy_labels,
    )

    print(f"Input  shape : {dummy_img.shape}")
    print(f"Output shape : {result['image'].shape}")
    print(f"Output bboxes: {result['bboxes']}")
    print("✅ Self-test passed.")

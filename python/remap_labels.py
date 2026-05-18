# =============================================================================
# remap_labels.py
# Agri-Trust — One-shot label remapping utility
#
# Purpose:
#   Removes brown_rugose (2), sunscald (8), anthracnose (0) from all YOLO
#   label .txt files and re-indexes the remaining 7 classes to contiguous IDs.
#
# OLD → NEW class ID mapping:
#   0  anthracnose      → REMOVED
#   1  blossom_end_rot  → 0
#   2  brown_rugose     → REMOVED
#   3  fruit_cracking   → 1
#   4  half_ripe        → 2
#   5  mold             → 3
#   6  ripe             → 4
#   7  rotten           → 5
#   8  sunscald         → REMOVED
#   9  unripe           → 6
#
# Usage:
#   python remap_labels.py              (dry-run: preview only)
#   python remap_labels.py --apply      (write changes + backup original labels)
#   python remap_labels.py --apply --no-backup  (write without backup)
#
# IMPORTANT: Run ONCE before training. Running twice will corrupt label files.
# =============================================================================

import argparse
import os
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

# ---------------------------------------------------------------------------
# Remapping Config
# ---------------------------------------------------------------------------

DATASET_DIR = Path(__file__).parent / "dataset"
SPLITS = ["train", "valid", "test"]

# Classes to remove (by old integer ID)
REMOVED_CLASSES = {0, 2, 8}  # anthracnose, brown_rugose, sunscald

# Old ID → New ID (only for surviving classes)
ID_REMAP = {
    1: 0,  # blossom_end_rot
    3: 1,  # fruit_cracking
    4: 2,  # half_ripe
    5: 3,  # mold
    6: 4,  # ripe
    7: 5,  # rotten
    9: 6,  # unripe
}

NEW_CLASS_NAMES = [
    "blossom_end_rot",   # 0
    "fruit_cracking",    # 1
    "half_ripe",         # 2
    "mold",              # 3
    "ripe",              # 4
    "rotten",            # 5
    "unripe",            # 6
]

REMOVED_CLASS_NAMES = ["anthracnose", "brown_rugose", "sunscald"]


# ---------------------------------------------------------------------------
# Windows Long-Path Helper
# ---------------------------------------------------------------------------

def make_long_path(p: Path) -> str:
    """
    On Windows, paths > 259 characters fail with FileNotFoundError unless
    prefixed with '\\\\?\\'. This helper adds the prefix when needed.
    Works transparently on non-Windows (prefix is a no-op there).
    """
    s = str(p.absolute())
    if len(s) > 259 and not s.startswith("\\\\?\\"):
        return "\\\\?\\" + s
    return s


def longpath_copytree(src: Path, dst: Path) -> None:
    r"""
    shutil.copytree fails on Windows for paths > 259 chars.
    This replacement copies file-by-file using the \\?\ prefix.
    """
    dst.mkdir(parents=True, exist_ok=True)
    for src_file in src.iterdir():
        if src_file.is_file():
            dst_file = dst / src_file.name
            # Use low-level read/write with long-path strings
            with open(make_long_path(src_file), "rb") as f_in:
                data = f_in.read()
            with open(make_long_path(dst_file), "wb") as f_out:
                f_out.write(data)


# ---------------------------------------------------------------------------

def remap_label_file(label_path: Path, apply: bool) -> dict:
    """
    Processes a single YOLO label .txt file.

    Returns:
        dict with keys: lines_in, lines_kept, lines_removed, was_modified
    """
    with open(make_long_path(label_path), "r", encoding="utf-8", errors="replace") as f:
        original_lines = f.readlines()

    new_lines = []
    removed_count = 0
    modified = False

    for line in original_lines:
        line = line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) < 5:
            # Malformed — keep as-is
            new_lines.append(line + "\n")
            continue

        old_class_id = int(parts[0])

        if old_class_id in REMOVED_CLASSES:
            # Drop this annotation entirely
            removed_count += 1
            modified = True
            continue

        new_class_id = ID_REMAP.get(old_class_id)
        if new_class_id is None:
            # Unknown class — drop with warning
            console.print(
                f"[yellow]⚠️  Unknown class ID {old_class_id} in {label_path.name} — dropped[/]"
            )
            removed_count += 1
            modified = True
            continue

        if new_class_id != old_class_id:
            modified = True

        parts[0] = str(new_class_id)
        new_lines.append(" ".join(parts) + "\n")

    stats = {
        "lines_in":      len(original_lines),
        "lines_kept":    len(new_lines),
        "lines_removed": removed_count,
        "was_modified":  modified,
    }

    if apply and modified:
        with open(make_long_path(label_path), "w", encoding="utf-8") as f:
            f.writelines(new_lines)

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Agri-Trust: Remove 3 classes and re-index YOLO labels",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually write the changes. Without this flag, only a dry-run preview is shown."
    )
    parser.add_argument(
        "--no-backup", action="store_true",
        help="Skip backing up original label folders (not recommended)."
    )
    args = parser.parse_args()

    console.print(Panel.fit(
        "[bold green]🏷️  Agri-Trust — Label Remapping Utility[/]\n"
        f"Mode: [cyan]{'APPLY (writing changes)' if args.apply else 'DRY RUN (no files modified)'}[/]",
        border_style="green",
    ))

    # ── Summary table of the remap ───────────────────────────────────────────
    remap_table = Table(title="Class Remapping", header_style="bold cyan")
    remap_table.add_column("Old ID", justify="center")
    remap_table.add_column("Old Name")
    remap_table.add_column("New ID", justify="center")
    remap_table.add_column("Status")

    old_names = [
        "anthracnose", "blossom_end_rot", "brown_rugose", "fruit_cracking",
        "half_ripe", "mold", "ripe", "rotten", "sunscald", "unripe",
    ]
    for old_id, name in enumerate(old_names):
        if old_id in REMOVED_CLASSES:
            remap_table.add_row(str(old_id), name, "—", "[red]REMOVED[/]")
        else:
            new_id = ID_REMAP[old_id]
            remap_table.add_row(str(old_id), name, str(new_id), "[green]KEPT[/]")

    console.print(remap_table)
    console.print()

    # ── Backup ───────────────────────────────────────────────────────────────
    if args.apply and not args.no_backup:
        for split in SPLITS:
            labels_dir = DATASET_DIR / split / "labels"
            if not labels_dir.exists():
                continue
            backup_dir = DATASET_DIR / split / "labels_backup"
            if backup_dir.exists():
                console.print(
                    f"[yellow]⚠️  Backup already exists: {backup_dir} — skipping backup for {split}[/]"
                )
            else:
                longpath_copytree(labels_dir, backup_dir)
                console.print(f"[green]✅ Backed up {labels_dir} → {backup_dir}[/]")

    # ── Process each split ───────────────────────────────────────────────────
    total_files = 0
    total_modified = 0
    total_lines_removed = 0
    total_lines_kept = 0

    for split in SPLITS:
        labels_dir = DATASET_DIR / split / "labels"
        if not labels_dir.exists():
            console.print(f"[yellow]⚠️  No labels dir found for split '{split}' — skipping[/]")
            continue

        label_files = sorted(labels_dir.glob("*.txt"))
        split_modified = 0
        split_removed = 0
        split_kept = 0

        for lf in label_files:
            stats = remap_label_file(lf, apply=args.apply)
            total_files += 1
            split_removed += stats["lines_removed"]
            split_kept += stats["lines_kept"]
            if stats["was_modified"]:
                split_modified += 1
                total_modified += 1

        total_lines_removed += split_removed
        total_lines_kept += split_kept

        console.print(
            f"  [cyan]{split:>5}[/]  "
            f"files: [white]{len(label_files):4d}[/]  "
            f"modified: [yellow]{split_modified:4d}[/]  "
            f"annotations removed: [red]{split_removed:5d}[/]  "
            f"kept: [green]{split_kept:5d}[/]"
        )

    # ── Summary ──────────────────────────────────────────────────────────────
    console.print()
    console.print(Panel.fit(
        f"[bold]Total files processed:[/] {total_files}\n"
        f"[bold]Files modified:[/] [yellow]{total_modified}[/]\n"
        f"[bold]Annotations removed:[/] [red]{total_lines_removed}[/]  "
        f"(anthracnose + brown_rugose + sunscald)\n"
        f"[bold]Annotations kept:[/] [green]{total_lines_kept}[/]",
        title="📊 Summary",
        border_style="cyan",
    ))

    if not args.apply:
        console.print()
        console.print(
            "[bold yellow]⚠️  DRY RUN complete — no files were modified.[/]\n"
            "Run with [bold green]--apply[/] to write changes.\n"
            "Example: [cyan]python remap_labels.py --apply[/]"
        )
    else:
        console.print()
        console.print(
            "[bold green]✅ Labels remapped successfully![/]\n"
            "Next steps:\n"
            "  1. Update [cyan]dataset/data.yaml[/]: nc=7, remove 3 class names\n"
            "  2. Delete [cyan]dataset/train/labels.cache[/] (stale cache will cause errors)\n"
            "  3. Delete [cyan]dataset/valid/labels.cache[/] and [cyan]dataset/test/labels.cache[/] if they exist\n"
            "  4. Run training: [cyan]python train.py[/]"
        )

        # ── Also nuke the stale labels.cache files ───────────────────────────
        for split in SPLITS:
            cache_file = DATASET_DIR / split / "labels.cache"
            if cache_file.exists():
                cache_file.unlink()
                console.print(f"[green]🗑️  Deleted stale cache: {cache_file}[/]")


if __name__ == "__main__":
    main()

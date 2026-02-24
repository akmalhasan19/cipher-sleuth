from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit


def build_split_table(
    manifest: pd.DataFrame,
    test_size: float,
    val_size: float,
    seed: int,
) -> pd.DataFrame:
    if not {"file_md5", "label"}.issubset(manifest.columns):
        raise ValueError("Manifest must contain file_md5 and label columns")

    grouped = (
        manifest.groupby("file_md5", as_index=False)
        .agg(label=("label", "first"), image_path=("image_path", "first"))
        .reset_index(drop=True)
    )

    splitter_test = StratifiedShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_val_idx, test_idx = next(splitter_test.split(grouped["image_path"], grouped["label"]))

    train_val = grouped.iloc[train_val_idx].reset_index(drop=True)
    test = grouped.iloc[test_idx].reset_index(drop=True)

    val_fraction_from_train_val = val_size / (1 - test_size)
    splitter_val = StratifiedShuffleSplit(
        n_splits=1,
        test_size=val_fraction_from_train_val,
        random_state=seed,
    )
    train_idx, val_idx = next(splitter_val.split(train_val["image_path"], train_val["label"]))
    train = train_val.iloc[train_idx]
    val = train_val.iloc[val_idx]

    split_rows = []
    for split_name, frame in [("train", train), ("val", val), ("test", test)]:
        for _, row in frame.iterrows():
            split_rows.append({"file_md5": row["file_md5"], "split": split_name})

    split_df = pd.DataFrame(split_rows).drop_duplicates(subset=["file_md5"])
    merged = manifest.merge(split_df, on="file_md5", how="left", suffixes=("", "_assigned"))
    merged["split"] = merged["split_assigned"]
    merged = merged.drop(columns=["split_assigned"])

    if merged["split"].isna().any():
        raise RuntimeError("Some rows did not receive split assignment")

    return merged


def save_split_table(split_manifest: pd.DataFrame, output_csv: str | Path) -> None:
    path = Path(output_csv)
    path.parent.mkdir(parents=True, exist_ok=True)
    split_manifest.to_csv(path, index=False)

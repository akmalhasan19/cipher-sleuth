from __future__ import annotations

import pandas as pd


def build_error_analysis_table(pred_df: pd.DataFrame, top_k: int = 30) -> pd.DataFrame:
    fp = pred_df[(pred_df["label"] == 0) & (pred_df["prediction"] == 1)].copy()
    fn = pred_df[(pred_df["label"] == 1) & (pred_df["prediction"] == 0)].copy()

    fp["error_type"] = "false_positive"
    fn["error_type"] = "false_negative"
    fp["confidence_distance"] = (fp["probability"] - 0.5).abs()
    fn["confidence_distance"] = (fn["probability"] - 0.5).abs()

    out = pd.concat([fp, fn], ignore_index=True)
    out = out.sort_values("confidence_distance", ascending=False).head(top_k).reset_index(drop=True)
    return out

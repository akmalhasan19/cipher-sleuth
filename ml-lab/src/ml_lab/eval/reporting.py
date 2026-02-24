from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def _to_markdown_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "_No data_"
    return df.to_markdown(index=False)


def write_markdown_report(
    output_path: str | Path,
    config: dict[str, Any],
    summary_df: pd.DataFrame,
    bootstrap_df: pd.DataFrame,
    robustness_df: pd.DataFrame,
    stats_df: pd.DataFrame,
    error_df: pd.DataFrame,
    assumptions: list[str],
) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    lines.append(f"# Experiment Report: {config['experiment']['name']}")
    lines.append("")
    lines.append("## Assumptions")
    for idx, item in enumerate(assumptions, start=1):
        lines.append(f"{idx}. {item}")
    lines.append("")
    lines.append("## Main Metrics (Test Split)")
    lines.append(_to_markdown_table(summary_df))
    lines.append("")
    lines.append("## Bootstrap Confidence Interval")
    lines.append(_to_markdown_table(bootstrap_df))
    lines.append("")
    lines.append("## Robustness Metrics")
    lines.append(_to_markdown_table(robustness_df))
    lines.append("")
    lines.append("## Statistical Comparison")
    lines.append(_to_markdown_table(stats_df))
    lines.append("")
    lines.append("## Error Analysis (Top FP/FN)")
    lines.append(_to_markdown_table(error_df))
    lines.append("")
    lines.append("## Notes")
    lines.append("- Interpret improvements as empirical under current datasets and perturbation settings.")
    lines.append("- Avoid novelty overclaim; this report targets engineering reproducibility and fair comparison.")
    lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")

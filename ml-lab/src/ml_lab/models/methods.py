from __future__ import annotations


def get_method_feature_columns(method: str, all_columns: list[str]) -> list[str]:
    ela_cols = [col for col in all_columns if col.startswith("ela_")]
    dwt_cols = [col for col in all_columns if col.startswith("dwt_")]
    dwt_no_svd_cols = [col for col in dwt_cols if "_sv_" not in col and "singular" not in col]

    if method == "ela_only":
        return ela_cols
    if method == "dwt_svd_only":
        return dwt_cols
    if method == "ela_dwt":
        return ela_cols + dwt_no_svd_cols
    if method == "ela_dwt_svd":
        return ela_cols + dwt_cols

    raise ValueError(f"Unknown method: {method}")

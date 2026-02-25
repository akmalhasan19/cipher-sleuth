from __future__ import annotations


def get_method_feature_columns(method: str, all_columns: list[str]) -> list[str]:
    ela_cols = [col for col in all_columns if col.startswith("ela_")]
    dwt_cols = [col for col in all_columns if col.startswith("dwt_")]
    dwt_no_svd_cols = [col for col in dwt_cols if "_sv_" not in col and "singular" not in col]
    cfa_cols = [col for col in all_columns if col.startswith("cfa_")]
    prnu_cols = [col for col in all_columns if col.startswith("prnu_")]
    mantra_cols = [col for col in all_columns if col.startswith("mantra_")]

    if method == "ela_only":
        return ela_cols
    if method == "dwt_svd_only":
        return dwt_cols
    if method == "ela_dwt":
        return ela_cols + dwt_no_svd_cols
    if method == "ela_dwt_svd":
        return ela_cols + dwt_cols
    if method == "cfa_only":
        return cfa_cols
    if method == "prnu_only":
        return prnu_cols
    if method == "mantra_only":
        return mantra_cols
    if method == "mantra_cfa":
        return mantra_cols + cfa_cols
    if method == "mantra_cfa_prnu":
        return mantra_cols + cfa_cols + prnu_cols
    if method == "mantra_cfa_prnu_ela_dwt_svd":
        return mantra_cols + cfa_cols + prnu_cols + ela_cols + dwt_cols

    raise ValueError(f"Unknown method: {method}")

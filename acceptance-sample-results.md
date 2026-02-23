# Acceptance Sample Results

Generated on: 2026-02-23T04:45:59.448Z

## Scenario A - Gambar Asli (expected >= 90)
- Filename: `camera-original.png`
- Hash constraints: ELA low (`<0.35`) + watermark intact (`>=90`) + no suspicious metadata signature
- File hash: `95ab3ff040f4ba8e128cc5bf582bab10d48b3687b94285b37001a4ebb9201fee`
- Source: `computed`
- Final trust score: **94**
- Verdict: **verified**
- Analysis ID: `analysis_1771821958891_84f69fc9`

## Scenario B - Gambar Manipulasi (expected < 50)
- Filename: `photoshop-face-swap.png`
- Hash constraints: ELA high (`>=0.7`) + watermark damaged (`<75`) + suspicious metadata signature (filename contains `photoshop`)
- File hash: `64b3243d8f05cac2dc7613c2add9e829551be0d7d1def7353ee8a973b97bd010`
- Source: `computed`
- Final trust score: **19**
- Verdict: **manipulated**
- Analysis ID: `analysis_1771821959175_d64a4285`

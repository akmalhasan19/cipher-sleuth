# API Payload Contracts (MVP)

Contract checks are enforced in:

- `tests/integration/api-contracts.integration.test.ts`

## `GET /api/analyze`

Expected:

- `ok: true`
- `message: string`
- `capabilities` object:
  - `llmEnabled: boolean`
  - `duplicateDetectionEnabled: boolean`
  - `guestCaptchaEnabled: boolean`
  - `guestIpRateLimitEnabled: boolean`
  - `guestIpDailyLimit: number`
  - `llmModel: string`
  - `maxUploadMb: number`
  - `guestFreeAnalysisLimit: number`
- `sample` object:
  - `finalTrustScore: 0..100`
  - `verdict: verified | suspicious | manipulated`
  - `verdictLabel: string`
  - `reportText: string`
  - `riskSignals: string[]`
  - `recommendedVerdict`

## `POST /api/analyze` (success)

Expected:

- `ok: true`
- `analysisId: "analysis_*"`
- `source: "computed" | "cache"`
- File metadata:
  - `filenameOriginal`
  - `filenameNormalized` (normalized to `.webp`)
  - `mimeType`
  - `fileSizeBytes`
  - `fileHashSha256`
- Forensic verdict fields:
  - `finalTrustScore`
  - `verdict`
  - `verdictLabel`
  - `trustScoreBreakdown`
  - `forensicBreakdown`
- Report fields:
  - `reportSummary`
  - `reportDownloadUrl` (to `/api/report/[analysisId]/pdf`)
- Operational fields:
  - `access`
  - `database.lookup`
  - `database.persist`
  - `guestProtection`:
    - `captcha.status`
    - `ipRateLimit.status`
    - `llm.effectiveEnabled`

## `GET /api/report/[analysisId]`

Expected:

- HTTP `307` redirect
- `Location` points to `/api/report/[analysisId]/pdf`

## `GET /api/report/[analysisId]/pdf`

Expected:

- HTTP `200`
- `Content-Type: application/pdf`

export type AgentId = "exif-bot" | "noise-bot" | "dwt-svd-bot";

export type AgentResult = {
  agentId: AgentId;
  agentName: string;
  status: "completed";
  confidence: number;
  trustDelta: number;
  elapsedMs: number;
  logs: string[];
  rawResult: Record<string, string | number | boolean | null>;
};

export type AnalysisInput = {
  filenameOriginal: string;
  filenameNormalized: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHashSha256: string;
};

export type AgentRunContext = AnalysisInput & {
  startedAt: number;
};

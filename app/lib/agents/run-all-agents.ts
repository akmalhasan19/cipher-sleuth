import { runDwtSvdAgent } from "./dwt-svd-agent";
import { runElaAgent } from "./ela-agent";
import { runExifAgent } from "./exif-agent";
import type { AgentResult, AnalysisInput } from "./types";

export async function runAllAgents(input: AnalysisInput): Promise<AgentResult[]> {
  const context = { ...input, startedAt: Date.now() };

  return Promise.all([
    runExifAgent(context),
    runElaAgent(context),
    runDwtSvdAgent(context),
  ]);
}

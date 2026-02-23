import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { StoredAnalysisRecord } from "../db/analysis-session-store";

const PAGE_WIDTH = 595.28; // A4 width
const PAGE_HEIGHT = 841.89; // A4 height
const MARGIN_X = 40;
const BOTTOM_BOUNDARY = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const HEADER_HEIGHT = 102;
const HEADER_BOTTOM = PAGE_HEIGHT - HEADER_HEIGHT - 18;

const THEME = {
  pageBg: rgb(0.965, 0.968, 0.975),
  headerBg: rgb(0.09, 0.13, 0.21),
  headerText: rgb(0.96, 0.97, 0.99),
  accent: rgb(0.93, 0.67, 0.26),
  heading: rgb(0.11, 0.15, 0.24),
  body: rgb(0.18, 0.2, 0.25),
  muted: rgb(0.42, 0.45, 0.53),
  border: rgb(0.83, 0.86, 0.91),
  cardBg: rgb(1, 1, 1),
  cardBgAlt: rgb(0.975, 0.98, 0.99),
  riskBullet: rgb(0.83, 0.3, 0.22),
  barBg: rgb(0.89, 0.91, 0.95),
  barFill: rgb(0.23, 0.44, 0.79),
  verified: rgb(0.14, 0.58, 0.34),
  suspicious: rgb(0.82, 0.47, 0.18),
  manipulated: rgb(0.74, 0.2, 0.24),
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeText(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "N/A";
}

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function formatConfidence(confidence: number): string {
  return `${Math.round(clamp(confidence, 0, 1) * 100)}%`;
}

function splitLongToken(
  token: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  if (font.widthOfTextAtSize(token, fontSize) <= maxWidth) {
    return [token];
  }

  const chunks: string[] = [];
  let chunk = "";

  for (const char of token) {
    const candidate = `${chunk}${char}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || chunk.length === 0) {
      chunk = candidate;
      continue;
    }

    chunks.push(chunk);
    chunk = char;
  }

  if (chunk.length > 0) {
    chunks.push(chunk);
  }

  return chunks;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = (text ?? "").replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex]?.trim() ?? "";
    if (!paragraph) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";

    for (const word of words) {
      const chunks = splitLongToken(word, font, fontSize, maxWidth);

      for (const chunk of chunks) {
        const candidate = currentLine ? `${currentLine} ${chunk}` : chunk;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          currentLine = candidate;
          continue;
        }

        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = chunk;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      lines.push("");
    }
  }

  return lines.length > 0 ? lines : [""];
}

function verdictColor(verdict: StoredAnalysisRecord["verdict"]): ReturnType<typeof rgb> {
  if (verdict === "verified") {
    return THEME.verified;
  }
  if (verdict === "suspicious") {
    return THEME.suspicious;
  }
  return THEME.manipulated;
}

type ElaVisualPreview = {
  previewWidth: number;
  previewHeight: number;
  originalPreviewDataUrl: string;
  residualPreviewDataUrl: string;
};

function extractElaVisualPreview(record: StoredAnalysisRecord): ElaVisualPreview | null {
  const noiseAgent = record.agentResults.find((agent) => agent.agentId === "noise-bot");
  if (!noiseAgent) {
    return null;
  }

  const previewWidthRaw = noiseAgent.rawResult.previewWidth;
  const previewHeightRaw = noiseAgent.rawResult.previewHeight;
  const originalPreviewRaw = noiseAgent.rawResult.originalPreviewDataUrl;
  const residualPreviewRaw = noiseAgent.rawResult.residualPreviewDataUrl;

  if (
    typeof previewWidthRaw !== "number" ||
    typeof previewHeightRaw !== "number" ||
    typeof originalPreviewRaw !== "string" ||
    typeof residualPreviewRaw !== "string"
  ) {
    return null;
  }

  if (previewWidthRaw <= 0 || previewHeightRaw <= 0) {
    return null;
  }

  return {
    previewWidth: previewWidthRaw,
    previewHeight: previewHeightRaw,
    originalPreviewDataUrl: originalPreviewRaw,
    residualPreviewDataUrl: residualPreviewRaw,
  };
}

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[1]) {
    return null;
  }

  try {
    return new Uint8Array(Buffer.from(match[1], "base64"));
  } catch {
    return null;
  }
}

function fitImageInBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export async function generateForensicReportPdf(
  record: StoredAnalysisRecord
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Cipher Sleuth Report ${record.analysisId}`);
  pdfDoc.setAuthor("Cipher Sleuth");
  pdfDoc.setSubject("Digital Image Forensic Report");
  pdfDoc.setKeywords(["forensics", "integrity", "cipher-sleuth", "investigation"]);

  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const pages: PDFPage[] = [];
  let page: PDFPage;
  let cursorY = 0;

  function drawPageChrome(target: PDFPage): void {
    target.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: THEME.pageBg,
    });

    target.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - HEADER_HEIGHT,
      width: PAGE_WIDTH,
      height: HEADER_HEIGHT,
      color: THEME.headerBg,
    });

    target.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - HEADER_HEIGHT - 4,
      width: PAGE_WIDTH,
      height: 4,
      color: THEME.accent,
    });

    target.drawText("CIPHER SLEUTH", {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 38,
      size: 10,
      font: headingFont,
      color: THEME.headerText,
    });

    target.drawText("Digital Forensic Intelligence Report", {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 56,
      size: 16,
      font: headingFont,
      color: THEME.headerText,
    });

    const analysisLine = `Analysis ${record.analysisId}`;
    target.drawText(analysisLine, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 74,
      size: 10,
      font: bodyFont,
      color: rgb(0.84, 0.88, 0.96),
    });

    const generatedLine = formatGeneratedAt(record.generatedAt);
    target.drawText(generatedLine, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 88,
      size: 9,
      font: bodyFont,
      color: rgb(0.75, 0.81, 0.91),
    });

    const badgeText = `${record.forensicBreakdown.verdictLabel} | ${record.finalTrustScore}/100`;
    const badgeFontSize = 9;
    const badgeHeight = 22;
    const badgePadding = 10;
    const badgeWidth = headingFont.widthOfTextAtSize(badgeText, badgeFontSize) + badgePadding * 2;
    const badgeX = PAGE_WIDTH - MARGIN_X - badgeWidth;
    const badgeY = PAGE_HEIGHT - 74;

    target.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: verdictColor(record.verdict),
    });

    target.drawText(badgeText, {
      x: badgeX + badgePadding,
      y: badgeY + 7,
      size: badgeFontSize,
      font: headingFont,
      color: rgb(1, 1, 1),
    });
  }

  function addPage(): void {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    drawPageChrome(page);
    cursorY = HEADER_BOTTOM;
  }

  function ensureSpace(requiredHeight: number): void {
    if (cursorY - requiredHeight < BOTTOM_BOUNDARY) {
      addPage();
    }
  }

  function drawSectionTitle(title: string): void {
    const neededHeight = 28;
    ensureSpace(neededHeight);

    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - 16,
      width: 4,
      height: 14,
      color: THEME.accent,
    });

    page.drawText(title, {
      x: MARGIN_X + 11,
      y: cursorY - 14,
      size: 13,
      font: headingFont,
      color: THEME.heading,
    });

    page.drawLine({
      start: { x: MARGIN_X + 120, y: cursorY - 8 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY - 8 },
      thickness: 1,
      color: THEME.border,
    });

    cursorY -= neededHeight;
  }

  function drawWrappedLineBlock(
    lines: string[],
    options: {
      x: number;
      font: PDFFont;
      fontSize: number;
      color: ReturnType<typeof rgb>;
      lineHeight: number;
      startY: number;
    }
  ): number {
    let y = options.startY;

    for (const line of lines) {
      page.drawText(line, {
        x: options.x,
        y: y - options.fontSize,
        size: options.fontSize,
        font: options.font,
        color: options.color,
      });
      y -= options.lineHeight;
    }

    return y;
  }

  function drawParagraphCard(
    title: string,
    text: string,
    options?: {
      fillColor?: ReturnType<typeof rgb>;
      textColor?: ReturnType<typeof rgb>;
      useMonoFont?: boolean;
    }
  ): void {
    const padding = 12;
    const titleFontSize = 10;
    const bodyFontSize = 10.5;
    const lineHeight = bodyFontSize * 1.35;
    const textFont = options?.useMonoFont ? monoFont : bodyFont;
    const lines = wrapText(text, textFont, bodyFontSize, CONTENT_WIDTH - padding * 2);
    const cardHeight = padding * 2 + 16 + lines.length * lineHeight;

    ensureSpace(cardHeight + 8);

    const cardTop = cursorY;
    page.drawRectangle({
      x: MARGIN_X,
      y: cardTop - cardHeight,
      width: CONTENT_WIDTH,
      height: cardHeight,
      color: options?.fillColor ?? THEME.cardBg,
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawText(title, {
      x: MARGIN_X + padding,
      y: cardTop - 18,
      size: titleFontSize,
      font: headingFont,
      color: THEME.muted,
    });

    drawWrappedLineBlock(lines, {
      x: MARGIN_X + padding,
      font: textFont,
      fontSize: bodyFontSize,
      color: options?.textColor ?? THEME.body,
      lineHeight,
      startY: cardTop - 30,
    });

    cursorY -= cardHeight + 10;
  }

  function drawMetaCards(): void {
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const padding = 11;
    const lineFontSize = 9.5;
    const lineHeight = lineFontSize * 1.35;

    const leftRows = [
      `Generated: ${formatGeneratedAt(record.generatedAt)}`,
      `Original File: ${safeText(record.filenameOriginal)}`,
      `Trust Score: ${record.finalTrustScore}/100`,
      `Verdict: ${record.forensicBreakdown.verdictLabel}`,
    ];
    const rightRows = [
      `Model: ${record.forensicBreakdown.orchestrator.model}`,
      `Provider: ${record.forensicBreakdown.orchestrator.provider}`,
      `SHA-256: ${record.fileHashSha256}`,
      `Normalized Name: ${safeText(record.filenameNormalized)}`,
    ];

    const leftLines = leftRows.flatMap((row) =>
      wrapText(row, bodyFont, lineFontSize, cardWidth - padding * 2)
    );
    const rightLines = rightRows.flatMap((row, index) =>
      wrapText(
        row,
        row.startsWith("SHA-256:") ? monoFont : bodyFont,
        lineFontSize,
        cardWidth - padding * 2
      ).concat(index < rightRows.length - 1 ? [""] : [])
    );

    const leftHeight = padding * 2 + 18 + leftLines.length * lineHeight;
    const rightHeight = padding * 2 + 18 + rightLines.length * lineHeight;
    const cardHeight = Math.max(leftHeight, rightHeight);

    ensureSpace(cardHeight + 12);
    const cardTop = cursorY;

    const drawOneCard = (
      x: number,
      title: string,
      lines: string[],
      useMonoForHash: boolean
    ): void => {
      page.drawRectangle({
        x,
        y: cardTop - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: THEME.cardBg,
        borderColor: THEME.border,
        borderWidth: 1,
      });

      page.drawRectangle({
        x,
        y: cardTop - 3,
        width: cardWidth,
        height: 3,
        color: THEME.accent,
      });

      page.drawText(title, {
        x: x + padding,
        y: cardTop - 17,
        size: 9.5,
        font: headingFont,
        color: THEME.muted,
      });

      let textY = cardTop - 29;
      for (const line of lines) {
        const fontForLine = useMonoForHash && line.includes("SHA-256:") ? monoFont : bodyFont;
        page.drawText(line, {
          x: x + padding,
          y: textY - lineFontSize,
          size: lineFontSize,
          font: fontForLine,
          color: THEME.body,
        });
        textY -= lineHeight;
      }
    };

    drawOneCard(MARGIN_X, "Investigation Snapshot", leftLines, false);
    drawOneCard(MARGIN_X + cardWidth + gap, "Traceability", rightLines, true);
    cursorY -= cardHeight + 14;
  }

  function drawMetricTiles(): void {
    const gap = 10;
    const tileWidth = (CONTENT_WIDTH - gap * 2) / 3;
    const tileHeight = 86;

    ensureSpace(tileHeight + 10);
    const topY = cursorY;

    const metricEntries = [
      {
        label: "Trust Score",
        value: `${record.finalTrustScore}/100`,
        subline: `Weighted penalty ${record.trustScoreBreakdown.weightedPenaltyScore.toFixed(2)}`,
        tint: rgb(0.93, 0.97, 1),
      },
      {
        label: "Verdict",
        value: record.forensicBreakdown.verdictLabel,
        subline: `Threshold ${record.trustScoreBreakdown.thresholds.suspiciousMin}-${record.trustScoreBreakdown.thresholds.verifiedMin - 1}`,
        tint: rgb(0.99, 0.95, 0.91),
      },
      {
        label: "Orchestrator",
        value: record.forensicBreakdown.orchestrator.mode.toUpperCase(),
        subline: `${record.forensicBreakdown.orchestrator.provider} | ${record.forensicBreakdown.orchestrator.model}`,
        tint: rgb(0.94, 0.96, 0.94),
      },
    ];

    metricEntries.forEach((entry, index) => {
      const x = MARGIN_X + index * (tileWidth + gap);
      page.drawRectangle({
        x,
        y: topY - tileHeight,
        width: tileWidth,
        height: tileHeight,
        color: entry.tint,
        borderColor: THEME.border,
        borderWidth: 1,
      });

      page.drawText(entry.label, {
        x: x + 10,
        y: topY - 18,
        size: 9,
        font: headingFont,
        color: THEME.muted,
      });

      const valueLines = wrapText(entry.value, headingFont, 13, tileWidth - 20);
      let valueY = topY - 33;
      for (const line of valueLines) {
        page.drawText(line, {
          x: x + 10,
          y: valueY - 13,
          size: 13,
          font: headingFont,
          color: THEME.heading,
        });
        valueY -= 16;
      }

      const sublineLines = wrapText(entry.subline, bodyFont, 8.5, tileWidth - 20);
      let sublineY = topY - tileHeight + 20;
      for (const line of sublineLines) {
        page.drawText(line, {
          x: x + 10,
          y: sublineY,
          size: 8.5,
          font: bodyFont,
          color: THEME.muted,
        });
        sublineY -= 11;
      }
    });

    cursorY -= tileHeight + 12;
  }

  function drawRiskSignals(): void {
    const signals =
      record.forensicBreakdown.orchestrator.riskSignals.length > 0
        ? record.forensicBreakdown.orchestrator.riskSignals
        : ["No risk signal was returned by the orchestrator."];
    const padding = 12;
    const lineFontSize = 10;
    const lineHeight = lineFontSize * 1.35;
    const textWidth = CONTENT_WIDTH - padding * 2 - 14;

    const wrappedSignals = signals.map((signal) =>
      wrapText(signal, bodyFont, lineFontSize, textWidth)
    );

    const contentHeight = wrappedSignals.reduce(
      (total, lines) => total + lines.length * lineHeight + 4,
      0
    );
    const cardHeight = padding * 2 + 16 + contentHeight;

    ensureSpace(cardHeight + 10);
    const cardTop = cursorY;

    page.drawRectangle({
      x: MARGIN_X,
      y: cardTop - cardHeight,
      width: CONTENT_WIDTH,
      height: cardHeight,
      color: THEME.cardBg,
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawText("Primary Risk Signals", {
      x: MARGIN_X + padding,
      y: cardTop - 18,
      size: 10,
      font: headingFont,
      color: THEME.muted,
    });

    let signalY = cardTop - 32;
    for (const lines of wrappedSignals) {
      const bulletCenterY = signalY - 4;
      page.drawCircle({
        x: MARGIN_X + padding + 3,
        y: bulletCenterY,
        size: 2.3,
        color: THEME.riskBullet,
      });

      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN_X + padding + 12,
          y: signalY - lineFontSize,
          size: lineFontSize,
          font: bodyFont,
          color: THEME.body,
        });
        signalY -= lineHeight;
      }

      signalY -= 4;
    }

    cursorY -= cardHeight + 12;
  }

  function drawAgentFindings(): void {
    const elapsedByAgent = new Map(
      record.agentResults.map((agent) => [agent.agentId, agent.elapsedMs])
    );

    record.forensicBreakdown.agentFindings.forEach((agent, index) => {
      const keyLines = wrapText(agent.keyFinding, bodyFont, 10, CONTENT_WIDTH - 24);
      const detailLine = `Delta ${agent.trustDelta} | Confidence ${formatConfidence(agent.confidence)} | Elapsed ${elapsedByAgent.get(agent.agentId) ?? 0} ms`;
      const detailLines = wrapText(detailLine, bodyFont, 9.5, CONTENT_WIDTH - 24);
      const lineHeight = 13.2;
      const cardHeight = 14 + 20 + keyLines.length * lineHeight + detailLines.length * 12 + 12;

      ensureSpace(cardHeight + 8);
      const cardTop = cursorY;

      page.drawRectangle({
        x: MARGIN_X,
        y: cardTop - cardHeight,
        width: CONTENT_WIDTH,
        height: cardHeight,
        color: index % 2 === 0 ? THEME.cardBg : THEME.cardBgAlt,
        borderColor: THEME.border,
        borderWidth: 1,
      });

      page.drawText(agent.agentName, {
        x: MARGIN_X + 11,
        y: cardTop - 19,
        size: 11,
        font: headingFont,
        color: THEME.heading,
      });

      const deltaColor = agent.trustDelta < 0 ? THEME.manipulated : THEME.verified;
      const deltaLabel = agent.trustDelta < 0 ? `${agent.trustDelta}` : `+${agent.trustDelta}`;
      const deltaBadge = `Trust Delta ${deltaLabel}`;
      const badgeSize = 8.5;
      const badgePadding = 6;
      const badgeWidth = headingFont.widthOfTextAtSize(deltaBadge, badgeSize) + badgePadding * 2;
      const badgeX = PAGE_WIDTH - MARGIN_X - badgeWidth - 10;
      const badgeY = cardTop - 24;

      page.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badgeWidth,
        height: 16,
        color: deltaColor,
      });

      page.drawText(deltaBadge, {
        x: badgeX + badgePadding,
        y: badgeY + 5,
        size: badgeSize,
        font: headingFont,
        color: rgb(1, 1, 1),
      });

      let contentY = cardTop - 35;
      for (const line of keyLines) {
        page.drawText(line, {
          x: MARGIN_X + 11,
          y: contentY - 10,
          size: 10,
          font: bodyFont,
          color: THEME.body,
        });
        contentY -= lineHeight;
      }

      for (const line of detailLines) {
        page.drawText(line, {
          x: MARGIN_X + 11,
          y: contentY - 9.5,
          size: 9.5,
          font: bodyFont,
          color: THEME.muted,
        });
        contentY -= 12;
      }

      cursorY -= cardHeight + 8;
    });
  }

  function drawScoringContributions(): void {
    const labelWidth = 140;
    const rightValueWidth = 90;
    const barWidth = CONTENT_WIDTH - labelWidth - rightValueWidth - 18;

    for (const item of record.trustScoreBreakdown.perAgent) {
      const rowHeight = 26;
      ensureSpace(rowHeight + 4);

      const rowY = cursorY - 10;
      page.drawText(item.agentId, {
        x: MARGIN_X,
        y: rowY,
        size: 10,
        font: headingFont,
        color: THEME.heading,
      });

      const barX = MARGIN_X + labelWidth;
      const barY = cursorY - 14;
      const normalized = clamp(item.normalizedPenalty, 0, 1);

      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth,
        height: 8,
        color: THEME.barBg,
      });

      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth * normalized,
        height: 8,
        color: THEME.barFill,
      });

      const valueText = `weighted ${item.weightedPenaltyContribution.toFixed(3)}`;
      const valueWidth = bodyFont.widthOfTextAtSize(valueText, 9);
      page.drawText(valueText, {
        x: MARGIN_X + CONTENT_WIDTH - valueWidth,
        y: rowY,
        size: 9,
        font: bodyFont,
        color: THEME.muted,
      });

      cursorY -= rowHeight;
    }

    ensureSpace(20);
    const summaryText = `Scoring model ${record.trustScoreBreakdown.scoringModel} | Raw penalty ${record.trustScoreBreakdown.scorePenaltyRaw.toFixed(2)} | Weighted ${record.trustScoreBreakdown.weightedPenaltyScore.toFixed(2)}`;
    page.drawText(summaryText, {
      x: MARGIN_X,
      y: cursorY - 10,
      size: 9,
      font: bodyFont,
      color: THEME.muted,
    });
    cursorY -= 20;
  }

  function drawTechnicalFindings(): void {
    const findings =
      record.forensicBreakdown.technicalFindings.length > 0
        ? record.forensicBreakdown.technicalFindings
        : ["No technical findings were produced."];
    const bulletFontSize = 10;
    const lineHeight = bulletFontSize * 1.35;
    const bulletWidth = CONTENT_WIDTH - 24;
    const wrappedFindings = findings.map((finding) =>
      wrapText(finding, bodyFont, bulletFontSize, bulletWidth)
    );
    const cardHeight =
      20 +
      wrappedFindings.reduce((sum, lines) => sum + lines.length * lineHeight + 4, 0) +
      16;

    ensureSpace(cardHeight + 10);
    const top = cursorY;

    page.drawRectangle({
      x: MARGIN_X,
      y: top - cardHeight,
      width: CONTENT_WIDTH,
      height: cardHeight,
      color: THEME.cardBg,
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawText("Technical Findings", {
      x: MARGIN_X + 12,
      y: top - 18,
      size: 10,
      font: headingFont,
      color: THEME.muted,
    });

    let y = top - 32;
    for (const lines of wrappedFindings) {
      page.drawText("-", {
        x: MARGIN_X + 12,
        y: y - bulletFontSize,
        size: bulletFontSize,
        font: headingFont,
        color: THEME.body,
      });

      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN_X + 22,
          y: y - bulletFontSize,
          size: bulletFontSize,
          font: bodyFont,
          color: THEME.body,
        });
        y -= lineHeight;
      }
      y -= 4;
    }

    cursorY -= cardHeight + 12;
  }

  async function drawElaVisualComparison(): Promise<void> {
    const preview = extractElaVisualPreview(record);
    if (!preview) {
      drawParagraphCard(
        "ELA Visual Comparison",
        "ELA preview was not available for this analysis record.",
        { fillColor: THEME.cardBgAlt, textColor: THEME.muted }
      );
      return;
    }

    const originalPngBytes = decodePngDataUrl(preview.originalPreviewDataUrl);
    const residualPngBytes = decodePngDataUrl(preview.residualPreviewDataUrl);

    if (!originalPngBytes || !residualPngBytes) {
      drawParagraphCard(
        "ELA Visual Comparison",
        "ELA preview payload could not be decoded.",
        { fillColor: THEME.cardBgAlt, textColor: THEME.muted }
      );
      return;
    }

    const [originalImage, residualImage] = await Promise.all([
      pdfDoc.embedPng(originalPngBytes),
      pdfDoc.embedPng(residualPngBytes),
    ]);

    const sectionHeight = 228;
    ensureSpace(sectionHeight + 10);
    const top = cursorY;
    const cardPadding = 10;
    const gap = 10;
    const panelWidth = (CONTENT_WIDTH - cardPadding * 2 - gap) / 2;
    const panelHeight = 176;

    page.drawRectangle({
      x: MARGIN_X,
      y: top - sectionHeight,
      width: CONTENT_WIDTH,
      height: sectionHeight,
      color: THEME.cardBg,
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawText("Visual Pair: Original vs ELA Heatmap", {
      x: MARGIN_X + cardPadding,
      y: top - 18,
      size: 10,
      font: headingFont,
      color: THEME.muted,
    });

    const originalPanelX = MARGIN_X + cardPadding;
    const residualPanelX = originalPanelX + panelWidth + gap;
    const panelY = top - 38 - panelHeight;

    page.drawRectangle({
      x: originalPanelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      color: rgb(0.99, 0.99, 0.995),
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: residualPanelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      color: rgb(0.99, 0.99, 0.995),
      borderColor: THEME.border,
      borderWidth: 1,
    });

    page.drawText("Original", {
      x: originalPanelX + 8,
      y: panelY + panelHeight - 14,
      size: 8.5,
      font: headingFont,
      color: THEME.muted,
    });
    page.drawText("ELA Heatmap", {
      x: residualPanelX + 8,
      y: panelY + panelHeight - 14,
      size: 8.5,
      font: headingFont,
      color: THEME.muted,
    });

    const drawableHeight = panelHeight - 24;
    const drawableWidth = panelWidth - 12;
    const originalSize = fitImageInBox(
      originalImage.width,
      originalImage.height,
      drawableWidth,
      drawableHeight
    );
    const residualSize = fitImageInBox(
      residualImage.width,
      residualImage.height,
      drawableWidth,
      drawableHeight
    );

    const originalImageX = originalPanelX + (panelWidth - originalSize.width) / 2;
    const originalImageY = panelY + 6 + (drawableHeight - originalSize.height) / 2;
    page.drawImage(originalImage, {
      x: originalImageX,
      y: originalImageY,
      width: originalSize.width,
      height: originalSize.height,
    });

    const residualImageX = residualPanelX + (panelWidth - residualSize.width) / 2;
    const residualImageY = panelY + 6 + (drawableHeight - residualSize.height) / 2;
    page.drawImage(residualImage, {
      x: residualImageX,
      y: residualImageY,
      width: residualSize.width,
      height: residualSize.height,
    });

    const caption =
      "Heatmap color intensity reflects recompression residual magnitude (higher intensity indicates stronger local inconsistency).";
    const captionLines = wrapText(caption, bodyFont, 8.5, CONTENT_WIDTH - cardPadding * 2);
    let captionY = panelY - 6;
    for (const line of captionLines) {
      page.drawText(line, {
        x: MARGIN_X + cardPadding,
        y: captionY,
        size: 8.5,
        font: bodyFont,
        color: THEME.muted,
      });
      captionY -= 10;
    }

    cursorY -= sectionHeight + 12;
  }

  addPage();

  drawMetaCards();
  drawSectionTitle("Executive Summary");
  drawParagraphCard("LLM Synthesis", safeText(record.forensicBreakdown.executiveSummary), {
    fillColor: THEME.cardBg,
  });

  drawSectionTitle("Snapshot Metrics");
  drawMetricTiles();

  drawSectionTitle("ELA Visual Evidence");
  await drawElaVisualComparison();

  drawSectionTitle("Risk Signals");
  drawRiskSignals();

  drawSectionTitle("Agent Findings");
  drawAgentFindings();

  drawSectionTitle("Scoring Contributions");
  drawScoringContributions();

  drawTechnicalFindings();

  drawParagraphCard(
    "Export Notes",
    "This report is generated by Cipher Sleuth for read-only forensic review. Results combine deterministic analysis and optional LLM orchestration. Always validate with domain experts for legal or compliance workflows.",
    { fillColor: THEME.cardBgAlt, textColor: THEME.muted }
  );

  pages.forEach((targetPage, index) => {
    const footerY = 28;
    targetPage.drawLine({
      start: { x: MARGIN_X, y: footerY + 12 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: footerY + 12 },
      thickness: 1,
      color: THEME.border,
    });

    const leftText = "Cipher Sleuth forensic export";
    targetPage.drawText(leftText, {
      x: MARGIN_X,
      y: footerY,
      size: 8.5,
      font: bodyFont,
      color: THEME.muted,
    });

    const pageText = `Page ${index + 1}/${pages.length}`;
    const pageTextWidth = bodyFont.widthOfTextAtSize(pageText, 8.5);
    targetPage.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN_X - pageTextWidth,
      y: footerY,
      size: 8.5,
      font: bodyFont,
      color: THEME.muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

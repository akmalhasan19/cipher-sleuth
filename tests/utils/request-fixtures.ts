export function createImageFile(
  name: string,
  mimeType: string,
  content: string
): File {
  return new File([Buffer.from(content, "utf8")], name, { type: mimeType });
}

export function createAnalyzeRequest(file: File, cookie?: string): Request {
  const formData = new FormData();
  formData.append("file", file);

  const headers = cookie ? new Headers({ cookie }) : undefined;
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: formData,
    headers,
  });
}

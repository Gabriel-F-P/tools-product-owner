import { apiUrl } from "../services/api";
import type { MakerFileRef } from "./types";

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Guarda um arquivo do Maker (foto ou arquivo 3D) no servidor.
 * Sem servidor disponível, o arquivo fica dentro dos próprios dados (data URL).
 */
export async function storeMakerFile(blob: Blob, name: string): Promise<MakerFileRef> {
  const type = blob.type || "application/octet-stream";

  try {
    const response = await fetch(apiUrl("/api/maker-files"), {
      method: "POST",
      body: blob,
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(name), "X-File-Type": type }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const { id } = (await response.json()) as { id: string };
    return { id, name, size: blob.size, type };
  } catch {
    return { dataUrl: await readAsDataUrl(blob), name, size: blob.size, type };
  }
}

/** Remove o arquivo do servidor (se estiver lá). Falhas são ignoradas. */
export function deleteMakerFile(ref?: MakerFileRef) {
  if (!ref?.id) return;
  fetch(apiUrl(`/api/maker-files/${encodeURIComponent(ref.id)}`), { method: "DELETE" }).catch(() => undefined);
}

export function makerFileUrl(ref: MakerFileRef, download = false) {
  return ref.dataUrl ?? apiUrl(`/api/maker-files/${encodeURIComponent(ref.id ?? "")}${download ? "?download=1" : ""}`);
}

/** Reduz fotos grandes do celular antes de salvar (máx. 1280 px, JPEG). */
export function resizeImage(file: File, max = 1280): Promise<Blob> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    image.src = url;
  });
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

import express, { Router } from "express";
import { deleteMakerFile, getMakerFile, saveMakerFile } from "../services/maker-files.service.js";

export const makerFilesRouter = Router();

const MAX_FILE_SIZE = "60mb";

// Upload do arquivo bruto: nome e tipo vêm nos cabeçalhos X-File-Name e X-File-Type.
makerFilesRouter.post("/", express.raw({ type: () => true, limit: MAX_FILE_SIZE }), async (request, response, next) => {
  try {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      response.status(400).json({ message: "Arquivo vazio." });
      return;
    }

    const name = decodeURIComponent(String(request.header("x-file-name") ?? "arquivo")).slice(0, 200);
    const type = String(request.header("x-file-type") ?? "application/octet-stream").slice(0, 120);
    const file = await saveMakerFile({ name, type, data: request.body });

    response.status(201).json({ id: file.id, name: file.name, size: file.size, type: file.type });
  } catch (error) {
    next(error);
  }
});

makerFilesRouter.get("/:id", async (request, response, next) => {
  try {
    const file = await getMakerFile(request.params.id);

    if (!file) {
      response.status(404).json({ message: "Arquivo não encontrado." });
      return;
    }

    const disposition = request.query.download ? "attachment" : "inline";
    response.setHeader("Content-Type", file.type || "application/octet-stream");
    response.setHeader("Content-Length", String(file.size));
    response.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    response.send(file.data);
  } catch (error) {
    next(error);
  }
});

makerFilesRouter.delete("/:id", async (request, response, next) => {
  try {
    await deleteMakerFile(request.params.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 4173);

if (!existsSync(indexPath)) {
  console.error("Frontend build was not found. Run `npm run build --workspace frontend` first.");
  process.exit(1);
}

const app = express();

app.use(express.static(distDir));
app.get("*", (_request, response) => {
  response.sendFile(indexPath);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Frontend running on http://0.0.0.0:${port}`);
});

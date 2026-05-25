import { spawn } from "node:child_process";
import "dotenv/config";

function getDatabaseUrl() {
  const directUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRIVATE_URL ||
    process.env.POSTGRES_PUBLIC_URL;

  if (directUrl) {
    return directUrl;
  }

  const host = process.env.PGHOST;
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;

  if (host && user && password && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return undefined;
}

function maskDatabaseUrl(url) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.error("Database URL was not found.");
  console.error("Set one of these variables on the Railway backend service:");
  console.error("- DATABASE_URL");
  console.error("- DATABASE_PRIVATE_URL");
  console.error("- DATABASE_PUBLIC_URL");
  console.error("- POSTGRES_URL");
  console.error("- POSTGRES_PRIVATE_URL");
  console.error("- POSTGRES_PUBLIC_URL");
  console.error("Or set PGHOST, PGPORT, PGUSER, PGPASSWORD, and PGDATABASE.");
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;
console.log(`Using database: ${maskDatabaseUrl(databaseUrl)}`);

await run("npx", ["prisma", "migrate", "deploy"]);
await run("node", ["dist/server.js"]);

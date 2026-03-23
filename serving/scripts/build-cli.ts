import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist", "cli");

async function build() {
  console.log("Cleaning dist/cli...");
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  console.log("Compiling with ESBuild...");
  // Bundle all our first-party code but leave complex native modules external.
  // This allows the CLI to run immediately from the folder without needing a full project set up.
  execSync(
    `npx esbuild bin/modern-web.ts --bundle --platform=node --format=esm --target=node20 \\
      --external:@lancedb/lancedb \\
      --external:@huggingface/transformers \\
      --external:onnxruntime-node \\
      --external:sharp \\
      --outfile=dist/cli/modern-web.mjs`,
    { cwd: ROOT_DIR, stdio: "inherit" }
  );

  console.log("Preparing standalone package.json...");
  const pkgStr = await fs.readFile(path.join(ROOT_DIR, "package.json"), "utf8");
  const pkg = JSON.parse(pkgStr);

  const standalonePkg = {
    name: "modern-web-cli",
    version: pkg.version,
    type: "module",
    bin: {
      "modern-web": "./modern-web.mjs",
    },
    // We only preserve the specific native dependencies that ESbuild cannot safely flat-bundle.
    dependencies: {
      "@lancedb/lancedb": pkg.dependencies["@lancedb/lancedb"],
      "@huggingface/transformers": pkg.dependencies["@huggingface/transformers"],
    },
  };

  await fs.writeFile(
    path.join(DIST_DIR, "package.json"),
    JSON.stringify(standalonePkg, null, 2)
  );

  console.log("Installing native dependencies for standalone distribution...");
  execSync("npm install --omit=dev --no-package-lock", {
    cwd: DIST_DIR,
    stdio: "inherit",
  });

  console.log("\\n✅ Build complete! The executable is located at dist/cli/modern-web.mjs.");
  console.log("To distribute, you can zip the 'dist/cli' directory.");
  console.log("Users can use the CLI directly from that directory without running npm install themselves.");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

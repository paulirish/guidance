import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import * as esbuild from "esbuild";
import { scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";
import { rootDir } from "../../lib/paths.ts";

const SERVING_DIR = path.join(rootDir, "serving");
const ROOT_DIST_DIR = path.join(rootDir, "dist");
const PUBLISH_ROOT = path.join(ROOT_DIST_DIR, "skills-cli");

const DIST_DIR = path.join(PUBLISH_ROOT, "skills/modern-web-use-cases");

interface BuildResult {
  featuresCount: number;
  useCasesCount: number;
  skillsCount: number;
  skillNames: string[];
}

async function main(): Promise<BuildResult | undefined> {
  fs.mkdirSync(ROOT_DIST_DIR, { recursive: true });
  const lockFilePath = path.join(ROOT_DIST_DIR, "build-dist.lock");

  if (fs.existsSync(lockFilePath)) {
    const existingPid = parseInt(fs.readFileSync(lockFilePath, "utf8"), 10);
    let isStale = false;
    try {
      process.kill(existingPid, 0);
    } catch (e) {
      isStale = true;
    }

    if (isStale) {
      console.log(` Stale lock file found (PID ${existingPid} not running). Removing...`);
      fs.unlinkSync(lockFilePath);
    } else {
      console.log(` Another build is in progress (PID ${existingPid}). Waiting for it to finish...`);
      while (fs.existsSync(lockFilePath)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      console.log(" Previous build finished. Skipping rebuild.");
      return;
    }
  }
  fs.writeFileSync(lockFilePath, process.pid.toString());

  try {
    console.log("Ensuring dist/ output directory exists...");
    fs.mkdirSync(PUBLISH_ROOT, { recursive: true });

  console.log("Generating guides and updating vector store...");
  // 1. Run build-guides.ts to update .modern-web-data and build/guides
  try {
    console.time("⏳ build-guides.ts");
    execSync("node --experimental-strip-types scripts/build-guides.ts", {
      cwd: SERVING_DIR,
      stdio: "inherit",
    });
    console.timeEnd("⏳ build-guides.ts");
  } catch (error) {
    console.error("Failed to build guides:", error);
    process.exit(1);
  }

  // Placing modern-web.mjs inside the skill directory instead of bin/ for self-containment!

  console.log("Copying installation manifests and metadata for AI tools...");
  fs.cpSync(path.join(SERVING_DIR, "skills-cli/template"), PUBLISH_ROOT, { recursive: true });


  console.log("Copying data files...");

  // 4. Copy build/guides
  const buildGuidesDir = path.join(SERVING_DIR, "build/guides");
  const destBuildGuidesDir = path.join(DIST_DIR, "guides");
  if (fs.existsSync(buildGuidesDir)) {
    fs.cpSync(buildGuidesDir, destBuildGuidesDir, { recursive: true });
    console.log(`Copied ${buildGuidesDir} to ${destBuildGuidesDir}`);
  } else {
    console.warn(`Warning: ${buildGuidesDir} does not exist.`);
  }

  console.log("Copying pure JS vector file...");
  const vectorsFile = path.join(SERVING_DIR, "lib/use-cases.vectors.gen.json.gz");
  const destVectorsFile = path.join(DIST_DIR, "use-cases.vectors.gen.json.gz");
  if (fs.existsSync(vectorsFile)) {
    fs.cpSync(vectorsFile, destVectorsFile);
    console.log(`Copied ${vectorsFile} to ${destVectorsFile}`);
  }

  console.log("Copying TFJS model files...");
  const tfjsModelDir = path.join(SERVING_DIR, "lib/tfjs_model_minilm");
  const destTfjsModelDir = path.join(DIST_DIR, "tfjs_model_minilm");
  if (fs.existsSync(tfjsModelDir)) {
    fs.cpSync(tfjsModelDir, destTfjsModelDir, {
      recursive: true,
      filter: (src) => {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) return true;
        const basename = path.basename(src);
        return basename === "model.json" || basename.startsWith("group1-shard");
      }
    });
    console.log(`Copied ${tfjsModelDir} to ${destTfjsModelDir}`);
  }

  try {
    console.log("Bundling search.mjs...");
    // To analyze bundle size breakdown, assign build()s return to `result` and use `esbuild.analyzeMetafile(result.metafile)`
    await esbuild.build({
      entryPoints: [path.join(SERVING_DIR, "lib/search.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(PUBLISH_ROOT, "skills/modern-web-use-cases/search.mjs"),
      banner: {
        js: `// @ts-nocheck\nimport { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
      },
      external: ["sharp", "iconv-lite", "@img/colour", "tr46", "whatwg-url", "webidl-conversions"],
      sourcemap: true,
      loader: { ".node": "file" },
      metafile: true,
      minify: true,
      alias: {
        // Force transformers to use the ESM entry point to avoid CommonJS issues in the bundle
        "@huggingface/transformers": path.resolve(SERVING_DIR, "../node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/src/tokenizers.js"),
        // We leverage Transformers.js only for tokenization. But it is a large dependency and
        // tries to do a lot more, including loading native dependencies (onnxruntime-node) that
        // we have no use for. We use this dummy shim to ensure we can use the library without
        // pulling in native binaries.
        "onnxruntime-node": path.resolve(SERVING_DIR, "lib/dummy-onnx.ts"),
      },
      plugins: [{
        // TFJS deep imports fail in pure Node ESM because they lack extensions.
        // In raw Node runs, tfjs-kernels.ts uses require() to load the CommonJS version (all kernels).
        // For the production bundle, we use this plugin to swap it with tfjs-kernels-precise.ts
        // which only registers the specific kernels we need, keeping the bundle small.
        name: 'use-precise-kernels',
        setup(build) {
          build.onResolve({ filter: /tfjs-kernels\.ts$/ }, _args => {
            return { path: path.resolve(SERVING_DIR, "lib/tfjs-kernels-precise.ts") }
          })
        },
      }],
    });

    console.log("Bundling modern-web.mjs...");
    await esbuild.build({
      entryPoints: [path.join(SERVING_DIR, "bin/modern-web.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(PUBLISH_ROOT, "skills/modern-web-use-cases/modern-web.mjs"),
      plugins: [{
        name: 'rewrite-search',
        setup(build) {
          build.onResolve({ filter: /search\.ts$/ }, _args => {
            return { path: './search.mjs', external: true }
          })
        },
      }],
      loader: { ".node": "file" },
    });

  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }



  console.log("Scanning for skills (SKILL.md) in guides/...");
  const guidesDirInRoot = path.join(rootDir, "guides");
  const candidates = fs.readdirSync(guidesDirInRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name);

  let skillsCount = 0;
  const skillNames: string[] = [];
  for (const candidate of candidates) {
    const skillSource = path.join(guidesDirInRoot, candidate, "SKILL.md");
    if (fs.existsSync(skillSource)) {
      const skillDestDir = path.join(PUBLISH_ROOT, "skills", candidate);
      const skillDest = path.join(skillDestDir, "SKILL.md");
      fs.mkdirSync(skillDestDir, { recursive: true });
      fs.copyFileSync(skillSource, skillDest);
      console.log(`Copied skill ${candidate} (SKILL.md) to ${skillDestDir}`);
      skillsCount++;
      skillNames.push(candidate);
    }
  }
  console.log(`Successfully copied ${skillsCount} skills to distribution.`);

  const { featuresCount, useCasesCount } = updateReadmeWithFeaturesAndUseCases(PUBLISH_ROOT);

  let nodeModulesValid = false;
  if (fs.existsSync(path.join(PUBLISH_ROOT, "node_modules"))) {
    try {
      // npm ls will exit with code 0 if all dependencies are satisfied according to package.json!
      execSync("npm ls --depth=0", { cwd: PUBLISH_ROOT, stdio: "ignore" });
      nodeModulesValid = true;
    } catch {
      nodeModulesValid = false;
    }
  }

  const sourcePkgJson = path.join(SERVING_DIR, "skills-cli/template/package.json");
  const destShrinkwrap = path.join(PUBLISH_ROOT, "npm-shrinkwrap.json");

  let shrinkwrapUpToDate = false;
  if (fs.existsSync(destShrinkwrap) && fs.existsSync(sourcePkgJson)) {
    const sourceStat = fs.statSync(sourcePkgJson);
    const destStat = fs.statSync(destShrinkwrap);
    shrinkwrapUpToDate = destStat.mtime >= sourceStat.mtime;
  }

  const forcePublish = process.argv.includes("--force-publish") || !nodeModulesValid || !shrinkwrapUpToDate;

  if (!forcePublish) {
    console.log("Reusing valid node_modules in published root (npm ls passed). Pass --force-publish to overwrite.");
  } else {
    console.log("Installing dependencies and generating npm shrinkwrap in published root (so local dev matches publish)...");
    try {
      console.time("⏳ npm install & shrinkwrap");
      execSync("npm install --omit=dev", { cwd: PUBLISH_ROOT, stdio: "inherit" });
      execSync("npm shrinkwrap", { cwd: PUBLISH_ROOT, stdio: "inherit" });
      console.timeEnd("⏳ npm install & shrinkwrap");
    } catch (error) {
      console.error("Failed to run npm install or shrinkwrap:", error);
      process.exit(1);
    }
  }

  console.log("\nSuccess! standalone distribution generated in dist/skills-cli/");
  return { featuresCount, useCasesCount, skillsCount, skillNames };
  } finally {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  }
}

function updateReadmeWithFeaturesAndUseCases(publishRoot: string) {
  console.log("Generating dynamic README content around features and use cases...");
  const readyGuides = scanAllGuides().filter(inv => inv.hasGuide);

  const useCaseGroupMap = new Map<string, { features: { id: string; name: string }[]; useCases: { id: string; description: string }[] }>();
  const allFeatureIds = new Set<string>();

  for (const guide of readyGuides) {
    const guidePath = path.join(guide.dir, "guide.md");
    if (!fs.existsSync(guidePath)) continue;

    let description = guide.name;
    try {
      const content = fs.readFileSync(guidePath, "utf-8");
      const { data } = matter(content);
      if (data.description) description = data.description;
    } catch {}

    const sortedFeatureIds = [...guide.featureIds].sort();
    const signature = sortedFeatureIds.join(',');

    sortedFeatureIds.forEach(id => allFeatureIds.add(id));

    if (!useCaseGroupMap.has(signature)) {
       const features = sortedFeatureIds.map(fId => ({ id: fId, name: getFeatureName(fId) }));
       useCaseGroupMap.set(signature, { features, useCases: [] });
    }
    useCaseGroupMap.get(signature)!.useCases.push({ id: guide.name, description });
  }

  // Sort groups alphabetically by the name of their first feature
  const sortedGroups = Array.from(useCaseGroupMap.values()).sort((a, b) => a.features[0].name.localeCompare(b.features[0].name));

  // Determine all features to generate the summary text
  const allFeaturesSorted = Array.from(allFeatureIds)
    .map(fId => ({ id: fId, name: getFeatureName(fId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let version = "unknown";
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(publishRoot, "package.json"), "utf8"));
    if (pkgJson.version) version = pkgJson.version;
  } catch {}

  let dynamicMd = `#### Skill Coverage in \`v${version}\`\n\n`;
  const featureNamesCsv = allFeaturesSorted.map(f => `\`${f.name.replace(/</g, '&lt;')}\``).join(', ');

  dynamicMd += `<details>\n<summary><strong>${allFeaturesSorted.length} web features with implementation guidance from Chrome's experts</strong>: ${featureNamesCsv}</summary>\n\n`;

  for (const group of sortedGroups) {
    const featureLinks = group.features.map(f => `[${f.name.replace(/</g, '&lt;')}](https://webstatus.dev/features/${f.id})`).join(', ');
    dynamicMd += `- **${featureLinks}**\n`;
    for (const uc of group.useCases) {
      dynamicMd += `  - **${uc.id}**: ${uc.description}\n`;
    }
  }
  dynamicMd += `</details>\n\n`;

  // Update README
  const readmePath = path.join(publishRoot, "README.md");
  if (fs.existsSync(readmePath)) {
    let readmeContent = fs.readFileSync(readmePath, "utf-8");
    readmeContent = readmeContent.replace('## Installation', dynamicMd + '\n\n## Installation');
    fs.writeFileSync(readmePath, readmeContent);
    console.log("README dynamically updated with features and use cases.");
  }

  return { featuresCount: allFeaturesSorted.length, useCasesCount: readyGuides.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { main as buildDist };

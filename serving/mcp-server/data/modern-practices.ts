import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory in ESM or CJS gracefully
const getDirname = () => {
  if (typeof __dirname !== "undefined") return __dirname;
  // @ts-ignore
  if (typeof import.meta !== "undefined" && import.meta.url) return path.dirname(fileURLToPath(import.meta.url));
  return process.cwd();
};
const _dirname = getDirname();



import { USE_CASES } from "./use-cases.gen.ts";



import type { UseCase } from "./use-cases.gen.ts";







export type { UseCase };

// Re-export USE_CASES so other files can use it
export { USE_CASES };

export function getUseCasesByCategory(category?: string): UseCase[] {
  if (!category) return USE_CASES;
  return USE_CASES.filter((u) => u.category === category);
}

export async function getGuide(useCaseId: string): Promise<string | null> {
  const useCase = USE_CASES.find((u) => u.id === useCaseId);
  if (!useCase) return null;

  const guidesDir = path.resolve(_dirname, "../../build/guides");
  const filePath = path.join(guidesDir, useCase.category, `${useCaseId}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Re-throw real errors
    throw error;
  }
}

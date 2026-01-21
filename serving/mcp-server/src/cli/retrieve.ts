#!/usr/bin/env node
import { getGuide } from "../data/modern-practices.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Error: use_case_id required");
    console.error("Usage: node retrieve.js <use_case_id>");
    process.exit(1);
  }

  const useCaseId = args[0];

  try {
    const content = await getGuide(useCaseId);
    
    if (!content) {
      console.error(`Error: Guide not found for use case "${useCaseId}"`);
      process.exit(1);
    }

    console.log(content);
  } catch (error) {
    console.error(`Error retrieving guide "${useCaseId}":`, error);
    process.exit(1);
  }
}

main();

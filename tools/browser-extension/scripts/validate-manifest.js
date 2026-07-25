#!/usr/bin/env node
// scripts/validate-manifest.js

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "..", "manifest.json");
const REQUIRED_FILES = [
  "popup.html",
  "popup.js",
  "service_worker.js",
  "content/jobs.js",
  "icon.png",
];

function validateManifest() {
  console.log("🔍 Validating manifest.json...\n");

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("❌ manifest.json file not found!");
    process.exit(1);
  }

  let manifest;
  try {
    const content = fs.readFileSync(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(content);
    console.log("✅ manifest.json is valid JSON");
  } catch (error) {
    console.error("❌ manifest.json JSON parse error:", error.message);
    process.exit(1);
  }

  if (manifest.manifest_version !== 3) {
    console.error("❌ manifest_version must be 3!");
    process.exit(1);
  }
  console.log("✅ manifest_version: 3");

  const requiredFields = ["name", "version", "description"];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      console.error(`❌ Missing required field: ${field}`);
      process.exit(1);
    }
  }
  console.log("✅ All required fields present");

  const rootDir = path.join(__dirname, "..");
  let missingFiles = false;

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required file missing: ${file}`);
      missingFiles = true;
    } else {
      console.log(`✅ File present: ${file}`);
    }
  }

  if (missingFiles) {
    process.exit(1);
  }

  if (manifest.content_scripts) {
    for (const script of manifest.content_scripts) {
      for (const jsFile of script.js || []) {
        const scriptPath = path.join(rootDir, jsFile);
        if (!fs.existsSync(scriptPath)) {
          console.error(`❌ Content script missing: ${jsFile}`);
          process.exit(1);
        }
      }
    }
    console.log("✅ All content scripts present");
  }

  if (manifest.background?.service_worker) {
    const workerPath = path.join(rootDir, manifest.background.service_worker);
    if (!fs.existsSync(workerPath)) {
      console.error(`❌ Service worker missing: ${manifest.background.service_worker}`);
      process.exit(1);
    }
    console.log("✅ Service worker present");
  }

  console.log("\n🎉 Manifest validation successful!");
}

try {
  validateManifest();
} catch (error) {
  console.error("\n❌ Unexpected error:", error.message);
  process.exit(1);
}

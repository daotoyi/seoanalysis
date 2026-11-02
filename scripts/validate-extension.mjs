import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { translationKeys } from "../src/i18n.js";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const requiredFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
  "src/engine.js",
  "src/i18n.js",
  "vendor/lucide.min.js",
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])])
];

const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
if (!manifest.name || !manifest.version) errors.push("name and version are required");

for (const relativePath of new Set(requiredFiles)) {
  try {
    const info = await stat(path.join(root, relativePath));
    if (!info.isFile() || info.size === 0) errors.push(`${relativePath} is empty`);
  } catch {
    errors.push(`${relativePath} is missing`);
  }
}

const sensitiveHosts = manifest.host_permissions.filter((host) => host === "<all_urls>");
if (sensitiveHosts.length) errors.push("Do not request <all_urls>");

const enKeys = new Set(translationKeys("en"));
const zhKeys = new Set(translationKeys("zh"));
for (const key of enKeys) {
  if (!zhKeys.has(key)) errors.push(`Missing Chinese translation: ${key}`);
}
for (const key of zhKeys) {
  if (!enKeys.has(key)) errors.push(`Missing English translation: ${key}`);
}

for (const page of ["src/popup.html", "src/options.html", "src/welcome.html"]) {
  const html = await readFile(path.join(root, page), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(
    (match) => match[1]
  );
  for (const key of keys) {
    if (!enKeys.has(key)) errors.push(`${page} references missing translation: ${key}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Manifest valid. Checked ${new Set(requiredFiles).size} referenced files.`);

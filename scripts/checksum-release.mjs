#!/usr/bin/env node
/**
 * Write SHA-256 checksums for release artifacts.
 *
 * Usage:
 *   node scripts/checksum-release.mjs <file-or-dir> [more...]
 *   node scripts/checksum-release.mjs --out SHA256SUMS.txt <path>
 *
 * Prints GNU-style lines: `<hash>  <basename>`
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
let outFile = null;
const inputs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") {
    outFile = args[++i];
    continue;
  }
  inputs.push(args[i]);
}

if (!inputs.length) {
  console.error("Usage: node scripts/checksum-release.mjs [--out SHA256SUMS.txt] <file-or-dir>...");
  process.exit(1);
}

async function collectFiles(entry, acc = []) {
  const s = await stat(entry);
  if (s.isFile()) {
    acc.push(entry);
    return acc;
  }
  if (s.isDirectory()) {
    const kids = await readdir(entry);
    for (const k of kids) {
      await collectFiles(path.join(entry, k), acc);
    }
  }
  return acc;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const files = [];
for (const input of inputs) {
  await collectFiles(path.resolve(input), files);
}

files.sort((a, b) => a.localeCompare(b));
if (!files.length) {
  console.error("No files found.");
  process.exit(1);
}

const lines = [];
for (const file of files) {
  // Skip tiny noise and prior checksum files
  const base = path.basename(file);
  if (base === "SHA256SUMS.txt" || base.endsWith(".sha256")) continue;
  const digest = await sha256File(file);
  lines.push(`${digest}  ${base}`);
  console.log(`${digest}  ${base}`);
}

const body = `${lines.join("\n")}\n`;
if (outFile) {
  await writeFile(outFile, body, "utf8");
  console.error(`Wrote ${outFile} (${lines.length} file(s))`);
}

#!/usr/bin/env node
import { relative } from "node:path";
import { upsertSymbol, listSymbols, removeSymbol } from "./index.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", (err) => reject(err));
  });
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("-v") || args.includes("--version")) {
    console.log("svg2symbol v1.0.0");
    process.exit(0);
  }

  if (args.includes("-h") || args.includes("--help") || (args.length === 0 && process.stdin.isTTY)) {
    console.log(`
svg2symbol - Manage SVG icons as <symbol> in a single SVG sprite

Usage:
  svg2symbol -d <sprite.svg> -n <icon-id> [options]

Parameters:
  -d, -add, --dest <file>    Path to the destination SVG sprite (default: icons.svg)
  -n, -id, --name <id>       Unique symbol ID / name (e.g. "icon-user")
  -p, -f, --path <file>      Path to an individual .svg file
  -c, -raw, --content <svg>  Inline SVG string
  -t, --title <comment>      Descriptive title comment above symbol
  -b, --bypass               Do not overwrite if symbol already exists
  -l, --list                 List all symbols in sprite file
  -rm, --remove <id>         Remove a symbol by ID
  -v, --version              Show version
  -h, --help                 Show this help

Examples:
  # Add or update from SVG file:
  svg2symbol -d public/icons.svg -n "icon-logout" -p "/path/to/logout.svg"

  # Add from stdin / heredoc:
  svg2symbol -d public/icons.svg -n "icon-bell" << 'EOF'
  <svg viewBox="0 0 24 24"><path d="M12 2..." /></svg>
  EOF

  # Pipe directly:
  cat star.svg | svg2symbol -d public/icons.svg -n "icon-star"

  # List existing symbols:
  svg2symbol -d public/icons.svg -l

  # HTML Usage:
  <svg class="icon"><use href="/icons.svg#icon-logout"></use></svg>
`);
    process.exit(0);
  }

  let destFile = "icons.svg";
  let symbolId = "";
  let srcFile = "";
  let rawContent = "";
  let title = "";
  let isList = false;
  let removeId = "";
  let bypass = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-d" || arg === "-add" || arg === "--add" || arg === "--dest") {
      destFile = args[++i] || destFile;
    } else if (arg === "-n" || arg === "-id" || arg === "--name" || arg === "--id") {
      symbolId = args[++i] || "";
    } else if (arg === "-p" || arg === "-f" || arg === "--path" || arg === "--file" || arg === "-s" || arg === "--src") {
      srcFile = args[++i] || "";
    } else if (arg === "-c" || arg === "-raw" || arg === "--content") {
      rawContent = args[++i] || "";
    } else if (arg === "-t" || arg === "-title" || arg === "--title") {
      title = args[++i] || "";
    } else if (arg === "-b" || arg === "-bypass" || arg === "--bypass") {
      bypass = true;
    } else if (arg === "-l" || arg === "-list" || arg === "--list") {
      isList = true;
    } else if (arg === "-rm" || arg === "-del" || arg === "-remove" || arg === "--remove") {
      removeId = args[++i] || "";
    } else if (!symbolId && !arg.startsWith("-")) {
      symbolId = arg;
    }
  }

  // Modo Listar
  if (isList) {
    const symbols = await listSymbols(destFile);
    console.log(`\n📋 Symbols in '${destFile}' (${symbols.length} total):`);
    for (const sym of symbols) {
      console.log(`   - ${sym}`);
    }
    console.log("");
    process.exit(0);
  }

  // Modo Eliminar
  if (removeId) {
    const removed = await removeSymbol(destFile, removeId);
    if (removed) {
      console.log(`✅ Symbol '${removeId}' removed successfully from '${destFile}'.`);
    } else {
      console.warn(`⚠️ Symbol '${removeId}' not found in '${destFile}'.`);
    }
    process.exit(0);
  }

  if (!symbolId) {
    console.error("❌ Error: Symbol ID is required via -n <name> (e.g. -n icon-user).");
    process.exit(1);
  }

  // Leer desde stdin si no hay archivo ni contenido inline
  if (!srcFile && !rawContent) {
    if (!process.stdin.isTTY) {
      const stdinText = await readStdin();
      if (stdinText && stdinText.trim()) {
        rawContent = stdinText;
      }
    } else {
      console.log("ℹ️  Enter SVG content and press Ctrl+D when finished (or use -p <path>):");
      rawContent = await readStdin();
    }
  }

  try {
    const result = await upsertSymbol({
      destFile,
      symbolId,
      srcFile,
      svgContent: rawContent,
      title,
      bypass,
    });

    const actionText =
      result.action === "inserted"
        ? "Inserted new symbol"
        : result.action === "updated"
        ? "Updated existing symbol"
        : "Existing symbol bypassed (kept as-is)";

    console.log(`\n✨ [svg2symbol] ${actionText}:`);
    console.log(`   🆔 ID:       #${result.symbolId}`);
    console.log(`   📐 ViewBox:  ${result.viewBox}`);
    console.log(`   📁 Target:   ${relative(process.cwd(), result.destFile)}`);
    console.log(`   🏷️  HTML:     <svg class="size-4"><use href="/${destFile}#${result.symbolId}"></use></svg>\n`);
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message || err}\n`);
    process.exit(1);
  }
}

runCli();

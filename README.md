# @agarciadelrio/svg2symbol

> High-performance CLI and programmatic TypeScript/JavaScript tool to convert individual SVG icons into clean `<symbol>` elements within a centralized SVG sprite file (`icons.svg`).

[![npm version](https://img.shields.io/npm/v/@agarciadelrio/svg2symbol.svg)](https://www.npmjs.com/package/@agarciadelrio/svg2symbol)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ⚡ Why SVG Sprites with `<symbol>`?

Instead of bloating your HTML and frontend bundles with repetitive inline SVG code or heavy icon webfonts:

- **Ultra Lightweight:** The browser fetches and caches `public/icons.svg` once.
- **Clean HTML / JSX:** Use clean references: `<svg class="size-4"><use href="/icons.svg#icon-user"></use></svg>`.
- **CSS Styled:** Colors and sizing cascade seamlessly using `currentColor` and standard utility classes (Tailwind CSS, DaisyUI, etc.).
- **Zero Framework Lock-in:** Works with React, Vue, Svelte, Alpine.js, Astro, or plain HTML.

---

## 📦 Installation

Install locally in your project:

```bash
# With Bun:
bun add -d @agarciadelrio/svg2symbol

# With npm:
npm install -D @agarciadelrio/svg2symbol

# With pnpm / yarn:
pnpm add -D @agarciadelrio/svg2symbol
yarn add -D @agarciadelrio/svg2symbol
```

Or run instantly without installing:

```bash
bunx @agarciadelrio/svg2symbol --help
# or
npx @agarciadelrio/svg2symbol --help
```

---

## 💻 CLI Usage

```text
svg2symbol -d <dest_sprite.svg> -n <symbol_id> [options]
```

### Options

| Flag | Alias | Description |
|---|---|---|
| `-d`, `--dest` | `-add`, `--add` | Path to destination SVG sprite (default: `icons.svg`) |
| `-n`, `--name` | `-id`, `--id` | Unique ID for the symbol (e.g. `icon-logout`) |
| `-p`, `--path` | `-f`, `--file` | Path to the source `.svg` file |
| `-c`, `--content`| `-raw` | Raw SVG code string |
| `-t`, `--title` | `--title` | Descriptive comment header above symbol |
| `-b`, `--bypass`| `--skip` | Keep existing symbol if ID already exists |
| `-l`, `--list` | `--list` | List all symbol IDs in the sprite |
| `-rm`, `--remove` | `--del` | Remove a symbol by ID from the sprite |
| `-v`, `--version` | | Show version |
| `-h`, `--help` | | Show help |

---

### Examples

#### 1. Add or update from a local file
```bash
npx svg2symbol -d public/icons.svg -n "icon-logout" -p "assets/logout.svg"
```

#### 2. Add via Stdin / Heredoc
```bash
npx svg2symbol -d public/icons.svg -n "icon-bell" << 'EOF'
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
</svg>
EOF
```

#### 3. Pipe from `curl` or `cat`
```bash
curl -s "https://example.com/icon.svg" | npx svg2symbol -d public/icons.svg -n "icon-star"
```

#### 4. List symbols in sprite
```bash
npx svg2symbol -d public/icons.svg -l
```

Output:
```text
📋 Symbols in 'public/icons.svg' (3 total):
   - icon-logout
   - icon-bell
   - icon-star
```

#### 5. Remove a symbol
```bash
npx svg2symbol -d public/icons.svg -rm "icon-star"
```

---

## 🌐 HTML & Frontend Usage

Once added to your sprite file (e.g. `public/icons.svg`), reference any symbol anywhere:

```html
<!-- HTML / Alpine.js / Vanilla -->
<svg class="size-6 text-primary">
  <use href="/icons.svg#icon-logout"></use>
</svg>

<!-- React / JSX -->
<svg className="w-5 h-5 text-gray-700">
  <use href="/icons.svg#icon-bell" />
</svg>
```

---

## 🛠️ Programmatic API

You can also use `svg2symbol` inside your Node.js or Bun build scripts:

```ts
import { upsertSymbol, listSymbols, removeSymbol } from "@agarciadelrio/svg2symbol";

// Add or update an icon
const result = await upsertSymbol({
  destFile: "public/icons.svg",
  symbolId: "icon-home",
  srcFile: "src/raw-icons/home.svg",
  title: "Home Navigation Icon",
});

console.log(result.action); // 'inserted' | 'updated' | 'bypassed'
console.log(result.viewBox); // '0 0 24 24'

// List all symbols
const symbols = await listSymbols("public/icons.svg");
console.log(symbols); // ['icon-logout', 'icon-bell', 'icon-home']

// Remove a symbol
await removeSymbol("public/icons.svg", "icon-home");
```

---

## 📄 License

MIT © [agarciadelrio](https://github.com/agarciadelrio)

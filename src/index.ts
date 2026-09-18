import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

export interface UpsertSymbolOptions {
  destFile: string;
  symbolId: string;
  svgContent?: string;
  srcFile?: string;
  title?: string;
  bypass?: boolean; // Si es true y el símbolo ya existe, no sobrescribe y respeta el original
}

export interface UpsertResult {
  destFile: string;
  symbolId: string;
  action: "inserted" | "updated" | "bypassed";
  viewBox: string;
  symbolLength: number;
}

/** Escapa caracteres especiales de expresiones regulares */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convierte código SVG en un bloque <symbol id="..." viewBox="...">...</symbol>
 * extrayendo atributos viewBox, fill, stroke y estilos esenciales.
 */
export async function svgToSymbolBlock(
  rawSvg: string,
  symbolId: string,
  title?: string
): Promise<{ block: string; viewBox: string }> {
  // Limpiar espacios y cabeceras XML o doctype
  let cleanSvg = rawSvg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .trim();

  // Si ya es un <symbol>, adaptar su id
  const existingSymbolMatch = cleanSvg.match(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/i);
  if (existingSymbolMatch) {
    let attrsStr = existingSymbolMatch[1];
    if (/\bid=["'][^"']*["']/i.test(attrsStr)) {
      attrsStr = attrsStr.replace(/\bid=["'][^"']*["']/i, `id="${symbolId}"`);
    } else {
      attrsStr = ` id="${symbolId}"` + attrsStr;
    }

    const viewBoxMatch = attrsStr.match(/\bviewBox=["']([^"']*)["']/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
    const commentStr = title ? `  <!-- ${title} -->\n` : "";
    return {
      block: `${commentStr}  <symbol${attrsStr}>${existingSymbolMatch[2]}</symbol>`,
      viewBox,
    };
  }

  // Intento opcional de optimización si svgo está disponible en el entorno
  try {
    const svgo = await import("svgo" as any);
    if (svgo && typeof svgo.optimize === "function") {
      const opt = svgo.optimize(cleanSvg, {
        multipass: true,
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                removeHiddenElems: false,
                cleanupIds: false,
              },
            },
          },
        ],
      });
      cleanSvg = opt.data;
    }
  } catch {
    // Si svgo no está presente, continuar normalmente
  }

  const svgMatch = cleanSvg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!svgMatch) {
    throw new Error("El contenido proporcionado no contiene un elemento <svg> o <symbol> válido.");
  }

  const rawAttrs = svgMatch[1];
  const innerContent = svgMatch[2].trim();

  // Parsear atributos del <svg> raíz
  const attrRegex = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  const attrs: Record<string, string> = {};
  let m;
  while ((m = attrRegex.exec(rawAttrs)) !== null) {
    const key = m[1];
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    attrs[key] = val;
  }

  // Determinar viewBox
  let viewBox = attrs["viewBox"] || attrs["viewbox"];
  if (!viewBox && attrs["width"] && attrs["height"]) {
    const w = parseFloat(attrs["width"]);
    const h = parseFloat(attrs["height"]);
    if (!isNaN(w) && !isNaN(h)) {
      viewBox = `0 0 ${w} ${h}`;
    }
  }
  if (!viewBox) {
    viewBox = "0 0 24 24";
  }

  // Atributos útiles a heredar en el símbolo
  const symbolAttrs: string[] = [`id="${symbolId}"`, `viewBox="${viewBox}"`];
  const inheritList = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"];
  for (const attr of inheritList) {
    if (attrs[attr] !== undefined) {
      symbolAttrs.push(`${attr}="${attrs[attr]}"`);
    }
  }

  // Indentar contenido interno con 4 espacios
  const indentedInner = innerContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `    ${line}`)
    .join("\n");

  const commentStr = title ? `  <!-- ${title} -->\n` : "";
  const symbolBlock = `${commentStr}  <symbol ${symbolAttrs.join(" ")}>\n${indentedInner}\n  </symbol>`;

  return { block: symbolBlock, viewBox };
}

/**
 * Añade o actualiza un símbolo dentro del fichero de sprite SVG
 */
export async function upsertSymbol(options: UpsertSymbolOptions): Promise<UpsertResult> {
  const destPath = resolve(options.destFile);
  const symbolId = options.symbolId.trim();

  if (!symbolId) {
    throw new Error("El identificador del icono (-n o --name) no puede estar vacío.");
  }

  let rawSvg = options.svgContent;
  if (!rawSvg && options.srcFile) {
    const srcPath = resolve(options.srcFile);
    if (!existsSync(srcPath)) {
      throw new Error(`Archivo SVG de origen no encontrado: ${options.srcFile}`);
    }
    rawSvg = await readFile(srcPath, "utf-8");
  }

  if (!rawSvg || !rawSvg.trim()) {
    throw new Error("No se proporcionó contenido SVG válido (utiliza srcFile o svgContent).");
  }

  const { block: newSymbolBlock, viewBox } = await svgToSymbolBlock(rawSvg, symbolId, options.title);

  let content = "";
  let fileExisted = existsSync(destPath);

  if (fileExisted) {
    content = await readFile(destPath, "utf-8");
  }

  let action: "inserted" | "updated" = "inserted";
  let updatedContent = "";

  if (!fileExisted || !content.trim()) {
    // Inicializar nuevo archivo de símbolos SVG
    updatedContent = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n${newSymbolBlock}\n</svg>\n`;
    action = "inserted";
  } else {
    // Buscar si ya existe un símbolo con ese id
    const symbolWithCommentRegex = new RegExp(
      `(?:[ \\t]*<!--[^>]*-->\\s*\\n)?[ \\t]*<symbol\\b[^>]*\\bid=["']${escapeRegex(symbolId)}["'][\\s\\S]*?<\\/symbol>`,
      "i"
    );

    if (symbolWithCommentRegex.test(content)) {
      if (options.bypass) {
        const viewBoxMatch = content.match(
          new RegExp(`<symbol\\b[^>]*\\bid=["']${escapeRegex(symbolId)}["'][^>]*\\bviewBox=["']([^"']*)["']`, "i")
        );
        return {
          destFile: destPath,
          symbolId,
          action: "bypassed",
          viewBox: viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24",
          symbolLength: 0,
        };
      }
      updatedContent = content.replace(symbolWithCommentRegex, newSymbolBlock);
      action = "updated";
    } else {
      // Insertar antes del cierre </svg>
      const lastClose = content.lastIndexOf("</svg>");
      if (lastClose !== -1) {
        const before = content.slice(0, lastClose).trimEnd();
        const after = content.slice(lastClose);
        updatedContent = `${before}\n\n${newSymbolBlock}\n${after}`;
      } else {
        updatedContent = `${content}\n${newSymbolBlock}\n</svg>\n`;
      }
      action = "inserted";
    }
  }

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, updatedContent, "utf-8");

  return {
    destFile: destPath,
    symbolId,
    action,
    viewBox,
    symbolLength: newSymbolBlock.length,
  };
}

/**
 * Lista todos los IDs de símbolos presentes en el archivo SVG
 */
export async function listSymbols(destFile: string): Promise<string[]> {
  const destPath = resolve(destFile);
  if (!existsSync(destPath)) return [];

  const text = await readFile(destPath, "utf-8");
  const regex = /<symbol\b[^>]*\bid=["']([^"']+)["']/gi;
  const list: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    list.push(m[1]);
  }
  return list;
}

/**
 * Elimina un símbolo por su ID del archivo de símbolos SVG
 */
export async function removeSymbol(destFile: string, symbolId: string): Promise<boolean> {
  const destPath = resolve(destFile);
  if (!existsSync(destPath)) return false;

  const content = await readFile(destPath, "utf-8");
  const regex = new RegExp(
    `(?:[ \\t]*<!--[^>]*-->\\s*\\n)?[ \\t]*<symbol\\b[^>]*\\bid=["']${escapeRegex(symbolId)}["'][\\s\\S]*?<\\/symbol>\\s*\\n?`,
    "i"
  );

  if (!regex.test(content)) return false;

  const updatedContent = content.replace(regex, "");
  await writeFile(destPath, updatedContent, "utf-8");
  return true;
}

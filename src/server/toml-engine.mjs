import { parse } from 'smol-toml';
import crypto from 'node:crypto';

/**
 * Motor quirúrgico de preservación de TOML (Surgical Round-Trip TOML Engine)
 * Permite modificar claves específicas sin destruir secciones desconocidas,
 * comentarios, espaciado, orden ni tablas personalizadas.
 */

export function computeHash(content) {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}

export function validateToml(tomlString) {
  try {
    const data = parse(tomlString);
    return { valid: true, data, error: null };
  } catch (err) {
    return {
      valid: false,
      data: null,
      error: {
        message: err.message,
        line: err.line ?? null,
        column: err.column ?? null
      }
    };
  }
}

/**
 * Formatea un valor JavaScript a su representación sintáctica TOML válida
 */
export function formatTomlValue(val) {
  if (typeof val === 'string') {
    // Si la cadena ya viene con comillas válidas, usarla o escapar comillas internas y barras
    const escaped = val
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  if (Array.isArray(val)) {
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Escapa caracteres regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Modifica una clave específica dentro de una sección de forma quirúrgica,
 * preservando el 100% del resto del archivo.
 */
export function updateFieldInToml(rawToml, section, key, newValue) {
  const lines = rawToml.split(/\r?\n/);
  const formattedVal = formatTomlValue(newValue);
  const keyRegex = new RegExp(`^(\\s*)${escapeRegex(key)}(\\s*=)(.*)$`);

  if (!section || section === '') {
    // Top-level key (antes de la primera sección [section])
    let updated = false;
    let firstSectionIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\[.*\]\s*$/.test(line)) {
        if (firstSectionIdx === -1) firstSectionIdx = i;
        break;
      }
      if (keyRegex.test(line)) {
        const match = line.match(keyRegex);
        lines[i] = `${match[1]}${key} = ${formattedVal}`;
        updated = true;
        break;
      }
    }

    if (!updated) {
      const newLine = `${key} = ${formattedVal}`;
      if (firstSectionIdx !== -1) {
        lines.splice(firstSectionIdx, 0, newLine);
      } else {
        lines.push(newLine);
      }
    }

    return lines.join('\n');
  }

  // Clave dentro de una sección específica
  const sectionHeaderRegex = new RegExp(`^\\s*\\[\\s*${escapeRegex(section)}\\s*\\]\\s*$`);
  let inTargetSection = false;
  let sectionStartIdx = -1;
  let nextSectionIdx = -1;
  let keyUpdated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*\[.*\]\s*$/.test(line)) {
      if (sectionHeaderRegex.test(line)) {
        inTargetSection = true;
        sectionStartIdx = i;
        continue;
      } else if (inTargetSection) {
        nextSectionIdx = i;
        break;
      }
    }

    if (inTargetSection) {
      if (keyRegex.test(line)) {
        const match = line.match(keyRegex);
        lines[i] = `${match[1]}${key} = ${formattedVal}`;
        keyUpdated = true;
        break;
      }
    }
  }

  if (inTargetSection) {
    if (!keyUpdated) {
      const insertAt = nextSectionIdx !== -1 ? nextSectionIdx : lines.length;
      lines.splice(insertAt, 0, `${key} = ${formattedVal}`);
    }
  } else {
    // La sección no existía: agregarla al final
    lines.push('');
    lines.push(`[${section}]`);
    lines.push(`${key} = ${formattedVal}`);
  }

  return lines.join('\n');
}

/**
 * Aplica un lote de actualizaciones quirúrgicas
 */
export function applyBatchUpdates(rawToml, updates) {
  let current = rawToml;
  for (const { section, key, value } of updates) {
    if (key !== undefined && value !== undefined) {
      current = updateFieldInToml(current, section || '', key, value);
    }
  }

  // Validación final de sintaxis
  const check = validateToml(current);
  if (!check.valid) {
    throw new Error(`Error de sintaxis TOML generado: ${check.error.message}`);
  }

  return current;
}

/**
 * Genera un diff línea por línea legible entre dos versiones de TOML
 */
export function generateDiff(originalText, modifiedText) {
  const origLines = (originalText || '').split(/\r?\n/);
  const modLines = (modifiedText || '').split(/\r?\n/);
  const diff = [];

  const maxLen = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o !== m) {
      if (o !== undefined) diff.push({ type: 'remove', line: i + 1, content: o });
      if (m !== undefined) diff.push({ type: 'add', line: i + 1, content: m });
    }
  }

  return diff;
}

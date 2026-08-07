#!/usr/bin/env node
// Comprueba uno o varios ficheros data/*.json contra las reglas del cuadrante.
// Uso: node scripts/check-roster.mjs [ficheros...]  (por defecto, todos los de data/)
//
// Si se ejecuta dentro de GitHub Actions, escribe en $GITHUB_OUTPUT:
//   hay_incidencias = "true" | "false"
//   detalle          = texto plano con el resumen de incidencias (fallback del email)
//   detalle_html     = versión en HTML del mismo resumen, con sugerencia de solución

import { readFile, appendFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calcularMes, sugerirSolucion, GRUPOS_POR_DEFECTO } from "../docs/rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

async function cargarGrupos() {
  try {
    const contenido = await readFile(path.join(DATA_DIR, "plantilla.json"), "utf8");
    return JSON.parse(contenido).grupos;
  } catch {
    console.warn("⚠️ No se pudo leer data/plantilla.json, usando GRUPOS_POR_DEFECTO.");
    return GRUPOS_POR_DEFECTO;
  }
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

async function ficherosAComprobar() {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const nombres = await readdir(DATA_DIR);
  return nombres
    .filter((n) => n.endsWith(".json") && n !== "plantilla.json")
    .map((n) => path.join(DATA_DIR, n));
}

function formatearFecha(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaLarga(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`;
}

function nombreMesLegible(mesStr) {
  const [anio, mes] = (mesStr || "").split("-").map(Number);
  return mes ? `${MESES[mes - 1]} ${anio}` : mesStr;
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function bloqueIncidenciaHtml(r) {
  const sugerencia = sugerirSolucion(r.resultado);
  return `
    <div style="border-left:4px solid #b91c1c;background:#fef5f5;border-radius:6px;padding:14px 18px;margin-bottom:14px;">
      <div style="font-weight:700;font-size:15px;color:#111827;margin-bottom:6px;">
        Sábado ${escaparHtml(formatearFechaLarga(r.fecha))} — Grupo ${escaparHtml(r.grupo ?? "-")}
      </div>
      <div style="color:#b91c1c;font-weight:600;font-size:13.5px;margin-bottom:10px;">
        ${escaparHtml(r.resultado.incidencias.join(" · "))}
      </div>
      <div style="font-size:14px;color:#333;line-height:1.7;">
        <div><strong>Teléfonos actuales:</strong> ${escaparHtml(r.resultado.telefonos.join(", ") || "—")}</div>
        <div><strong>Mostrador actuales:</strong> ${escaparHtml(r.resultado.mostrador.join(", ") || "—")}</div>
      </div>
      ${
        sugerencia
          ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e2b8b8;font-size:13.5px;color:#444;line-height:1.6;">
              💡 <strong>Sugerencia:</strong> ${escaparHtml(sugerencia)}
             </div>`
          : ""
      }
    </div>`;
}

function generarHtml(bloquesPorMes) {
  const cuerpo = bloquesPorMes
    .map(
      ({ mes, bloques }) => `
        <div style="margin-bottom:22px;">
          <p style="margin:0 0 12px;color:#555;font-size:14px;">Mes: <strong>${escaparHtml(nombreMesLegible(mes))}</strong></p>
          ${bloques.join("")}
        </div>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#b91c1c;color:#fff;padding:16px 22px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">⚠️ Incidencia en el cuadrante de sábados</h1>
    </div>
    <div style="border:1px solid #eee;border-top:none;padding:22px;border-radius:0 0 8px 8px;">
      ${cuerpo}
      <p style="margin-top:8px;font-size:13px;color:#888;line-height:1.6;">
        Revisa y decide cómo cubrirlo desde
        <a href="https://yakobarib.github.io/Cuadrante-Sabados/" style="color:#2563eb;">la web del cuadrante</a>.
      </p>
    </div>
  </div>`;
}

async function main() {
  const grupos = await cargarGrupos();
  const ficheros = await ficherosAComprobar();
  const lineasTexto = [];
  const bloquesPorMesHtml = [];
  let hayIncidencias = false;

  for (const fichero of ficheros) {
    let datos;
    try {
      datos = JSON.parse(await readFile(fichero, "utf8"));
    } catch (e) {
      lineasTexto.push(`⚠️ No se pudo leer/parsear ${fichero}: ${e.message}`);
      hayIncidencias = true;
      continue;
    }

    const resultados = calcularMes(datos, grupos);
    const conIncidencia = resultados.filter((r) => r.resultado.estado === "incidencia");

    console.log(`\n${datos.mes || path.basename(fichero)}:`);
    for (const r of resultados) {
      const etiqueta = r.resultado.festivo ? "FESTIVO" : r.resultado.estado.toUpperCase();
      console.log(`  ${formatearFecha(r.fecha)} — Grupo ${r.grupo ?? "-"} — ${etiqueta}`);
      if (r.resultado.incidencias?.length) {
        console.log(`    ${r.resultado.incidencias.join(" · ")}`);
      }
    }

    if (conIncidencia.length) {
      hayIncidencias = true;
      lineasTexto.push(`Mes ${datos.mes || path.basename(fichero)}:`);
      for (const r of conIncidencia) {
        lineasTexto.push(
          `  - Sábado ${formatearFecha(r.fecha)} (Grupo ${r.grupo ?? "-"}): ${r.resultado.incidencias.join(" · ")}`
        );
        lineasTexto.push(
          `    Teléfonos actuales: ${r.resultado.telefonos.join(", ") || "—"} | Mostrador actuales: ${r.resultado.mostrador.join(", ") || "—"}`
        );
        const sugerencia = sugerirSolucion(r.resultado);
        if (sugerencia) lineasTexto.push(`    Sugerencia: ${sugerencia}`);
      }
      bloquesPorMesHtml.push({
        mes: datos.mes || path.basename(fichero),
        bloques: conIncidencia.map(bloqueIncidenciaHtml),
      });
    }
  }

  console.log(`\n${hayIncidencias ? "❌ Hay incidencias." : "✅ Sin incidencias."}`);

  if (process.env.GITHUB_OUTPUT) {
    const detalle = lineasTexto.join("\n") || "Sin incidencias.";
    const detalleHtml = hayIncidencias
      ? generarHtml(bloquesPorMesHtml)
      : "<p>Sin incidencias.</p>";

    await appendFile(process.env.GITHUB_OUTPUT, `hay_incidencias=${hayIncidencias}\n`);
    const delimitador = "EOF_DETALLE";
    await appendFile(process.env.GITHUB_OUTPUT, `detalle<<${delimitador}\n${detalle}\n${delimitador}\n`);
    const delimitadorHtml = "EOF_DETALLE_HTML";
    await appendFile(process.env.GITHUB_OUTPUT, `detalle_html<<${delimitadorHtml}\n${detalleHtml}\n${delimitadorHtml}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

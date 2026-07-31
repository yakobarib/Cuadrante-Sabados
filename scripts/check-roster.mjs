#!/usr/bin/env node
// Comprueba uno o varios ficheros data/*.json contra las reglas del cuadrante.
// Uso: node scripts/check-roster.mjs [ficheros...]  (por defecto, todos los de data/)
//
// Si se ejecuta dentro de GitHub Actions, escribe en $GITHUB_OUTPUT:
//   hay_incidencias = "true" | "false"
//   detalle          = texto con el resumen de incidencias (para el cuerpo del email)

import { readFile, appendFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calcularMes } from "../docs/rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

async function ficherosAComprobar() {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const nombres = await readdir(DATA_DIR);
  return nombres.filter((n) => n.endsWith(".json")).map((n) => path.join(DATA_DIR, n));
}

function formatearFecha(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

async function main() {
  const ficheros = await ficherosAComprobar();
  const lineas = [];
  let hayIncidencias = false;

  for (const fichero of ficheros) {
    let datos;
    try {
      datos = JSON.parse(await readFile(fichero, "utf8"));
    } catch (e) {
      lineas.push(`⚠️ No se pudo leer/parsear ${fichero}: ${e.message}`);
      hayIncidencias = true;
      continue;
    }

    const resultados = calcularMes(datos);
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
      lineas.push(`Mes ${datos.mes || path.basename(fichero)}:`);
      for (const r of conIncidencia) {
        lineas.push(
          `  - Sábado ${formatearFecha(r.fecha)} (Grupo ${r.grupo ?? "-"}): ${r.resultado.incidencias.join(" · ")}`
        );
        lineas.push(
          `    Teléfonos actuales: ${r.resultado.telefonos.join(", ") || "—"} | Mostrador actuales: ${r.resultado.mostrador.join(", ") || "—"}`
        );
      }
    }
  }

  console.log(`\n${hayIncidencias ? "❌ Hay incidencias." : "✅ Sin incidencias."}`);

  if (process.env.GITHUB_OUTPUT) {
    const detalle = lineas.join("\n") || "Sin incidencias.";
    await appendFile(process.env.GITHUB_OUTPUT, `hay_incidencias=${hayIncidencias}\n`);
    // Formato multilínea para GITHUB_OUTPUT
    const delimitador = "EOF_DETALLE";
    await appendFile(process.env.GITHUB_OUTPUT, `detalle<<${delimitador}\n${detalle}\n${delimitador}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

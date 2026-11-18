// Lee el "Informe calendario" Excel del sistema de horarios y lo convierte en cuadrantes mensuales.
// Se usa desde el navegador (docs/app.js, con ExcelJS cargado desde un CDN) y se puede probar desde Node.
// Equivale a scripts/excel_a_cuadrante.py.

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];
const COLORES = {
  FF8BB8D3: "VAC",
  FFE1D2E7: "PERMISO",
  FFE7C2C4: "BAJA",
  FFEFEFEF: "descanso",
  FF666666: "FESTIVO",
};
const AUSENTE = new Set(["VAC", "PERMISO", "BAJA"]);
export const ETIQUETA_TIPO = { VAC: "vacaciones", PERMISO: "permiso", BAJA: "baja" };

function valorCelda(celda) {
  const v = celda.value;
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

function estadoCelda(celda) {
  const f = celda.fill;
  if (!f) return { tipo: "trabaja", solicitado: false };
  if (f.type === "gradient") {
    return { tipo: COLORES[f.stops?.[0]?.color?.argb] || "otro", solicitado: true };
  }
  if (f.type === "pattern" && f.pattern && f.pattern !== "none") {
    return { tipo: COLORES[f.fgColor?.argb] || "otro", solicitado: f.pattern !== "solid" };
  }
  return { tipo: "trabaja", solicitado: false };
}

function isoLocal(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Lee el Excel y devuelve los sábados con el estado de cada persona conocida.
// nombresExcel: { "PRATS MARI, ANTONIO": "Toni Prats", ... }
export async function leerInforme(ExcelJS, buffer, nombresExcel) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const formatoDesconocido = new Error(
    "No reconozco el formato de este Excel. Tiene que ser el «Informe calendario» del sistema de horarios."
  );
  if (!ws) throw formatoDesconocido;

  const cabeceras = [];
  for (let r = 8; r <= ws.rowCount; r++) {
    if (String(valorCelda(ws.getCell(r, 3)) ?? "").trim() === "TRABAJADOR") cabeceras.push(r);
  }

  const sabados = [];
  const ignorados = new Set();
  const encontrados = new Set();

  for (const h of cabeceras) {
    const titulo = String(valorCelda(ws.getCell(h - 1, 5)) ?? "").trim().split(/\s+/);
    if (titulo.length !== 2 || !MESES.includes(titulo[0].toUpperCase())) continue;
    const mes = MESES.indexOf(titulo[0].toUpperCase()) + 1;
    const anio = Number(titulo[1]);

    const columnas = [];
    for (let c = 5; c <= 35; c++) {
      const dia = valorCelda(ws.getCell(h, c));
      if (typeof dia !== "number") continue;
      const fecha = new Date(anio, mes - 1, dia);
      if (fecha.getMonth() !== mes - 1) continue;
      if (fecha.getDay() === 6) columnas.push({ c, iso: isoLocal(anio, mes, dia) });
    }

    const filas = {};
    for (let r = h + 1; r <= ws.rowCount; r++) {
      const nombreExcel = String(valorCelda(ws.getCell(r, 3)) ?? "").trim();
      if (!nombreExcel || nombreExcel === "TRABAJADOR") break;
      const nombre = nombresExcel[nombreExcel];
      if (nombre) {
        filas[nombre] = r;
        encontrados.add(nombre);
      } else {
        ignorados.add(nombreExcel);
      }
    }

    for (const { c, iso } of columnas) {
      const estados = {};
      for (const [nombre, r] of Object.entries(filas)) estados[nombre] = estadoCelda(ws.getCell(r, c));
      const total = Object.keys(estados).length;
      const festivos = Object.values(estados).filter((e) => e.tipo === "FESTIVO").length;
      sabados.push({ fecha: iso, festivo: total > 0 && festivos > total / 2, estados });
    }
  }

  if (!sabados.length) throw formatoDesconocido;
  sabados.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { sabados, ignorados: [...ignorados], encontrados: [...encontrados] };
}

// Asigna grupos (alternando desde primerGrupo; un sábado festivo también cuenta como turno)
// y apunta como ausentes solo a quien pertenece al grupo de ese día o es "adicional" ese día.
export function construirCuadrantes(sabadosRaw, { primerGrupo, grupos, adicionales = [], incluirSolicitados = false }) {
  const miembros = {};
  for (const [g, v] of Object.entries(grupos)) miembros[g] = new Set([...v.telefonos, ...v.mostrador]);

  const avisos = [];
  const meses = new Map();
  let grupo = primerGrupo;

  for (const s of sabadosRaw) {
    const relevantes = new Set(miembros[String(grupo)] || []);
    for (const a of adicionales) {
      if ((!a.desde || a.desde <= s.fecha) && (!a.hasta || s.fecha <= a.hasta)) relevantes.add(a.persona);
    }
    const ausentes = [];
    if (!s.festivo) {
      for (const [nombre, { tipo, solicitado }] of Object.entries(s.estados)) {
        if (!relevantes.has(nombre)) continue;
        if (AUSENTE.has(tipo)) {
          if (solicitado && !incluirSolicitados) {
            avisos.push(`${s.fecha}: ${nombre} tiene ${ETIQUETA_TIPO[tipo]} solicitada (sin confirmar) — no la cuento como ausencia.`);
          } else {
            ausentes.push(nombre);
          }
        } else if (tipo === "otro") {
          avisos.push(`${s.fecha}: ${nombre} tiene una marca de color que no reconozco — revísalo a mano.`);
        }
      }
    }
    const clave = s.fecha.slice(0, 7);
    if (!meses.has(clave)) meses.set(clave, []);
    meses.get(clave).push({
      fecha: s.fecha,
      grupo,
      festivo: s.festivo,
      ausentes,
      sustituciones: [],
    });
    grupo = grupo === 1 ? 2 : 1;
  }

  return { meses: [...meses].map(([mes, sabados]) => ({ mes, sabados })), avisos };
}

import { GRUPOS, calcularSabado } from "./rules.js";

const OWNER = "yakobarib";
const REPO = "Cuadrante-Sabados";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data`;
const REPO_EDIT_BASE = `https://github.com/${OWNER}/${REPO}/edit/main/data/`;
const TOKEN_KEY = "cuadrante_sabados_gh_token";

const el = (id) => document.getElementById(id);

const selectMes = el("select-mes");
const btnNuevoMes = el("btn-nuevo-mes");
const estadoCarga = el("estado-carga");
const listaSabados = el("lista-sabados");
const barraGuardar = el("barra-guardar");
const btnGuardar = el("btn-guardar");
const estadoGuardado = el("estado-guardado");
const inputToken = el("input-token");
const btnGuardarToken = el("btn-guardar-token");
const btnBorrarToken = el("btn-borrar-token");
const tokenSinConfigurar = el("token-sin-configurar");
const tokenConfigurado = el("token-configurado");
const btnCopiar = el("btn-copiar");
const linkGithub = el("link-github");
const outputJson = el("output-json");
const inputJson = el("input-json");
const btnCargarJson = el("btn-cargar-json");
const btnImprimir = el("btn-imprimir");
const hojaImpresion = el("hoja-impresion");

let mesActual = null;
let sabados = [];
let shaActual = null; // sha del fichero en GitHub, para poder actualizarlo
let ultimoGuardadoJson = null; // snapshot del último estado cargado/guardado, para detectar cambios sin guardar

function snapshotActual() {
  return JSON.stringify({ mes: mesActual, sabados });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function actualizarEstadoToken() {
  const hay = !!getToken();
  tokenSinConfigurar.hidden = hay;
  tokenConfigurado.hidden = !hay;
}

btnGuardarToken.addEventListener("click", () => {
  const valor = inputToken.value.trim();
  if (!valor) return;
  localStorage.setItem(TOKEN_KEY, valor);
  inputToken.value = "";
  actualizarEstadoToken();
});

btnBorrarToken.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  actualizarEstadoToken();
});

// ---------- Cargar lista de meses disponibles ----------

async function cargarListaMeses() {
  try {
    const resp = await fetch(API_BASE);
    if (!resp.ok) throw new Error(`GitHub respondió ${resp.status}`);
    const archivos = await resp.json();
    const meses = archivos
      .filter((f) => f.name.endsWith(".json"))
      .map((f) => f.name.replace(".json", ""))
      .sort();

    selectMes.innerHTML = "";
    if (!meses.length) {
      const opt = document.createElement("option");
      opt.textContent = "No hay meses todavía — crea uno con «+ Nuevo mes»";
      selectMes.appendChild(opt);
      return;
    }
    meses.forEach((mes) => {
      const opt = document.createElement("option");
      opt.value = mes;
      opt.textContent = nombreMesLegible(mes);
      selectMes.appendChild(opt);
    });
    // Selecciona por defecto el último mes (más reciente)
    selectMes.value = meses[meses.length - 1];
    await cargarMes(selectMes.value);
  } catch (e) {
    estadoCarga.textContent = `No se pudo cargar la lista de meses (${e.message}). Puedes cargar un JSON a mano en "Opciones avanzadas".`;
  }
}

selectMes.addEventListener("change", () => {
  if (selectMes.value) cargarMes(selectMes.value);
});

async function cargarMes(mes) {
  estadoCarga.textContent = "Cargando…";
  try {
    const resp = await fetch(`${API_BASE}/${mes}.json`);
    if (!resp.ok) throw new Error(`GitHub respondió ${resp.status}`);
    const meta = await resp.json();
    shaActual = meta.sha;
    const datos = JSON.parse(atob(meta.content));
    mesActual = datos.mes || mes;
    sabados = (datos.sabados || []).map((s) => ({
      fecha: s.fecha,
      grupo: s.grupo ?? null,
      festivo: !!s.festivo,
      ausentes: Array.isArray(s.ausentes) ? [...s.ausentes] : [],
    }));
    estadoCarga.textContent = "";
    ultimoGuardadoJson = snapshotActual();
    render();
  } catch (e) {
    estadoCarga.textContent = `No se pudo cargar ${mes}: ${e.message}`;
  }
}

btnNuevoMes.addEventListener("click", () => {
  const entrada = prompt("¿Qué mes quieres crear? (formato AAAA-MM, ej. 2026-10)");
  if (!entrada || !/^\d{4}-\d{2}$/.test(entrada)) {
    if (entrada) alert("Formato no válido, usa AAAA-MM, por ejemplo 2026-10.");
    return;
  }
  const grupoInicial = confirm("¿El primer sábado lo hace el Grupo 1? (Cancelar = Grupo 2)") ? 1 : 2;
  mesActual = entrada;
  shaActual = null; // fichero nuevo, no existe sha todavía
  sabados = sabadosDelMes(entrada).map((fecha, i) => ({
    fecha,
    grupo: i % 2 === 0 ? grupoInicial : grupoInicial === 1 ? 2 : 1,
    festivo: false,
    ausentes: [],
  }));
  ultimoGuardadoJson = null; // mes nuevo: todavía no existe guardado, siempre "sin guardar"
  render();
  estadoCarga.textContent = `Mes ${entrada} creado. Recuerda guardarlo.`;
});

function sabadosDelMes(mesStr) {
  const [anio, mes] = mesStr.split("-").map(Number);
  const fechas = [];
  const fecha = new Date(anio, mes - 1, 1);
  while (fecha.getMonth() === mes - 1) {
    if (fecha.getDay() === 6) {
      fechas.push(
        `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
          fecha.getDate()
        ).padStart(2, "0")}`
      );
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  return fechas;
}

function nombreMesLegible(mesStr) {
  const [anio, mes] = mesStr.split("-").map(Number);
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${nombres[mes - 1]} ${anio}`;
}

function formatearFechaCorta(fechaIso) {
  const [, mes, dia] = fechaIso.split("-");
  const nombres = [
    "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${Number(dia)} de ${nombres[Number(mes) - 1]}`;
}

// ---------- Render ----------

const ETIQUETAS_ESTADO = {
  ok: "✅ OK",
  minimo: "🟡 MÍNIMO",
  incidencia: "🔴 INCIDENCIA",
  festivo: "⬜ FESTIVO",
};

function render() {
  listaSabados.innerHTML = "";
  barraGuardar.hidden = sabados.length === 0;

  sabados.forEach((sabado) => {
    listaSabados.appendChild(renderTarjeta(sabado));
  });

  actualizarSalidaJson();
  actualizarAvisoSinGuardar();
}

function actualizarAvisoSinGuardar() {
  const sinGuardar = !!mesActual && snapshotActual() !== ultimoGuardadoJson;
  btnGuardar.classList.toggle("parpadeando", sinGuardar);
  if (sinGuardar && !estadoGuardado.textContent) {
    estadoGuardado.textContent = "Tienes cambios sin guardar";
  } else if (!sinGuardar && estadoGuardado.textContent === "Tienes cambios sin guardar") {
    estadoGuardado.textContent = "";
  }
}

function renderTarjeta(sabado) {
  const resultado = calcularSabado(sabado);

  const tarjeta = document.createElement("article");
  tarjeta.className = `tarjeta estado-${resultado.estado}`;

  const cabecera = document.createElement("div");
  cabecera.className = "tarjeta-cabecera";
  cabecera.innerHTML = `
    <h2>Sábado ${formatearFechaCorta(sabado.fecha)}</h2>
    <span class="pill pill-${resultado.estado}">${ETIQUETAS_ESTADO[resultado.estado]}</span>
  `;
  tarjeta.appendChild(cabecera);

  const controles = document.createElement("div");
  controles.className = "tarjeta-controles";

  const btnFestivo = document.createElement("button");
  btnFestivo.type = "button";
  btnFestivo.className = "toggle" + (sabado.festivo ? " activo" : "");
  btnFestivo.textContent = "Festivo";
  btnFestivo.addEventListener("click", () => {
    sabado.festivo = !sabado.festivo;
    render();
  });
  controles.appendChild(btnFestivo);

  [1, 2].forEach((g) => {
    const btnGrupo = document.createElement("button");
    btnGrupo.type = "button";
    btnGrupo.className = "toggle" + (Number(sabado.grupo) === g ? " activo" : "");
    btnGrupo.textContent = `Grupo ${g}`;
    btnGrupo.addEventListener("click", () => {
      sabado.grupo = g;
      sabado.ausentes = [];
      render();
    });
    controles.appendChild(btnGrupo);
  });

  tarjeta.appendChild(controles);

  if (resultado.festivo) {
    const nota = document.createElement("p");
    nota.className = "nota-festivo";
    nota.textContent = "No hay actividad este sábado.";
    tarjeta.appendChild(nota);
    return tarjeta;
  }

  if (!sabado.grupo) {
    const nota = document.createElement("p");
    nota.className = "nota-festivo";
    nota.textContent = "Elige un grupo para este sábado.";
    tarjeta.appendChild(nota);
    return tarjeta;
  }

  const g = GRUPOS[sabado.grupo];
  const columnas = document.createElement("div");
  columnas.className = "columnas-roles";
  columnas.appendChild(renderColumnaPersonas("☎ Teléfonos", g.telefonos, sabado));
  columnas.appendChild(renderColumnaPersonas("🧾 Mostrador", g.mostrador, sabado));
  tarjeta.appendChild(columnas);

  const resumen = document.createElement("div");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <div><strong>Cubren Teléfonos (${resultado.telefonos.length}):</strong> ${resultado.telefonos.join(", ") || "—"}</div>
    <div><strong>Cubren Mostrador (${resultado.mostrador.length}):</strong> ${resultado.mostrador.join(", ") || "—"}</div>
  `;
  if (resultado.incidencias.length) {
    const aviso = document.createElement("div");
    aviso.className = "aviso-incidencia";
    aviso.textContent = resultado.incidencias.join(" · ");
    resumen.appendChild(aviso);
  }
  tarjeta.appendChild(resumen);

  return tarjeta;
}

function renderColumnaPersonas(titulo, personas, sabado) {
  const columna = document.createElement("div");
  columna.className = "columna-personas";
  const h3 = document.createElement("h3");
  h3.textContent = titulo;
  columna.appendChild(h3);

  const chips = document.createElement("div");
  chips.className = "chips";
  personas.forEach((persona) => {
    const ausente = sabado.ausentes.includes(persona);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (ausente ? " ausente" : "");
    chip.textContent = persona;
    chip.title = ausente ? "Ausente — pulsa para marcar como disponible" : "Disponible — pulsa para marcar ausente";
    chip.addEventListener("click", () => {
      if (ausente) {
        sabado.ausentes = sabado.ausentes.filter((p) => p !== persona);
      } else {
        sabado.ausentes.push(persona);
      }
      render();
    });
    chips.appendChild(chip);
  });
  columna.appendChild(chips);
  return columna;
}

function actualizarSalidaJson() {
  if (!mesActual) return;
  const datos = { mes: mesActual, sabados };
  outputJson.value = JSON.stringify(datos, null, 2);
  linkGithub.href = `${REPO_EDIT_BASE}${mesActual}.json`;
  linkGithub.textContent = `Abrir data/${mesActual}.json en GitHub →`;
}

btnCopiar.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputJson.value);
    btnCopiar.textContent = "¡Copiado!";
    setTimeout(() => (btnCopiar.textContent = "Copiar JSON del mes"), 1500);
  } catch {
    outputJson.select();
    document.execCommand("copy");
  }
  // Se asume que va a pegarlo en GitHub a continuación: dejamos de avisar de cambios sin guardar.
  ultimoGuardadoJson = snapshotActual();
  actualizarAvisoSinGuardar();
});

btnCargarJson.addEventListener("click", () => {
  try {
    const datos = JSON.parse(inputJson.value);
    mesActual = datos.mes;
    shaActual = null;
    sabados = (datos.sabados || []).map((s) => ({
      fecha: s.fecha,
      grupo: s.grupo ?? null,
      festivo: !!s.festivo,
      ausentes: Array.isArray(s.ausentes) ? [...s.ausentes] : [],
    }));
    ultimoGuardadoJson = snapshotActual();
    render();
  } catch (e) {
    alert("El JSON no es válido: " + e.message);
  }
});

// ---------- Impresión (A4) ----------

function formatearFechaDDMM(fechaIso) {
  const [, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}`;
}

function formatearFechaLarga(fechaIso) {
  const [, mes, dia] = fechaIso.split("-");
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${Number(dia)} de ${nombres[Number(mes) - 1]}`;
}

function renderBloqueImpresion(sabado, numero) {
  const resultado = calcularSabado(sabado);

  if (resultado.festivo) {
    const grupoTexto = sabado.grupo ? ` Grupo ${sabado.grupo}` : "";
    return `
      <section class="bloque-fin-semana">
        <h2>${numero}. Sábado ${formatearFechaLarga(sabado.fecha)} — Festivo${grupoTexto}</h2>
        <p class="nota-festivo-impresion">No hay actividad este sábado.</p>
      </section>
    `;
  }

  const itemsPersonas = (personas) => personas.map((p) => `<li>${p}</li>`).join("");
  const incidencia = resultado.incidencias.length
    ? `<p class="incidencia-impresion">⚠ ${resultado.incidencias.join(" · ")}</p>`
    : "";

  return `
    <section class="bloque-fin-semana">
      <h2>${numero}. Sábado ${formatearFechaLarga(sabado.fecha)} — Grupo ${sabado.grupo}</h2>
      <ul class="lista-roles">
        <li class="rol">
          <span class="etiqueta-rol">Teléfonos</span>
          <ul class="lista-personas">${itemsPersonas(resultado.telefonos)}</ul>
        </li>
        <li class="rol">
          <span class="etiqueta-rol">Mostrador</span>
          <ul class="lista-personas">${itemsPersonas(resultado.mostrador)}</ul>
        </li>
      </ul>
      ${incidencia}
    </section>
  `;
}

function generarHojaImpresion() {
  hojaImpresion.innerHTML = `
    <h1>Cuadrante Sábados</h1>
    <p class="subtitulo-impresion">${nombreMesLegible(mesActual).replace(/^./, (c) => c.toUpperCase())}</p>
    ${sabados.map((s, i) => renderBloqueImpresion(s, i + 1)).join("")}
  `;
}

btnImprimir.addEventListener("click", () => {
  if (!mesActual || !sabados.length) return;
  generarHojaImpresion();
  window.print();
});

// ---------- Guardado ----------

btnGuardar.addEventListener("click", async () => {
  const token = getToken();
  if (!token) {
    estadoGuardado.textContent = "";
    document.getElementById("opciones-avanzadas").open = true;
    alert(
      'No tienes guardado automático configurado. Usa "Copiar JSON del mes" y pégalo en GitHub (sección "Guardado manual" abajo), o configura el token en "Guardado automático".'
    );
    return;
  }

  btnGuardar.disabled = true;
  estadoGuardado.textContent = "Guardando…";
  try {
    const datos = { mes: mesActual, sabados };
    const contenido = btoa(unescape(encodeURIComponent(JSON.stringify(datos, null, 2))));
    const resp = await fetch(`${API_BASE}/${mesActual}.json`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        message: `Actualizar cuadrante de ${mesActual}`,
        content: contenido,
        sha: shaActual || undefined,
      }),
    });
    if (!resp.ok) {
      const detalle = await resp.json().catch(() => ({}));
      throw new Error(detalle.message || `GitHub respondió ${resp.status}`);
    }
    const resultado = await resp.json();
    shaActual = resultado.content.sha;
    ultimoGuardadoJson = snapshotActual();
    estadoGuardado.textContent = "✅ Guardado. Si hay alguna incidencia, te llegará un email en breve.";
    actualizarAvisoSinGuardar();
    await cargarListaMesesSinRecargar();
  } catch (e) {
    estadoGuardado.textContent = `❌ Error al guardar: ${e.message}`;
  } finally {
    btnGuardar.disabled = false;
  }
});

async function cargarListaMesesSinRecargar() {
  try {
    const resp = await fetch(API_BASE);
    if (!resp.ok) return;
    const archivos = await resp.json();
    const meses = archivos.filter((f) => f.name.endsWith(".json")).map((f) => f.name.replace(".json", "")).sort();
    const valorPrevio = selectMes.value;
    selectMes.innerHTML = "";
    meses.forEach((mes) => {
      const opt = document.createElement("option");
      opt.value = mes;
      opt.textContent = nombreMesLegible(mes);
      selectMes.appendChild(opt);
    });
    selectMes.value = meses.includes(valorPrevio) ? valorPrevio : mesActual;
  } catch {
    /* no crítico */
  }
}

// ---------- Arranque ----------

actualizarEstadoToken();
cargarListaMeses();

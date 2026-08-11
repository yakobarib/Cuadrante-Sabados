import { GRUPOS_POR_DEFECTO, calcularSabado, personasDeGrupos } from "./rules.js";

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
const personalRender = el("personal-render");
const btnGuardarPersonal = el("btn-guardar-personal");
const estadoPersonal = el("estado-personal");
const btnTema = el("btn-tema");
const btnAyuda = el("btn-ayuda");
const btnAjustes = el("btn-ajustes");
const btnLogin = el("btn-login");
const modalAyuda = el("modal-ayuda");
const modalAjustes = el("modal-ajustes");
const modalLogin = el("modal-login");

let mesActual = null;
let sabados = [];
let shaActual = null; // sha del fichero de mes en GitHub, para poder actualizarlo
let ultimoGuardadoJson = null; // snapshot del último estado de mes cargado/guardado

let grupos = GRUPOS_POR_DEFECTO;
let shaPlantilla = null;
let ultimoGuardadoPlantillaJson = null;

// Sábados con el mini-formulario de "Sustitución Manual" abierto (estado de interfaz, no se guarda).
const formulariosSustitucionAbiertos = new Set();

function snapshotActual() {
  return JSON.stringify({ mes: mesActual, sabados });
}

// ---------- Codificación base64 segura con UTF-8 (nombres con tilde, ñ, etc.) ----------

function base64AUtf8(b64) {
  const binario = atob(b64);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function utf8ABase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario);
}

// ---------- Lectura/escritura genérica de ficheros en data/ vía GitHub ----------

// Reintenta una vez tras un fallo de red (conexión lenta/inestable) antes de rendirse.
async function fetchConReintento(url, opciones) {
  try {
    return await fetch(url, opciones);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 700));
    return fetch(url, opciones);
  }
}

async function leerArchivoJson(nombreArchivo) {
  const resp = await fetchConReintento(`${API_BASE}/${nombreArchivo}`);
  if (!resp.ok) throw new Error(`GitHub respondió ${resp.status}`);
  const meta = await resp.json();
  const datos = JSON.parse(base64AUtf8(meta.content));
  return { datos, sha: meta.sha };
}

async function guardarArchivo(nombreArchivo, datos, sha, mensaje) {
  const token = getToken();
  if (!token) throw new Error("sin-token");
  const contenido = utf8ABase64(JSON.stringify(datos, null, 2));
  const resp = await fetch(`${API_BASE}/${nombreArchivo}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ message: mensaje, content: contenido, sha: sha || undefined }),
  });
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => ({}));
    throw new Error(detalle.message || `GitHub respondió ${resp.status}`);
  }
  const resultado = await resp.json();
  return resultado.content.sha;
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

// ---------- Tema claro/oscuro ----------

const TEMA_KEY = "cuadrante_sabados_tema";

const ICONO_SOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>`;
const ICONO_LUNA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  btnTema.innerHTML = tema === "dark" ? ICONO_LUNA : ICONO_SOL;
  localStorage.setItem(TEMA_KEY, tema);
}

function iniciarTema() {
  const guardado = localStorage.getItem(TEMA_KEY);
  if (guardado === "dark" || guardado === "light") {
    aplicarTema(guardado);
  } else {
    const prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    btnTema.innerHTML = prefiereOscuro ? ICONO_LUNA : ICONO_SOL;
  }
}

btnTema.addEventListener("click", () => {
  const actual =
    document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  aplicarTema(actual === "dark" ? "light" : "dark");
});

// ---------- Modales (Ayuda / Ajustes / Login) ----------

btnAyuda.addEventListener("click", () => modalAyuda.showModal());
btnAjustes.addEventListener("click", () => modalAjustes.showModal());
btnLogin.addEventListener("click", () => modalLogin.showModal());

document.querySelectorAll(".cerrar-modal").forEach((boton) => {
  boton.addEventListener("click", () => boton.closest("dialog").close());
});

// Cerrar el modal al pulsar fuera de él (en el <dialog>, el click "fuera" cae sobre el propio elemento)
document.querySelectorAll("dialog.modal").forEach((dialogo) => {
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) dialogo.close();
  });
});

// ---------- Plantilla de personal ----------

async function cargarPlantilla() {
  try {
    const { datos, sha } = await leerArchivoJson("plantilla.json");
    grupos = datos.grupos;
    shaPlantilla = sha;
  } catch (e) {
    grupos = GRUPOS_POR_DEFECTO;
    shaPlantilla = null;
    console.warn("No se pudo cargar plantilla.json, usando valores por defecto.", e);
  }
  ultimoGuardadoPlantillaJson = JSON.stringify(grupos);
  renderPersonal();
}

function actualizarAvisoSinGuardarPersonal() {
  const sinGuardar = JSON.stringify(grupos) !== ultimoGuardadoPlantillaJson;
  btnGuardarPersonal.classList.toggle("parpadeando", sinGuardar);
}

function renderPersonal() {
  personalRender.innerHTML = "";
  [1, 2].forEach((numGrupo) => {
    const g = grupos[numGrupo];
    if (!g) return;

    const bloque = document.createElement("div");
    bloque.className = "bloque-personal";
    bloque.innerHTML = `<h3>Grupo ${numGrupo}</h3>`;

    bloque.appendChild(
      renderListaEditable(`Teléfonos`, g.telefonos, {
        onAñadir: (nombre) => {
          if (!g.telefonos.includes(nombre)) g.telefonos.push(nombre);
        },
        onQuitar: (nombre) => {
          g.telefonos = g.telefonos.filter((p) => p !== nombre);
        },
        onRenombrar: (viejo, nuevo) => renombrarPersona(g, viejo, nuevo),
      })
    );

    bloque.appendChild(
      renderListaEditable(`Mostrador`, g.mostrador, {
        onAñadir: (nombre) => {
          if (!g.mostrador.includes(nombre)) g.mostrador.push(nombre);
          if (!g.refuerzoTelefonos.includes(nombre)) g.refuerzoTelefonos.push(nombre);
        },
        onQuitar: (nombre) => {
          g.mostrador = g.mostrador.filter((p) => p !== nombre);
          g.refuerzoTelefonos = g.refuerzoTelefonos.filter((p) => p !== nombre);
        },
        onRenombrar: (viejo, nuevo) => renombrarPersona(g, viejo, nuevo),
      })
    );

    bloque.appendChild(renderOrdenRefuerzo(g));

    personalRender.appendChild(bloque);
  });

  actualizarAvisoSinGuardarPersonal();
  render(); // los cálculos de los sábados dependen de `grupos`
}

// Cambia el nombre de una persona en todas las listas de su grupo (telefonos,
// mostrador, orden de refuerzo) y en el mes actualmente cargado (ausentes,
// sustituciones), para que no queden referencias sueltas al nombre antiguo.
function renombrarPersona(g, viejo, nuevo) {
  const reemplazar = (lista) => lista.map((p) => (p === viejo ? nuevo : p));
  g.telefonos = reemplazar(g.telefonos);
  g.mostrador = reemplazar(g.mostrador);
  g.refuerzoTelefonos = reemplazar(g.refuerzoTelefonos);

  sabados.forEach((s) => {
    s.ausentes = reemplazar(s.ausentes || []);
    s.sustituciones = (s.sustituciones || []).map((sus) => ({
      ...sus,
      sustituto: sus.sustituto === viejo ? nuevo : sus.sustituto,
      sustituido: sus.sustituido === viejo ? nuevo : sus.sustituido,
    }));
  });
}

function renderListaEditable(titulo, personas, { onAñadir, onQuitar, onRenombrar }) {
  const contenedor = document.createElement("div");
  contenedor.className = "fila-personal-rol";

  const etiqueta = document.createElement("strong");
  etiqueta.textContent = titulo;
  contenedor.appendChild(etiqueta);

  const chips = document.createElement("div");
  chips.className = "chips-editable";
  personas.forEach((persona) => {
    const chip = document.createElement("span");
    chip.className = "chip-editable";
    chip.innerHTML = `${persona} <button type="button" class="btn-renombrar" aria-label="Renombrar" title="Renombrar">✏️</button><button type="button" aria-label="Quitar" title="Quitar">✕</button>`;
    const [btnRenombrar, btnQuitar] = chip.querySelectorAll("button");
    btnRenombrar.addEventListener("click", () => {
      const nuevo = prompt(`Nuevo nombre para "${persona}":`, persona);
      if (!nuevo || !nuevo.trim() || nuevo.trim() === persona) return;
      onRenombrar(persona, nuevo.trim());
      renderPersonal();
    });
    btnQuitar.addEventListener("click", () => {
      onQuitar(persona);
      renderPersonal();
    });
    chips.appendChild(chip);
  });
  contenedor.appendChild(chips);

  const filaAñadir = document.createElement("div");
  filaAñadir.className = "fila-anadir-persona";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Nombre nuevo…";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-secundario";
  btn.textContent = "+ Añadir";
  const añadir = () => {
    const nombre = input.value.trim();
    if (!nombre) return;
    onAñadir(nombre);
    input.value = "";
    renderPersonal();
  };
  btn.addEventListener("click", añadir);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") añadir();
  });
  filaAñadir.append(input, btn);
  contenedor.appendChild(filaAñadir);

  return contenedor;
}

function renderOrdenRefuerzo(g) {
  const contenedor = document.createElement("div");
  contenedor.className = "fila-personal-rol";
  contenedor.innerHTML = `<strong>Orden de refuerzo a Teléfonos</strong>`;

  const lista = document.createElement("ol");
  lista.className = "orden-refuerzo";
  g.refuerzoTelefonos.forEach((persona, idx) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = persona;
    li.appendChild(span);

    const btnArriba = document.createElement("button");
    btnArriba.type = "button";
    btnArriba.textContent = "↑";
    btnArriba.disabled = idx === 0;
    btnArriba.addEventListener("click", () => {
      [g.refuerzoTelefonos[idx - 1], g.refuerzoTelefonos[idx]] = [
        g.refuerzoTelefonos[idx],
        g.refuerzoTelefonos[idx - 1],
      ];
      renderPersonal();
    });

    const btnAbajo = document.createElement("button");
    btnAbajo.type = "button";
    btnAbajo.textContent = "↓";
    btnAbajo.disabled = idx === g.refuerzoTelefonos.length - 1;
    btnAbajo.addEventListener("click", () => {
      [g.refuerzoTelefonos[idx + 1], g.refuerzoTelefonos[idx]] = [
        g.refuerzoTelefonos[idx],
        g.refuerzoTelefonos[idx + 1],
      ];
      renderPersonal();
    });

    li.append(btnArriba, btnAbajo);
    lista.appendChild(li);
  });
  contenedor.appendChild(lista);

  return contenedor;
}

btnGuardarPersonal.addEventListener("click", async () => {
  btnGuardarPersonal.disabled = true;
  estadoPersonal.textContent = "Guardando…";
  try {
    const nuevoSha = await guardarArchivo(
      "plantilla.json",
      { grupos },
      shaPlantilla,
      "Actualizar personal (grupos, roles y orden de refuerzo)"
    );
    shaPlantilla = nuevoSha;
    ultimoGuardadoPlantillaJson = JSON.stringify(grupos);
    estadoPersonal.textContent = "✅ Personal guardado.";
    actualizarAvisoSinGuardarPersonal();
  } catch (e) {
    estadoPersonal.textContent =
      e.message === "sin-token"
        ? "Configura antes el token en Opciones avanzadas para poder guardar."
        : `❌ Error al guardar: ${e.message}`;
  } finally {
    btnGuardarPersonal.disabled = false;
  }
});

// ---------- Cargar lista de meses disponibles ----------

async function cargarListaMeses() {
  try {
    const resp = await fetchConReintento(API_BASE);
    if (!resp.ok) throw new Error(`GitHub respondió ${resp.status}`);
    const archivos = await resp.json();
    const meses = archivos
      .filter((f) => f.name.endsWith(".json") && f.name !== "plantilla.json")
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

function normalizarSabado(s) {
  return {
    fecha: s.fecha,
    grupo: s.grupo ?? null,
    festivo: !!s.festivo,
    ausentes: Array.isArray(s.ausentes) ? [...s.ausentes] : [],
    sustituciones: Array.isArray(s.sustituciones) ? s.sustituciones.map((x) => ({ ...x })) : [],
  };
}

async function cargarMes(mes) {
  estadoCarga.textContent = "Cargando…";
  try {
    const { datos, sha } = await leerArchivoJson(`${mes}.json`);
    shaActual = sha;
    mesActual = datos.mes || mes;
    sabados = (datos.sabados || []).map(normalizarSabado);
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
    sustituciones: [],
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
  const resultado = calcularSabado(sabado, grupos);

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
      sabado.sustituciones = [];
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

  const g = grupos[sabado.grupo];
  const columnas = document.createElement("div");
  columnas.className = "columnas-roles";
  columnas.appendChild(renderColumnaPersonas("☎ Teléfonos", g.telefonos, sabado));
  columnas.appendChild(renderColumnaPersonas("🧾 Mostrador", g.mostrador, sabado));
  tarjeta.appendChild(columnas);

  const filaDetallesSustitucion = document.createElement("div");
  filaDetallesSustitucion.className = "fila-detalles-sustitucion";

  const detalles = document.createElement("details");
  detalles.className = "detalles-tarjeta";
  const resumenToggle = document.createElement("summary");
  resumenToggle.textContent = "Detalles";
  detalles.appendChild(resumenToggle);
  const resumen = document.createElement("div");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <div><strong>Cubren Teléfonos (${resultado.telefonos.length}):</strong> ${resultado.telefonos.join(", ") || "—"}</div>
    <div><strong>Cubren Mostrador (${resultado.mostrador.length}):</strong> ${resultado.mostrador.join(", ") || "—"}</div>
  `;
  detalles.appendChild(resumen);
  filaDetallesSustitucion.appendChild(detalles);

  filaDetallesSustitucion.appendChild(renderBloqueSustituciones(sabado, g));

  tarjeta.appendChild(filaDetallesSustitucion);

  if (resultado.incidencias.length) {
    const aviso = document.createElement("div");
    aviso.className = "aviso-incidencia";
    aviso.textContent = resultado.incidencias.join(" · ");
    tarjeta.appendChild(aviso);
  }

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

// ---------- Sustitución Manual ----------

const ETIQUETA_ROL = { telefonos: "Teléfonos", mostrador: "Mostrador" };

function renderBloqueSustituciones(sabado, g) {
  const bloque = document.createElement("div");
  bloque.className = "bloque-sustituciones";

  (sabado.sustituciones || []).forEach((s, idx) => {
    const linea = document.createElement("div");
    linea.className = "linea-sustitucion";
    const texto = document.createElement("span");
    texto.textContent = `🔄 ${s.sustituto} sustituye a ${s.sustituido} (${ETIQUETA_ROL[s.rol] || s.rol})`;
    const btnQuitar = document.createElement("button");
    btnQuitar.type = "button";
    btnQuitar.className = "btn-quitar-sustitucion";
    btnQuitar.textContent = "✕";
    btnQuitar.title = "Quitar esta sustitución (no desmarca la ausencia)";
    btnQuitar.addEventListener("click", () => {
      sabado.sustituciones.splice(idx, 1);
      render();
    });
    linea.append(texto, btnQuitar);
    bloque.appendChild(linea);
  });

  const abierto = formulariosSustitucionAbiertos.has(sabado.fecha);

  if (!abierto) {
    const btnAbrir = document.createElement("button");
    btnAbrir.type = "button";
    btnAbrir.className = "btn-secundario btn-sustitucion-manual";
    btnAbrir.textContent = "+ Sustitución Manual";
    btnAbrir.addEventListener("click", () => {
      formulariosSustitucionAbiertos.add(sabado.fecha);
      render();
    });
    bloque.appendChild(btnAbrir);
    return bloque;
  }

  const personasDelDia = [...g.telefonos, ...g.mostrador];
  const todoElPersonal = personasDeGrupos(grupos);

  const form = document.createElement("div");
  form.className = "form-sustitucion";

  const selectSustituido = document.createElement("select");
  personasDelDia.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    selectSustituido.appendChild(opt);
  });

  const selectSustituto = document.createElement("select");
  todoElPersonal.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    selectSustituto.appendChild(opt);
  });

  const campoSustituido = document.createElement("label");
  campoSustituido.className = "campo";
  campoSustituido.innerHTML = "<span>Sustituye a</span>";
  campoSustituido.appendChild(selectSustituido);

  const campoSustituto = document.createElement("label");
  campoSustituto.className = "campo";
  campoSustituto.innerHTML = "<span>Sustituto</span>";
  campoSustituto.appendChild(selectSustituto);

  const btnConfirmar = document.createElement("button");
  btnConfirmar.type = "button";
  btnConfirmar.className = "btn-primario";
  btnConfirmar.textContent = "Añadir";
  btnConfirmar.addEventListener("click", () => {
    const sustituido = selectSustituido.value;
    const sustituto = selectSustituto.value;
    if (!sustituido || !sustituto) return;
    const rol = g.telefonos.includes(sustituido) ? "telefonos" : "mostrador";
    if (!Array.isArray(sabado.sustituciones)) sabado.sustituciones = [];
    sabado.sustituciones.push({ sustituto, sustituido, rol });
    if (!sabado.ausentes.includes(sustituido)) sabado.ausentes.push(sustituido);
    formulariosSustitucionAbiertos.delete(sabado.fecha);
    render();
  });

  const btnCancelar = document.createElement("button");
  btnCancelar.type = "button";
  btnCancelar.className = "btn-secundario";
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", () => {
    formulariosSustitucionAbiertos.delete(sabado.fecha);
    render();
  });

  form.append(campoSustituido, campoSustituto, btnConfirmar, btnCancelar);
  bloque.appendChild(form);

  return bloque;
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
    sabados = (datos.sabados || []).map(normalizarSabado);
    ultimoGuardadoJson = snapshotActual();
    render();
  } catch (e) {
    alert("El JSON no es válido: " + e.message);
  }
});

// ---------- Impresión (A4) ----------

function formatearFechaLarga(fechaIso) {
  const [, mes, dia] = fechaIso.split("-");
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${Number(dia)} de ${nombres[Number(mes) - 1]}`;
}

function renderBloqueImpresion(sabado, numero) {
  const resultado = calcularSabado(sabado, grupos);

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

// ---------- Guardado del mes ----------

btnGuardar.addEventListener("click", async () => {
  if (!getToken()) {
    estadoGuardado.textContent = "";
    modalAjustes.showModal();
    alert(
      'No tienes guardado automático configurado. Usa "Copiar JSON del mes" y pégalo en GitHub (sección "Guardado manual" abajo), o configura el token en "Guardado automático".'
    );
    return;
  }

  btnGuardar.disabled = true;
  estadoGuardado.textContent = "Guardando…";
  try {
    const datos = { mes: mesActual, sabados };
    const nuevoSha = await guardarArchivo(
      `${mesActual}.json`,
      datos,
      shaActual,
      `Actualizar cuadrante de ${mesActual}`
    );
    shaActual = nuevoSha;
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
    const resp = await fetchConReintento(API_BASE);
    if (!resp.ok) return;
    const archivos = await resp.json();
    const meses = archivos
      .filter((f) => f.name.endsWith(".json") && f.name !== "plantilla.json")
      .map((f) => f.name.replace(".json", ""))
      .sort();
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

iniciarTema();
actualizarEstadoToken();
cargarPlantilla().then(cargarListaMeses);

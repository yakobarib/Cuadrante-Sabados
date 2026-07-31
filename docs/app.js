import { GRUPOS, calcularSabado } from "./rules.js";

const REPO_EDIT_BASE = "https://github.com/yakobarib/Cuadrante-Sabados/edit/main/data/";

const elMes = document.getElementById("input-mes");
const elGrupoInicial = document.getElementById("input-grupo-inicial");
const elBtnGenerar = document.getElementById("btn-generar");
const elInputJson = document.getElementById("input-json");
const elBtnCargarJson = document.getElementById("btn-cargar-json");
const elPanelSabados = document.getElementById("panel-sabados");
const elListaSabados = document.getElementById("lista-sabados");
const elPanelGuardar = document.getElementById("panel-guardar");
const elBtnCopiar = document.getElementById("btn-copiar");
const elLinkGithub = document.getElementById("link-github");
const elOutputJson = document.getElementById("output-json");

let mesActual = null; // "2026-09"
let sabados = []; // [{ fecha, grupo, festivo, ausentes: [] }]

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

elBtnGenerar.addEventListener("click", () => {
  mesActual = elMes.value;
  if (!mesActual) return;
  const grupoInicial = Number(elGrupoInicial.value);
  const fechas = sabadosDelMes(mesActual);
  sabados = fechas.map((fecha, i) => ({
    fecha,
    grupo: (i % 2 === 0) ? grupoInicial : (grupoInicial === 1 ? 2 : 1),
    festivo: false,
    ausentes: [],
  }));
  render();
});

elBtnCargarJson.addEventListener("click", () => {
  try {
    const datos = JSON.parse(elInputJson.value);
    mesActual = datos.mes;
    sabados = (datos.sabados || []).map((s) => ({
      fecha: s.fecha,
      grupo: s.grupo,
      festivo: !!s.festivo,
      ausentes: Array.isArray(s.ausentes) ? [...s.ausentes] : [],
    }));
    elMes.value = mesActual;
    render();
  } catch (e) {
    alert("El JSON no es válido: " + e.message);
  }
});

function personasDelGrupo(grupo) {
  const g = GRUPOS[grupo];
  if (!g) return [];
  return [...g.telefonos, ...g.mostrador];
}

function render() {
  elPanelSabados.hidden = sabados.length === 0;
  elPanelGuardar.hidden = sabados.length === 0;
  elListaSabados.innerHTML = "";

  sabados.forEach((sabado, idx) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-sabado";

    const cabecera = document.createElement("div");
    cabecera.className = "tarjeta-cabecera";

    const titulo = document.createElement("h3");
    titulo.textContent = formatearFecha(sabado.fecha);
    cabecera.appendChild(titulo);

    const controles = document.createElement("div");
    controles.className = "fila";

    const labelFestivo = document.createElement("label");
    labelFestivo.style.flexDirection = "row";
    labelFestivo.style.alignItems = "center";
    labelFestivo.innerHTML = `<input type="checkbox" ${sabado.festivo ? "checked" : ""} /> Festivo`;
    labelFestivo.querySelector("input").addEventListener("change", (e) => {
      sabado.festivo = e.target.checked;
      render();
    });
    controles.appendChild(labelFestivo);

    if (!sabado.festivo) {
      const labelGrupo = document.createElement("label");
      labelGrupo.textContent = "Grupo";
      const select = document.createElement("select");
      [1, 2].forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = `Grupo ${g}`;
        if (Number(sabado.grupo) === g) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", (e) => {
        sabado.grupo = Number(e.target.value);
        sabado.ausentes = [];
        render();
      });
      labelGrupo.appendChild(select);
      controles.appendChild(labelGrupo);
    }

    cabecera.appendChild(controles);
    tarjeta.appendChild(cabecera);

    if (!sabado.festivo && sabado.grupo) {
      const personas = document.createElement("div");
      personas.className = "personas";
      personasDelGrupo(sabado.grupo).forEach((persona) => {
        const label = document.createElement("label");
        label.className = "persona-check";
        const checked = sabado.ausentes.includes(persona);
        label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} /> ${persona} (ausente)`;
        label.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) {
            if (!sabado.ausentes.includes(persona)) sabado.ausentes.push(persona);
          } else {
            sabado.ausentes = sabado.ausentes.filter((p) => p !== persona);
          }
          render();
        });
        personas.appendChild(label);
      });
      tarjeta.appendChild(personas);
    }

    tarjeta.appendChild(renderResultado(sabado));
    elListaSabados.appendChild(tarjeta);
  });

  actualizarSalidaJson();
}

function renderResultado(sabado) {
  const resultado = calcularSabado(sabado);
  const div = document.createElement("div");
  div.className = "resultado";

  if (resultado.festivo) {
    div.innerHTML = `<span class="badge festivo">FESTIVO</span>`;
    return div;
  }

  const bloqueTelefonos = document.createElement("div");
  bloqueTelefonos.innerHTML = `<strong>Teléfonos (${resultado.telefonos.length})</strong>${resultado.telefonos.join(", ") || "—"}`;

  const bloqueMostrador = document.createElement("div");
  bloqueMostrador.innerHTML = `<strong>Mostrador (${resultado.mostrador.length})</strong>${resultado.mostrador.join(", ") || "—"}`;

  const bloqueEstado = document.createElement("div");
  bloqueEstado.innerHTML = `<strong>Estado</strong><span class="badge ${resultado.estado}">${resultado.estado.toUpperCase()}</span>`;
  if (resultado.incidencias.length) {
    const lista = document.createElement("div");
    lista.className = "incidencias-lista";
    lista.textContent = resultado.incidencias.join(" · ");
    bloqueEstado.appendChild(lista);
  }

  div.append(bloqueTelefonos, bloqueMostrador, bloqueEstado);
  return div;
}

function formatearFecha(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `Sábado ${dia}/${mes}/${anio}`;
}

function actualizarSalidaJson() {
  if (!mesActual) return;
  const datos = { mes: mesActual, sabados };
  elOutputJson.value = JSON.stringify(datos, null, 2);
  elLinkGithub.href = `${REPO_EDIT_BASE}${mesActual}.json`;
}

elBtnCopiar.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elOutputJson.value);
    elBtnCopiar.textContent = "¡Copiado!";
    setTimeout(() => (elBtnCopiar.textContent = "Copiar JSON del mes"), 1500);
  } catch (e) {
    elOutputJson.select();
    document.execCommand("copy");
  }
});

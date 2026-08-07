// Motor de reglas del cuadrante de sábados.
// Se usa tanto desde el navegador (docs/app.js) como desde Node (scripts/check-roster.mjs).

// Respaldo por si no se puede cargar data/plantilla.json (no es la fuente de verdad habitual).
export const GRUPOS_POR_DEFECTO = {
  1: {
    telefonos: ["Alex Costa", "Toni Prats"],
    mostrador: ["Manolo Pérez", "Marcos", "Pep", "Adrián", "Javi"],
    refuerzoTelefonos: ["Adrián", "Manolo Pérez", "Marcos", "Pep", "Javi"],
  },
  2: {
    telefonos: ["Pepe Ros", "Toni Guasch"],
    mostrador: ["Yako", "Iván", "Toni B", "Juan Carlos", "Esteve"],
    refuerzoTelefonos: ["Esteve", "Iván", "Toni B", "Juan Carlos"],
  },
};

export const MIN_TELEFONOS = 2;
export const MIN_MOSTRADOR = 4;
export const NORMAL_MOSTRADOR = 5;

// Calcula el resultado de un sábado: quién queda en Teléfonos/Mostrador
// tras aplicar sustituciones manuales y refuerzos automáticos, y si hay incidencia.
export function calcularSabado({ grupo, festivo, ausentes = [], sustituciones = [] }, grupos) {
  if (festivo) {
    return { festivo: true, estado: "festivo", telefonos: [], mostrador: [], incidencias: [] };
  }

  const g = grupos?.[grupo];
  if (!g) {
    return {
      festivo: false,
      estado: "incidencia",
      telefonos: [],
      mostrador: [],
      incidencias: [`Grupo inválido: ${grupo}`],
    };
  }

  let telefonos = g.telefonos.filter((p) => !ausentes.includes(p));
  let mostrador = g.mostrador.filter((p) => !ausentes.includes(p));

  // Sustituciones manuales: se aplican antes del refuerzo automático, para que
  // si ya cubren el hueco no se dispare además un refuerzo innecesario.
  for (const s of sustituciones) {
    if (s.rol === "telefonos" && !telefonos.includes(s.sustituto)) {
      telefonos.push(s.sustituto);
    } else if (s.rol === "mostrador" && !mostrador.includes(s.sustituto)) {
      mostrador.push(s.sustituto);
    }
  }

  const faltan = MIN_TELEFONOS - telefonos.length;
  if (faltan > 0) {
    const candidatos = g.refuerzoTelefonos.filter(
      (p) => !ausentes.includes(p) && !telefonos.includes(p)
    );
    for (let i = 0; i < faltan && candidatos.length; i++) {
      const refuerzo = candidatos.shift();
      telefonos.push(refuerzo);
      mostrador = mostrador.filter((p) => p !== refuerzo);
    }
  }

  const incidencias = [];
  if (telefonos.length < MIN_TELEFONOS) {
    incidencias.push(`Teléfonos por debajo del mínimo (${telefonos.length}/${MIN_TELEFONOS})`);
  }
  if (mostrador.length < MIN_MOSTRADOR) {
    incidencias.push(`Mostrador por debajo del mínimo (${mostrador.length}/${MIN_MOSTRADOR})`);
  }

  let estado = "ok";
  if (incidencias.length) estado = "incidencia";
  else if (mostrador.length < NORMAL_MOSTRADOR) estado = "minimo";

  return { festivo: false, estado, telefonos, mostrador, incidencias };
}

// Calcula todos los sábados de un fichero de mes ({ mes, sabados: [...] }).
export function calcularMes(datosMes, grupos) {
  return (datosMes.sabados || []).map((sabado) => ({
    ...sabado,
    resultado: calcularSabado(sabado, grupos),
  }));
}

// Sugiere una solución en texto para una incidencia ya calculada (o null si no hay incidencia).
export function sugerirSolucion(resultado) {
  if (!resultado || !resultado.incidencias?.length) return null;

  if (resultado.telefonos.length < MIN_TELEFONOS) {
    return "No queda nadie disponible para Teléfonos ni siquiera con los refuerzos habituales. Contacta urgentemente con alguien de Mostrador del otro grupo, aunque no sea su turno — este rol no puede quedar sin cubrir.";
  }

  const faltan = MIN_MOSTRADOR - resultado.mostrador.length;
  if (faltan > 0) {
    return `Faltan ${faltan} persona${faltan > 1 ? "s" : ""} en Mostrador para llegar al mínimo. Valora pedir un sustituto puntual del otro grupo para ese sábado, o comprobar si alguna de las personas ausentes puede cubrir aunque sea parte de la jornada.`;
  }

  return null;
}

// Todos los nombres de ambos grupos (Teléfonos + Mostrador), sin duplicados.
export function personasDeGrupos(grupos) {
  const nombres = new Set();
  for (const g of Object.values(grupos || {})) {
    (g.telefonos || []).forEach((p) => nombres.add(p));
    (g.mostrador || []).forEach((p) => nombres.add(p));
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, "es"));
}

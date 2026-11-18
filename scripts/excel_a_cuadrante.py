#!/usr/bin/env python3
"""Convierte el "Informe calendario" Excel del sistema de horarios en data/AAAA-MM.json.

Uso:  python scripts/excel_a_cuadrante.py INFORME.xlsx [--forzar] [--incluir-solicitados]
Requiere: pip install openpyxl

- Lee el color de cada celda según la leyenda del sistema: azul = vacaciones, lila = permiso,
  rosa = baja (ausente); gris claro = descanso; gris oscuro = festivo; relleno rayado = solicitado.
- Los grupos siguen alternando a partir del último sábado ya guardado en data/ (un sábado festivo
  también cuenta como turno).
- Solo apunta como ausentes a quien pertenece al grupo de ese sábado o es "adicional" ese día.
- No sobrescribe ficheros que ya existan salvo con --forzar.
"""
import datetime
import json
import sys
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"

NOMBRES = {
    "BONET TORRES, ANTONIO": "Toni Bonet",
    "BRUSTENGA BARBANY, ESTEVE": "Esteve",
    "CARDOSO CARDOSO, JUAN CARLOS": "Juan Carlos",
    "COSTA RIERA, ALEJANDRO": "Alex Costa",
    "GIL VERDEJA, JAVIER": "Javi Gil",
    "GUASCH RIBAS, ANTONIO": "Toni Guasch",
    "MORENO LOPEZ, YAKOBA": "Yako",
    "PEREZ PEREIRA, MANUEL": "Manolo Pérez",
    "PERIAÑEZ ROSA, IVAN": "Iván",
    "PRATS MARI, ANTONIO": "Toni Prats",
    "RIBAS ROSELLO, JOSE": "Pep Ribas",
    "ROS VERA, JOSE": "Pepe Ros",
    "TORRES TUR, MARCOS": "Marcos",
    "VAZQUEZ ARROYO, ADRIAN": "Adrián",
}
MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO",
         "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
COLORES = {"FF8BB8D3": "VAC", "FFE1D2E7": "PERMISO", "FFE7C2C4": "BAJA",
           "FFEFEFEF": "descanso", "FF666666": "FESTIVO"}
AUSENTE = {"VAC", "PERMISO", "BAJA"}


def estado(celda):
    """Devuelve (tipo, solicitado)."""
    relleno = celda.fill
    if relleno is None or relleno.fill_type is None:
        return "trabaja", False
    if hasattr(relleno, "stop"):  # degradado = relleno rayado = solicitado
        return COLORES.get(str(relleno.stop[0].color.rgb), "otro"), True
    return COLORES.get(relleno.fgColor.rgb, "otro"), False


def cargar_ultimo_grupo(antes_de):
    ultimo = None
    for f in DATA.glob("????-??.json"):
        for s in json.loads(f.read_text(encoding="utf-8")).get("sabados", []):
            if s["fecha"] < antes_de and s.get("grupo") and (ultimo is None or s["fecha"] > ultimo[0]):
                ultimo = (s["fecha"], s["grupo"])
    return ultimo


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    forzar = "--forzar" in sys.argv
    incluir_solicitados = "--incluir-solicitados" in sys.argv
    if not args:
        sys.exit(__doc__)

    plantilla = json.loads((DATA / "plantilla.json").read_text(encoding="utf-8"))
    grupos = plantilla["grupos"]
    adicionales = plantilla.get("adicionales", [])
    miembros = {g: set(v["telefonos"]) | set(v["mostrador"]) for g, v in grupos.items()}

    ws = openpyxl.load_workbook(args[0], data_only=True).worksheets[0]
    cabeceras = [r for r in range(8, ws.max_row + 1) if ws.cell(r, 3).value == "TRABAJADOR"]

    sabados = []  # (fecha, {nombre: (tipo, solicitado)})
    for h in cabeceras:
        titulo = str(ws.cell(h - 1, 5).value or "").split()
        if len(titulo) != 2 or titulo[0] not in MESES:
            continue
        mes, anio = MESES.index(titulo[0]) + 1, int(titulo[1])
        columnas = {}
        for c in range(5, 36):
            dia = ws.cell(h, c).value
            if isinstance(dia, int):
                try:
                    fecha = datetime.date(anio, mes, dia)
                except ValueError:
                    continue
                if fecha.weekday() == 5:
                    columnas[c] = fecha
        r = h + 1
        filas = {}
        while ws.cell(r, 3).value and ws.cell(r, 3).value != "TRABAJADOR":
            nombre = NOMBRES.get(ws.cell(r, 3).value)
            if nombre:
                filas[nombre] = r
            r += 1
        for c, fecha in columnas.items():
            sabados.append((fecha, {n: estado(ws.cell(fr, c)) for n, fr in filas.items()}))

    if not sabados:
        sys.exit("No he encontrado ningún sábado en el Excel.")

    sabados.sort(key=lambda s: s[0])
    previo = cargar_ultimo_grupo(sabados[0][0].isoformat())
    grupo = (2 if previo[1] == 1 else 1) if previo else 1
    if not previo:
        print("⚠️ No hay meses anteriores en data/: empiezo por el Grupo 1, revísalo.")

    meses = {}
    avisos = []
    for fecha, estados in sabados:
        iso = fecha.isoformat()
        festivo = sum(1 for t, _ in estados.values() if t == "FESTIVO") > len(estados) / 2
        relevantes = set(miembros[str(grupo)]) | {
            a["persona"] for a in adicionales
            if a["desde"] <= iso and (not a.get("hasta") or iso <= a["hasta"])
        }
        ausentes = []
        for nombre, (tipo, solicitado) in estados.items():
            if nombre not in relevantes or festivo:
                continue
            if tipo in AUSENTE:
                if solicitado and not incluir_solicitados:
                    avisos.append(f"{iso} {nombre}: {tipo} SOLICITADO (no confirmado) — no lo marco ausente")
                else:
                    ausentes.append(nombre)
            elif tipo == "otro":
                avisos.append(f"{iso} {nombre}: color desconocido — revísalo")
        orden = [n for n in NOMBRES.values() if n in ausentes]
        meses.setdefault(fecha.strftime("%Y-%m"), []).append({
            "fecha": iso, "grupo": int(grupo), "festivo": festivo,
            "ausentes": orden, "sustituciones": [],
        })
        grupo = 2 if int(grupo) == 1 else 1

    for clave, lista in meses.items():
        destino = DATA / f"{clave}.json"
        if destino.exists() and not forzar:
            print(f"= {destino.name} ya existe, no lo toco (usa --forzar para sobrescribir).")
            continue
        destino.write_text(json.dumps({"mes": clave, "sabados": lista}, indent=2, ensure_ascii=False) + "\n",
                           encoding="utf-8")
        print(f"+ {destino.name} creado")
        for s in lista:
            print(f"    {s['fecha']}  G{s['grupo']}{'  FESTIVO' if s['festivo'] else ''}  ausentes: {', '.join(s['ausentes']) or '-'}")
    for a in avisos:
        print("⚠️", a)


if __name__ == "__main__":
    main()

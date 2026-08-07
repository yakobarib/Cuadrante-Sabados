# Cuadrante Sábados

Herramienta para repartir cada sábado entre **Teléfonos** y **Mostrador**, aplicando
los mínimos y refuerzos automáticos, con aviso por email cuando un sábado queda
por debajo de lo necesario.

## Reglas

- Un solo grupo trabaja cada sábado (Grupo 1 o Grupo 2).
- Quién compone cada grupo (Teléfonos, Mostrador, y el orden de refuerzo) **ya no está fijo en el
  código** — vive en [`data/plantilla.json`](data/plantilla.json) y se gestiona desde la web, en
  "👥 Personal" (ver más abajo).
- Mínimos: 2 en Teléfonos (prioridad absoluta) y 4 en Mostrador. Lo normal sin ausencias es 2 y 5.
- Refuerzo a Teléfonos si falta gente: se toma de la lista "Orden de refuerzo a Teléfonos" de ese
  grupo (configurable en "👥 Personal"), en el orden en que estén.
- No hay refuerzo automático entre grupos. Si Mostrador baja de 4, se considera **incidencia** y
  decide la jefa cómo se cubre — a mano, o registrando una **Sustitución Manual** (ver más abajo).
- Todas las ausencias (vacaciones, baja, permiso...) se tratan igual: solo "ausente ese sábado", sin guardar el motivo.

La lógica vive en [`docs/rules.js`](docs/rules.js) y la usan tanto la web como la comprobación automática.

## Aviso importante de privacidad

Este repositorio es **público** (decisión consciente: GitHub Pages con repo privado requiere
GitHub Pro, y se prefirió no pagar ni mantener un segundo repositorio solo para la web). Eso significa
que **cualquiera con el enlace puede ver todo el contenido**, incluido `data/*.json`.

Para limitar el impacto de eso:

- La web nunca pide ni muestra el motivo de una ausencia, solo si alguien está disponible o no.
- `data/*.json` solo debe contener, para cada sábado, el grupo y la lista de quién falta —
  nunca el motivo (vacaciones/baja/permiso), ni ningún otro dato personal.

Si en algún momento se prefiere que los datos dejen de ser públicos, las opciones son: pasar a
GitHub Pro y volver a poner el repo en privado, o mover `data/`, `scripts/` y el workflow a un
segundo repositorio privado aparte, dejando aquí solo la web (`docs/`).

## Cómo se usa el día a día

1. Abre la web publicada en Pages. Los meses que ya existen en `data/` se cargan solos en el
   desplegable "Mes" — no hace falta copiar ni pegar nada para verlos.
2. Para un mes nuevo, usa "+ Nuevo mes" (te pregunta el mes en formato AAAA-MM y si el primer
   sábado lo hace el Grupo 1 o el Grupo 2).
3. Según te vayan llegando las capturas, marca en cada tarjeta: festivo, grupo, y pulsando el
   nombre de cada persona la marcas como ausente (vuelve a pulsar para deshacerlo). El resultado
   (quién cubre Teléfonos/Mostrador y si hay incidencia) se recalcula al momento.
4. Pulsa "💾 Guardar cambios":
   - Si tienes el guardado automático configurado (ver abajo), se guarda directamente y ya está.
   - Si no, te avisa para que uses "Opciones avanzadas → Guardado manual" (copiar JSON y
     pegarlo en GitHub a mano).
5. Guardar dispara automáticamente la comprobación (`.github/workflows/check-roster.yml`).
   Si hay alguna incidencia, te llega un email.

### Activar el guardado automático (opcional, recomendado)

En "⚙️ Opciones avanzadas → Guardado automático" tienes el enlace y los pasos para crear un
token de GitHub limitado solo a este repositorio (permiso "Contents: Read and write", nada más).
Se guarda únicamente en el navegador donde lo pegues — si usas otro ordenador o navegador, hay
que configurarlo otra vez ahí.

### Gestión de personal

En "👥 Personal" puedes, sin tocar código:

- Añadir o quitar a alguien de Teléfonos o Mostrador de cada grupo (cuando entra o se va alguien
  de la empresa).
- Reordenar con las flechas ↑/↓ el "Orden de refuerzo a Teléfonos" de cada grupo — a quién se
  recurre primero si falta gente en Teléfonos.
- Al añadir a alguien a Mostrador, se coloca automáticamente al final de ese orden de refuerzo;
  al quitarlo, se retira también de ahí.

Tiene su propio botón "💾 Guardar cambios de personal" (independiente de guardar el mes), y usa
el mismo guardado automático/manual que el resto de la web.

### Sustitución Manual

Para los casos en los que alguien viene a cubrir a otra persona (cambios de sábado entre
compañeros, favores puntuales, etc.) y no basta con marcar una ausencia normal: en cada tarjeta
de sábado, botón **"+ Sustitución Manual"** → eliges a quién sustituye (de los que tocan ese
sábado) y quién lo sustituye (cualquiera de la plantilla, de cualquier grupo). Al confirmar:

- La persona sustituida se marca **ausente automáticamente**.
- La sustituta aparece cubriendo ese rol (Teléfonos o Mostrador, según a quién sustituya), lo que
  evita una incidencia falsa si el hueco ya está resuelto en la realidad.
- Queda registrado quién sustituyó a quién ese sábado (útil para llevar la cuenta de favores).

Quitar una sustitución (✕) no desmarca la ausencia — son dos pasos independientes a propósito.

## Puesta en marcha (una sola vez)

### 1. Activar GitHub Pages

Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, carpeta `/docs` → Save.
La URL quedará como `https://yakobarib.github.io/Cuadrante-Sabados/`.

### 2. Configurar el envío de email (Settings → Secrets and variables → Actions → New repository secret)

| Secret | Valor |
|---|---|
| `SMTP_HOST` | Servidor SMTP de tu proveedor (ver tabla abajo) |
| `SMTP_PORT` | Normalmente `465` |
| `SMTP_USER` | Tu dirección de correo completa |
| `SMTP_PASS` | Contraseña de aplicación (no la contraseña normal de tu email, ver abajo) |
| `MAIL_TO` | A qué dirección quieres que lleguen los avisos (puede ser la misma) |

Proveedores más comunes:

- **Gmail**: `smtp.gmail.com`, puerto `465`. Necesitas crear una "contraseña de aplicación" en
  https://myaccount.google.com/apppasswords (requiere verificación en dos pasos activada).
- **Outlook / Office 365**: `smtp.office365.com`, puerto `587`.
- **Correo de tu dominio (adeivissa.com)**: pregunta a quien gestione el correo de la empresa
  por los datos SMTP (servidor, puerto, si requiere contraseña de aplicación).

### 3. Mes de prueba (beta)

`data/2026-08.json` ya está cargado con los datos reales de agosto (incluyendo los dos festivos)
para probar todo el flujo sin afectar a nada real. `data/2026-09.json` es la plantilla para
empezar a usar la herramienta en serio.

## Desarrollo / comprobación local

```bash
node scripts/check-roster.mjs data/2026-08.json   # comprueba un mes concreto
node scripts/check-roster.mjs                     # comprueba todos los data/*.json
```

Para ver la web en local, sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 8000
# abrir http://localhost:8000/docs/
```

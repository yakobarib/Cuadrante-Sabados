# Cuadrante Sábados

Herramienta para repartir cada sábado entre **Teléfonos** y **Mostrador**, aplicando
los mínimos y refuerzos automáticos, con aviso por email cuando un sábado queda
por debajo de lo necesario.

## Reglas

- Un solo grupo trabaja cada sábado (Grupo 1 o Grupo 2).
- **Grupo 1** — Teléfonos: Alex Costa, Toni Prats · Mostrador: Manolo Pérez, Marcos, Pep, Adrián, Javi.
- **Grupo 2** — Teléfonos: Pepe Ros, Toni Guasch · Mostrador: Yako, Iván, Toni B, Juan Carlos, Esteve.
- Mínimos: 2 en Teléfonos (prioridad absoluta) y 4 en Mostrador. Lo normal sin ausencias es 2 y 5.
- Refuerzo a Teléfonos si falta gente:
  - Grupo 1 → Adrián primero, luego cualquier otro de Mostrador del grupo.
  - Grupo 2 → Esteve primero, luego Iván, luego cualquier otro de Mostrador del grupo.
- No hay refuerzo entre grupos. Si Mostrador baja de 4, se considera **incidencia** y decide la jefa cómo se cubre.
- Todas las ausencias (vacaciones, baja, permiso...) se tratan igual: solo "ausente ese sábado", sin guardar el motivo.

La lógica vive en [`docs/rules.js`](docs/rules.js) y la usan tanto la web como la comprobación automática.

## Aviso importante de privacidad

Este repositorio es **privado**, pero la carpeta `docs/` se publica como **GitHub Pages, que es pública**
por defecto aunque el repo no lo sea. Por eso:

- La web (`docs/`) nunca pide ni muestra el motivo de una ausencia, solo si alguien está disponible o no.
- Los datos reales (`data/*.json`) **no** se publican en Pages — solo son visibles para quien tenga acceso
  al repositorio en GitHub. No los subas ni los pegues en ningún sitio público.

## Cómo se usa el día a día

1. Abre la web publicada en Pages (ver más abajo cómo activarla).
2. En "1. Elegir mes", genera los sábados en blanco de un mes nuevo, o pega el JSON de un mes
   que ya exista en `data/` (cópialo desde GitHub) para seguir editándolo.
3. En "2. Marcar ausencias", marca festivo/grupo/ausentes de cada sábado según te vayan llegando
   las capturas. El resultado (Teléfonos, Mostrador, incidencias) se recalcula al momento.
4. En "3. Guardar en GitHub", pulsa "Copiar JSON del mes" y luego el enlace "Abrir data/&lt;mes&gt;.json
   en GitHub". Pega el JSON copiado sustituyendo el contenido del archivo y confirma el commit
   ("Commit changes").
5. Ese commit dispara automáticamente la comprobación (`.github/workflows/check-roster.yml`).
   Si hay alguna incidencia, te llega un email.

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

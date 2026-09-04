# Changelog

Todas las novedades notables de este proyecto se documentan aquí.

## [1.5.1] - 2026-09-04
### Revertido
- Los intentos de arreglar la impresión a dos páginas (recortes de espaciado + auto-ajuste con zoom) empeoraron el
  resultado (letra minúscula y seguía sin caber). Revertido el CSS y el JS de impresión exactamente a la versión
  anterior a ese intento, que Yakoba había confirmado como buena. Un mes de 5 sábados puede volver a salir en 2
  páginas — se retomará con otro enfoque más adelante.

## [1.5.0] - 2026-09-04
### Arreglado
- La impresión seguía saliéndose a una segunda página (casi en blanco) en algunos casos, incluso tras recortar el
  espaciado — probablemente por diferencias de métrica de fuente entre navegadores/sistemas.
### Cambiado
- "Imprimir mes" ahora mide la altura real del contenido **en el propio navegador** justo antes de imprimir y, si no
  cabe en una página A4, reduce el tamaño (con `zoom`) lo justo para que quepa siempre — en vez de depender de un
  espaciado fijo calculado de antemano. También se recortaron más los márgenes y tamaños de fuente base.

## [1.4.1] - 2026-09-04
### Arreglado
- El parpadeo de las pastillas MÍNIMO/INCIDENCIA no se veía en algunos navegadores porque usaba `color-mix()` para el
  color del halo. Cambiado a un parpadeo de opacidad simple (sin funciones CSS modernas), mucho más compatible y más
  visible.

## [1.4.0] - 2026-09-04
### Añadido
- Las pastillas de estado 🟡 MÍNIMO y 🔴 INCIDENCIA de cada tarjeta parpadean (halo de color pulsante), para que salten
  a la vista los sábados que necesitan atención. Respeta "reducir movimiento" del sistema.

## [1.3.1] - 2026-09-04
### Arreglado
- La impresión de un mes de 5 sábados se salía a una segunda página (casi en blanco). Recortado el espaciado y los
  márgenes de la hoja A4 para que quepa siempre en una sola página, con margen de sobra.

## [1.3.0] - 2026-09-04
### Cambiado
- Cuando alguien refuerza Teléfonos automáticamente (viene de Mostrador de su propio grupo), su chip se "arrastra"
  visualmente a la columna de Teléfonos (con borde discontinuo, distinto de un titular) y desaparece de Mostrador
  mientras dure el refuerzo — antes solo se veía reflejado en "Detalles", no en las columnas de la tarjeta. Sigue
  pudiendo marcarse ausente igual que cualquier otra persona, y si lo está, entra el siguiente de la lista de
  refuerzo automáticamente.

## [1.2.0] - 2026-08-07
### Cambiado
- Los iconos de la cabecera (☀️/🌙, ❓, ⚙️, 👤) pasan de emoji a iconos de línea (SVG), para que se vean igual en cualquier
  navegador u ordenador en vez de depender de la fuente de emojis de cada sistema.
- Ayuda actualizada con las últimas novedades (Personal junto a "+ Nuevo mes", Detalles, renombrar, Guardar cambios arriba).
- "⚙️ Ajustes" reescrito: las dos formas de guardar (sin configurar nada, o con un clic tras configurar un token) se
  presentan como opciones igual de válidas, cada una con sus pasos numerados muy concretos, en vez de una marcada
  como "recomendada" y la otra como alternativa de segunda.

## [1.1.0] - 2026-08-07
### Añadido
- Cabecera fija (sticky): el título, los iconos y la fila de Mes/Personal/Imprimir se quedan visibles al hacer scroll.
- Renombrar personas desde "👥 Personal" (✏️ junto al nombre), propagando el cambio a las ausencias/sustituciones del
  mes que esté cargado en ese momento.
- Desplegable "Detalles" en cada tarjeta (quién cubre Teléfonos/Mostrador tras los refuerzos), junto al botón
  "+ Sustitución Manual".
### Cambiado
- "💾 Guardar cambios" se traslada a la barra de iconos: gris si no hay nada que guardar, azul y parpadeando si hay
  cambios sin guardar.
- "⚙️ Opciones avanzadas" desaparece como panel propio; su contenido (token, guardado manual, cargar JSON) pasa a
  "⚙️ Ajustes".
- "👥 Personal" y "🖨️ Imprimir mes" se colocan junto a "Mes" y "+ Nuevo mes", en vez de ir apilados aparte.

## [1.0.2] - 2026-08-07
### Cambiado
- La última tarjeta de un mes de 5 sábados ya no se estira a todo el ancho de la fila; mantiene el mismo ancho que
  las demás.

## [1.0.1] - 2026-08-07
### Cambiado
- El contenido aprovecha más ancho de pantalla (hasta 1800px) y pasa a una rejilla de hasta 4 columnas en pantallas
  anchas, en vez de quedarse siempre en 2.

## [1.0.0] - 2026-08-07
Primera versión completa de la herramienta.
### Añadido
- Web con carga y guardado automático de meses vía la API de GitHub (token personal), con copiar/pegar manual como
  alternativa sin configurar nada.
- Motor de reglas compartido (web + comprobación automática): mínimos de Teléfonos/Mostrador, refuerzo automático
  por grupo, y Sustitución Manual para cambios/favores puntuales entre personas.
- Gestión de personal ("👥 Personal"): añadir/quitar gente de cada grupo y reordenar el orden de refuerzo a
  Teléfonos, sin tocar código.
- Comprobación automática por GitHub Actions y aviso por email (HTML, con sugerencia de solución) cuando un sábado
  queda por debajo del mínimo.
- Impresión en A4 con diseño de índice numerado (Arial, un bloque por sábado).
- Barra de iconos: modo claro/oscuro, ayuda, ajustes (de momento un marcador de posición) y login (pendiente de
  decidir el enfoque).
- Pie de página con crédito y número de versión.

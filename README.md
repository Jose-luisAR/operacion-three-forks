# Operación Three Forks

**Tripulación Apogeo · NASA Space Apps Challenge 2026 · Reto "Mapa marciano"**

Aplicación web que planea y guía una caminata (EVA) en Marte. El objetivo de la caminata es recoger los **10 tubos de muestras** que el rover Perseverance dejó en el depósito **Three Forks** (cráter Jezero). En el camino también se toman **muestras nuevas** en lugares que el rover nunca visitó.

## Cómo abrirla

- **En la computadora:** abre `index.html` con doble clic (Chrome o Edge). Funciona sin internet.
- **En el celular:** publícala en GitHub Pages y abre el enlace `https://…`. Desde ahí se puede instalar como app (PWA), funciona sin internet y se activa el **modo patio** con GPS.

## Qué hace

1. **Planificación (en el hábitat).**
   - Muestra un mapa HiRISE de 25 cm con varias capas: ruta, tubos, recorrido real del rover, ciencia nueva y distancia máxima al hábitat.
   - Calcula la ruta más corta. Usa "vecino más cercano" y luego mejora 2-opt.
   - Muestra la línea de tiempo de la EVA contra la reserva del traje.
   - El hábitat se puede arrastrar en el mapa, y cada tubo se puede quitar o agregar a la ruta.
2. **Navegación tipo GPS (caminando).**
   - El mapa gira hacia donde caminas.
   - Da indicaciones vuelta por vuelta ("10 m → Tubo 7 · Bearwallow; luego gira a la derecha").
   - Indica qué hay alrededor ("Cráter B · 14 m a tu derecha").
   - Muestra hora de regreso, tubos y muestras recogidos, O₂ y reloj de Marte.
3. **Llegada.** Para cada parada muestra una vista satelital propia, centrada en ese punto y con la línea que indica hacia dónde apunta el tubo, y la panorámica real del rover de esos días. Además, para cada tubo muestra sus datos (designación, sol, azimut, contenido), una lista de pasos y la **ciencia nueva** de esa parada.
4. **Regla de regreso.** La app avisa cuando la reserva del traje solo alcanza para volver al hábitat con un 25 % de margen. Ofrece dos opciones: regresar ya, o recoger un tubo más si todavía alcanza.
5. **Supuestos ajustables.** Velocidad al caminar, minutos por tubo y por muestra, reserva del traje y margen de regreso se cambian con controles; la ruta, la línea de tiempo y las alertas se recalculan al momento.
6. **Español e inglés** con un botón ES / EN.
7. **Modos de demostración.**
   - **Simulación:** la ruta se camina sola, a ×1, ×5 o ×20.
   - **Modo patio:** usa el GPS real del celular. Cada metro que caminas en la Tierra es un metro en Jezero.

## Datos

| Real (NASA) | Archivo |
|---|---|
| Imagen HiRISE 25 cm de Jezero (Mars Trek, capa `JEZ_hirise_soc_006…`, zoom 17) | `img/hirise_three_forks.jpg` |
| Posición, sol y azimut de los 10 tubos (PDS Geosciences, Mars 2020 Sample Depot) | `datos/fuentes/sample_tube_locations.csv`, `sample_tube_event_sols.csv` |
| Recorrido del rover en el depósito (MMGIS `M20_waypoints.json`) | `datos/fuentes/M20_waypoints_depot.csv` |
| Clima MEDA, sol 1133 | `datos/fuentes/meda_ultimos_soles.json` |
| Contexto alrededor del depósito: misma capa HiRISE a zoom 15 (1.3 m/px) | `img/hirise_contexto.jpg` |
| Panorámicas Mastcam-Z de los soles 670, 690–692 y 693 (PDS, `browse/mosaics`) | `img/mastcamz_*.jpg` |

**Supuestos de diseño** (se muestran como tales en la app):
- ubicación del hábitat;
- velocidad al caminar: 0.5 m/s;
- 6 min por tubo y 15 min por muestra nueva;
- reserva del traje: 4 h;
- margen de regreso: 25 %;
- objetivos A y B: dos cráteres pequeños elegidos en la imagen HiRISE, fuera del recorrido del rover.

**Por verificar:** la alineación entre la imagen HiRISE y las coordenadas del rover. Comparada con el mapa orbital oficial del depósito (PDS, `browse/depot/m20_orbital_map_three_forks.png`), la posición coincide a unos 10–15 m.

## Estructura

```
index.html            vistas de planificación y navegación
css/estilos.css
js/datos.js           generado por scripts/preparar_datos.py
js/i18n.js            textos en español e inglés
js/geo.js             coordenadas, distancias y rumbos en metros
js/ruta.js            ruta óptima y presupuesto de tiempo
js/planificar.js      mapa Leaflet
js/navegar.js         GPS, llegada, alerta y modo patio
js/app.js             estado y unión de vistas
sw.js, manifest.webmanifest   app instalable y sin internet
scripts/preparar_datos.py     arma js/datos.js a partir de datos/fuentes/
vendor/               Leaflet 1.9 (licencia BSD-2)
```

Para regenerar los datos: `python scripts/preparar_datos.py` (con `--descargar` vuelve a bajar las fuentes de PDS y MEDA).

## Tecnologías

HTML, CSS y JavaScript sin frameworks, Leaflet y Canvas 2D; Python para preparar los datos.

Uso de IA: el equipo usó Claude (Anthropic) como asistente para proponer la idea, buscar y procesar los datos de la NASA, programar y depurar la app, y redactar y traducir textos. El equipo revisó y probó todo. La app no usa IA mientras funciona. Todas las imágenes son de la NASA; ninguna imagen, video o audio fue generado por IA.

Las imágenes son cortesía de NASA/JPL-Caltech/University of Arizona. Este proyecto no está afiliado a la NASA ni respaldado por ella.

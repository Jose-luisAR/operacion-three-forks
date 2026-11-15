# Formulario de envío — Operación Three Forks (Tripulación Apogeo)

## Nombre del proyecto
Operación Three Forks

## Resumen
Operación Three Forks es una aplicación web que planea y guía la caminata de un astronauta en Marte. La misión: recoger los 10 tubos con muestras que el rover Perseverance dejó en el depósito Three Forks, en el cráter Jezero, y tomar en el camino muestras nuevas en lugares que el rover nunca visitó.

La app une en un solo mapa datos reales de la NASA: la imagen HiRISE de 25 cm de Mars Trek, la ubicación y orientación de cada tubo (PDS), el recorrido del rover (MMGIS), el clima de MEDA y las panorámicas de Mastcam-Z. Desde el hábitat calcula la ruta más corta y la compara con la reserva del traje. Durante la caminata funciona como un GPS tipo Google Maps: el mapa gira hacia donde caminas, da indicaciones vuelta por vuelta y muestra qué hay alrededor. En cada tubo enseña su vista satelital y sus datos, y avisa a tiempo cuándo hay que regresar.

Es importante porque convierte datos de muchas misiones en decisiones simples para una persona en el terreno: a dónde ir, qué recoger y cuándo volver. Funciona sin internet y se puede probar caminando con el GPS del celular.

## Demostración del proyecto (enlace)
PENDIENTE: video de 30 s o presentación de máximo 7 diapositivas, en enlace público (YouTube, Google Drive o GitHub).

## Proyecto (enlace)
PENDIENTE: enlace de GitHub Pages, por ejemplo https://jose-luisar.github.io/<nombre-del-repo>/

## Detalles del proyecto

**¿Qué hace?**
Operación Three Forks es una app web para planear y realizar una caminata extravehicular (EVA) en Marte. El objetivo es recuperar los 10 tubos de muestras que Perseverance dejó en el depósito Three Forks (cráter Jezero) entre los soles 653 y 690, y aprovechar la caminata para hacer ciencia nueva en puntos que el rover nunca tocó.

**¿Cómo funciona?**
1. Planificación en el hábitat. Un mapa por capas combina la imagen HiRISE de 25 cm (Mars Trek), la posición y el azimut de cada tubo (archivo PDS del depósito), el recorrido real del rover (MMGIS) y dos cráteres pequeños sin visitar que elegimos en la imagen. La app calcula el orden más corto para visitar todas las paradas (vecino más cercano + mejora 2-opt), estima distancia y tiempo, y los compara en una línea de tiempo con la reserva del traje. El hábitat se puede mover y cada parada se puede quitar o agregar; la ruta se recalcula al instante.
2. Navegación durante la caminata. Una vista tipo GPS gira el mapa hacia donde camina el astronauta, da indicaciones vuelta por vuelta ("10 m → Tubo 7 · Bearwallow; luego gira a la derecha"), muestra qué hay alrededor y lleva la cuenta de tubos, muestras, oxígeno y hora de regreso.
3. Llegada a cada parada. Muestra un recorte satelital centrado en ese punto con la dirección del tubo, la panorámica real de Mastcam-Z de esos días, los datos del tubo (designación, sol de toma y de depósito, contenido) y una lista de pasos, incluida la muestra nueva que toca tomar.
4. Regla de regreso. Si la reserva del traje solo alcanza para volver con 25 % de margen, la app avisa y ofrece regresar ya o recoger un tubo más solo si todavía alcanza.
5. Demostración. Modo simulación (la ruta se camina sola) y modo patio, que usa el GPS real del celular: cada metro caminado en la Tierra es un metro en Jezero.

**Beneficios e impacto**
Convierte datos de varias misiones de la NASA en decisiones simples para una persona en el terreno: a dónde ir, qué recoger y cuándo volver. Ayuda a planear una de las primeras tareas reales que podrían hacer astronautas en Marte (recuperar muestras de Perseverance) y suma valor científico: cada tubo vuelve acompañado de una muestra de su contexto tomada por una persona.

**Herramientas**
HTML, CSS y JavaScript sin frameworks, Leaflet para el mapa y Canvas 2D para la navegación. Python para descargar y preparar los datos de la NASA. Es una aplicación web progresiva: se puede instalar en el celular, funciona sin internet y está en español e inglés.

**Creatividad y decisiones del equipo**
Elegimos un lugar real con un objetivo real (el depósito de muestras) en vez de una ruta inventada. Separamos con claridad los datos reales de la NASA de los supuestos de diseño de la misión (ubicación del hábitat, velocidad al caminar, tiempos por parada y reserva del traje), que la app marca como supuestos y que se pueden ajustar con controles: la ruta, la línea de tiempo y las alertas se recalculan al instante. Comparamos nuestra alineación con el mapa orbital oficial del depósito: coincide a unos 10–15 m.

## Uso de la Súper Inteligencia (SI)
Opción a seleccionar: **Código y datos** (no seleccionar Imágenes/videos ni Audio).
Si hay un campo de texto: Usamos Claude (Anthropic) como asistente para escribir y depurar el código de la app y del script de Python que prepara los datos, y para redactar parte de los textos. El equipo revisó, probó y ajustó todo. Esto se indica en el README del proyecto. Todas las imágenes son de la NASA; no hay imágenes, videos ni audio generados por IA y no se usa ningún logotipo de la NASA.

## Datos de la NASA
Ver FORMULARIO_DATOS.md

## Socio de la Agencia Espacial y otros datos
Ver FORMULARIO_DATOS.md

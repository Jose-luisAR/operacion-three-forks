# Submission form (English) — Operation Three Forks (Tripulación Apogeo)

## Project Name
Operation Three Forks

## Summary
Operation Three Forks is a web app that plans and guides an astronaut's walk on Mars. The mission: retrieve the 10 sample tubes that the Perseverance rover left at the Three Forks depot in Jezero Crater, and collect new samples along the way at spots the rover never visited.

The app combines real NASA data on a single map: the 25 cm HiRISE image from Mars Trek, the location and orientation of each tube (PDS), the rover's traverse (MMGIS), MEDA weather and Mastcam-Z panoramas. From the habitat it computes the shortest route and checks it against the suit's reserve. During the walk it works like a Google Maps–style GPS: the map turns to face where you are walking, gives turn-by-turn directions and shows what is around you. At each tube it displays a satellite close-up and the tube's data, and warns in time when it is time to head back.

It matters because it turns data from many missions into simple decisions for a person on the ground: where to go, what to collect and when to return. It works offline and can be tested by walking with a phone's GPS.

## Project Demo (link)
PENDING: 30-second video or a presentation of up to 7 slides, at a public link.

## Final Project (link)
PENDING: GitHub Pages link.

## Project Details

What does it do?
Operation Three Forks is a web app for planning and carrying out an extravehicular activity (EVA) on Mars. The goal is to recover the 10 sample tubes that Perseverance left at the Three Forks depot (Jezero Crater) between sols 653 and 690, and to use the walk to do new science at spots the rover never touched.

How does it work?
1. Planning in the habitat. A layered map combines the 25 cm HiRISE image (Mars Trek), the position and azimuth of each tube (PDS depot archive), the rover's actual traverse (MMGIS) and two small unvisited craters we picked from the image. The app computes the shortest order to visit every stop (nearest neighbor + 2-opt improvement), estimates distance and time, and compares them with the suit's reserve on a timeline. The habitat can be moved and any stop can be removed or added; the route is recalculated instantly.
2. Navigation during the walk. A GPS-style view turns the map to face where the astronaut is walking, gives turn-by-turn directions ("10 m → Tube 7 · Bearwallow; then turn right"), shows what is nearby and keeps track of tubes, samples, oxygen and return time.
3. Arrival at each stop. It shows a satellite close-up centered on that point with the tube's direction, the real Mastcam-Z panorama from those days, the tube's data (designation, sol collected and sol deposited, contents) and a checklist, including the new sample to take there.
4. Return rule. If the suit's reserve is only enough to get back with a 25% margin, the app warns the astronaut and offers to return now, or to pick up one more tube only if there is still enough reserve.
5. Demo. Simulation mode (the route walks itself) and backyard mode, which uses the phone's real GPS: every meter walked on Earth is a meter in Jezero.

Benefits and impact
It turns data from several NASA missions into simple decisions for a person on the ground: where to go, what to collect and when to return. It helps plan one of the first real tasks astronauts could do on Mars (recovering Perseverance's samples) and adds scientific value: each tube comes back with a sample of its surroundings collected by a person.

Tools
HTML, CSS and JavaScript with no frameworks, Leaflet for the map and Canvas 2D for navigation. Python to download and prepare the NASA data. It is a progressive web app: it can be installed on a phone, works offline and is available in English and Spanish.

Creativity and team decisions
We chose a real place with a real goal (the sample depot) instead of a made-up route. We clearly separate real NASA data from mission design assumptions (habitat location, walking speed, time per stop and suit reserve), which the app labels as assumptions and lets the user adjust with sliders: the route, timeline and alerts are recalculated instantly. We compared our alignment with the official orbital map of the depot: it matches to within about 10–15 m.

## Use of Artificial Intelligence (AI)
Option to select: Code and data (do not select Images/videos or Audio).
If there is a text field:
We used Claude (Anthropic) as an assistant to write and debug the app's code and the Python script that prepares the data, and to draft part of the text. The team reviewed, tested and adjusted everything. This is stated in the project's README. All images are from NASA; there are no AI-generated images, videos or audio, and no NASA logos are used.

## NASA Data
| Link text | URL |
|---|---|
| Mars Trek (NASA/JPL): 25 cm HiRISE image of Jezero, layer JEZ_hirise_soc_006 | https://trek.nasa.gov/mars/ |
| PDS Geosciences: Mars 2020 Sample Depot (Three Forks), depot data | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/ |
| PDS: location of the 10 tubes (sample_tube_locations.csv) | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_locations.csv |
| PDS: deposit sols and imaging of each tube (sample_tube_event_sols.csv) | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_event_sols.csv |
| PDS: Mastcam-Z panoramas of the depot (sols 670, 690–692 and 693) | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/browse/mosaics/ |
| Perseverance traverse (MMGIS, M20_waypoints.json) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json |
| Perseverance location map (MMGIS) | https://mars.nasa.gov/maps/location/?mission=M20 |
| Jezero weather, MEDA station (Mars 2020 API) | https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json&ver=1.0 |
| Perseverance raw images | https://mars.nasa.gov/mars2020/multimedia/raw-images/ |

## Space Agency Partner & Other Data
We did not use data from other space agencies.
| Link text | URL |
|---|---|
| Leaflet 1.9 (mapping library, BSD-2 license) | https://leafletjs.com |
| Barlow and Barlow Condensed fonts (Google Fonts, OFL license) | https://fonts.google.com/specimen/Barlow |
| Pillow (image processing in Python) | https://python-pillow.org |
| Claude (Anthropic), AI assistant used for code and text | https://claude.ai |

# Publicar la v1.8.0

**Respuesta corta: no, no alcanza con subir el ZIP.** Hay tres cosas que
cambian fuera del paquete y una de ellas es obligatoria por política de la
tienda.

Vas de la **1.3.2** (lo que está publicado hoy) a la **1.8.0**, saltando
cinco versiones de una. Todo lo de la 1.4.0 en adelante nunca se subió.

---

## Lo que hay que hacer, en orden

### 1. Pushear el código (obligatorio, y hoy no está)

Hay **10 commits locales sin pushear**. Nada de esto existe en GitHub todavía,
así que la GitHub Page de la política de privacidad sigue sirviendo la versión
vieja.

```bash
git push origin main
```

Verificá que quedó publicada la página antes de seguir, porque la tienda va a
leer esa URL:
<https://matutetandil.github.io/weather-clock/privacy.html>

### 2. Actualizar la política de privacidad (OBLIGATORIO)

Esto no es cosmético: **la política que está publicada hoy dice algo que ya no
es cierto.** Afirmaba:

> "For disaster alerts, your coordinates are **not** sent to alert APIs."

Desde la 1.6.0 eso es falso. Las alertas de Estados Unidos ahora consultan
`api.weather.gov/alerts/active?point=lat,lon`, que **envía las coordenadas del
usuario**. Fue un cambio deliberado y correcto —resolvía que Miami recibiera
alertas de Arizona y que se descartara el 95% de las alertas reales— pero
obliga a corregir la declaración.

Ya está corregido en `docs/privacy.html`, que se publica solo con el push del
paso 1. También agregué jsDelivr (los iconos del clima) a la lista de terceros,
que faltaba desde antes.

**Además, revisá en el Developer Dashboard** la sección *Privacy practices*:

- En **Data usage**, si tenías declarado que no se transmite ubicación a
  terceros, ahora corresponde marcar **Location** como dato manejado. Ya se
  enviaba a Open-Meteo, Stormglass y Nominatim, así que probablemente ya estaba
  declarado — pero verificalo, porque es la causa más común de rechazo.
- Confirmá que la URL de la política apunta a la GitHub Page de arriba.

### 3. Actualizar la descripción de la tienda (obligatorio en la práctica)

`docs/store-description.md` cambió. Copiá la sección *Detailed Description*
completa al dashboard. Lo nuevo:

- Un bloque **IMPORTANT — PLEASE READ** que aclara que esto es información
  complementaria y no un servicio de alertas de emergencia: solo corre con
  Chrome abierto, consulta cada pocos minutos en vez de recibir avisos push, y
  no puede alcanzarte con la computadora apagada.
- Bullets nuevos sobre el filtrado por ubicación real, la ventana de vigencia y
  el aviso cuando una fuente no responde.

No es estrictamente obligatorio por política, pero la descripción actual
promete cosas que no reflejan cómo funciona hoy, y el disclaimer es lo
responsable para una extensión que dice dar alertas de desastres.

### 4. Subir el paquete

**Importante: el workflow automático no va a funcionar.** Verifiqué que el repo
tiene **cero secrets configurados** y **ningún release creado**, así que
`.github/workflows/publish.yml` nunca se ejecutó — la 1.3.2 se subió a mano.
El job fallaría en el paso de `chrome-webstore-upload-cli` por falta de
`CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET` y
`CHROME_REFRESH_TOKEN`.

Así que armá el ZIP y subilo manualmente:

```bash
cd /Users/matute/Documents/Personal/WEATHER-CLOCK
rm -f weather-clock.zip
zip -r weather-clock.zip manifest.json newtab.html newtab.js background.js icons/ data/
unzip -l weather-clock.zip   # tienen que ser 11 archivos
```

Debe contener exactamente esto (≈560 KB comprimido):

```
manifest.json  newtab.html  newtab.js  background.js
icons/icon16.png  icons/icon48.png  icons/icon128.png
data/emma-regions.json      (1.3 MB — regiones de alerta de Europa)
data/coastline.json         (0.4 MB — costa oceánica, para tsunamis)
```

**Si falta `data/`, Europa deja de dar alertas y las ciudades tierra adentro
vuelven a recibir avisos de tsunami — y todo sin ningún error visible.** Por
eso el workflow tiene un paso que falla el build si no están; al subir a mano
esa red de seguridad no corre, así que revisá el `unzip -l`.

Subilo en el Developer Dashboard → *Package* → *Upload new package*.

---

## Lo que NO hace falta tocar

- **Permisos**: sin cambios. Los cuatro hosts nuevos que usamos
  (`api.weather.gov` con query por punto, `feeds.meteoalarm.org` por país,
  `apiprevmet3.inmet.gov.br`, `rss.naad-adna.pelmorex.com`) ya estaban todos en
  `host_permissions`. Como no aumentan los permisos, **Chrome no va a
  deshabilitar la extensión ni pedirle nada al usuario** al actualizar: la
  update entra sola.
- **Los datos empaquetados** van dentro del ZIP. El usuario no descarga nada ni
  acepta ningún prompt extra.
- **Iconos**: sin cambios.

---

## Screenshots: conviene, pero no bloquea

Las 8 capturas actuales son de la 1.3.2 y el panel de alertas cambió bastante.
Ahora puede mostrar:

- la etiqueta **Upcoming** con "starts tomorrow 15:00" en alertas que todavía
  no empezaron, atenuadas;
- el aviso naranja **⚠️ A source is unavailable** cuando un feed no responde;
- el disclaimer al pie del panel.

Si querés rehacer alguna, la del tab de alertas es la que más quedó
desactualizada. El resto (reloj, forecast, mareas) sigue igual. Tamaño:
1280x800, como las que ya están.

---

## Chequeo previo

```bash
node tools/check-sources.mjs   # las 10 fuentes en verde
node --check background.js && node --check newtab.js
python3 -c "import json;print(json.load(open('manifest.json'))['version'])"   # 1.8.0
```

---

## Qué esperar de la revisión

La 1.3.2 pasó sin problemas. Esta trae dos cosas que pueden alargar el trámite:

- **El salto de versión y el volumen de cambios.** Es normal, pero mueve la
  extensión a revisión manual con más frecuencia.
- **La declaración de privacidad.** Si el envío de coordenadas al NWS no está
  reflejado en *Data usage*, es rechazo casi seguro. Es el punto al que más
  atención hay que prestarle.

---

## Si querés automatizarlo para la próxima

El workflow ya está escrito y funcionando salvo por las credenciales. Para que
ande, cargá estos cuatro secrets en *Settings → Secrets and variables →
Actions*:

`CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`,
`CHROME_REFRESH_TOKEN`

Se obtienen habilitando la Chrome Web Store API en Google Cloud Console y
generando un refresh token OAuth. Después alcanza con crear un release en
GitHub y el resto es automático, con la verificación de `data/` incluida.

Aparte: **GitHub Actions es gratis e ilimitado en repos públicos** —los minutos
solo se cobran en privados— así que agregar el chequeo periódico de fuentes
tampoco te costaría nada.

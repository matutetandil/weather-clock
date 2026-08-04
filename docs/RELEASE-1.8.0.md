# Publicar la v1.8.0

Vas de la **1.3.2** (lo publicado hoy en la tienda) a la **1.8.0**, saltando
cinco versiones de una. Todo lo de la 1.4.0 en adelante nunca se subió.

La preparación técnica ya está hecha. **Lo que queda son tres pasos en el
Developer Dashboard**, y uno de ellos es el que decide si te aprueban.

---

## Lo que falta hacer (todo en el Developer Dashboard)

### 1. Declaración de privacidad — ES EL PASO CRÍTICO

Andá a *Privacy practices* y revisá la sección **Data usage**.

**Por qué importa ahora:** hasta la 1.5.0, la extensión nunca mandaba tus
coordenadas a las APIs de alertas — bajaba los feeds enteros y filtraba en tu
máquina. Desde la **1.6.0 eso cambió para Estados Unidos**: ahora consulta
`api.weather.gov/alerts/active?point=lat,lon`, que **sí envía las coordenadas
del usuario**.

Fue un cambio necesario (antes Miami recibía alertas de Arizona y se
descartaba el 95% de las alertas reales, porque la mayoría de los avisos del
NWS referencian zonas de pronóstico en vez de publicar un polígono), pero
obliga a que la declaración lo refleje.

Qué revisar concretamente:

- **Location** tiene que figurar entre los datos que la extensión maneja. Ya se
  enviaba a Open-Meteo, Stormglass y Nominatim para el clima, las mareas y el
  nombre de la ciudad, así que lo más probable es que ya esté marcado — pero
  confirmalo.
- La **URL de la política** tiene que apuntar a
  <https://matutetandil.github.io/weather-clock/privacy.html>

> Si esto queda mal declarado, es la causa de rechazo más probable de todo el
> envío. El texto de la política ya está corregido y publicado; lo que falta es
> que el formulario del dashboard diga lo mismo.

### 2. Descripción de la tienda

Copiá la sección *Detailed Description* completa desde
[`store-description.md`](store-description.md) y pegala en el dashboard.

Lo que cambió respecto de lo que está publicado:

- Un bloque **IMPORTANT — PLEASE READ** aclarando que esto es información
  complementaria y no un servicio de alertas de emergencia: solo corre con
  Chrome abierto, consulta cada pocos minutos en vez de recibir avisos push, y
  no puede alcanzarte con la computadora apagada.
- Bullets nuevos sobre el filtrado por ubicación real, la ventana de vigencia y
  el aviso cuando una fuente no responde.

No es obligatorio por política de la tienda, pero la descripción actual promete
cosas que no reflejan cómo funciona hoy, y el disclaimer es lo responsable para
una extensión que dice dar alertas de desastres.

### 3. Subir el paquete

*Package* → *Upload new package* → subir **`weather-clock.zip`** (está en la
raíz del proyecto).

Eso es todo. No hay que tocar permisos, iconos ni nada más.

---

## Lo que ya está hecho

### ✅ Código pusheado

Los 11 commits están en `origin/main` (`3a20686..ff65292`).

### ✅ Política de privacidad corregida y publicada

`docs/privacy.html` ya tiene:

- La excepción del NWS explicada, reemplazando la afirmación anterior —que
  decía que las coordenadas nunca se envían a APIs de alertas— porque había
  dejado de ser cierta.
- **jsDelivr** agregado a la lista de terceros. Sirve los iconos del clima; no
  recibe coordenadas, pero como cualquier pedido de imagen sí ve tu IP. Esa
  omisión venía de antes.

El deploy de GitHub Pages corrió solo y quedó verificado en vivo: la página
dice *Last updated: August 4, 2026* y menciona `api.weather.gov`.

Se auditó el código para respaldar la afirmación: **NWS es la única fuente de
alertas que transmite coordenadas** (`background.js:598`). Todas las demás
bajan el feed completo y filtran localmente.

### ✅ ZIP generado y validado

`weather-clock.zip`, **559 KB, 11 archivos**. No se validó solo el listado: se
descomprimió el paquete y se verificó que funcione.

```
manifest.json          version 1.8.0, 4 permisos, 14 hosts
newtab.html  newtab.js  background.js      compilan
icons/icon16.png  icon48.png  icon128.png
data/emma-regions.json   parsea — 2003 regiones   (alertas de Europa)
data/coastline.json      parsea — 29.852 puntos   (costa, para tsunamis)
```

Sin archivos ocultos ni metadata de macOS.

> **Si alguna vez rehacés el ZIP a mano, revisá que `data/` esté adentro.** Si
> falta, Europa deja de dar alertas y las ciudades tierra adentro vuelven a
> recibir avisos de tsunami — y todo eso **sin ningún error visible**. El
> workflow tiene un paso que falla el build si no están, pero subiendo a mano
> esa red de seguridad no corre.
>
> ```bash
> rm -f weather-clock.zip
> zip -r weather-clock.zip manifest.json newtab.html newtab.js background.js icons/ data/
> unzip -l weather-clock.zip   # tienen que ser 11 archivos
> ```

---

## Lo que NO hay que tocar

- **Permisos**: sin cambios. Los cuatro hosts que se sumaron en estas versiones
  (`api.weather.gov` con query por punto, `feeds.meteoalarm.org` por país,
  `apiprevmet3.inmet.gov.br`, `rss.naad-adna.pelmorex.com`) ya estaban todos en
  `host_permissions`. Como los permisos no aumentan, **Chrome no va a
  deshabilitar la extensión ni pedirle nada al usuario**: la actualización
  entra sola.
- **Datos empaquetados**: viajan dentro del ZIP. El usuario no descarga nada ni
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

La del tab de alertas es la que más quedó desactualizada. El resto (reloj,
forecast, mareas) sigue igual. Tamaño: 1280x800, como las que ya están.

---

## Qué esperar de la revisión

La 1.3.2 pasó sin problemas. Esta trae dos cosas que pueden alargar el trámite:

- **El salto de versión y el volumen de cambios**, que suele derivar en
  revisión manual.
- **La declaración de privacidad**, que es el punto 1 de arriba.

Si te rechazan, lo más probable por lejos es que sea por eso. El texto de la
política ya está bien; alcanzaría con ajustar el formulario.

---

## Antes de subir, si querés chequear

```bash
node tools/check-sources.mjs   # las 10 fuentes en verde
node --check background.js && node --check newtab.js
python3 -c "import json;print(json.load(open('manifest.json'))['version'])"   # 1.8.0
```

---

## Para la próxima: automatizar

`.github/workflows/publish.yml` está escrito y funcionando salvo por las
credenciales. Se verificó que **nunca se ejecutó**: el repo tiene cero secrets
y no hay ningún release creado, así que la 1.3.2 se subió a mano igual que
esta.

Para que ande, cargá estos cuatro secrets en *Settings → Secrets and variables
→ Actions*:

`CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`,
`CHROME_REFRESH_TOKEN`

Se obtienen habilitando la Chrome Web Store API en Google Cloud Console y
generando un refresh token OAuth. Después alcanza con crear un release en
GitHub: el workflow arma el ZIP, verifica que `data/` esté incluido y publica.

Aparte: **GitHub Actions es gratis e ilimitado en repos públicos** —los minutos
solo se cobran en privados— así que agregar un chequeo periódico que corra
`tools/check-sources.mjs` y avise si una fuente se rompe tampoco costaría nada.
Habría cachado la caída de MeteoAlarm y la de huracanes meses antes.

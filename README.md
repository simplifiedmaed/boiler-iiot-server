# S.M.A. Thermal IIoT – Receptor y dashboard

Recibe lecturas de sensores de una caldera, calcula la **eficiencia por método indirecto (ASME PTC 4.1)** con las 8 pérdidas L₁–L₈ y las muestra en un dashboard en vivo.

```
[ Caldera / PLC / Simulador ] --HTTP POST--> [ Este servidor ] --SSE--> [ Dashboard web ]
        boiler-simulator          /api/ingest     calc.js              /api/stream
```

## Ejecutar local (Node 18+, sin dependencias)
```bash
API_KEY=mi-clave node server.js        # abre http://localhost:3000
```

## Desplegar en la nube (Render / Railway / Fly.io)
- Build command: *(ninguno)* · Start command: `node server.js`
- Variable de entorno `API_KEY` = una clave secreta (la misma que usa el simulador/gateway).

## API
`POST /api/ingest` con header `x-api-key`:
```json
{"plant":"Planta 1","fuel":"Carbón","flow":1000,"hum":7.6,"tg":200,"o2":6,"co":0.05,
 "tb":70,"area":30,"ta":28,"rh":70,"wind":1}
```
Si un sensor llega como `null` o inválido, el servidor lo marca y el dashboard alerta (no calcula con datos malos).
Opcionales: `C,H,N,S,O,pci,ash,bot,pb,pf` para sobrescribir la composición estándar del combustible.

`GET /api/stream` (SSE) · `GET /api/history` · `GET /health`

## Conectar una caldera real
Cualquier gateway que pueda hacer un POST con ese JSON sirve (Node-RED, Python, PLC con módulo HTTP/MQTT→HTTP).

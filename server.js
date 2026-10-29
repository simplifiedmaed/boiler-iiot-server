/* S.M.A. Thermal IIoT – receptor de datos (sin dependencias, Node 18+)
   POST /api/ingest   ← el gateway/simulador envía lecturas (header x-api-key)
   GET  /api/stream   → Server-Sent Events para el dashboard en vivo
   GET  /api/history  → últimas lecturas calculadas
   GET  /health       → estado del servicio                                  */
const http=require('http'),fs=require('fs'),path=require('path');
const {compute}=require('./calc');

const PORT=process.env.PORT||3000;
const API_KEY=process.env.API_KEY||'demo-key';
const MAX_HISTORY=900;
const history=[];            // lecturas procesadas (más recientes al final)
const plants=new Map();      // última lectura por planta
const clients=new Set();     // conexiones SSE abiertas

function broadcast(obj){
 const msg='data: '+JSON.stringify(obj)+'\n\n';
 for(const res of clients) res.write(msg);
}

function handleIngest(body){
 const d=JSON.parse(body);
 const res=compute(d);
 const rec={
  t:Date.now(), plant:d.plant||'planta-demo', scenario:d.scenario||null, fuel:d.fuel,
  raw:{flow:d.flow,hum:d.hum,tg:d.tg,o2:d.o2,co:d.co,tb:d.tb,area:d.area,ta:d.ta,rh:d.rh,wind:d.wind},
  ok:res.ok, reason:res.reason||null, r:res.r||null, eff:res.ok?res.eff:null
 };
 history.push(rec); if(history.length>MAX_HISTORY) history.shift();
 plants.set(rec.plant,rec);
 broadcast({type:'data',rec});
 return rec;
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://x');
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','content-type,x-api-key');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}

 if(req.method==='POST'&&url.pathname==='/api/ingest'){
  if(req.headers['x-api-key']!==API_KEY){res.writeHead(401);return res.end('API key inválida');}
  let body=''; req.on('data',c=>{body+=c; if(body.length>1e5)req.destroy();});
  req.on('end',()=>{
   try{const rec=handleIngest(body); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:rec.ok,eff:rec.eff}));}
   catch(e){res.writeHead(400);res.end('JSON inválido');}
  });
  return;
 }
 if(url.pathname==='/api/stream'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
  res.write('data: '+JSON.stringify({type:'init',history})+'\n\n');
  clients.add(res); req.on('close',()=>clients.delete(res)); return;
 }
 if(url.pathname==='/api/history'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(history));}
 if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({status:'ok',plants:[...plants.keys()],readings:history.length}));}

 /* archivos estáticos del dashboard */
 const file=path.join(__dirname,'public',url.pathname==='/'?'index.html':path.normalize(url.pathname).replace(/^(\.\.[/\\])+/,''));
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);return res.end('No encontrado');}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'}); res.end(data);
 });
});
setInterval(()=>{for(const r of clients)r.write(': ping\n\n');},15000);
server.listen(PORT,()=>console.log(`S.M.A. Thermal IIoT receptor en http://localhost:${PORT}  (API_KEY=${API_KEY==='demo-key'?'demo-key [cámbiala en producción]':'***'})`));

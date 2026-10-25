import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {buildDemoMarket,stocks,analyze} from './market.js';
const root=resolve('public'), data=resolve(process.env.DATA_DIR||'.data');
await mkdir(data,{recursive:true});
let market=buildDemoMarket(), source='demo', updatedAt=null, marketError=null;
let state={cash:100000,holdings:[],trades:[],guru:null};
try{state=JSON.parse(await readFile(resolve(data,'portfolio.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
async function save(){const f=resolve(data,'portfolio.json');await writeFile(f+'.tmp',JSON.stringify(state));await rename(f+'.tmp',f)}
async function refresh(){
 if(process.env.MARKET_MODE!=='live')return;
 try{
 const results=await Promise.all(stocks.map(async([symbol,name,sector])=>{
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Kursanbieter: HTTP ${response.status}`);
 const json=await response.json(), chart=json.chart?.result?.[0];
 if(!chart)throw Error('Keine Kursdaten erhalten');
 const history=chart.indicators.quote[0].close.filter(x=>Number.isFinite(x)&&x>0);
 return {symbol,name,sector,currency:chart.meta.currency,price:history.at(-1),history,...analyze(history)};
 }));market=results;source='live';updatedAt=new Date().toISOString();marketError=null;
 }catch(e){marketError=e.message}
}
function snapshot(){if(!state.guru?.active || source!=='live')return false;const day=new Date().toISOString().slice(0,10);if(state.guru.snapshots.at(-1)?.date===day)return false;state.guru.snapshots.push({date:day,positions:state.guru.positions.map(p=>({...p,price:market.find(s=>s.symbol===p.symbol).price}))});return true}
await refresh();
if(snapshot())await save();
let queue=Promise.resolve();
setInterval(()=>{queue=queue.then(async()=>{await refresh();if(snapshot())await save()}).catch(console.error)},15*60*1000).unref();
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Anfrage zu groß')}return JSON.parse(raw||'{}')}
async function api(req,res,path){
 if(req.method==='GET'&&path==='/api/dashboard')return json(res,200,{market,source,updatedAt,marketError,state});
 if(req.method!=='POST')return json(res,404,{error:'Nicht gefunden'});
 const input=await body(req);
 if(path==='/api/trade'){
 if(source!=='live'||marketError||Date.now()-Date.parse(updatedAt)>20*60*1000)return json(res,409,{error:'Handel benötigt echte Kursdaten. Demodaten dürfen kein Marktportfolio bewerten.'});
 const stock=market.find(s=>s.symbol===input.symbol),quantity=Number(input.quantity);
 if(!stock||!Number.isInteger(quantity)||quantity<1||quantity>100000||!['buy','sell'].includes(input.side))return json(res,400,{error:'Ungültiger Auftrag'});
 if(stock.currency!=='EUR')return json(res,400,{error:'Für das EUR-Portfolio sind derzeit nur EUR-Aktien handelbar. USD-Handel benötigt Wechselkurse.'});
 let holding=state.holdings.find(p=>p.symbol===stock.symbol), cost=quantity*stock.price;
 if(input.side==='buy'){
 if(cost>state.cash)return json(res,400,{error:'Nicht genügend Guthaben'});
 state.cash-=cost;if(!holding){holding={symbol:stock.symbol,quantity:0,cost:0};state.holdings.push(holding)}holding.quantity+=quantity;holding.cost+=cost;
 }else{if(!holding||holding.quantity<quantity)return json(res,400,{error:'Nicht genügend Aktien'});holding.cost*=1-quantity/holding.quantity;holding.quantity-=quantity;state.cash+=cost;state.holdings=state.holdings.filter(p=>p.quantity>0)}
 state.trades.unshift({symbol:stock.symbol,quantity,side:input.side,price:stock.price,date:new Date().toISOString()});
 }else if(path==='/api/guru/start'){
 if(source!=='live'||marketError||Date.now()-Date.parse(updatedAt)>20*60*1000)return json(res,409,{error:'Das Guru-Portfolio benötigt echte Kursdaten.'});
 if(state.guru?.active)return json(res,409,{error:'Ein Guru-Portfolio läuft bereits'});
 const selection=[...market].sort((a,b)=>b.score-a.score).slice(0,4);
 state.guru={active:true,startedAt:new Date().toISOString(),positions:selection.map(s=>({symbol:s.symbol,entry:s.price,currency:s.currency,weight:.25})),snapshots:[]};snapshot();
 }else if(path==='/api/guru/stop'){if(state.guru?.active){if(source!=='live'||marketError||Date.now()-Date.parse(updatedAt)>20*60*1000)return json(res,409,{error:'Stoppen benötigt echte Kursdaten für die Abschlussbewertung'});const final={date:new Date().toISOString().slice(0,10),positions:state.guru.positions.map(p=>({...p,price:market.find(s=>s.symbol===p.symbol).price}))};state.guru.snapshots.push(final);state.guru.active=false;state.guru.stoppedAt=new Date().toISOString()}}
 else return json(res,404,{error:'Nicht gefunden'});
 await save();return json(res,200,{state});
}
http.createServer(async(req,res)=>{
 try{const path=new URL(req.url,'http://local').pathname;
 if(path.startsWith('/api/')){queue=queue.catch(()=>{}).then(()=>api(req,res,path));await queue;return}
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Methode nicht erlaubt'});
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/'))return json(res,403,{error:'Verboten'});
 const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Nicht gefunden':e.message})}
}).listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Aktienguru gestartet'));

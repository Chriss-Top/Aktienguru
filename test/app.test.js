import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyze,buildDemoMarket} from '../market.js';
test('Trendberechnung verwendet 20, 60 und 200 Handelstage',()=>{const p=Array.from({length:260},(_,i)=>i+1);const a=analyze(p);assert.equal(a.short,(260/240-1)*100);assert.equal(a.medium,(260/200-1)*100);assert.equal(a.long,(260/60-1)*100);assert.ok(a.score>=0&&a.score<=100);assert.throws(()=>analyze([1,2]));assert.throws(()=>analyze(Array(260).fill(0)))});
test('Demodaten enthalten acht reproduzierbare vollständige Zeitreihen',()=>{const market=buildDemoMarket();assert.equal(market.length,8);assert.deepEqual(market,buildDemoMarket());assert.ok(market.every(s=>s.history.length===260&&s.price>0))});
test('Server liefert Dashboard und sperrt Handel sowie Guru bei Demodaten',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'guru-test-')), port=3100+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MARKET_MODE:'demo'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Serverstart abgelaufen')),10000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve()});child.once('error',reject)});
 const base=`http://127.0.0.1:${port}`;
 const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Aktienguru/);
 const result=await (await fetch(base+'/api/dashboard')).json();assert.equal(result.source,'demo');assert.equal(result.market.length,8);assert.equal(result.state.cash,100000);
 for(const path of ['/api/trade','/api/guru/start']){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:'SAP.DE',quantity:1,side:'buy'})});assert.equal(r.status,409);assert.ok((await r.json()).error)}
 const after=await (await fetch(base+'/api/dashboard')).json();assert.equal(after.state.holdings.length,0);assert.equal(after.state.guru,null);
 assert.equal((await fetch(base+'/missing')).status,404);
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await rm(dir,{recursive:true,force:true})}
});

test('Live-Workflow mit kontrollierter Kursanbieter-Fixture: Handel, Guru und Neustart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'guru-live-test-')),port=4200+Math.floor(Math.random()*1000);
 const fixture=join(dir,'provider.mjs');
 await writeFile(fixture,`globalThis.fetch=async()=>({ok:true,json:async()=>({chart:{result:[{meta:{currency:'EUR'},indicators:{quote:[{close:Array.from({length:260},(_,i)=>100+i)}]}}]}})});`);
 let child;
 async function start(){child=spawn(process.execPath,['--import',fixture,'server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MARKET_MODE:'live'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('error',reject)})}
 async function stop(){child.kill();await new Promise(resolve=>child.once('exit',resolve))}
 const base=`http://127.0.0.1:${port}`;
 async function post(path,body={}){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
 async function dashboard(){return (await fetch(base+'/api/dashboard')).json()}
 try{
 await start();assert.equal((await dashboard()).source,'live');
 assert.equal((await post('/api/trade',{symbol:'SAP.DE',quantity:2,side:'buy'})).status,200);
 let d=await dashboard();assert.equal(d.state.cash,100000-718);assert.equal(d.state.holdings[0].quantity,2);
 assert.equal((await post('/api/trade',{symbol:'SAP.DE',quantity:3,side:'sell'})).status,400);
 assert.equal((await post('/api/trade',{symbol:'SAP.DE',quantity:1,side:'sell'})).status,200);
 assert.equal((await post('/api/guru/start')).status,200);d=await dashboard();assert.equal(d.state.guru.positions.length,4);assert.equal(d.state.guru.snapshots.length,1);
 assert.equal((await post('/api/guru/start')).status,409);
 assert.equal((await post('/api/guru/stop')).status,200);assert.equal((await dashboard()).state.guru.active,false);
 await stop();await start();d=await dashboard();assert.equal(d.state.holdings[0].quantity,1);assert.equal(d.state.trades.length,2);assert.equal(d.state.guru.active,false);
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
});

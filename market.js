export const stocks = [
 ['MSFT','Microsoft','Technologie',428.76,0.86],['AAPL','Apple','Technologie',235.4,0.65],['NVDA','NVIDIA','Halbleiter',138.85,1.62],['GOOGL','Alphabet','Kommunikation',192.3,0.91],['AMZN','Amazon','Konsum',224.19,1.14],['SAP.DE','SAP','Software',246.8,0.74],['SIE.DE','Siemens','Industrie',208.1,0.56],['ALV.DE','Allianz','Versicherung',307.2,0.33]
];
// Deliberately synthetic, deterministic history. Never presented as market evidence.
export function demoHistory(base, seed) {
 return Array.from({length:260},(_,i)=> +(base*(0.78+0.22*i/259+0.025*Math.sin(i/9+seed)+0.012*Math.cos(i/3+seed))).toFixed(2));
}
export function analyze(prices) {
 if(prices.length<210 || prices.some(p=>!Number.isFinite(p)||p<=0)) throw new Error('Mindestens 210 gültige Tageskurse benötigt');
 const last=prices.at(-1), change=n=>(last/prices.at(-1-n)-1)*100;
 const returns=prices.slice(1).map((p,i)=>p/prices[i]-1), mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const volatility=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length)*Math.sqrt(252)*100;
 const short=change(20), medium=change(60), long=change(200);
 return {short,medium,long,volatility,score:Math.max(0,Math.min(100,Math.round(50+short*.8+medium*.6+long*.35-volatility*.3)))};
}
export function buildDemoMarket(){return stocks.map(([symbol,name,sector,base],i)=>{const history=demoHistory(base,i);return {symbol,name,sector,currency:symbol.endsWith('.DE')?'EUR':'USD',price:history.at(-1),history,...analyze(history)}})}

/* Modelo de cálculo S.M.A. – método indirecto, 8 pérdidas (ASME PTC 4.1)
   Portado de script.js (navegador) para ejecutarse en el servidor. */
const mk=(n,tipo,C,H,N,S,O,hum,pci,flow)=>Object.freeze({n,tipo,C,H,N,S,O,hum,pci:+pci.toFixed(1),flow,solid:tipo==='Sólido'});
const perKg=(kJ_L,rho)=>kJ_L/rho;
const FUELS=[
 mk('Carbón','Sólido',69.18,4.95,1.04,4.46,10.44,7.61,28760.24,1000),
 mk('Bagazo de caña','Sólido',45.44,6.11,1.03,0.04,39.26,47.05,14742.95,1000),
 mk('Fibra de palma','Sólido',51.03,5.92,1.12,0.20,23.66,19.48,16639.71,1000),
 mk('Cascarilla de arroz','Sólido',42.39,5.19,3.89,0.12,30.56,9.00,14952.94,1000),
 mk('Cisco de café','Sólido',51.08,6.47,1.45,0.07,38.43,9.04,17925.99,1000),
 mk('Madera','Sólido',53.45,6.88,0.46,0.02,38.82,8.28,16979.09,1000),
 mk('Queroseno','Líquido',86.4,13.49,0,0.09,0.01,7.61,perKg(34381.91,0.803),300),
 mk('Fuel oil','Líquido',86.4,9.50,0.70,2.50,0,0,perKg(38166.48,0.97),300),
 mk('Biodiésel de palma','Líquido',56.7,8.02,1.83,0,33.35,0,perKg(33169.37,0.875),300),
 mk('Gasolina','Líquido',85.76,13.69,0.33,0.01,0.21,0,perKg(33589.18,0.741),300),
 mk('Diésel','Líquido',85.75,13.80,0.32,0,0.13,0,perKg(36231.51,0.856),300),
 mk('GLP','Gas',83.27,16.73,0,0,0,0,perKg(25432.51,0.56),300),
 mk('Gas natural','Gas',74.00,24.18,1.15,0,0.65,0,47640,250)];

const NUM=['flow','hum','tg','o2','co','tb','area','ta','rh','wind'];

/* d = lectura cruda del gateway: {fuel, flow, hum, tg, o2, co, tb, area, ta, rh, wind, [C,H,N,S,O,pci,ash,bot,pb,pf]}
   Devuelve {ok, r:{l1..l8}, eff} o {ok:false, reason} si faltan datos o son inválidos. */
function compute(d){
 const F=FUELS.find(x=>x.n===d.fuel)||FUELS[0];
 for(const k of NUM){ if(typeof d[k]!=='number'||!isFinite(d[k])) return {ok:false,reason:'Dato inválido o ausente: '+k}; }
 const I={...d};
 ['C','H','N','S','O','pci'].forEach(k=>{ if(typeof I[k]!=='number') I[k]=F[k]; });
 const ashAuto=F.solid?Math.max(0,+(100-(I.C+I.H+I.N+I.S+I.O)).toFixed(1)):0;
 if(typeof I.ash!=='number') I.ash=ashAuto;
 if(typeof I.bot!=='number') I.bot=70;
 if(typeof I.pb!=='number') I.pb=3000;
 if(typeof I.pf!=='number') I.pf=8000;
 if(I.o2<=0||I.o2>=21) return {ok:false,reason:'O₂ fuera de rango'};

 const {C,H,N,S,O}=I, pc=I.pci*0.239006, dT=I.tg-I.ta;
 const AT=((11.6*C)+(34.8*(H-O/8)+4.35*S))/100;
 const EA=I.o2*100/(21-I.o2), MAS=(1+EA/100)*AT;
 const MGS=(C/100*44/12)+(S/100*64/32)+(MAS*77/100)+((MAS-AT)*0.23);
 const l1=MGS*0.23*dT/pc*100;
 const l2=9*(H/100)*(584+0.45*dT)/pc*100;
 const l3=(I.hum/100)*(583+0.45*dT)/pc*100;
 const ex=(18.678-I.ta/234.5)*(I.ta/(257.14+I.ta)), pv=I.rh/100*0.61121*Math.exp(ex), w=0.622*pv/(101.325-pv);
 const l4=MAS*w*0.45*dT/pc*100;
 let l5=0;
 if(I.co>0){
  const mN=(AT*77/100)/28+(N/100)/28, mC=(C/100)/12, c2t=mC/(mN+mC)*100, co2=7900*c2t/(EA*(100-c2t)+7900);
  l5=(I.co*(C/100))/(I.co+co2)*(5744/pc)*100;}
 const Tk=I.tb+273.15, Ak=I.ta+273.15;
 const q=0.548*(Math.pow(Tk/55.55,4)-Math.pow(Ak/55.55,4)+1.957*Math.pow(Tk-Ak,1.25)*Math.pow((196.85*I.wind+68.9)/68.9,0.5));
 const l6=q*I.area*100/(pc*I.flow);
 const l7=F.solid?((100-I.bot)/100)*(I.ash/100)*I.pf*100/I.pci:0;
 const l8=F.solid?(I.bot/100)*(I.ash/100)*I.pb*100/I.pci:0;
 const r={l1,l2,l3,l4,l5,l6,l7,l8};
 const eff=100-Object.values(r).reduce((a,b)=>a+b,0);
 if(!(eff>0&&eff<=100)) return {ok:false,reason:'Eficiencia fuera de rango (revisar datos)',r,eff};
 return {ok:true,r,eff};
}
module.exports={compute,FUELS};

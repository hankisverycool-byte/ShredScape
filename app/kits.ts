// Technical outerwear kits from fictional labels. Names and logos are original; the vibes are borrowed.
//  ARCWYRM   - minimalist alpine shells, spine-arc logo (Arc'teryx-inspired)
//  PATAGOAT  - bright, baggy freeride kit, goat-horn skyline badge (Patagonia-inspired)
//  FJELLRUNE - Nordic storm shells, angular rune mark (Norrøna-inspired)
//  OBERMANN  - race suits, notched-peak O (Obermeyer / race-label inspired)
export type Style='shell'|'freeride'|'race';
export type Kit={tier?:'icon';tag?:string;id:string;brand:Brand;name:string;style:Style;jacket:string;pants:string;accent:string;helmet:string;lens:string;glove:string;price:number;description:string};
export type Brand='arcwyrm'|'patagoat'|'fjellrune'|'obermann'|'frostbyte'|'legend';
export const BRANDS:Record<Brand,{name:string;ink:string}>={
 arcwyrm:{name:'ARCWYRM',ink:'#e9ece6'},patagoat:{name:'PATAGOAT',ink:'#fff4dc'},fjellrune:{name:'FJELLRUNE',ink:'#f4efe4'},obermann:{name:'OBERMANN',ink:'#ffffff'},frostbyte:{name:'FROSTBYTE',ink:'#e9f7ff'},legend:{name:'ICON SERIES',ink:'#ffe9a8'},
};
export const STYLE_LABEL:Record<Style,string>={shell:'Fitted storm shell · slim pants · helmet',freeride:'Long shell · baggy pants · hood & beanie',race:'Race suit · colour-blocked · aero helmet'};
// ids keep the original catalog ids so owned items carry over.
export const KITS:Kit[]=[
 {id:'timber',brand:'fjellrune',name:'Lofoten Storm Shell',style:'shell',jacket:'#bb633e',pants:'#2c3438',accent:'#e8c383',helmet:'#2b3236',lens:'#f0a03c',glove:'#1d2226',price:0,description:'3-layer storm shell, taped seams, pit zips.'},
 {id:'glacier',brand:'arcwyrm',name:'Alpha Wyrmshell',style:'shell',jacket:'#7fb0c8',pants:'#1f272c',accent:'#d7f25a',helmet:'#e9eef0',lens:'#4fd0ff',glove:'#1f272c',price:200,description:'Trim alpine hardshell. Watertight zips, helmet hood.'},
 {id:'night',brand:'arcwyrm',name:'Sabre Stealth',style:'freeride',jacket:'#23292d',pants:'#171c20',accent:'#c6f04a',helmet:'#c6f04a',lens:'#b06cff',glove:'#c6f04a',price:350,description:'Blacked-out freeride shell, roomy cut, neon trims.'},
 {id:'alpine',brand:'obermann',name:'Kitz Downhill Suit',style:'race',jacket:'#f2ead8',pants:'#c8372d',accent:'#c8372d',helmet:'#c8372d',lens:'#ffd23c',glove:'#f2ead8',price:500,description:'Speed suit with red race panels. Tuck and go.'},
 {id:'signal',brand:'patagoat',name:'Powder Billy Anorak',style:'freeride',jacket:'#e07a35',pants:'#8b8455',accent:'#2f7f83',helmet:'#2f7f83',lens:'#ff5a8a',glove:'#2f7f83',price:750,description:'Baggy powder kit in blaze orange and olive.'},
 {id:'volt',brand:'frostbyte',name:'Voltage Shell',style:'shell',jacket:'#1f6fe0',pants:'#14171c',accent:'#e8f6ff',helmet:'#e8f6ff',lens:'#7be0ff',glove:'#14171c',price:300,description:'Electric-blue shell with reflective taping. Easy to spot on a flat-light day.'},
 {id:'cairn',brand:'patagoat',name:'Cairn Fleece Anorak',style:'freeride',jacket:'#6b7a4b',pants:'#3d3a32',accent:'#f2e6c4',helmet:'#3d3a32',lens:'#e8b04a',glove:'#f2e6c4',price:450,description:'Boxy olive anorak and bomber pants. Built for long days in the trees.'},
 {id:'vesper',brand:'arcwyrm',name:'Vesper Hardshell',style:'shell',jacket:'#d4622e',pants:'#3a2f4d',accent:'#ffb36b',helmet:'#3a2f4d',lens:'#ff8f5a',glove:'#3a2f4d',price:650,description:'Sunset-orange shell over plum pants. Looks great at golden hour.'},
 {id:'carbon',brand:'obermann',name:'Piste Carbon Suit',style:'race',jacket:'#16181b',pants:'#16181b',accent:'#ffd21f',helmet:'#ffd21f',lens:'#ffd21f',glove:'#16181b',price:900,description:'Blacked-out race suit with yellow flashes. Quiet confidence at 100 km/h.'},
 {id:'aurora',brand:'patagoat',name:'Untracked Shell',style:'shell',jacket:'#7a5c92',pants:'#2f4c53',accent:'#7fe0c4',helmet:'#2f4c53',lens:'#7fe0c4',glove:'#2f4c53',price:1200,description:'Recycled 3-layer shell, teal taped seams.'},
];
// Icon skins: original characters inspired by the kinds of legends the sport has (a halfpipe champion, a downhill queen, a big-mountain
// freerider...). Names and looks are invented; none is a real person.
export const ICONS:Kit[]=[
 {id:'kaito',tier:'icon',tag:'HALFPIPE CHAMPION',brand:'legend',name:'Kaito "Hurricane" Mori',style:'shell',jacket:'#f4f1ea',pants:'#c4262e',accent:'#c4262e',helmet:'#f4f1ea',lens:'#ff5a4a',glove:'#c4262e',price:1800,description:'Three-time halfpipe champion. White-and-red team shell, a helmet that has seen a lot of podiums.'},
 {id:'ingrid',tier:'icon',tag:'DOWNHILL QUEEN',brand:'legend',name:'Ingrid "Ice Queen" Falk',style:'race',jacket:'#bfe6ff',pants:'#1c3d63',accent:'#ffffff',helmet:'#1c3d63',lens:'#9fdcff',glove:'#ffffff',price:2200,description:'The fastest woman on the World Cup circuit. Ice-blue speed suit and an aero helmet.'},
 {id:'marcus',tier:'icon',tag:'BIG MOUNTAIN LEGEND',brand:'legend',name:'Big Mountain Marcus',style:'freeride',jacket:'#ffcf24',pants:'#1c1f22',accent:'#1c1f22',helmet:'#ffcf24',lens:'#ff7a1a',glove:'#1c1f22',price:2000,description:'Drops cliffs for breakfast. Hi-vis yellow so the helicopter can find him.'},
 {id:'luna',tier:'icon',tag:'SLOPESTYLE STAR',brand:'legend',name:'Luna Vega',style:'shell',jacket:'#8a4bd1',pants:'#2fd0c4',accent:'#ffe45c',helmet:'#2fd0c4',lens:'#ff6ad5',glove:'#ffe45c',price:2400,description:'Rail wizard and kicker queen. Purple shell, teal pants, zero fear.'},
 {id:'dutch',tier:'icon',tag:'OLD-SCHOOL PIONEER',brand:'legend',name:'Dutch Halvorsen',style:'freeride',jacket:'#ff4fa3',pants:'#2fd0e8',accent:'#fff04a',helmet:'#fff04a',lens:'#b66dff',glove:'#ff4fa3',price:2600,description:'Rode the first boards in the 80s. Neon everything, baggy everything.'},
 {id:'nova',tier:'icon',tag:'BIG-AIR PHENOM',brand:'legend',name:'Nova "Zero-G" Reyes',style:'race',jacket:'#101114',pants:'#101114',accent:'#e8b83a',helmet:'#e8b83a',lens:'#ffd36a',glove:'#e8b83a',price:3000,description:'Holds the record for the biggest jump ever landed. Black and gold, naturally.'},
];
export const ALL_KITS=[...KITS,...ICONS];
export const kitById=(id?:string)=>ALL_KITS.find(k=>k.id===id)||KITS[0];

// Original vector logos drawn to a canvas (used on chest patches and in the shop).
export function drawLogo(ctx:CanvasRenderingContext2D,brand:Brand,size:number,ink:string,bg?:string){
 const s=size/100;ctx.save();ctx.scale(s,s);
 if(bg){ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(2,2,96,96,18);ctx.fill();}
 ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineCap='round';ctx.lineJoin='round';
 if(brand==='arcwyrm'){ // a dragon's spine bent into an arch: vertebrae along an arc, skull at one end
  for(let i=0;i<8;i++){const a=Math.PI*(1.08-i*.12),x=50+Math.cos(a)*32,y=66-Math.sin(a)*38;ctx.save();ctx.translate(x,y);ctx.rotate(-a+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-7+i*.4);ctx.lineTo(5-i*.3,0);ctx.lineTo(0,7-i*.4);ctx.lineTo(-5+i*.3,0);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.beginPath();ctx.moveTo(82,62);ctx.lineTo(94,70);ctx.lineTo(80,74);ctx.closePath();ctx.fill();
 }else if(brand==='patagoat'){ // goat horns curling over a jagged skyline
  ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(12,80);ctx.lineTo(32,52);ctx.lineTo(44,64);ctx.lineTo(60,40);ctx.lineTo(74,58);ctx.lineTo(88,80);ctx.stroke();
  ctx.lineWidth=6;for(const d of [-1,1]){ctx.beginPath();ctx.arc(50+d*14,34,13,d<0?Math.PI*.1:Math.PI*.9,d<0?Math.PI*1.6:Math.PI*-.6,d>0);ctx.stroke();}
 }else if(brand==='fjellrune'){ // angular rune in a ring
  ctx.lineWidth=7;ctx.beginPath();ctx.arc(50,50,38,0,Math.PI*2);ctx.stroke();
  ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(50,22);ctx.lineTo(50,78);ctx.moveTo(50,30);ctx.lineTo(70,48);ctx.lineTo(50,64);ctx.moveTo(50,46);ctx.lineTo(32,62);ctx.stroke();
 }else if(brand==='frostbyte'){ // a six-armed ice crystal
  ctx.lineWidth=7;for(let i=0;i<3;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(50+Math.cos(a)*38,50+Math.sin(a)*38);ctx.lineTo(50-Math.cos(a)*38,50-Math.sin(a)*38);ctx.stroke();}
  ctx.lineWidth=5;for(let i=0;i<6;i++){const a=i*Math.PI/3,x=50+Math.cos(a)*24,y=50+Math.sin(a)*24;ctx.beginPath();ctx.moveTo(x+Math.cos(a+1.9)*10,y+Math.sin(a+1.9)*10);ctx.lineTo(x,y);ctx.lineTo(x+Math.cos(a-1.9)*10,y+Math.sin(a-1.9)*10);ctx.stroke();}
 }else if(brand==='legend'){ // a five-point star in a ring
  ctx.lineWidth=6;ctx.beginPath();ctx.arc(50,50,38,0,Math.PI*2);ctx.stroke();ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?14:30;ctx.lineTo(50+Math.cos(a)*rad,52+Math.sin(a)*rad);}ctx.closePath();ctx.fill();
 }else{ // obermann: an O with a mountain notch cut into its top
  ctx.lineWidth=13;ctx.beginPath();ctx.arc(50,54,30,Math.PI*1.68,Math.PI*1.32);ctx.stroke();
  ctx.beginPath();ctx.moveTo(34,30);ctx.lineTo(50,10);ctx.lineTo(66,30);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

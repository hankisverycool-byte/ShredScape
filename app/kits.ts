// Technical outerwear kits from fictional labels. Names and logos are original; the vibes are borrowed.
//  ARCWYRM   - minimalist alpine shells, spine-arc logo (Arc'teryx-inspired)
//  PATAGOAT  - bright, baggy freeride kit, goat-horn skyline badge (Patagonia-inspired)
//  FJELLRUNE - Nordic storm shells, angular rune mark (Norrøna-inspired)
//  OBERMANN  - race suits, notched-peak O (Obermeyer / race-label inspired)
export type Style='shell'|'freeride'|'race';
export type Kit={id:string;brand:Brand;name:string;style:Style;jacket:string;pants:string;accent:string;helmet:string;lens:string;glove:string;price:number;description:string};
export type Brand='arcwyrm'|'patagoat'|'fjellrune'|'obermann';
export const BRANDS:Record<Brand,{name:string;ink:string}>={
 arcwyrm:{name:'ARCWYRM',ink:'#e9ece6'},patagoat:{name:'PATAGOAT',ink:'#fff4dc'},fjellrune:{name:'FJELLRUNE',ink:'#f4efe4'},obermann:{name:'OBERMANN',ink:'#ffffff'},
};
export const STYLE_LABEL:Record<Style,string>={shell:'Fitted storm shell · slim pants · helmet',freeride:'Long shell · baggy pants · hood & beanie',race:'Race suit · colour-blocked · aero helmet'};
// ids keep the original catalog ids so owned items carry over.
export const KITS:Kit[]=[
 {id:'timber',brand:'fjellrune',name:'Lofoten Storm Shell',style:'shell',jacket:'#bb633e',pants:'#2c3438',accent:'#e8c383',helmet:'#2b3236',lens:'#f0a03c',glove:'#1d2226',price:0,description:'3-layer storm shell, taped seams, pit zips.'},
 {id:'glacier',brand:'arcwyrm',name:'Alpha Wyrmshell',style:'shell',jacket:'#7fb0c8',pants:'#1f272c',accent:'#d7f25a',helmet:'#e9eef0',lens:'#4fd0ff',glove:'#1f272c',price:200,description:'Trim alpine hardshell. Watertight zips, helmet hood.'},
 {id:'night',brand:'arcwyrm',name:'Sabre Stealth',style:'freeride',jacket:'#23292d',pants:'#171c20',accent:'#c6f04a',helmet:'#c6f04a',lens:'#b06cff',glove:'#c6f04a',price:350,description:'Blacked-out freeride shell, roomy cut, neon trims.'},
 {id:'alpine',brand:'obermann',name:'Kitz Downhill Suit',style:'race',jacket:'#f2ead8',pants:'#c8372d',accent:'#c8372d',helmet:'#c8372d',lens:'#ffd23c',glove:'#f2ead8',price:500,description:'Speed suit with red race panels. Tuck and go.'},
 {id:'signal',brand:'patagoat',name:'Powder Billy Anorak',style:'freeride',jacket:'#e07a35',pants:'#8b8455',accent:'#2f7f83',helmet:'#2f7f83',lens:'#ff5a8a',glove:'#2f7f83',price:750,description:'Baggy powder kit in blaze orange and olive.'},
 {id:'aurora',brand:'patagoat',name:'Untracked Shell',style:'shell',jacket:'#7a5c92',pants:'#2f4c53',accent:'#7fe0c4',helmet:'#2f4c53',lens:'#7fe0c4',glove:'#2f4c53',price:1200,description:'Recycled 3-layer shell, teal taped seams.'},
];
export const kitById=(id?:string)=>KITS.find(k=>k.id===id)||KITS[0];

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
 }else{ // obermann: an O with a mountain notch cut into its top
  ctx.lineWidth=13;ctx.beginPath();ctx.arc(50,54,30,Math.PI*1.68,Math.PI*1.32);ctx.stroke();
  ctx.beginPath();ctx.moveTo(34,30);ctx.lineTo(50,10);ctx.lineTo(66,30);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

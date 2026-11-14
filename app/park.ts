// Park features: snow kickers you ride up and jump off, and rails/boxes you lock onto and slide.
// Heights are in engine units above the terrain (same scale as x/y). Riders travel toward +y (downhill).
export type Spot={x:number;y:number;size:number;seed:number};

// Six kicker sizes. A kicker is a curved snow face rising to a lip at its downhill end. Bigger kickers are longer, wider,
// taller and have a steeper lip, so they send you higher at the same speed; `landing` is the clear run-out the park layout leaves after the lip.
export type KickerClass={name:string;run:number;half:number;height:number;landing:number;color:string};
export const KICKER_CLASSES:KickerClass[]=[
 {name:'MINI',run:36,half:20,height:8,landing:150,color:'#7cc97a'},
 {name:'SMALL',run:60,half:28,height:18,landing:260,color:'#5fb8d9'},
 {name:'MEDIUM',run:90,half:36,height:32,landing:420,color:'#e6c24a'},
 {name:'LARGE',run:140,half:48,height:58,landing:700,color:'#ee8b3a'},
 {name:'HUGE',run:210,half:64,height:100,landing:1100,color:'#d6453b'},
 {name:'GIGANTIC',run:320,half:90,height:180,landing:1700,color:'#8a4bd1'},
];
export const KICKER={lipAt:16,curve:1.6,maxLaunchSpeed:420};
export const kickerIndex=(f:Spot)=>Math.max(0,Math.min(KICKER_CLASSES.length-1,Math.round(f.size)));
export const kickerClass=(f:Spot)=>KICKER_CLASSES[kickerIndex(f)];
export function kickerShape(f:Spot){const c=kickerClass(f),lip=f.y+KICKER.lipAt;return{start:lip-c.run,lip,run:c.run,half:c.half,height:c.height};}
// Height of the kicker surface under (x,y); 0 when not on it.
export function kickerLift(f:Spot,x:number,y:number){const k=kickerShape(f);if(Math.abs(x-f.x)>k.half||y<k.start||y>k.lip)return 0;return k.height*Math.pow((y-k.start)/k.run,KICKER.curve);}
// How steeply the surface climbs at y (rise per unit travelled). The lip is the steepest point.
export function kickerSlope(f:Spot,y:number){const k=kickerShape(f),t=Math.max(.001,Math.min(1,(y-k.start)/k.run));return k.height*KICKER.curve*Math.pow(t,KICKER.curve-1)/k.run;}
// Rolling off the lip WITHOUT jumping: you only leave along the surface and sag off it, so you get a small hop (40% of what the lip slope would give).
// The air comes from jumping: see kickerJumpVz.
export const ROLL_OFF=.4;
export function kickerExitVz(f:Spot,vy:number){return ROLL_OFF*Math.max(0,Math.min(vy,KICKER.maxLaunchSpeed))*kickerSlope(f,kickerShape(f).lip);}
// Jumping off the face: you keep the surface's upward speed and add a pop. The pop is full strength at the lip and fades
// the earlier you jump (down to 35% a third of the way up the face), so timing the jump at the lip is what makes big air.
export function kickerPop(f:Spot,y:number){const k=kickerShape(f),q=1-.65*Math.max(0,Math.min(1,(k.lip-y)/(k.run*.35)));return (110+14*kickerIndex(f))*q;}
export function kickerJumpVz(f:Spot,y:number,vy:number){return Math.max(0,Math.min(vy,KICKER.maxLaunchSpeed))*kickerSlope(f,y)+kickerPop(f,y);}

// Rail (round bar) or box (wide, lower, easier). Runs along y, centred on the feature.
export function railShape(f:Spot){const box=f.seed%2===1,len=(box?140:170)*f.size;return{box,start:f.y-len/2,end:f.y+len/2,len,half:box?18:11,height:box?11:14};}
export function onRail(f:Spot,x:number,y:number,pad=0){const r=railShape(f);return Math.abs(x-f.x)<=r.half+pad&&y>=r.start-pad&&y<=r.end+pad;}
// Sliding sideways vs along the rail, named for the gear.
export function grindName(angle:number,board:boolean,fakie:boolean){return Math.abs(Math.sin(angle))>.6?(board?'Boardslide':'Railslide'):(fakie?'Switch 50–50':'50–50');}

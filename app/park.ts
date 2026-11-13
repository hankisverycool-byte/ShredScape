// Park features: snow kickers you ride up and launch from, and rails/boxes you lock onto and slide.
// Heights are in engine units above the terrain (same scale as x/y). Riders travel toward +y (downhill).
type Spot={x:number;y:number;size:number;seed:number};

// Kicker: a curved snow face rising to a lip at the downhill end.
export const KICKER={run:72,lipAt:16,half:34,height:25,curve:1.7};
export function kickerShape(f:Spot){const run=KICKER.run*f.size,lip=f.y+KICKER.lipAt;return{start:lip-run,lip,run,half:KICKER.half*f.size,height:KICKER.height*f.size};}
// Height of the kicker surface under (x,y); 0 when not on it.
export function kickerLift(f:Spot,x:number,y:number){const k=kickerShape(f);if(Math.abs(x-f.x)>k.half||y<k.start||y>k.lip)return 0;return k.height*Math.pow((y-k.start)/k.run,KICKER.curve);}
// Vertical launch speed off the lip: the face's exit slope turns forward speed into lift. Slow riders just roll off.
export function kickerLaunch(f:Spot,speed:number){if(speed<45)return 0;return Math.min(300,(60+speed*.62)*Math.sqrt(f.size));}

// Rail (round bar) or box (wide, lower, easier). Runs along y, centred on the feature.
export function railShape(f:Spot){const box=f.seed%2===1,len=(box?140:170)*f.size;return{box,start:f.y-len/2,end:f.y+len/2,len,half:box?18:11,height:box?11:14};}
export function onRail(f:Spot,x:number,y:number,pad=0){const r=railShape(f);return Math.abs(x-f.x)<=r.half+pad&&y>=r.start-pad&&y<=r.end+pad;}
// Sliding sideways vs along the rail, named for the gear.
export function grindName(angle:number,board:boolean,fakie:boolean){return Math.abs(Math.sin(angle))>.6?(board?'Boardslide':'Railslide'):(fakie?'Switch 50–50':'50–50');}

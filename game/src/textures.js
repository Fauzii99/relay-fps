import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
const cache=new Map();
function texture(key,size,paint) {
 if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 paint(canvas.getContext('2d'),size);
 const result=new CanvasTexture(canvas);
 result.colorSpace=SRGBColorSpace;result.wrapS=result.wrapT=RepeatWrapping;result.anisotropy=4;
 cache.set(key,result);return result;
}
function line(ctx,x,y,x2,y2) {ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function surface(kind) {
 return texture(kind,512,(ctx,size)=>{
  let seed=9173;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle=kind==='concrete'?'#a1a9b0':'#87939d';ctx.fillRect(0,0,size,size);
  for(let i=0;i<2400;i++) {
   const value=Math.floor(90+random()*90);
   ctx.fillStyle=`rgba(${value},${value+3},${value+5},0.16)`;
   ctx.fillRect(random()*size,random()*size,kind==='steel'?1:3,kind==='steel'?40:2);
  }
  ctx.strokeStyle='#4d5963';ctx.lineWidth=3;
  ctx.strokeRect(2,2,508,508);line(ctx,256,0,256,512);line(ctx,0,256,512,256);
  if(kind==='steel') {
   ctx.fillStyle='#c7d3da';
   for(let p=16;p<512;p+=48)for(const [x,y]of [[p,16],[p,496],[16,p],[496,p]]) {
    ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
   }
  } else {
   ctx.fillStyle='#687780';ctx.font='bold 64px monospace';ctx.fillText('R-9',320,370);
  }
 });
}
export function concreteTexture() {return surface('concrete');}
export function steelTexture() {return surface('steel');}
export function hazardTexture() {
 return texture('hazard',256,(ctx)=>{
  ctx.fillStyle='#22292f';ctx.fillRect(0,0,256,256);ctx.fillStyle='#efb53e';
  for(let x=-256;x<512;x+=64) {
   ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+32,0);ctx.lineTo(x+288,256);ctx.lineTo(x+256,256);ctx.closePath();ctx.fill();
  }
 });
}
export function deckTexture() {
 return texture('deck',256,(ctx)=>{
  ctx.fillStyle='#89949f';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#c8d1d8';ctx.lineWidth=3;
  for(let y=16;y<256;y+=32)for(let x=16;x<256;x+=32) {
   line(ctx,x-8,y,x,y-8);line(ctx,x,y+8,x+8,y);
  }
 });
}
export function stencilTexture(label='R-9',tint='#cfd8de') {
 return texture(`stencil:${label}:${tint}`,256,(ctx)=>{
  ctx.fillStyle=tint;ctx.textAlign='center';ctx.font='bold 74px sans-serif';ctx.fillText(label,128,132);
  ctx.font='bold 18px monospace';ctx.fillText('CLASS 4 — SEALED',128,176);
  ctx.strokeStyle=tint;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(128,196);ctx.lineTo(112,224);ctx.lineTo(144,224);ctx.closePath();ctx.stroke();
 });
}
export function emitterTexture(hex='#46d9c2') {
 return texture(`emitter:${hex}`,512,(ctx)=>{
  ctx.fillStyle='#08181e';ctx.fillRect(0,0,512,512);ctx.strokeStyle=hex;ctx.lineWidth=3;
  for(let radius=76;radius<250;radius+=42) {ctx.beginPath();ctx.arc(256,256,radius,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=0.35;line(ctx,24,256,488,256);line(ctx,256,24,256,488);ctx.globalAlpha=1;
  ctx.fillStyle=hex;ctx.textAlign='center';ctx.font='bold 38px monospace';ctx.fillText('RESONANCE',256,268);
  ctx.font='20px monospace';ctx.fillText('COUPLING PAD',256,300);
 });
}
export function panelGlowTexture() {
 return texture('glow',128,(ctx)=>{
  ctx.fillStyle='#1b616a';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#59bcbf';
  for(let y=8;y<128;y+=9)line(ctx,6,y,122,y);
 });
}
export function disposeTextures() {for(const tex of cache.values())tex.dispose();cache.clear();}

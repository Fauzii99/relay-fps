// Procedural sound: shared seeded noise, spatial attenuation and disposable voice nodes.
export class AudioEngine {
 constructor() { this.ctx=null; this.master=null; this.muted=false; this.ready=false; this.volume=0.62; }
 unlock() {
  if (!navigator.userActivation?.hasBeenActive) return;
  if(this.ctx) { this.ctx.resume().catch(()=>{}); return; }
  const Audio=window.AudioContext ?? window.webkitAudioContext;
  if(!Audio)return;
  this.ctx=new Audio(); this.master=this.ctx.createGain();
  this.master.gain.value=this.muted?0:this.volume;
  this.master.connect(this.ctx.destination);
  this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);
  const data=this.noise.getChannelData(0); let seed=1234567;
  for(let i=0;i<data.length;i++) { seed=(seed*1664525+1013904223)>>>0; data[i]=seed/2147483648-1; }
  this.ready=true;}
 setMuted(value) { this.muted=value; if(this.master)this.master.gain.setTargetAtTime(value?0:this.volume,this.ctx.currentTime,0.02); }
 spatial(pos,listener) {
  if(!pos||!listener)return {gain:1,pan:0};
  const dx=pos.x-listener.x,dz=pos.z-listener.z,d=Math.hypot(dx,dz);
  return {gain:1/(1+d*0.06+d*d*0.0016),pan:Math.max(-0.85,Math.min(0.85,(dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw))/Math.max(4,d)))};}
 voice(noise,{freq=440,dur=0.1,gain=0.15,pan=0,type='sine',slideTo,delay=0}) {
  if(!this.ready||this.muted)return;
  const ctx=this.ctx,t=ctx.currentTime+delay,source=noise?ctx.createBufferSource():ctx.createOscillator();
  const envelope=ctx.createGain(),panner=ctx.createStereoPanner();
  let filter;
  if(noise) { source.buffer=this.noise; filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=freq; source.connect(filter); filter.connect(envelope); }
  else { source.type=type; source.frequency.setValueAtTime(freq,t); if(slideTo)source.frequency.exponentialRampToValueAtTime(slideTo,t+dur); source.connect(envelope); }
  envelope.gain.setValueAtTime(0.0001,t);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain),t+0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  panner.pan.value=pan; envelope.connect(panner); panner.connect(this.master);
  source.onended=()=>{source.disconnect();filter?.disconnect();envelope.disconnect();panner.disconnect();};
  source.start(t);source.stop(t+dur+0.02);}
 tone(options) { this.voice(false,options); }
 burst(options) { this.voice(true,options); }
 gunshot(kind,pos,listener) {
  const spatial=this.spatial(pos,listener);
  const settings={rifle:[1750,148,0.19,0.5],smg:[2400,196,0.11,0.36],marksman:[1450,96,0.3,0.6],sidearm:[2100,210,0.13,0.34],knife:[900,260,0.08,0.22]};
  const [freq,bass,dur,volume]=settings[kind]??settings.sidearm;
  this.burst({freq,dur,gain:spatial.gain*volume,pan:spatial.pan});
  this.tone({freq:bass,slideTo:bass*0.45,dur,type:'triangle',gain:spatial.gain*0.18,pan:spatial.pan});}
 reload(step,pos,listener) { this.burst({freq:step==='out'?620:step==='in'?400:1500,dur:0.07,...this.spatial(pos,listener),gain:0.18}); }
 footstep(pos,listener,running) { const s=this.spatial(pos,listener);this.burst({freq:running?320:240,dur:0.065,pan:s.pan,gain:s.gain*0.15}); }
 hitmarker(head) { this.tone({freq:head?1900:1300,dur:0.045,gain:0.075}); }
 damageTaken() { this.tone({freq:320,slideTo:120,dur:0.18,gain:0.12}); }
 death() { this.tone({freq:180,slideTo:56,dur:0.6,gain:0.16}); }
 countdown(urgent) { this.tone({freq:urgent?1180:880,dur:0.075,gain:0.08}); }
 planted() { this.tone({freq:300,slideTo:900,dur:0.28}); }
 defused() { this.tone({freq:600,slideTo:1200,dur:0.4}); }
 explosion(pos,listener) { const s=this.spatial(pos,listener);this.burst({freq:130,dur:0.9,pan:s.pan,gain:s.gain*0.6}); }
 roundEnd(won) { this.tone({freq:won?440:220,slideTo:won?880:110,dur:0.7}); }
 uiClick() { this.tone({freq:1000,dur:0.025,gain:0.05}); }
 buy() { this.uiClick(); }
 deny() { this.tone({freq:140,dur:0.12}); }
 radioChirp() { this.tone({freq:1400,dur:0.04,gain:0.04}); }
 detonation() { this.explosion(null,null); }
 smokePop(pos,listener) { this.burst({freq:600,dur:0.4,gain:0.15,...this.spatial(pos,listener)}); }
 roundWin() { this.roundEnd(true); }
 roundLoss() { this.roundEnd(false); }}

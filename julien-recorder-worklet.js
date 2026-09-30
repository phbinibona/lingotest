class JulienRecorder extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(4096);this.used=0;this.stopped=false;this.port.onmessage=e=>{if(e.data?.type==='stop'){this.flush();this.stopped=true;this.port.postMessage({type:'stopped'})}}}
 flush(){if(!this.used)return;const samples=this.buffer.slice(0,this.used);this.port.postMessage({type:'samples',samples},[samples.buffer]);this.used=0}
 process(inputs){if(this.stopped)return false;const channels=inputs[0];if(!channels?.length)return true;const count=channels[0].length;for(let i=0;i<count;i++){let mono=0;for(const channel of channels)mono+=(channel[i]||0)/channels.length;this.buffer[this.used++]=mono;if(this.used===this.buffer.length)this.flush()}return true}
}
registerProcessor('julien-recorder',JulienRecorder);

import {FilesetResolver,PoseLandmarker} from './vendor/vision_bundle.mjs';
import {Input,BlobSource,ALL_FORMATS,VideoSampleSink} from './vendor/mediabunny.mjs';

export async function engine(){
  const files=await FilesetResolver.forVisionTasks(new URL('./vendor/',import.meta.url).href);
  return PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_full.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,outputSegmentationMasks:false});
}
export async function openVideo(file){
  if(typeof VideoDecoder==='undefined')throw new Error('This browser cannot decode individual video frames. Open the app in current Safari or Chrome.');
  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  try{const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw new Error('This video format is not supported here. Try an original H.264 MOV or MP4.');
    const start=await track.getFirstTimestamp();return {input,start,sink:new VideoSampleSink(track)};
  }catch(e){input.dispose();throw e;}
}
export function drawFrame(canvas,sample,turn=0,maxEdge=1600){
  const scale=Math.min(1,maxEdge/Math.max(sample.displayWidth,sample.displayHeight));
  const w=Math.round(sample.displayWidth*scale),h=Math.round(sample.displayHeight*scale),sideways=turn%180!==0;
  canvas.width=sideways?h:w;canvas.height=sideways?w:h;
  const ctx=canvas.getContext('2d');ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/180);sample.draw(ctx,-w/2,-h/2,w,h);ctx.restore();
}
export async function scan(file,turn,signal,onProgress){
  const source=await openVideo(file),frames=[],canvas=document.createElement('canvas');let model,lastTime=-Infinity,lastMs=-1;
  const cancel=()=>source.input.dispose();signal.addEventListener('abort',cancel,{once:true});
  try{model=await engine();signal.throwIfAborted();
    for await(const sample of source.sink.samples()){
      try{signal.throwIfAborted();const time=sample.timestamp-source.start;if(!Number.isFinite(time)||time<=lastTime)throw new Error('Video timestamps are missing or out of order. Please use a camera-original clip.');lastTime=time;
        drawFrame(canvas,sample,turn,1280);const ms=Math.max(lastMs+1,Math.round(time*1000));lastMs=ms;
        const result=model.detectForVideo(canvas,ms).landmarks?.[0];
        frames.push({time,points:result?result.map(p=>({x:p.x,y:p.y,score:Math.min(p.visibility??1,p.presence??1)})):null});
      }finally{sample.close();}
      if(frames.length%6===0){onProgress(frames.length,frames.at(-1).time);await new Promise(r=>setTimeout(r,0));}
      if(frames.length>=12000)throw new Error('This clip exceeds 12,000 decoded frames. Trim a copy to the sprint capture zone while retaining all source frames.');
    }
    if(!frames.length)throw new Error('No video frames could be decoded.');
    const steps=frames.slice(1).map((f,i)=>f.time-frames[i].time).sort((a,b)=>a-b);
    return {frames,aspect:canvas.width/canvas.height,decodedFps:steps.length?1/steps[Math.floor(steps.length/2)]:null};
  }finally{signal.removeEventListener('abort',cancel);source.input.dispose();model?.close();}
}

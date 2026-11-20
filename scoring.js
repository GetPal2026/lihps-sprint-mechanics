export const SIDES=['left','right'];
export const PHASES=[
  {id:'toeoff',label:'Contralateral toe-off',help:'Immediately before the opposite foot leaves the ground.'},
  {id:'mvp',label:'Maximal vertical projection',help:'The pelvis is highest during the flight phase.'},
  {id:'late',label:'Late swing',help:'Maximum extension of the assessed knee during swing, before contact.'},
  {id:'touchdown',label:'Touchdown',help:'First visible ground contact of the assessed foot.'},
  {id:'midstance',label:'Midstance',help:'The pelvis is directly above the assessed ankle.'}
];
export const ITEMS=[
  {id:'trailing',phase:'toeoff',name:'Trailing-limb extension',help:'Look for excessive extension of the opposite trailing limb: the thigh at least 45° behind vertical together with a fully extended knee.'},
  {id:'backkick',phase:'mvp',name:'Back kick',help:'Look at the opposite trailing limb: heel above the calf, with the shin higher than horizontal.'},
  {id:'rotation',phase:'mvp',name:'Trunk and pelvic rotation',help:'Judge excessive trunk twisting or arm movement, including visibility of the far shoulder and upper arm. The overlay cannot measure axial rotation.'},
  {id:'separationLate',phase:'late',name:'Thigh separation in late swing',help:'Is the opposite trailing knee behind the gluteal outline?'},
  {id:'pelvisSwing',phase:'interval',name:'Pelvic/lumbar posture during swing',help:'Review the whole interval from maximal vertical projection to late swing for anterior pelvic tilt or lumbar extension: back arching, raised chest or pelvis appearing behind the body.'},
  {id:'lean',phase:'touchdown',name:'Forward trunk lean',help:'Judge increased forward lean; the published reference is more than 15° from vertical using greater trochanter to C7. The shoulder–hip overlay is only a proxy.'},
  {id:'pelvisContact',phase:'touchdown',name:'Pelvic/lumbar posture at contact',help:'Judge increased anterior pelvic tilt or lumbar extension at touchdown, using the trunk and pelvic outline.'},
  {id:'separationContact',phase:'touchdown',name:'Thigh separation at contact',help:'Look for an inter-thigh angle greater than 20°, or the opposite trailing knee behind the back.'},
  {id:'overstride',phase:'touchdown',name:'Foot contact relative to centre of mass',help:'Judge whether the horizontal space from foot contact to centre of mass could accommodate another foot. The hip point is not a measured centre of mass.'},
  {id:'shin',phase:'touchdown',name:'Shin orientation',help:'Look for the assessed ankle joint centre ahead of the assessed knee at first contact.'},
  {id:'foot',phase:'touchdown',name:'Foot inclination',help:'Inspect an excessive heel or forefoot contact pattern using the visible gap between shoe and ground. Examiner judgment is required; the foot overlay does not trace the shoe sole.'},
  {id:'collapse',phase:'midstance',name:'Midstance collapse',help:'Judge excessive knee flexion or ankle dorsiflexion: sinking into the stride, a sitting posture, or knee moving over the toes with a flat foot.'}
];
export const JOINTS={left:{shoulder:11,hip:23,knee:25,ankle:27,heel:29,toe:31},right:{shoulder:12,hip:24,knee:26,ankle:28,heel:30,toe:32}};
export const other=side=>side==='left'?'right':'left';
export const median=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?(b[(b.length-1)>>1]+b[b.length>>1])/2:NaN;};
export const quantile=(a,q)=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b[Math.round((b.length-1)*q)]:NaN;};
export const usable=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.score??0)>=.5;
export function point(frame,side,joint,aspect=1){const p=frame?.points?.[JOINTS[side][joint]];return usable(p)?{x:p.x*aspect,y:p.y}:null;}
export function angle(a,b,c){if(!a||!b||!c)return null;const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],n=Math.hypot(...u)*Math.hypot(...v);return n>1e-10?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/n)))*180/Math.PI:null;}
export function measures(frame,side,aspect=1,direction=1){
  const hip=point(frame,side,'hip',aspect),knee=point(frame,side,'knee',aspect),ankle=point(frame,side,'ankle',aspect),shoulder=point(frame,side,'shoulder',aspect),farKnee=point(frame,other(side),'knee',aspect),farHip=point(frame,other(side),'hip',aspect);
  const kneeIncluded=angle(hip,knee,ankle);
  return {kneeFlexion:kneeIncluded===null?null:180-kneeIncluded,
    thighSeparation:hip&&knee&&farHip&&farKnee?angle(knee,hip,{x:hip.x+farKnee.x-farHip.x,y:hip.y+farKnee.y-farHip.y}):null,
    shoulderHipLean:hip&&shoulder&&Math.hypot(shoulder.x-hip.x,shoulder.y-hip.y)>1e-5?Math.atan2(direction*(shoulder.x-hip.x),hip.y-shoulder.y)*180/Math.PI:null,
    shinForward:ankle&&knee&&Math.hypot(ankle.x-knee.x,ankle.y-knee.y)>1e-5?Math.atan2(direction*(ankle.x-knee.x),ankle.y-knee.y)*180/Math.PI:null};
}
export function phaseProblems(events,count){
  const v=PHASES.map(p=>events?.[p.id]?.index);
  if(v.some(i=>!Number.isInteger(i)||i<0||i>=count))return ['Set all five event frames within this clip.'];
  return v.some((i,k)=>k&&i<=v[k-1])?['Events must follow toe-off, projection, late swing, touchdown, then midstance.']:[];
}
export function summary(clip){
  const values=ITEMS.map(item=>clip?.scores?.[item.id]);
  const answered=values.filter(v=>v===0||v===1).length;
  const unassessable=values.filter(v=>v==='na').length;
  const phaseIssues=phaseProblems(clip?.events,clip?.frames?.length??clip?.frameCount??0);
  const phasesConfirmed=PHASES.every(p=>clip?.events?.[p.id]?.confirmed);
  const intervalConfirmed=!!clip?.intervalConfirmed;
  const analysisReady=!clip||!('markersReviewed' in clip)||(clip.markersReviewed&&!!clip.analysis);
  const total=answered===12&&phasesConfirmed&&intervalConfirmed&&analysisReady&&!phaseIssues.length?values.reduce((a,b)=>a+b,0):null;
  return {answered,unassessable,total,phasesConfirmed,intervalConfirmed,phaseIssues,positive:values.filter(v=>v===1).length};
}
function rangeBest(start,end,score,largest=false){let best=null,value=largest?-Infinity:Infinity;for(let i=Math.max(0,start);i<=end;i++){const v=score(i);if(Number.isFinite(v)&&(largest?v>value:v<value)){value=v;best=i;}}return best;}
// Engineering suggestions only. Every event must be confirmed from the actual video.
export function suggestSequences(frames,side,aspect=1){
  if(frames.length<12)return {direction:1,sequences:[],reason:'Too few frames for phase suggestions. Set the events manually.'};
  const hips=frames.map(f=>point(f,side,'hip',aspect));
  const dx=hips.slice(1).map((p,i)=>p&&hips[i]?p.x-hips[i].x:NaN);
  const drift=median(dx),direction=Number.isFinite(drift)&&drift<0?-1:1;
  const height=median(frames.map(f=>{const h=point(f,side,'hip',aspect),a=point(f,side,'ankle',aspect);return h&&a?Math.hypot(h.x-a.x,h.y-a.y):NaN;}));
  if(!(height>0)||!Number.isFinite(drift)||Math.abs(drift)<height*.0005)return {direction,sequences:[],reason:'Body travel is unclear. Select a sequence and set its events manually.'};
  const feet=frames.map(f=>{const pts=['ankle','heel','toe'].map(j=>point(f,side,j,aspect)).filter(Boolean);return pts.length?Math.max(...pts.map(p=>p.y)):NaN;});
  const ground=quantile(feet,.90),tol=height*.07;
  const contact=frames.map((f,i)=>{const a=point(f,side,'ankle',aspect),b=point(frames[Math.max(0,i-2)],side,'ankle',aspect),c=point(frames[Math.min(frames.length-1,i+2)],side,'ankle',aspect);return a&&b&&c&&Number.isFinite(feet[i])&&ground-feet[i]<tol&&Math.abs((c.x-b.x)/4)<Math.abs(drift)*.8;});
  const hits=[];
  for(let i=3;i<frames.length-3;i++)if(contact[i]&&contact[i+1]&&contact[i+2]&&!contact[i-1])hits.push(i);
  const sequences=[];
  for(const td of hits){
    let stanceEnd=td+2;while(stanceEnd<frames.length-1&&contact[stanceEnd])stanceEnd++;
    const prior=hits.filter(h=>h<td).at(-1)??0;
    const window=Math.min(td-prior,Math.max(12,Math.round(height/(Math.abs(drift)||.001)*1.15)));
    const begin=Math.max(prior,td-window);
    const mvp=rangeBest(begin,td-3,i=>hips[i]?.y);
    if(mvp===null||mvp<begin+2||mvp>=td-2)continue;
    const toeoff=rangeBest(begin,mvp-1,i=>{const a=point(frames[i],other(side),'ankle',aspect),h=hips[i];return a&&h?a.y-h.y:NaN;},true);
    const late=rangeBest(mvp+1,td-1,i=>measures(frames[i],side,aspect,direction).kneeFlexion);
    const mid=rangeBest(td+1,Math.min(frames.length-1,Math.max(td+2,stanceEnd)),i=>{const h=hips[i],a=point(frames[i],side,'ankle',aspect);return h&&a?Math.abs(h.x-a.x):NaN;});
    const events=Object.fromEntries(Object.entries({toeoff,mvp,late,touchdown:td,midstance:mid}).map(([k,index])=>[k,{index,confirmed:false,origin:'suggested'}]));
    if(!phaseProblems(events,frames.length).length)sequences.push({events});
  }
  return {direction,sequences,reason:sequences.length?'Phase suggestions need examiner confirmation.':'No complete sequence was confidently suggested. Set all five event frames manually.'};
}
export function qualityFlags(frames,side,aspect=1){
  const names=['shoulder','hip','knee','ankle','heel','toe'];
  const segments=[['hip','knee'],['knee','ankle']];
  const lengths=segments.map(([a,b])=>frames.map(f=>{const p=point(f,side,a,aspect),q=point(f,side,b,aspect);return p&&q?Math.hypot(p.x-q.x,p.y-q.y):NaN;}));
  const refs=lengths.map(v=>{const m=median(v),mad=median(v.map(x=>Math.abs(x-m)));return {m,limit:Math.max(m*.20,4*1.4826*mad)};});
  const steps=frames.slice(1).map((f,i)=>f.time-frames[i].time),dt=median(steps);
  return frames.map((f,i)=>{const flags=[];const missing=names.filter(j=>!point(f,side,j,aspect));if(missing.length)flags.push('Uncertain '+missing.join(', '));
    lengths.forEach((v,k)=>{if(Number.isFinite(v[i])&&Math.abs(v[i]-refs[k].m)>refs[k].limit)flags.push(k?'Shank projection changes':'Thigh projection changes');});
    if(i&&(!Number.isFinite(steps[i-1])||steps[i-1]<=0||steps[i-1]>dt*2.5))flags.push('Frame timing gap');
    return flags;});
}
export function flagGroups(flags){const out=[];for(let i=0;i<flags.length;i++){if(!flags[i].length)continue;let end=i;while(end+1<flags.length&&flags[end+1].length)end++;out.push({start:i,end,reasons:[...new Set(flags.slice(i,end+1).flat())]});i=end;}return out;}
export function invalidate(clip){for(const p of PHASES)if(clip.events?.[p.id])clip.events[p.id].confirmed=false;clip.intervalConfirmed=false;clip.scores={};clip.scoreReview={};clip.analysis=null;clip.markersReviewed=false;}
export function csvRows(session){const rows=[['assessment_id','athlete_id','date','assessor','side','clip_name','capture_fps_stated','decoded_fps','running_direction','speed_m_s','setting','surface','footwear','previous_hsi','protocol_notes','side_notes','item','phase','score','phase_frame','phase_pts_s','phase_confirmed','interval_reviewed','complete_total','app_version','suggested_score','suggestion_kind','suggestion_evidence','analysis_generated_at','review_decision','markers_reviewed','straight_knee_tolerance_deg']];
  for(const side of SIDES){const c=session.clips[side];if(!c)continue;const s=summary(c);for(const item of ITEMS){const event=c.events[item.phase==='interval'?'mvp':item.phase];rows.push([session.id,session.athlete,session.date,session.assessor,side,c.fileName,c.captureFps,c.decodedFps,c.direction===-1?'leftward':'rightward',session.speed,session.setting,session.surface,session.footwear,session.history,session.notes,c.notes,item.name,item.phase,c.scores[item.id]??'',event?.index==null?'':event.index+1,c.frames?.[event?.index]?.time??c.eventTimes?.[item.phase==='interval'?'mvp':item.phase]??'',!!event?.confirmed,!!c.intervalConfirmed,s.total??'',session.version]);}}
  let row=1;for(const side of SIDES){const c=session.clips[side];if(!c)continue;for(const item of ITEMS){const p=c.analysis?.suggestions?.[item.id];rows[row++].push(p?.value??'',p?.kind??'',p?.evidence??'',c.analysis?.generatedAt??'',c.scoreReview?.[item.id]?.decision??'',c.markersReviewed??'',c.analysis?.straightKneeTolerance??'');}}
  return rows;}
export function toCsv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}

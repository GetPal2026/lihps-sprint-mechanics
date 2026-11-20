import {SIDES,PHASES,ITEMS,JOINTS,other,usable,measures,summary,phaseProblems,suggestSequences,qualityFlags,flagGroups,invalidate,csvRows,toCsv} from './scoring.js?v=020';
import {openVideo,drawFrame,scan} from './media.js';
import {saveSession,listSessions,deleteSession} from './storage.js';
import {analysisRequirements,analyseConfirmedFrames,clearAnalysis} from './analysis.js?v=020';

const $=id=>document.getElementById(id),title=s=>s[0].toUpperCase()+s.slice(1),VERSION='0.2.0';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const fresh=()=>({id:crypto.randomUUID(),version:VERSION,date:today(),athlete:'',assessor:'',speed:'',setting:'Outdoor overground',surface:'',footwear:'',history:'unknown',notes:'',clips:{}});
const freshClip=file=>({file,fileName:file.name,fileSize:file.size,turn:0,index:0,frames:null,frameCount:0,events:{},scores:{},scoreReview:{},analysis:null,markersReviewed:false,straightKneeTolerance:10,notes:'',captureFps:'',direction:1,flags:[],reviewed:[],snapshots:{},intervalConfirmed:false});
let session=fresh(),selected='left',active=null,dirty=false,playing=null,previewSource=null,previewFile=null,previewTurn=null,previewSerial=0,previewQueue=Promise.resolve(),saved=[],saving=false;
const canvas=$('preview');
const current=()=>session.clips[selected];
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,handler,cls='secondary'){const b=el('button',text,cls);b.addEventListener('click',handler);return b;}
function report(text,error=false){$('status').textContent=text;$('status').classList.toggle('warning',error);}
function markDirty(){dirty=true;$('save-status').textContent='Unsaved changes';}
function stop(){clearInterval(playing);playing=null;$('play').textContent='Play slowly';}
function closePreview(){previewSerial++;previewSource?.input.dispose();previewSource=null;previewFile=null;}
function fieldsToState(){for(const key of ['athlete','date','assessor','speed','setting','surface','footwear','history','notes'])session[key]=$(key).value;}
function stateToFields(){for(const key of ['athlete','date','assessor','speed','setting','surface','footwear','history','notes'])$(key).value=session[key]??'';}
for(const key of ['athlete','date','assessor','speed','setting','surface','footwear','history','notes'])$(key).addEventListener('input',()=>{fieldsToState();markDirty();});

const links=[['shoulder','hip'],['hip','knee'],['knee','ankle'],['ankle','heel'],['heel','toe'],['toe','ankle']];
function overlay(target,frame,side){
  if(!$('overlay').checked||!frame?.points)return;const ctx=target.getContext('2d');ctx.lineWidth=Math.max(2,target.width/350);
  for(const s of [other(side),side]){ctx.strokeStyle=s===side?'#19c0ed':'#ffb36b';ctx.fillStyle=s===side?'#fff':'#ffb36b';
    const coord=j=>{const p=frame.points[JOINTS[s][j]];return usable(p)?[p.x*target.width,p.y*target.height]:null;};
    for(const [a,b]of links){const p=coord(a),q=coord(b);if(!p||!q)continue;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    for(const j of ['shoulder','hip','knee','ankle','heel','toe']){const p=coord(j);if(!p)continue;ctx.beginPath();ctx.arc(...p,Math.max(3,target.width/210),0,Math.PI*2);ctx.fill();ctx.stroke();}
  }
  ctx.fillStyle='#d275f3';ctx.strokeStyle='#d275f3';ctx.font=`bold ${Math.max(12,target.width/65)}px sans-serif`;
  for(const [key,p]of Object.entries(frame.references??{})){if(!usable(p))continue;const x=p.x*target.width,y=p.y*target.height;ctx.beginPath();ctx.arc(x,y,Math.max(5,target.width/160),0,Math.PI*2);ctx.stroke();ctx.fillText({c7:'C7',trochanter:'GT',back:'Back',com:'CoM'}[key]??key,x+8,y-8);}
}
async function framePreview(){
  const c=current(),serial=++previewSerial,side=selected,index=c?.index??0;
  $('viewer-message').hidden=true;canvas.hidden=false;
  if(!c){canvas.hidden=true;return;}
  if(!c.file){canvas.hidden=true;const snap=Object.entries(c.events).find(([,e])=>e.index===index)?.[0];const source=c.snapshots?.[snap];
    if(source){const img=new Image();img.onload=()=>{if(serial!==previewSerial)return;canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);canvas.hidden=false;};img.src=source;}
    $('viewer-message').textContent='Saved assessment. Reattach the matching original video to resume frame review.';$('viewer-message').hidden=false;return;}
  previewQueue=previewQueue.catch(()=>{}).then(async()=>{
    if(serial!==previewSerial)return;
    try{if(previewFile!==c.file||previewTurn!==c.turn){previewSource?.input.dispose();previewSource=null;previewFile=c.file;previewTurn=c.turn;previewSource=await openVideo(c.file);}
      const time=c.frames?.[index]?.time??0,sample=await previewSource.sink.getSample(previewSource.start+time);
      if(!sample)throw new Error('This video frame is unavailable.');
      try{if(serial!==previewSerial)return;drawFrame(canvas,sample,c.turn);overlay(canvas,c.frames?.[index],side);}finally{sample.close();}
    }catch(e){if(serial===previewSerial){canvas.hidden=true;$('viewer-message').textContent=e.message;$('viewer-message').hidden=false;}}
  });await previewQueue;
}
function renderMeasures(){const c=current(),root=$('measurements');root.replaceChildren();if(!c?.frames)return;
  const m=measures(c.frames[c.index],selected,c.aspect,c.direction);
  for(const [label,key]of [['Knee flexion','kneeFlexion'],['Inter-thigh angle','thighSeparation'],['Shoulder–hip lean · proxy','shoulderHipLean'],['Shin ahead of vertical','shinForward']]){root.append(el('dt',label),el('dd',m[key]===null?'Unable to estimate':`${m[key].toFixed(1)}°`));}
}
function renderFrameControls(){const c=current(),count=c?.frames?.length??0;
  $('scrub').max=Math.max(0,count-1);$('scrub').value=c?.index??0;$('scrub').disabled=!count||!c?.file||!!active;
  $('frame-number').textContent=count?`Frame ${(c.index??0)+1} of ${count}`:'Preview';
  $('frame-time').textContent=count?`${c.frames[c.index].time.toFixed(3)} s · file timing`:'';
  $('previous').disabled=!count||!c?.file||c.index===0||!!active;$('next').disabled=!count||!c?.file||c.index===count-1||!!active;$('play').disabled=!count||!c?.file||!!active;
  const pending=flagGroups(c?.flags??[]).filter(g=>!c.reviewed?.includes(`${g.start}:${g.end}`));
  const group=flagGroups(c?.flags??[]).find(g=>g.start<=c?.index&&g.end>=c?.index);
  $('next-flag').disabled=!pending.length||!c?.file||!!active;$('ack-flag').disabled=!group||!c?.file||!!active;
  $('flag-message').textContent=group?`${pending.length} unreviewed stretches. Here: ${group.reasons.join(' · ')}. A review acknowledgement does not change the landmarks or score.`:`${pending.length} unreviewed tracking stretches. Flags are screening heuristics.`;
  const frame=c?.frames?.[c.index];$('reset-frame').disabled=!frame||!('originalPoints' in frame||'originalReferences' in frame)||!!active||!c?.file;
  for(const row of $('phases').children)row.classList.toggle('current',Number(row.dataset.index)===c?.index);
  renderMeasures();
}
function seek(index){stop();seekDuringPlay(index);}
function seekDuringPlay(index){const c=current();if(!c?.frames)return;c.index=Math.max(0,Math.min(c.frames.length-1,index));renderFrameControls();void framePreview();}
function renderPhases(){
  const c=current(),root=$('phases');root.replaceChildren();if(!c)return;
  const problems=phaseProblems(c.events,c.frames?.length??0),confirmed=PHASES.filter(p=>c.events[p.id]?.confirmed).length;
  $('phase-progress').textContent=`${confirmed} of 5`;
  for(const p of PHASES){const e=c.events[p.id],row=el('div',undefined,'phase-row');row.dataset.index=e?.index??-1;
    const heading=el('div',undefined,'phase-heading');heading.append(el('strong',p.label),el('span',e?.index==null?'Not set':`Frame ${e.index+1}${e.confirmed?' · confirmed':' · suggested'}`,e?.confirmed?'confirmed':'small'));
    const actions=el('div',undefined,'phase-actions');
    const go=button('View',()=>{seek(e.index);$('viewer').scrollIntoView({block:'center',behavior:'smooth'});},'quiet');go.disabled=e?.index==null||!!active;
    const set=button('Set current frame',()=>{stop();if(!c.frames)return;c.events[p.id]={index:c.index,confirmed:true,origin:'manual'};clearAnalysis(c);c.intervalConfirmed=false;c.snapshots={};markDirty();render();report('Event updated. Review the interval and landmarks, then analyse the confirmed frames.');},'quiet');set.disabled=!c.frames||!c.file||!!active;
    const confirm=button(e?.confirmed?'Confirmed':'Confirm frame',()=>{c.events[p.id].confirmed=true;markDirty();render();},'secondary');confirm.disabled=e?.index==null||!!e?.confirmed||!c.file||!!active;
    actions.append(go,set,confirm);row.append(heading,el('p',p.help,'small'),actions);root.append(row);
  }
  $('phase-error').hidden=!problems.length;$('phase-error').textContent=problems.join(' ');
  $('interval-reviewed').checked=c.intervalConfirmed;$('interval-reviewed').disabled=!c.file||!c.events.mvp?.confirmed||!c.events.late?.confirmed||!!problems.length||!!active;
  $('play-interval').disabled=!c.file||c.events.mvp?.index==null||c.events.late?.index==null||c.events.mvp.index>=c.events.late.index||!!active;
}
function renderAnalysis(){const c=current(),issues=analysisRequirements(c);$('markers-reviewed').checked=!!c?.markersReviewed;$('markers-reviewed').disabled=!c?.frames||!!active;
  $('knee-tolerance').value=c?.straightKneeTolerance??10;$('knee-tolerance').disabled=!c?.frames||!!active;
  $('analyse').disabled=!!active||!!issues.length;
  const proposals=Object.values(c?.analysis?.suggestions??{}),count=proposals.filter(p=>p.value===0||p.value===1).length;
  $('analysis-note').textContent=issues.length?issues.join(' '):c.analysis?`${count} score proposals; ${12-count} items need a visual decision. Proposals are separate from your confirmed scores. You can run this again without processing the video.`:'Ready. Analyse these confirmed frames and reviewed landmarks to generate score proposals.';
}
function renderItems(){const c=current(),root=$('score-items');root.replaceChildren();if(!c)return;
  const s=summary(c);$('score-progress').textContent=`${s.answered} of 12`;
  ITEMS.forEach((item,i)=>{const phase=item.phase==='interval'?'mvp':item.phase,e=c.events[phase],box=el('article',undefined,'score-item');
    const heading=el('div',undefined,'item-heading');heading.append(el('span',String(i+1).padStart(2,'0'),'item-number'),el('h3',item.name));
    const view=button(item.phase==='interval'?'View interval':PHASES.find(p=>p.id===phase).label,()=>{if(e?.index!=null)seek(e.index);$('viewer').scrollIntoView({block:'center',behavior:'smooth'});},'phase-link');view.disabled=e?.index==null;
    const allowed=c.file&&!active&&!analysisRequirements(c).length&&!!c.analysis;
    const p=c.analysis?.suggestions?.[item.id],numeric=p?.value===0||p?.value===1,decision=c.scoreReview?.[item.id];
    const proposal=el('div',undefined,`proposal${numeric?'':' manual'}${decision?' confirmed-proposal':''}`);
    proposal.append(el('strong',!p?'Awaiting analysis':numeric?`Suggested: ${p.value===1?'Present · 1':'Absent · 0'}${p.kind==='proxy'?' · proxy':p.kind==='heuristic'?' · heuristic':''}`:p.kind==='missing'?'Unable to suggest · check landmarks':'Visual decision needed'),el('p',p?.evidence??'Review and confirm the frames and landmarks, then choose Analyse confirmed frames.','small'));
    if(decision)proposal.append(el('p',decision.decision==='confirmed'?'Examiner confirmed the proposal.':decision.decision==='refuted'?'Examiner refuted the proposal.':decision.decision==='unable'?'Examiner marked unable to assess.':'Examiner entered a visual score.','analysis-state'));
    const group=el('div',undefined,'score-options');group.setAttribute('role','group');group.setAttribute('aria-label',item.name);
    const choices=numeric?[[`Confirm · ${p.value}`,p.value],[`Refute · ${1-p.value}`,1-p.value],['Unable','na']]:[['Absent · 0',0],['Present · 1',1],['Unable','na']];
    for(const [label,val]of choices){const b=button(label,()=>{c.scores[item.id]=val;c.scoreReview??={};c.scoreReview[item.id]={decision:val==='na'?'unable':numeric?val===p.value?'confirmed':'refuted':'manual',suggested:p?.value??null,analysisAt:c.analysis?.generatedAt,at:new Date().toISOString()};markDirty();renderItems();renderSummary();},'score-choice');b.disabled=!allowed;b.setAttribute('aria-pressed',String(c.scores[item.id]===val));group.append(b);}
    box.append(heading,view,el('p',item.help,'small'),proposal,group);if(!allowed)box.append(el('p',!c.file?'Reattach the original video to change scores.':'Review the frames and landmarks, then run Analyse confirmed frames first.','small hint'));root.append(box);
  });
}
function renderSummary(){const root=$('summary');root.replaceChildren();const totals={};
  for(const side of SIDES){const c=session.clips[side],s=summary(c);totals[side]=s.total;const block=el('div',undefined,'summary-side');block.append(el('span',title(side),'eyebrow'),el('strong',s.total===null?'—':`${s.total}`, 'score-total'),el('span',s.total===null?c?`${s.answered}/12 scored${s.unassessable?` · ${s.unassessable} unable`:''}`:'No video':'out of 12','small'));if(c&&s.total===null)block.append(el('span',s.phaseIssues.length?'Check event frames':!s.phasesConfirmed?'Confirm all five events':!s.intervalConfirmed?'Review swing interval':!c.analysis&&'markersReviewed' in c?'Analyse confirmed frames':'Incomplete assessment','small'));root.append(block);}
  const both=totals.left!==null&&totals.right!==null,difference=el('div',undefined,'summary-side');difference.append(el('span','SIDE DIFFERENCE','eyebrow'),el('strong',both?String(Math.abs(totals.left-totals.right)):'—','score-total'),el('span',both?'points · absolute difference':'Both complete scores needed','small'));root.append(difference);
  $('summary-note').textContent='Higher totals indicate more observed S-MAS features. A one-point difference may fall within measurement error. No injury probability or return-to-sport decision is calculated.';
  $('results').hidden=!SIDES.some(s=>session.clips[s]?.frames);
}
function render(){const c=current(),present=SIDES.filter(s=>session.clips[s]?.file),pending=present.filter(s=>!session.clips[s].frames);$('workspace').hidden=!c;
  for(const side of SIDES){$('show-'+side).setAttribute('aria-pressed',String(side===selected));$('show-'+side).disabled=!!active||!session.clips[side];$(side+'-file').disabled=!!active;$(side+'-name').textContent=session.clips[side]?.fileName??`Add ${side}-side video`;}
  $('process').disabled=!!active||!present.length;$('process').textContent=!present.length?'Process video':pending.length===2?'Process both videos':pending.length===1?`Process ${pending[0]} video`:`Reprocess ${selected} video`;
  $('cancel').hidden=!active;$('progress').hidden=!active;
  for(const id of ['rotate','direction','capture-fps','save','new'])$(id).disabled=!!active||!c;
  $('export').disabled=!!active;$('print').disabled=!!active;
  if(c){$('direction').value=String(c.direction);$('capture-fps').value=c.captureFps;$('side-notes').value=c.notes;$('sequence-label').hidden=!c.sequences?.length;
    $('sequence').replaceChildren(...(c.sequences??[]).map((sequence,i)=>{const op=el('option',`Sequence ${i+1} · touchdown frame ${sequence.events.touchdown.index+1}`);op.value=String(i);return op;}));$('sequence').value=String(c.sequenceIndex??0);
    $('suggestion-note').textContent=c.suggestionNote??'Process the clip to suggest phases, or set them manually after processing.';
    $('timing-note').textContent=c.decodedFps?`Decoded playback cadence: ${c.decodedFps.toFixed(1)} frames/s. Capture rate: ${c.captureFps?c.captureFps+' fps, entered by examiner':'not confirmed'}. File timing is not assumed to be real sprint time. ${c.captureFps&&c.captureFps!=='240'?'This differs from the published 240 fps protocol.':''}`:'Confirm the camera recording setting after import.';
    $('rotate').disabled=!!active||!c.file;
  }
  renderPhases();renderAnalysis();renderItems();renderSummary();renderFrameControls();
  for(const b of $('saved-list').querySelectorAll('button'))b.disabled=!!active||saving;
  if(saving)for(const node of document.querySelectorAll('button,input,select,textarea'))node.disabled=true;
  void framePreview();
}
function choose(side){stop();selected=side;$('joint-side').value=side;$('joint').value='';render();}
for(const side of SIDES){$('show-'+side).addEventListener('click',()=>choose(side));$(side+'-file').addEventListener('change',()=>{
  const file=$(side+'-file').files[0];if(!file)return;stop();const old=session.clips[side];
  if(old?.frames&&old.fileName===file.name&&old.fileSize===file.size){old.file=file;closePreview();choose(side);report('Original video reattached. Saved phase selections and scores are retained.');return;}
  if(old?.frames&&!confirm('Replace this side’s video, landmarks and scores?')){$(side+'-file').value='';return;}
  session.clips[side]=freshClip(file);closePreview();markDirty();choose(side);report('Check the orientation, then process the selected video.');
});}
$('process').addEventListener('click',async()=>{
  if(active)return;let targets=SIDES.filter(s=>session.clips[s]?.file&&!session.clips[s].frames);
  if(!targets.length){if(!current()?.file)return;if(current().frames&&!confirm('Reprocess this side? This replaces its corrections, events and scores.'))return;targets=[selected];}
  stop();closePreview();active=new AbortController();const signal=active.signal;render();let completed=0;
  try{for(const side of targets){signal.throwIfAborted();const old=session.clips[side];report(`Loading MediaPipe Full for the ${side} video…`);const data=await scan(old.file,old.turn,signal,(n,t)=>report(`Processing ${side} video · ${n} frames · ${t.toFixed(1)} s of file time`));
      const c={...freshClip(old.file),...data,turn:old.turn,notes:old.notes,captureFps:old.captureFps,frameCount:data.frames.length};
      const suggestion=suggestSequences(c.frames,side,c.aspect);c.direction=suggestion.direction;c.sequences=suggestion.sequences;c.suggestionNote=suggestion.reason;c.sequenceIndex=0;
      c.events=structuredClone(c.sequences[0]?.events??{});c.flags=qualityFlags(c.frames,side,c.aspect);session.clips[side]=c;selected=side;completed++;markDirty();}
    report(`${completed===2?'Both videos':title(targets[0])+' video'} processed. Confirm the event frames, review the interval and landmarks, then analyse the confirmed frames.`);
  }catch(e){report(signal.aborted?`Processing cancelled. ${completed} completed video${completed===1?'':'s'} retained.`:e.message,!signal.aborted);}
  finally{active=null;render();}
});
$('cancel').addEventListener('click',()=>active?.abort());
$('rotate').addEventListener('click',()=>{const c=current();if(c.frames&&!confirm('Rotate and clear this side’s analysis so it can be processed in the new orientation?'))return;stop();closePreview();const turn=(c.turn+90)%360;session.clips[selected]={...freshClip(c.file),turn,captureFps:c.captureFps,notes:c.notes};markDirty();render();report('Orientation updated. Process this video again.');});
$('direction').addEventListener('change',()=>{const c=current();c.direction=Number($('direction').value);invalidate(c);c.snapshots={};markDirty();render();report('Direction updated. Confirm the phases and scores again.');});
$('capture-fps').addEventListener('change',()=>{current().captureFps=$('capture-fps').value;markDirty();render();});
$('side-notes').addEventListener('input',()=>{current().notes=$('side-notes').value;markDirty();});
$('sequence').addEventListener('change',()=>{const c=current();if(Object.keys(c.scores).length&&!confirm('Use this sequence and clear this side’s current scoring?')){$('sequence').value=String(c.sequenceIndex);return;}c.sequenceIndex=Number($('sequence').value);c.events=structuredClone(c.sequences[c.sequenceIndex].events);clearAnalysis(c);c.snapshots={};c.intervalConfirmed=false;markDirty();seek(c.events.touchdown.index);render();});
$('scrub').addEventListener('input',()=>seek(Number($('scrub').value)));
$('previous').addEventListener('click',()=>seek(current().index-1));$('next').addEventListener('click',()=>seek(current().index+1));
function playRange(start,end){stop();const c=current();seekDuringPlay(start);$('play').textContent='Pause';playing=setInterval(()=>{if(!current()?.file||c.index>=end){stop();return;}seekDuringPlay(c.index+1);},90);}
$('play').addEventListener('click',()=>{if(playing){stop();return;}const c=current();playRange(c.index>=c.frames.length-1?0:c.index,c.frames.length-1);});
$('play-interval').addEventListener('click',()=>{const c=current();playRange(c.events.mvp.index,c.events.late.index);});
$('interval-reviewed').addEventListener('change',()=>{const c=current();c.intervalConfirmed=$('interval-reviewed').checked;if(!c.intervalConfirmed)clearAnalysis(c,{scores:false});markDirty();render();});
$('markers-reviewed').addEventListener('change',()=>{const c=current();if(!$('markers-reviewed').checked)clearAnalysis(c,{scores:false});else c.markersReviewed=true;markDirty();render();});
$('knee-tolerance').addEventListener('change',()=>{const c=current(),v=Number($('knee-tolerance').value);if($('knee-tolerance').value===''||!Number.isFinite(v)||v<0||v>20){$('knee-tolerance').value=c.straightKneeTolerance??10;report('Enter a straight-knee tolerance between 0° and 20°.',true);return;}c.straightKneeTolerance=v;clearAnalysis(c);markDirty();render();report('Tolerance changed. Review the landmarks and analyse again; previous scores were cleared.');});
$('analyse').addEventListener('click',()=>{const c=current();if(active||!c)return;stop();try{c.analysis=analyseConfirmedFrames(c,selected);markDirty();renderAnalysis();renderItems();renderSummary();report('Analysis completed using your stored landmarks and confirmed frames. Confirm or refute each proposal below; enter a visual decision for the remaining items. Existing examiner decisions were retained.');$('score-items').scrollIntoView({block:'start',behavior:'smooth'});}catch(e){report(e.message,true);}});
$('overlay').addEventListener('change',()=>void framePreview());
$('zoom').addEventListener('change',()=>{canvas.style.width=Number($('zoom').value)===1?'':`${Number($('zoom').value)*100}%`;canvas.style.maxWidth=Number($('zoom').value)===1?'100%':'none';});
$('next-flag').addEventListener('click',()=>{const c=current(),groups=flagGroups(c.flags).filter(g=>!c.reviewed.includes(`${g.start}:${g.end}`)),g=groups.find(g=>g.start>c.index)??groups[0];if(g)seek(g.start);});
$('ack-flag').addEventListener('click',()=>{const c=current(),g=flagGroups(c.flags).find(g=>g.start<=c.index&&g.end>=c.index);if(g){c.reviewed.push(`${g.start}:${g.end}`);markDirty();renderFrameControls();}});
canvas.addEventListener('click',event=>{const c=current(),joint=$('joint').value;if(!joint||!c?.file||!c.frames||active)return;stop();const f=c.frames[c.index],rect=canvas.getBoundingClientRect(),p={x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height)),score:1};
  if(joint.startsWith('ref:')){if(!('originalReferences' in f))f.originalReferences=structuredClone(f.references??{});f.references??={};f.references[joint.slice(4)]=p;}
  else{if(!('originalPoints' in f))f.originalPoints=structuredClone(f.points);if(!f.points)f.points=Array(33).fill(null);f.points[JOINTS[$('joint-side').value][joint]]=p;}
  clearAnalysis(c);c.snapshots={};c.flags=qualityFlags(c.frames,selected,c.aspect);c.reviewed=[];markDirty();render();report('Frame marker updated. Your event frames are retained. Review the landmarks and analyse again; previous suggestions and scores were cleared.');});
$('reset-frame').addEventListener('click',()=>{const c=current(),f=c.frames[c.index];if('originalPoints' in f){f.points=f.originalPoints;delete f.originalPoints;}if('originalReferences' in f){f.references=f.originalReferences;delete f.originalReferences;}clearAnalysis(c);c.snapshots={};c.flags=qualityFlags(c.frames,selected,c.aspect);c.reviewed=[];markDirty();render();report('Frame markers reset. Event frames are retained; review the landmarks and analyse again.');});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||active||!current()?.frames||!current().file)return;if(e.key==='ArrowLeft'){e.preventDefault();seek(current().index-1);}if(e.key==='ArrowRight'){e.preventDefault();seek(current().index+1);}});

async function snapshots(){
  for(const side of SIDES){const c=session.clips[side];if(!c?.frames||!c.file)continue;let source;try{source=await openVideo(c.file);for(const phase of PHASES){const event=c.events[phase.id];if(event?.index==null)continue;const sample=await source.sink.getSample(source.start+c.frames[event.index].time);if(!sample)continue;try{const target=document.createElement('canvas');drawFrame(target,sample,c.turn,720);overlay(target,c.frames[event.index],side);c.snapshots[phase.id]=target.toDataURL('image/jpeg',.72);}finally{sample.close();}}}finally{source?.input.dispose();}}
}
function stored(){fieldsToState();const result={...session,version:VERSION,savedAt:new Date().toISOString(),clips:{}};for(const side of SIDES){const c=session.clips[side];if(!c?.frames)continue;const {file,...data}=c;result.clips[side]=structuredClone(data);}return result;}
$('save').addEventListener('click',async()=>{if(active||saving)return;if(!session.athlete.trim()){report('Enter an athlete ID before saving.',true);$('athlete').focus();return;}saving=true;stop();render();try{await snapshots();await saveSession(stored());dirty=false;$('save-status').textContent='Saved on this device';report('Assessment saved locally. Keep the original video files for later frame review.');await refreshSaved();}catch(e){report('Could not save: '+e.message+'. Export CSV now to retain your scoring.',true);}finally{saving=false;for(const node of document.querySelectorAll('button,input,select,textarea'))node.disabled=false;render();}});
function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').addEventListener('click',()=>{fieldsToState();session.version=VERSION;download(new Blob([toCsv(csvRows(session))],{type:'text/csv;charset=utf-8'}),`LIHPS-SMAS-${session.date}-${session.id.slice(0,8)}.csv`);});
function buildReport(){fieldsToState();const root=$('print-report');root.replaceChildren();root.append(el('h1','LIHPS Sprint Mechanics'),el('p',`S-MAS assessment · Preview ${VERSION}`));
  for(const [label,key]of [['Athlete','athlete'],['Date','date'],['Assessor','assessor'],['Setting','setting'],['Surface','surface'],['Footwear','footwear'],['Measured speed (m/s)','speed'],['Previous hamstring injury','history'],['Protocol notes','notes']])root.append(el('p',`${label}: ${session[key]||'Not recorded'}`));
  for(const side of SIDES){const c=session.clips[side];if(!c?.frames)continue;const s=summary(c);root.append(el('h2',`${title(side)} · ${s.total===null?'Incomplete assessment':s.total+'/12'}`),el('p',`${c.fileName} · ${c.captureFps?c.captureFps+' fps stated':'Capture rate not confirmed'} · Decoded playback ${c.decodedFps?.toFixed(1)??'unknown'} fps · Running ${c.direction===-1?'right to left':'left to right'}`));
    const grid=el('div',undefined,'print-frames');for(const p of PHASES){const figure=el('figure');if(c.snapshots?.[p.id]){const img=el('img');img.src=c.snapshots[p.id];img.alt=p.label;figure.append(img);}figure.append(el('figcaption',`${p.label} · frame ${c.events[p.id]?.index==null?'not set':c.events[p.id].index+1} · ${c.events[p.id]?.confirmed?'confirmed':'unconfirmed'}`));grid.append(figure);}root.append(grid);
    const table=el('table'),head=el('tr');head.append(el('th','Observation'),el('th','Examiner score'),el('th','Proposal / review'));table.append(head);for(const item of ITEMS){const row=el('tr'),v=c.scores[item.id],p=c.analysis?.suggestions?.[item.id],review=c.scoreReview?.[item.id];row.append(el('td',item.name),el('td',v===0?'Absent · 0':v===1?'Present · 1':v==='na'?'Unable to assess':'Unscored'),el('td',`${p?.value===0||p?.value===1?'Suggested '+p.value:'Visual review'} · ${review?.decision??'not confirmed'}. ${p?.evidence??''}`));table.append(row);}root.append(table,el('p',`Analysis: ${c.analysis?.generatedAt??'Not run'} · Landmarks reviewed: ${c.markersReviewed?'Yes':'No'} · Swing interval reviewed: ${c.intervalConfirmed?'Yes':'No'}`),el('p',`Notes: ${c.notes||'None'}`),el('p',`Tracking flags: ${flagGroups(c.flags??[]).length} stretches; ${c.reviewed?.length??0} acknowledged. Acknowledgement does not validate tracking accuracy.`));
  }
  root.append(el('p','Higher totals reflect more observed S-MAS features. One-point differences may fall within measurement error. No injury probability or return-to-sport decision is calculated.'),el('p','Criteria adapted from Bramah et al. (2024), doi:10.1177/03635465241235525, CC BY-NC 4.0. Shortened wording. Examiner-confirmed scoring; automatic phase suggestions are unvalidated engineering heuristics.'));
}
$('print').addEventListener('click',async()=>{if(active||saving)return;stop();saving=true;render();try{await snapshots();buildReport();window.print();}catch(e){report('Could not prepare report: '+e.message,true);}finally{saving=false;for(const node of document.querySelectorAll('button,input,select,textarea'))node.disabled=false;render();}});
async function refreshSaved(){try{saved=(await listSessions()).sort((a,b)=>(b.savedAt??'').localeCompare(a.savedAt??''));$('saved-count').textContent=`(${saved.length})`;$('saved-list').replaceChildren();if(!saved.length)$('saved-list').append(el('p','No saved assessments yet.','small'));for(const entry of saved){const row=el('div',undefined,'saved-row'),text=el('div');text.append(el('strong',entry.athlete||'Untitled'),el('p',`${entry.date} · ${SIDES.map(side=>{const s=summary(entry.clips[side]);return title(side)+' '+(s.total===null?'incomplete':s.total+'/12');}).join(' · ')}`,'small'));
      const load=button('Open',()=>{if(dirty&&!confirm('Open this saved assessment and discard unsaved changes?'))return;stop();closePreview();session=structuredClone(entry);selected=session.clips.left?'left':'right';dirty=false;stateToFields();$('save-status').textContent='Saved assessment';for(const side of SIDES)$(side+'-file').value='';render();report('Saved scores loaded. Reattach each matching original video to resume review.');},'secondary');load.disabled=!!active;
      const del=button('Delete',async()=>{if(!confirm('Delete this saved assessment from this device? Original videos are unaffected.'))return;try{await deleteSession(entry.id);await refreshSaved();}catch(e){report(e.message,true);}},'quiet');del.disabled=!!active;row.append(text,load,del);$('saved-list').append(row);}
  }catch(e){$('saved-list').replaceChildren(el('p','Local assessment storage is unavailable in this browser. Export CSV to retain your scoring.','small'));}}
$('new').addEventListener('click',()=>{if(dirty&&!confirm('Start a new assessment and discard unsaved changes?'))return;stop();closePreview();const assessor=session.assessor;session=fresh();session.assessor=assessor;selected='left';dirty=false;for(const side of SIDES)$(side+'-file').value='';stateToFields();$('save-status').textContent='New assessment';render();report('Choose one or both clips to begin.');});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});

async function offlineStatus(){if(!('serviceWorker'in navigator)){ $('offline-state').textContent='Offline preparation needs an HTTPS address and a browser with service-worker support.';return;}
  try{const registration=await navigator.serviceWorker.ready,worker=registration.active;if(!worker){$('offline-state').textContent='Offline installation is still running.';return;}
    const channel=new MessageChannel(),response=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Offline readiness check timed out. Reload online and retry.')),12000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data);};});worker.postMessage({type:'CHECK_CACHE'},[channel.port2]);const state=await response;$('offline-state').textContent=state.ready?'App, MediaPipe model and decoder are cached. Verify by reopening the app and processing a short original clip with networking off. Browser storage can be cleared or evicted.':`Offline preparation is incomplete (${state.cached}/${state.total} assets). Reload online and let installation finish.`;
  }catch(e){$('offline-state').textContent=e.message;}}
$('offline-check').addEventListener('click',()=>void offlineStatus());
if('serviceWorker'in navigator&&isSecureContext)navigator.serviceWorker.register('./sw.js').then(()=>offlineStatus()).catch(e=>{$('offline-state').textContent='Offline installation failed: '+e.message;});
stateToFields();render();void refreshSaved();

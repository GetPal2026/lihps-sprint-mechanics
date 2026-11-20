import {PHASES,ITEMS,other,point,angle,usable,measures,summary} from './scoring.js?v=020';

export const ANALYSIS_VERSION='0.2.0';
const fmt=v=>Number.isFinite(v)?v.toFixed(1):'unavailable';
const ref=(frame,key,aspect)=>{const p=frame?.references?.[key];return usable(p)?{x:p.x*aspect,y:p.y}:null;};
const proposal=(value,kind,evidence,frame)=>({value,kind,evidence,frame:frame==null?null:frame+1});
const visual=(evidence,frame)=>proposal(null,'visual',evidence,frame);
const missing=(evidence,frame)=>proposal(null,'missing',evidence,frame);

export function analysisRequirements(clip){
  if(!clip?.frames?.length)return ['Process a video once to obtain frame landmarks.'];
  const s=summary(clip),issues=[...s.phaseIssues];
  if(!s.phasesConfirmed)issues.push('Confirm all five event frames.');
  if(!s.intervalConfirmed)issues.push('Review the projection-to-late-swing interval.');
  if(!clip.markersReviewed)issues.push('Confirm that you reviewed the phase landmarks.');
  return issues;
}

// Only examines already stored coordinates. It cannot decode video or invoke a model.
// Numeric proposals are engineering assistance and never examiner-confirmed scores.
export function analyseConfirmedFrames(clip,side){
  const errors=analysisRequirements(clip);if(errors.length)throw new Error(errors.join(' '));
  const a=clip.aspect??1,d=clip.direction===-1?-1:1,far=other(side),at=p=>clip.frames[clip.events[p].index],idx=p=>clip.events[p].index;
  const suggestions=Object.fromEntries(ITEMS.map(item=>[item.id,visual('Examiner judgment is required for this observation.',idx(item.phase==='interval'?'mvp':item.phase))]));
  const tolerance=Number.isFinite(Number(clip.straightKneeTolerance))?Math.max(0,Math.min(20,Number(clip.straightKneeTolerance))):10;

  let f=at('toeoff'),h=point(f,far,'hip',a),k=point(f,far,'knee',a),ankle=point(f,far,'ankle',a);
  const extension=h&&k?Math.atan2(-d*(k.x-h.x),k.y-h.y)*180/Math.PI:null;
  const included=angle(h,k,ankle),flex=included===null?null:180-included;
  suggestions.trailing=extension!==null&&flex!==null?proposal(extension>=45&&flex<=tolerance?1:0,'heuristic',`Trailing thigh ${fmt(extension)}° behind vertical; knee flexion ${fmt(flex)}°. Uses the published 45° cue and your ${tolerance}° straight-knee tolerance. The knee tolerance is an adjustable engineering assumption, not a published S-MAS cutoff.`,idx('toeoff')):missing('The opposite hip, knee or ankle is missing or uncertain at toe-off.',idx('toeoff'));

  f=at('mvp');k=point(f,far,'knee',a);ankle=point(f,far,'ankle',a);const heel=point(f,far,'heel',a);
  if(k&&ankle&&heel){const rise=Math.atan2(k.y-ankle.y,Math.abs(ankle.x-k.x))*180/Math.PI;
    const aboveCalf=heel.y<(k.y+ankle.y)/2;
    suggestions.backkick=proposal(rise>0&&aboveCalf?1:0,'heuristic',`Trailing shank ${fmt(rise)}° above horizontal; heel ${aboveCalf?'above':'not above'} the projected mid-calf level. Check the shoe and calf outline in the image.`,idx('mvp'));
  }else suggestions.backkick=missing('The opposite knee, ankle or heel is missing or uncertain at projection.',idx('mvp'));
  suggestions.rotation=visual('A side-view pose skeleton does not measure excessive axial trunk/pelvic rotation. Inspect the far shoulder, upper arm and trunk movement.',idx('mvp'));

  f=at('late');const back=ref(f,'back',a),trailingKnee=point(f,far,'knee',a);
  suggestions.separationLate=back&&trailingKnee?proposal(d*(trailingKnee.x-back.x)<0?1:0,'reference','Compared the opposite knee with your marked posterior gluteal/back outline in the running direction.',idx('late')):visual('Add a posterior gluteal/back-outline reference at late swing for a coordinate-based proposal, or judge whether the opposite knee is behind the gluteal outline.',idx('late'));
  suggestions.pelvisSwing=visual(`Inspect the reviewed interval, frames ${idx('mvp')+1}–${idx('late')+1}. MediaPipe does not resolve the lumbar curve or the pelvic landmarks needed to measure anterior tilt.`,idx('mvp'));

  f=at('touchdown');const hip=point(f,side,'hip',a),shoulder=point(f,side,'shoulder',a),c7=ref(f,'c7',a),trochanter=ref(f,'trochanter',a);
  const upper=c7??shoulder,lower=trochanter??hip;
  const lean=upper&&lower&&Math.hypot(upper.x-lower.x,upper.y-lower.y)>1e-5?Math.atan2(d*(upper.x-lower.x),lower.y-upper.y)*180/Math.PI:null;
  suggestions.lean=lean===null?missing('A usable trunk reference is missing at touchdown.',idx('touchdown')):proposal(lean>15?1:0,c7&&trochanter?'reference':'proxy',`${fmt(lean)}° forward lean using ${c7?'your C7 mark':'the shoulder proxy'} and ${trochanter?'your greater-trochanter mark':'the hip estimate'}. The published cue is >15° using greater trochanter to C7; add those optional marks for the matching reference.`,idx('touchdown'));
  suggestions.pelvisContact=visual('Judge lumbar extension/anterior pelvic tilt from the actual touchdown image. No numeric cutoff or adequate pelvic/spine landmarks are supplied by this model.',idx('touchdown'));
  const m=measures(f,side,a,d),contactBack=ref(f,'back',a),contactFarKnee=point(f,far,'knee',a);
  const behind=contactBack&&contactFarKnee?d*(contactFarKnee.x-contactBack.x)<0:null;
  if(m.thighSeparation===null)suggestions.separationContact=missing('Both hips and knees are needed for the inter-thigh angle.',idx('touchdown'));
  else if(m.thighSeparation>20||behind===true)suggestions.separationContact=proposal(1,'geometry',`Inter-thigh angle ${fmt(m.thighSeparation)}° (>20° is the published angular cue). ${behind===true?'The opposite knee is also behind your back-outline reference.':''}`,idx('touchdown'));
  else if(behind===false)suggestions.separationContact=proposal(0,'reference',`Inter-thigh angle ${fmt(m.thighSeparation)}° and opposite knee not behind your marked back outline.`,idx('touchdown'));
  else suggestions.separationContact=visual(`Inter-thigh angle ${fmt(m.thighSeparation)}° is not above 20°. The alternative trailing-knee/back criterion still needs review; mark the back outline at touchdown to include it.`,idx('touchdown'));

  const com=ref(f,'com',a),contactHeel=point(f,side,'heel',a),toe=point(f,side,'toe',a);
  if(com&&contactHeel&&toe){const contact=contactHeel.y>=toe.y?contactHeel:toe,span=Math.abs(toe.x-contactHeel.x),gap=d*(contact.x-com.x);
    suggestions.overstride=span>1e-5?proposal(gap>=span?1:0,'proxy',`Contact-to-reference gap is ${fmt(gap/span)} projected foot spans. Uses your estimated CoM projection and the model heel/forefoot span; check the actual shoe length and first contact.`,idx('touchdown')):missing('The projected foot span is too small for a reliable comparison.',idx('touchdown'));
  }else suggestions.overstride=visual('Add an examiner-estimated CoM projection at touchdown for a foot-span comparison. The hip estimate is not silently substituted for centre of mass.',idx('touchdown'));
  suggestions.shin=m.shinForward===null?missing('A usable knee and ankle are needed at touchdown.',idx('touchdown')):proposal(m.shinForward>0?1:0,'geometry',`Shin ${fmt(m.shinForward)}° ahead of vertical in the running direction; ankle ${m.shinForward>0?'ahead of':'not ahead of'} knee.`,idx('touchdown'));
  suggestions.foot=visual('Inspect the shoe–ground gap for an excessive heel/forefoot contact pattern. Pose foot points do not trace the shoe sole or ground contact, so a defensible binary proposal is unavailable.',idx('touchdown'));
  const mid=measures(at('midstance'),side,a,d);
  suggestions.collapse=visual(`Knee flexion at the confirmed midstance frame: ${fmt(mid.kneeFlexion)}°. The published collapse criterion is qualitative and has no fixed knee-angle cutoff; inspect knee, ankle and whole-body sinking.`,idx('midstance'));

  return {version:ANALYSIS_VERSION,generatedAt:new Date().toISOString(),straightKneeTolerance:tolerance,suggestions,eventFrames:Object.fromEntries(PHASES.map(p=>[p.id,idx(p.id)+1]))};
}

export function clearAnalysis(clip,{scores=true}={}){clip.analysis=null;clip.markersReviewed=false;if(scores){clip.scores={};clip.scoreReview={};}}

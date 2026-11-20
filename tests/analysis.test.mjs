import test from 'node:test';
import assert from 'node:assert/strict';
import {JOINTS,PHASES,ITEMS,summary,csvRows} from '../scoring.js';
import {analyseConfirmedFrames,analysisRequirements,clearAnalysis} from '../analysis.js';

function fixture(){
 const points=Array(33).fill(null),set=(side,j,x,y)=>points[JOINTS[side][j]]={x,y,score:1};
 for(const side of ['left','right']){set(side,'shoulder',.55,.15);set(side,'hip',.5,.4);set(side,'knee',.5,.6);set(side,'ankle',.6,.85);set(side,'heel',.58,.88);set(side,'toe',.7,.9);}
 const frames=Array.from({length:5},(_,i)=>({time:i/120,points:structuredClone(points)}));
 return {frames,aspect:1,direction:1,events:Object.fromEntries(PHASES.map((p,i)=>[p.id,{index:i,confirmed:true}])),intervalConfirmed:true,markersReviewed:true,straightKneeTolerance:10,scores:{}};
}
test('only reviewed and ordered frames can generate proposals, without mutating corrections or scores',()=>{
 const c=fixture(),before=structuredClone(c);const a=analyseConfirmedFrames(c,'left');assert.deepEqual(c,before);assert.equal(Object.keys(a.suggestions).length,12);assert.deepEqual(c.scores,{});assert.equal(summary({...c,analysis:a}).total,null);
 for(const field of ['markersReviewed','intervalConfirmed']){const copy=structuredClone(c);copy[field]=false;assert.throws(()=>analyseConfirmedFrames(copy,'left'));}
 c.events.late.index=3;assert.ok(analysisRequirements(c).length);assert.throws(()=>analyseConfirmedFrames(c,'left'));
});
test('direction and aspect correction retain proposals in mirrored video',()=>{
 const c=fixture(),mirror=structuredClone(c);mirror.direction=-1;for(const f of mirror.frames)for(const p of f.points)if(p)p.x=1-p.x;
 const a=analyseConfirmedFrames(c,'left'),b=analyseConfirmedFrames(mirror,'left');for(const item of ITEMS)assert.equal(a.suggestions[item.id].value,b.suggestions[item.id].value,item.id);
 const wide=structuredClone(c);wide.aspect=2;for(const f of wide.frames)for(const p of f.points)if(p)p.x/=2;
 const w=analyseConfirmedFrames(wide,'left');for(const item of ITEMS)assert.equal(a.suggestions[item.id].value,w.suggestions[item.id].value,item.id);
});
test('subjective items remain visual and optional examiner references enable additional proposals',()=>{
 const c=fixture(),a=analyseConfirmedFrames(c,'left');for(const key of ['rotation','pelvisSwing','pelvisContact','foot','collapse','overstride','separationLate'])assert.equal(a.suggestions[key].value,null,key);
 c.frames[2].references={back:{x:.6,y:.5,score:1}};c.frames[3].references={back:{x:.6,y:.5,score:1},com:{x:.4,y:.9,score:1},c7:{x:.7,y:.1,score:1},trochanter:{x:.5,y:.4,score:1}};
 const b=analyseConfirmedFrames(c,'left');assert.equal(b.suggestions.separationLate.value,1);assert.equal(b.suggestions.overstride.value,1);assert.equal(b.suggestions.lean.value,1);assert.equal(b.suggestions.lean.kind,'reference');
});
test('missing and degenerate landmarks cannot become reassuring zeros',()=>{
 const c=fixture();c.frames[3].points[JOINTS.left.ankle].score=.1;let a=analyseConfirmedFrames(c,'left');assert.equal(a.suggestions.shin.value,null);
 c.frames[3].points[JOINTS.left.shoulder]=structuredClone(c.frames[3].points[JOINTS.left.hip]);a=analyseConfirmedFrames(c,'left');assert.equal(a.suggestions.lean.value,null);
});
test('landmark edits invalidate analysis and scores while preserving confirmed event frames',()=>{
 const c=fixture(),events=structuredClone(c.events);c.analysis=analyseConfirmedFrames(c,'left');c.scores.shin=1;clearAnalysis(c);assert.equal(c.analysis,null);assert.equal(c.markersReviewed,false);assert.deepEqual(c.scores,{});assert.deepEqual(c.events,events);assert.equal(c.intervalConfirmed,true);
});
test('CSV keeps proposals, examiner decisions and totals separate',()=>{
 const c=fixture();c.analysis=analyseConfirmedFrames(c,'left');c.scores.shin=0;c.scoreReview={shin:{decision:'refuted'}};
 const rows=csvRows({version:'0.2.0',clips:{left:c}}),header=rows[0],row=rows[10];assert.ok(rows.every(r=>r.length===header.length));assert.equal(row[header.indexOf('suggested_score')],1);assert.equal(row[header.indexOf('score')],0);assert.equal(row[header.indexOf('review_decision')],'refuted');assert.equal(row[header.indexOf('complete_total')],'');
});

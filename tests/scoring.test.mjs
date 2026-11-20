import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,PHASES,JOINTS,summary,phaseProblems,measures,qualityFlags,suggestSequences,invalidate,csvRows,toCsv} from '../scoring.js';
const events=()=>Object.fromEntries(PHASES.map((p,i)=>[p.id,{index:i*3+1,confirmed:true}]));
const clip=()=>({frames:Array.from({length:20},(_,i)=>({time:i/240,points:null})),events:events(),scores:Object.fromEntries(ITEMS.map((item,i)=>[item.id,i%2])),intervalConfirmed:true,frameCount:20});
test('complete totals require all twelve observations, five confirmed events, and reviewed interval',()=>{
 const c=clip();assert.equal(summary(c).total,6);
 for(const id of ITEMS.map(i=>i.id)){const copy=structuredClone(c);delete copy.scores[id];assert.equal(summary(copy).total,null);copy.scores[id]='na';assert.equal(summary(copy).total,null);assert.equal(summary(copy).unassessable,1);}
 c.events.mvp.confirmed=false;assert.equal(summary(c).total,null);c.events.mvp.confirmed=true;c.intervalConfirmed=false;assert.equal(summary(c).total,null);
});
test('zero is a legitimate complete result and invalid ordering cannot produce a total',()=>{
 const c=clip();for(const i of ITEMS)c.scores[i.id]=0;assert.equal(summary(c).total,0);c.events.late.index=c.events.touchdown.index;assert.equal(summary(c).total,null);assert.ok(phaseProblems(c.events,20).length);c.events=events();c.events.toeoff.index=-1;assert.ok(phaseProblems(c.events,20).length);
});
test('2D measurements correct for image aspect and direction, with straight knee at zero flexion',()=>{
 const points=Array(33).fill(null),set=(j,x,y)=>{points[JOINTS.left[j]]={x,y,score:1};};set('hip',.5,.3);set('knee',.5,.5);set('ankle',.5,.8);set('shoulder',.6,.1);
 const m=measures({points},'left',2,1);assert.ok(Math.abs(m.kneeFlexion)<1e-6);assert.ok(Math.abs(m.shoulderHipLean-45)<1e-6);assert.equal(measures({points},'left',2,-1).shoulderHipLean,-m.shoulderHipLean);
 points[JOINTS.left.ankle].score=.1;assert.equal(measures({points},'left',2).kneeFlexion,null);
});
test('low-confidence points and missing timestamp samples are flagged, never silently treated as good',()=>{
 const c=clip();c.frames[10].time+=.03;const flags=qualityFlags(c.frames,'left',1);assert.match(flags[0].join(' '),/Uncertain.*heel/);assert.ok(flags[10].some(f=>/timing/.test(f)));assert.ok(flags[11].some(f=>/timing/.test(f)));
});
test('no usable tracking yields manual fallback without invented events',()=>{
 const s=suggestSequences(clip().frames,'left',1);assert.deepEqual(s.sequences,[]);assert.match(s.reason,/manually/);
});
test('synthetic forward and mirrored movement produce ordered suggestions with no automatic confirmations',()=>{
 const frames=Array.from({length:100},(_,i)=>{const points=Array.from({length:33},()=>({x:.2,y:.2,score:1})),set=(side,j,x,y)=>{points[JOINTS[side][j]]={x,y,score:1};};
  for(const side of ['left','right']){set(side,'hip',.1+i*.005,.5-.05*Math.exp(-Math.pow((i-30)/12,2)));set(side,'shoulder',.11+i*.005,.25);set(side,'knee',.18+i*.005,.66);}
  const x=i<50?.5-(50-i)*.009:i<=67?.5:.5+(i-67)*.009;
  for(const j of ['ankle','heel','toe']){set('left',j,x,i>=50&&i<=67?.9:.72);set('right',j,.12+i*.005,.82+.07*Math.exp(-Math.pow((i-20)/8,2)));}
  return {time:i/240,points};});
 for(const direction of [1,-1]){const f=structuredClone(frames);if(direction<0)for(const frame of f)for(const p of frame.points)p.x=1-p.x;const result=suggestSequences(f,'left',1);assert.equal(result.direction,direction);assert.ok(result.sequences.length);for(const s of result.sequences){assert.deepEqual(phaseProblems(s.events,f.length),[]);assert.ok(PHASES.every(p=>!s.events[p.id].confirmed));}}
});
test('landmark or direction changes invalidate confirmations and scores',()=>{const c=clip();invalidate(c);assert.deepEqual(c.scores,{});assert.equal(summary(c).total,null);assert.equal(c.intervalConfirmed,false);assert.ok(PHASES.every(p=>!c.events[p.id].confirmed));});
test('CSV includes unilateral incomplete scores and preserves an unable observation',()=>{
 const c=clip();c.scores[ITEMS[0].id]='na';const session={id:'abc',date:'2026-11-19',athlete:'=FORMULA()',assessor:'Test',clips:{right:c},version:'0.1.0'};const rows=csvRows(session);assert.equal(rows.length,13);assert.ok(rows.slice(1).every(r=>r[4]==='right'));assert.equal(rows[1][18],'na');assert.equal(rows[1][23],'');const csv=toCsv(rows);assert.match(csv,/'=FORMULA/);assert.match(csv,/"right"/);
});

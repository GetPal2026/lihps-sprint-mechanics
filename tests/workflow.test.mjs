import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as scoring from '../scoring.js';
import * as analysis from '../analysis.js';

// In-memory DOM and media adapters exercise the application state machine without
// opening a browser, uploading files, or treating simulated tracking as validation.
class Element{
 children=[];handlers=new Map();attributes=new Map();dataset={};disabled=false;hidden=false;value='';checked=false;style={};width=640;height=360;
 classList={toggle(){}};
 constructor(tag='div'){this.tagName=tag.toUpperCase();}
 addEventListener(type,handler){const hs=this.handlers.get(type)??[];hs.push(handler);this.handlers.set(type,hs);}
 async fire(type,extra={}){if(this.disabled)return;for(const h of this.handlers.get(type)??[])await h({target:this,...extra});}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes.set(k,v);}
 getAttribute(k){return this.attributes.get(k);}
 querySelectorAll(tag){const nodes=[];for(const c of this.children){if(tag.startsWith('.')?c.className?.split(' ').includes(tag.slice(1)):c.tagName===tag.toUpperCase())nodes.push(c);nodes.push(...c.querySelectorAll(tag));}return nodes;}
 getContext(){return Object.fromEntries(['save','translate','rotate','restore','clearRect','beginPath','moveTo','lineTo','stroke','arc','fill','drawImage','fillText'].map(k=>[k,()=>{}]));}
 getBoundingClientRect(){return {left:0,top:0,width:640,height:360};}
 toDataURL(){return 'data:image/jpeg;base64,test';}
 scrollIntoView(){}focus(){}click(){}
}
function mount(){const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));ids.get('overlay').checked=true;
 const created=[],document={getElementById:id=>ids.get(id),createElement:tag=>{const e=new Element(tag);created.push(e);return e;},querySelectorAll:()=>[...ids.values(),...created],addEventListener(){}};
 const calls=[],records=new Map(),frames=Array.from({length:40},(_,i)=>({time:i/240,points:Array.from({length:33},()=>({x:.5,y:.5,score:1}))}));let exported;
 const deps={...scoring,...analysis,document,window:{addEventListener(){},print(){}},navigator:{},isSecureContext:false,crypto:webcrypto,structuredClone,Blob,AbortController,Image:class{},confirm:()=>true,setTimeout:()=>0,setInterval:()=>1,clearInterval(){},MessageChannel:class{},URL:{createObjectURL(blob){exported=blob;return 'blob:test';},revokeObjectURL(){}},
  openVideo:async()=>({input:{dispose(){}},start:0,sink:{getSample:async time=>({time,displayWidth:640,displayHeight:360,close(){}})}}),drawFrame(){},scan:async(file,turn,signal)=>{calls.push(file.name);return {frames:structuredClone(frames),aspect:16/9,decodedFps:240};},
  saveSession:async s=>records.set(s.id,structuredClone(s)),listSessions:async()=>[...records.values()],deleteSession:async id=>records.delete(id)};
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');new Function(...Object.keys(deps),source)(...Object.values(deps));
 return {$:id=>ids.get(id),calls,records,exported:()=>exported};
}
const fakeFile=side=>({name:side+'.mp4',size:100});
async function upload(ui,side){ui.$(side+'-file').files=[fakeFile(side)];await ui.$(side+'-file').fire('change');}
async function complete(ui){const $=ui.$;for(let i=0;i<5;i++){$('scrub').value=String(1+i*6);await $('scrub').fire('input');await $('phases').children[i].children[2].children[1].fire('click');}
 $('interval-reviewed').checked=true;await $('interval-reviewed').fire('change');
 $('markers-reviewed').checked=true;await $('markers-reviewed').fire('change');await $('analyse').fire('click');
 for(let i=0;i<12;i++)await $('score-items').children[i].querySelectorAll('.score-options')[0].children[i%2].fire('click');}
test('single-sided and bilateral processing starts with the first file and preserves the other side',async()=>{
 for(const sides of [['left'],['right'],['left','right']]){const ui=mount();for(const side of sides)await upload(ui,side);assert.equal(ui.$('process').disabled,false);assert.equal(ui.$('process').textContent,sides.length===2?'Process both videos':`Process ${sides[0]} video`);await ui.$('process').fire('click');assert.deepEqual(ui.calls,sides.map(s=>s+'.mp4'));assert.equal(ui.$('results').hidden,false);}
 const ui=mount();await upload(ui,'left');await ui.$('process').fire('click');await upload(ui,'right');await ui.$('process').fire('click');assert.deepEqual(ui.calls,['left.mp4','right.mp4']);
});
test('confirmed-frame analysis unlocks scoring; scores save, export, and invalidate after a point edit',async()=>{
 const ui=mount(),$=ui.$;await upload(ui,'left');await $('process').fire('click');assert.equal($('score-items').children[0].querySelectorAll('.score-options')[0].children[0].disabled,true);await complete(ui);
 assert.equal($('score-progress').textContent,'12 of 12');assert.equal($('summary').children[0].children[1].textContent,'6');assert.equal($('summary').children[2].children[1].textContent,'—');
 $('athlete').value='QA-ONLY';await $('athlete').fire('input');await $('save').fire('click');assert.equal(ui.records.size,1);const record=[...ui.records.values()][0];assert.equal(record.clips.left.file,undefined);assert.equal(scoring.summary(record.clips.left).total,6);assert.equal(Object.keys(record.clips.left.snapshots).length,5);
 await $('export').fire('click');assert.match(await ui.exported().text(),/QA-ONLY/);
 $('joint').value='knee';$('joint-side').value='left';await $('preview').fire('click',{clientX:320,clientY:200});assert.equal($('score-progress').textContent,'0 of 12');assert.equal($('summary').children[0].children[1].textContent,'—');assert.equal($('phase-progress').textContent,'5 of 5');assert.equal($('analyse').disabled,true);assert.equal($('interval-reviewed').checked,true);
});
test('service worker precaches every bundled dependency and isolates its cache from H-Test',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');const files=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);for(const f of files)assert.ok(existsSync(new URL('../'+f.split('?')[0],import.meta.url)),f);assert.match(sw,/lihps-sprint-mechanics-/);assert.doesNotMatch(sw,/askling/);assert.ok(files.includes('vendor/pose_landmarker_full.task'));assert.ok(files.includes('vendor/mediabunny.mjs'));
});

test('cached analysis never rescans video and reanalysis preserves examiner decisions',async()=>{
 const ui=mount(),$=ui.$;await upload(ui,'right');await $('process').fire('click');await complete(ui);
 await $('analyse').fire('click');assert.deepEqual(ui.calls,['right.mp4']);assert.equal($('score-progress').textContent,'12 of 12');
 $('athlete').value='QA-REANALYSE';await $('athlete').fire('input');await $('save').fire('click');
 const c=[...ui.records.values()][0].clips.right;assert.ok(c.analysis);assert.equal(Object.keys(c.analysis.suggestions).length,12);assert.equal(Object.keys(c.scoreReview).length,12);
 $('joint').value='ref:c7';await $('preview').fire('click',{clientX:300,clientY:70});assert.equal($('phase-progress').textContent,'5 of 5');assert.equal($('score-progress').textContent,'0 of 12');
 assert.equal($('reset-frame').disabled,false);await $('reset-frame').fire('click');assert.equal($('reset-frame').disabled,true);
});

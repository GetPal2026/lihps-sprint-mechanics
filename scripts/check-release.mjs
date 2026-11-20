import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://example.github.io/lihps-sprint-mechanics/';
const fail=message=>{throw new Error(message);};
async function asset(reference,from='index.html'){
  if(/^(https?:|data:|mailto:|#)/.test(reference))return;
  if(reference.startsWith('/'))fail(`Root-relative URL would escape the repository: ${reference}`);
  const url=new URL(reference,new URL(from,base));
  if(!url.href.startsWith(base))fail(`URL escapes the repository: ${reference}`);
  const relative=decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
  try{await stat(path.join(root,relative));}catch{fail(`Missing asset: ${reference} in ${from}`);}
}
const html=await readFile(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))await asset(m[1]);
for(const file of ['app.js','analysis.js','scoring.js','media.js','storage.js','sw.js']){
  const source=await readFile(path.join(root,file),'utf8');
  execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
  for(const m of source.matchAll(/from\s+['"]([^'"]+)['"]|new URL\(['"]([^'"]+)['"]/g))await asset(m[1]??m[2],file);
}
const sw=await readFile(path.join(root,'sw.js'),'utf8');
for(const m of sw.matchAll(/'\.\/([^']*)'/g))await asset('./'+m[1],'sw.js');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));
for(const key of ['id','scope','start_url'])if(manifest[key]!=='./')fail(`Manifest ${key} must remain repository-relative.`);
for(const icon of manifest.icons)await asset(icon.src,'manifest.webmanifest');
await stat(path.join(root,'.nojekyll'));
for(const file of ['vendor/MEDIAPIPE-LICENSE.txt','vendor/MEDIABUNNY-LICENSE.txt'])await stat(path.join(root,file));

const files=[];
async function inventory(directory=''){
  for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){
    if(['.git','node_modules','.DS_Store','SHA256SUMS.txt'].includes(entry.name))continue;
    const relative=path.posix.join(directory,entry.name);
    if(entry.isSymbolicLink())fail(`Symlinks are not part of the release: ${relative}`);
    if(entry.isDirectory())await inventory(relative);else if(entry.isFile())files.push(relative);
  }
}
await inventory();files.sort();
const lines=[];
for(const file of files){
  if(/(?:^|\/)(?:\.openai|\.codex|\.agents|\.env(?:\..*)?)$|\.(?:mov|mp4|csv|pdf|zip|tar\.gz)$/i.test(file))fail(`Unexpected private or generated file: ${file}`);
  const data=await readFile(path.join(root,file));
  if(data.length>=25*1024*1024)fail(`File exceeds the browser-upload limit: ${file}`);
  if(/\.(?:js|mjs|html|json|md|txt)$/.test(file)&&/(?:\/Users\/|\/private\/var\/|appg(?:prj|ver)_|github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(data.toString()))fail(`Private path, hosting identifier or credential pattern in ${file}`);
  lines.push(`${createHash('sha256').update(data).digest('hex')}  ${file}`);
}
if(files.length+1>100)fail('The release exceeds one GitHub browser-upload batch.');
const checksums=lines.join('\n')+'\n';
if(process.argv.includes('--write-checksums'))await writeFile(path.join(root,'SHA256SUMS.txt'),checksums);
else if(await readFile(path.join(root,'SHA256SUMS.txt'),'utf8')!==checksums)fail('Release files differ from SHA256SUMS.txt. Run npm run checksum after reviewing changes.');
console.log(`Release verified: ${files.length+1} files; relative assets, script syntax, licences, upload limits and SHA-256 inventory checked.`);

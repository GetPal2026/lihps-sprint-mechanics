const DB='lihps-sprint-mechanics-v1';
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('sessions',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('sessions',mode);let result;const req=action(tx.objectStore('sessions'));req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Local storage write failed'));});}finally{db.close();}}
export const saveSession=session=>transaction('readwrite',store=>store.put(session));
export const listSessions=()=>transaction('readonly',store=>store.getAll());
export const deleteSession=id=>transaction('readwrite',store=>store.delete(id));

"use strict";
const vm=require("node:vm"),fs=require("node:fs"),assert=require("node:assert/strict");
const nodes=new Map();
function el(id){if(!nodes.has(id)){const listeners={};nodes.set(id,{id,value:"",textContent:"",classList:{toggle:()=>{}},addEventListener:(type,fn)=>{listeners[type]=fn},async click(){await listeners.click?.()}})}return nodes.get(id)}
const callbacks={};
let calls=[];
let existing=false,serverRevision='"0"',serverData=null;
const fetch=async (url,options)=>{
  calls.push({url,options});
  if(options.method==="GET"){
    if(!existing)return {status:404,ok:false,headers:{get:()=>'"0"'},json:async()=>({error:"empty"})};
    return {status:200,ok:true,headers:{get:()=>serverRevision},json:async()=>serverData};
  }
  if(options.method==="PUT"){
    if(options.headers["If-Match"]!==serverRevision)return {status:409,ok:false,headers:{get:()=>serverRevision}};
    serverData=JSON.parse(options.body);existing=true;serverRevision='"abc123"';
    return {status:200,ok:true,headers:{get:()=>serverRevision}};
  }
  throw Error("Unexpected method");
};
const Eco={
 data:{groups:["7-A"],students:[{id:"EST-001",name:"Demo",groups:["7-A"]}],exams:[],grades:[]},
 $:el,renderAll:()=>{},setEditor:()=>{},save:()=>{},onLocalChange:null
};
const context={window:{Eco},document:{addEventListener:(name,fn)=>callbacks[name]=fn},fetch,URL,btoa,unescape,encodeURIComponent,setTimeout:(fn,ms)=>1,clearTimeout:()=>{},confirm:()=>true,JSON,console};
vm.createContext(context);vm.runInContext(fs.readFileSync("sync.js","utf8"),context,{filename:"sync.js"});
callbacks.DOMContentLoaded();
(async()=>{
  el("sync-url").value="https://servidor.ejemplo.co";
  el("sync-user").value="docente";
  el("sync-password").value="clave-local-de-prueba";
  await el("sync-connect").click();
  assert.match(el("sync-status").textContent,/Conexión correcta/);
  assert.equal(calls[0].options.headers.Authorization, "Basic "+btoa("docente:clave-local-de-prueba"),"pass captured before password cleared");
  await el("sync-upload").click();
  assert.match(el("sync-status").textContent,/sincronizados/);
  assert.deepEqual(serverData.students,Eco.data.students);
  Eco.data.groups.push("7-B");Eco.onLocalChange();
  await el("sync-upload").click();
  assert.deepEqual(serverData.groups,["7-A","7-B"]);
  serverRevision='"actualizacion-externa"';
  Eco.data.groups.push("7-C");Eco.onLocalChange();
  await el("sync-upload").click();
  assert.match(el("sync-status").textContent,/CONFLICTO/);
  assert.deepEqual(serverData.groups,["7-A","7-B"]);
  await el("sync-disconnect").click();
  console.log("OK · sincronización Java cliente: autenticación en memoria, actualización, ETag y conflicto.");
})().catch(e=>{console.error(e);process.exitCode=1});

"use strict";
// Prueba del flujo profesional del escáner sin almacenar datos personales reales.
const vm=require("node:vm");
const fs=require("node:fs");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const nodes=new Map();
function element(name) {
  if(!nodes.has(name))nodes.set(name,{
    id:name,textContent:"",innerHTML:"",value:"",
    style:{},className:"",
    classList:{add(){},remove(){},toggle(){}},
    getContext(){throw Error("No canvas for "+name)},
    querySelectorAll(){return []},
  });
  return nodes.get(name);
}
const context={
  window:{},document:{getElementById:element},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  crypto,console,navigator:{vibrate:()=>true},
  setTimeout:()=>1,clearTimeout:()=>{},
  confirm:()=>true,
  Uint8Array,Uint8ClampedArray,Int32Array,Date,Math,Number,Object,String,Array,JSON,Set,Map,Error,
};
vm.createContext(context);
for(const f of ["state.js","exam.js","scan.js"])vm.runInContext(fs.readFileSync(f,"utf8"),context,{filename:f});
const E=context.window.Eco;
E.renderReview=()=>{};
E.renderGradebook=()=>{};
const q={id:"q1",type:"single",prompt:"Choose apple",image:"",options:["Apple","Banana","Pear","Cherry"],correct:[0],answers:[],weight:null,mode:"either"};
const ex={id:"e1",revision:"v1",group:"7-A",title:"Vocabulary quiz 1",subject:"Inglés",year:2026,date:"2026-11-13",questions:[q],variations:{s1:{revision:"v1",order:["q1"],choices:{q1:[0,1,2,3]}}}};
const st={id:"s1",name:"Student Example",groups:["7-A"]};
E.data.exams.push(ex);E.data.students.push(st);E.data.groups.push("7-A");
const w=420,h=594,px=new Uint8ClampedArray(w*h*4);
for(let i=0;i<px.length;i+=4)px[i]=px[i+1]=px[i+2]=px[i+3]=255;
function dot(x,y){if(x<0||y<0||x>=w||y>=h)return;const k=(y*w+x)*4;px[k]=px[k+1]=px[k+2]=0}
for(const [xx,yy] of [[16,16],[388,16],[16,562],[388,562]])for(let dy=0;dy<16;dy++)for(let dx=0;dx<16;dx++)dot(xx+dx,yy+dy);
for(let a=0;a<4;a++){
  const cx=Math.round((43+a*12+3.5)*2),cy=Math.round((53+3.5)*2);
  for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){
    const radius=Math.hypot(dx,dy);
    if((radius>=6&&radius<=7)||(a===0&&radius<6))dot(cx+dx,cy+dy)
  }
}
const img={width:w,height:h,data:px};
const canvas={width:w,height:h,getContext:()=>({getImageData:()=>img})};
const qr=JSON.stringify({app:"EN1",e:ex.id,s:st.id,r:ex.revision,t:"omr",p:0});
(async()=>{
  const first=await E.processCanvas(canvas,qr);
  assert.equal(first.kind,"success","first scan recognized");
  assert.equal(first.grade,5,"correct grade calculated");
  assert.equal(E.data.grades.length,1,"one record per exam and student");
  assert.equal(E.data.grades[0].scannedPages.length,1,"page marked as scanned");
  assert.equal(element("scan-count").textContent,"1","session count incremented");
  assert.equal(element("scan-ack-student").textContent,st.name,"student name displayed");
  assert.equal(element("scan-ack-grade").textContent,"5,00 / 5,00","grade confirmed to teacher");
  const second=await E.processCanvas(canvas,qr);
  assert.equal(second.kind,"repeat","duplicate detected");
  assert.equal(E.data.grades.length,1,"same exam does not add a second grade");
  assert.equal(element("scan-count").textContent,"1","repeat not counted");
  assert.equal(element("scan-ack-label").textContent,"Hoja ya escaneada","duplicate warning visible");
  E.allowRescan();
  assert.equal(E.data.grades[0].scannedPages.length,0,"authorized rescan removes lock");
  const third=await E.processCanvas(canvas,qr);
  assert.equal(third.kind,"success","authorized rescan accepted");
  assert.equal(E.data.grades.length,1,"re-scanning never creates duplicate record");
  console.log("OK · 13 verificaciones: escáner, estudiante, nota, aviso, duplicados y reescaneo controlado.");
})().catch(err=>{console.error(err);process.exitCode=1});

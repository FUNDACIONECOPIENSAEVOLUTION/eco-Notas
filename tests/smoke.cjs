"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}},crypto,console,Date,Math,Uint8Array,Uint8ClampedArray,Int32Array,Number,Object,String,Array,JSON,RegExp,Set,Map,Error,parseFloat,parseInt,isNaN};
vm.createContext(context);
for(const file of ["state.js","exam.js","scan.js"])vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
const E=context.window.Eco;
const questions=[
{id:"q1",type:"single",prompt:"Color?",image:"",options:["Blue","Green","Red","Gray"],correct:[0],answers:[],weight:null,mode:"either"},
{id:"q2",type:"short",prompt:"English for manzana?",image:"",options:[],correct:[],answers:["apple","an apple"],weight:null,mode:"either"}];
const ex={id:"e1",revision:"rev1",subject:"Inglés",group:"7-A",year:2026,date:"2026-11-13",title:"Quiz",questions,variations:{}};
const st={id:"s1",name:"Demo Uno",groups:["7-A"]};
E.data.groups.push("7-A");E.data.students.push(st);E.data.exams.push(ex);
E.ensureVariations(ex);
assert.equal(ex.variations.s1.order.length,2);
assert.equal(ex.variations.s1.choices.q1.length,4);
const w=E.weights(ex);assert.equal(w.q1,2.5);assert.equal(w.q2,2.5);
assert.equal(E.norm("Ápple"),"apple");
ex.questions[0].weight=3;assert.equal(E.weights(ex).q1,3.75);assert.equal(E.weights(ex).q2,1.25);
ex.questions[0].weight=null;
ex.variations.s1={revision:"rev1",order:["q1","q2"],choices:{q1:[0,1,2,3],q2:[]}};
const width=420,height=594,rgba=new Uint8ClampedArray(width*height*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=rgba[i+1]=rgba[i+2]=rgba[i+3]=255}
function black(x,y){if(x<0||y<0||x>=width||y>=height)return;const i=(y*width+x)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0}
for(const [x,y] of [[16,16],[388,16],[16,562],[388,562]])for(let dy=0;dy<16;dy++)for(let dx=0;dx<16;dx++)black(x+dx,y+dy);
for(let k=0;k<4;k++){const cx=Math.round((43+k*12+3.5)*2),cy=Math.round((53+3.5)*2);for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){const r=Math.hypot(x,y);if((r>=6&&r<=7)||(k===0&&r<6))black(cx+x,cy+y)}}
const image={width,height,data:rgba};const canvas={width,height,getContext:()=>({getImageData:()=>image})};
const corners=E.findFiducials(canvas);assert.equal(corners.length,4);
const H=E.homography(corners);const omr=E.decodeChoices(ex,st,"omr",0,image,H);
assert.equal(omr.q1.detected,"A");assert.equal(omr.q1.fraction,1);
E.renderGradebook=null;E.renderReview=null;
const record=E.upsertMarks(ex,st,omr);
assert.equal(record.status,"pending");
assert.equal(record.finalGrade,null);
record.answers.q2={source:"manual",fraction:1,detected:"apple"};
E.calculate(record);assert.equal(record.status,"complete");assert.equal(record.finalGrade,5);
ex.revision="rev2";E.calculate(record);assert.equal(record.status,"obsolete");assert.equal(record.finalGrade,null);
console.log("OK · 12 comprobaciones: versiones, pesos, texto, OMR, notas y revisión.");

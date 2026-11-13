"use strict";
(function(){
const E=window.Eco,{data,$,esc,norm,toast,save,objective}=E;
let stream=null,busy=false,interval=null,lastQR="",stable=0,lastCapture="",lastAt=0;
let ackTimer=null;
const scannedInSession=new Set();
let scanHistory=[];
function pageKey(ex, st, payload){return [ex.id,st.id,ex.revision,payload.t,payload.p].join(":")}
function flash(kind,studentName,scoreText,description){
  const panel=$("scan-ack");
  if(!panel)return;
  clearTimeout(ackTimer);
  panel.className="scan-ack "+(kind==="success"?"":kind);
  $("scan-ack-icon").textContent=kind==="success"?"✓":kind==="repeat"?"↺":kind==="pending"?"!":"×";
  $("scan-ack-label").textContent={success:"Lectura confirmada",pending:"Escaneo registrado",repeat:"Hoja ya escaneada",error:"No se registró"}[kind]||"Estado";
  $("scan-ack-student").textContent=studentName;
  $("scan-ack-grade").textContent=scoreText;
  $("scan-ack-next").textContent=description;
  ackTimer=setTimeout(()=>panel.classList.add("hidden"),kind==="error"?2000:kind==="repeat"?2200:3200);
  if(kind==="success"||kind==="pending")announceTone();
}
function announceTone(){
  try {
    if($("scan-sound")?.checked) {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(Audio){
        const ctx=new Audio();
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type="sine";osc.frequency.setValueAtTime(700,ctx.currentTime);
        osc.frequency.setValueAtTime(950,ctx.currentTime+0.09);
        gain.gain.setValueAtTime(0.0001,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.095,ctx.currentTime+0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.22);
        osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.23);
        osc.onended=()=>ctx.close().catch(()=>{});
      }
    }
    navigator.vibrate?.(85);
  } catch(e){ /* aviso visual sigue disponible */ }
}
function formatGrade(record){return record?.status==="complete" && Number.isFinite(record.finalGrade) ? record.finalGrade.toFixed(2).replace(".",",")+" / 5,00" : "Revisión pendiente"}
function cloudNote(){
  const status=E.getSyncStatus?.();
  if(status?.conflict)return "Conflicto de sincronización. Conserva la copia local y revisa la nube antes de continuar.";
  if(status?.connected)return status?.pending||status?.inflight?"Guardado local; sincronización con la nube pendiente…":"Guardado local. Sincronización con la nube conectada.";
  return "Guardado en este dispositivo. Para usar otro celular conecta la nube o transfiere la copia JSON.";
}
function updateCloudNote(){const el=$("scan-cloud-status");if(el)el.textContent=cloudNote()}
function addHistory(ex,st,record,key,kind){
  if(kind==="repeat")return;
  if(scannedInSession.has(key))return;
  scannedInSession.add(key);
  scanHistory.unshift({key,name:st.name,exam:ex.title,grade:formatGrade(record),pending:record.status!=="complete",time:new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})});
  if(scanHistory.length>8)scanHistory=scanHistory.slice(0,8);
  const count=$("scan-count");if(count)count.textContent=String(scannedInSession.size);
  const list=$("scan-history");if(list)list.innerHTML=scanHistory.map(h=>'<div class="scan-history-item '+(h.pending?"pending":"")+'"><div><strong>'+esc(h.name)+'</strong><small>'+esc(h.exam)+' · '+esc(h.time)+'</small></div><span class="history-grade">'+esc(h.grade)+'</span></div>').join("");
}
function updateResult(ex,st,record,pending,marks,duplicate=false){
  const label=$("scan-record-badge");if(label){
    label.className="status-pill "+(duplicate?"repeat":record.status==="complete"?"done":"review");
    label.textContent=duplicate?"Ya escaneado":record.status==="complete"?"✓ Calificado":"Por revisar";
  }
  $("scan-result").innerHTML='<h4 class="student-result-name">'+esc(st.name)+'</h4><div class="student-result-meta">Código '+esc(st.id)+' · '+esc(ex.group)+'<br>'+esc(ex.subject)+' · '+esc(ex.title)+'</div>'+
    '<div class="grade-score '+(record.status==="complete"?"":"pending")+'"><strong>'+esc(formatGrade(record))+'</strong><span>'+(duplicate?"Esta hoja ya se registró previamente. No se ha creado una segunda nota.":record.status==="complete"?"Examen completo · escala 0 a 5":"Faltan "+pending+" respuestas por revisar o escanear")+'</span></div>'+
    '<div class="result-answers">'+Object.entries(marks||{}).map(([qid,m])=>'<span class="chip">P'+(ex.questions.findIndex(q=>q.id===qid)+1)+': '+esc(m.detected||"Sin marca")+' '+(m.fraction==null?"?":m.fraction?"✓":"✕")+'</span>').join("")+'</div>';
  updateCloudNote();
}

function status(s,error=false){$("scan-status").textContent=s;$("scan-status").classList.toggle("warning",error)}
function cameraReady(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.isSecureContext)}
async function startCamera(){if(!cameraReady())return toast("La cámara necesita HTTPS (o localhost) y permiso del navegador.",true);try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});const v=$("camera-video");v.srcObject=stream;await v.play();v.classList.remove("hidden");$("camera-placeholder").classList.add("hidden");$("camera-overlay").classList.remove("hidden");interval=setInterval(scanLoop,750);$("scan-camera-badge").textContent="● Activa";$("scan-camera-badge").className="status-pill live";status("Cámara activada: muestra la hoja completa, con QR y cuatro esquinas.");}catch(e){toast("No se pudo abrir la cámara: "+e.message,true)}}
function stopCamera(){clearTimeout(ackTimer);$("scan-ack")?.classList.add("hidden");if($("scan-camera-badge")){$("scan-camera-badge").textContent="● Inactiva";$("scan-camera-badge").className="status-pill"}if(interval)clearInterval(interval);interval=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$("camera-video").classList.add("hidden");$("camera-placeholder").classList.remove("hidden");$("camera-overlay").classList.add("hidden");status("Cámara detenida.")}
function canvasFromVideo(){const v=$("camera-video");if(v.readyState<2)return null;const c=$("scan-canvas");const scale=Math.min(1,1000/v.videoWidth);c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext("2d",{willReadFrequently:true}).drawImage(v,0,0,c.width,c.height);return c}
function findQR(c){if(!window.jsQR)throw Error("El lector QR no está disponible; comprueba la conexión.");const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,c.width,c.height);const result=jsQR(d.data,d.width,d.height,{inversionAttempts:"attemptBoth"});return result?.data||null}
async function scanLoop(){if(busy)return;const c=canvasFromVideo();if(!c)return;let qr;try{qr=findQR(c)}catch(e){status(e.message,true);stopCamera();return}if(!qr){stable=0;lastQR="";return}if(qr===lastQR)stable++;else{lastQR=qr;stable=1}if(stable<2)return;const key=qr;if(key===lastCapture&&Date.now()-lastAt<9500)return;lastCapture=key;lastAt=Date.now();const copy=document.createElement("canvas");copy.width=c.width;copy.height=c.height;copy.getContext("2d").drawImage(c,0,0);busy=true;try{await processCanvas(copy,qr)}finally{busy=false;stable=0}}
async function scanUpload(file){if(!file)return;try{const bitmap=await createImageBitmap(file);const c=document.createElement("canvas");const scale=Math.min(1,1400/bitmap.width,1900/bitmap.height);c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));c.getContext("2d").drawImage(bitmap,0,0,c.width,c.height);bitmap.close();busy=true;await processCanvas(c,findQR(c))}catch(e){console.error(e);status("Archivo no procesado: "+e.message,true)}finally{busy=false;$("scan-upload").value=""}}
/* Encuentra cuadrados negros sólidos en las cuatro esquinas.
   Rechaza hojas incompletas: nunca produce notas inventadas a partir de un QR aislado. */
function findFiducials(src){const ctx=src.getContext("2d",{willReadFrequently:true});const {width:w,height:h}=src;const p=ctx.getImageData(0,0,w,h).data;const total=w*h;const dark=new Uint8Array(total),visit=new Uint8Array(total);const maxSide=Math.min(w,h)*0.18;for(let i=0;i<total;i++){let t=i*4;dark[i]=(p[t]*.30+p[t+1]*.59+p[t+2]*.11<83)?1:0}
const queue=new Int32Array(total);const candidates=[];
for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;if(!dark[i]||visit[i])continue;let lo=0,hi=1,area=0,x0=x,x1=x,y0=y,y1=y,boundary=false;queue[0]=i;visit[i]=1;while(lo<hi){const idx=queue[lo++],px=idx%w,py=Math.floor(idx/w);area++;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;if(px<2||py<2||px>=w-2||py>=h-2)boundary=true;
for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=px+dx,yy=py+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(dark[j]&&!visit[j]){visit[j]=1;queue[hi++]=j}}}
const ww=x1-x0+1,hh=y1-y0+1,fill=area/(ww*hh);if(boundary||ww<7||hh<7||ww>maxSide||hh>maxSide||ww/hh<.61||ww/hh>1.57||fill<.78||area<48)continue;
candidates.push({x:(x0+x1)/2,y:(y0+y1)/2,size:(ww+hh)/2,area})}
if(candidates.length<4)throw Error("No veo las cuatro marcas cuadradas de las esquinas. Aleja un poco el celular, usa buena luz y encuadra toda la hoja.");
const top=candidates.sort((a,b)=>b.area-a.area).slice(0,28);let best=null,bestScore=-Infinity;
for(const a of top)for(const b of top)for(const c of top)for(const d of top){if(a===b||a===c||a===d||b===c||b===d||c===d)continue;if(b.x<=a.x||c.y<=a.y||d.x<=c.x||d.y<=b.y)continue;
const avg=(a.size+b.size+c.size+d.size)/4;if(Math.min(a.size,b.size,c.size,d.size)/Math.max(a.size,b.size,c.size,d.size)<.47)continue;
const width=Math.hypot(b.x-a.x,b.y-a.y),height=Math.hypot(c.x-a.x,c.y-a.y);if(width<w*.18||height<h*.25)continue;
const ratio=width/height;if(ratio<.30||ratio>1.35)continue;const diag=Math.hypot(d.x-a.x,d.y-a.y),ideal=Math.hypot(width,height);
const parallelogram=Math.hypot(d.x-(b.x+c.x-a.x),d.y-(b.y+c.y-a.y))/Math.max(width,height);
const shapePenalty=Math.abs(diag/ideal-1)+parallelogram;
const score=width*height/Math.max(w*h,.1)*140-shapePenalty*110-Math.abs(Math.log(avg/Math.max(a.size,1)))*10;
if(score>bestScore){bestScore=score;best=[a,b,c,d]}}
if(!best||bestScore<0)throw Error("Las marcas no forman una hoja completa. Corrige perspectiva e iluminación.");
return best}
function homography(corners){const src=[[12,12],[198,12],[12,285],[198,285]];let A=[];for(let i=0;i<4;i++){const [x,y]=src[i],u=corners[i].x,v=corners[i].y;A.push([x,y,1,0,0,0,-u*x,-u*y,u]);A.push([0,0,0,x,y,1,-v*x,-v*y,v])}
for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;if(Math.abs(A[pivot][i])<1e-10)throw Error("Perspectiva no válida.");[A[i],A[pivot]]=[A[pivot],A[i]];const factor=A[i][i];for(let k=i;k<9;k++)A[i][k]/=factor;for(let j=0;j<8;j++){if(j===i)continue;const f=A[j][i];for(let k=i;k<9;k++)A[j][k]-=f*A[i][k]}}
return A.map(r=>r[8])}
function map(H,x,y){const f=H[6]*x+H[7]*y+1;return {x:(H[0]*x+H[1]*y+H[2])/f,y:(H[3]*x+H[4]*y+H[5])/f}}
function grayAt(img,x,y){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=img.width||y>=img.height)return 255;const k=(y*img.width+x)*4;return img.data[k]*.30+img.data[k+1]*.59+img.data[k+2]*.11}
function blackRatio(img,H,x,y){let dark=0,total=0;for(let dy=-2;dy<=2;dy+=.44)for(let dx=-2;dx<=2;dx+=.44){if(dx*dx+dy*dy>4.2)continue;const p=map(H,x+dx,y+dy);if(grayAt(img,p.x,p.y)<127)dark++;total++}return dark/total}
function decodeChoices(ex,st,kind,page,img,H){const v=ex.variations[st.id];const ordered=v.order.map(id=>ex.questions.find(q=>q.id===id)).filter(Boolean).filter(q=>objective(q.type));const questions=ordered.slice(page*40,(page+1)*40);if(!questions.length)throw Error("Esta hoja no coincide con las preguntas OMR del examen.");const output={};
for(let i=0;i<questions.length;i++){const q=questions[i],col=Math.floor(i/20),row=i%20,y=53+row*11;const ratios=[];for(let j=0;j<v.choices[q.id].length;j++)ratios.push(blackRatio(img,H,43+col*96+j*12+3.5,y+3.5));
const filled=ratios.map((r,j)=>({r,j})).filter(x=>x.r>.36).map(x=>x.j);
const doubtful=ratios.some(r=>r>=.13&&r<=.36);
const answer=filled.map(j=>v.choices[q.id][j]).sort((a,b)=>a-b);
const correct=[...q.correct].sort((a,b)=>a-b),isRight=answer.length===correct.length&&answer.every((x,k)=>x===correct[k]);
if(doubtful||(q.type!=="multi"&&filled.length>1))output[q.id]={fraction:null,source:"omr",detected:filled.map(n=>"ABCD"[n]).join(",")||"Sin marca",confidence:null,reason:"Marcas ambiguas o múltiples"};
else output[q.id]={fraction:isRight?1:0,source:"omr",detected:filled.map(n=>"ABCD"[n]).join(",")||"En blanco",confidence:Math.round(100*Math.max(...ratios)),reason:isRight?"Correcta":"Incorrecta"}}
return output}
function cropRect(img,H,mm){const w=1110,h=210,out=document.createElement("canvas");out.width=w;out.height=h;const ctx=out.getContext("2d",{willReadFrequently:true});const d=ctx.createImageData(w,h),[x0,y0,x1,y1]=mm;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=map(H,x0+(x+.5)/w*(x1-x0),y0+(y+.5)/h*(y1-y0));const v=grayAt(img,p.x,p.y);const val=Math.max(0,Math.min(255,(v-100)*1.35+105));const k=(y*w+x)*4;d.data[k]=d.data[k+1]=d.data[k+2]=val;d.data[k+3]=255}ctx.putImageData(d,0,0);return out}
async function decodeText(ex,st,page,img,H){const v=ex.variations[st.id],questions=v.order.map(id=>ex.questions.find(q=>q.id===id)).filter(Boolean).filter(q=>!objective(q.type)).slice(page*4,(page+1)*4);if(!questions.length)throw Error("Página OCR no encontrada.");const marks={};for(let k=0;k<questions.length;k++){const q=questions[k];status("Leyendo escritura de "+st.name+" · respuesta "+(k+1)+"/"+questions.length+"…");let detected="",confidence=0,reason="Requiere revisión docente";try{if(!window.Tesseract)throw Error("OCR no disponible");const crop=cropRect(img,H,[20,68+k*54,187,94+k*54]);const lang=/ingles|english/i.test(norm(ex.subject))?"eng":"spa";const output=await Tesseract.recognize(crop,lang);detected=(output.data.text||"").replace(/\s+/g," ").trim();confidence=Math.round(output.data.confidence||0);if(!detected)reason="No se reconoció texto; revisar hoja."}catch(e){reason="Error del motor OCR: "+e.message}
const matches=q.type==="short"&&q.answers.some(a=>norm(a)===norm(detected));const canAuto=q.type==="short"&&q.mode!=="handwritten"&&matches&&confidence>=88;
marks[q.id]={fraction:canAuto?1:null,source:"ocr",detected,confidence,reason:canAuto?"Coincidencia exacta con clave; OCR alta confianza":reason};}
return marks}
async function processCanvas(canvas,raw){try{status("QR detectado. Comprobando identificación…");if(!raw)throw Error("No se detectó ningún QR de Eco-Notas.");let payload;try{payload=JSON.parse(raw)}catch{throw Error("Código QR desconocido.")}if(payload.app!=="EN1"||!["omr","text"].includes(payload.t)||!Number.isInteger(payload.p))throw Error("QR no pertenece a una hoja de respuestas Eco-Notas.");const ex=E.exam(payload.e),st=E.student(payload.s);if(!ex||!st||!E.groupsOf(st).includes(ex.group))throw Error("Estudiante o examen no está registrado en este dispositivo. Importa primero la copia de datos.");if(ex.revision!==payload.r)throw Error("Versión impresa vencida: este examen fue modificado. Reimprime las hojas.");E.ensureVariations(ex);
const uniquePage=pageKey(ex,st,payload);
const previous=data.grades.find(r=>r.examId===ex.id&&r.studentId===st.id&&r.revision===ex.revision);
if(previous?.scannedPages?.includes(uniquePage)){
  const outstanding=ex.questions.filter(q=>typeof previous.answers?.[q.id]?.fraction!=="number").length;
  updateResult(ex,st,previous,outstanding,{},true);
  flash("repeat",st.name,formatGrade(previous),"Este examen ya fue leído. No se duplicó la nota · Pasa a otra hoja");
  status("Hoja ya escaneada: "+st.name+". Sin duplicar su calificación.");
  return {kind:"repeat",studentId:st.id,examId:ex.id};
}
const pixels=canvas.getContext("2d",{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);status("Buscando marcas de orientación de la hoja…");const corners=findFiducials(canvas);const H=homography(corners);
const marks=payload.t==="omr"?decodeChoices(ex,st,payload.t,payload.p,pixels,H):await decodeText(ex,st,payload.p,pixels,H);
if(!Object.keys(marks).length)throw Error("La hoja no contiene respuestas de este tipo.");
const record=E.upsertMarks(ex,st,marks);
record.scannedPages??=[];
if(!record.scannedPages.includes(uniquePage))record.scannedPages.push(uniquePage);
save(); // Guardar también la identidad de cada página para detectar reescaneos posteriores.
const pending=ex.questions.filter(q=>typeof record.answers?.[q.id]?.fraction!=="number").length;
updateResult(ex,st,record,pending,marks);
const kind=record.status==="complete"?"success":"pending";
addHistory(ex,st,record,uniquePage,kind);
flash(kind,st.name,formatGrade(record),record.status==="complete"
  ?"✓ Nota guardada en este dispositivo · Pasa a la siguiente hoja"
  :"Respuestas leídas; revisión pendiente · Pasa a la siguiente hoja");
status("Hoja guardada: "+st.name+" · "+ex.title+" · "+Object.keys(marks).length+" respuestas · "+(record.status==="complete"?"Nota "+formatGrade(record):pending+" pendientes"));
E.renderReview();
return {kind,studentId:st.id,examId:ex.id,grade:record.finalGrade,pending};
}catch(e){
  console.error(e);
  status("No se guardó la hoja: "+e.message,true);
  flash("error","No se pudo leer","Inténtalo de nuevo","Alinea las esquinas y el QR. No se registró ninguna nota.");
  toast("Escaneo no válido. "+e.message,true);
  return {kind:"error",error:e.message};
}}

function renderReview(){const records=data.grades.filter(g=>g.status!=="obsolete").sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));E.populate("review-record",records.map(g=>{const st=E.student(g.studentId),ex=E.exam(g.examId);return {value:g.examId+"|"+g.studentId,label:(st?.name||g.studentId)+" · "+(ex?.title||"Examen")+" · "+(g.status==="complete"?"Completo":"Pendiente")}}),"Selecciona un registro");const chosen=$("review-record").value;if(!chosen){$("review-list").innerHTML='<p class="muted">Escanea una hoja para mostrar la revisión.</p>';return}const [examId,studentId]=chosen.split("|"),r=data.grades.find(g=>g.examId===examId&&g.studentId===studentId),ex=E.exam(examId);if(!r||!ex)return;const pending=ex.questions.filter(q=>r.answers?.[q.id]?.fraction===null||r.answers?.[q.id]?.fraction===undefined);$("review-list").innerHTML=(!pending.length?'<p class="hint">Todas las preguntas están calificadas. Nota: '+Number(r.finalGrade).toFixed(2)+'/5.</p>':pending.map(q=>{const a=r.answers?.[q.id];return '<div class="question"><strong>'+esc(q.prompt)+'</strong><p class="muted">OCR/OMR: '+esc(a?.detected??"No escaneada")+' · '+esc(a?.reason||"Sin lectura")+'</p><p class="muted">Clave docente: '+esc(objective(q.type)?q.correct.map(n=>q.options[n]).join("; "):q.answers.join("; ")||"Evaluación docente")+'</p><label class="field"><span>Crédito (0 incorrecta, 0.5 parcial, 1 correcta)</span><input data-mark-id="'+esc(q.id)+'" type="number" step="0.1" min="0" max="1" placeholder="Puntaje por revisar"></label></div>'}).join(""))}
function saveReview(){const selected=$("review-record").value;if(!selected)return toast("Selecciona un registro para revisar.",true);const [examId,studentId]=selected.split("|"),ex=E.exam(examId),r=data.grades.find(g=>g.examId===examId&&g.studentId===studentId);if(!ex||!r)return;let count=0;for(const input of $("review-list").querySelectorAll("input[data-mark-id]")){if(input.value.trim()==="")continue;const fraction=Number(input.value);if(!Number.isFinite(fraction)||fraction<0||fraction>1)return toast("Los créditos deben estar entre 0 y 1.",true);const qid=input.dataset.markId;const old=r.answers[qid]||{};r.answers[qid]={...old,fraction,source:"manual",reason:"Revisión del docente",at:new Date().toISOString()};count++}if(!count)return toast("Introduce al menos una revisión.",true);E.calculate(r);save();E.renderGradebook();renderReview();toast(r.status==="complete"?"Nota final "+r.finalGrade.toFixed(2)+"/5 guardada.":count+" respuestas revisadas; quedan pendientes.") }
Object.assign(E,{startCamera,stopCamera,scanUpload,renderReview,saveReview,processCanvas,findFiducials,homography,decodeChoices,formatGrade,pageKey,updateCloudNote});
})();

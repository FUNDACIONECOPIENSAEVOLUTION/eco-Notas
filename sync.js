"use strict";
(function(){
const E=window.Eco, $=E.$;
let endpoint="",authorization="",etag=null,connected=false,conflict=false,busy=false;
let change=0,done=0,timer=null,inflight=false;
function notice(text,error=false){const el=$("sync-status");el.textContent=text;el.classList.toggle("warning",error)}
function status(){return connected?"Conectado a "+endpoint+(conflict?" · CONFLICTO DE VERSIONES":busy?" · sincronizando…":change>done?" · hay cambios por subir":" · sincronizado"):"No hay sesión activa con Java."}
function validURL(str){
  let u;try{u=new URL(str)}catch{throw Error("La URL del servidor no es válida.");}
  const loopback=["localhost","127.0.0.1","::1","[::1]"].includes(u.hostname);
  if(u.protocol!=="https:" && !(loopback&&u.protocol==="http:"))throw Error("Usa HTTPS salvo para pruebas en localhost.");
  if(u.username||u.password||u.search||u.hash)throw Error("Escribe únicamente la URL base del servidor, sin claves ni parámetros.");
  return u.href.replace(/\/+$/,"");
}
function basic(user,pass){return "Basic "+btoa(unescape(encodeURIComponent(user+":"+pass)))}
function checkState(json){if(!json||typeof json!=="object")throw Error("Los datos recibidos no tienen el formato Eco-Notas.");for(const name of ["groups","students","exams","grades"]){if(!Array.isArray(json[name]))throw Error("Falta la sección "+name+" en la copia del servidor.")}}
async function request(method,body,match){
  const headers={Authorization:authorization,Accept:"application/json"};
  if(method==="PUT"){headers["Content-Type"]="application/json";headers["If-Match"]=match}
  const r=await fetch(endpoint+"/api/state",{method,headers,body,cache:"no-store",credentials:"omit",mode:"cors"});
  if(r.status===401)throw Error("Usuario o contraseña incorrectos.");
  if(r.status===403)throw Error("El servidor no autoriza el origen de esta aplicación.");
  return r;
}
function nonempty(){return E.data.students.length||E.data.exams.length||E.data.grades.length||E.data.groups.length}
function applyRemote(remote){
  checkState(remote);
  const local=JSON.stringify({groups:E.data.groups,students:E.data.students,exams:E.data.exams,grades:E.data.grades});
  const latest=JSON.stringify({groups:remote.groups,students:remote.students,exams:remote.exams,grades:remote.grades});
  if(local!==latest&&nonempty()&&!confirm("La información del servidor es distinta de los datos de este navegador. Exporta una copia JSON primero. ¿Quieres REEMPLAZAR los datos locales por los guardados en Java?"))return false;
  busy=true;
  try {
    for(const name of ["groups","students","exams","grades"])E.data[name]=remote[name];
    E.save();
    E.renderAll();
    E.setEditor?.(E.data.exams[0]?.id||null);
  }finally{busy=false}
  return true;
}
async function connect(){
  const url=$("sync-url").value.trim(),user=$("sync-user").value.trim(),password=$("sync-password").value;
  disconnect(false);
  try{
    endpoint=validURL(url);
    if(!user||!password)throw Error("Ingresa el usuario y la contraseña.");
    authorization=basic(user,password);
    notice("Consultando el servidor Java…");
    const response=await request("GET");
    if(response.status===404){
      etag=response.headers.get("ETag")||'"0"';connected=true;conflict=false;
      notice("Conexión correcta: el servidor no tiene datos todavía. Usa «Guardar mis datos en Java» para crear el primer respaldo.");
      return;
    }
    if(!response.ok)throw Error("Error del servidor HTTP "+response.status);
    const remote=await response.json();
    if(!applyRemote(remote)){authorization="";notice("Descarga cancelada. Exporta tu copia antes de conectar.",true);return;}
    etag=response.headers.get("ETag");if(!etag)throw Error("El servidor no devolvió ETag; no es posible sincronizar con seguridad.");
    connected=true;conflict=false;done=change=0;
    notice("Conectado y sincronizado. Las próximas ediciones se subirán automáticamente.");
  }catch(e){authorization="";connected=false;notice("No se pudo conectar: "+e.message,true)}
}
function markChanged(){
  if(!connected||busy||conflict)return;
  change++;
  clearTimeout(timer);
  timer=setTimeout(upload,1200);
  notice(status());
}
async function upload(){
  if(!connected||conflict||busy||inflight){if(!connected)notice("Primero conecta la cuenta del docente.",true);return}
  inflight=true;notice("Subiendo datos al servidor Java…");
  const seen=change;
  try {
    const body=JSON.stringify(E.data);
    const response=await request("PUT",body,etag);
    if(response.status===409){conflict=true;notice("CONFLICTO: este servidor tiene cambios de otro dispositivo. Exporta tu copia JSON local antes de descargar la versión remota. Nada se sobrescribió.",true);return}
    if(response.status===413)throw Error("Los datos exceden el límite de 8 MB. Reduce imágenes y haz una copia.");
    if(!response.ok)throw Error("Error HTTP "+response.status+" al guardar.");
    etag=response.headers.get("ETag");if(!etag)throw Error("El servidor no entregó un ETag.");
    done=seen;notice("Datos guardados y sincronizados con el servidor Java.");
  }catch(e){notice("No se sincronizó: "+e.message+" Puedes volver a pulsar «Guardar mis datos».",true)}
  finally {
    inflight=false;
    if(connected&&!conflict&&change>done){clearTimeout(timer);timer=setTimeout(upload,1200)}
  }
}
async function downloadFromServer(){
  if(!authorization||!endpoint)return notice("Conéctate primero al servidor Java.",true);
  try{
    notice("Descargando copia del servidor…");
    const response=await request("GET");
    if(response.status===404)return notice("El servidor todavía no contiene datos.",true);
    if(!response.ok)throw Error("Error HTTP "+response.status);
    const remote=await response.json();
    if(!applyRemote(remote))return notice("Descarga cancelada. No se modificaron los datos locales.",true);
    etag=response.headers.get("ETag");
    connected=!!etag;conflict=false;change=done=0;
    notice("Datos descargados. Puedes continuar trabajando.");
  }catch(e){notice(e.message,true)}
}
function disconnect(show=true){
  clearTimeout(timer);
  endpoint="";authorization="";etag=null;connected=false;conflict=false;change=done=0;
  $("sync-password").value="";
  if(show)notice("Desconectado. No se guarda ninguna contraseña en el navegador.");
}
function init(){
  ["sync-connect","sync-upload","sync-download","sync-disconnect"].forEach(name=>{if(!$(name))throw Error("Falta el control "+name)});
  $("sync-connect").addEventListener("click",connect);
  $("sync-upload").addEventListener("click",upload);
  $("sync-download").addEventListener("click",downloadFromServer);
  $("sync-disconnect").addEventListener("click",()=>disconnect());
  E.onLocalChange=markChanged;
  notice(status());
}
document.addEventListener("DOMContentLoaded",init);
})();

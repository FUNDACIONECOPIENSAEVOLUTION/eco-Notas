"use strict";
(function(){
const E=window.Eco, $=E.$;
function on(id,event,handler){$(id).addEventListener(event,handler)}
function init(){
document.querySelectorAll("nav button[data-tab]").forEach(b=>b.addEventListener("click",()=>{if(!b.dataset.tab.includes("scan"))E.stopCamera();E.showTab(b.dataset.tab)}));
on("home-scan","click",()=>{
  E.showTab("scan");
  const available=E.data.students.length && E.data.exams.length;
  if (!available) {
    E.toast("Antes de escanear importa un respaldo de estudiantes y exámenes o conecta la nube.",true);
  }
});
on("home-admin","click",()=>E.showTab("students"));
on("home-import","click",()=>E.showTab("backup"));
on("home-cloud","click",()=>E.showTab("sync"));
on("add-group","click",E.addGroup);on("group-select","change",E.renderStudents);on("add-student","click",E.addStudentUI);
on("students-body","click",e=>{const b=e.target.closest("[data-remove]");if(b)E.removeStudent(b.dataset.remove)});
on("students-file","change",async e=>{await E.importFile(e.target.files[0]);e.target.value=""});
on("download-template","click",()=>E.download("\uFEFFCódigo;Nombre;Apellidos;Curso\r\nEST-001;María;Pérez;7-A\r\nEST-002;Juan;Gómez;7-A\r\n","EcoNotas_plantilla_estudiantes.csv","text/csv;charset=utf-8"));
on("new-exam","click",E.createExam);on("save-exam","click",E.saveExam);on("delete-exam","click",E.deleteExam);on("exam-select","change",e=>E.setEditor(e.target.value));
on("q-type","change",E.updateType);on("q-image","change",async e=>await E.onImage(e.target.files[0]));on("add-question","click",E.addQuestion);
on("questions-list","click",e=>{const edit=e.target.closest("[data-edit-q]"),del=e.target.closest("[data-delete-q]");if(edit)E.editQuestion(edit.dataset.editQ);else if(del&&confirm("¿Eliminar esta pregunta?"))E.deleteQuestion(del.dataset.deleteQ)});
on("print-exam","change",E.renderPrintControls);on("prepare-print","click",E.preparePrint);on("print-button","click",()=>{if(E.preparePrint())setTimeout(()=>window.print(),200)});
on("start-camera","click",E.startCamera);on("stop-camera","click",E.stopCamera);on("scan-upload","change",e=>E.scanUpload(e.target.files[0]));
on("review-record","change",E.renderReview);on("save-review","click",E.saveReview);
on("grades-group","change",E.renderGradebook);on("grades-subject","change",E.renderGradebook);on("grades-year","change",E.renderGradebook);
on("export-xlsx","click",E.exportXLSX);on("export-csv","click",E.exportCSV);
on("export-backup","click",E.exportBackup);on("import-backup","change",async e=>{await E.importBackup(e.target.files[0]);e.target.value=""});
on("load-demo","click",E.loadDemo);on("clear-data","click",()=>{if(!confirm("¿Borrar TODOS los cursos, estudiantes, preguntas y notas de este navegador?"))return;if(!confirm("Confirma nuevamente: esta acción no se puede deshacer sin una copia JSON."))return;localStorage.removeItem("econotas-v1-data");location.reload()});
E.updateType();E.renderAll();if(E.data.exams.length)E.setEditor(E.data.exams[0].id);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"") ||
  (typeof window.matchMedia==="function" && window.matchMedia("(max-width: 850px) and (pointer: coarse)").matches);
E.showTab(isMobile?"home":"students");
const count=E.data.students.length,exams=E.data.exams.length;
$("home-device-label").textContent=isMobile?"📱 Modo celular":"🖥️ Modo computador";
$("home-setup-status").textContent=(count&&exams)
  ? ("Listo: "+count+" estudiantes y "+exams+" exámenes cargados en este navegador. Puedes escanear.")
  : "Sin datos de examen en este dispositivo. Importa una copia JSON del computador o conecta una nube antes de escanear.";
document.addEventListener("visibilitychange",()=>{if(document.hidden)E.stopCamera()});
}
document.addEventListener("DOMContentLoaded",init);
})();

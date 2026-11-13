import assert from "node:assert/strict";
import worker from "../cloudflare/worker.mjs";

let stored = null, etag = null, count = 0;
const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() {
        if (sql.includes("SELECT state, etag")) return stored===null ? null : {state:stored,etag};
        if (sql.includes("SELECT etag")) return stored===null ? null : {etag};
        throw Error("Unknown SELECT");
      },
      async run() {
        if (sql.startsWith("INSERT")) {
          if (stored!==null) return {meta:{changes:0}};
          [stored,etag]=args;
          return {meta:{changes:1}};
        }
        if (sql.startsWith("UPDATE")) {
          if (stored===null || etag!==args[2]) return {meta:{changes:0}};
          [stored,etag]=args.slice(0,2);
          return {meta:{changes:1}};
        }
        throw Error("Unknown SQL");
      }
    };
  }
};
const env={DB,ECONOTAS_USER:"docente",ECONOTAS_PASSWORD:"un-test-de-contrasena-segura",ECONOTAS_ALLOWED_ORIGIN:"https://fundacionecopiensaevolution.github.io"};
const root="https://eco-notas-test.workers.dev/api/state";
const auth="Basic "+Buffer.from(env.ECONOTAS_USER+":"+env.ECONOTAS_PASSWORD).toString("base64");
function request(method="GET",body=null,headers={}){
  return new Request(root,{method,headers:{Origin:env.ECONOTAS_ALLOWED_ORIGIN,Authorization:auth,...headers},body});
}
async function expect(req,status){
  const r=await worker.fetch(req,env);assert.equal(r.status,status);count++;return r;
}
await expect(new Request(root,{method:"GET"}),401);
const empty=await expect(request(),404);
assert.equal(empty.headers.get("ETag"),'"0"');count++;
await expect(request("PUT",'{"groups":[],"students":[],"exams":[],"grades":[]}',{"Content-Type":"application/json"}),428);
const one=JSON.stringify({groups:["7-A"],students:[{id:"EST-1",name:"Ejemplo ficticio"}],exams:[],grades:[]});
const saved=await expect(request("PUT",one,{"If-Match":'"0"',"Content-Type":"application/json"}),200);
const tag=saved.headers.get("ETag");assert.ok(tag && tag.startsWith('"'));count++;
const loaded=await expect(request(),200);assert.deepEqual(await loaded.json(),JSON.parse(one));count++;
await expect(request("PUT",one,{"If-Match":'"0"',"Content-Type":"application/json"}),409);
const two=JSON.stringify({groups:["7-A","7-B"],students:[],exams:[],grades:[]});
await expect(request("PUT",two,{"If-Match":tag,"Content-Type":"application/json"}),200);
await expect(request("PUT",two,{"If-Match":tag,"Content-Type":"application/json"}),409);
await expect(request("PUT","not JSON",{"If-Match":etag,"Content-Type":"application/json"}),400);
await expect(new Request(root,{headers:{Origin:"https://other.example",Authorization:auth}}),403);
const options=await expect(request("OPTIONS",null,{"Access-Control-Request-Method":"PUT"}),204);
assert.equal(options.headers.get("Access-Control-Allow-Origin"),env.ECONOTAS_ALLOWED_ORIGIN);count++;
await expect(request("PUT",JSON.stringify({groups:[],students:[],exams:[],grades:[],extra:"x".repeat(1_500_000)}),{"If-Match":etag,"Content-Type":"application/json"}),413);
const health=await expect(new Request("https://eco-notas-test.workers.dev/api/health"),200);
assert.equal((await health.json()).status,"ok");count++;
console.log("OK · "+count+" validaciones Cloudflare D1: autorización, CORS, creación, ETag, conflicto y tamaño.");

/** Diagnostic cost benchmark. Build datagrid-core first. No product instrumentation is persisted. */
import { performance } from 'node:perf_hooks'
import { Session } from 'node:inspector'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root=process.cwd(), out=resolve(process.env.COST_OUTPUT??'/tmp/affino-cost-audit')
mkdirSync(out,{recursive:true})
const {createAdvancedClientRowModel}=await import(pathToFileURL(resolve(root,'packages/datagrid-core/dist/src/models/clientRowModel.js')))
const {createDataGridColumnModel}=await import(pathToFileURL(resolve(root,'packages/datagrid-core/dist/src/models/columnModel.js')))
const {createDataGridApi}=await import(pathToFileURL(resolve(root,'packages/datagrid-core/dist/src/core/gridApi.js')))
const {createDataGridCore}=await import(pathToFileURL(resolve(root,'packages/datagrid-core/dist/src/core/gridCore.js')))
const sizes=(process.env.COST_SIZES??'1000,5000,20000').split(',').map(Number)
const samples=Number(process.env.COST_SAMPLES??30),warmups=5
const quantile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length*p)-1)]??0
const stats=xs=>({samples:xs.length,medianMs:quantile(xs,.5),p95Ms:xs.length>=20?quantile(xs,.95):null,minMs:Math.min(...xs),maxMs:Math.max(...xs)})
const full={recomputeFilter:true,recomputeSort:true,recomputeGroup:true}
const filter=threshold=>({columnFilters:{},advancedExpression:{kind:'condition',key:'value',operator:'gt',value:threshold,type:'number'}})
function make(n,kind,observed=false){
 const work={active:false,reads:0,readRows:new Set(),byField:{},computes:0,stages:{},events:0,facadeEvents:0,largeArrays:0,largeArraySlots:0}
 const rows=Array.from({length:n},(_,i)=>({id:i,value:i%100,spare:0,g:`g${i%10}`,h:`h${Math.floor(i/10)%10}`,year:2020+i%4,parent:i%8===0?null:i-i%8,path:Array.from({length:8},(_,d)=>`${Math.floor(i/8)}-${d}`)}))
 if(observed)for(const r of rows)for(const field of Object.keys(r)){const v=r[field];Object.defineProperty(r,field,{enumerable:true,configurable:true,get(){if(work.active){work.reads++;work.readRows.add(r.id);work.byField[field]=(work.byField[field]??0)+1}return v}})}
 // id reads inside the getters use this stable closure rather than another accessor.
 if(observed)for(let i=0;i<rows.length;i++){const r=rows[i];for(const field of Object.keys(r)){const descriptor=Object.getOwnPropertyDescriptor(r,field),v=descriptor.get();Object.defineProperty(r,field,{enumerable:true,configurable:true,get(){if(work.active){work.reads++;work.readRows.add(i);work.byField[field]=(work.byField[field]??0)+1}return v}})}}
 const computed=[]
 if(kind==='chain'||kind==='wide'||kind==='dense'){
  const count=kind==='chain'?3:kind==='wide'?32:16
  for(let i=0;i<count;i++){const deps=kind==='chain'?(i?[`computed:f${i-1}`]:['field:value']):kind==='dense'?['field:value',...Array.from({length:i},(_,j)=>`computed:f${j}`)]:['field:value'];computed.push({name:`f${i}`,deps,compute(c){if(work.active)work.computes++;return deps.reduce((s,d)=>s+Number(c.get(d)??0),0)+1}})}
 }
 const options={rows,resolveRowId:r=>r.id,initialComputedFields:computed,projectionStageTimer:(stage,run)=>{const start=performance.now(),result=run(),duration=performance.now()-start;if(work.active){const s=work.stages[stage]??{calls:0,ms:0};s.calls++;s.ms+=duration;work.stages[stage]=s}return{result,duration}}}
 if(kind==='formula')options.initialFormulaFields=[{name:'a',formula:'value*2'},{name:'b',formula:'a+1'},{name:'c',formula:'b*2'}]
 if(kind==='aggregate')Object.assign(options,{initialGroupBy:{fields:['g'],expandedByDefault:true},initialAggregationModel:{columns:[{key:'value',op:'sum'}]}})
 if(kind==='tree')Object.assign(options,{initialTreeData:{mode:'path',getDataPath:r=>r.path,dependencyFields:['path'],expandedByDefault:true},initialAggregationModel:{columns:[{key:'value',op:'sum'}]}})
 const model=createAdvancedClientRowModel(options)
 const columns=createDataGridColumnModel({columns:['value','spare','g','h','year'].map(key=>({key}))})
 let selection=null
 const api=createDataGridApi({core:createDataGridCore({services:{rowModel:{name:'rowModel',model},columnModel:{name:'columnModel',model:columns},selection:{name:'selection',getSelectionSnapshot:()=>selection,setSelectionSnapshot:s=>{selection=s},clearSelection:()=>{selection=null}}}})})
 api.policy.setProjectionMode('excel-like')
 const off=model.subscribe(()=>{if(work.active)work.events++})
 const facadeOff=['rows:changed','projection:recomputed','columns:changed','selection:changed'].map(name=>api.events.on(name,()=>{if(work.active)work.facadeEvents++}))
 return{model,api,columns,rows,work,dispose:async()=>{off();for(const f of facadeOff)f();await api.dispose();model.dispose();columns.dispose()}}
}
const scenarios={
 independent:{kind:'flat',run:(f,i)=>f.model.patchRows([{rowId:0,data:{spare:i+1}}],full)},
 chain3:{kind:'chain',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 formulaChain3:{kind:'formula',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 fanout32:{kind:'wide',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 dense16:{kind:'dense',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 sort:{kind:'flat',run:(f,i)=>f.model.setSortModel([{key:'value',direction:i%2?'asc':'desc'}])},
 filter:{kind:'flat',run:(f,i)=>f.model.setFilterModel(filter(i%2?40:60))},
 group3:{kind:'flat',prepare:f=>f.model.setGroupBy(null),run:f=>f.model.setGroupBy({fields:['g','h','year'],expandedByDefault:true})},
 groupHigh:{kind:'flat',prepare:f=>f.model.setGroupBy(null),run:f=>f.model.setGroupBy({fields:['id'],expandedByDefault:true})},
 aggregateEdit:{kind:'aggregate',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 treeDepth8Edit:{kind:'tree',run:(f,i)=>f.model.patchRows([{rowId:0,data:{value:100+i}}],full)},
 pivot:{kind:'flat',prepare:f=>f.model.setPivotModel(null),run:f=>f.model.setPivotModel({rows:['g'],columns:['year'],values:[{field:'value',agg:'sum'}]})},
 pivotHigh:{kind:'flat',prepare:f=>f.model.setPivotModel(null),run:f=>f.model.setPivotModel({rows:['id'],columns:['year'],values:[{field:'value',agg:'sum'}]})},
 append4:{kind:'flat',prepare:f=>f.model.setRows(f.rows),run:f=>f.model.appendRows(Array.from({length:4},(_,i)=>({id:`new${i}`,value:9})))},
 remove4:{kind:'flat',prepare:f=>f.model.setRows(f.rows),run:f=>f.model.removeRows([0,1,2,3])},
 selectionOne:{kind:'flat',run:(f,i)=>f.api.selection.setSnapshot({ranges:[{startRow:i%2,endRow:i%2,startCol:0,endCol:0}],activeCell:{rowIndex:i%2,columnIndex:0},activeRangeIndex:0})},
 selectionAll:{kind:'flat',run:(f,i)=>f.api.selection.setSnapshot({ranges:[{startRow:0,endRow:f.rows.length-1,startCol:0,endCol:i%2?3:4}],activeCell:{rowIndex:0,columnIndex:0},activeRangeIndex:0})},
 resize:{kind:'flat',run:(f,i)=>f.api.columns.setWidth('value',140+i)},
 reorder:{kind:'flat',run:(f,i)=>f.api.columns.setOrder(i%2?['value','spare','g','h','year']:['year','h','g','spare','value'])},
 pin:{kind:'flat',run:(f,i)=>f.api.columns.setPin('value',i%2?'left':'none')},
 viewport:{kind:'flat',run:(f,i)=>f.model.setViewportRange({start:i,end:i+40})},
 paste100:{kind:'flat',run:(f,i)=>f.model.patchRows(Array.from({length:100},(_,j)=>({rowId:j,data:{value:100+i,spare:100+i}})),full)},
 sequential20:{kind:'flat',run:(f,i)=>{for(let j=0;j<20;j++)f.model.patchRows([{rowId:j,data:{value:100+i}}],full)}},
 modelBatch20:{kind:'flat',run:(f,i)=>f.model.batchMutations(()=>{for(let j=0;j<20;j++)f.model.patchRows([{rowId:j,data:{value:100+i}}],full)})},
 facadeBatch20:{kind:'flat',run:(f,i)=>f.api.rows.batch(()=>{for(let j=0;j<20;j++)f.api.rows.patch([{rowId:j,data:{value:100+i}}],full)})},
 captureView:{kind:'flat',run:f=>f.api.read.captureView({include:['rows','columns','computed']})},
 captureClone:{kind:'flat',run:f=>f.api.read.captureView({include:['rows','columns','computed'],cloneRow:r=>({...r})})},
}
function reset(w){w.reads=0;w.readRows.clear();w.byField={};w.computes=0;w.stages={};w.events=0;w.facadeEvents=0;w.largeArrays=0;w.largeArraySlots=0}
function arrays(w){const saved={};for(const name of ['map','filter','slice']){saved[name]=Array.prototype[name];Array.prototype[name]=function(...args){const result=Reflect.apply(saved[name],this,args);if(w.active&&result.length>=128){w.largeArrays++;w.largeArraySlots+=result.length}return result}}
 const from=Array.from;Array.from=function(...args){const result=Reflect.apply(from,Array,args);if(w.active&&result.length>=128){w.largeArrays++;w.largeArraySlots+=result.length}return result};return()=>{Object.assign(Array.prototype,saved);Array.from=from}}
const results=[]
for(const n of sizes)for(const [name,scenario] of Object.entries(scenarios)){
 const f=make(n,scenario.kind);const times=[],stageTotals={};let notifications=0,recomputes=0,formulaEvaluations=0
 for(let i=0;i<warmups+samples;i++){
  scenario.prepare?.(f);reset(f.work);const before=f.model.getSnapshot().projection?.recomputeVersion??0
  f.work.active=true;const start=performance.now();scenario.run(f,i);const elapsed=performance.now()-start;f.work.active=false
  if(i>=warmups){times.push(elapsed);notifications+=f.work.events;recomputes+=(f.model.getSnapshot().projection?.recomputeVersion??0)-before;formulaEvaluations+=scenario.kind==='formula'?f.model.getFormulaComputeStageDiagnostics().evaluations:0;for(const [stage,v]of Object.entries(f.work.stages))stageTotals[stage]=(stageTotals[stage]??0)+v.ms}
 }
 await f.dispose()
 const counted=make(n,scenario.kind,true);scenario.prepare?.(counted);reset(counted.work);const restore=arrays(counted.work);counted.work.active=true;scenario.run(counted,1000);counted.work.active=false;restore();const w=counted.work
 results.push({n,action:name,...stats(times),meanModelEvents:notifications/samples,meanRecomputeCycles:recomputes/samples,meanFormulaEvaluations:formulaEvaluations/samples,meanStagesMs:Object.fromEntries(Object.entries(stageTotals).map(([k,v])=>[k,v/samples])),counted:{fieldReads:w.reads,uniqueSourceRowsRead:w.readRows.size,byField:w.byField,computedCallbackEvaluations:w.computes,stageCalls:Object.fromEntries(Object.entries(w.stages).map(([k,v])=>[k,v.calls])),modelEvents:w.events,facadeEvents:w.facadeEvents,largeArrayResults:w.largeArrays,largeArraySlots:w.largeArraySlots}})
 await counted.dispose()
}
writeFileSync(resolve(out,'core-cost.json'),JSON.stringify({node:process.version,arch:process.arch,samples,warmups,largeArrayObservation:'map/filter/slice/Array.from result lengths >=128; not all allocations',results},null,2))
// CPU and allocation profiles are separate from timing samples.
const session=new Session();session.connect();const post=(method,params={})=>new Promise((res,rej)=>session.post(method,params,(e,v)=>e?rej(e):res(v)))
for(const name of ['independent','formulaChain3','captureView','modelBatch20']){
 const f=make(Math.max(...sizes),scenarios[name].kind);await post('Profiler.enable');await post('Profiler.start');await post('HeapProfiler.startSampling',{samplingInterval:16384});for(let i=0;i<80;i++)scenarios[name].run(f,2000+i);const cpu=await post('Profiler.stop'),heap=await post('HeapProfiler.stopSampling');writeFileSync(resolve(out,`${name}.cpuprofile`),JSON.stringify(cpu.profile));writeFileSync(resolve(out,`${name}.heapprofile`),JSON.stringify(heap.profile));await f.dispose()
}
session.disconnect();console.log(JSON.stringify({output:out,scenarios:results.length,samplesEach:samples}))

// Preserve full catalogue evidence while rebuilding one explicitly selected design.
// Capture before its source regeneration; verify after targeted live/planar/export QA.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const capture=args.includes('--capture');
const option=name=>args.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const selected=new Set((option('--only')||'').split(',').filter(Boolean));
const baselinePath=option('--baseline');
const reportPath=option('--report');
if(!selected.size||!baselinePath||(!capture&&!reportPath))
  throw new Error('Use --only=id --baseline=path and either --capture or --report=path.');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fileHash=filename=>hash(fs.readFileSync(path.join(root,filename)));
const objectHash=value=>hash(Buffer.from(JSON.stringify(value)));
const read=filename=>JSON.parse(fs.readFileSync(path.join(root,filename),'utf8'));
const write=(filename,data)=>{
  const absolute=path.join(root,filename),temporary=absolute+'.tmp';
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  fs.writeFileSync(temporary,JSON.stringify(data,null,2)+'\n');fs.renameSync(temporary,absolute);
};
const proofPaths={
  live:'docs/qa/wheel-fidelity-live-geometry-2026-10-12.json',
  planar:'docs/qa/wheel-fidelity-builder-audit-2026-10-12.json',
  export:'docs/qa/wheel-fidelity-export-parity-2026-10-12.json',
};
const runtimeFiles=['js/wheel-reconstruction.js','js/wheel-brand-cap.js','js/showroom.js',
  'js/wheel-model-viewer.js','js/wheel-asset-url.js','assets/vendor/three/three.module.js',
  'assets/vendor/meshoptimizer/meshopt_decoder.mjs','tools/wheel-glb-codec.mjs'];
const registry=filename=>{
  const match=fs.readFileSync(path.join(root,filename),'utf8').match(/Object\.freeze\(([\s\S]*)\);/);
  if(!match)throw new Error('Cannot read generated registry: '+filename);
  return JSON.parse(match[1]);
};
function snapshot(){
  const index=read('assets/wheel-models/index.json'),reports=read('docs/qa/wheel-reconstruction/glb-export.json');
  const reportMap=new Map(reports.map(item=>[item.id,item]));
  const moduleRegistry=registry('js/wheel-reconstruction-catalog.js');
  const windowRegistry=registry('js/wheel-reconstruction-data.js');
  if(index.models.length!==147||reportMap.size!==147||reports.length!==147)
    throw new Error('The complete 147-entry catalogue and export report are required.');
  for(const id of selected)if(!index.models.some(entry=>entry.id===id))throw new Error('Unknown selected model: '+id);
  const models=index.models.filter(entry=>!selected.has(entry.id)).map(entry=>{
    const record=read(entry.record),report=reportMap.get(entry.id),glbSha256=fileHash(entry.glb);
    if(glbSha256!==entry.glbSha256||glbSha256!==report?.sha256||entry.glbRevision!==glbSha256.slice(0,16))
      throw new Error('Unselected GLB metadata mismatch: '+entry.id);
    return {id:entry.id,record:entry.record,recordSha256:fileHash(entry.record),glb:entry.glb,glbSha256,
      source:record.source.src,sourceSha256:fileHash(record.source.src),
      entrySha256:objectHash(entry),reportSha256:objectHash(report),
      moduleRegistrySha256:objectHash(moduleRegistry[entry.id]),windowRegistrySha256:objectHash(windowRegistry[entry.id])};
  });
  return {models,runtimeSha256:Object.fromEntries(runtimeFiles.map(filename=>[filename,fileHash(filename)])),
    baseProofSha256:Object.fromEntries(Object.entries(proofPaths).map(([kind,filename])=>[kind,{file:filename,sha256:fileHash(filename)}]))};
}
const startedAt=new Date().toISOString(),current=snapshot();
const baseProofs=Object.fromEntries(Object.entries(proofPaths).map(([kind,filename])=>[kind,read(filename)]));
for(const [kind,proof]of Object.entries(baseProofs)){
  if(proof.status!=='PASS'||!proof.evidence?.freshRun||!proof.evidence?.inputsStable||
    (proof.catalogue?.models??proof.recordCount)!==147)throw new Error('Full base proof is not a fresh complete PASS: '+kind);
  for(const model of current.models)if(proof.evidence.inputSha256[model.record]!==model.recordSha256)
    throw new Error('Unselected source changed since the full '+kind+' proof: '+model.id);
  for(const [filename,sha256]of Object.entries(current.runtimeSha256))
    if(proof.evidence.inputSha256[filename]&&proof.evidence.inputSha256[filename]!==sha256)
      throw new Error('Runtime changed since the full '+kind+' proof: '+filename);
}
if(capture){
  if(fs.existsSync(path.join(root,baselinePath)))throw new Error('Refusing to overwrite an existing baseline snapshot.');
  write(baselinePath,{status:'PASS',capturedAt:startedAt,selected:[...selected],...current});
  console.log(JSON.stringify({status:'PASS',baseline:baselinePath,preservedModels:current.models.length}));
  process.exit(0);
}
const baseline=read(baselinePath);
if(objectHash(baseline.selected)!==objectHash([...selected]))throw new Error('Selected scope differs from the captured baseline.');
if(objectHash(baseline.models)!==objectHash(current.models))throw new Error('An unselected model, source, registry or export changed.');
if(objectHash(baseline.runtimeSha256)!==objectHash(current.runtimeSha256))throw new Error('Runtime changed after the baseline snapshot.');
if(objectHash(baseline.baseProofSha256)!==objectHash(current.baseProofSha256))throw new Error('Canonical full base proof was modified.');
const targetPaths={live:option('--live'),planar:option('--planar'),export:option('--parity')};
if(Object.values(targetPaths).some(value=>!value))throw new Error('Provide --live=path --planar=path --parity=path.');
const targetProofs=Object.fromEntries(Object.entries(targetPaths).map(([kind,filename])=>[kind,read(filename)]));
const index=read('assets/wheel-models/index.json');
for(const [kind,proof]of Object.entries(targetProofs)){
  if(proof.status!=='PASS'||!proof.evidence?.freshRun||!proof.evidence?.inputsStable||
    (proof.catalogue?.models??proof.recordCount)!==selected.size)throw new Error('Target proof is not a fresh scoped PASS: '+kind);
  for(const entry of index.models.filter(entry=>selected.has(entry.id)))
    if(proof.evidence.inputSha256[entry.record]!==fileHash(entry.record))throw new Error('Target record changed after '+kind+' QA.');
  for(const [filename,sha256]of Object.entries(current.runtimeSha256))
    if(proof.evidence.inputSha256[filename]&&proof.evidence.inputSha256[filename]!==sha256)
      throw new Error('Target proof used a different runtime: '+kind+' / '+filename);
}
if(targetProofs.export.evidence.inputSha256['assets/wheel-models/index.json']!==fileHash('assets/wheel-models/index.json'))
  throw new Error('Final index changed after target export parity.');
const updated=index.models.filter(entry=>selected.has(entry.id)).map(entry=>{
  const glbSha256=fileHash(entry.glb);
  if(glbSha256!==entry.glbSha256||entry.glbRevision!==glbSha256.slice(0,16))
    throw new Error('Selected binary changed after export parity: '+entry.id);
  return {id:entry.id,record:entry.record,recordSha256:fileHash(entry.record),glb:entry.glb,glbSha256};
});
const totalApertures=index.models.reduce((total,entry)=>total+read(entry.record).shapes.reduce((sum,shape)=>sum+(shape.holes?.length||0),0),0);
const exportReport=read('docs/qa/wheel-reconstruction/glb-export.json');
const result={status:'PASS',scope:'147 photo models: unchanged 146 carry full fresh base proof; selected model carries fresh targeted proof.',
  startedAt,completedAt:new Date().toISOString(),models:147,preservedModels:current.models.length,selected:[...selected],
  sourceApertures:totalApertures,allOartsCaps:baseProofs.export.catalogue.oartsCaps,
  nativeContourRecords:read('data/wheel-reconstruction-native-contours.json').records.length,
  nativeContourSha256:fileHash('data/wheel-reconstruction-native-contours.json'),
  glbTriangles:exportReport.reduce((total,item)=>total+item.triangles,0),
  glbBytes:exportReport.reduce((total,item)=>total+item.bytes,0),
  stableUnselectedSourcesAndExports:true,stableRuntime:true,unchangedCanonicalBaseProofs:true,
  baseProofs:current.baseProofSha256,targetProofs:Object.fromEntries(Object.entries(targetPaths).map(([kind,filename])=>
    [kind,{file:filename,sha256:fileHash(filename),assertions:targetProofs[kind].assertions??null}])),
  finalIndexSha256:fileHash('assets/wheel-models/index.json'),runtimeSha256:current.runtimeSha256,
  updated,carryForward:current.models};
write(reportPath,result);
console.log(JSON.stringify({status:result.status,report:reportPath,models:result.models,preservedModels:result.preservedModels,
  selected:result.selected,sourceApertures:result.sourceApertures}));

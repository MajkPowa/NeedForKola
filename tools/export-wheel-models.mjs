// Export exactly the same bevelled solid meshes used by the browser studio.
// No browser, photographic billboard, supplier CAD or generic spoke substitution.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { codecReady, compressGLBLossless } from './wheel-glb-codec.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const THREE=await import(pathToFileURL(path.join(root,'assets/vendor/three/three.module.js')));
const {buildPhotoWheel}=await import(pathToFileURL(path.join(root,'js/wheel-reconstruction.js')));
const dir=path.join(root,'assets/wheel-models'), index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
const args=process.argv.slice(2), selectedIds=new Set();
let sourceTexture=false, dryRun=false, hasScope=false;
for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--with-source-texture')sourceTexture=true;
  else if(arg==='--dry-run')dryRun=true;
  else if(arg==='--only'||arg.startsWith('--only=')){
    if(hasScope)throw new Error('Use --only once.');
    hasScope=true;
    const values=arg==='--only'?[]:[arg.slice(7)];
    if(arg==='--only')while(args[i+1]&&!args[i+1].startsWith('--'))values.push(args[++i]);
    for(const value of values)for(const id of value.split(',').filter(Boolean))selectedIds.add(id);
    if(!selectedIds.size)throw new Error('--only requires at least one model ID.');
  }else throw new Error('Unknown export argument: '+arg);
}
const selectedEntries=index.models.filter(entry=>!hasScope||selectedIds.has(entry.id));
if(new Set(index.models.map(entry=>entry.id)).size!==index.models.length)throw new Error('Duplicate model IDs in index.');
for(const id of selectedIds)if(!selectedEntries.some(entry=>entry.id===id))throw new Error('Unknown model ID: '+id);
const reportPath=path.join(root,'docs/qa/wheel-reconstruction/glb-export.json');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const indexBefore=digest(fs.readFileSync(path.join(dir,'index.json')));
const priorReport=hasScope?JSON.parse(fs.readFileSync(reportPath,'utf8')):[];
const previousReports=new Map(priorReport.map(item=>[item.id,item]));
if(hasScope&&(priorReport.length!==index.models.length||previousReports.size!==index.models.length||
  index.models.some(entry=>!previousReports.has(entry.id))))throw new Error('Scoped export requires a complete existing export report.');
const preserved=index.models.filter(entry=>hasScope&&!selectedIds.has(entry.id)).map(entry=>{
  const previous=previousReports.get(entry.id), bytes=fs.readFileSync(path.join(root,entry.glb));
  const sha256=digest(bytes);
  if(sha256!==entry.glbSha256||sha256!==previous.sha256||entry.glbRevision!==sha256.slice(0,16)||
    previous.bytes!==bytes.length||previous.triangles!==entry.trace.glbTriangles||
    JSON.stringify(entry.glbCompression)!==JSON.stringify(previous.compression))
    throw new Error('Unselected GLB metadata does not match the previous export: '+entry.id);
  return {id:entry.id,glb:entry.glb,bytes:bytes.length,sha256,
    entrySha256:digest(Buffer.from(JSON.stringify(entry))),
    reportSha256:digest(Buffer.from(JSON.stringify(previous)))};
});
function verifyPreserved(){
  for(const item of preserved){
    const entry=index.models.find(entry=>entry.id===item.id), previous=previousReports.get(item.id);
    if(digest(fs.readFileSync(path.join(root,item.glb)))!==item.sha256||
      digest(Buffer.from(JSON.stringify(entry)))!==item.entrySha256||
      digest(Buffer.from(JSON.stringify(previous)))!==item.reportSha256)
      throw new Error('Unselected model changed during scoped export: '+item.id);
  }
}
if(dryRun){
  verifyPreserved();
  console.log(JSON.stringify({status:'PASS',dryRun:true,selected:selectedEntries.map(entry=>entry.id),
    models:index.models.length,preserved:preserved.length}));
  process.exit(0);
}
function atomicWrite(filename,bytes){
  const temporary=filename+'.export-'+process.pid+'.tmp';
  try{fs.writeFileSync(temporary,bytes);fs.renameSync(temporary,filename);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
const chunks=[], report=[], staged=new Map();
await codecReady;
function exportGLB(object,id,surface){
  const doc={asset:{version:'2.0',generator:'OARTS photo-derived visual reconstruction'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}],extras:{design:id,approximateDepth:true,notManufacturingCAD:true}};
  let offset=0;chunks.length=0;
  function buffer(array,target){const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const view=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})})-1;chunks.push(bytes);const pad=(4-bytes.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));offset+=bytes.length+pad;return view;}
  function accessor(array,size,type,target,limits=false){const entry={bufferView:buffer(array,target),componentType:array instanceof Float32Array?5126:5125,count:array.length/size,type};if(limits){entry.min=Array(size).fill(Infinity);entry.max=Array(size).fill(-Infinity);for(let i=0;i<array.length;i++) {const k=i%size;entry.min[k]=Math.min(entry.min[k],array[i]);entry.max[k]=Math.max(entry.max[k],array[i]);}}return doc.accessors.push(entry)-1;}
  const materials=new Map();
  if(surface){doc.images=[{bufferView:buffer(surface),mimeType:'image/jpeg',name:'Rectified photographic source'}];doc.textures=[{source:0,sampler:0}];doc.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];}
  function material(value){
    if(materials.has(value))return materials.get(value);
    const entry={name:value.name||(value.map?'Photographic front surface':'Reconstructed metal'),
      extras:{oartsEnvMapIntensity:value.envMapIntensity??1},
      pbrMetallicRoughness:{baseColorFactor:[...value.color.toArray(),1],metallicFactor:value.metalness??1,
        roughnessFactor:value.roughness??.23,...(value.map&&surface?{baseColorTexture:{index:0}}:{})},
      doubleSided:value.side===THREE.DoubleSide};
    const extension=(name,data)=>{doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),name])];
      (entry.extensions||={})[name]=data;};
    if(value.clearcoat>0)extension('KHR_materials_clearcoat',{clearcoatFactor:value.clearcoat,
      clearcoatRoughnessFactor:value.clearcoatRoughness});
    if(value.anisotropy>0)extension('KHR_materials_anisotropy',{anisotropyStrength:value.anisotropy,
      anisotropyRotation:value.anisotropyRotation||0});
    const i=doc.materials.push(entry)-1;materials.set(value,i);return i;
  }
  object.updateMatrixWorld(true);let triangles=0;
  object.traverse(item=>{if(!item.isMesh)return;const g=item.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    const positions=[],normals=[],uvs=[],ids=[],unique=new Map();
    for(let i=0;i<p.count;i++) {const values=[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv?.getX(i)||0,1-(uv?.getY(i)||0)];if(!values.every(Number.isFinite))throw new Error(id+' has invalid geometry');const key=values.map(v=>Math.round(v*1e6)).join(',');let id=unique.get(key);if(id===undefined){id=unique.size;unique.set(key,id);positions.push(...values.slice(0,3));normals.push(...values.slice(3,6));uvs.push(...values.slice(6));}ids.push(id);}
    const attributes={POSITION:accessor(new Float32Array(positions),3,'VEC3',34962,true),NORMAL:accessor(new Float32Array(normals),3,'VEC3',34962),TEXCOORD_0:accessor(new Float32Array(uvs),2,'VEC2',34962)};
    const source=g.index?Array.from(g.index.array):ids.map((_,i)=>i),groups=g.groups.length?g.groups:[{start:0,count:source.length,materialIndex:0}];const primitives=[];
    for(const group of groups){const sliced=source.slice(group.start,group.start+group.count).map(i=>ids[i]);if(!sliced.length)continue;triangles+=sliced.length/3;primitives.push({attributes,indices:accessor(new Uint32Array(sliced),1,'SCALAR',34963),material:material(Array.isArray(item.material)?item.material[group.materialIndex]:item.material),mode:4});}
    const mesh=doc.meshes.push({name:item.name,primitives})-1;doc.scenes[0].nodes.push(doc.nodes.push({name:item.name,mesh,matrix:item.matrixWorld.toArray()})-1);
  });
  doc.buffers[0].byteLength=offset;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks);const head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+json.length+8+bin.length,8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return{bytes:Buffer.concat([head,jh,json,bh,bin]),triangles};
}
for(const entry of selectedEntries){
  const record=JSON.parse(fs.readFileSync(path.join(root,entry.record),'utf8')),surfacePath=path.join(root,'docs/qa/wheel-reconstruction',entry.id+'-surface.jpg');
  const surface=sourceTexture&&!record.provenance.rectificationApproximate&&fs.existsSync(surfacePath)?fs.readFileSync(surfacePath):null;
  const texture=surface?new THREE.Texture():null;
  const wheel=buildPhotoWheel(THREE,record,{...record.defaultOptions,faceTexture:texture,preserveSourceColour:!!texture});
  const rawResult=exportGLB(wheel,entry.id,surface), compressed=compressGLBLossless(rawResult.bytes);
  const result={bytes:compressed.bytes,triangles:rawResult.triangles};
  if(result.bytes.length>25*1024*1024)throw new Error('Platform asset limit: '+entry.id);
  if(hasScope)staged.set(entry.glb,result.bytes);else atomicWrite(path.join(root,entry.glb),result.bytes);
  entry.trace.glbTriangles=result.triangles;entry.glbSha256=digest(result.bytes);
  entry.glbRevision=entry.glbSha256.slice(0,16);
  entry.glbCompression=compressed.stats;
  report.push({id:entry.id,triangles:result.triangles,bytes:result.bytes.length,originalBytes:rawResult.bytes.length,
    lossless:true,compression:compressed.stats,photographicSurface:!!surface,sha256:entry.glbSha256});
  const mats=new Set();wheel.traverse(item=>{item.geometry?.dispose();for(const m of Array.isArray(item.material)?item.material:item.material?[item.material]:[])mats.add(m);});for(const m of mats)m.dispose();
  console.log(entry.id,result.triangles,result.bytes.length);
}
verifyPreserved();
if(hasScope&&digest(fs.readFileSync(path.join(dir,'index.json')))!==indexBefore)throw new Error('Index changed during scoped export.');
for(const [filename,bytes]of staged)atomicWrite(path.join(root,filename),bytes);
const updatedReports=new Map(report.map(item=>[item.id,item]));
const completeReport=hasScope?index.models.map(entry=>updatedReports.get(entry.id)||previousReports.get(entry.id)):report;
atomicWrite(path.join(dir,'index.json'),JSON.stringify(index,null,2));atomicWrite(reportPath,JSON.stringify(completeReport,null,2));
const catalog=Object.fromEntries(index.models.map(entry=>[entry.id,Object.fromEntries(
  ['title','record','revision','glb','glbRevision','group'].map(key=>[key,entry[key]]))]));
atomicWrite(path.join(root,'js/wheel-reconstruction-catalog.js'),
  '// Generated individual photo-derived model registry; depth is an estimate.\nexport const PHOTO_WHEEL_MODELS = Object.freeze('+JSON.stringify(catalog)+');\n');
atomicWrite(path.join(root,'js/wheel-reconstruction-data.js'),
  '// Individual photo-derived meshes; depth and rear surfaces are visual estimates.\nwindow.NFWPhotoWheelModels = Object.freeze('+JSON.stringify(catalog)+');\n');
verifyPreserved();
if(hasScope)atomicWrite(path.join(root,'docs/qa/wheel-reconstruction/scoped-glb-export.json'),JSON.stringify({
  status:'PASS',completedAt:new Date().toISOString(),selected:[...selectedIds],models:completeReport.length,
  preservedModels:preserved.length,preserved,updated:report},null,2));
console.log(JSON.stringify({models:completeReport.length,exported:report.length,preserved:preserved.length,
  totalBytes:completeReport.reduce((a,r)=>a+r.bytes,0),
  originalBytes:completeReport.reduce((a,r)=>a+r.originalBytes,0),lossless:true,
  maxBytes:Math.max(...completeReport.map(r=>r.bytes))}));

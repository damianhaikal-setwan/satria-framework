/* SATRIA — fail-closed scoped snapshot projection.
 * Never expose the raw server response to an Operator/Viewer's application state.
 * Server-side Supabase RLS/RPC remains the authority; this is defense in depth.
 */
(function(root, factory){
  'use strict';
  const api=Object.freeze(factory());
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SATRIA_CLOUD_SCOPE=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const isRecord=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
  const collections=['opd','unit','pejabat','paket','rupBank'];
  function project(payload, scope, expectedRole){
    if(!['operator','viewer'].includes(expectedRole))throw Error('Proyeksi cloud hanya untuk Operator/Viewer.');
    if(!isRecord(payload)||!isRecord(scope)||scope.role!==expectedRole)
      throw Error('Respons cloud tidak sesuai identitas dan cakupan akun.');
    if(!Array.isArray(scope.opd_ids)||!Array.isArray(scope.years)||!scope.opd_ids.length||!scope.years.length)
      throw Error('Penugasan OPD dan tahun harus tersedia sebelum membuka data.');
    const assignedOpds=scope.opd_ids.map(x=>typeof x==='string'?x.trim():'');
    const assignedYears=scope.years.map(x=>Number(x));
    if(assignedOpds.some(id=>!id)||new Set(assignedOpds).size!==assignedOpds.length||
       assignedYears.some(y=>!Number.isInteger(y)||y<1900||y>2300)||
       new Set(assignedYears).size!==assignedYears.length)
      throw Error('Penugasan OPD/tahun dari server tidak valid.');
    if(!Array.isArray(payload.opd)||!Array.isArray(payload.tahun)||
       !Array.isArray(payload.paket)||!Array.isArray(payload.rupBank))
      throw Error('Data cloud tidak memiliki koleksi wajib yang valid.');
    for(const key of collections){if(!Array.isArray(payload[key]))throw Error('Koleksi cloud '+key+' tidak valid.');}
    const allowedOpds=new Set(assignedOpds),allowedYears=new Set(assignedYears);
    const actualOpds=new Set(payload.opd.map(x=>String(x?.id??'')));
    if(assignedOpds.some(id=>!actualOpds.has(id)))
      throw Error('Master OPD untuk penugasan akun tidak ditemukan di data cloud.');
    const availableYears=new Set(payload.tahun.map(x=>Number(x)));
    if(assignedYears.some(y=>!availableYears.has(y)))
      throw Error('Tahun penugasan akun tidak ditemukan di data cloud.');
    // Rebuild from a fixed allowlist. Never pass server-defined extra keys into S.
    // Filtering is repeated defensively even though the SQL RPC already scopes rows.
    const result={
      opd:copy(payload.opd.filter(x=>allowedOpds.has(String(x?.id??'')))),
      unit:copy(payload.unit.filter(x=>allowedOpds.has(String(x?.opd??'')))),
      pejabat:copy(payload.pejabat.filter(x=>allowedOpds.has(String(x?.opd??'')))),
      paket:copy(payload.paket.filter(x=>allowedOpds.has(String(x?.opd??''))&&allowedYears.has(Number(x?.tahun)))),
      rupBank:copy(payload.rupBank.filter(x=>allowedOpds.has(String(x?.opd??''))&&allowedYears.has(Number(x?.tahun)))),
      tahun:assignedYears.slice().sort((a,b)=>a-b),
      penyedia:Array.isArray(payload.penyedia)?copy(payload.penyedia):[],
      akun:Array.isArray(payload.akun)?copy(payload.akun):[],
      kode:Array.isArray(payload.kode)?copy(payload.kode):[],
      pemda:isRecord(payload.pemda)?copy(payload.pemda):{},
      meta:isRecord(payload.meta)?copy(payload.meta):{},
      penomoran:isRecord(payload.penomoran)?copy(payload.penomoran):{},
      users:[]
    };
    return {payload:result, assignedOpds, assignedYears, scope:copy({
      role:expectedRole,opd_ids:assignedOpds,years:assignedYears,can_write:expectedRole==='operator'
    })};
  }
  return {project};
});

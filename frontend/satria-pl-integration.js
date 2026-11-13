/* SATRIA NEXT 3.0.59.63 — adaptor BACA lintas modul PL.
 * Satu sumber biaya aktif untuk JKK; data items/HPS PPK/Bank RUP tidak pernah dimutasi.
 * Kriteria JKK berdasarkan ID Bank RUP, OPD/TA, metode, jenis dan subjenis KAK.
 */
(function(root,factory){'use strict';const api=Object.freeze(factory(root));if(root)root.SATRIA_PL_INTEGRATION=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:null,function(root){'use strict';
 const core=root?.SATRIA_JKK_CORE||(typeof module==='object'&&module.exports?require('./satria-jkk-core.js'):null);
 const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
 const money=n=>'Rp '+Math.round(Number(n)||0).toLocaleString('id-ID');
 const legacyTotal=p=>(Array.isArray(p?.items)?p.items:[]).reduce((sum,x)=>sum+Math.max(0,Number(x.vol)||0)*Math.max(0,Number(x.hs)||0),0);
 const isPL=p=>norm(p?.spseMonitoring?.method||p?.metodePemilihan)==='pengadaan langsung';
 const isGoodsPL=p=>isPL(p)&&(['barang','jasa lainnya','barang/jasa lainnya','jasa lainya'].includes(norm(p?.jenisPengadaan)));
 function classification(p,bank=[]){const match=core.eligiblePackage(p,bank);const jkk=!!(match.eligible&&core.subtypeConfirmed(p,match.rup));return {jkk,pl:isPL(p),goods:isGoodsPL(p),rup:match.rup||null,issue:match.issue||(!jkk&&match.eligible?'Subjenis konstruksi belum dikonfirmasi dari KAK.':'')};}
 function financial(p,bank=[]){const cls=classification(p,bank);const old=legacyTotal(p);if(!cls.jkk)return {source:'items',sourceLabel:'Rincian paket',total:old,complete:Array.isArray(p?.items)&&p.items.length>0,legacy:old,ppk:null,conflict:false,delta:null,kind:cls};
 const d=core.model(p.kkJkk),sums=core.totals(d),rows=d.biaya.length,ppk=d.hpsPPK===''?null:Number(d.hpsPPK),haveLegacy=Array.isArray(p.items)&&p.items.length>0;
 const complete=rows>0&&!sums.invalid&&sums.hps!==null;
 const delta=haveLegacy&&complete?sums.hps-old:null;
 return {source:'jkk',sourceLabel:'Kertas Kerja Jasa Konsultansi Konstruksi',total:complete?sums.hps:null,complete,legacy:haveLegacy?old:null,ppk,delta,conflict:delta!==null&&Math.round(delta)!==0,kind:cls,rows,calculation:sums,legacyRows:haveLegacy?p.items.length:0};
 }
 function stageProfile(p){return isPL(p)?[['persiapan','Persiapan pemilihan'],['pengumuman','Undangan Pengadaan Langsung'],['penawaran','Penyampaian penawaran'],['evaluasi','Evaluasi penawaran'],['klarifikasi','Klarifikasi & negosiasi'],['penetapan','Pencatatan hasil pemilihan'],['kontrak','Kontrak (jika relevan)']]:null;}
 // Hanya tindakan eksplisit pengguna, hanya untuk model JKK baru yang masih kosong.
 function importLegacy(p){const d=core.model(p?.kkJkk);if(d.biaya.length)throw Error('Rincian JKK sudah ada. Impor tidak boleh menimpa pekerjaan tersebut.');const list=Array.isArray(p?.items)?p.items:[];if(!list.length)throw Error('Belum ada rincian paket untuk disalin.');if(list.length>100)throw Error('Maksimal 100 rincian dapat disalin.');
  d.biaya=list.map((x,i)=>({id:'jkk-legacy-'+String(i+1).padStart(3,'0'),kategori:['Personel','Nonpersonel'].includes(x.kategori)?x.kategori:'Belum ditentukan',uraian:String(x.nama||'').slice(0,250),volume:String(x.vol??'1'),satuan:String(x.satuan||x.sat||'').slice(0,120),harga:String(x.hs??''),survei:'Disalin dari rincian paket (perlu klasifikasi)',keterangan:String(x.spesifikasi||'').slice(0,250),penawaran:'',negosiasi:''}));core.clean(d);return d;
 }
 return {classification,financial,stageProfile,importLegacy,isGoodsPL,money};
});

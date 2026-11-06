

/* SATRIA NEXT 3.0.49 — Dashboard Analytics Engine.
 * Filter-aware; no CDN chart dependency; all data comes from Paket Pengadaan.
 * Nilai penetapan bukan realisasi/pembayaran. Selisih HPS bukan penghematan riil.
 */
const SATRIA_CHART_IDS=['chartMultiYear','chartDonut','chartBarPaket','chartStatus','chartHpsPagu','chartOpd'];
const SATRIA_CHART_COLORS={pagu:'#6756f8',set:'#087e81',hps:'#38a9d8',gap:'#8cba2c',pending:'#f2b84b',danger:'#e36b75',muted:'#cad1de'};
function satriaDashboardMetrics(list){
 const rows=Array.isArray(list)?list:[];
 const toMoney=v=>Math.max(0,Number(v)||0);
 let pagu=0,hpsTotal=0,committed=0,hpsGap=0,settledHps=0,settled=0,unassigned=0,remainingSettled=0,overPagu=0;
 const packages=[];
 for(const p of rows){
  const pg=toMoney(p.pagu),hp=toMoney(hps(p));
  let award=null;
  try{ award=pemenang(p); }catch(err){console.warn('Analitik: penetapan tidak valid',err);}
  const amount=award?toMoney(award.t):0;
  const gap=award&&hp>0?hp-amount:0;
  const approved=!!award;
  pagu+=pg;hpsTotal+=hp;
  if(approved){settled++;committed+=amount;hpsGap+=gap;settledHps+=hp;remainingSettled+=Math.max(0,pg-amount);overPagu+=Math.max(0,amount-pg)}
  else unassigned+=pg;
  let status='Draf';try{status=stt(p)}catch(_){status='Perlu pemeriksaan'}
  packages.push({id:p.id,name:String(p.nama||'Paket tanpa nama'),year:Number(p.tahun),opd:String(p.opd||''),pagu:pg,hps:hp,amount,gap,approved,status});
 }
 return {count:rows.length,packages,pagu,hpsTotal,committed,hpsGap,settledHps,settled,unassigned,remainingSettled,overPagu,
   completed:rows.filter(p=>{try{return gaps(p).length===0}catch(_){return false}}).length};
}
function satriaDashE(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e}
function satriaDashSvg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=String(text);return el}
function satriaDashEmpty(el,msg){el.replaceChildren();const x=satriaDashE('div','s348-empty',msg);el.appendChild(x);el.setAttribute('aria-label',msg)}
function satriaDashFormat(v){return rp(Math.round(v||0))}
function satriaDashCompact(v){const a=Math.abs(v);return a>=1e9?(v/1e9).toFixed(1)+' M':a>=1e6?(v/1e6).toFixed(1)+' jt':a>=1e3?(v/1e3).toFixed(a<1e4?1:0)+' rb':Math.round(v).toLocaleString('id-ID')}
function satriaDashChartYears(el){
 const years=[...new Set((S.tahun||[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);
 if(!years.length){satriaDashEmpty(el,'Tahun anggaran belum tersedia.');return}
 const data=years.map(y=>({year:y,...satriaDashboardMetrics(filt(y))}));
 const any=data.some(r=>r.count>0);if(!any){satriaDashEmpty(el,'Belum ada paket untuk OPD/tahun yang dapat Anda akses.');return}
 el.replaceChildren();const W=760,H=302,ml=76,mr=18,mt=24,mb=45,ih=H-mt-mb;
 const top=Math.max(1,...data.map(x=>Math.max(x.pagu,x.committed,x.hpsTotal)))*1.12;
 const svg=satriaDashSvg('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Grafik pagu paket tercatat, HPS, dan nilai penetapan per tahun',preserveAspectRatio:'xMidYMid meet'});
 const scaleY=v=>mt+ih-Math.max(0,v)/top*ih;const cell=(W-ml-mr)/data.length;
 for(let i=0;i<=4;i++){const amount=top*i/4,cy=scaleY(amount);svg.append(satriaDashSvg('line',{x1:ml,y1:cy,x2:W-mr,y2:cy,stroke:'#d9deec','stroke-dasharray':'4 5'}));svg.append(satriaDashSvg('text',{x:ml-8,y:cy+4,'text-anchor':'end',class:'s348-axis'},satriaDashCompact(amount)))}
 const cols=['pagu','hpsTotal','committed'],colors=[SATRIA_CHART_COLORS.pagu,SATRIA_CHART_COLORS.hps,SATRIA_CHART_COLORS.set];
 data.forEach((d,i)=>{const base=ml+i*cell, bw=Math.min(25,cell/4-4), mid=base+cell/2;cols.forEach((key,k)=>{const xx=mid+(k-1)*(bw+3)-bw/2,y=scaleY(d[key]);const rect=satriaDashSvg('rect',{x:xx,y,width:bw,height:Math.max(0,H-mb-y),fill:colors[k],rx:3});rect.append(satriaDashSvg('title',{},`TA ${d.year} • ${['Pagu Paket','HPS','Penetapan'][k]} ${satriaDashFormat(d[key])}`));svg.append(rect)});svg.append(satriaDashSvg('text',{x:mid,y:H-19,'text-anchor':'middle',class:'s348-axis'},d.year))});
 el.append(svg);satriaDashLegend('legendMultiYear',[['Pagu paket tercatat',colors[0]],['HPS',colors[1]],['Nilai penetapan',colors[2]]]);
}
function satriaDashLegend(id,items){const el=document.getElementById(id);if(!el)return;el.replaceChildren();items.forEach(([t,c])=>{const e=satriaDashE('span','s348-legend',t);e.style.setProperty('--s348-dot',c);el.append(e)})}
function satriaDashChartBudget(el,m){
 const rup=satriaDashboardRupMetrics();
 if(!rup.validCount){satriaDashEmpty(el,rup.rupCount?'Data Bank RUP perlu diperbaiki sebelum saldo ditampilkan.':'Belum ada Bank RUP pada tahun/OPD yang dipilih.');satriaDashLegend('legendDonut',[]);return}
 el.replaceChildren();
 // Bagi setiap RUP: total kapasitas terisi yang dapat diakui + sisa nonnegatif;
 // kelebihan pada satu RUP tidak boleh mengurangi saldo RUP lainnya.
 const within=Math.max(0,rup.pagu-rup.free);
 const parts=[{label:'Terhitung di dalam batas RUP',value:within,color:SATRIA_CHART_COLORS.set},
   {label:'Sisa kapasitas RUP',value:rup.free,color:SATRIA_CHART_COLORS.pagu}];
 const wrap=satriaDashE('div','s348-donut-wrap');const circle=satriaDashE('div','s348-donut');
 const center=satriaDashE('div','s348-donut-core');center.append(satriaDashE('small','','PAGU RUP'),satriaDashE('b','',satriaDashCompact(rup.pagu)));circle.append(center);
 if(rup.pagu>0){let a=0;const arcs=parts.map(p=>{const start=a;a+=p.value/rup.pagu*100;return `${p.color} ${Math.max(0,start).toFixed(3)}% ${Math.min(100,a).toFixed(3)}%`});circle.style.background=`conic-gradient(${arcs.join(',')})`}
 else circle.style.background='#d9deec';
 wrap.append(circle);el.append(wrap);
 satriaDashLegend('legendDonut',parts.map(p=>[`${p.label}: ${satriaDashFormat(p.value)}`,p.color]));
 if(rup.over)el.append(satriaDashE('p','s348-warning',`Penggunaan melebihi pagu pada RUP tertentu: ${satriaDashFormat(rup.over)}. Tidak dikompensasikan dengan saldo RUP lain.`));
 if(rup.excluded)el.append(satriaDashE('p','s348-warning',`${rup.excluded} referensi RUP duplikat / tidak valid dikecualikan dari total sementara.`));
 if(rup.draft||rup.missingSplit)el.append(satriaDashE('p','s348-caption','Angka penggunaan bersifat estimasi dan mencakup cadangan sementara atau pembagian konsolidasi.'));
}
function satriaDashChartGap(el,m){
 const data=m.packages.filter(p=>p.approved&&p.hps>0).sort((a,b)=>b.gap-a.gap).slice(0,8);
 if(!data.length){satriaDashEmpty(el,'Belum ada penetapan dengan negosiasi lengkap. Selisih HPS belum bisa dihitung.');return}
 el.replaceChildren();const label=satriaDashE('p','s348-caption','Selisih HPS terhadap hasil negosiasi pada paket yang ditetapkan — bukan penghematan kas.');el.append(label);
 const max=Math.max(1,...data.map(p=>Math.abs(p.gap)));
 for(const p of data){const row=satriaDashE('div','s348-bar-row');const head=satriaDashE('div','s348-bar-head');head.append(satriaDashE('span','',p.name),satriaDashE('b','',satriaDashFormat(p.gap)));const rail=satriaDashE('div','s348-bar-rail'),fill=satriaDashE('div','s348-bar-fill');fill.style.width=Math.max(1,Math.abs(p.gap)/max*100)+'%';fill.style.background=p.gap<0?SATRIA_CHART_COLORS.danger:SATRIA_CHART_COLORS.gap;rail.append(fill);row.append(head,rail);el.append(row)}
}
function satriaDashChartStatus(el,m){
 if(!m.count){satriaDashEmpty(el,'Belum ada paket untuk menampilkan status proses.');return}
 const colors=[SATRIA_CHART_COLORS.pagu,SATRIA_CHART_COLORS.set,SATRIA_CHART_COLORS.hps,SATRIA_CHART_COLORS.pending,SATRIA_CHART_COLORS.gap,SATRIA_CHART_COLORS.danger];
 const counts=new Map();m.packages.forEach(p=>counts.set(p.status,(counts.get(p.status)||0)+1));el.replaceChildren();
 for(const [i,[label,n]] of [...counts.entries()].sort((a,b)=>b[1]-a[1]).entries()){
  const row=satriaDashE('div','s348-bar-row');const h=satriaDashE('div','s348-bar-head');h.append(satriaDashE('span','',label),satriaDashE('b','',n+' paket'));
  const rail=satriaDashE('div','s348-bar-rail'),fill=satriaDashE('div','s348-bar-fill');fill.style.width=n/m.count*100+'%';fill.style.background=colors[i%colors.length];rail.append(fill);row.append(h,rail);el.append(row)
 }
}
function satriaDashChartMatrix(el,m){
 const pts=m.packages.filter(p=>p.pagu>0&&p.hps>0);
 if(!pts.length){satriaDashEmpty(el,'HPS belum diisi. Tambahkan rincian kebutuhan dan harga satuan.');return}
 el.replaceChildren();const W=400,H=232,l=51,r=15,t=12,b=44;const mx=Math.max(...pts.map(p=>Math.max(p.pagu,p.hps)),1)*1.08;
 const x=v=>l+(v/mx)*(W-l-r),y=v=>H-b-(v/mx)*(H-t-b);
 const svg=satriaDashSvg('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Hubungan pagu dengan HPS per paket'});
 for(let i=0;i<=4;i++){const v=mx*i/4;svg.append(satriaDashSvg('line',{x1:l,y1:y(v),x2:W-r,y2:y(v),stroke:'#d9deec','stroke-dasharray':'3 5'}));svg.append(satriaDashSvg('text',{x:l-7,y:y(v)+3,'text-anchor':'end',class:'s348-axis'},satriaDashCompact(v)))}
 svg.append(satriaDashSvg('line',{x1:x(0),y1:y(0),x2:x(mx),y2:y(mx),stroke:'#a8b0c3','stroke-dasharray':'6 4'}));
 pts.forEach(p=>{const circle=satriaDashSvg('circle',{cx:x(p.pagu),cy:y(p.hps),r:6,fill:p.hps>p.pagu?SATRIA_CHART_COLORS.danger:SATRIA_CHART_COLORS.set,stroke:'#fff','stroke-width':2});circle.append(satriaDashSvg('title',{},`${p.name}\nPagu ${satriaDashFormat(p.pagu)}\nHPS ${satriaDashFormat(p.hps)}`));svg.append(circle)});
 svg.append(satriaDashSvg('text',{x:W/2,y:H-7,'text-anchor':'middle',class:'s348-axis'},'Pagu →'));svg.append(satriaDashSvg('text',{x:12,y:17,class:'s348-axis'},'HPS'));el.append(svg);
 if(pts.some(p=>p.hps>p.pagu))el.append(satriaDashE('p','s348-warning',`${pts.filter(p=>p.hps>p.pagu).length} paket memiliki HPS lebih besar dari pagu.`));
}
function satriaDashChartOpd(el,m){
 if(!m.count){satriaDashEmpty(el,'Belum ada paket pada filter OPD/tahun aktif.');return}
 const by=new Map();for(const p of m.packages){if(!by.has(p.opd))by.set(p.opd,{name:O(p.opd).singkat||O(p.opd).nama||p.opd,pagu:0,amount:0,count:0});const o=by.get(p.opd);o.pagu+=p.pagu;o.amount+=p.amount;o.count++}
 const data=[...by.values()].sort((a,b)=>b.pagu-a.pagu).slice(0,8);const max=Math.max(1,...data.map(o=>o.pagu));el.replaceChildren();
 const caption=satriaDashE('p','s348-caption','Pagu paket tercatat (ungu) dan nilai penetapan tervalidasi (hijau) per OPD; bukan pagu unik Bank RUP.');el.append(caption);
 for(const rowdata of data){const row=satriaDashE('div','s348-bar-row');const head=satriaDashE('div','s348-bar-head');head.append(satriaDashE('span','',`${rowdata.name} • ${rowdata.count} paket`),satriaDashE('b','',satriaDashFormat(rowdata.pagu)));row.append(head);
  for(const [v,color] of [[rowdata.pagu,SATRIA_CHART_COLORS.pagu],[rowdata.amount,SATRIA_CHART_COLORS.set]]){const rail=satriaDashE('div','s348-bar-rail'),fill=satriaDashE('div','s348-bar-fill');fill.style.width=v/max*100+'%';fill.style.background=color;rail.append(fill);row.append(rail)}el.append(row)
 }
}
function drawKhChartsSingle(id){
 const el=document.getElementById(id);if(!el||!S||S.ui.page!=='dash')return;
 try{const m=satriaDashboardMetrics(filt());switch(id){
  case 'chartMultiYear':satriaDashChartYears(el);break;
  case 'chartDonut':satriaDashChartBudget(el,m);break;
  case 'chartBarPaket':satriaDashChartGap(el,m);break;
  case 'chartStatus':satriaDashChartStatus(el,m);break;
  case 'chartHpsPagu':satriaDashChartMatrix(el,m);break;
  case 'chartOpd':satriaDashChartOpd(el,m);break;
 }}catch(error){console.error('Dashboard chart '+id,error);satriaDashEmpty(el,'Grafik tidak dapat ditampilkan. Periksa data paket dan konsol.');}
}
function drawKhCharts(){if(!S||S.ui.page!=='dash')return;for(const id of SATRIA_CHART_IDS)drawKhChartsSingle(id)}
function initChartLazyLoad(){drawKhCharts()}
(function(){
 // Rendering is deliberately lightweight and synchronous after paint; old observer cache
 // persisted across DOM replacements and left the six charts permanently in Loading state.
 let queued=0;const schedule=()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>drawKhCharts())};
 if(typeof window.render==='function'){const old=window.render;window.render=function(){const result=old.apply(this,arguments);schedule();return result}}
 window.addEventListener('resize',()=>{clearTimeout(window.__s348resize);window.__s348resize=setTimeout(schedule,170)});
 document.addEventListener('DOMContentLoaded',schedule);setTimeout(schedule,60);
})();


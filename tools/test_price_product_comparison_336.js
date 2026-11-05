'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {analyze}=require('../frontend/satria-price-analysis.js');
// Reconstruct the values visible in the user-supplied PDF (without saving any real personal data).
const rows=[
 ['hvs','HVS A4 Folio 70 GR','Kertas HVS A4 70 GR','Rim',20,73600,68000,67900,73600,73600,'Kertas HVS A4 70gsm',false],
 ['map','Map GOBI 401','Map GOBI 401','Buah',4,40000,32500,32000,33000,33300,'Map Gobi',true],
 ['folio','Map Snelhecter Folio','Snelhecter Folio Kertas Biasa','Buah',59,2200,2200,1900,4000,4000,'Map Biola Warna',false],
 ['faster','Pulpen Faster','Ball Point Faster','Batang',10,8000,4000,3900,4440,4440,'Pulpen Pilot',false],
 ['staple-small','Refille isi staples ukuran 10','Staples ukuran 10','Kotak',5,4000,5000,4900,8880,8880,'Isi Staples No. 24/6',false],
 ['staple','Isi Staples No. 10','Isi Staples No. 10','Kotak',5,4200,5000,4900,8880,8880,'Isi Staples No. 24/6',false],
 ['faster2','Pulpen Ball Point Faster','Ball Point Faster','Batang',10,4200,4000,3900,4440,4440,'Pulpen Pilot',false],
];
const items=rows.map(([id,nama,spesifikasi,satuan,vol,hs])=>({id,nama,spesifikasi,satuan,vol,hs}));
function offer(id,pen,pos){return {id,pen,sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-06-02',ongkir:0,
  harga:Object.fromEntries(rows.map(r=>[r[0],r[pos]])),nego:Object.fromEntries(rows.map(r=>[r[0],r[pos+1]])),
  catalogRefs:Object.fromEntries(rows.map(r=>[r[0],{date:'2026-06-02',name:pos===6?r[1]:r[10],seller:pen,unit:pos===8&&r[11]?'Lainnya':r[3],displayPrice:r[pos],link:'https://example.org/product/'+r[0]}]))
};}
const packet={id:'paket-67122699',rup:'67122699',pagu:1924800,items,penawaran:[offer('w1','PRIMA',6),offer('w2','RIAN',8)],pemenangId:'w1'};
const initial=JSON.stringify(packet);
const result=analyze(packet,{suppliers:{PRIMA:'PRIMA',RIAN:'RIAN'},validWinnerId:'w1'});
assert.equal(result.packet.hps,1924800);
assert.equal(result.winner.negoTotal,1725100);
assert.equal(result.delta,199700);
assert.equal(result.productFindings.length,7);
assert.equal(result.productFindings[0].chosenValue,67900);
assert.equal(result.productFindings[0].hpsDelta,5700);
assert.equal(result.productFindings[0].bestPeer.unitPrice,73600);
assert.equal(result.productFindings[1].hpsDelta,8000);
assert.equal(result.productFindings[1].bestPeer,null, 'different unit cannot be peer reference');
assert.equal(result.productFindings[5].hpsDelta,-700, 'staples unit negotiation exceeds unit HPS');
assert.equal(result.productFindings[5].bestPeer,null, 'Staples 24/6 cannot be treated as equivalent to No. 10');
assert.match(result.productFindings[5].peerWarnings[0].product,/24\/6/);
assert(result.productFindings[5].peerWarnings.some(x=>x.reason.includes('ukuran/nomor')));
assert.equal(result.comparisonSummary.aboveHps,2);
assert.equal(result.comparisonSummary.belowHps,5);
assert.equal(JSON.stringify(packet),initial,'analysis is read-only');
// No winner: show lowest listed supplier, without claiming a chosen provider.
const withoutWinner=analyze({...packet,pemenangId:null},{suppliers:{PRIMA:'PRIMA',RIAN:'RIAN'}});
assert.equal(withoutWinner.winner,null);
assert.match(withoutWinner.productFindings[0].chosenBasis,/belum ada penetapan/);
const js=fs.readFileSync(path.join(__dirname,'../frontend/satria-price-analysis.js'),'utf8');
assert(js.includes('IV. Tabel Analisis Beda Harga Per Item'));
assert(js.includes('productPriceTable(a)'));
assert(js.includes('productNarrative(f)'));
assert(js.indexOf('IV. Tabel Analisis Beda Harga Per Item')<js.indexOf('IX. Lampiran B — Daftar Sumber Referensi Harga'));
console.log('PASS v3.0.59.36: HPS & negotiation 7 items, per-item savings/overage, peer suitability, draft without winner, read-only, print sections');

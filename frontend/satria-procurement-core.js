/* SATRIA NEXT — Tahap 3: model baca bersama RUP → Paket → HPS → Negosiasi → Dokumen.
 * Pure functions; tidak menulis ke S, tidak mengubah snapshot, tidak melakukan fetch,
 * tidak menebak pajak/ongkir/penetapan dan tidak membuat approval workflow.
 * Kebijakan pembulatan kompatibel dengan fungsi lama:
 * - HPS: jumlah (max(volume,0) * max(harga,0)), tanpa round per item.
 * - Total penawaran utama: round rupiah SETELAH menjumlah harga item, tanpa ongkir.
 * - Analisis bukti: pembulatan dua desimal hanya untuk mode precision=2.
 * - Dokumen HPS: pembulatan rupiah per baris sebelum menghitung komponen pajak.
 */
(function (root, factory) {
  'use strict';
  const api = Object.freeze(factory());
  if (root) root.SATRIA_PROCUREMENT_CORE = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const numeric = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
  const nonnegative = value => Math.max(0, numeric(value));
  const string = value => String(value ?? '').trim();
  const hpsItem = item => nonnegative(item?.vol) * nonnegative(item?.hs);
  const hpsTotal = paket => list(paket?.items).reduce((total, item) => total + hpsItem(item), 0);
  const rupLinks = paket => [...new Set([paket?.rupBankId, ...list(paket?.rupBankIds)]
    .filter(value => value !== null && value !== undefined && string(value))
    .map(String))];
  const rupKey = record => [String(record?.opd), Number(record?.tahun), string(record?.rup).toLowerCase()].join('|');
  // Stable, read-only index for bulk RUP→Paket inspections; no global cache,
  // because Bank RUP arrays can be edited in place by existing UI code.
  function createBankIndex(bank) {
    const byId = new Map(), byCode = new Set();
    for (const row of list(bank)) {
      const id = String(row?.id);
      if (!byId.has(id)) byId.set(id, row); // Match Array.find first-row behavior.
      byCode.add(rupKey(row));
    }
    return {byId, byCode};
  }
  function rupLinkStatus(paket, bank, index) {
    const ids = rupLinks(paket), lookup = index || createBankIndex(bank), refs = [];
    const missing = [], outsideScope = [];
    for (const id of ids) {
      const row = lookup.byId.get(id);
      if (!row) { missing.push(id); continue; }
      refs.push(row);
      if (String(row.opd) !== String(paket?.opd) || Number(row.tahun) !== Number(paket?.tahun)) outsideScope.push(id);
    }
    const issues = [];
    if (missing.length) issues.push('Tautan Bank RUP tidak ditemukan (' + missing.length + '). Periksa relasi paket.');
    if (outsideScope.length) issues.push('Tautan Bank RUP berbeda OPD atau tahun anggaran (' + outsideScope.length + ').');
    const legacyMatch = !ids.length && lookup.byCode.has(rupKey(paket));
    const primary = ids.length ? lookup.byId.get(ids[0]) : null;
    if (primary && string(paket?.rup) && string(primary.rup) && string(paket.rup).toLowerCase() !== string(primary.rup).toLowerCase())
      issues.push('Kode RUP paket berbeda dari Bank RUP utama; periksa sumbernya.');
    return { ids, references: refs, missing, outsideScope, legacyMatch, issues };
  }
  function offerGoodsRaw(paket, offer, field = 'harga', fallback = false) {
    return list(paket?.items).reduce((total, item) => {
      const id = item?.id;
      const value = fallback && offer?.nego?.[id] != null ? offer.nego[id] : offer?.[field]?.[id];
      return total + nonnegative(item?.vol) * nonnegative(value);
    }, 0);
  }
  function offerGoodsTotal(paket, offer, negotiated = false) {
    return Math.round(offerGoodsRaw(paket, offer, 'harga', negotiated));
  }
  function offerWithShipping(paket, offer, field = 'harga', precision = 0) {
    // Untuk analisis bukti, field 'nego' harus dibaca eksplisit tanpa fallback.
    const gross = offerGoodsRaw(paket, offer, field, false) + numeric(offer?.ongkir);
    return precision === 2 ? Math.round(gross * 100) / 100 : Math.round(gross);
  }
  function documentHps(paket, options = {}) {
    const rate = numeric(options.rate), mode = options.mode === 'excluded' ? 'excluded' : 'included';
    const rows = list(paket?.items).map((item, index) => {
      const qty = numeric(item?.vol), price = numeric(item?.hs);
      const base = Math.round(qty * price);
      const tax = mode === 'excluded' ? Math.round(base * rate / 100) : rate > 0 ? Math.round(base * rate / (100 + rate)) : 0;
      return {
        no: index + 1, name: String(item?.nama || ''), spec: String(item?.spesifikasi || ''),
        unit: String(item?.sat || item?.satuan || ''), qty, price, base, tax,
        total: mode === 'excluded' ? base + tax : base,
        notes: String(item?.keterangan || item?.kelengkapan || '')
      };
    });
    return {
      rows,
      before: rows.reduce((sum, item) => sum + item.base, 0),
      tax: rows.reduce((sum, item) => sum + item.tax, 0),
      total: rows.reduce((sum, item) => sum + item.total, 0)
    };
  }
  function packageSnapshot(paket, bank, index) {
    const rup = rupLinkStatus(paket, bank, index), hps = hpsTotal(paket), pagu = numeric(paket?.pagu);
    return {
      id: String(paket?.id ?? ''), rupCode: string(paket?.rup), tahun: paket?.tahun, opd: paket?.opd,
      pagu, hps, difference: pagu - hps, rup,
      offers: list(paket?.penawaran).map(offer => ({
        id: String(offer?.id ?? ''), tayang: offerGoodsTotal(paket, offer, false),
        negosiasi: offerGoodsTotal(paket, offer, true), ongkir: numeric(offer?.ongkir)
      }))
    };
  }
  function packageSnapshots(packages, bank) {
    const index = createBankIndex(bank);
    return list(packages).map(paket => packageSnapshot(paket, bank, index));
  }
  return { hpsItem, hpsTotal, rupLinks, rupKey, createBankIndex, rupLinkStatus,
    offerGoodsRaw, offerGoodsTotal, offerWithShipping, documentHps, packageSnapshot, packageSnapshots };
});

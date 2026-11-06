
(function(){
  SATRIA.addValidator(state => {
    const out = [];
    for(const p of state.paket || []){
      if(p.arsip) continue;
      const d = klasifikasiDetail(p);
      if(d.program.src === 'default Pengaturan') out.push({level:'warn', msg:`Program paket "${p.nama || p.rup}" masih memakai default Pengaturan; isi manual atau lengkapi Data Master`});
      if(d.kegiatan.src === 'default Pengaturan') out.push({level:'warn', msg:`Kegiatan paket "${p.nama || p.rup}" masih memakai default Pengaturan; isi manual atau lengkapi Data Master`});
    }
    return out;
  });
})();

'use strict';
/* Reconstruct a *virtual* single-file HTML string for legacy regression tests.
   Production continues to load classic scripts at their original parser positions.
   Never use this helper as an application runtime dependency. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function readIndex(){
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  // Inline the unflagged foundation in virtual HTML tests, too.
  html=html.replace('<script src="./frontend/satria-procurement-core.js"></script>', '<script>'+fs.readFileSync(path.join(root,'frontend/satria-procurement-core.js'),'utf8')+'</script>');
  html=html.replace('<script src="./frontend/refactor/js/00-core-guards.js"></script>', '<script>'+fs.readFileSync(path.join(root,'frontend/refactor/js/00-core-guards.js'),'utf8')+'</script>');
  for(const name of ['satria-document-templates.js','satria-view-performance.js','satria-cloud-delta.js','satria-cloud-admin-create.js','satria-cloud-admin-roster.js']){
    html=html.replace('<script src="./frontend/'+name+'"></script>', '<script>'+fs.readFileSync(path.join(root,'frontend',name),'utf8')+'</script>');
  }
  for(const name of ['satria-shared-modal-ui.css','satria-stage4-ux.css']){
    html=html.replace('<link rel="stylesheet" href="./frontend/'+name+'">', '<style>'+fs.readFileSync(path.join(root,'frontend',name),'utf8')+'</style>');
  }
  html=html.replace(/<script([^>]*?)\s+src="(\.\/frontend\/refactor\/js\/[^"<>]+\.js)"\s+data-satria-refactor="script"><\/script>/g,(_,attrs,src)=>{
    const text=fs.readFileSync(path.join(root,src),'utf8');
    return '<script'+attrs+'>'+text+'</script>';
  });
  html=html.replace(/<link rel="stylesheet" href="(\.\/frontend\/refactor\/css\/[^"<>]+\.css)" data-satria-refactor="style">/g,(_,src)=>{
    const text=fs.readFileSync(path.join(root,src),'utf8');
    return '<style>'+text+'</style>';
  });
  return html;
}
module.exports={readIndex};

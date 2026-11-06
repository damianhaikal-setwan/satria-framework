'use strict';
/* Reconstruct a *virtual* single-file HTML string for legacy regression tests.
   Production continues to load classic scripts at their original parser positions.
   Never use this helper as an application runtime dependency. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function readIndex(){
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
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

'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const idx=read('index.html'),sw=read('sw.js'),ops=read('frontend/refactor/js/31-satria-ops-v2.js');
const core=read('frontend/refactor/js/01-app-core.js'),sx=read('frontend/satria-next4.js');
const sql=read('supabase/tests/priority1_staging_security_readonly.sql');
assert(idx.includes('satria-operational-integrity.js')&&sw.includes('satria-operational-integrity.js'),'loader/PWA must include new module');
assert(idx.indexOf('satria-operational-integrity.js')<idx.indexOf('31-satria-ops-v2.js'),'load integrity before ops');
assert(ops.includes('SATRIA_OPERATIONAL_INTEGRITY?.inspect')&&ops.includes('satriaOpsRiskSummary()'),'ops must consume common integrity results');
for(const menu of ['dash','paket','kerja','kalk','input','spse','monitor','finance','quality','brief','satria360','dok','lap','master','set','care','user','panduan','chat','sampah']){
 assert(core.includes("'"+menu+"'"),`missing route ${menu}`);
}
assert(core.includes('aria-current="page"'),'active route requires aria-current');
assert(idx.includes('satria-skip-to-main')&&idx.includes('<main id="main" tabindex="-1">'),'accessible skip-to-content');
assert(sx.includes('checkNotice')&&sx.includes('SATRIA_OPERATIONAL_INTEGRITY?.inspect'),'Satria360 integrity indicator');
assert(/to_regclass\(/i.test(sql)&&/to_regprocedure\(/i.test(sql)&&/COALESCE\(\(SELECT relrowsecurity/i.test(sql),'safe staging introspection');
assert(!/\b(?:insert|update|delete|drop|alter|create|truncate)\s+(?:table|function|into|public\.)/i.test(sql.replace(/^--.*$/gm,'')),'read-only SQL only');
console.log('PASS Priority1-4: shared checks, 20 routes, a11y, cache, Stage10 read-only SQL contract');

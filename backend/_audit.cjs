const API='https://acemco-hotel-api.vercel.app/api';
const j=async(p,o={})=>{const r=await fetch(API+p,{...o,headers:{'Content-Type':'application/json',...(o.headers||{})}});return {status:r.status, body:await r.json().catch(()=>null)};};
const P=(c,m)=>console.log((c?'  PASS   ':'  **FAIL** ')+m);
(async()=>{
  const T=(await j('/v1/auth/login',{method:'POST',body:JSON.stringify({email:'super@acemco.com',password:'Admin123!'})})).body?.data?.accessToken;
  const auth={Authorization:'Bearer '+T};

  // A limited account, so we can prove attribution AND a denied attempt.
  const role=(await j('/v1/roles',{method:'POST',headers:auth,body:JSON.stringify({
    name:'ZZ Audit Probe', description:'temp', permissions:['reservations:VIEW']})})).body?.data;
  await j('/v1/users',{method:'POST',headers:auth,body:JSON.stringify({
    name:'ZZ Probe User', email:'zz.probe@acemco.test', password:'ProbePass123!', roleIds:[role.id]})});
  const probe=(await j('/v1/auth/login',{method:'POST',body:JSON.stringify({email:'zz.probe@acemco.test',password:'ProbePass123!'})})).body?.data;
  const pauth={Authorization:'Bearer '+probe.accessToken};

  // The probe tries something it is NOT allowed to do.
  const denied = await j('/v1/tax/rates',{method:'POST',headers:pauth,body:JSON.stringify({
    name:'Sneaky', code:'SNEAK', rate:99, appliesTo:['ROOM']})});
  console.log('probe attempts to create a tax rate ->', denied.status, '(expect 403)');

  // A failed login (wrong password) — the brute-force signal.
  await j('/v1/auth/login',{method:'POST',body:JSON.stringify({email:'zz.probe@acemco.test',password:'WRONG'})});

  await new Promise(r=>setTimeout(r,2500)); // audit writes are async

  const logs=(await j('/v1/audit-logs?pageSize=25',{headers:auth})).body?.data;
  console.log('\n=== AUDIT TRAIL (most recent) ===');
  logs.slice(0,8).forEach(l=>console.log(
    `  ${new Date(l.occurredAt).toLocaleTimeString()}  ${String(l.outcome).padEnd(7)} ${String(l.action).padEnd(8)} ${String(l.module).padEnd(13)} ${String(l.user).padEnd(16)} ${l.ipAddress??'-'}`));

  const deniedRow = logs.find(l=>l.outcome==='DENIED' && l.module==='tax');
  P(!!deniedRow, 'DENIED attempt recorded (was invisible before)');
  if(deniedRow){
    P(deniedRow.user!=='System', `attributed to a person: ${deniedRow.user} (${deniedRow.userEmail})`);
    P(deniedRow.statusCode===403, `status code captured: ${deniedRow.statusCode}`);
    P(!!deniedRow.ipAddress, `IP captured: ${deniedRow.ipAddress}`);
    P(!!deniedRow.path, `endpoint captured: ${deniedRow.path}`);
  }

  const loginRow = logs.find(l=>l.module==='auth' && l.outcome==='SUCCESS');
  P(loginRow && loginRow.user!=='System', `login attributed: ${loginRow?.user} (was "System" before)`);

  const failedLogin = logs.find(l=>l.module==='auth' && l.outcome!=='SUCCESS');
  P(!!failedLogin, `failed login recorded: outcome=${failedLogin?.outcome} status=${failedLogin?.statusCode}`);

  // The critical safety check: no password anywhere in the trail.
  const raw = JSON.stringify(logs);
  P(!raw.includes('ProbePass123!') && !raw.includes('Admin123!') && !raw.includes('WRONG'),
    'NO password appears anywhere in the trail (redacted)');
  const pw = logs.find(l=>l.payload && JSON.stringify(l.payload).includes('redacted'));
  if(pw) console.log('    e.g. payload stored as:', JSON.stringify(pw.payload));

  // Filters
  const den=(await j('/v1/audit-logs?outcome=DENIED&pageSize=5',{headers:auth})).body;
  P((den.data||[]).every(l=>l.outcome==='DENIED'), `filter outcome=DENIED works (${den.meta?.total} total, paginated)`);
})();

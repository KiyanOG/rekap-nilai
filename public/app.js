"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- state ---------- */
let user=null,courses=[],active=null,mode='login',status='';
const timers={};
const cur=()=>courses.find(c=>c.id===active);
const setStatus=t=>{status=t;const e=$('#st');if(e)e.textContent=t};

/* ---------- API ---------- */
async function api(path,method='GET',body){
  const r=await fetch('/api/'+path,{method,credentials:'same-origin',
    headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok){const err=new Error(j.error||'Terjadi kesalahan ('+r.status+')');err.status=r.status;throw err}
  return j;
}

/* ---------- simpan otomatis ke database ---------- */
function queueSave(c){setStatus('Menyimpan…');clearTimeout(timers[c.id]);timers[c.id]=setTimeout(()=>flush(c),700)}
async function flush(c){
  clearTimeout(timers[c.id]);delete timers[c.id];
  try{
    await api('courses?id='+c.id,'PUT',{name:c.name,cols:c.cols,rows:c.rows});
    if(!Object.keys(timers).length)setStatus('Tersimpan');
  }catch(e){
    setStatus('Gagal menyimpan: '+e.message);
    if(e.status===401){user=null;courses=[];go('masuk')}
  }
}
addEventListener('pagehide',()=>{for(const id in timers){const c=courses.find(x=>x.id===id);
  if(c)fetch('/api/courses?id='+id,{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:c.name,cols:c.cols,rows:c.rows})})}});

/* ---------- routing lewat hash: #masuk #daftar #matkul #matkul-<id> ---------- */
function setHash(h){try{history.replaceState(null,'','#'+h)}catch(e){location.hash=h}}
function go(h){if(location.hash.slice(1)===h)route();else location.hash=h}
function route(){
  const h=location.hash.slice(1);
  if(!user){
    const w=h==='daftar'?'daftar':'masuk';
    mode=w==='daftar'?'register':'login';
    if(h!==w)setHash(w);
    authView();return;
  }
  const m=h.match(/^matkul-([0-9a-f-]{36})$/i);
  if(m&&courses.some(x=>x.id===m[1]))active=m[1];
  else if(!courses.some(x=>x.id===active))active=courses[0]?courses[0].id:null;
  appView();
}

/* ---------- login / daftar ---------- */
function authView(){
  const reg=mode==='register';
  $('#app').innerHTML=`<form class="auth" onsubmit="return false">
    <h1>Rekap Nilai</h1>
    <p class="sub">${reg?'Buat akun baru.':'Masuk untuk membuka rekap nilaimu.'}</p>
    <label for="u">Username</label><input id="u" autocomplete="username" required>
    <label for="p">Password</label><input id="p" type="password" autocomplete="${reg?'new-password':'current-password'}" required>
    <div class="err" id="er" role="alert"></div>
    <button class="primary full" id="go">${reg?'Daftar':'Masuk'}</button>
    <p class="alt">${reg?'Sudah punya akun?':'Belum punya akun?'} <a href="#${reg?'masuk':'daftar'}">${reg?'Masuk':'Daftar'}</a></p>
    <p class="note">Password disimpan sebagai hash (scrypt + salt acak), bukan teks asli. Datamu tersimpan di database dan bisa dibuka dari perangkat mana pun.</p>
  </form>`;
  const submit=async()=>{
    const u=$('#u').value.trim(),p=$('#p').value,er=$('#er'),b=$('#go');
    if(!u||!p){er.textContent='Isi username dan password.';return}
    b.disabled=true;er.textContent='';
    try{
      const r=await api('auth','POST',{action:reg?'register':'login',username:u,password:p});
      user=r.user;courses=(await api('courses')).courses;active=null;go('matkul');
    }catch(e){er.textContent=e.message;b.disabled=false}
  };
  $('#go').onclick=submit;
  $('#p').onkeydown=e=>{if(e.key==='Enter')submit()};
  $('#u').focus();
}

/* ---------- halaman utama ---------- */
function appView(){
  const c=cur();
  setHash(active?'matkul-'+active:'matkul');
  $('#app').innerHTML=`<div class="top"><h1>Rekap Nilai</h1><div class="who"><span class="status" id="st">${esc(status)}</span><span>${esc(user)}</span><button class="ghost" id="lo">Keluar</button></div></div>
  <div class="layout">
    <aside class="side"><h2>Mata kuliah</h2>
      <div class="add"><input id="nc" placeholder="Nama matkul"><button class="primary" id="ac">Tambah</button></div>
      <ul class="list">${courses.map(x=>`<li data-id="${x.id}" class="${x.id===active?'on':''}"><span>${esc(x.name)}</span><button class="ghost danger" data-del="${x.id}" title="Hapus matkul">✕</button></li>`).join('')||'<li class="none">Belum ada matkul</li>'}</ul>
    </aside>
    <main class="main" id="main">${c?courseView(c):'<div class="empty">Tambahkan mata kuliah di sebelah kiri untuk mulai.</div>'}</main>
  </div>`;
  $('#lo').onclick=async()=>{
    await Promise.all(Object.keys(timers).map(id=>flush(courses.find(x=>x.id===id))));
    try{await api('auth','POST',{action:'logout'})}catch(e){}
    user=null;courses=[];active=null;status='';go('masuk');
  };
  const add=async()=>{
    const n=$('#nc').value.trim();if(!n)return;
    try{const r=await api('courses','POST',{name:n});courses.push(r.course);active=r.course.id;appView()}
    catch(e){setStatus(e.message)}
  };
  $('#ac').onclick=add;$('#nc').onkeydown=e=>{if(e.key==='Enter')add()};
  document.querySelectorAll('.list li[data-id]').forEach(li=>li.onclick=async e=>{
    const d=e.target.dataset.del;
    if(d){
      if(e.target.dataset.arm!=='1'){e.target.dataset.arm='1';e.target.textContent='Yakin?';return}
      try{await api('courses?id='+d,'DELETE')}catch(err){setStatus(err.message);return}
      clearTimeout(timers[d]);delete timers[d];
      courses=courses.filter(x=>x.id!==d);
      if(active===d)active=courses[0]?courses[0].id:null;
      appView();return;
    }
    active=li.dataset.id;appView();
  });
  if(c)bindCourse(c);
}

function courseView(c){
  return `<h2>Rekap</h2><div class="title">${esc(c.name)}</div>
  <div class="tools">
    <div class="col"><input id="ncol" placeholder="Kolom nilai baru, mis. Tugas"><button id="acol">Tambah kolom</button></div>
    <button id="arow">Tambah baris</button><button id="imp">Impor nama</button><button class="primary" id="xl">Download Excel</button>
  </div>
  <div class="tablebox"><table><thead><tr><th>No</th><th>Nama</th><th>NIM</th>${c.cols.map((k,i)=>`<th>${esc(k)}<button data-rc="${i}" title="Hapus kolom">✕</button></th>`).join('')}<th></th></tr></thead>
  <tbody>${c.rows.map((r,i)=>`<tr><td class="no">${i+1}</td><td><input data-r="${i}" data-f="name" value="${esc(r.name)}" aria-label="Nama"></td><td><input data-r="${i}" data-f="nim" value="${esc(r.nim)}" aria-label="NIM" inputmode="numeric"></td>${c.cols.map((k,j)=>`<td><input data-r="${i}" data-c="${j}" value="${esc(r.s[k])}" aria-label="${esc(k)}" inputmode="decimal"></td>`).join('')}<td class="del"><button data-dr="${i}" title="Hapus baris">✕</button></td></tr>`).join('')}</tbody></table>
  ${c.rows.length?'':'<div class="empty">Belum ada mahasiswa. Tambah baris atau impor banyak nama.</div>'}</div>`;
}

function bindCourse(c){
  const m=$('#main');
  m.oninput=e=>{const t=e.target,r=c.rows[t.dataset.r];if(!r)return;
    if(t.dataset.f)r[t.dataset.f]=t.value;else r.s[c.cols[t.dataset.c]]=t.value;queueSave(c)};
  m.onclick=e=>{const t=e.target;
    if(t.dataset.rc!==undefined){
      if(t.dataset.arm!=='1'){t.dataset.arm='1';t.textContent='Yakin?';return}
      const k=c.cols[t.dataset.rc];c.cols.splice(t.dataset.rc,1);c.rows.forEach(r=>delete r.s[k]);queueSave(c);appView();
    }
    if(t.dataset.dr!==undefined){c.rows.splice(t.dataset.dr,1);queueSave(c);appView()}
  };
  const addCol=()=>{const n=$('#ncol').value.trim();if(!n)return;
    if(c.cols.some(k=>k.toLowerCase()===n.toLowerCase())){$('#ncol').value='';$('#ncol').placeholder='Kolom itu sudah ada';return}
    c.cols.push(n);queueSave(c);appView();
    const s=$('.tablebox');if(s)s.scrollLeft=s.scrollWidth;$('#ncol').focus();
  };
  $('#acol').onclick=addCol;$('#ncol').onkeydown=e=>{if(e.key==='Enter')addCol()};
  $('#arow').onclick=()=>{c.rows.push({name:'',nim:'',s:{}});queueSave(c);appView()};
  $('#imp').onclick=()=>{$('#bulk').value='';$('#dlg').showModal()};
  $('#bc').onclick=()=>$('#dlg').close();
  $('#bo').onclick=()=>{
    $('#bulk').value.split(/\r?\n/).forEach(l=>{if(!l.trim())return;
      const p=l.split(/\t|,|;/).map(x=>x.trim());c.rows.push({name:p[0]||'',nim:p[1]||'',s:{}})});
    $('#dlg').close();queueSave(c);appView();
  };
  $('#xl').onclick=()=>{
    const aoa=[['No','Nama','NIM',...c.cols],...c.rows.map((r,i)=>[i+1,r.name,r.nim,...c.cols.map(k=>{const v=r.s[k];return v!==undefined&&v!==''&&!isNaN(v)?Number(v):(v||'')})])];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),c.name.replace(/[\[\]:*?\/\\]/g,' ').slice(0,31)||'Nilai');
    XLSX.writeFile(wb,'Nilai '+c.name.replace(/[\/\\:*?"<>|]/g,' ')+'.xlsx');
  };
}

/* ---------- mulai ---------- */
(async()=>{
  $('#app').innerHTML='<p style="text-align:center;margin-top:20vh;color:var(--mute)">Memuat…</p>';
  try{user=(await api('auth')).user;courses=(await api('courses')).courses}catch(e){user=null;courses=[]}
  route();
  addEventListener('hashchange',route);
})();

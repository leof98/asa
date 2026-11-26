'use strict';
// Tela inicial do Asa: planos de voo, locais próximos, modelos, configurações, previsão do tempo e atualização.
const $=id=>document.getElementById(id);
const REPO='leof98/asa';
let INFO={},CFG={},PROJ=[],MOD=[],LOC=[],FILTRO='todos',TIPO='foto',ABA='projetos';

/* ---------- abas ---------- */
function aba(nome){
  document.querySelectorAll('.asanav button').forEach(b=>{if(b.dataset.aba===nome)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  document.querySelectorAll('main>section').forEach(s=>s.hidden=s.dataset.sec!==nome);
  ABA=nome;
  $('btNovo').textContent=nome==='locais'?'+ Nova lista de locais':'+ Novo plano';
  try{history.replaceState(null,'',nome==='projetos'?'index.html':'#'+nome)}catch(e){}
  if(nome==='modelos')carregarModelos();
  if(nome==='locais')carregarLocais();
}
document.querySelector('.asanav').addEventListener('click',e=>{const a=e.target.dataset.aba;if(a)aba(a)});

/* ---------- projetos ---------- */
function lerProjeto(r){
  let d={};try{const j=JSON.parse(r.texto);d=j.projeto||j}catch(e){}
  return{arquivo:r.arquivo,modificado:r.modificado,miniatura:r.miniatura||null,d,
    nome:d.name||r.arquivo.replace(/\.asa$/,''),tipo:d.kind==='video'?'video':'foto',addr:d.addr||'',iso:d.dateISO||'',data:d.date||'',lat:d.lat,lon:d.lon,wx:d.wxCfg};
}
async function carregarProjetos(){
  try{PROJ=(await ASA.chamar('proj.listar')).map(lerProjeto).sort((a,b)=>b.modificado-a.modificado)}
  catch(e){PROJ=[];aviso('Não consegui ler os projetos: '+e.message,{tipo:'erro'})}
  desenharLista();
}
const prevKey=p=>`${(+p.lat).toFixed(4)},${(+p.lon).toFixed(4)},${p.iso}`;
function chipPrev(p){
  if(!p.iso)return p.data?`<span class="chip"><i class="dot g"></i>${escH(p.data)}</span>`:`<span class="chip"><i class="dot g"></i>Sem data</span>`;
  if(p.iso<hojeISO())return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)} · passou</span>`;
  const c=(CFG.prev||{})[prevKey(p)];
  if(!c)return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)}</span>`;
  if(c.estado==='chuva')return`<span class="chip"><i class="dot r"></i>Chuva prevista · ${ddmm(p.iso)}</span>`;
  if(c.estado==='ok')return`<span class="chip"><i class="dot"></i>Sem chuva · ${ddmm(p.iso)}</span>`;
  return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)}</span>`;
}
function desenharLista(){
  const q=$('busca').value.trim().toLowerCase();
  const l=PROJ.filter(p=>(FILTRO==='todos'||(FILTRO==='marcada'?p.iso>=hojeISO():p.tipo===FILTRO))&&(!q||(p.nome+' '+p.addr).toLowerCase().includes(q)));
  $('titLista').textContent=PROJ.length?(q||FILTRO!=='todos'?`${l.length} de ${PROJ.length} projetos`:'Recentes'):'Projetos';
  $('lista').innerHTML=l.map((p,i)=>`<div class="card" role="button" tabindex="0" data-i="${PROJ.indexOf(p)}">
      <div class="th${p.miniatura?'':' vazio'}" ${p.miniatura?`style="background-image:url('${p.miniatura}')"`:''}>${p.miniatura?'':'<img src="asa.svg" alt="">'}<span class="chip tag">${p.tipo==='video'?'Vídeo':'Fotos'}</span></div>
      <button type="button" class="sec mais" data-mais="1" aria-label="Mais opções de ${escH(p.nome)}">⋯</button>
      <div class="in"><b>${escH(p.nome)}</b><div class="meta">${escH(p.addr)||'&nbsp;'}</div><div class="ft">${chipPrev(p)}</div></div>
    </div>`).join('')+`<button type="button" class="novo" id="cardNovo"><div><span>+</span>Novo plano<br><small style="font-weight:400">de fotos ou de vídeo</small></div></button>`;
  if(!PROJ.length)$('lista').insertAdjacentHTML('afterbegin','<p class="vazio-txt" style="grid-column:1/-1">Nenhum projeto ainda. Crie um plano novo ou importe os que você exportou do gerador antigo.</p>');
}
$('busca').addEventListener('input',desenharLista);
document.querySelector('.bar2').addEventListener('click',e=>{const f=e.target.dataset.f;if(!f)return;FILTRO=f;document.querySelectorAll('.pill').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===f));desenharLista()});

async function abrirProjeto(p){
  try{
    const texto=await ASA.chamar('proj.ler',{arquivo:p.arquivo});
    localStorage.setItem('asa.abrir',JSON.stringify({arquivo:p.arquivo,texto}));
    location.href='gerador.html';
  }catch(e){aviso('Não consegui abrir o projeto: '+e.message,{tipo:'erro'})}
}
let menuAberto=null;
function fecharMenu(){if(menuAberto){menuAberto.remove();menuAberto=null}}
document.addEventListener('click',e=>{if(menuAberto&&!menuAberto.contains(e.target))fecharMenu()});
$('lista').addEventListener('click',e=>{
  if(e.target.closest('#cardNovo')){novoPlano();return}
  const card=e.target.closest('.card');if(!card)return;
  const p=PROJ[+card.dataset.i];
  if(e.target.closest('[data-mais]')){
    e.stopPropagation();fecharMenu();
    const m=document.createElement('div');m.className='menu';
    m.innerHTML=`<button type="button" data-m="abrir">Abrir</button><button type="button" data-m="pasta">Pasta dos arquivos (PDF, Word, vídeos)</button><button type="button" data-m="dup">Duplicar</button><button type="button" data-m="del" class="perigo">Excluir</button>`;
    card.appendChild(m);menuAberto=m;
    m.addEventListener('click',async ev=>{
      ev.stopPropagation();const a=ev.target.dataset.m;if(!a)return;
      if(a==='abrir'){fecharMenu();abrirProjeto(p)}
      if(a==='pasta'){fecharMenu();ASA.chamar('pasta.projeto',{nome:p.nome})}
      if(a==='dup'){fecharMenu();try{await ASA.chamar('proj.duplicar',{arquivo:p.arquivo,nome:p.nome+' (cópia)'});aviso('Projeto duplicado.');carregarProjetos()}catch(er){aviso('Não consegui duplicar: '+er.message,{tipo:'erro'})}}
      if(a==='del'){
        if(!ev.target.dataset.c){ev.target.dataset.c=1;ev.target.textContent='Confirmar: mandar para a Lixeira';return}
        fecharMenu();try{await ASA.chamar('proj.excluir',{arquivo:p.arquivo});aviso(`"${p.nome}" foi para a Lixeira do Windows.`);carregarProjetos()}catch(er){aviso('Não consegui excluir: '+er.message,{tipo:'erro'})}
      }
    });
    return;
  }
  abrirProjeto(p);
});
$('lista').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('card'))e.target.click()});
$('btPasta').addEventListener('click',()=>ASA.chamar('abrir',{caminho:INFO.pastaProjetos}));

/* ---------- importar (cópias de segurança do gerador antigo) ---------- */
$('btImportar').addEventListener('click',()=>$('arqImportar').click());
$('arqImportar').addEventListener('change',async e=>{
  const fs=[...e.target.files];e.target.value='';let n=0;
  for(const f of fs){
    try{
      const j=JSON.parse(await f.text());const d=j.projeto||(j.data&&j.name?j.data:null)||j;
      if(!d||typeof d!=='object'||!('lat' in d))throw new Error('não é um projeto do plano de voo');
      const arquivo=await ASA.chamar('proj.gravar',{arquivo:'',texto:JSON.stringify({app:'asa',versao:1,projeto:d}),nome:d.name||f.name.replace(/\.\w+$/,'')});
      for(const [id,url] of Object.entries(j.fotos||{}))await ASA.chamar('foto.gravar',{arquivo,id,dados:url});
      n++;
    }catch(er){aviso(`${f.name}: ${er.message}`,{tipo:'erro',ms:10000})}
  }
  if(n){aviso(n===1?'1 projeto importado.':`${n} projetos importados.`);carregarProjetos()}
});

/* ---------- novo plano ---------- */
async function novoPlano(){
  try{MOD=(await ASA.chamar('modelo.listar')).map(lerModelo)}catch(e){MOD=[]}
  $('novoNome').value='';TIPO='foto';syncNovo();$('dlgNovo').hidden=false;setTimeout(()=>$('novoNome').focus(),30);
}
function syncNovo(){
  $('novoTipo').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TIPO));
  const ms=MOD.filter(m=>m.tipo===TIPO);
  $('novoModelo').innerHTML=`<option value="">Em branco</option>`+ms.map(m=>`<option value="${MOD.indexOf(m)}">Modelo: ${escH(m.nome)}</option>`).join('');
}
$('btNovo').addEventListener('click',()=>ABA==='locais'?novoLocais():novoPlano());
$('novoTipo').addEventListener('click',e=>{const t=e.target.dataset.t;if(t){TIPO=t;syncNovo()}});
$('novoCancelar').addEventListener('click',()=>$('dlgNovo').hidden=true);
$('dlgNovo').addEventListener('keydown',e=>{if(e.key==='Escape')$('dlgNovo').hidden=true;if(e.key==='Enter'&&e.target.id==='novoNome')$('novoCriar').click()});
$('novoCriar').addEventListener('click',()=>{
  const nome=$('novoNome').value.trim()||'Novo projeto',mi=$('novoModelo').value;
  localStorage.setItem('asa.abrir',JSON.stringify({novo:true,tipo:TIPO,nome,modelo:mi!==''?MOD[+mi].d:null}));
  location.href='gerador.html';
});

/* ---------- locais próximos ---------- */
const PADRAO={eco:'Econômico',med:'Padrão médio',alto:'Alto padrão'};
const temTerreno=d=>d&&d.lat!=null&&d.lon!=null&&isFinite(d.lat)&&isFinite(d.lon);
function lerLocais(r){
  let d={};try{const j=JSON.parse(r.texto);d=j.locais||j}catch(e){}
  const ps=Array.isArray(d.places)?d.places:[],on=ps.filter(p=>p.on);
  const ok=temTerreno(d)?`${(+d.lat).toFixed(5)},${(+d.lon).toFixed(5)}`:'';
  return{arquivo:r.arquivo,modificado:r.modificado,d,nome:d.name||r.arquivo.replace(/\.asa$/,''),addr:d.addr||'',
    total:ps.length,marcados:on.length,faltam:on.filter(p=>p.at!==ok).length};
}
async function carregarLocais(){
  try{LOC=(await ASA.chamar('proj.listar',{pasta:'locais'})).map(lerLocais).sort((a,b)=>b.modificado-a.modificado)}
  catch(e){LOC=[];aviso('Não consegui ler os locais: '+e.message,{tipo:'erro'})}
  desenharLocais();
}
// miniatura: o terreno no centro e os lugares em volta (marcados em destaque)
function radar(d){
  const W=300,H=140,cx=W/2,cy=H/2,R0=H/2-12;
  let h=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  for(const f of[1/3,2/3,1])h+=`<circle cx="${cx}" cy="${cy}" r="${(R0*f).toFixed(1)}" fill="none" stroke="#2a1f38" stroke-width="1"/>`;
  if(!temTerreno(d))return h+`<text x="${cx}" y="${cy+4}" fill="#6f6480" font-size="12" text-anchor="middle" font-family="Segoe UI,sans-serif">Sem terreno</text></svg>`;
  const k=Math.cos(d.lat*Math.PI/180);
  const pts=(d.places||[]).filter(p=>isFinite(p.lat)&&isFinite(p.lon)).map(p=>({on:!!p.on,x:(p.lon-d.lon)*k*111320,y:(p.lat-d.lat)*111320}));
  const ref=pts.some(p=>p.on)?pts.filter(p=>p.on):pts;
  const m=Math.max(300,...ref.map(p=>Math.hypot(p.x,p.y))),sc=R0/m;
  for(const p of pts.filter(p=>!p.on))h+=`<circle cx="${(cx+p.x*sc).toFixed(1)}" cy="${(cy-p.y*sc).toFixed(1)}" r="2" fill="#3f3352"/>`;
  for(const p of pts.filter(p=>p.on))h+=`<circle cx="${(cx+p.x*sc).toFixed(1)}" cy="${(cy-p.y*sc).toFixed(1)}" r="3.6" fill="#ee84d6"/>`;
  return h+`<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="#b518d6" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff"/></svg>`;
}
function chipsLocais(l){
  if(!temTerreno(l.d))return'<span class="chip"><i class="dot a"></i>Falta o terreno</span>';
  if(!l.total)return'<span class="chip"><i class="dot g"></i>Sem busca ainda</span>';
  const m=`<span class="chip"><i class="dot${l.marcados?'':' g'}"></i>${l.marcados} marcado${l.marcados===1?'':'s'}</span>`;
  return m+(l.marcados?(l.faltam?`<span class="chip"><i class="dot a"></i>Faltam ${l.faltam} tempo${l.faltam>1?'s':''}</span>`:'<span class="chip"><i class="dot"></i>Tempos ok</span>'):'');
}
function desenharLocais(){
  const q=$('buscaL').value.trim().toLowerCase();
  const l=LOC.filter(x=>!q||(x.nome+' '+x.addr).toLowerCase().includes(q));
  $('titListaL').textContent=LOC.length?(q?`${l.length} de ${LOC.length}`:'Recentes'):'Locais próximos';
  $('listaL').innerHTML=l.map(x=>`<div class="card" role="button" tabindex="0" data-i="${LOC.indexOf(x)}">
      <div class="th loc">${radar(x.d)}<span class="chip tag">${PADRAO[x.d.std]||PADRAO.med}</span></div>
      <button type="button" class="sec mais" data-mais="1" aria-label="Mais opções de ${escH(x.nome)}">⋯</button>
      <div class="in"><b>${escH(x.nome)}</b><div class="meta">${escH(x.addr)||'&nbsp;'}</div><div class="ft">${chipsLocais(x)}</div></div>
    </div>`).join('')+`<button type="button" class="novo" id="cardNovoL"><div><span>+</span>Nova lista de locais<br><small style="font-weight:400">mercados, escolas, praias… perto do terreno</small></div></button>`;
  if(!LOC.length)$('listaL').insertAdjacentHTML('afterbegin','<p class="vazio-txt" style="grid-column:1/-1">Nenhuma lista ainda. Crie uma nova ou traga as do navegador em <b>Importar do navegador</b>.</p>');
}
$('buscaL').addEventListener('input',desenharLocais);
async function abrirLocais(x){
  try{
    const texto=await ASA.chamar('proj.ler',{pasta:'locais',arquivo:x.arquivo});
    localStorage.setItem('asa.locais',JSON.stringify({arquivo:x.arquivo,texto}));
    location.href='locais.html';
  }catch(e){aviso('Não consegui abrir: '+e.message,{tipo:'erro'})}
}
$('listaL').addEventListener('click',e=>{
  if(e.target.closest('#cardNovoL')){novoLocais();return}
  const card=e.target.closest('.card');if(!card)return;
  const x=LOC[+card.dataset.i];
  if(e.target.closest('[data-mais]')){
    e.stopPropagation();fecharMenu();
    const m=document.createElement('div');m.className='menu';
    m.innerHTML=`<button type="button" data-m="abrir">Abrir</button><button type="button" data-m="pasta">Pasta dos arquivos (PDF, Word)</button><button type="button" data-m="dup">Duplicar</button><button type="button" data-m="del" class="perigo">Excluir</button>`;
    card.appendChild(m);menuAberto=m;
    m.addEventListener('click',async ev=>{
      ev.stopPropagation();const a=ev.target.dataset.m;if(!a)return;
      if(a==='abrir'){fecharMenu();abrirLocais(x)}
      if(a==='pasta'){fecharMenu();ASA.chamar('pasta.projeto',{nome:x.nome})}
      if(a==='dup'){fecharMenu();try{await ASA.chamar('proj.duplicar',{pasta:'locais',arquivo:x.arquivo,nome:x.nome+' (cópia)'});aviso('Lista duplicada.');carregarLocais()}catch(er){aviso('Não consegui duplicar: '+er.message,{tipo:'erro'})}}
      if(a==='del'){
        if(!ev.target.dataset.c){ev.target.dataset.c=1;ev.target.textContent='Confirmar: mandar para a Lixeira';return}
        fecharMenu();try{await ASA.chamar('proj.excluir',{pasta:'locais',arquivo:x.arquivo});aviso(`"${x.nome}" foi para a Lixeira do Windows.`);carregarLocais()}catch(er){aviso('Não consegui excluir: '+er.message,{tipo:'erro'})}
      }
    });
    return;
  }
  abrirLocais(x);
});
$('listaL').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('card'))e.target.click()});
$('btPastaL').addEventListener('click',()=>ASA.chamar('abrir',{caminho:INFO.pastaLocais}));

// nova lista: o terreno pode vir de um plano de voo (só a posição e o endereço; as duas coisas seguem separadas)
let PLANOS_T=[];
function novoLocais(){
  PLANOS_T=PROJ.filter(p=>temTerreno(p)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
  $('locNome').value='';
  $('locPlano').innerHTML='<option value="">Buscar o endereço depois</option>'+PLANOS_T.map((p,i)=>`<option value="${i}">Do plano de voo: ${escH(p.nome)}</option>`).join('');
  $('dlgLocais').hidden=false;setTimeout(()=>$('locNome').focus(),30);
}
$('locPlano').addEventListener('change',e=>{const p=PLANOS_T[+e.target.value];if(p&&!$('locNome').value.trim())$('locNome').value=p.nome});
$('locCancelar').addEventListener('click',()=>$('dlgLocais').hidden=true);
$('dlgLocais').addEventListener('keydown',e=>{if(e.key==='Escape')$('dlgLocais').hidden=true;if(e.key==='Enter'&&e.target.id==='locNome')$('locCriar').click()});
$('locCriar').addEventListener('click',()=>{
  const v=$('locPlano').value,p=v!==''?PLANOS_T[+v]:null;
  const nome=$('locNome').value.trim()||(p&&p.nome)||'Novo empreendimento';
  localStorage.setItem('asa.locais',JSON.stringify({novo:true,nome,plano:p?{lat:+p.lat,lon:+p.lon,addr:p.addr||'',name:p.nome}:null}));
  location.href='locais.html';
});

// importar do Locais Próximos do navegador (o comando não leva a chave do Google)
const CMD_IMP=`copy(JSON.stringify({asaLocais:1,projetos:JSON.parse(localStorage.getItem('locais.projetos')||'{}'),ajustes:(g=>{delete g.key;return g})(JSON.parse(localStorage.getItem('locais.v1')||'{}'))}))`;
$('impCmd').textContent=CMD_IMP;
$('btImportarL').addEventListener('click',()=>{$('impTexto').value='';$('dlgImpL').hidden=false;setTimeout(()=>$('impTexto').focus(),30)});
$('impCopiar').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(CMD_IMP);$('impCopiar').textContent='Copiado'}
  catch(e){const r=document.createRange();r.selectNodeContents($('impCmd'));const s=getSelection();s.removeAllRanges();s.addRange(r)}
  setTimeout(()=>$('impCopiar').textContent='Copiar',2500);
});
$('impCancelar').addEventListener('click',()=>$('dlgImpL').hidden=true);
$('dlgImpL').addEventListener('keydown',e=>{if(e.key==='Escape')$('dlgImpL').hidden=true});
$('impOk').addEventListener('click',async()=>{
  let j;try{j=JSON.parse($('impTexto').value.trim())}catch(e){aviso('O texto colado não é o que o comando copia. Rode o comando de novo e cole aqui.',{tipo:'erro',ms:9000});return}
  const lib=j.projetos||j,lista=Object.values((lib&&lib.list)||{}).filter(d=>d&&typeof d==='object'&&Array.isArray(d.places));
  const aj=j.ajustes||null;
  if(!lista.length&&!aj){aviso('Não achei listas de locais no texto colado.',{tipo:'erro'});return}
  $('impOk').disabled=true;let n=0;
  try{
    const existentes=new Set(LOC.map(x=>x.nome.toLowerCase()));
    for(const d of lista){
      if(existentes.has(String(d.name||'').toLowerCase()))continue;   // já está no Asa
      await ASA.chamar('proj.gravar',{pasta:'locais',arquivo:'',texto:JSON.stringify({app:'asa',tipo:'locais',versao:1,locais:d},(k,v)=>k&&k[0]==='_'?undefined:v),nome:d.name||'Sem nome'});n++;
    }
    let nf=0;
    if(aj){
      const cur=Object.assign({},CFG.locais||{});delete aj.key;
      const fx=cur.fixed||[],gids=new Set(fx.map(f=>f.gid));
      for(const f of aj.fixed||[])if(f&&f.gid&&!gids.has(f.gid)){fx.push(f);gids.add(f.gid);nf++}
      cur.fixed=fx;
      if(cur.chains==null&&aj.chains!=null)cur.chains=aj.chains;
      if(cur.radius==null&&aj.radius!=null)cur.radius=aj.radius;
      CFG.locais=cur;await ASA.chamar('config.gravar',{locais:cur});
      localStorage.setItem('asa.locais.ajustes',JSON.stringify(cur));
    }
    $('dlgImpL').hidden=true;
    const pul=lista.length-n;
    aviso(`${n} lista${n===1?'':'s'} importada${n===1?'':'s'}${pul?` (${pul} já estava${pul===1?'':'m'} no Asa)`:''}${nf?`, ${nf} lugar${nf===1?'':'es'} fixo${nf===1?'':'s'}`:''}.`,{ms:9000});
    carregarLocais();
  }catch(e){aviso('A importação parou: '+e.message,{tipo:'erro'})}
  finally{$('impOk').disabled=false}
});

/* ---------- modelos ---------- */
function lerModelo(r){let d={};try{const j=JSON.parse(r.texto);d=j.projeto||j}catch(e){}return{arquivo:r.arquivo,d,nome:d._modelo||r.arquivo.replace(/\.asa$/,''),tipo:d.kind==='video'?'video':'foto'}}
async function carregarModelos(){
  try{MOD=(await ASA.chamar('modelo.listar')).map(lerModelo)}catch(e){MOD=[]}
  $('modelos').innerHTML=MOD.length?MOD.map((m,i)=>`<div class="modelo"><span class="chip">${m.tipo==='video'?'Vídeo':'Fotos'}</span><b>${escH(m.nome)}</b><button type="button" class="sec" data-del="${i}">Excluir</button></div>`).join(''):'<p class="vazio-txt">Nenhum modelo ainda.</p>';
}
$('modelos').addEventListener('click',async e=>{
  const i=e.target.dataset.del;if(i==null)return;
  if(!e.target.dataset.c){e.target.dataset.c=1;e.target.textContent='Confirmar';return}
  await ASA.chamar('modelo.excluir',{arquivo:MOD[+i].arquivo});carregarModelos();
});

/* ---------- configurações ---------- */
function chaveParaGerador(k){
  // o gerador lê a chave das preferências dele (no perfil do Asa); a cópia protegida fica com o programa
  try{const v=JSON.parse(localStorage.getItem('planovoo.v1')||'{}');v.key=k||'';v.hideTop=true;localStorage.setItem('planovoo.v1',JSON.stringify(v))}catch(e){}
}
function syncChips(){
  const tem=!!CFG.chave;
  $('chGoogle').innerHTML=`<i class="dot${tem?'':' a'}"></i>${tem?'Google conectado':'Falta a chave do Google'}`;
}
$('chGoogle').addEventListener('click',()=>aba('config'));
$('cfgVer').addEventListener('click',()=>{const i=$('cfgChave');i.type=i.type==='password'?'text':'password';$('cfgVer').textContent=i.type==='password'?'Mostrar':'Ocultar'});
$('cfgSalvarChave').addEventListener('click',async()=>{
  const k=$('cfgChave').value.trim();
  try{await ASA.chamar('config.gravar',{chave:k});CFG.chave=k;chaveParaGerador(k);syncChips();aviso(k?'Chave salva.':'Chave removida.');verificarPrevisoes(true)}
  catch(e){aviso('Não consegui salvar a chave: '+e.message,{tipo:'erro'})}
});
$('cfgAvisos').addEventListener('change',e=>{CFG.avisos=e.target.checked;ASA.chamar('config.gravar',{avisos:CFG.avisos})});
$('cfgAbrirPasta').addEventListener('click',()=>ASA.chamar('abrir',{caminho:INFO.pastaAsa}));

/* ---------- previsão das captações marcadas ---------- */
async function verificarPrevisoes(forcar){
  if(!CFG.chave)return;
  const hoje=hojeISO(),lim=new Date();lim.setDate(lim.getDate()+10);
  const limISO=`${lim.getFullYear()}-${String(lim.getMonth()+1).padStart(2,'0')}-${String(lim.getDate()).padStart(2,'0')}`;
  const alvos=PROJ.filter(p=>p.iso&&p.iso>=hoje&&p.iso<=limISO&&isFinite(p.lat)&&isFinite(p.lon));
  CFG.prev=CFG.prev||{};let mudou=false,feitas=0;
  for(const p of alvos){
    const k=prevKey(p),c=CFG.prev[k];
    if(!forcar&&c&&Date.now()-c.at<3*3600e3)continue;
    try{
      const r=await previsaoDia(CFG.chave,p.lat,p.lon,p.iso,p.wx);feitas++;
      if(r.estado==='chuva'&&c&&c.estado==='ok'&&CFG.avisos!==false)
        ASA.chamar('notificar',{titulo:`Chuva prevista: ${p.nome}`,texto:`A previsão para a captação de ${ddmm(p.iso)} mudou para chuva.`});
      CFG.prev[k]={estado:r.estado,at:Date.now()};mudou=true;
    }catch(e){if(/not been used|disabled|PERMISSION|403/i.test(e.message)){aviso('O Google recusou a previsão: ative a "Weather API" e libere-a na chave.',{tipo:'erro',ms:10000});break}}
  }
  // limpa o que já passou
  for(const k of Object.keys(CFG.prev))if(k.slice(-10)<hoje){delete CFG.prev[k];mudou=true}
  if(mudou){ASA.chamar('config.gravar',{prev:CFG.prev});desenharLista()}
  if(alvos.length){const h=new Date();$('chPrev').hidden=false;$('chPrev').innerHTML=`<i class="dot${alvos.some(p=>(CFG.prev[prevKey(p)]||{}).estado==='chuva')?' r':''}"></i>Previsão às ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`}
}
setInterval(()=>verificarPrevisoes(false),3*3600e3);

/* ---------- atualização pelo GitHub ---------- */
const nv=v=>String(v||'').replace(/^v/,'').split('.').map(x=>parseInt(x)||0);
const maior=(a,b)=>{const x=nv(a),y=nv(b);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return(x[i]||0)>(y[i]||0)}return false};
let NOVA=null;
async function verificarAtualizacao(manual){
  try{
    const r=await fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json'}});
    if(!r.ok)throw new Error(r.status===404?'nenhuma versão publicada ainda':'HTTP '+r.status);
    const j=await r.json(),zip=(j.assets||[]).find(a=>/\.zip$/i.test(a.name));
    if(zip&&maior(j.tag_name,INFO.versao)){
      NOVA={versao:j.tag_name.replace(/^v/,''),url:zip.browser_download_url,notas:j.body||''};
      $('atuTxt').textContent=`Versão nova do Asa: ${NOVA.versao}${NOVA.notas?' · '+NOVA.notas.split('\n')[0]:''}`;$('atualiza').hidden=false;
      if(manual)$('cfgAtuTxt').textContent=`Versão ${NOVA.versao} disponível.`;
    }else if(manual)$('cfgAtuTxt').textContent='Você está na versão mais nova.';
  }catch(e){if(manual)$('cfgAtuTxt').textContent='Não consegui verificar: '+e.message}
}
$('cfgAtualizar').addEventListener('click',()=>verificarAtualizacao(true));
$('atuDepois').addEventListener('click',()=>$('atualiza').hidden=true);
$('atuGo').addEventListener('click',async()=>{
  if(!NOVA)return;$('atuGo').disabled=true;$('atuGo').textContent='Baixando…';
  try{await ASA.chamar('atualizar',{url:NOVA.url,versao:NOVA.versao})}
  catch(e){aviso('A atualização falhou: '+e.message,{tipo:'erro'});$('atuGo').disabled=false;$('atuGo').textContent='Atualizar agora'}
});

/* ---------- início ---------- */
(async function(){
  if(!ASA.noApp){document.querySelector('main').insertAdjacentHTML('afterbegin','<p class="vazio-txt">Abra pelo Asa.exe.</p>');return}
  try{INFO=await ASA.chamar('info')}catch(e){}
  try{CFG=await ASA.chamar('config.ler')||{}}catch(e){CFG={}}
  chaveParaGerador(CFG.chave);syncChips();
  if(CFG.locais)try{localStorage.setItem('asa.locais.ajustes',JSON.stringify(CFG.locais))}catch(e){}
  // Asa.exe antigo (sem a pasta Locais): a aba fica desligada até trocar o programa
  if(!INFO.pastaLocais){const b=document.querySelector('[data-aba=locais]');b.disabled=true;b.title='Precisa do Asa.exe novo (versão 0.2.0): feche e abra o Asa de novo';if(location.hash==='#locais')location.hash=''}
  $('cfgChave').value=CFG.chave||'';$('cfgAvisos').checked=CFG.avisos!==false;
  $('cfgPastaProj').textContent=INFO.pastaProjetos||'';$('cfgPastaLoc').textContent=INFO.pastaLocais||'';$('cfgPastaAsa').textContent=INFO.pastaAsa||'';$('cfgVersao').textContent=INFO.versao||'';
  await carregarProjetos();
  if(!CFG.chave)aba('config');
  else if(['locais','modelos','config'].includes(location.hash.slice(1)))aba(location.hash.slice(1));
  verificarPrevisoes(false);
  verificarAtualizacao(false);
})();

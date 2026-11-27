'use strict';
// Tela inicial do Asa: planos de voo, locais próximos, modelos, configurações e previsão do tempo.
const $=id=>document.getElementById(id);
let INFO={},CFG={},PROJ=[],MOD=[],LOC=[],TIPO='foto',ABA='projetos';

/* ---------- abas ---------- */
function aba(nome){
  document.querySelectorAll('.asanav button').forEach(b=>{if(b.dataset.aba===nome)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(nome==='modelos')nome='config'; // os modelos ficam dentro das configurações
  document.querySelectorAll('main>section').forEach(s=>s.hidden=s.dataset.sec!==nome);
  ABA=nome;
  if(nome==='config')$('btConfig').setAttribute('aria-current','page');else $('btConfig').removeAttribute('aria-current');
  try{history.replaceState(null,'',nome==='projetos'?'index.html':'#'+nome)}catch(e){}
  if(nome==='config')carregarModelos();
  if(nome==='locais')carregarLocais();
}
document.querySelector('.asanav').addEventListener('click',e=>{const a=e.target.dataset.aba;if(a)aba(a)});
$('btConfig').addEventListener('click',()=>aba(ABA==='config'?'projetos':'config'));

/* ---------- menu ⋯ das listas ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-menu]');if(!b)return;
  e.stopImmediatePropagation();const ja=menuAberto&&menuAberto.dataset.de===b.dataset.menu;fecharMenu();if(ja)return;
  const m=document.createElement('div');m.className='menu';m.dataset.de=b.dataset.menu;
  m.style.cssText=`position:fixed;right:${Math.round(innerWidth-b.getBoundingClientRect().right)}px;top:${Math.round(b.getBoundingClientRect().bottom+6)}px`;
  m.innerHTML=b.dataset.menu==='locais'?'<button type="button" data-a="pastaL">Abrir a pasta das listas</button>':'<button type="button" data-a="pasta">Abrir a pasta dos planos</button>';
  m.addEventListener('click',ev=>{const a=ev.target.dataset.a;fecharMenu();
    if(a==='pasta')ASA.chamar('abrir',{caminho:INFO.pastaProjetos});
    if(a==='pastaL')ASA.chamar('abrir',{caminho:INFO.pastaLocais});});
  document.body.appendChild(m);menuAberto=m;
});

/* ---------- projetos ---------- */
function lerProjeto(r){
  let d={};try{const j=JSON.parse(r.texto);d=j.projeto||j}catch(e){}
  return{arquivo:r.arquivo,modificado:r.modificado,d,
    nome:d.name||r.arquivo.replace(/\.asa$/,''),tipo:d.kind==='video'?'video':'foto',addr:d.addr||'',iso:d.dateISO||'',data:d.date||'',lat:d.lat,lon:d.lon,wx:d.wxCfg};
}
async function carregarProjetos(){
  try{PROJ=(await ASA.chamar('proj.listar')).map(lerProjeto).sort((a,b)=>b.modificado-a.modificado)}
  catch(e){PROJ=[];aviso('Não consegui ler os planos: '+e.message,{tipo:'erro'})}
  desenharLista();
}
const prevKey=p=>`${(+p.lat).toFixed(4)},${(+p.lon).toFixed(4)},${p.iso}`;
function chipPrev(p){
  if(!p.iso)return p.data?`<span class="chip"><i class="dot g"></i>${escH(p.data)}</span>`:'';
  if(p.iso<hojeISO())return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)} · passou</span>`;
  const c=(CFG.prev||{})[prevKey(p)];
  if(!c)return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)}</span>`;
  if(c.estado==='chuva')return`<span class="chip"><i class="dot r"></i>Chuva prevista · ${ddmm(p.iso)}</span>`;
  if(c.estado==='ok')return`<span class="chip"><i class="dot"></i>Sem chuva · ${ddmm(p.iso)}</span>`;
  return`<span class="chip"><i class="dot g"></i>Captação ${ddmm(p.iso)}</span>`;
}
function desenharLista(){
  const q=$('busca').value.trim().toLowerCase();
  const l=PROJ.filter(p=>!q||(p.nome+' '+p.addr).toLowerCase().includes(q));
  $('titLista').textContent=q?`${l.length} de ${PROJ.length}`:'';
  $('lista').innerHTML=l.map((p,i)=>`<div class="card" role="button" tabindex="0" data-i="${PROJ.indexOf(p)}">
      <div class="th vazio"><img src="asa.svg" alt="">${p.tipo==='video'?'<span class="video" title="Plano de vídeo"><svg viewBox="0 0 24 24" aria-label="Vídeo"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h10A1.5 1.5 0 0 1 16 6.5v2.3l4.2-2.6a.5.5 0 0 1 .8.4v10.8a.5.5 0 0 1-.8.4L16 15.2v2.3a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 17.5z"/></svg></span>':''}</div>
      <button type="button" class="sec mais" data-mais="1" aria-label="Mais opções de ${escH(p.nome)}">⋯</button>
      <div class="in"><b>${escH(p.nome)}</b><div class="meta">${escH(p.addr)||'&nbsp;'}</div><div class="ft">${chipPrev(p)}</div></div>
    </div>`).join('')+`<button type="button" class="novo" id="cardNovo"><div><span>+</span>Novo plano<br><small style="font-weight:400">de fotos ou de vídeo</small></div></button>`;
  if(!PROJ.length)$('lista').insertAdjacentHTML('afterbegin','<p class="vazio-txt" style="grid-column:1/-1">Nenhum plano ainda. Crie o primeiro no cartão abaixo.</p>');
}
$('busca').addEventListener('input',desenharLista);

async function abrirProjeto(p){
  try{
    const texto=await ASA.chamar('proj.ler',{arquivo:p.arquivo});
    localStorage.setItem('asa.abrir',JSON.stringify({arquivo:p.arquivo,texto}));
    location.href='gerador.html';
  }catch(e){aviso('Não consegui abrir o plano: '+e.message,{tipo:'erro'})}
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
    m.innerHTML=`<button type="button" data-m="abrir">Abrir</button><button type="button" data-m="pasta">Pasta do empreendimento</button><button type="button" data-m="dup">Duplicar</button><button type="button" data-m="del" class="perigo">Excluir</button>`;
    card.appendChild(m);menuAberto=m;
    m.addEventListener('click',async ev=>{
      ev.stopPropagation();const a=ev.target.dataset.m;if(!a)return;
      if(a==='abrir'){fecharMenu();abrirProjeto(p)}
      if(a==='pasta'){fecharMenu();ASA.chamar('pasta.projeto',{nome:p.nome})}
      if(a==='dup'){fecharMenu();try{await ASA.chamar('proj.duplicar',{arquivo:p.arquivo,nome:p.nome+' (cópia)'});aviso('Plano duplicado.');carregarProjetos()}catch(er){aviso('Não consegui duplicar: '+er.message,{tipo:'erro'})}}
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


/* ---------- novo plano ---------- */
// comModelo: o arquivo do modelo já escolhido (botão "Novo plano com este modelo" na aba Modelos)
async function novoPlano(comModelo){
  try{MOD=(await ASA.chamar('modelo.listar')).map(lerModelo)}catch(e){MOD=[]}
  const m=comModelo?MOD.find(x=>x.arquivo===comModelo):null;
  $('novoNome').value='';TIPO=m?m.tipo:'foto';syncNovo();if(m)$('novoModelo').value=String(MOD.indexOf(m));
  $('dlgNovo').hidden=false;setTimeout(()=>$('novoNome').focus(),30);
}
function syncNovo(){
  $('novoTipo').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TIPO));
  const ms=MOD.filter(m=>m.tipo===TIPO);
  $('novoModelo').innerHTML=`<option value="">Em branco</option>`+ms.map(m=>`<option value="${MOD.indexOf(m)}">Modelo: ${escH(m.nome)}</option>`).join('');
}
$('novoTipo').addEventListener('click',e=>{const t=e.target.dataset.t;if(t){TIPO=t;syncNovo()}});
$('novoCancelar').addEventListener('click',()=>$('dlgNovo').hidden=true);
$('dlgNovo').addEventListener('keydown',e=>{if(e.key==='Escape')$('dlgNovo').hidden=true;if(e.key==='Enter'&&e.target.id==='novoNome')$('novoCriar').click()});
$('novoCriar').addEventListener('click',()=>{
  const nome=$('novoNome').value.trim()||'Novo empreendimento',mi=$('novoModelo').value;
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
  $('titListaL').textContent=q?`${l.length} de ${LOC.length}`:'';
  $('listaL').innerHTML=l.map(x=>`<div class="card" role="button" tabindex="0" data-i="${LOC.indexOf(x)}">
      <div class="th loc">${radar(x.d)}<span class="chip tag">${PADRAO[x.d.std]||PADRAO.med}</span></div>
      <button type="button" class="sec mais" data-mais="1" aria-label="Mais opções de ${escH(x.nome)}">⋯</button>
      <div class="in"><b>${escH(x.nome)}</b><div class="meta">${escH(x.addr)||'&nbsp;'}</div><div class="ft">${chipsLocais(x)}</div></div>
    </div>`).join('')+`<button type="button" class="novo" id="cardNovoL"><div><span>+</span>Nova lista de locais<br><small style="font-weight:400">mercados, escolas, praias… perto do terreno</small></div></button>`;
  if(!LOC.length)$('listaL').insertAdjacentHTML('afterbegin','<p class="vazio-txt" style="grid-column:1/-1">Nenhuma lista ainda. Crie a primeira no cartão abaixo.</p>');
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
    m.innerHTML=`<button type="button" data-m="abrir">Abrir</button><button type="button" data-m="pasta">Pasta do empreendimento</button><button type="button" data-m="dup">Duplicar</button><button type="button" data-m="del" class="perigo">Excluir</button>`;
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

/* ---------- modelos ---------- */
function lerModelo(r){let j={},d={};try{j=JSON.parse(r.texto);d=j.projeto||j}catch(e){}return{arquivo:r.arquivo,j,d,nome:d._modelo||r.arquivo.replace(/\.asa$/,''),tipo:d.kind==='video'?'video':'foto'}}
// o que o modelo traz, em poucas palavras: "4 pontos" ou "3 takes"
function resumoModelo(m){
  const n=m.tipo==='video'?((m.d.vid&&m.d.vid.takes)||[]).length:(m.d.pts||[]).length,u=m.tipo==='video'?'take':'ponto';
  return n?`${n} ${u}${n>1?'s':''}`:(m.tipo==='video'?'sem takes':'sem pontos');
}
async function carregarModelos(){
  try{MOD=(await ASA.chamar('modelo.listar')).map(lerModelo).sort((a,b)=>a.nome.localeCompare(b.nome,'pt'))}catch(e){MOD=[]}
  $('modelos').innerHTML=MOD.length?MOD.map((m,i)=>`<div class="modelo" data-i="${i}"><span class="chip">${m.tipo==='video'?'Vídeo':'Fotos'}</span>
      <div class="mnome"><b>${escH(m.nome)}</b><small>${resumoModelo(m)}</small></div>
      <button type="button" data-m="usar">Novo plano com este modelo</button><button type="button" class="sec" data-m="ren">Renomear</button><button type="button" class="sec" data-m="del">Excluir</button></div>`).join('')
    :'<p class="vazio-txt">Nenhum modelo ainda.</p>';
}
async function renomearModelo(m,linha){
  const box=linha.querySelector('.mnome'),antes=box.innerHTML;
  box.innerHTML=`<input type="text" value="${escH(m.nome)}" aria-label="Nome do modelo">`;
  const inp=box.querySelector('input');inp.focus();inp.select();
  let feito=false;
  const salvar=async()=>{
    if(feito)return;feito=true;
    const nome=inp.value.trim();
    if(!nome||nome===m.nome){box.innerHTML=antes;return}
    const j=JSON.parse(JSON.stringify(m.j));(j.projeto||j)._modelo=nome;
    try{await ASA.chamar('modelo.renomear',{arquivo:m.arquivo,nome,texto:JSON.stringify(j)});aviso(`Modelo renomeado para "${nome}".`);carregarModelos()}
    catch(e){aviso('Não consegui renomear: '+e.message,{tipo:'erro'});box.innerHTML=antes}
  };
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')salvar();if(e.key==='Escape'){feito=true;box.innerHTML=antes}});
  inp.addEventListener('blur',salvar);
}
$('modelos').addEventListener('click',async e=>{
  const b=e.target.closest('[data-m]');if(!b)return;
  const linha=b.closest('.modelo'),m=MOD[+linha.dataset.i];if(!m)return;
  if(b.dataset.m==='usar')novoPlano(m.arquivo);
  if(b.dataset.m==='ren')renomearModelo(m,linha);
  if(b.dataset.m==='del'){
    if(!b.dataset.c){b.dataset.c=1;b.textContent='Confirmar: mandar para a Lixeira';return}
    try{await ASA.chamar('modelo.excluir',{arquivo:m.arquivo});aviso(`Modelo "${m.nome}" foi para a Lixeira do Windows.`);carregarModelos()}
    catch(er){aviso('Não consegui excluir: '+er.message,{tipo:'erro'})}
  }
});

/* ---------- configurações ---------- */
function chaveParaGerador(k){
  // o gerador lê a chave das preferências dele (no perfil do Asa); a cópia protegida fica com o programa
  try{const v=JSON.parse(localStorage.getItem('planovoo.v1')||'{}');v.key=k||'';v.hideTop=true;localStorage.setItem('planovoo.v1',JSON.stringify(v))}catch(e){}
}
function syncChips(){
  const tem=!!CFG.chave;
  $('chGoogle').hidden=tem;
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
  // só aparece quando alguma captação marcada está com chuva prevista
  const chuva=alvos.filter(p=>(CFG.prev[prevKey(p)]||{}).estado==='chuva');
  $('chPrev').hidden=!chuva.length;
  if(chuva.length){$('chPrev').innerHTML=`<i class="dot r"></i>Chuva prevista: ${chuva.map(p=>escH(p.nome)).join(', ')}`;$('chPrev').title='Previsão conferida às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
}
setInterval(()=>verificarPrevisoes(false),3*3600e3);

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
})();

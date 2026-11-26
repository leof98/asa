'use strict';
// Tela inicial do Asa: projetos recentes, modelos, configurações, previsão do tempo e atualização.
const $=id=>document.getElementById(id);
const REPO='leof98/asa';
let INFO={},CFG={},PROJ=[],MOD=[],FILTRO='todos',TIPO='foto';

/* ---------- abas ---------- */
function aba(nome){
  document.querySelectorAll('.asanav button').forEach(b=>{if(b.dataset.aba===nome)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  document.querySelectorAll('main>section').forEach(s=>s.hidden=s.dataset.sec!==nome);
  if(nome==='modelos')carregarModelos();
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
$('btNovo').addEventListener('click',novoPlano);
$('novoTipo').addEventListener('click',e=>{const t=e.target.dataset.t;if(t){TIPO=t;syncNovo()}});
$('novoCancelar').addEventListener('click',()=>$('dlgNovo').hidden=true);
$('dlgNovo').addEventListener('keydown',e=>{if(e.key==='Escape')$('dlgNovo').hidden=true;if(e.key==='Enter'&&e.target.id==='novoNome')$('novoCriar').click()});
$('novoCriar').addEventListener('click',()=>{
  const nome=$('novoNome').value.trim()||'Novo projeto',mi=$('novoModelo').value;
  localStorage.setItem('asa.abrir',JSON.stringify({novo:true,tipo:TIPO,nome,modelo:mi!==''?MOD[+mi].d:null}));
  location.href='gerador.html';
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
  $('cfgChave').value=CFG.chave||'';$('cfgAvisos').checked=CFG.avisos!==false;
  $('cfgPastaProj').textContent=INFO.pastaProjetos||'';$('cfgPastaAsa').textContent=INFO.pastaAsa||'';$('cfgVersao').textContent=INFO.versao||'';
  await carregarProjetos();
  if(!CFG.chave)aba('config');
  verificarPrevisoes(false);
  verificarAtualizacao(false);
})();

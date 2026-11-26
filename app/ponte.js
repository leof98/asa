'use strict';
// A ponte entre o gerador de plano de voo e o Asa. Carrega antes do gerador:
// - abre no gerador só o projeto escolhido na tela inicial (ou cria o plano novo, de um modelo ou em branco);
// - cada vez que o gerador salva, grava o projeto como arquivo em Documentos\Asa\Projetos (com as fotos dos takes);
// - PDF direto (sem a janela de impressão), Word e vídeos direto na pasta do projeto;
// - desfazer e refazer (Ctrl+Z / Ctrl+Y), Ctrl+S salva na hora, Ctrl+P gera o PDF;
// - "Salvar como modelo" e a volta para a tela inicial.
const ASA_PROJ={arquivo:'',novo:null,gravado:''};
(function(){
  let abrir=null;try{abrir=JSON.parse(localStorage.getItem('asa.abrir')||'null')}catch(e){}
  let lib={list:{},current:null};
  if(abrir){
    ASA_PROJ.arquivo=abrir.arquivo||'';
    if(abrir.novo)ASA_PROJ.novo=abrir;
    else if(abrir.texto){try{const j=JSON.parse(abrir.texto);const d=j.projeto||j;lib={current:'a',list:{a:{name:d.name||'Sem nome',updated:Date.now(),data:d}}}}catch(e){}}
  }
  localStorage.setItem('planovoo.projetos',JSON.stringify(lib));
  try{const v=JSON.parse(localStorage.getItem('planovoo.v1')||'{}');v.hideTop=true;localStorage.setItem('planovoo.v1',JSON.stringify(v))}catch(e){}
})();

/* ---------- gravar o projeto como arquivo ---------- */
const GRAV=(()=>{
  const setOrig=Storage.prototype.setItem;
  let pronto=false,pend=null,t=null,gravando=false,atual='',aplicando=false;
  const U=[],R=[];
  const texto=d=>JSON.stringify({app:'asa',versao:1,projeto:d});
  Storage.prototype.setItem=function(k,v){
    setOrig.call(this,k,v);
    if(!pronto||this!==localStorage||k!=='planovoo.projetos')return;
    let d;try{const l=JSON.parse(v);d=l.list[l.current].data}catch(e){return}
    const tx=texto(d);if(tx===atual)return;
    if(!aplicando&&atual){U.push(atual);if(U.length>150)U.shift();R.length=0}
    atual=tx;pend={tx,nome:d.name};
    clearTimeout(t);t=setTimeout(gravar,600);marcar('Salvando…');
  };
  async function gravar(){
    if(!pend||gravando)return;gravando=true;const p=pend;pend=null;
    try{
      const arq=await ASA.chamar('proj.gravar',{arquivo:ASA_PROJ.arquivo,texto:p.tx,nome:p.nome});
      ASA_PROJ.arquivo=arq;ASA_PROJ.gravado=p.tx;
      setOrig.call(localStorage,'asa.abrir',JSON.stringify({arquivo:arq,texto:p.tx}));
      ASA.chamar('contexto',{nome:p.nome}).catch(()=>{});
      const h=new Date();marcar(`Salvo às ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`);
      sincronizarFotos().catch(()=>{});
    }catch(e){marcar('Não salvou: '+e.message,true);pend=pend||p}
    finally{gravando=false;if(pend){clearTimeout(t);t=setTimeout(gravar,300)}}
  }
  function marcar(s,erro){const el=document.querySelector('.asabar .salvo');if(el){el.textContent=s;el.classList.toggle('erro',!!erro)}const n=document.querySelector('.asabar .nome');if(n&&typeof P!=='undefined')n.textContent=P.name||'Sem nome'}
  async function agora(){clearTimeout(t);if(typeof save==='function'){save()}await new Promise(r=>setTimeout(r,350));clearTimeout(t);await gravar()}
  function aplicar(tx){
    aplicando=true;carregarDados(JSON.parse(tx).projeto);save();
    setTimeout(()=>{aplicando=false},900);
  }
  function desfazer(){if(!U.length){aviso('Nada para desfazer.',{ms:2000});return}R.push(atual);const tx=U.pop();aplicar(tx)}
  function refazer(){if(!R.length){aviso('Nada para refazer.',{ms:2000});return}U.push(atual);const tx=R.pop();aplicar(tx)}
  function ligar(novo){atual='';if(!novo)try{atual=texto(LIB.list[LIB.current].data)}catch(e){}pronto=true}
  return{ligar,agora,desfazer,refazer,marcar};
})();

// põe estes dados no gerador. O loadProject do gerador guarda antes o projeto aberto no lugar dele; por isso os dados
// novos entram com outro id e o antigo sai da lista depois
function carregarDados(d){
  const velho=LIB.current,id=newId();
  LIB.list[id]={name:d.name||'Sem nome',updated:Date.now(),data:d};
  loadProject(id);
  if(velho&&velho!==id)delete LIB.list[velho];
}

/* ---------- fotos dos takes: o arquivo do projeto leva junto ---------- */
let FOTOS_DISCO=null;
const idsFotos=()=>typeof isVid==='function'&&isVid()?P.vid.takes.flatMap(t=>[...t.photos,...(t.lock?[t.lock]:[])]).map(f=>f.id):[];
const dataUrl=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
async function sincronizarFotos(){
  const ids=idsFotos();if(!ids.length||!ASA_PROJ.arquivo)return;
  if(!FOTOS_DISCO){try{FOTOS_DISCO=new Set(await ASA.chamar('foto.lista',{arquivo:ASA_PROJ.arquivo}))}catch(e){FOTOS_DISCO=new Set()}}
  for(const id of ids){
    if(FOTOS_DISCO.has(id))continue;
    const r=await IDB.get(id).catch(()=>null);if(!r)continue;
    await ASA.chamar('foto.gravar',{arquivo:ASA_PROJ.arquivo,id,dados:await dataUrl(r.blob)});FOTOS_DISCO.add(id);
  }
}
async function restaurarFotos(){
  const ids=idsFotos();if(!ids.length||!ASA_PROJ.arquivo)return;let n=0;
  for(const id of ids){
    if(await IDB.get(id).catch(()=>null))continue;
    const url=await ASA.chamar('foto.ler',{arquivo:ASA_PROJ.arquivo,id}).catch(()=>null);if(!url)continue;
    const blob=await(await fetch(url)).blob(),b=await createImageBitmap(blob);
    await IDB.put(id,{blob,w:b.width,h:b.height});n++;
  }
  if(n){await loadImgs();drawTakes();renderPages();scheduleDraw()}
}

/* ---------- PDF direto e arquivos baixados ---------- */
window.ASA_PDF=async()=>{
  try{const c=await ASA.chamar('pdf',{nome:P.name,titulo:`Plano de Voo - ${P.name||'projeto'}`});avisoArquivo('PDF',c)}
  catch(e){aviso('Não consegui gerar o PDF: '+e.message,{tipo:'erro',ms:12000})}
};
document.addEventListener('asa:baixado',e=>{
  const d=e.detail||{};
  if(d.caminho)avisoArquivo(/\.docx$/i.test(d.caminho)?'Word':/\.(mp4|webm)$/i.test(d.caminho)?'Vídeo':'Arquivo',d.caminho);
  else aviso('O arquivo não foi salvo ('+(d.erro||'erro')+').',{tipo:'erro'});
});

/* ---------- barra do Asa, atalhos e modelos ---------- */
function barraAsa(){
  const b=document.createElement('div');b.className='asabar';
  b.innerHTML=`<button type="button" class="voltar" id="asaVoltar" title="Voltar à tela inicial">← Início</button>
    <span class="marca"><img src="asa.svg" alt="">ASA</span><span class="sep"></span>
    <span class="ferr">Plano de voo</span><span class="nome"></span><span class="salvo"></span><span class="sp"></span>
    <span class="atalhos" title="Atalhos">Ctrl+Z desfaz · Ctrl+P gera o PDF</span>
    <button type="button" id="asaModelo">Salvar como modelo</button>
    <button type="button" id="asaPasta" title="PDF, Word e vídeos deste empreendimento">Pasta do empreendimento</button>`;
  document.body.prepend(b);
  b.querySelector('#asaVoltar').onclick=async()=>{await GRAV.agora();location.href='index.html'};
  b.querySelector('#asaPasta').onclick=()=>ASA.chamar('pasta.projeto',{nome:P.name});
  b.querySelector('#asaModelo').onclick=salvarModelo;
}
function salvarModelo(){
  const dl=document.createElement('div');dl.className='asadlg';
  dl.innerHTML=`<div role="dialog" aria-modal="true"><h3>Salvar como modelo</h3><p>O modelo guarda pontos, alturas, takes e textos deste plano, sem nome, endereço, data nem fotos. Ele aparece em "Novo plano".</p>
    <input type="text" id="asaModNome" placeholder="Nome do modelo, ex.: Torre padrão 4 pontos"><div class="bt"><button type="button" class="sec" id="asaModNao">Cancelar</button><button type="button" id="asaModSim">Salvar modelo</button></div></div>`;
  document.body.appendChild(dl);const inp=dl.querySelector('input');inp.focus();
  const fechar=()=>dl.remove();
  dl.querySelector('#asaModNao').onclick=fechar;
  dl.addEventListener('keydown',e=>{if(e.key==='Escape')fechar();if(e.key==='Enter')dl.querySelector('#asaModSim').click()});
  dl.querySelector('#asaModSim').onclick=async()=>{
    const nome=inp.value.trim();if(!nome){inp.focus();return}
    const d=pick();
    for(const k of['name','addr','date','dateISO','time','lat','lon','view','locView','ovView','wx','monSent','sim'])delete d[k];
    if(d.vid)for(const t of d.vid.takes){t.photos=[];t.lock=null;t.view={auto:true}}
    d._modelo=nome;
    try{await ASA.chamar('modelo.gravar',{nome,texto:JSON.stringify({app:'asa',versao:1,modelo:true,projeto:d})});fechar();aviso(`Modelo "${nome}" salvo.`)}
    catch(e){aviso('Não consegui salvar o modelo: '+e.message,{tipo:'erro'})}
  };
}
const ehCampo=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!/^(checkbox|radio|range|button)$/.test(el.type||''));
window.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==='s'){e.preventDefault();GRAV.agora()}
  else if(k==='p'){e.preventDefault();const b=document.getElementById('pdf');if(b&&!b.disabled)b.click()}
  else if((k==='z'||k==='y')&&!ehCampo(document.activeElement)){e.preventDefault();(k==='y'||e.shiftKey)?GRAV.refazer():GRAV.desfazer()}
},true);

/* ---------- depois que o gerador montou a tela ---------- */
window.addEventListener('DOMContentLoaded',()=>{
  barraAsa();
  const n=ASA_PROJ.novo;
  if(n){
    // plano novo: em branco ou a partir de um modelo, com o nome escolhido na tela inicial
    const d=blankProject();
    if(n.modelo){const m=clone(n.modelo);delete m._modelo;Object.assign(d,m)}
    if(n.tipo==='video'){d.kind='video';if(!d.vid){d.vid=NEW_VID();d.vid.takes.push(newTake(false))}if(!n.modelo)d.pts=[]}
    else d.kind='foto';
    d.name=n.nome||'Novo empreendimento';
    carregarDados(d);
    if(isVid()&&P.vid.takes[0]){openTake=P.vid.takes[0].id;const ts=document.getElementById('takesSec');if(ts)ts.open=true;drawTakes()}
    GRAV.ligar(true);GRAV.marcar('');
    // força a primeira gravação (cria o arquivo)
    ASA_PROJ.novo=null;setTimeout(()=>{P.name=P.name||d.name;save()},50);
    setTimeout(()=>{if(!ASA_PROJ.arquivo)GRAV.agora()},900);
  }else{
    GRAV.ligar();GRAV.marcar('');
    restaurarFotos().catch(()=>{});
  }
  ASA.chamar('contexto',{nome:P.name}).catch(()=>{});
  document.title=(P.name?P.name+' · ':'')+'Asa';
  const pdf=document.getElementById('pdf');if(pdf)pdf.title='Salva o PDF na pasta do empreendimento (Ctrl+P)';
});

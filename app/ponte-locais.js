'use strict';
// A ponte entre o Locais Próximos e o Asa. Carrega antes da página:
// - abre só a lista de locais escolhida na tela inicial (ou cria uma nova, com o terreno de um plano de voo, se escolhido);
// - cada mudança vira arquivo em Documentos\Asa\Locais;
// - lugares fixos, redes por padrão e raio ficam nas configurações do Asa (valem para todos os empreendimentos);
// - PDF e Word direto na pasta do empreendimento (Documentos\Asa\<nome>), desfazer/refazer e atalhos.
const ASA_LOC={arquivo:'',novo:null};
(function(){
  let abrir=null;try{abrir=JSON.parse(localStorage.getItem('asa.locais')||'null')}catch(e){}
  let lib={cur:null,list:{}};
  if(abrir){
    ASA_LOC.arquivo=abrir.arquivo||'';
    if(abrir.novo)ASA_LOC.novo=abrir;
    else if(abrir.texto){try{const j=JSON.parse(abrir.texto);lib={cur:'a',list:{a:j.locais||j}}}catch(e){}}
  }
  localStorage.setItem('locais.projetos',JSON.stringify(lib));
  try{
    const g=JSON.parse(localStorage.getItem('locais.v1')||'{}');
    const aj=JSON.parse(localStorage.getItem('asa.locais.ajustes')||'null');if(aj)Object.assign(g,aj);
    g.key=(JSON.parse(localStorage.getItem('planovoo.v1')||'{}').key)||'';   // a chave das Configurações do Asa
    localStorage.setItem('locais.v1',JSON.stringify(g));
  }catch(e){}
})();

/* ---------- gravar como arquivo, desfazer e refazer ---------- */
const LOC_GRAV=(()=>{
  const setOrig=Storage.prototype.setItem;
  let pronto=false,pend=null,t=null,gravando=false,atual='',aplicando=false,tAj=null,ajAtual='';
  const U=[],Rf=[];
  // os campos que começam com _ são contas da tela (nota, encaixe no padrão), não vão para o arquivo
  const texto=d=>JSON.stringify({app:'asa',tipo:'locais',versao:1,locais:d},(k,v)=>k&&k[0]==='_'?undefined:v);
  Storage.prototype.setItem=function(k,v){
    setOrig.call(this,k,v);
    if(!pronto||this!==localStorage)return;
    if(k==='locais.v1'){ajustes(v);return}
    if(k!=='locais.projetos')return;
    let d;try{const l=JSON.parse(v);d=l.list[l.cur]}catch(e){return}
    if(!d)return;
    const tx=texto(d);if(tx===atual)return;
    if(!aplicando&&atual){U.push(atual);if(U.length>150)U.shift();Rf.length=0}
    atual=tx;pend={tx,nome:d.name};
    clearTimeout(t);t=setTimeout(gravar,600);marcar('Salvando…');
  };
  function ajustes(v){
    let g;try{g=JSON.parse(v)}catch(e){return}
    delete g.key;const s=JSON.stringify(g);if(s===ajAtual)return;ajAtual=s;
    setOrig.call(localStorage,'asa.locais.ajustes',s);
    clearTimeout(tAj);tAj=setTimeout(()=>ASA.chamar('config.gravar',{locais:g}).catch(()=>{}),800);
  }
  async function gravar(){
    if(!pend||gravando)return;gravando=true;const p=pend;pend=null;
    try{
      const arq=await ASA.chamar('proj.gravar',{pasta:'locais',arquivo:ASA_LOC.arquivo,texto:p.tx,nome:p.nome});
      ASA_LOC.arquivo=arq;
      setOrig.call(localStorage,'asa.locais',JSON.stringify({arquivo:arq,texto:p.tx}));
      ASA.chamar('contexto',{nome:p.nome}).catch(()=>{});
      const h=new Date();marcar(`Salvo às ${String(h.getHours()).padStart(2,'0')}:${String(h.getMinutes()).padStart(2,'0')}`);
    }catch(e){marcar('Não salvou: '+e.message,true);pend=pend||p}
    finally{gravando=false;if(pend){clearTimeout(t);t=setTimeout(gravar,300)}}
  }
  function marcar(s,erro){const el=document.querySelector('.asabar .salvo');if(el){el.textContent=s;el.classList.toggle('erro',!!erro)}const n=document.querySelector('.asabar .nome');if(n&&typeof P!=='undefined')n.textContent=P.name||'Sem nome'}
  async function agora(){clearTimeout(t);if(typeof save==='function')save();await new Promise(r=>setTimeout(r,350));clearTimeout(t);clearTimeout(tAj);await gravar()}
  function aplicar(tx){
    aplicando=true;LIB.list[LIB.cur]=JSON.parse(tx).locais;loadProject(LIB.cur);
    setTimeout(()=>{aplicando=false},900);
  }
  function desfazer(){if(!U.length){aviso('Nada para desfazer.',{ms:2000});return}Rf.push(atual);aplicar(U.pop())}
  function refazer(){if(!Rf.length){aviso('Nada para refazer.',{ms:2000});return}U.push(atual);aplicar(Rf.pop())}
  function ligar(novo){
    atual='';if(!novo)try{atual=texto(LIB.list[LIB.cur])}catch(e){}
    try{const g=JSON.parse(localStorage.getItem('locais.v1')||'{}');delete g.key;ajAtual=JSON.stringify(g)}catch(e){}
    pronto=true;
  }
  return{ligar,agora,desfazer,refazer,marcar};
})();
// a tela do Asa chama GRAV.agora() ao fechar a janela
const GRAV=LOC_GRAV;

/* ---------- PDF direto e arquivos salvos ---------- */
window.ASA_PDF=async()=>{
  try{const c=await ASA.chamar('pdf',{nome:P.name,titulo:`Pontos de localização - ${P.name||'projeto'}`});avisoArquivo('PDF',c)}
  catch(e){aviso('Não consegui gerar o PDF: '+e.message,{tipo:'erro',ms:12000})}
};
document.addEventListener('asa:baixado',e=>{
  const d=e.detail||{};
  if(d.caminho)avisoArquivo(/\.docx$/i.test(d.caminho)?'Word':'Arquivo',d.caminho);
  else aviso('O arquivo não foi salvo ('+(d.erro||'erro')+').',{tipo:'erro'});
});

/* ---------- barra do Asa e atalhos ---------- */
function barraLocais(){
  const b=document.createElement('div');b.className='asabar';
  b.innerHTML=`<button type="button" class="voltar" id="asaVoltar" title="Voltar à tela inicial">← Início</button>
    <span class="marca"><img src="asa.svg" alt="">ASA</span><span class="sep"></span>
    <span class="ferr">Locais próximos</span><span class="nome"></span><span class="salvo"></span><span class="sp"></span>
    <button type="button" class="tres" id="asaMais" aria-label="Mais opções" aria-haspopup="menu" title="Mais opções (Ctrl+Z desfaz · Ctrl+P gera o PDF)">⋯</button>`;
  document.body.prepend(b);
  b.querySelector('#asaVoltar').onclick=async()=>{await LOC_GRAV.agora();location.href='index.html#locais'};
  menuAsa(b.querySelector('#asaMais'),[['Pasta do empreendimento',()=>ASA.chamar('pasta.projeto',{nome:P.name})]]);
}
const ehCampoLoc=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!/^(checkbox|radio|range|button)$/.test(el.type||''));
window.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==='s'){e.preventDefault();LOC_GRAV.agora()}
  else if(k==='p'){e.preventDefault();const b=document.getElementById('pdf');if(b&&!b.disabled)b.click()}
  else if((k==='z'||k==='y')&&!ehCampoLoc(document.activeElement)){e.preventDefault();(k==='y'||e.shiftKey)?LOC_GRAV.refazer():LOC_GRAV.desfazer()}
},true);

/* ---------- depois que a página montou ---------- */
window.addEventListener('DOMContentLoaded',()=>{
  barraLocais();
  const n=ASA_LOC.novo;
  if(n){
    LOC_GRAV.ligar(true);
    P.name=n.nome||'Novo empreendimento';document.getElementById('name').value=P.name;
    const t=n.plano;
    if(t&&t.lat!=null&&isFinite(t.lat)&&isFinite(t.lon))setOrigin(t.lat,t.lon,t.addr||'');
    else{save();drawAll()}
    ASA_LOC.novo=null;
    setTimeout(()=>{if(!ASA_LOC.arquivo)LOC_GRAV.agora()},900);
  }else LOC_GRAV.ligar();
  LOC_GRAV.marcar('');
  ASA.chamar('contexto',{nome:P.name}).catch(()=>{});
  document.title=(P.name?P.name+' · ':'')+'Locais próximos · Asa';
  const pdf=document.getElementById('pdf');if(pdf)pdf.title='Salva o PDF na pasta do empreendimento (Ctrl+P)';
  document.getElementById('name').addEventListener('change',()=>ASA.chamar('contexto',{nome:P.name}).catch(()=>{}));
});

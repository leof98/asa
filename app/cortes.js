/* Asa · leitura do PDF de cortes (sem IA).
   Lê a camada de texto do PDF com o pdf.js (local, em app/pdfjs) e junta cada nome de pavimento com a sua cota
   pela posição na página. Depois abre a revisão: o usuário confere, ajusta RN e referência do corte, e a lista
   vira "Nome: altura da foto" (cota − RN + referência + 1,60 m, arredondada) na Vista dos andares.
   O pareamento veio do gerador-plano-voo (lib/parsePdf.ts): vetor de deslocamento rótulo→cota que mais se repete,
   escolhido pela sequência de cotas mais crescente. Nada sai do computador.
   Usa da página: $, P, esc, EYE, drawBlocks, save, renderPages, scheduleDraw, bDirty. Não redeclare esses nomes. */
(()=>{
const CT={};

/* ---------- pareamento rótulo ↔ cota ---------- */
const RE_COTA=/^[+-]?\d{1,3}(?:[.,]\d{2})$/;
const ROTULOS=[
  /\d{1,3}\s*[ºo°ª.]*\s*pav(?:imento|to|\.)?/,
  /pavimento\s*tipo\s*\d*/,
  /t[eé]rreo/,
  /subsolo\s*\d*/,
  /\bsub\s*-?\s*solo\s*\d*/,
  /barrilete/,
  /caixa\s*d['`´’\s]*[aá]gua/,
  /reservat[oó]rio/,
  /cobertura/,
  /[aá]tico/,
  /mezanino/,
  /pilotis/,
  /embasamento/,
  /casa\s*de\s*m[aá]quinas/,
  /implanta[cç][aã]o/,
];
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const capitalizar=s=>s.replace(/(^|\s)(\p{Ll})/gu,(m,a,c)=>a+c.toUpperCase());
const parseCota=t=>parseFloat(t.replace(/^\+/,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'));
function acharRotulo(texto){
  const n=norm(texto);let ini=Infinity;
  for(const r of ROTULOS){const m=n.match(r);if(m&&m.index<ini)ini=m.index}
  if(ini===Infinity)return null;
  let comp=0;for(const r of ROTULOS){const m=n.match(r);if(m&&m.index===ini)comp=Math.max(comp,m[0].length)}
  return capitalizar(texto.slice(ini,ini+comp).trim().replace(/\s+/g,' '));
}
const mediana=v=>{if(!v.length)return 0;const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]};
function passosMonotonicos(seq){let i=0,d=0;for(let k=1;k<seq.length;k++){if(seq[k]>seq[k-1])i++;else if(seq[k]<seq[k-1])d++}return Math.max(i,d)}

function pararPagina(itens){
  const rot=[],cot=[];
  for(const it of itens){const t=it.str.trim();if(!t)continue;
    if(RE_COTA.test(t))cot.push({x:it.x,y:it.y,valor:parseCota(t)});
    else{const nome=acharRotulo(t);if(nome)rot.push({x:it.x,y:it.y,nome})}}
  if(rot.length<4||!cot.length)return[];
  const B=Math.max(mediana(itens.map(i=>i.altura).filter(h=>h>0)),4);
  const xs=rot.map(r=>r.x),ys=rot.map(r=>r.y);
  const vertical=Math.max(...ys)-Math.min(...ys)>=Math.max(...xs)-Math.min(...xs);
  const pos=p=>vertical?p.y:p.x;
  const ord=[...rot].sort((a,b)=>pos(a)-pos(b));
  const gaps=[];for(let i=1;i<ord.length;i++)gaps.push(Math.abs(pos(ord[i])-pos(ord[i-1])));
  const R=Math.max(mediana(gaps)*1.6,B*8);
  const cont=new Map();
  for(const r of rot)for(const c of cot){const dx=c.x-r.x,dy=c.y-r.y;if(Math.hypot(dx,dy)>R)continue;
    const k=`${Math.round(dx/B)},${Math.round(dy/B)}`;cont.set(k,(cont.get(k)||0)+1)}
  const minRec=Math.max(4,Math.floor(rot.length*.3));let melhor=null;
  for(const [k,n] of cont){
    if(n<minRec)continue;
    const [kx,ky]=k.split(',').map(Number),ax=kx*B,ay=ky*B,usadas=new Set(),asg=[];
    for(const r of ord){let ix=-1,menor=B*2;
      for(let ci=0;ci<cot.length;ci++){if(usadas.has(ci))continue;const d=Math.hypot(cot[ci].x-(r.x+ax),cot[ci].y-(r.y+ay));if(d<menor){menor=d;ix=ci}}
      if(ix>=0){usadas.add(ix);asg.push({nome:r.nome,valor:cot[ix].valor,pos:pos(r)})}}
    const vistos=new Set(),uni=asg.filter(a=>{const q=norm(a.nome);if(vistos.has(q))return false;vistos.add(q);return true}).sort((a,b)=>a.pos-b.pos);
    if(uni.length<4)continue;
    const mon=passosMonotonicos(uni.map(a=>a.valor));
    if(!melhor||mon>melhor.mon)melhor={asg:uni,mon};
  }
  if(!melhor)return[];
  const n=melhor.asg.length;
  if(n<4||melhor.mon<Math.ceil((n-1)*.8))return[];
  return melhor.asg;
}
const ehSubsolo=(nome,c)=>c<0||/subsolo|sub-solo|garagem/.test(norm(nome));
const ehTecnico=nome=>/barrilete|caixa.?d.?agua|reservat|atico|cobertura|implanta|casa de maquina|telhado|laje tecnica|nivel tecnico/.test(norm(nome));
function parseNiveis(paginas){
  const vistos=new Set(),out=[];
  for(const itens of paginas)for(const a of pararPagina(itens)){
    const k=norm(a.nome)+'|'+a.valor;if(vistos.has(k))continue;vistos.add(k);
    out.push({nome:a.nome,cota:a.valor,usar:!ehSubsolo(a.nome,a.valor)});
  }
  return out.sort((a,b)=>a.cota-b.cota);
}
CT.parseNiveis=parseNiveis;

/* ---------- leitura do PDF (pdf.js local) ---------- */
let PDFJS=null;
async function pdfjs(){
  if(!PDFJS){PDFJS=await import('./pdfjs/pdf.min.js');PDFJS.GlobalWorkerOptions.workerSrc=new URL('pdfjs/pdf.worker.min.js',location.href).href}
  return PDFJS;
}
async function lerPdf(dados){
  const lib=await pdfjs();
  const doc=await lib.getDocument({data:dados,cMapUrl:new URL('pdfjs/cmaps/',location.href).href,cMapPacked:true,isEvalSupported:false}).promise;
  const paginas=[];let texto=false;
  for(let p=1;p<=doc.numPages;p++){
    const pg=await doc.getPage(p),tc=await pg.getTextContent(),itens=[];
    for(const it of tc.items){if(!it.str||!it.transform||!it.str.trim())continue;texto=true;
      itens.push({str:it.str,x:it.transform[4],y:it.transform[5],altura:Math.hypot(it.transform[1],it.transform[3])})}
    paginas.push(itens);pg.cleanup();
  }
  const total=doc.numPages;await doc.destroy();
  return{paginas,texto,total};
}
CT.lerPdf=lerPdf;

/* ---------- lista colada (ex.: vinda de uma conversa com a Claude) ---------- */
// aceita "Nome: 12,34", "Nome 12,34", "Nome;12.34" ou "Nome<tab>12,34", uma por linha
function parseLista(t){
  const out=[];
  for(const l of String(t).split(/\r?\n/)){
    const m=l.trim().match(/^(.*?)[\s:;=\t|–]+([+-]?\d{1,3}(?:\.\d{3})*(?:[.,]\d+)?)\s*m?\s*$/i);
    if(!m||!m[1].trim())continue;
    const c=parseFloat(m[2].replace(/^\+/,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')),nome=m[1].trim().replace(/[:;\-–|]+$/,'').trim();
    if(isFinite(c))out.push({nome,cota:c,usar:!ehSubsolo(nome,c)});
  }
  return out;
}
CT.parseLista=parseLista;

/* ---------- saltos fora do passo (só entre pavimentos comuns) ---------- */
function saltos(lista){
  const hab=lista.filter(r=>r.usar&&!ehSubsolo(r.nome,r.cota)&&!ehTecnico(r.nome)).sort((a,b)=>a.cota-b.cota);
  if(hab.length<3)return new Map();
  const d=[];for(let i=1;i<hab.length;i++)d.push(hab[i].cota-hab[i-1].cota);
  const s=[...d].sort((a,b)=>a-b),m=s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;
  const out=new Map();if(m<=0)return out;
  for(let i=1;i<hab.length;i++){const dif=hab[i].cota-hab[i-1].cota;if(Math.abs(dif-m)/m>.4)out.set(hab[i],{dif,passo:m})}
  return out;
}

/* ---------- tela de revisão ---------- */
const f2=v=>(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const numBR=v=>{const x=parseFloat(String(v).replace(',','.'));return isFinite(x)?x:null};
let DL=null,LISTA=[],AJ={rn:0,ref:0};
const foto=c=>Math.round(c-(numBR(AJ.rn)||0)+(numBR(AJ.ref)||0)+EYE);

function abrir(lista,aviso){
  LISTA=lista;AJ={rn:P.cortesRN??0,ref:P.cortesRef??0};
  if(DL)DL.remove();
  DL=document.createElement('div');DL.className='asadlg ctdlg';
  DL.innerHTML=`<div role="dialog" aria-modal="true" aria-labelledby="ctT">
    <h3 id="ctT">Andares do corte</h3>
    <p id="ctAviso"></p>
    <div class="ctaj">
      <label>RN <small>(subtraído das cotas)</small><input type="text" inputmode="decimal" id="ctRN"></label>
      <label>Referência do corte <small>(térreo acima do solo, somada)</small><input type="text" inputmode="decimal" id="ctRef"></label>
      <span class="ctolho">+ ${f2(EYE)} m da altura dos olhos, arredondado</span>
    </div>
    <div class="cttab"><table><thead><tr><th title="Entra na Vista dos andares">Usar</th><th>Pavimento</th><th class="n">Cota do corte (m)</th><th class="n">Foto (m)</th><th></th></tr></thead><tbody id="ctBody"></tbody></table></div>
    <div class="ctcola" id="ctCola" hidden>
      <p>Cole a lista, um pavimento por linha, com o nome e a cota do corte. Ex.: <b>26º Pavimento: 79,00</b>. Funciona com a lista que a Claude devolve quando você manda o PDF numa conversa.</p>
      <textarea id="ctTxt" rows="7" spellcheck="false"></textarea>
      <div class="bt"><button type="button" class="sec" id="ctColaNao">Cancelar</button><button type="button" id="ctColaSim">Trocar pela lista colada</button></div>
    </div>
    <div class="bt ctbt">
      <button type="button" class="sec" id="ctMais">+ Pavimento</button>
      <button type="button" class="sec" id="ctColar">Colar lista…</button>
      <span style="flex:1"></span>
      <button type="button" class="sec" id="ctNao">Cancelar</button>
      <button type="button" id="ctSim">Usar estes andares</button>
    </div></div>`;
  document.body.appendChild(DL);
  $('ctAviso').innerHTML=aviso||'';
  $('ctRN').value=String(AJ.rn).replace('.',',');$('ctRef').value=String(AJ.ref).replace('.',',');
  desenhar();
  if(!lista.length){$('ctCola').hidden=false;$('ctTxt').focus()}
  $('ctRN').addEventListener('input',e=>{AJ.rn=e.target.value;desenhar(true)});
  $('ctRef').addEventListener('input',e=>{AJ.ref=e.target.value;desenhar(true)});
  $('ctBody').addEventListener('input',e=>{
    const tr=e.target.closest('tr');if(!tr)return;const r=LISTA[+tr.dataset.i],k=e.target.dataset.k;
    if(k==='usar')r.usar=e.target.checked;else if(k==='nome')r.nome=e.target.value;else if(k==='cota'){const v=numBR(e.target.value);r.cota=v==null?NaN:v}
    desenhar(true);
  });
  $('ctBody').addEventListener('click',e=>{const i=e.target.dataset.del;if(i==null)return;LISTA.splice(+i,1);desenhar()});
  $('ctMais').onclick=()=>{LISTA.push({nome:'',cota:NaN,usar:true});desenhar();const t=$('ctBody').lastElementChild;if(t)t.querySelector('[data-k=nome]').focus()};
  $('ctColar').onclick=()=>{$('ctCola').hidden=false;$('ctTxt').focus()};
  $('ctColaNao').onclick=()=>{$('ctCola').hidden=true};
  $('ctColaSim').onclick=()=>{const l=parseLista($('ctTxt').value);if(!l.length){aviso2('Não achei nenhuma linha com nome e cota.');return}
    LISTA=l.sort((a,b)=>a.cota-b.cota);$('ctCola').hidden=true;$('ctAviso').textContent=`${l.length} pavimentos na lista colada. Confira com o corte.`;desenhar()};
  $('ctNao').onclick=fechar;
  $('ctSim').onclick=aplicar;
  DL.addEventListener('keydown',e=>{if(e.key==='Escape')fechar()});
}
const aviso2=t=>{$('ctAviso').textContent=t};
function fechar(){if(DL){DL.remove();DL=null}}
// leve=true: só atualiza as colunas calculadas, sem refazer os campos (o foco fica onde está)
function desenhar(leve){
  const sal=saltos(LISTA.filter(r=>isFinite(r.cota)));
  const linha=(r,i)=>{const s=sal.get(r),cl=(s?'salto ':'')+(r.usar?'':'fora');
    return{cl,foto:isFinite(r.cota)?String(foto(r.cota)):'—',dica:s?`Salto de ${f2(s.dif)} m; o passo normal é ${f2(s.passo)} m. Confira no corte.`:''}};
  if(leve){[...$('ctBody').children].forEach((tr,i)=>{const r=LISTA[i];if(!r)return;const l=linha(r,i);tr.className=l.cl;tr.querySelector('.ctf').textContent=l.foto;tr.title=l.dica});}
  else $('ctBody').innerHTML=LISTA.map((r,i)=>{const l=linha(r,i);
    return`<tr data-i="${i}" class="${l.cl}" title="${esc(l.dica)}"><td><input type="checkbox" data-k="usar" ${r.usar?'checked':''} aria-label="Usar ${esc(r.nome)}"></td>
      <td><input type="text" data-k="nome" value="${esc(r.nome)}" aria-label="Nome do pavimento"></td>
      <td class="n"><input type="text" inputmode="decimal" data-k="cota" value="${isFinite(r.cota)?f2(r.cota):''}" aria-label="Cota do corte"></td>
      <td class="n ctf">${l.foto}</td><td><button type="button" class="sec ctx" data-del="${i}" aria-label="Remover ${esc(r.nome)}">×</button></td></tr>`}).join('');
  const usados=LISTA.filter(r=>r.usar&&isFinite(r.cota)&&r.nome.trim());
  $('ctSim').textContent=usados.length?`Usar ${usados.length} ${usados.length===1?'andar':'andares'}`:'Usar estes andares';
  $('ctSim').disabled=!usados.length;
}
function aplicar(){
  const usados=LISTA.filter(r=>r.usar&&isFinite(r.cota)&&r.nome.trim()).sort((a,b)=>a.cota-b.cota);
  if(!usados.length)return;
  P.cortesRN=numBR(AJ.rn)||0;P.cortesRef=numBR(AJ.ref)||0;
  P.floors=usados.map(r=>`${r.nome.trim()}: ${foto(r.cota)}`).join('\n');
  P.floorsManual=true;drawBlocks();
  bDirty=true;save();renderPages();scheduleDraw();fechar();
  if(window.aviso)aviso(`${usados.length} andares na Vista dos andares. Dá para ajustar na lista.`);
}

/* ---------- botões na seção Vista dos andares ---------- */
function montar(){
  const box=$('flConta');if(!box||$('ctLer'))return;
  const row=document.createElement('div');row.className='ctrow';
  row.innerHTML=`<button type="button" class="sec" id="ctLer" title="Lê os pavimentos e as cotas do PDF de cortes da construtora, sem IA e sem internet">Ler PDF de cortes…</button>
    <button type="button" class="sec" id="ctAbrirCola" title="Cola uma lista de pavimentos com a cota do corte">Colar lista do corte…</button>
    <input type="file" id="ctArq" accept="application/pdf,.pdf" hidden>`;
  box.parentElement.insertBefore(row,box);
  $('ctLer').onclick=()=>$('ctArq').click();
  $('ctAbrirCola').onclick=()=>abrir([],'');
  $('ctArq').addEventListener('change',async e=>{
    const arq=e.target.files[0];e.target.value='';if(!arq)return;
    const b=$('ctLer'),old=b.textContent;b.disabled=true;b.textContent='Lendo o PDF…';
    try{
      const r=await lerPdf(new Uint8Array(await arq.arrayBuffer()));
      const lista=parseNiveis(r.paginas);
      let msg;
      if(!r.texto)msg=`<b>Este PDF não tem texto</b> (deve ser escaneado), então não dá para ler as cotas. Mande o PDF numa conversa com a Claude, peça a lista "Pavimento: cota" e cole abaixo.`;
      else if(!lista.length)msg=`Não achei pavimentos com cota em ${r.total} ${r.total===1?'página':'páginas'}. Cole a lista abaixo ou adicione os pavimentos à mão.`;
      else msg=`Li ${lista.length} pavimentos em ${r.total} ${r.total===1?'página':'páginas'}. <b>Confira nome e cota com o corte</b> antes de usar; as linhas em amarelo fogem do passo normal.`;
      abrir(lista,msg);
    }catch(err){if(window.aviso)aviso('Não consegui ler o PDF: '+err.message,{tipo:'erro',ms:10000});else alert(err.message)}
    finally{b.disabled=false;b.textContent=old}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar);else montar();
window.ASA_CORTES=CT;
})();

'use strict';
// Peças comuns das telas do Asa: a conversa com o programa (Asa.exe), os avisos na tela e a previsão do tempo.
const ASA=(()=>{
  const w=window.chrome&&window.chrome.webview;
  let n=0;const esp=new Map();
  if(w)w.addEventListener('message',e=>{
    const m=e.data;if(!m)return;
    if(m.id&&esp.has(m.id)){const [ok,er]=esp.get(m.id);esp.delete(m.id);m.ok?ok(m.r):er(new Error(m.erro||'falhou'))}
    else if(m.evento)document.dispatchEvent(new CustomEvent('asa:'+m.evento,{detail:m}));
  });
  // chama o programa: ASA.chamar('proj.listar') → promessa com a resposta
  const chamar=(cmd,a={})=>new Promise((ok,er)=>{
    if(!w)return er(new Error('Esta tela só funciona dentro do Asa.'));
    const id='c'+(++n);esp.set(id,[ok,er]);w.postMessage({id,cmd,a});
  });
  return{chamar,noApp:!!w};
})();

// ---- avisos na tela (canto de baixo), com botões opcionais ----
function aviso(texto,{tipo='ok',acoes=[],ms=6000}={}){
  let box=document.getElementById('asa-avisos');
  if(!box){box=document.createElement('div');box.id='asa-avisos';document.body.appendChild(box)}
  const el=document.createElement('div');el.className='asa-aviso '+tipo;el.setAttribute('role','status');
  el.innerHTML=`<span></span>`;el.firstChild.textContent=texto;
  for(const [rot,fn] of acoes){const b=document.createElement('button');b.type='button';b.textContent=rot;b.onclick=()=>{fn();el.remove()};el.appendChild(b)}
  const x=document.createElement('button');x.type='button';x.className='x';x.textContent='×';x.setAttribute('aria-label','Fechar');x.onclick=()=>el.remove();el.appendChild(x);
  box.appendChild(el);
  if(ms)setTimeout(()=>el.remove(),ms);
  return el;
}
// o arquivo que o Asa salvou (PDF, Word, vídeo): aviso com "Abrir" e "Mostrar na pasta"
function avisoArquivo(oque,caminho){
  const nome=caminho.split(/[\\/]/).pop();
  aviso(`${oque} salvo: ${nome}`,{ms:12000,acoes:[['Abrir',()=>ASA.chamar('abrir',{caminho})],['Mostrar na pasta',()=>ASA.chamar('mostrar',{caminho})]]});
}

const escH=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const ddmm=iso=>iso?`${iso.slice(8,10)}/${iso.slice(5,7)}`:'';

// ---- previsão do dia da captação (mesma regra do gerador: chance acima do limite E chuva de fato, ou trovoada) ----
async function previsaoDia(chave,lat,lon,iso,cfg){
  const c=Object.assign({a:8,b:17,r:30,mm:0.2},cfg||{});
  const [Y,M,D]=iso.split('-').map(Number);
  const horas=[];let tok='',n=0;
  do{
    const u=`https://weather.googleapis.com/v1/forecast/hours:lookup?key=${encodeURIComponent(chave)}&location.latitude=${(+lat).toFixed(5)}&location.longitude=${(+lon).toFixed(5)}&hours=240&pageSize=24&languageCode=pt-BR${tok?'&pageToken='+encodeURIComponent(tok):''}`;
    const r=await fetch(u);const j=await r.json();
    if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
    let passou=false;
    for(const f of j.forecastHours||[]){
      const t=f.displayDateTime||{};
      const dia=t.year*10000+t.month*100+t.day,alvo=Y*10000+M*100+D;
      if(dia>alvo){passou=true;break}
      if(dia===alvo&&t.hours>=c.a&&t.hours<c.b)horas.push({rain:f.precipitation?.probability?.percent??0,mm:f.precipitation?.qpf?.quantity??0,th:f.thunderstormProbability??0});
    }
    if(passou)break;
    tok=j.nextPageToken||'';n++;
  }while(tok&&n<12);
  if(!horas.length)return{estado:'longe'};          // ainda fora dos 10 dias da previsão
  const chuva=horas.filter(x=>(x.rain>=c.r&&(+x.mm||0)>c.mm)||x.th>=c.r).length;
  return{estado:chuva?'chuva':'ok',horas:horas.length,chuva};
}

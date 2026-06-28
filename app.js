// ===== APP.JS v7 =====
let curPage='dashboard',curPeriod='mes',deferredPrompt=null;
let parFilter='todos',parMesOffset=0,prevMonthOffset=1;
let exportedCode='',qrStream=null,qrScanInterval=null;
let curMetaTab='metas';

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ===== AJUDA =====
const HELPS={
  painel:{t:'📊 Como ler o Painel',b:`<strong>Saldo do Período</strong>Mostra APENAS o período selecionado (ex: Junho). Entradas de maio NÃO entram no saldo de junho.<strong>Cálculo:</strong>Entradas do mês − Saídas avulsas do mês − Parcelas pagas no mês = Saldo do período.<strong>Saldo acumulado</strong>Logo abaixo mostra o total histórico: tudo que entrou menos tudo que saiu desde o início.<strong>Por que os valores diferem?</strong>Uma parcela de abril paga em maio conta no saldo de MAIO, não de abril. Entradas de maio não aparecem no saldo de junho.`},
  entradas:{t:'💰 Como usar Entradas',b:`<strong>O que registrar aqui</strong>Salário, freelas, restituições, transferências recebidas, qualquer dinheiro que entrou.<strong>Recorrência</strong>Se é um salário mensal, marque "Mensal" — o app vai sugerir na Previsão.<strong>Data</strong>Use a data real que o dinheiro chegou na sua conta.`},
  saidas:{t:'💸 Como usar Saídas',b:`<strong>O que registrar aqui</strong>Gastos pontuais: mercado, restaurante, combustível, contas pagas à vista.<strong>Não registre aqui</strong>Parcelamentos — esses vão na aba Parcelas.<strong>O saldo mostrado</strong>É total de entradas menos total de saídas (avulsas + parcelas pagas).`},
  parcelas:{t:'🔄 Como usar Parcelamentos',b:`<strong>Cadastro</strong>Informe o número de parcelas PRIMEIRO. Depois preencha o valor total OU da parcela — o outro calcula automático.<strong>Dia de vencimento</strong>Informe o dia do mês que vence (ex: dia 5). Assim cada parcela aparece no mês certo.<strong>Pílulas (números)</strong>Toque para marcar: ⬜ Pendente → ✅ Pago (pede data e valor pago) → ⚠️ Atrasado → volta Pendente.<strong>Quando paga</strong>A parcela sai do saldo e aparece nas Saídas.`},
  previsao:{t:'🔮 Como usar Previsão',b:`<strong>Para que serve</strong>Ver como vai ficar seu bolso no mês seguinte ANTES que aconteça.<strong>Auto-carregado</strong>Parcelas com vencimento no mês e transações recorrentes aparecem automaticamente.<strong>Como usar</strong>Adicione suas entradas e saídas previstas. O saldo previsto mostra se o mês vai ser positivo ou negativo.`},
  metas:{t:'🎯 Como usar Metas & Sonhos',b:`<strong>Metas</strong>Objetivos com valor e prazo definidos. O app calcula quanto guardar por mês.<strong>Investimentos</strong>Registre aplicações e veja o rendimento estimado.<strong>Sonhos</strong>Escreva seus sonhos com o custo estimado — inspire-se a economizar!`},
  familia:{t:'👨‍👩‍👧 Como compartilhar',b:`<strong>Gerar QR Code</strong>Clique "Gerar QR Code" — aparece um QR com seu resumo do mês. O familiar escaneia com o app deles.<strong>Por código</strong>Clique "Gerar QR Code" → copie o código → mande por WhatsApp → o familiar cola no app.<strong>Importar</strong>Escaneie o QR do familiar ou cole o código recebido.<strong>O que é compartilhado</strong>Só o resumo do mês: entradas, saídas e saldo. Nenhum dado pessoal detalhado.`}
};
function showHelp(key){ const h=HELPS[key]; if(!h) return; document.getElementById('helpTitle').textContent=h.t; document.getElementById('helpBody').innerHTML=h.b; document.getElementById('helpTooltip').classList.remove('hidden'); }
function closeHelp(){ document.getElementById('helpTooltip').classList.add('hidden'); }

// Start app as soon as possible
function startApp(){
  document.getElementById('splash').classList.add('out');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

function initApp(){
  applyTheme(); setupNav(); setupPeriod(); populateMonths(); populateFamMeses();
  renderAll(); setupInstall();
  document.getElementById('themeBtn').onclick=toggleTheme;
  document.getElementById('notifBtn').onclick=toggleAlerts;
  window.addEventListener('resize',()=>{ if(curPage==='dashboard') renderDash(); });
  const cfg=DB.getConfig(); if(cfg.nome) document.getElementById('meuNome').value=cfg.nome;
}

function applyTheme(){ const cfg=DB.getConfig(); document.documentElement.setAttribute('data-theme',cfg.theme||'dark'); document.getElementById('themeBtn').textContent=cfg.theme==='light'?'🌙':'☀️'; }
function toggleTheme(){ const cfg=DB.getConfig(); cfg.theme=cfg.theme==='light'?'dark':'light'; DB.saveConfig(cfg); applyTheme(); setTimeout(()=>Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)),50); }

function setupNav(){ document.querySelectorAll('.ni').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page))); }
function goPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.querySelector(`.ni[data-page="${page}"]`)?.classList.add('active');
  curPage=page;
  ({dashboard:renderDash,entradas:renderEntradas,saidas:renderSaidas,parcelas:renderParcelas,previsao:renderPrevisao,metas:renderMetas,analise:()=>{},familia:renderFamilia,historico:renderHist})[page]?.();
}

function setupPeriod(){
  document.querySelectorAll('.pbtn').forEach(b=>{ b.addEventListener('click',()=>{ document.querySelectorAll('.pbtn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); curPeriod=b.dataset.p; renderDash(); }); });
  document.getElementById('chartMonths').addEventListener('change',e=>Charts.drawFlow(parseInt(e.target.value)));
}
function renderAll(){ renderDash(); }

// ===== DASHBOARD v14 — SIMPLES E CLARO =====
function renderDash(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  const r=curPeriod==='mes'?DB.resumoMes(y,m):DB.resumoPeriodo(curPeriod);

  // === SALDO ACUMULADO (o mais importante — fica no topo grande) ===
  const allTx=DB.getTx();
  const entHist=allTx.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
  const saiHist=allTx.filter(t=>t.tipo==='saida'&&!t._parId).reduce((s,t)=>s+t.valor,0);
  const parPagasHist=DB.getPar().reduce((s,p)=>{
    return s+p.pagamentos.filter(x=>x?.status==='pago').reduce((ps,x)=>ps+(x.valorPago||p.valorParcela),0);
  },0);
  const saldoAcumulado=entHist-saiHist-parPagasHist;

  const sacEl=document.getElementById('saldoHistorico');
  if(sacEl){
    sacEl.textContent=DB.fmt(saldoAcumulado);
    sacEl.className='hero-saldo-acu'+(saldoAcumulado<0?' negativo':'');
  }

  // Barra de saúde financeira
  const healthFill=document.getElementById('healthFill');
  const healthLabel=document.getElementById('healthLabel');
  if(healthFill&&healthLabel){
    const ent=r.entradas, sai=r.totalSaidasPagas+((r.parcelasPendentes||0));
    const pct=ent>0?Math.min(100,Math.round((1-(sai/ent))*100)):0;
    let cor,status;
    if(pct>=30){cor='linear-gradient(90deg,#3ddc84,#22d3ee)';status='✅ Situação boa!'}
    else if(pct>=10){cor='linear-gradient(90deg,#fbbf24,#fb923c)';status='⚠️ Atenção aos gastos'}
    else{cor='linear-gradient(90deg,#ff6b6b,#ef4444)';status='🚨 Gastos acima da renda'}
    if(ent===0){cor='rgba(255,255,255,.1)';status='Adicione suas entradas'}
    healthFill.style.width=Math.max(2,pct)+'%';
    healthFill.style.background=cor;
    healthLabel.textContent=status;
    healthLabel.style.color=pct>=30?'var(--green)':pct>=10?'var(--yellow)':'var(--red)';
    if(ent===0) healthLabel.style.color='var(--text3)';
  }

  // === RESUMO DO MÊS ===
  const periodoLabel=document.getElementById('periodoLabel');
  const labels={mes:`Este mês — ${MESES[m]} ${y}`,trimestre:`Últimos 3 meses`,ano:`Ano ${y}`};
  if(periodoLabel) periodoLabel.textContent=labels[curPeriod];

  // "Entrou"
  const dispEnt=document.getElementById('dispEntradas');
  if(dispEnt) dispEnt.textContent=DB.fmt(r.entradas);

  // "Saiu" — saídas + parcelas pagas
  const dispSai=document.getElementById('dispSaidas');
  if(dispSai) dispSai.textContent=DB.fmt(r.totalSaidasPagas);

  // "Sobrou" — saldo do período
  const saldoEl=document.getElementById('saldoDisplay');
  if(saldoEl){
    saldoEl.textContent=DB.fmt(r.saldoReal);
    saldoEl.style.color=r.saldoReal>=0?'var(--blue)':'var(--red)';
  }

  // === ALERTA: O QUE AINDA PRECISA PAGAR ===
  const parMesAtual=DB.parcelasDoMes(y,m);
  const pendenteMes=parMesAtual.filter(x=>x.status!=='pago').reduce((s,x)=>s+x.par.valorParcela,0);
  const atrasadaMes=parMesAtual.filter(x=>x.status==='atrasado').reduce((s,x)=>s+x.par.valorParcela,0);
  const alertaEl=document.getElementById('alertaPendente');
  const apValEl=document.getElementById('apVal');
  const apTituloEl=document.querySelector('.ap-titulo');
  if(alertaEl){
    if(pendenteMes>0||atrasadaMes>0){
      alertaEl.classList.remove('hidden');
      const temAtraso=atrasadaMes>0;
      if(apValEl) apValEl.textContent=DB.fmt(pendenteMes);
      if(apTituloEl) apTituloEl.textContent=temAtraso?
        `⚠️ ${DB.fmt(atrasadaMes)} em ATRASO + ${DB.fmt(pendenteMes-atrasadaMes)} pendente`:
        `Falta pagar neste mês`;
      alertaEl.style.borderColor=temAtraso?'rgba(255,107,107,.4)':'rgba(251,191,36,.3)';
      alertaEl.style.background=temAtraso?'rgba(255,107,107,.08)':'rgba(251,191,36,.08)';
      if(apValEl) apValEl.style.color=temAtraso?'var(--red)':'var(--yellow)';
    } else {
      alertaEl.classList.add('hidden');
    }
  }

  // Hidden refs (mantém compatibilidade com outras funções)
  const setBB=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  setBB('bbEnt',DB.fmtShort(r.entradas));
  setBB('bbSai',DB.fmtShort(r.saidasAvulsas));
  setBB('bbPar',DB.fmtShort(r.parcelasPagas));
  setBB('qEnt',DB.fmtShort(r.entradas));
  setBB('qSai',DB.fmtShort(r.totalSaidasPagas));
  setBB('qPar',DB.fmtShort(pendenteMes));
  setBB('qPrev','');

  calcScore(r.entradas,r.totalSaidasPagas+(r.parcelasPendentes||0)+(r.parcelasAtrasadas||0),r.saldoReal);
  setTimeout(()=>Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)),50);
  renderCatsDash(y,m,curPeriod);
  renderRecentTxDash();
  genSugestoes(r);
  renderCalcExplain(r, labels[curPeriod]);
}

function calcScore(ent,comp,saldo){
  const sv=document.getElementById('scoreVal'),ss=document.getElementById('scoreStatus');
  if(ent===0&&comp===0){ sv.textContent='--'; ss.textContent='Sem dados'; ss.style.color='var(--text3)'; Charts.drawGauge(0); return; }
  let s=0; const taxa=ent>0?comp/ent:1;
  if(taxa<=0.5)s+=40; else if(taxa<=0.7)s+=28; else if(taxa<=0.9)s+=12;
  if(saldo>0)s+=30; else if(saldo===0)s+=10;
  if(ent>0)s+=15; if(ent>0&&saldo/ent>=0.2)s+=15;
  s=Math.min(100,s); sv.textContent=s;
  if(s>=70){ sv.style.color='var(--green)'; ss.textContent='✨ Excelente!'; ss.style.color='var(--green)'; }
  else if(s>=50){ sv.style.color='var(--yellow)'; ss.textContent='⚠️ Atenção'; ss.style.color='var(--yellow)'; }
  else{ sv.style.color='var(--red)'; ss.textContent='🚨 Crítico'; ss.style.color='var(--red)'; }
  Charts.drawGauge(s);
}

function renderCatsDash(y,m,periodo){
  const cats={};
  let txList=[];
  if(periodo==='mes') txList=DB.txDoMes(y,m).filter(t=>t.tipo==='saida');
  else{ const n=periodo==='trimestre'?3:12; for(let i=0;i<n;i++){ const d=new Date(y,m-i,1); txList=[...txList,...DB.txDoMes(d.getFullYear(),d.getMonth()).filter(t=>t.tipo==='saida')]; } }
  txList.forEach(t=>{ cats[t.categoria]=(cats[t.categoria]||0)+t.valor; });
  if(periodo==='mes') DB.parcelasDoMes(y,m).filter(x=>x.status==='pago').forEach(x=>{ cats[x.par.categoria]=(cats[x.par.categoria]||0)+x.par.valorParcela; });
  const total=Object.values(cats).reduce((s,v)=>s+v,0)||1;
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=document.getElementById('catList');
  if(!sorted.length){ el.innerHTML='<div class="empty"><div class="eic">📊</div><p>Sem dados</p></div>'; return; }
  el.innerHTML=sorted.map(([c,v])=>`<div class="cat-item"><div class="cat-em">${DB.catEmoji(c)}</div><div class="cat-inf"><div class="cat-nm">${c}</div><div class="cat-bw"><div class="cat-b" style="width:${(v/total*100).toFixed(1)}%;background:${DB.catColor(c)}"></div></div></div><div class="cat-pc">${(v/total*100).toFixed(0)}%</div></div>`).join('');
}

function renderRecentTxDash(){
  const all=DB.getTx().filter(t=>!t._parId).sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,5);
  const el=document.getElementById('recentTx');
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">💸</div><p>Nenhuma transação</p></div>'; return; }
  el.innerHTML=all.map(t=>txHTML(t,false)).join('');
}

function genSugestoes(r){
  const suggs=[],alerts=[];
  const {entradas,totalSaidasPagas,parcelasAtrasadas,parcelasPendentes,saldoReal}=r;
  if(entradas===0) suggs.push({t:'warn',m:'💡 Adicione suas entradas para ver análise completa.'});
  else{
    const taxa=(totalSaidasPagas+(parcelasPendentes||0))/entradas;
    if(taxa>1){ suggs.push({t:'danger',m:`🚨 Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!`}); alerts.push({t:'danger',m:`Gastos ${((taxa-1)*100).toFixed(0)}% acima`}); }
    else if(taxa>0.8){ suggs.push({t:'warn',m:`⚠️ ${(taxa*100).toFixed(0)}% da renda comprometida.`}); alerts.push({t:'warn',m:`${(taxa*100).toFixed(0)}% comprometida`}); }
    else if(taxa<=0.5) suggs.push({t:'good',m:`✅ Economizando ${((1-taxa)*100).toFixed(0)}% da renda!`});
    else suggs.push({t:'info',m:`📊 ${(taxa*100).toFixed(0)}% comprometida. Meta: abaixo de 70%.`});
  }
  const nAt=DB.getPar().reduce((n,p)=>n+p.pagamentos.filter(x=>x?.status==='atrasado').length,0);
  if(nAt>0){ suggs.push({t:'danger',m:`🚨 ${nAt} parcela(s) em atraso!`}); alerts.push({t:'danger',m:`${nAt} parcela(s) atrasada(s)`}); }
  if(parcelasPendentes>0) suggs.push({t:'warn',m:`🔄 ${DB.fmt(parcelasPendentes)} em parcelas pendentes neste mês.`});
  if(saldoReal>0&&entradas>0){ const pct=(saldoReal/entradas*100).toFixed(0); suggs.push({t:pct>=20?'good':'info',m:pct>=20?`💰 ${pct}% de sobra — considere investir!`:`🏦 Tente guardar 20% da renda.`}); }
  if(!suggs.length) suggs.push({t:'info',m:'💡 Adicione transações para análises.'});
  document.getElementById('suggList').innerHTML=suggs.map(s=>`<div class="sugg-item ${s.t}">${s.m}</div>`).join('');
  const badge=document.getElementById('alertBadge'),aList=document.getElementById('alertList');
  if(!alerts.length){ badge.classList.add('hidden'); aList.innerHTML='<div class="alert-item ok">✅ Tudo sob controle!</div>'; }
  else{ badge.textContent=alerts.length; badge.classList.remove('hidden'); aList.innerHTML=alerts.map(a=>`<div class="alert-item ${a.t}">${a.t==='danger'?'🚨':'⚠️'} ${a.m}</div>`).join(''); }
}
function toggleAlerts(){ document.getElementById('alertPanel').classList.toggle('hidden'); }
function closeAlerts(){ document.getElementById('alertPanel').classList.add('hidden'); }

// ===== TX HTML =====
function txHTML(t,showDel=false){
  return `<div class="txi"${showDel&&!t._parId?` onclick="editTx('${t.id}')"`:''}>
    <div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div>
    <div class="txi-inf">
      <div class="txi-desc">${t.descricao}</div>
      <div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${t.recorrencia&&t.recorrencia!=='nenhuma'?' · 🔄':''}</div>
    </div>
    <div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>
    ${showDel&&!t._parId?`<button class="del-btn" onclick="event.stopPropagation();delTx('${t.id}')">🗑</button>`:''}
  </div>`;
}

// ===== ENTRADAS =====
function renderEntradas(){
  const all=DB.getTx().filter(t=>t.tipo==='entrada');
  document.getElementById('entTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  document.getElementById('entList').innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💰</div><p>Nenhuma entrada</p></div>';
}

// ===== SAÍDAS — mostra vencimento e data de pagamento =====
function renderSaidas(){
  const avulsas=DB.getTx().filter(t=>t.tipo==='saida'&&!t._parId);
  const totalAvulsas=avulsas.reduce((s,t)=>s+t.valor,0);
  const parcelasPagas=[];
  DB.getPar().forEach(p=>{
    for(let i=0;i<p.nParcelas;i++){
      const pg=p.pagamentos[i];
      if(pg?.status==='pago'){
        const due=DB.parcelaDueDate(p,i);
        const dueStr=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
        parcelasPagas.push({isParcela:true,descricao:`${p.descricao} (${i+1}/${p.nParcelas})`,valor:pg.valorPago||p.valorParcela,data:pg.dataPagamento||dueStr,dataVenc:dueStr,categoria:p.categoria});
      }
    }
  });
  const totalParcelas=parcelasPagas.reduce((s,t)=>s+t.valor,0);
  const totalGeral=totalAvulsas+totalParcelas;
  document.getElementById('saiTotal').textContent=DB.fmt(totalGeral);
  const entradas=DB.getTx().filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
  const saldoEl=document.getElementById('saiSaldo');
  if(saldoEl){ const sv=entradas-totalGeral; saldoEl.textContent=DB.fmt(sv); saldoEl.style.color=sv>=0?'var(--green)':'var(--red)'; }
  const all=[...avulsas,...parcelasPagas].sort((a,b)=>new Date(b.data)-new Date(a.data));
  const el=document.getElementById('saiList');
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">💸</div><p>Nenhuma saída</p></div>'; return; }
  el.innerHTML=all.map(t=>`<div class="txi"${!t.isParcela?` onclick="editTx('${t.id}')"`:''}>
    <div class="txi-ic saida">${DB.catEmoji(t.categoria)}</div>
    <div class="txi-inf">
      <div class="txi-desc">${t.descricao}${t.isParcela?'<span style="font-size:10px;background:var(--blueb);color:var(--blue);border-radius:5px;padding:1px 5px;margin-left:4px;font-weight:700">parcela</span>':''}</div>
      <div class="txi-meta">${t.isParcela?`Pago: ${DB.fmtDate(t.data)} · Venc: ${DB.fmtDate(t.dataVenc)} · ${t.categoria}`:DB.fmtDate(t.data)+' · '+t.categoria}</div>
    </div>
    <div class="txi-amt saida">-${DB.fmt(t.valor)}</div>
    ${!t.isParcela?`<button class="del-btn" onclick="event.stopPropagation();delTx('${t.id}')">🗑</button>`:''}
  </div>`).join('');
}

// ===== PARCELAS =====
function renderParcelas(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  const target=new Date(y,m+parMesOffset,1),ty=target.getFullYear(),tm=target.getMonth();
  const all=DB.getPar(),filtered=parFilter==='todos'?all:all.filter(p=>p.tipo===parFilter);
  const parMes=DB.parcelasDoMes(ty,tm);
  const totalMes=parMes.reduce((s,x)=>s+x.par.valorParcela,0);
  const totalPago=parMes.filter(x=>x.status==='pago').reduce((s,x)=>s+(x.valorPago||x.par.valorParcela),0);
  const totalAtrasado=parMes.filter(x=>x.status==='atrasado').reduce((s,x)=>s+x.par.valorParcela,0);
  const totalPendente=parMes.filter(x=>x.status==='pendente').reduce((s,x)=>s+x.par.valorParcela,0);
  document.getElementById('parTotal').textContent=DB.fmt(totalMes)+' / mês';

  const mesOpts=Array.from({length:12},(_,i)=>{ const d=new Date(y,m-3+i,1),off=Math.round((d-new Date(y,m,1))/(1000*60*60*24*30)); return `<option value="${off}" ${off===parMesOffset?'selected':''}>${MESES[d.getMonth()]} ${d.getFullYear()}</option>`; }).join('');

  let html=`<div class="par-mes-row"><label>Mês</label><select class="par-mes-sel" onchange="parMesOffset=parseInt(this.value);renderParcelas()">${mesOpts}</select></div>
  <div class="par-totais">
    <div class="par-tot-box"><label>Vence no mês</label><span class="blue-t">${DB.fmtShort(totalMes)}</span></div>
    <div class="par-tot-box"><label>✅ Pago</label><span class="green-t">${DB.fmtShort(totalPago)}</span></div>
    <div class="par-tot-box"><label>${totalAtrasado>0?'⚠️ Atraso':'⏳ Pendente'}</label><span class="${totalAtrasado>0?'red-t':''}">${DB.fmtShort(totalAtrasado>0?totalAtrasado:totalPendente)}</span></div>
  </div>
  <div class="par-tabs"><button class="par-tab ${parFilter==='todos'?'active':''}" onclick="setParFilter('todos')">Todos</button><button class="par-tab ${parFilter==='credcard'?'active':''}" onclick="setParFilter('credcard')">💳 Crediário</button><button class="par-tab ${parFilter==='financing'?'active':''}" onclick="setParFilter('financing')">🏦 Financ.</button><button class="par-tab ${parFilter==='credit'?'active':''}" onclick="setParFilter('credit')">🔄 Cartão</button></div>
  <div style="padding:0 14px"><button class="fab" style="margin:12px 0" onclick="openModal('parcela')">+ Novo Parcelamento</button>`;

  if(!filtered.length) html+='<div class="empty"><div class="eic">🔄</div><p>Nenhum parcelamento</p></div>';
  else filtered.sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm)).forEach(p=>{ html+=parCardHTML(p,ty,tm); });
  html+='</div>';
  document.getElementById('parList').innerHTML=html;
}

function parCardHTML(p,ty,tm){
  const pagas=p.pagamentos.filter(x=>x?.status==='pago').length;
  const atrasadas=p.pagamentos.filter(x=>x?.status==='atrasado').length;
  const pct=Math.round(pagas/p.nParcelas*100);
  const saldoDevedor=DB.fmt(p.valorTotal-(pagas*(p.valorParcela)));
  const tc=DB.typeClass(p.tipo),tl=DB.typeLabel(p.tipo);
  const gradMap={credcard:'#f59e0b,#fb923c',financing:'#4da6ff,#22d3ee',credit:'#b57bee,#4da6ff'};
  let pills='';
  for(let i=0;i<p.nParcelas;i++){
    const due=DB.parcelaDueDate(p,i),diff=(due.getFullYear()-ty)*12+(due.getMonth()-tm);
    if(Math.abs(diff)>2) continue;
    const pg=p.pagamentos[i]||{status:'pendente'},st=pg.status||'pendente';
    const isFuture=due>new Date()&&st==='pendente',cls=isFuture?'futuro':st;
    const icon={pago:'✓',atrasado:'!',pendente:''+(i+1),futuro:''+(i+1)}[cls]||i+1;
    const stLabel={pago:'✅ Pago',atrasado:'⚠️ Atrasado',pendente:'⏳ Pendente',futuro:'Futuro'}[cls]||cls;
    const dueLabel=`${stLabel} — Parcela ${i+1}\nVence: ${String(due.getDate()).padStart(2,'0')}/${MESES[due.getMonth()].slice(0,3)}/${due.getFullYear()}\nToque para apontar`;
    pills+=`<div class="inst-pill ${cls}" title="${dueLabel}" onclick="abrirPagModal('${p.id}',${i})">${icon}</div>`;
  }
  if(!pills) pills='<span style="font-size:12px;color:var(--text3)">Sem parcelas neste período</span>';
  return `<div class="par-card ${tc}">
    <div class="par-head">
      <div><div class="par-title">${p.descricao}</div><div class="par-cat">${DB.catEmoji(p.categoria)} ${p.categoria}${p.diaVencimento?` · dia ${p.diaVencimento}`:''}</div></div>
      <div style="text-align:right"><div class="par-type-badge ${tc}">${tl}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${p.nParcelas}x de ${DB.fmt(p.valorParcela)}</div></div>
    </div>
    <div class="par-values">
      <div class="par-vbox"><label>Parcela mensal</label><span>${DB.fmt(p.valorParcela)}</span></div>
      <div class="par-vbox"><label>Saldo devedor</label><span style="color:var(--red)">${saldoDevedor}</span></div>
    </div>
    <div class="par-prog-wrap"><div class="par-prog" style="width:${pct}%;background:linear-gradient(90deg,${gradMap[tc]||'#4da6ff,#22d3ee'})"></div></div>
    <div class="inst-legend"><div class="legend-item"><div class="legend-dot pago"></div>Pago</div><div class="legend-item"><div class="legend-dot atrasado"></div>Atrasado</div><div class="legend-item"><div class="legend-dot pendente"></div>Pendente</div><div class="legend-item" style="margin-left:auto;font-size:10px;color:var(--text3)">👆 toque para apontar</div></div>
    <div class="par-installments">${pills}</div>
    <div class="par-footer">
      <div class="par-info-txt">${pagas}/${p.nParcelas} pagas${atrasadas>0?` · <span style="color:var(--red)">${atrasadas} atrasada(s)</span>`:''}</div>
      <div><button class="par-edit-btn" onclick="abrirParEdit('${p.id}')">✏️ Editar</button><button class="par-del" onclick="delPar('${p.id}')">🗑</button></div>
    </div>
  </div>`;
}
function setParFilter(f){ parFilter=f; renderParcelas(); }

// ===== MODAL APONTAMENTO PARCELA — 2 passos =====
function abrirPagModal(parId,idx){
  const par=DB.getPar().find(p=>p.id==parId); if(!par) return;
  const pg=par.pagamentos[idx]||{status:'pendente'};
  const cur=pg.status||'pendente';
  const due=DB.parcelaDueDate(par,idx);
  const dueStr=`${String(due.getDate()).padStart(2,'0')}/${MESES[due.getMonth()]} ${due.getFullYear()}`;

  // Preenche dados no modal
  document.getElementById('pagParId').value=parId;
  document.getElementById('pagIdx').value=idx;
  document.getElementById('pagData').value=DB.nowDate();
  document.getElementById('pagValor').value=par.valorParcela.toFixed(2);
  document.getElementById('pagModalTitle').textContent=`📋 Parcela ${idx+1}/${par.nParcelas}`;

  // Info da parcela
  const descEl=document.getElementById('pagDescInfo');
  const valEl=document.getElementById('pagValInfo');
  const vencEl=document.getElementById('pagVencInfo');
  if(descEl) descEl.textContent=par.descricao;
  if(valEl){ valEl.textContent=DB.fmt(par.valorParcela); }
  if(vencEl) vencEl.textContent=`Vence: ${dueStr}`;

  // Status atual no info
  const statusColors={pago:'var(--green)',atrasado:'var(--red)',pendente:'var(--text3)',futuro:'var(--text3)'};
  if(valEl) valEl.style.color=statusColors[cur]||'var(--blue)';

  // Mostra Step 1 (escolha)
  mostrarStep(1);
  document.getElementById('pagModal').classList.remove('hidden');
}

function mostrarStep(n){
  document.getElementById('pagStep1').style.display=n===1?'block':'none';
  document.getElementById('pagStep2').style.display=n===2?'block':'none';
  document.getElementById('pagStep3').style.display=n===3?'block':'none';
}

function voltarStep1(){ mostrarStep(1); }

function escolherApontamento(tipo){
  const parId=document.getElementById('pagParId').value;
  const idx=parseInt(document.getElementById('pagIdx').value);
  const par=DB.getPar().find(p=>p.id==parId); if(!par) return;

  if(tipo==='pago'){
    // Step 2: pedir data e valor
    mostrarStep(2);
  } else if(tipo==='atrasado'){
    // Step 3: confirmar atraso
    const due=DB.parcelaDueDate(par,idx);
    const hoje=new Date();
    const diasAtraso=Math.max(0,Math.round((hoje-due)/(1000*60*60*24)));
    const infoEl=document.getElementById('pagAtrasadoInfo');
    if(infoEl) infoEl.innerHTML=`Parcela ${idx+1}/${par.nParcelas} — ${par.descricao}<br>Venceu em ${String(due.getDate()).padStart(2,'0')}/${MESES[due.getMonth()]} ${due.getFullYear()}${diasAtraso>0?`<br><strong style="color:var(--red)">${diasAtraso} dia(s) em atraso</strong>`:''}`;
    mostrarStep(3);
  } else {
    // Pendente: direto, sem confirmação extra
    par.pagamentos[idx]={status:'pendente',dataPagamento:null,valorPago:null};
    DB.updatePar(parId,{pagamentos:par.pagamentos});
    fecharPagModal();
    showToast(`⏳ Parcela ${idx+1} marcada como pendente`);
    renderParcelas(); renderDash();
  }
}

function confirmarAtrasado(){
  const parId=document.getElementById('pagParId').value;
  const idx=parseInt(document.getElementById('pagIdx').value);
  const par=DB.getPar().find(p=>p.id==parId); if(!par) return;
  // Remove pagamento se havia
  const txPaga=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx);
  if(txPaga) DB.removeTx(txPaga.id);
  par.pagamentos[idx]={status:'atrasado',dataPagamento:null,valorPago:null};
  DB.updatePar(parId,{pagamentos:par.pagamentos});
  fecharPagModal();
  showToast(`⚠️ Parcela ${idx+1} marcada como ATRASADA — regularize o quanto antes!`);
  renderParcelas(); renderDash(); if(curPage==='saidas') renderSaidas();
}

function fecharPagModal(){ document.getElementById('pagModal').classList.add('hidden'); }

function confirmarPagamento(){
  const parId=document.getElementById('pagParId').value;
  const idx=parseInt(document.getElementById('pagIdx').value);
  const data=document.getElementById('pagData').value;
  const valor=parseFloat(document.getElementById('pagValor').value);
  if(!data){ showToast('Informe a data de pagamento'); return; }
  const par=DB.getPar().find(p=>p.id==parId); if(!par) return;
  par.pagamentos[idx]={status:'pago',dataPagamento:data,valorPago:valor||par.valorParcela};
  DB.updatePar(parId,{pagamentos:par.pagamentos});
  // Remove tx antiga se existia (evita duplicata)
  const txAntiga=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx);
  if(txAntiga) DB.removeTx(txAntiga.id);
  // Cria nova tx com data correta
  const due=DB.parcelaDueDate(par,idx);
  DB.addTx({tipo:'saida',descricao:`${par.descricao} (${idx+1}/${par.nParcelas})`,valor:valor||par.valorParcela,data,categoria:par.categoria,recorrencia:'nenhuma',_parId:parId,_parIdx:idx});
  fecharPagModal();
  showToast(`✅ Parcela ${idx+1} paga! ${DB.fmt(valor||par.valorParcela)}`);
  renderParcelas(); renderDash(); if(curPage==='saidas') renderSaidas();
}
document.getElementById('pagModal').addEventListener('click',e=>{ if(e.target===document.getElementById('pagModal')) fecharPagModal(); });

function delPar(id){
  if(!confirm('Remover este parcelamento?')) return;
  DB.removePar(id); showToast('🗑 Removido'); renderParcelas(); renderDash();
}

// ===== EDITAR PARCELA =====
function abrirParEdit(id){
  const p=DB.getPar().find(x=>x.id==id); if(!p) return;
  document.getElementById('parEditId').value=p.id;
  document.getElementById('parEditDesc').value=p.descricao;
  document.getElementById('parEditN').value=p.nParcelas;
  document.getElementById('parEditValParc').value=p.valorParcela;
  document.getElementById('parEditValTotal').value=p.valorTotal;
  document.getElementById('parEditDiaVenc').value=p.diaVencimento||'';
  document.getElementById('parEditCat').value=p.categoria||'Geral';
  document.getElementById('parEditTipo').value=p.tipo||'credcard';
  document.getElementById('parModal').classList.remove('hidden');
}
function fecharParModal(){ document.getElementById('parModal').classList.add('hidden'); }
function parEditCalc(src){ const n=DB.getPar().find(x=>x.id==document.getElementById('parEditId').value)?.nParcelas||1; if(src==='parc'){ const v=parseFloat(document.getElementById('parEditValParc').value); if(v) document.getElementById('parEditValTotal').value=(v*n).toFixed(2); } else{ const v=parseFloat(document.getElementById('parEditValTotal').value); if(v) document.getElementById('parEditValParc').value=(v/n).toFixed(2); } }
function salvarParEdit(){
  const id=document.getElementById('parEditId').value,desc=document.getElementById('parEditDesc').value.trim();
  const vP=parseFloat(document.getElementById('parEditValParc').value),vT=parseFloat(document.getElementById('parEditValTotal').value);
  const diaVenc=parseInt(document.getElementById('parEditDiaVenc').value)||null;
  const cat=document.getElementById('parEditCat').value,tipo=document.getElementById('parEditTipo').value;
  if(!desc||!vP){ showToast('Preencha os campos'); return; }
  DB.updatePar(id,{descricao:desc,valorParcela:vP,valorTotal:vT||vP,diaVencimento:diaVenc,categoria:cat,tipo});
  fecharParModal(); showToast('✅ Atualizado!'); renderParcelas();
}
document.getElementById('parModal').addEventListener('click',e=>{ if(e.target===document.getElementById('parModal')) fecharParModal(); });

// ===== PREVISÃO =====
function prevMonthKey(off){ const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()+off,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function prevMonthLabel(off){ const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()+off,1); return `${MESES[d.getMonth()]} ${d.getFullYear()}${off===0?' (atual)':off===1?' (próximo)':off===-1?' (anterior)':''}`; }
function prevChangeMonth(delta){ prevMonthOffset+=delta; renderPrevisao(); }

function renderPrevisao(){
  const key=prevMonthKey(prevMonthOffset);
  let data=DB.getPrev(key);
  document.getElementById('prevMonthLabel').textContent=prevMonthLabel(prevMonthOffset);

  // Bug fix: if _loaded but no auto items, check if there ARE parcelas for this month
  // This handles the case where old empty data was cached before the parcelas fix
  if(data._loaded){
    const now2=new Date(),target2=new Date(now2.getFullYear(),now2.getMonth()+prevMonthOffset,1);
    const parCheck=DB.parcelasDoMes(target2.getFullYear(),target2.getMonth()).filter(x=>x.status!=='pago');
    const hasAutoSaidas=data.saidas.some(s=>s._recorrente||s._parId);
    const hasAutoEntradas=data.entradas.some(e=>e._recorrente||e._srcId);
    // If there are pending parcelas but no auto items loaded, force reload
    if(parCheck.length>0&&!hasAutoSaidas){
      data._loaded=false;
      DB.savePrev(key,data);
    }
  }

  if(!data._loaded){
    const now=new Date(),target=new Date(now.getFullYear(),now.getMonth()+prevMonthOffset,1);
    const ty=target.getFullYear(),tm=target.getMonth();
    DB.getTx().filter(t=>t.recorrencia&&t.recorrencia!=='nenhuma').forEach(t=>{
      const ex=data.entradas.some(i=>i._srcId===t.id)||data.saidas.some(i=>i._srcId===t.id);
      if(!ex){ const item={id:Date.now()+Math.random(),desc:t.descricao+' 🔄',valor:t.valor,_srcId:t.id,_recorrente:true}; t.tipo==='entrada'?data.entradas.push(item):data.saidas.push(item); }
    });
    // Bug fix: só mostra parcelas com vencimento NESTE mês target
    DB.parcelasDoMes(ty,tm).filter(x=>x.status!=='pago').forEach(x=>{
      if(!data.saidas.some(s=>s._parId===x.par.id&&s._parIdx===x.idx)){
        const due=x.due;
        data.saidas.push({id:Date.now()+Math.random(),desc:`${x.par.descricao} (${x.idx+1}/${x.par.nParcelas}) 🔄 dia ${due.getDate()}`,valor:x.par.valorParcela,_parId:x.par.id,_parIdx:x.idx,_recorrente:true});
      }
    });
    data._loaded=true; DB.savePrev(key,data);
  }
  const totEnt=data.entradas.reduce((s,i)=>s+i.valor,0),totSai=data.saidas.reduce((s,i)=>s+i.valor,0),saldo=totEnt-totSai;
  const saldoEl=document.getElementById('prevSaldo');
  saldoEl.textContent=DB.fmt(saldo); saldoEl.className='prev-saldo '+(saldo>0?'pos':saldo<0?'neg':'neu');
  document.getElementById('prevEntTotal').textContent=DB.fmt(totEnt);
  document.getElementById('prevSaiTotal').textContent=DB.fmt(totSai);
  document.getElementById('prevEntList').innerHTML=data.entradas.length?data.entradas.map(i=>prevItemHTML(i,'entrada',key)).join(''):'<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhuma entrada prevista</div>';
  document.getElementById('prevSaiList').innerHTML=data.saidas.length?data.saidas.map(i=>prevItemHTML(i,'saida',key)).join(''):'<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhuma saída prevista</div>';
  document.getElementById('sumEnt').textContent=DB.fmt(totEnt);
  document.getElementById('sumSai').textContent=DB.fmt(totSai);
  const ss=document.getElementById('sumSaldo'); ss.textContent=DB.fmt(saldo); ss.style.color=saldo>=0?'var(--green)':'var(--red)';
  const msgs=[];
  if(totEnt===0&&totSai===0) msgs.push({t:'warn',m:'💡 Adicione entradas e saídas previstas. Se você tem parcelas neste mês e não aparecem, toque em "🔄 Recarregar" abaixo.'});
  else if(totEnt===0) msgs.push({t:'warn',m:'💡 Adicione suas entradas previstas para ver o saldo.'});
  else{ const t2=totSai/totEnt; if(t2>1) msgs.push({t:'danger',m:`🚨 Previsão negativa! ${DB.fmt(Math.abs(saldo))} acima das entradas.`}); else if(t2>0.8) msgs.push({t:'warn',m:`⚠️ ${(t2*100).toFixed(0)}% comprometida.`}); else msgs.push({t:'good',m:`✅ Sobra prevista: ${DB.fmt(saldo)} (${((saldo/totEnt)*100).toFixed(0)}%).`}); }
  if(data.saidas.some(i=>i._recorrente)) msgs.push({t:'info',m:'🔄 Parcelas com vencimento no mês carregadas automaticamente.'});
  document.getElementById('prevAnalise').innerHTML=
    msgs.map(m=>`<div class="sugg-item ${m.t}">${m.m}</div>`).join('')+
    `<button onclick="resetPrevisao()" style="margin-top:12px;width:100%;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font)">🔄 Recarregar parcelas automáticas</button>`;
}
function resetPrevisao(){
  const key=prevMonthKey(prevMonthOffset);
  const data=DB.getPrev(key);
  // Remove only auto-loaded items, keep manual ones
  data.entradas=data.entradas.filter(i=>!i._recorrente&&!i._srcId);
  data.saidas=data.saidas.filter(i=>!i._recorrente&&!i._parId);
  data._loaded=false;
  DB.savePrev(key,data);
  showToast('🔄 Recarregando previsão...');
  renderPrevisao();
}

function prevItemHTML(item,tipo,key){ return `<div class="prev-list-item"><div class="prev-li-desc">${item.desc}${item._recorrente?'<span class="prev-recurring-badge">auto</span>':''}</div><div class="prev-li-val ${tipo}">${tipo==='entrada'?'+':'-'}${DB.fmt(item.valor)}</div><button class="prev-li-del" onclick="delPrevItem('${tipo}','${item.id}','${key}')">✕</button></div>`; }
function addPrevItem(tipo){ const dI=tipo==='entrada'?'prevEntDesc':'prevSaiDesc',vI=tipo==='entrada'?'prevEntVal':'prevSaiVal'; const desc=document.getElementById(dI).value.trim(),val=parseFloat(document.getElementById(vI).value); if(!desc||!val||val<=0){ showToast('Preencha descrição e valor'); return; } const key=prevMonthKey(prevMonthOffset),data=DB.getPrev(key); tipo==='entrada'?data.entradas.push({id:Date.now()+Math.random(),desc,valor:val}):data.saidas.push({id:Date.now()+Math.random(),desc,valor:val}); DB.savePrev(key,data); document.getElementById(dI).value=''; document.getElementById(vI).value=''; renderPrevisao(); }
function delPrevItem(tipo,id,key){ const data=DB.getPrev(key); if(tipo==='entrada') data.entradas=data.entradas.filter(i=>i.id!=id); else data.saidas=data.saidas.filter(i=>i.id!=id); DB.savePrev(key,data); renderPrevisao(); }

// ===== METAS, INVESTIMENTOS, SONHOS =====
function setMetaTab(tab,btn){
  curMetaTab=tab;
  ['metas','investimentos','sonhos'].forEach(t=>{ const el=document.getElementById('tab-'+t); if(el) el.style.display=t===tab?'block':'none'; });
  document.querySelectorAll('#page-metas .par-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(tab==='metas') renderMetasList();
  if(tab==='investimentos') renderInvList();
  if(tab==='sonhos') renderSonhosList();
}
function renderMetas(){ renderMetasList(); }

function addMeta(){
  const nome=document.getElementById('metaNome').value.trim(),val=parseFloat(document.getElementById('metaVal').value);
  const guardado=parseFloat(document.getElementById('metaGuardado').value)||0;
  const data=document.getElementById('metaData').value,cat=document.getElementById('metaCat').value;
  if(!nome||!val){ showToast('Preencha nome e valor'); return; }
  DB.addMeta({nome,valor:val,valorAtual:guardado,data,categoria:cat});
  ['metaNome','metaVal','metaGuardado','metaData'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=id==='metaGuardado'?'0':''; });
  showToast('🎯 Meta adicionada!'); renderMetasList();
}
function renderMetasList(){
  const metas=DB.getMetas(),el=document.getElementById('metasList'); if(!el) return;
  if(!metas.length){ el.innerHTML='<div class="empty"><div class="eic">🎯</div><p>Nenhuma meta cadastrada</p></div>'; return; }
  el.innerHTML=metas.map(m=>{
    const hoje=new Date(),alvo=new Date(m.data+'T00:00:00');
    const mesesRest=Math.max(1,Math.ceil((alvo-hoje)/(1000*60*60*24*30)));
    const falta=Math.max(0,m.valor-(m.valorAtual||0));
    const porMes=falta/mesesRest,pct=Math.min(100,((m.valorAtual||0)/m.valor*100)).toFixed(0);
    return `<div class="meta-card-v2">
      <div class="meta-v2-head">
        <div class="meta-v2-icon" style="background:${DB.catColor(m.categoria||'Geral')}22">${DB.catEmoji(m.categoria||'Geral')}</div>
        <div style="flex:1"><div class="meta-v2-title">${m.nome}</div><div class="meta-v2-cat">${m.categoria||'Geral'}${m.data?' · '+DB.fmtDate(m.data):''}</div></div>
      </div>
      <div class="meta-v2-vals">
        <div class="meta-v2-box"><label>Guardado</label><span style="color:var(--green)">${DB.fmt(m.valorAtual||0)}</span></div>
        <div class="meta-v2-box"><label>Meta total</label><span>${DB.fmt(m.valor)}</span></div>
        <div class="meta-v2-box"><label>Falta</label><span style="color:var(--red)">${DB.fmt(falta)}</span></div>
        <div class="meta-v2-box"><label>Guardar/mês</label><span style="color:var(--cyan)">${DB.fmt(porMes)}</span></div>
      </div>
      <div class="meta-v2-prog"><div class="meta-v2-bar" style="width:${pct}%"></div></div>
      <div class="meta-v2-footer">
        <span class="meta-v2-pct">${pct}% concluída</span>
        <div>
          <button class="meta-add-btn" onclick="addValorMeta('${m.id}')">+ Valor</button>
          <button class="meta-del" onclick="DB.removeMeta('${m.id}');renderMetasList()">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function addValorMeta(id){
  const v=parseFloat(prompt('Quanto deseja adicionar à meta? (R$)'));
  if(!v||isNaN(v)) return;
  const m=DB.getMetas().find(x=>x.id==id); if(!m) return;
  DB.updateMeta(id,{valorAtual:(m.valorAtual||0)+v});
  showToast(`✅ +${DB.fmt(v)} adicionado!`); renderMetasList();
}
function calcEco(){ const meta=parseFloat(document.getElementById('simMeta').value),poup=parseFloat(document.getElementById('simPoup').value),taxa=parseFloat(document.getElementById('simTaxa').value)/100,el=document.getElementById('ecoRes'); if(!meta||!poup){ showToast('Preencha os campos'); return; } let meses=taxa===0?Math.ceil(meta/poup):Math.ceil(Math.log(1+(meta*taxa)/poup)/Math.log(1+taxa)); const anos=Math.floor(meses/12),mr=meses%12,inv=poup*meses,rend=Math.max(0,meta-inv); el.classList.remove('hidden'); el.innerHTML=`<b style="color:var(--cyan)">📊 Resultado</b><br>Prazo: <strong>${anos>0?anos+' ano(s) e ':''} ${mr} meses</strong><br>Total investido: <strong>${DB.fmt(inv)}</strong><br>Rendimento estimado: <strong>+${DB.fmt(rend)}</strong><br>Meta: <strong>${DB.fmt(meta)}</strong>${meses>120?'<br><br>⚠️ Meta longa. Aumente o valor mensal.':''}`; }
function calcCred(){ const val=parseFloat(document.getElementById('credVal').value),n=parseInt(document.getElementById('credN').value),taxa=parseFloat(document.getElementById('credTax').value)/100,el=document.getElementById('credRes'); if(!val||!n){ showToast('Preencha os campos'); return; } const parc=taxa===0?val/n:val*(taxa*Math.pow(1+taxa,n))/(Math.pow(1+taxa,n)-1),total=parc*n,juros=total-val,custo=(juros/val*100).toFixed(1); el.classList.remove('hidden'); el.innerHTML=`<b style="color:var(--cyan)">💳 Resultado</b><br>Parcela: <strong>${DB.fmt(parc)}</strong><br>Total pago: <strong>${DB.fmt(total)}</strong><br>Juros: <strong>${DB.fmt(juros)}</strong><br>Custo: <strong>${custo}%</strong>${custo>50?'<br><br>🚨 Custo muito alto!':custo>20?'<br><br>⚠️ Avalie se vale.':''}`; }

function addInvestimento(){
  const nome=document.getElementById('invNome').value.trim(),valor=parseFloat(document.getElementById('invValor').value);
  const rend=parseFloat(document.getElementById('invRend').value)||0,data=document.getElementById('invData').value;
  if(!nome||!valor){ showToast('Preencha nome e valor'); return; }
  DB.addSonho({_tipo:'inv',nome,valor,rendAnual:rend,data}); // reusa sonhos storage com tipo
  ['invNome','invValor','invRend','invData'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  showToast('📈 Investimento adicionado!'); renderInvList();
}
function renderInvList(){
  const all=DB.getSonhos().filter(s=>s._tipo==='inv'),el=document.getElementById('invList'); if(!el) return;
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">📈</div><p>Nenhum investimento cadastrado</p></div>'; return; }
  el.innerHTML=all.map(inv=>{
    const anos=inv.data?Math.max(0,(new Date()-new Date(inv.data+'T00:00:00'))/(1000*60*60*24*365)):0;
    const rendido=inv.valor*Math.pow(1+(inv.rendAnual||0)/100,anos)-inv.valor;
    const total=inv.valor+rendido;
    return `<div class="inv-card">
      <div class="inv-head"><div class="inv-title">📈 ${inv.nome}</div><button class="meta-del" onclick="DB.removeSonho('${inv.id}');renderInvList()">🗑</button></div>
      <div class="inv-grid">
        <div class="inv-box"><label>Valor investido</label><span>${DB.fmt(inv.valor)}</span></div>
        <div class="inv-box"><label>Rendimento/ano</label><span style="color:var(--green)">${inv.rendAnual||0}%</span></div>
        <div class="inv-box"><label>Rendimento estimado</label><span style="color:var(--green)">+${DB.fmt(rendido)}</span></div>
        <div class="inv-box"><label>Total estimado</label><span style="color:var(--cyan)">${DB.fmt(total)}</span></div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">Desde ${DB.fmtDate(inv.data)} · ${anos.toFixed(1)} anos</div>
    </div>`;
  }).join('');
}
function addSonho(){
  const nome=document.getElementById('sonhoNome').value.trim(),valor=parseFloat(document.getElementById('sonhoValor').value);
  const emoji=document.getElementById('sonhoEmoji').value.trim()||'✨';
  if(!nome||!valor){ showToast('Preencha nome e valor'); return; }
  DB.addSonho({_tipo:'sonho',nome,valor,emoji});
  ['sonhoNome','sonhoValor','sonhoEmoji'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  showToast('✨ Sonho adicionado!'); renderSonhosList();
}
function renderSonhosList(){
  const all=DB.getSonhos().filter(s=>s._tipo==='sonho'),el=document.getElementById('sonhosList'); if(!el) return;
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">✨</div><p>Adicione seus sonhos!</p></div>'; return; }
  el.innerHTML=all.map(s=>`<div class="sonho-card"><div class="sonho-emoji">${s.emoji||'✨'}</div><div class="sonho-info"><div class="sonho-nome">${s.nome}</div><div class="sonho-val">${DB.fmt(s.valor)}</div></div><button class="sonho-del" onclick="DB.removeSonho('${s.id}');renderSonhosList()">🗑</button></div>`).join('');
}

// ===== FAMÍLIA =====
function populateFamMeses(){ const sel=document.getElementById('famMesSel'); if(!sel) return; const now=new Date(); for(let i=5;i>=-6;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const opt=document.createElement('option'); opt.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; opt.textContent=`${MESES[d.getMonth()]} ${d.getFullYear()}`; if(i===0) opt.selected=true; sel.appendChild(opt); } }
function salvarNome(){ const nome=document.getElementById('meuNome').value.trim(); if(!nome){ showToast('Digite seu nome'); return; } const cfg=DB.getConfig(); cfg.nome=nome; DB.saveConfig(cfg); showToast('✅ Nome salvo!'); renderFamilia(); }
function getFamMesKey(){ const sel=document.getElementById('famMesSel'); return sel?sel.value:`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`; }

function renderFamilia(){
  const mesKey=getFamMesKey();
  const [y,m]=mesKey.split('-').map(Number);
  const cfg=DB.getConfig(),myNome=cfg.nome||'Eu';
  const r=DB.resumoMes(y,m-1);
  const members=DB.getFamMembers();

  // Saldo geral acumulado (todo o histórico)
  const allTx=DB.getTx();
  const myEntHist=allTx.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
  const mySaiHist=allTx.filter(t=>t.tipo==='saida'&&!t._parId).reduce((s,t)=>s+t.valor,0);
  const myParPagasHist=DB.getPar().reduce((s,p)=>{
    return s+p.pagamentos.filter(x=>x?.status==='pago').reduce((ps,x)=>ps+(x.valorPago||p.valorParcela),0);
  },0);
  const mySaldoGeral=myEntHist-mySaiHist-myParPagasHist;

  const all=[{id:'__me__',nome:myNome,mesEnt:r.entradas,mesSai:r.totalSaidasPagas,saldo:r.saldoReal,saldoGeral:mySaldoGeral,isMe:true},...members];
  const totEnt=all.reduce((s,x)=>s+x.mesEnt,0),totSai=all.reduce((s,x)=>s+x.mesSai,0),totSaldo=totEnt-totSai;

  const emojis=['🧑','👩','👨','👦','👧','👴','👵'],grads=['#3ddc84,#22d3ee','#b57bee,#4da6ff','#fb923c,#f59e0b','#f472b6,#b57bee'];

  let html=`
    <!-- Saldo Geral Acumulado -->
    <div style="margin:0 14px 14px;background:linear-gradient(135deg,#0a1a10,#080e1a);border:1px solid rgba(61,220,132,.2);border-radius:var(--r);padding:18px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:12px">💰 Saldo Geral Acumulado (todo histórico)</div>
      <div style="font-size:32px;font-weight:800;font-family:var(--mono);color:${mySaldoGeral>=0?'var(--green)':'var(--red)'};margin-bottom:6px">${DB.fmt(mySaldoGeral)}</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6">
        Total entradas: <span style="color:var(--green);font-weight:700">${DB.fmt(myEntHist)}</span><br>
        Total saídas pagas: <span style="color:var(--red);font-weight:700">${DB.fmt(mySaiHist+myParPagasHist)}</span>
      </div>
    </div>

    <!-- Consolidado do mês -->
    <div class="fam-consolidated">
      <div class="fam-cons-title">📊 ${MESES[m-1]} ${y} — Consolidado</div>
      <div class="fam-cons-row"><span class="fam-cons-lbl">Total entradas</span><span class="fam-cons-val" style="color:var(--green)">${DB.fmt(totEnt)}</span></div>
      <div class="fam-cons-row"><span class="fam-cons-lbl">Total saídas</span><span class="fam-cons-val" style="color:var(--red)">${DB.fmt(totSai)}</span></div>
      <div class="fam-cons-row"><span class="fam-cons-lbl" style="font-weight:800">Saldo familiar do mês</span><span class="fam-cons-val" style="color:${totSaldo>=0?'var(--green)':'var(--red)'};font-size:20px">${DB.fmt(totSaldo)}</span></div>
    </div>

    <div style="margin:0 14px 80px">
  `;

  all.forEach((mem,i)=>{
    const saldoGeralMem=mem.saldoGeral!==undefined?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:var(--text3);font-weight:600">Saldo acumulado geral</span><span style="font-size:14px;font-weight:800;font-family:var(--mono);color:${(mem.saldoGeral||0)>=0?'var(--green)':'var(--red)'}">${DB.fmtShort(mem.saldoGeral||0)}</span></div>`:'';
    html+=`<div class="fam-member-card-v2 ${mem.isMe?'me':'other'}">
      <div class="fam-mv2-head">
        <div class="fam-mv2-avatar" style="background:linear-gradient(135deg,${grads[i%grads.length]})">${emojis[i%emojis.length]}</div>
        <div class="fam-mv2-info">
          <div class="fam-mv2-name">${mem.nome}<span class="fam-mv2-badge ${mem.isMe?'me':'other'}">${mem.isMe?'Você':'Importado'}</span></div>
          <div class="fam-mv2-sub">${mem.isMe?'Dados em tempo real':'Importado em '+new Date(mem.importedAt||Date.now()).toLocaleDateString('pt-BR')}</div>
        </div>
        ${!mem.isMe?`<button class="fam-del-btn" onclick="removerMembro('${mem.id}')">🗑</button>`:''}
      </div>
      <div class="fam-mv2-grid">
        <div class="fam-mv2-box"><label>Entradas mês</label><span style="color:var(--green)">${DB.fmtShort(mem.mesEnt)}</span></div>
        <div class="fam-mv2-box"><label>Saídas mês</label><span style="color:var(--red)">${DB.fmtShort(mem.mesSai)}</span></div>
        <div class="fam-mv2-box"><label>Saldo mês</label><span style="color:${mem.saldo>=0?'var(--green)':'var(--red)'}">${DB.fmtShort(mem.saldo)}</span></div>
      </div>
      ${saldoGeralMem}
    </div>`;
  });

  html+='</div>';
  document.getElementById('famPainel').innerHTML=html;
}

function removerMembro(id){ if(!confirm('Remover?')) return; DB.removeFamMember(id); showToast('🗑 Removido'); renderFamilia(); }
function importarMembro(){ const code=document.getElementById('importCode').value.trim(); if(!code){ showToast('Cole o código'); return; } const data=DB.importFamData(code); if(!data){ showToast('❌ Código inválido'); return; } document.getElementById('importCode').value=''; showToast(`✅ ${data.nome} importado!`); renderFamilia(); }

// ===== QR =====
exportedCode='';
function abrirQRGerar(){
  const cfg=DB.getConfig(),nome=cfg.nome||document.getElementById('meuNome').value.trim()||'Membro';
  exportedCode=DB.exportMyData(nome);
  document.getElementById('qrCodeDiv').innerHTML='<div style="color:var(--text3);padding:20px">Carregando...</div>';
  document.getElementById('qrCodeTxt').textContent=exportedCode;
  document.getElementById('qrGerarModal').classList.remove('hidden');
  loadQR(()=>{
    document.getElementById('qrCodeDiv').innerHTML='';
    try{ new QRCode(document.getElementById('qrCodeDiv'),{text:exportedCode,width:200,height:200,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M}); }
    catch(e){ document.getElementById('qrCodeDiv').innerHTML=`<div style="background:white;padding:12px;border-radius:10px;font-size:9px;word-break:break-all;max-width:200px;color:#000">${exportedCode}</div>`; }
  });
}
function fecharQRGerar(){ document.getElementById('qrGerarModal').classList.add('hidden'); }
function copiarCodigoQR(){ navigator.clipboard?.writeText(exportedCode).then(()=>showToast('📋 Código copiado!')).catch(()=>{ const t=document.createElement('textarea'); t.value=exportedCode; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); showToast('📋 Copiado!'); }); }
function compartilharQR(){
  const cfg=DB.getConfig(),nome=cfg.nome||'Membro';
  // Envia mensagem + código separados para facilitar copiar
  const msg=encodeURIComponent(`💰 FinançasFácil — dados de ${nome}\n\nCole o código abaixo no app de quem vai importar:`);
  const cod=encodeURIComponent(`\n${exportedCode}`);
  if(navigator.share){ navigator.share({title:'FinançasFácil',text:`💰 FinançasFácil — dados de ${nome}\n\nCole o código no app:\n\n${exportedCode}`}).catch(()=>{}); }
  else{ window.open(`https://wa.me/?text=${msg}${cod}`,'_blank'); }
}
async function abrirQRLer(){
  document.getElementById('qrLerModal').classList.remove('hidden');
  document.getElementById('qrScanStatus').textContent='Iniciando câmera...';
  try{
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    const video=document.getElementById('qrVideo'); video.srcObject=qrStream; await video.play();
    document.getElementById('qrScanStatus').textContent='📷 Aponte para o QR Code';
    if('BarcodeDetector' in window){ const det=new BarcodeDetector({formats:['qr_code']}); qrScanInterval=setInterval(async()=>{ try{ const b=await det.detect(video); if(b.length){ clearInterval(qrScanInterval); fecharQRLer(); processarQRCode(b[0].rawValue); } }catch(e){} },500); }
    else document.getElementById('qrScanStatus').textContent='📷 Câmera ativa. Use o código manual se não detectar.';
  }catch(e){ document.getElementById('qrScanStatus').textContent='❌ Câmera indisponível. Use o código manual.'; }
}
function fecharQRLer(){ if(qrScanInterval){ clearInterval(qrScanInterval); qrScanInterval=null; } if(qrStream){ qrStream.getTracks().forEach(t=>t.stop()); qrStream=null; } document.getElementById('qrLerModal').classList.add('hidden'); }
function processarQRCode(raw){ const data=DB.importFamData(raw); if(!data){ showToast('❌ QR Code inválido'); return; } showToast(`✅ ${data.nome} importado!`); renderFamilia(); }

// ===== HISTÓRICO =====
function populateMonths(){ const sel=document.getElementById('fMes'),now=new Date(); for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const opt=document.createElement('option'); opt.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; opt.textContent=`${MESES[d.getMonth()]} ${d.getFullYear()}`; sel.appendChild(opt); } }
function renderHist(){
  const tipo=document.getElementById('fTipo').value,mes=document.getElementById('fMes').value,busca=document.getElementById('fBusca').value.toLowerCase();
  let all=[];
  if(tipo!=='parcela') all=[...DB.getTx().filter(t=>!t._parId)];
  if(tipo==='parcela'||tipo==='todos'){ DB.getPar().forEach(p=>{ for(let i=0;i<p.nParcelas;i++){ const due=DB.parcelaDueDate(p,i),ds=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`,st=p.pagamentos[i]?.status||'pendente'; all.push({id:p.id+'_'+i,tipo:'parcela',descricao:`${p.descricao} (${i+1}/${p.nParcelas})`,valor:p.valorParcela,data:ds,categoria:p.categoria,_status:st}); } }); }
  if(tipo!=='todos') all=all.filter(t=>t.tipo===tipo);
  if(mes!=='todos') all=all.filter(t=>t.data&&t.data.startsWith(mes));
  if(busca) all=all.filter(t=>t.descricao.toLowerCase().includes(busca)||(t.categoria||'').toLowerCase().includes(busca));
  all.sort((a,b)=>new Date(b.data)-new Date(a.data));
  const el=document.getElementById('histList');
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">🔍</div><p>Nenhum resultado</p></div>'; return; }
  el.innerHTML=all.map(t=>{ const sc=t._status?` · <span style="color:${t._status==='pago'?'var(--green)':t._status==='atrasado'?'var(--red)':'var(--text3)'}">● ${t._status}</span>`:''; return `<div class="txi"><div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div><div class="txi-inf"><div class="txi-desc">${t.descricao}</div><div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${sc}</div></div><div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>${t.tipo!=='parcela'?`<button class="del-btn" onclick="delTx('${t.id}')">🗑</button>`:''}</div>`; }).join('');
}

// ===== MODAL TRANSAÇÃO =====
function openModal(tipo){
  ['txId','txDesc','txObs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('txTipo').value=tipo;
  document.getElementById('txVal').value=''; document.getElementById('txData').value=DB.nowDate();
  document.getElementById('txCat').value='Geral'; document.getElementById('txRec').value='nenhuma';
  const p=document.getElementById('txParc'); if(p) p.value='1';
  const ps=document.getElementById('txParcSaida'); if(ps) ps.value='1';
  if(document.getElementById('vTotal')) document.getElementById('vTotal').value='';
  if(document.getElementById('vParc')) document.getElementById('vParc').value='';
  if(document.getElementById('txDiaVenc')) document.getElementById('txDiaVenc').value='';
  document.getElementById('modalTitle').textContent={entrada:'💰 Nova Entrada',saida:'💸 Nova Saída',parcela:'🔄 Novo Parcelamento'}[tipo]||'Nova Transação';
  document.getElementById('parcelGrp').style.display=tipo==='saida'?'block':'none';
  document.getElementById('valDual').style.display=tipo==='parcela'?'grid':'none';
  document.getElementById('valSingle').style.display=tipo!=='parcela'?'block':'none';
  document.getElementById('recGrp').style.display=tipo!=='parcela'?'block':'none';
  document.getElementById('typeGrp').style.display=tipo==='parcela'?'block':'none';
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal(){ document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click',e=>{ if(e.target===document.getElementById('modal')) closeModal(); });

function editTx(id){
  const t=DB.getTx().find(x=>x.id==id); if(!t||t._parId) return;
  document.getElementById('txId').value=t.id; document.getElementById('txTipo').value=t.tipo;
  document.getElementById('txDesc').value=t.descricao; document.getElementById('txVal').value=t.valor;
  document.getElementById('txData').value=t.data; document.getElementById('txCat').value=t.categoria||'Geral';
  document.getElementById('txRec').value=t.recorrencia||'nenhuma';
  ['parcelGrp','valDual','typeGrp'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('valSingle').style.display='block'; document.getElementById('recGrp').style.display='block';
  document.getElementById('modalTitle').textContent=t.tipo==='entrada'?'✏️ Editar Entrada':'✏️ Editar Saída';
  document.getElementById('modal').classList.remove('hidden');
}

function salvar(){
  const id=document.getElementById('txId')?.value,tipo=document.getElementById('txTipo').value;
  const desc=document.getElementById('txDesc').value.trim(),data=document.getElementById('txData').value;
  const cat=document.getElementById('txCat').value,rec=document.getElementById('txRec').value;
  if(!desc||!data){ showToast('⚠️ Preencha os campos'); return; }
  if(tipo==='parcela'){
    const vT=parseFloat(document.getElementById('vTotal').value)||0,vP=parseFloat(document.getElementById('vParc').value)||0;
    const nP=parseInt(document.getElementById('txParc').value)||1;
    const diaVenc=parseInt(document.getElementById('txDiaVenc').value)||null;
    const parType=document.querySelector('.type-opt[class*="sel-"]')?.dataset.type||'credcard';
    if(!vT&&!vP){ showToast('Informe o valor'); return; }
    DB.addPar({descricao:desc,valorTotal:vT||(vP*nP),valorParcela:vP||(vT/nP),nParcelas:nP,data,categoria:cat,tipo:parType,diaVencimento:diaVenc});
    showToast(`✅ ${nP}x ${DB.fmt(vP||(vT/nP))}`);
  } else {
    const val=parseFloat(document.getElementById('txVal').value); if(!val||val<=0){ showToast('⚠️ Valor inválido'); return; }
    const nP=parseInt(document.getElementById('txParcSaida')?.value)||1;
    if(tipo==='saida'&&nP>1){ DB.addPar({descricao:desc,valorTotal:val,valorParcela:val/nP,nParcelas:nP,data,categoria:cat,tipo:'credit'}); showToast(`✅ ${nP}x ${DB.fmt(val/nP)}`); }
    else if(id){ DB.updateTx(id,{descricao:desc,valor:val,data,categoria:cat,recorrencia:rec}); showToast('✅ Atualizado!'); }
    else { DB.addTx({tipo,descricao:desc,valor:val,data,categoria:cat,recorrencia:rec}); showToast(tipo==='entrada'?'✅ Entrada salva!':'✅ Saída salva!'); }
  }
  closeModal(); renderAll();
  if(curPage==='entradas') renderEntradas();
  if(curPage==='saidas') renderSaidas();
  if(curPage==='parcelas') renderParcelas();
  if(curPage==='historico') renderHist();
}

function delTx(id){ if(!confirm('Remover?')) return; DB.removeTx(id); showToast('🗑 Removido'); renderAll(); if(curPage==='entradas') renderEntradas(); if(curPage==='saidas') renderSaidas(); if(curPage==='historico') renderHist(); }
function selectType(el,type){ document.querySelectorAll('.type-opt').forEach(x=>x.className='type-opt'); el.classList.add('sel-'+type); el.dataset.type=type; }
function calcDual(src){
  const n=parseInt(document.getElementById('txParc')?.value)||1;
  if(src==='total'){ const v=parseFloat(document.getElementById('vTotal').value); if(v&&n) document.getElementById('vParc').value=(v/n).toFixed(2); }
  else if(src==='parc'){ const v=parseFloat(document.getElementById('vParc').value); if(v&&n) document.getElementById('vTotal').value=(v*n).toFixed(2); }
  else{ const vT=parseFloat(document.getElementById('vTotal')?.value)||0,vP=parseFloat(document.getElementById('vParc')?.value)||0; if(vT&&n) document.getElementById('vParc').value=(vT/n).toFixed(2); else if(vP&&n) document.getElementById('vTotal').value=(vP*n).toFixed(2); }
}

function showToast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3500); }
function setupInstall(){
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBanner').classList.remove('hidden'); });
  document.getElementById('installBtn').addEventListener('click',async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); const{outcome}=await deferredPrompt.userChoice; if(outcome==='accepted') showToast('✅ App instalado!'); deferredPrompt=null; document.getElementById('installBanner').classList.add('hidden'); });
  document.getElementById('installClose').addEventListener('click',()=>document.getElementById('installBanner').classList.add('hidden'));
}
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
function drawFlow(){ Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)); }

// ===== ANÁLISE FINANCEIRA INTELIGENTE =====
HELPS.analise = {
  t:'🧠 Como funciona a Análise',
  b:`<strong>O que analisa</strong>Entradas, saídas, parcelamentos, reserva, índice de comprometimento e score geral.<strong>Plano de ação</strong>Ações priorizadas por urgência: Alta (vermelho), Média (amarelo), Baixa (verde).<strong>Relatório</strong>Gera um documento completo que você pode imprimir ou salvar como PDF para guardar ou compartilhar.`
};

let ultimaAnalise = null;

function executarAnalise(){
  const btn = document.getElementById('btnAnalise');
  btn.textContent = '⏳ Analisando...';
  btn.classList.add('loading');
  btn.disabled = true;

  setTimeout(() => {
    const analise = calcularAnalise();
    ultimaAnalise = analise;
    renderAnalise(analise);
    btn.textContent = '🔄 Refazer Análise';
    btn.classList.remove('loading');
    btn.disabled = false;
    document.getElementById('relBtns').style.display = 'grid';
    showToast('✅ Análise concluída!');
  }, 800);
}

function calcularAnalise(){
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const r = DB.resumoMes(y, m);
  const rPrev = DB.resumoMes(y, m-1 < 0 ? 11 : m-1);
  const pars = DB.getPar();
  const metas = DB.getMetas();
  const tx = DB.getTx();

  // Indicadores
  const ent = r.entradas;
  const sai = r.totalSaidasPagas;
  const parMes = DB.parcelasDoMes(y, m);
  const totalParVenc = parMes.reduce((s,x) => s+x.par.valorParcela, 0);
  const atrasadas = pars.reduce((n,p) => n + p.pagamentos.filter(x=>x?.status==='atrasado').length, 0);
  const comprometimento = ent > 0 ? (sai + (r.parcelasPendentes||0) + (r.parcelasAtrasadas||0)) / ent : 1;
  const taxaPoupanca = ent > 0 ? Math.max(0, (ent - sai - totalParVenc) / ent) : 0;
  const saldoDevTotal = pars.reduce((s,p) => { const pg=p.pagamentos.filter(x=>x?.status==='pago').length; return s + p.valorTotal - (pg*p.valorParcela); }, 0);
  const mesesParaQuitarPar = totalParVenc > 0 && ent > 0 ? Math.ceil(saldoDevTotal / totalParVenc) : 0;
  const tendencia = r.saldoReal - rPrev.saldoReal;

  // Score (0–100)
  let score = 0;
  if(comprometimento <= 0.5) score += 35;
  else if(comprometimento <= 0.7) score += 22;
  else if(comprometimento <= 0.9) score += 10;
  if(taxaPoupanca >= 0.2) score += 25;
  else if(taxaPoupanca >= 0.1) score += 15;
  else if(taxaPoupanca > 0) score += 5;
  if(atrasadas === 0) score += 20;
  else if(atrasadas <= 2) score += 8;
  if(tendencia >= 0) score += 10;
  else if(tendencia >= -200) score += 5;
  if(ent > 0) score += 10;
  score = Math.min(100, score);

  // Classificação
  let classe, cor, emoji;
  if(score >= 80){ classe='Excelente'; cor='#3ddc84'; emoji='🟢'; }
  else if(score >= 65){ classe='Boa'; cor='#22d3ee'; emoji='🔵'; }
  else if(score >= 50){ classe='Regular'; cor='#fbbf24'; emoji='🟡'; }
  else if(score >= 35){ classe='Atenção'; cor='#fb923c'; emoji='🟠'; }
  else{ classe='Crítica'; cor='#ff6b6b'; emoji='🔴'; }

  // Plano de ação
  const acoes = [];

  if(atrasadas > 0){
    acoes.push({p:'alta', titulo:`Regularize ${atrasadas} parcela(s) em atraso`, texto:'Parcelas atrasadas geram juros e comprometem seu score. Prioridade máxima: negocie com o credor ou quite o quanto antes.', valor: r.parcelasAtrasadas});
  }
  if(comprometimento > 0.9){
    acoes.push({p:'alta', titulo:'Comprometimento crítico da renda', texto:`${(comprometimento*100).toFixed(0)}% da renda está comprometida. Revise gastos imediatamente. Corte lazer, assinaturas e gastos não essenciais.`, valor: null});
  }
  if(ent === 0){
    acoes.push({p:'alta', titulo:'Cadastre suas entradas de renda', texto:'Sem entradas cadastradas, a análise fica incompleta. Registre salários, freelances e outras fontes.', valor: null});
  }
  if(taxaPoupanca < 0.1 && ent > 0){
    acoes.push({p:'alta', titulo:'Taxa de poupança muito baixa', texto:`Você está poupando apenas ${(taxaPoupanca*100).toFixed(0)}% da renda. A meta mínima é 10%, ideal é 20%. Revise gastos desnecessários.`, valor: null});
  }
  if(comprometimento > 0.7 && comprometimento <= 0.9){
    acoes.push({p:'media', titulo:'Reduza o comprometimento da renda', texto:`${(comprometimento*100).toFixed(0)}% da renda comprometida. Tente chegar a 70% cortando gastos variáveis como alimentação fora, lazer e compras.`, valor: null});
  }
  if(saldoDevTotal > ent*3){
    acoes.push({p:'media', titulo:'Saldo devedor elevado', texto:`Seu saldo devedor em parcelas é ${DB.fmt(saldoDevTotal)} (${(saldoDevTotal/ent).toFixed(1)}x sua renda mensal). Evite novos parcelamentos até quitar os atuais.`, valor: saldoDevTotal});
  }
  if(tendencia < -100){
    acoes.push({p:'media', titulo:'Saldo piorando em relação ao mês anterior', texto:`Seu saldo caiu ${DB.fmt(Math.abs(tendencia))} em relação ao mês passado. Identifique o que mudou e corrija antes do próximo mês.`, valor: Math.abs(tendencia)});
  }
  if(taxaPoupanca >= 0.1 && taxaPoupanca < 0.2 && ent > 0){
    acoes.push({p:'baixa', titulo:'Aumente sua taxa de poupança', texto:`Você está poupando ${(taxaPoupanca*100).toFixed(0)}%. Tente chegar a 20% (${DB.fmt(ent*0.2)}/mês). Considere investir em CDB, Tesouro Direto ou poupança.`, valor: ent*0.2});
  }
  if(metas.length === 0){
    acoes.push({p:'baixa', titulo:'Defina metas financeiras', texto:'Sem metas definidas fica difícil manter o foco. Acesse a aba Metas e defina ao menos uma meta de reserva de emergência (3 a 6x sua renda).', valor: null});
  }
  if(taxaPoupanca >= 0.2 && atrasadas === 0){
    acoes.push({p:'baixa', titulo:'Continue assim e diversifique', texto:`Parabéns! Você está poupando ${(taxaPoupanca*100).toFixed(0)}%. Considere diversificar: parte em renda fixa, parte em renda variável de longo prazo.`, valor: null});
  }

  if(acoes.length === 0){
    acoes.push({p:'baixa', titulo:'Situação equilibrada', texto:'Suas finanças estão sob controle. Continue monitorando mensalmente e aumente gradualmente a taxa de poupança.', valor: null});
  }

  return {score, classe, cor, emoji, comprometimento, taxaPoupanca, saldoDevTotal, atrasadas, tendencia, acoes, r, rPrev, totalParVenc, mesesParaQuitarPar, ent, sai, now};
}

function renderAnalise(a){
  const el = document.getElementById('analiseResultado');
  const compPct = Math.min(100, (a.comprometimento*100)).toFixed(0);
  const poupPct = Math.min(100, (a.taxaPoupanca*100)).toFixed(0);
  const saldoPct = a.ent > 0 ? Math.min(100, (a.r.saldoReal / a.ent * 100)) : 0;

  let html = `
    <!-- Score card -->
    <div class="analise-score-card" style="background:${a.cor}18;border:1px solid ${a.cor}44">
      <div class="asc-top">
        <div class="asc-grade" style="color:${a.cor}">${a.score}</div>
        <div class="asc-info">
          <h3 style="color:${a.cor}">${a.emoji} Situação ${a.classe}</h3>
          <p style="color:var(--text2)">Score de saúde financeira<br>${MESES[a.now.getMonth()]} ${a.now.getFullYear()}</p>
        </div>
      </div>
      <div class="asc-bars">
        <div class="asc-bar-item">
          <label>Comprometimento</label>
          <div class="asc-bar-wrap"><div class="asc-bar-fill" style="width:${compPct}%;background:${a.comprometimento>0.8?'var(--red)':a.comprometimento>0.6?'var(--yellow)':'var(--green)'}"></div></div>
          <div class="asc-bar-val" style="color:${a.comprometimento>0.8?'var(--red)':a.comprometimento>0.6?'var(--yellow)':'var(--green)'}">${compPct}% da renda</div>
        </div>
        <div class="asc-bar-item">
          <label>Taxa de poupança</label>
          <div class="asc-bar-wrap"><div class="asc-bar-fill" style="width:${poupPct}%;background:${a.taxaPoupanca>=0.2?'var(--green)':a.taxaPoupanca>=0.1?'var(--yellow)':'var(--red)'}"></div></div>
          <div class="asc-bar-val" style="color:${a.taxaPoupanca>=0.2?'var(--green)':a.taxaPoupanca>=0.1?'var(--yellow)':'var(--red)'}">${poupPct}% guardado</div>
        </div>
        <div class="asc-bar-item">
          <label>Saldo devedor / renda</label>
          <div class="asc-bar-wrap"><div class="asc-bar-fill" style="width:${Math.min(100, a.ent>0?a.saldoDevTotal/a.ent*20:100)}%;background:var(--blue)"></div></div>
          <div class="asc-bar-val" style="color:var(--blue)">${DB.fmt(a.saldoDevTotal)}</div>
        </div>
        <div class="asc-bar-item">
          <label>Tendência</label>
          <div class="asc-bar-wrap"><div class="asc-bar-fill" style="width:${a.tendencia>=0?100:Math.max(5,50+a.tendencia/a.ent*50)}%;background:${a.tendencia>=0?'var(--green)':'var(--red)'}"></div></div>
          <div class="asc-bar-val" style="color:${a.tendencia>=0?'var(--green)':'var(--red)'}">${a.tendencia>=0?'+':''}${DB.fmt(a.tendencia)} vs. mês ant.</div>
        </div>
      </div>
    </div>

    <!-- Resumo números -->
    <div class="analise-section">
      <h3>📊 Resumo do Mês</h3>
      ${[
        ['Entradas', DB.fmt(a.ent), 'var(--green)'],
        ['Saídas pagas', DB.fmt(a.sai), 'var(--red)'],
        ['Parcelas que vencem', DB.fmt(a.totalParVenc), 'var(--blue)'],
        ['Parcelas atrasadas', a.atrasadas + ' parcela(s)', a.atrasadas>0?'var(--red)':'var(--green)'],
        ['Saldo real', DB.fmt(a.r.saldoReal), a.r.saldoReal>=0?'var(--green)':'var(--red)'],
        ['Saldo devedor total', DB.fmt(a.saldoDevTotal), 'var(--text2)'],
      ].map(([l,v,c]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px;color:var(--text2);font-weight:600">${l}</span><span style="font-size:14px;font-weight:800;font-family:var(--mono);color:${c}">${v}</span></div>`).join('')}
    </div>

    <!-- Plano de ação -->
    <div class="analise-section">
      <h3>🎯 Plano de Ação</h3>
      ${a.acoes.map((ac, i) => `
        <div class="plano-item">
          <div class="plano-num ${ac.p}">${i+1}</div>
          <div class="plano-text">
            <strong>${ac.titulo}${ac.valor?` — ${DB.fmt(ac.valor)}`:''}</strong>
            ${ac.texto}
            <span style="font-size:10px;font-weight:800;margin-top:4px;display:block;color:${ac.p==='alta'?'var(--red)':ac.p==='media'?'var(--yellow)':'var(--green)'}">● Prioridade ${ac.p==='alta'?'ALTA':ac.p==='media'?'MÉDIA':'BAIXA'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  el.innerHTML = html;
}

// ===== RELATÓRIO HTML =====
function gerarRelatorioHTML(){
  if(!ultimaAnalise){ showToast('Execute a análise primeiro'); return; }
  const a = ultimaAnalise;
  const now = new Date();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório Financeiro — ${MESES[a.now.getMonth()]} ${a.now.getFullYear()}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;color:#1a2035;line-height:1.6}
  .page{max-width:800px;margin:0 auto;padding:32px 24px}
  .header{background:linear-gradient(135deg,#0a1628,#0d2a18);color:white;padding:32px;border-radius:16px;margin-bottom:24px;text-align:center}
  .header h1{font-size:28px;font-weight:800;margin-bottom:4px}
  .header p{opacity:.7;font-size:14px}
  .score-box{display:inline-block;margin-top:16px;background:rgba(255,255,255,.1);border-radius:12px;padding:12px 32px}
  .score-num{font-size:56px;font-weight:800;color:${a.cor};display:block;line-height:1}
  .score-label{font-size:16px;font-weight:700;color:${a.cor}}
  .card{background:white;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .card h2{font-size:16px;font-weight:800;color:#1a2035;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #f0f4f8;display:flex;align-items:center;gap:8px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f4f8;font-size:14px}
  .row:last-child{border-bottom:none}
  .row .label{color:#64748b;font-weight:600}
  .row .val{font-weight:800;font-family:monospace;font-size:15px}
  .green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}.gray{color:#64748b}
  .acoes{list-style:none}
  .acao{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f4f8}
  .acao:last-child{border-bottom:none}
  .acao-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-top:2px}
  .alta{background:#fee2e2;color:#dc2626}
  .media{background:#fef3c7;color:#d97706}
  .baixa{background:#dcfce7;color:#16a34a}
  .acao-body{flex:1;font-size:13px;color:#475569}
  .acao-body strong{display:block;color:#1e293b;font-size:14px;margin-bottom:2px}
  .priority{font-size:10px;font-weight:800;margin-top:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .kpi{background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #e2e8f0}
  .kpi label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:700;display:block;margin-bottom:4px}
  .kpi .kval{font-size:20px;font-weight:800;font-family:monospace}
  .bar-wrap{height:8px;background:#e2e8f0;border-radius:4px;margin:6px 0 3px;overflow:hidden}
  .bar-fill{height:100%;border-radius:4px}
  .footer{text-align:center;font-size:12px;color:#94a3b8;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0}
  @media print{body{background:white}.page{padding:16px}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>💰 Relatório Financeiro</h1>
    <p>FinançasFácil · ${MESES[a.now.getMonth()]} ${a.now.getFullYear()} · Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
    <div class="score-box">
      <span class="score-num">${a.score}</span>
      <span class="score-label">${a.emoji} Situação ${a.classe}</span>
    </div>
  </div>

  <div class="grid">
    <div class="kpi"><label>Entradas</label><div class="kval green">R$ ${a.ent.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
    <div class="kpi"><label>Saídas pagas</label><div class="kval red">R$ ${a.sai.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
    <div class="kpi"><label>Saldo real</label><div class="kval ${a.r.saldoReal>=0?'green':'red'}">R$ ${a.r.saldoReal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
    <div class="kpi"><label>Saldo devedor total</label><div class="kval blue">R$ ${a.saldoDevTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
  </div>

  <div class="card">
    <h2>📈 Indicadores</h2>
    ${[
      ['Comprometimento da renda', `${(a.comprometimento*100).toFixed(0)}%`, a.comprometimento>0.8?'red':a.comprometimento>0.6?'gray':'green'],
      ['Taxa de poupança', `${(a.taxaPoupanca*100).toFixed(0)}%`, a.taxaPoupanca>=0.2?'green':a.taxaPoupanca>=0.1?'gray':'red'],
      ['Parcelas em atraso', a.atrasadas + ' parcela(s)', a.atrasadas>0?'red':'green'],
      ['Parcelas que vencem no mês', `R$ ${a.totalParVenc.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, 'blue'],
      ['Tendência vs. mês anterior', `${a.tendencia>=0?'+':''}R$ ${a.tendencia.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, a.tendencia>=0?'green':'red'],
    ].map(([l,v,c]) => `<div class="row"><span class="label">${l}</span><span class="val ${c}">${v}</span></div>`).join('')}
  </div>

  <div class="card">
    <h2>🎯 Plano de Ação Personalizado</h2>
    <ul class="acoes">
      ${a.acoes.map((ac,i) => `
        <li class="acao">
          <div class="acao-num ${ac.p}">${i+1}</div>
          <div class="acao-body">
            <strong>${ac.titulo}${ac.valor?' — R$ '+ac.valor.toLocaleString('pt-BR',{minimumFractionDigits:2}):''}</strong>
            ${ac.texto}
            <div class="priority" style="color:${ac.p==='alta'?'#dc2626':ac.p==='media'?'#d97706':'#16a34a'}">● Prioridade ${ac.p==='alta'?'ALTA':ac.p==='media'?'MÉDIA':'BAIXA'}</div>
          </div>
        </li>
      `).join('')}
    </ul>
  </div>

  <div class="footer">
    Relatório gerado pelo FinançasFácil · Dados armazenados localmente no seu dispositivo · ${now.toLocaleDateString('pt-BR')}
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  showToast('📄 Relatório aberto!');
}

// ===== IMPRIMIR / PDF =====
function gerarRelatorioPDF(){
  if(!ultimaAnalise){ showToast('Execute a análise primeiro'); return; }
  gerarRelatorioHTML();
  setTimeout(()=>{ showToast('💡 Na nova aba: Menu → Imprimir → Salvar como PDF'); },1500);
}


// ═══════════════════════════════════════════════
// VOICE INPUT — Web Speech API
// ═══════════════════════════════════════════════
(function(){
  let _rec = null, _ativo = false, _demoT = null;

  // Mapa: palavra-chave → {cat, tipo}
  const CATS = {
    'gasolina':   {c:'🚗 Transporte', t:'saida'},
    'uber':       {c:'🚗 Transporte', t:'saida'},
    'onibus':     {c:'🚗 Transporte', t:'saida'},
    'ônibus':     {c:'🚗 Transporte', t:'saida'},
    'mercado':    {c:'🍔 Alimentação', t:'saida'},
    'supermercado':{c:'🍔 Alimentação', t:'saida'},
    'ifood':      {c:'🍔 Alimentação', t:'saida'},
    'restaurante':{c:'🍔 Alimentação', t:'saida'},
    'lanche':     {c:'🍔 Alimentação', t:'saida'},
    'aluguel':    {c:'🏠 Moradia', t:'saida'},
    'agua':       {c:'🏠 Moradia', t:'saida'},
    'água':       {c:'🏠 Moradia', t:'saida'},
    'luz':        {c:'🏠 Moradia', t:'saida'},
    'internet':   {c:'🏠 Moradia', t:'saida'},
    'farmacia':   {c:'💊 Saúde', t:'saida'},
    'farmácia':   {c:'💊 Saúde', t:'saida'},
    'medico':     {c:'💊 Saúde', t:'saida'},
    'médico':     {c:'💊 Saúde', t:'saida'},
    'academia':   {c:'💊 Saúde', t:'saida'},
    'escola':     {c:'📚 Educação', t:'saida'},
    'curso':      {c:'📚 Educação', t:'saida'},
    'netflix':    {c:'🎮 Lazer', t:'saida'},
    'cinema':     {c:'🎮 Lazer', t:'saida'},
    'roupa':      {c:'👕 Vestuário', t:'saida'},
    'salario':    {c:'💼 Salário', t:'entrada'},
    'salário':    {c:'💼 Salário', t:'entrada'},
    'freelance':  {c:'💻 Freelance', t:'entrada'},
    'investimento':{c:'📈 Investimentos', t:'entrada'},
  };

  const NUMEROS = {
    'um':1,'uma':1,'dois':2,'duas':2,'tres':3,'três':3,'quatro':4,'cinco':5,
    'seis':6,'sete':7,'oito':8,'nove':9,'dez':10,'onze':11,'doze':12,
    'treze':13,'quatorze':14,'quinze':15,'dezesseis':16,'dezessete':17,
    'dezoito':18,'dezenove':19,'vinte':20,'trinta':30,'quarenta':40,
    'cinquenta':50,'sessenta':60,'setenta':70,'oitenta':80,'noventa':90,
    'cem':100,'cento':100,'duzentos':200,'trezentos':300,'quatrocentos':400,
    'quinhentos':500,'seiscentos':600,'setecentos':700,'oitocentos':800,'novecentos':900,
    'mil':1000,'dois mil':2000,'tres mil':3000,'três mil':3000,
    'quatro mil':4000,'cinco mil':5000,'dez mil':10000,'vinte mil':20000,
  };

  function extrairNumero(txt) {
    const t = txt.toLowerCase();
    // Número direto (dígitos)
    const m = t.match(/(\d[\d.,]*)/);
    if (m) {
      let n = parseFloat(m[1].replace(/\./g,'').replace(',','.'));
      if (/\d\s*mil/.test(t)) n *= 1000;
      return n || null;
    }
    // Por extenso — testa multi-palavra primeiro
    let total = 0;
    const sorted = Object.entries(NUMEROS).sort((a,b)=>b[0].length-a[0].length);
    for (const [p,v] of sorted) {
      if (t.includes(p)) { total += v; }
    }
    return total || null;
  }

  function interpretarFala(texto) {
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    let desc = '', cat = 'Geral', tipo = 'saida';

    // Detectar tipo por palavras de entrada
    if (/entrada|recebi|ganhei|salario|freelance|venda|recebido|pix.*receb/.test(t)) {
      tipo = 'entrada';
    }

    // Detectar categoria/descrição
    for (const [palavra, info] of Object.entries(CATS)) {
      const norm = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (t.includes(norm)) {
        cat = info.c;
        tipo = info.t;
        desc = palavra.charAt(0).toUpperCase() + palavra.slice(1);
        break;
      }
    }

    // Fallback: primeira palavra longa que não seja stopword
    if (!desc) {
      const stops = /^(de|da|do|um|uma|pra|para|com|que|em|na|no|reais|real|entrada|saida|gastei|paguei|recebi|ganhei|hoje|ontem)$/;
      const palavras = texto.split(/\s+/).filter(p => p.length > 2 && !stops.test(p.toLowerCase()));
      desc = palavras[0] ? (palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1)) : 'Lançamento';
    }

    return { desc, cat, tipo, valor: extrairNumero(texto) };
  }

  function ov(){ return document.getElementById('voiceOv'); }
  function setText(id, v){ const el=document.getElementById(id); if(el) el.textContent=v; }

  function voiceAbrir() {
    ov().classList.add('ativo');
    ov().classList.remove('parado');
    setText('voiceTexto','Ouvindo…');
    setText('voiceSub','Fale a transação naturalmente');
  }

  function _fechar() {
    clearTimeout(_demoT);
    ov().classList.remove('ativo');
    ov().classList.add('parado');
    if (_rec) { try{ _rec.stop(); }catch(e){} _rec=null; }
    _ativo = false;
  }

  function _processar(texto) {
    ov().classList.add('parado');
    setText('voiceTexto','✅ Entendido!');
    setText('voiceSub', texto);
    setTimeout(()=>{
      _fechar();
      const d = interpretarFala(texto);
      // Usa openModal existente e preenche os campos
      openModal(d.tipo);
      setTimeout(()=>{
        document.getElementById('txDesc').value = d.desc;
        if (d.valor) document.getElementById('txVal').value = d.valor.toFixed(2);
        // Selecionar categoria
        const sel = document.getElementById('txCat');
        for(let i=0;i<sel.options.length;i++){
          if(sel.options[i].text===d.cat){ sel.selectedIndex=i; break; }
        }
        // Foco no campo de valor para correção fácil
        document.getElementById('txVal').focus();
      }, 80);
    }, 700);
  }

  // API pública
  window.iniciarVoz = function() {
    voiceAbrir();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setText('voiceSub','Toque em um exemplo abaixo ↓');
      return;
    }
    _rec = new SR();
    _rec.lang = 'pt-BR';
    _rec.interimResults = true;
    _rec.maxAlternatives = 1;
    _ativo = true;
    _rec.onresult = (e)=>{
      const t = Array.from(e.results).map(r=>r[0].transcript).join('');
      setText('voiceTexto', t || 'Ouvindo…');
      if(e.results[e.results.length-1].isFinal) _processar(t);
    };
    _rec.onerror = ()=>{
      _fechar();
      showToast('🎤 Microfone indisponível — use os exemplos');
    };
    _rec.onend = ()=>{ _ativo=false; };
    _rec.start();
  };

  window.voiceCancelar = _fechar;

  window.voiceSimular = function(texto) {
    clearTimeout(_demoT);
    ov().classList.remove('parado');
    setText('voiceTexto', texto);
    setText('voiceSub','🎤 Processando…');
    _demoT = setTimeout(()=>_processar(texto), 1100);
  };
})();

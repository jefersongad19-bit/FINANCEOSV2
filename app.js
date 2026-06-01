// ===== APP.JS v5 =====
let curPage='dashboard',curPeriod='mes',modalType='',deferredPrompt=null;
let parFilter='todos',parMesOffset=0;
let prevMonthOffset=1;
let exportedCode='';
let qrStream=null;
let qrScanInterval=null;

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

window.addEventListener('load',()=>{
  setTimeout(()=>{
    document.getElementById('splash').classList.add('out');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  },2000);
});

function initApp(){
  applyTheme();
  setupNav();
  setupPeriod();
  populateMonths();
  populateFamMeses();
  renderAll();
  setupInstall();
  document.getElementById('themeBtn').onclick=toggleTheme;
  document.getElementById('notifBtn').onclick=toggleAlerts;
  window.addEventListener('resize',()=>{ if(curPage==='dashboard') renderDash(); });
  const cfg=DB.getConfig();
  if(cfg.nome) document.getElementById('meuNome').value=cfg.nome;
}

// ===== THEME =====
function applyTheme(){
  const cfg=DB.getConfig();
  document.documentElement.setAttribute('data-theme',cfg.theme||'dark');
  document.getElementById('themeBtn').textContent=cfg.theme==='light'?'🌙':'☀️';
}
function toggleTheme(){
  const cfg=DB.getConfig(); cfg.theme=cfg.theme==='light'?'dark':'light';
  DB.saveConfig(cfg); applyTheme();
  setTimeout(()=>Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)),50);
}

// ===== NAV =====
function setupNav(){
  document.querySelectorAll('.ni').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));
}
function goPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.querySelector(`.ni[data-page="${page}"]`)?.classList.add('active');
  curPage=page;
  const fn={dashboard:renderDash,entradas:renderEntradas,saidas:renderSaidas,parcelas:renderParcelas,previsao:renderPrevisao,familia:renderFamilia,historico:renderHist};
  fn[page]?.();
}

// ===== PERIOD =====
function setupPeriod(){
  document.querySelectorAll('.pbtn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.pbtn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); curPeriod=b.dataset.p; renderDash();
    });
  });
  document.getElementById('chartMonths').addEventListener('change',e=>Charts.drawFlow(parseInt(e.target.value)));
}
function renderAll(){ renderDash(); }

// ===== DASHBOARD =====
function renderDash(){
  const tx=DB.getTx(), filtered=DB.filterPeriod(tx,curPeriod);
  const entradas=filtered.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
  const saidasTx=filtered.filter(t=>t.tipo==='saida'&&!t._parId).reduce((s,t)=>s+t.valor,0);
  const parPagas=DB.parPagasPeriod(curPeriod);
  const totalSai=saidasTx+parPagas;
  const saldo=entradas-totalSai;

  const saldoEl=document.getElementById('saldoDisplay');
  saldoEl.textContent=DB.fmt(saldo);
  saldoEl.classList.toggle('negative',saldo<0);
  document.getElementById('dispEntradas').textContent=DB.fmt(entradas);
  document.getElementById('dispSaidas').textContent=DB.fmt(totalSai);

  // Breakdown
  document.getElementById('bbEnt').textContent=DB.fmtShort(entradas);
  document.getElementById('bbSai').textContent=DB.fmtShort(saidasTx);
  document.getElementById('bbPar').textContent=DB.fmtShort(parPagas);

  document.getElementById('qEnt').textContent=DB.fmtShort(entradas);
  document.getElementById('qSai').textContent=DB.fmtShort(totalSai);
  document.getElementById('qPar').textContent=DB.fmtShort(DB.parMensalAtiva());

  const prevKey=prevMonthKey(1);
  const prevData=DB.getPrev(prevKey);
  const ps=prevData.entradas.reduce((s,i)=>s+i.valor,0)-prevData.saidas.reduce((s,i)=>s+i.valor,0);
  document.getElementById('qPrev').textContent=(prevData.entradas.length||prevData.saidas.length)?DB.fmtShort(ps):'Próx. mês';

  calcScore(entradas,totalSai,saldo);
  setTimeout(()=>Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)),50);
  renderCats(filtered);
  renderRecentTx(tx);
  genSugestoes(entradas,totalSai,saldo);
}

function calcScore(ent,sai,saldo){
  const sv=document.getElementById('scoreVal'),ss=document.getElementById('scoreStatus');
  if(ent===0&&sai===0){ sv.textContent='--'; ss.textContent='Sem dados'; ss.style.color='var(--text3)'; Charts.drawGauge(0); return; }
  let s=0; const taxa=ent>0?sai/ent:1;
  if(taxa<=0.5)s+=40; else if(taxa<=0.7)s+=28; else if(taxa<=0.9)s+=12;
  if(saldo>0)s+=30; else if(saldo===0)s+=10;
  if(ent>0)s+=15; if(ent>0&&saldo/ent>=0.2)s+=15;
  s=Math.min(100,s); sv.textContent=s;
  if(s>=70){ sv.style.color='var(--green)'; ss.textContent='✨ Excelente!'; ss.style.color='var(--green)'; }
  else if(s>=50){ sv.style.color='var(--yellow)'; ss.textContent='⚠️ Atenção'; ss.style.color='var(--yellow)'; }
  else{ sv.style.color='var(--red)'; ss.textContent='🚨 Crítico'; ss.style.color='var(--red)'; }
  Charts.drawGauge(s);
}

function renderCats(filtered){
  const cats={}; filtered.filter(t=>t.tipo==='saida'&&!t._parId).forEach(t=>{ cats[t.categoria]=(cats[t.categoria]||0)+t.valor; });
  DB.getPar().forEach(p=>{ p.pagamentos.forEach((st,i)=>{ if(st==='pago'){ const ini=new Date(p.data+'T00:00:00'),d=new Date(ini.getFullYear(),ini.getMonth()+i,1); const dd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; if(DB.filterPeriod([{data:dd}],curPeriod).length) cats[p.categoria]=(cats[p.categoria]||0)+p.valorParcela; } }); });
  const total=Object.values(cats).reduce((s,v)=>s+v,0)||1;
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=document.getElementById('catList');
  if(!sorted.length){ el.innerHTML='<div class="empty"><div class="eic">📊</div><p>Sem dados</p></div>'; return; }
  el.innerHTML=sorted.map(([c,v])=>`<div class="cat-item"><div class="cat-em">${DB.catEmoji(c)}</div><div class="cat-inf"><div class="cat-nm">${c}</div><div class="cat-bw"><div class="cat-b" style="width:${(v/total*100).toFixed(1)}%;background:${DB.catColor(c)}"></div></div></div><div class="cat-pc">${(v/total*100).toFixed(0)}%</div></div>`).join('');
}

function renderRecentTx(tx){
  const recent=[...tx].filter(t=>!t._parId).sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,5);
  const el=document.getElementById('recentTx');
  if(!recent.length){ el.innerHTML='<div class="empty"><div class="eic">💸</div><p>Nenhuma transação</p></div>'; return; }
  el.innerHTML=recent.map(t=>txHTML(t,false)).join('');
}

function genSugestoes(ent,sai,saldo){
  const suggs=[],alerts=[];
  const taxa=ent>0?sai/ent:0;
  if(ent===0){ suggs.push({t:'warn',m:'💡 Adicione suas entradas para ver a análise.'}); }
  else{
    if(taxa>1){ suggs.push({t:'danger',m:`🚨 Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!`}); alerts.push({t:'danger',m:`Gastos ${((taxa-1)*100).toFixed(0)}% acima!`}); }
    else if(taxa>0.8){ suggs.push({t:'warn',m:`⚠️ ${(taxa*100).toFixed(0)}% da renda comprometida.`}); alerts.push({t:'warn',m:`${(taxa*100).toFixed(0)}% comprometida`}); }
    else if(taxa<=0.5) suggs.push({t:'good',m:`✅ Economizando ${((1-taxa)*100).toFixed(0)}% da renda!`});
    else suggs.push({t:'info',m:`📊 ${(taxa*100).toFixed(0)}% comprometida. Meta: 70%.`});
  }
  const atrasadas=DB.getPar().reduce((n,p)=>n+p.pagamentos.filter(s=>s==='atrasado').length,0);
  if(atrasadas>0){ suggs.push({t:'danger',m:`⚠️ ${atrasadas} parcela(s) em atraso!`}); alerts.push({t:'danger',m:`${atrasadas} parcela(s) atrasada(s)`}); }
  if(saldo>0&&ent>0){ const r=(saldo/ent*100).toFixed(0); suggs.push({t:r>=20?'good':'info',m:r>=20?`💰 ${r}% de sobra — invista na sua reserva!`:`🏦 Tente poupar 20% da renda.`}); }
  if(!suggs.length) suggs.push({t:'info',m:'💡 Adicione transações para análises.'});
  document.getElementById('suggList').innerHTML=suggs.map(s=>`<div class="sugg-item ${s.t}">${s.m}</div>`).join('');
  const badge=document.getElementById('alertBadge'),aList=document.getElementById('alertList');
  if(!alerts.length){ badge.classList.add('hidden'); aList.innerHTML='<div class="alert-item ok"><span>✅</span><span>Tudo sob controle!</span></div>'; }
  else{ badge.textContent=alerts.length; badge.classList.remove('hidden'); aList.innerHTML=alerts.map(a=>`<div class="alert-item ${a.t}"><span>${a.t==='danger'?'🚨':'⚠️'}</span><span>${a.m}</span></div>`).join(''); }
}
function toggleAlerts(){ document.getElementById('alertPanel').classList.toggle('hidden'); }
function closeAlerts(){ document.getElementById('alertPanel').classList.add('hidden'); }

// ===== TX HTML =====
function txHTML(t,showDel=false){
  return `<div class="txi"${showDel?` onclick="editTx('${t.id}')"`:''}>
    <div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div>
    <div class="txi-inf">
      <div class="txi-desc">${t.descricao}</div>
      <div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${t.recorrencia&&t.recorrencia!=='nenhuma'?' · 🔄':''}  </div>
    </div>
    <div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>
    ${showDel?`<button class="del-btn" onclick="event.stopPropagation();delTx('${t.id}')">🗑</button>`:''}
  </div>`;
}

// ===== ENTRADAS / SAÍDAS =====
function renderEntradas(){
  const all=DB.getTx().filter(t=>t.tipo==='entrada');
  document.getElementById('entTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  document.getElementById('entList').innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💰</div><p>Nenhuma entrada</p></div>';
}
function renderSaidas(){
  const all=DB.getTx().filter(t=>t.tipo==='saida'&&!t._parId);
  document.getElementById('saiTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  document.getElementById('saiList').innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💸</div><p>Nenhuma saída</p></div>';
}

// ===== PARCELAS =====
function renderParcelas(){
  const now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth()+parMesOffset,1);
  const ty=target.getFullYear(), tm=target.getMonth();
  const all=DB.getPar();
  const filtered=parFilter==='todos'?all:all.filter(p=>p.tipo===parFilter);

  // Totais do mês selecionado
  let totalMes=0,totalPago=0,totalAtrasado=0;
  all.forEach(p=>{
    for(let i=0;i<p.nParcelas;i++){
      const ini=new Date(p.data+'T00:00:00'),d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
      if(d.getFullYear()===ty&&d.getMonth()===tm){
        totalMes+=p.valorParcela;
        if(p.pagamentos[i]==='pago') totalPago+=p.valorParcela;
        if(p.pagamentos[i]==='atrasado') totalAtrasado+=p.valorParcela;
      }
    }
  });
  document.getElementById('parTotal').textContent=DB.fmt(totalMes)+' / mês';

  const el=document.getElementById('parList');

  // Mês selector
  const mesOptions=Array.from({length:12},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-3+i,1);
    const off=Math.round((d-new Date(now.getFullYear(),now.getMonth(),1))/(1000*60*60*24*30));
    return `<option value="${off}" ${off===parMesOffset?'selected':''}>${MESES[d.getMonth()]} ${d.getFullYear()}</option>`;
  }).join('');

  let html=`
    <div class="par-mes-row">
      <label>Mês visualizado</label>
      <select class="par-mes-sel" onchange="parMesOffset=parseInt(this.value);renderParcelas()">${mesOptions}</select>
    </div>
    <div class="par-totais">
      <div class="par-tot-box"><label>Total mês</label><span class="blue-t">${DB.fmtShort(totalMes)}</span></div>
      <div class="par-tot-box"><label>✅ Pagas</label><span class="green-t">${DB.fmtShort(totalPago)}</span></div>
      <div class="par-tot-box"><label>⚠️ Atraso</label><span class="red-t">${DB.fmtShort(totalAtrasado)}</span></div>
    </div>
    <div class="par-tabs">
      <button class="par-tab ${parFilter==='todos'?'active':''}" onclick="setParFilter('todos')">Todos</button>
      <button class="par-tab ${parFilter==='credcard'?'active':''}" onclick="setParFilter('credcard')">💳 Crediário</button>
      <button class="par-tab ${parFilter==='financing'?'active':''}" onclick="setParFilter('financing')">🏦 Financ.</button>
      <button class="par-tab ${parFilter==='credit'?'active':''}" onclick="setParFilter('credit')">🔄 Cartão</button>
    </div>
    <div style="padding:0 14px">
      <button class="fab" style="margin:12px 0" onclick="openModal('parcela')">+ Novo Parcelamento</button>`;

  if(!filtered.length) html+='<div class="empty"><div class="eic">🔄</div><p>Nenhum parcelamento</p></div>';
  else filtered.sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm)).forEach(p=>{ html+=parCardHTML(p,target); });
  html+='</div>';
  el.innerHTML=html;
}

function parCardHTML(p,target){
  const ini=new Date(p.data+'T00:00:00');
  const pagas=p.pagamentos.filter(s=>s==='pago').length;
  const atrasadas=p.pagamentos.filter(s=>s==='atrasado').length;
  const pct=Math.round(pagas/p.nParcelas*100);
  const saldoDevedor=DB.fmt(p.valorTotal-(pagas*p.valorParcela));
  const tc=DB.typeClass(p.tipo),tl=DB.typeLabel(p.tipo);
  const gradMap={credcard:'#f59e0b,#fb923c',financing:'#4da6ff,#22d3ee',credit:'#b57bee,#4da6ff'};

  // Only show pills for target month ± 2
  const ty=target.getFullYear(),tm=target.getMonth();
  let pills='';
  for(let i=0;i<p.nParcelas;i++){
    const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
    const diff=(d.getFullYear()-ty)*12+(d.getMonth()-tm);
    if(Math.abs(diff)>2) continue; // só mostra próximas/passadas
    const st=p.pagamentos[i];
    const isFuture=d>target&&st==='pendente',cls=isFuture?'futuro':st;
    const icon={pago:'✓',atrasado:'!',pendente:''+(i+1),futuro:''+(i+1)}[cls]||i+1;
    pills+=`<div class="inst-pill ${cls}" title="Parcela ${i+1} — ${MESES[d.getMonth()]}/${d.getFullYear()}: ${st}" onclick="toggleParcela('${p.id}',${i})">${icon}</div>`;
  }
  if(!pills) pills='<span style="font-size:12px;color:var(--text3)">Sem parcelas neste período</span>';

  return `<div class="par-card ${tc}">
    <div class="par-head">
      <div><div class="par-title">${p.descricao}</div><div class="par-cat">${DB.catEmoji(p.categoria)} ${p.categoria}</div></div>
      <div style="text-align:right"><div class="par-type-badge ${tc}">${tl}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${DB.fmtDate(p.data)}</div></div>
    </div>
    <div class="par-values">
      <div class="par-vbox"><label>Parcela mensal</label><span>${DB.fmt(p.valorParcela)}</span></div>
      <div class="par-vbox"><label>Saldo devedor</label><span style="color:var(--red)">${saldoDevedor}</span></div>
    </div>
    <div class="par-prog-wrap"><div class="par-prog" style="width:${pct}%;background:linear-gradient(90deg,${gradMap[tc]||'#4da6ff,#22d3ee'})"></div></div>
    <div class="inst-legend"><div class="legend-item"><div class="legend-dot pago"></div>Pago</div><div class="legend-item"><div class="legend-dot atrasado"></div>Atrasado</div><div class="legend-item"><div class="legend-dot pendente"></div>Pendente</div></div>
    <div class="par-installments">${pills}</div>
    <div class="par-footer">
      <div class="par-info-txt">${pagas}/${p.nParcelas} pagas${atrasadas>0?` · <span style="color:var(--red)">${atrasadas} atrasada(s)</span>`:''}</div>
      <div>
        <button class="par-edit-btn" onclick="abrirParEdit('${p.id}')">✏️ Editar</button>
        <button class="par-del" onclick="delPar('${p.id}')">🗑 Remover</button>
      </div>
    </div>
  </div>`;
}

function setParFilter(f){ parFilter=f; renderParcelas(); }

function toggleParcela(parId,idx){
  const par=DB.getPar().find(p=>p.id==parId); if(!par) return;
  const cur=par.pagamentos[idx];
  const next={pendente:'pago',pago:'atrasado',atrasado:'pendente',futuro:'pago'}[cur]||'pago';
  par.pagamentos[idx]=next; DB.updatePar(parId,{pagamentos:par.pagamentos});
  if(next==='pago'){
    const ini=new Date(par.data+'T00:00:00'),d=new Date(ini.getFullYear(),ini.getMonth()+idx,1);
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(!DB.getTx().some(t=>t._parId==parId&&t._parIdx==idx))
      DB.addTx({tipo:'saida',descricao:`${par.descricao} (${idx+1}/${par.nParcelas})`,valor:par.valorParcela,data:ds,categoria:par.categoria,recorrencia:'nenhuma',_parId:parId,_parIdx:idx});
    showToast(`✅ Parcela ${idx+1} paga!`);
  } else {
    const tx=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx); if(tx) DB.removeTx(tx.id);
    showToast(next==='atrasado'?`⚠️ Parcela ${idx+1} atrasada`:`Parcela ${idx+1} pendente`);
  }
  renderParcelas(); renderDash();
}

function delPar(id){
  if(!confirm('Remover este parcelamento?')) return;
  DB.getTx().filter(t=>t._parId==id).forEach(t=>DB.removeTx(t.id));
  DB.removePar(id); showToast('🗑 Removido'); renderParcelas(); renderDash();
}

// ===== EDITAR PARCELA =====
function abrirParEdit(id){
  const p=DB.getPar().find(x=>x.id==id); if(!p) return;
  document.getElementById('parEditId').value=p.id;
  document.getElementById('parEditDesc').value=p.descricao;
  document.getElementById('parEditValParc').value=p.valorParcela;
  document.getElementById('parEditValTotal').value=p.valorTotal;
  document.getElementById('parEditCat').value=p.categoria||'Geral';
  document.getElementById('parEditTipo').value=p.tipo||'credcard';
  document.getElementById('parModal').classList.remove('hidden');
}
function fecharParModal(){ document.getElementById('parModal').classList.add('hidden'); }
function parEditCalc(src){
  const n=DB.getPar().find(x=>x.id==document.getElementById('parEditId').value)?.nParcelas||1;
  if(src==='parc'){ const v=parseFloat(document.getElementById('parEditValParc').value); if(v) document.getElementById('parEditValTotal').value=(v*n).toFixed(2); }
  else{ const v=parseFloat(document.getElementById('parEditValTotal').value); if(v) document.getElementById('parEditValParc').value=(v/n).toFixed(2); }
}
function salvarParEdit(){
  const id=document.getElementById('parEditId').value;
  const desc=document.getElementById('parEditDesc').value.trim();
  const valParc=parseFloat(document.getElementById('parEditValParc').value);
  const valTotal=parseFloat(document.getElementById('parEditValTotal').value);
  const cat=document.getElementById('parEditCat').value;
  const tipo=document.getElementById('parEditTipo').value;
  if(!desc||!valParc){ showToast('Preencha os campos obrigatórios'); return; }
  DB.updatePar(id,{descricao:desc,valorParcela:valParc,valorTotal:valTotal||valParc,categoria:cat,tipo});
  fecharParModal(); showToast('✅ Parcelamento atualizado!'); renderParcelas();
}
document.getElementById('parModal').addEventListener('click',e=>{ if(e.target===document.getElementById('parModal')) fecharParModal(); });

// ===== PREVISÃO =====
function prevMonthKey(offset){
  const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()+offset,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function prevMonthLabel(offset){
  const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()+offset,1);
  const rel=offset===0?' (atual)':offset===1?' (próximo)':offset===-1?' (anterior)':``;
  return `${MESES[d.getMonth()]} ${d.getFullYear()}${rel}`;
}
function prevChangeMonth(delta){ prevMonthOffset+=delta; renderPrevisao(); }

function renderPrevisao(){
  const key=prevMonthKey(prevMonthOffset);
  const data=DB.getPrev(key);
  document.getElementById('prevMonthLabel').textContent=prevMonthLabel(prevMonthOffset);
  if(!data._loaded){
    const now=new Date(),target=new Date(now.getFullYear(),now.getMonth()+prevMonthOffset,1);
    DB.getTx().filter(t=>t.recorrencia&&t.recorrencia!=='nenhuma').forEach(t=>{
      const exists=data.entradas.some(i=>i._srcId===t.id)||data.saidas.some(i=>i._srcId===t.id);
      if(!exists){ const item={id:Date.now()+Math.random(),desc:t.descricao+' 🔄',valor:t.valor,_srcId:t.id,_recorrente:true}; t.tipo==='entrada'?data.entradas.push(item):data.saidas.push(item); }
    });
    DB.getPar().forEach(p=>{
      const ini=new Date(p.data+'T00:00:00');
      for(let i=0;i<p.nParcelas;i++){
        const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
        if(d.getFullYear()===target.getFullYear()&&d.getMonth()===target.getMonth()&&p.pagamentos[i]!=='pago'&&!data.saidas.some(x=>x._parId===p.id&&x._parIdx===i))
          data.saidas.push({id:Date.now()+Math.random(),desc:`${p.descricao} (${i+1}/${p.nParcelas}) 🔄`,valor:p.valorParcela,_parId:p.id,_parIdx:i,_recorrente:true});
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
  if(totEnt===0) msgs.push({t:'warn',m:'💡 Adicione entradas previstas para análise completa.'});
  else{ const t2=totSai/totEnt; if(t2>1) msgs.push({t:'danger',m:`🚨 Previsão negativa! Saídas ${((t2-1)*100).toFixed(0)}% maiores que entradas.`}); else if(t2>0.8) msgs.push({t:'warn',m:`⚠️ ${(t2*100).toFixed(0)}% da renda comprometida.`}); else msgs.push({t:'good',m:`✅ Boa previsão! Sobra: ${DB.fmt(saldo)} (${((saldo/totEnt)*100).toFixed(0)}%).`}); }
  if(data.saidas.some(i=>i._recorrente)) msgs.push({t:'info',m:'🔄 Parcelas e recorrências carregadas automaticamente.'});
  document.getElementById('prevAnalise').innerHTML=msgs.map(m=>`<div class="sugg-item ${m.t}">${m.m}</div>`).join('');
}
function prevItemHTML(item,tipo,key){
  return `<div class="prev-list-item"><div class="prev-li-desc">${item.desc}${item._recorrente?'<span class="prev-recurring-badge">auto</span>':''}</div><div class="prev-li-val ${tipo}">${tipo==='entrada'?'+':'-'}${DB.fmt(item.valor)}</div><button class="prev-li-del" onclick="delPrevItem('${tipo}','${item.id}','${key}')">✕</button></div>`;
}
function addPrevItem(tipo){
  const descId=tipo==='entrada'?'prevEntDesc':'prevSaiDesc', valId=tipo==='entrada'?'prevEntVal':'prevSaiVal';
  const desc=document.getElementById(descId).value.trim(), val=parseFloat(document.getElementById(valId).value);
  if(!desc||!val||val<=0){ showToast('Preencha descrição e valor'); return; }
  const key=prevMonthKey(prevMonthOffset), data=DB.getPrev(key);
  tipo==='entrada'?data.entradas.push({id:Date.now()+Math.random(),desc,valor:val}):data.saidas.push({id:Date.now()+Math.random(),desc,valor:val});
  DB.savePrev(key,data); document.getElementById(descId).value=''; document.getElementById(valId).value='';
  renderPrevisao(); showToast(tipo==='entrada'?'💰 Entrada adicionada':'💸 Saída adicionada');
}
function delPrevItem(tipo,id,key){
  const data=DB.getPrev(key);
  if(tipo==='entrada') data.entradas=data.entradas.filter(i=>i.id!=id); else data.saidas=data.saidas.filter(i=>i.id!=id);
  DB.savePrev(key,data); renderPrevisao();
}

// ===== FAMÍLIA =====
function populateFamMeses(){
  const sel=document.getElementById('famMesSel'); if(!sel) return;
  const now=new Date();
  for(let i=5;i>=-6;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const opt=document.createElement('option');
    opt.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opt.textContent=`${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if(i===0) opt.selected=true;
    sel.appendChild(opt);
  }
}

function salvarNome(){
  const nome=document.getElementById('meuNome').value.trim(); if(!nome){ showToast('Digite seu nome'); return; }
  const cfg=DB.getConfig(); cfg.nome=nome; DB.saveConfig(cfg); showToast('✅ Nome salvo!'); renderFamilia();
}

function getFamMesKey(){
  const sel=document.getElementById('famMesSel'); return sel?sel.value:null;
}

function renderFamilia(){
  const mesKey=getFamMesKey()||`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [y,m]=mesKey.split('-').map(Number);
  const cfg=DB.getConfig(), myNome=cfg.nome||'Eu';
  const tx=DB.getTx();

  // My data for selected month
  const myEnt=tx.filter(t=>{ const d=new Date(t.data+'T00:00:00'); return t.tipo==='entrada'&&d.getFullYear()===y&&d.getMonth()===m-1; }).reduce((s,t)=>s+t.valor,0);
  const mySaiTx=tx.filter(t=>{ const d=new Date(t.data+'T00:00:00'); return t.tipo==='saida'&&!t._parId&&d.getFullYear()===y&&d.getMonth()===m-1; }).reduce((s,t)=>s+t.valor,0);
  const myParPagas=DB.getPar().reduce((sum,p)=>{
    const ini=new Date(p.data+'T00:00:00');
    for(let i=0;i<p.nParcelas;i++){
      const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
      if(d.getFullYear()===y&&d.getMonth()===m-1&&p.pagamentos[i]==='pago') sum+=p.valorParcela;
    }
    return sum;
  },0);
  const mySai=mySaiTx+myParPagas;

  const members=DB.getFamMembers();
  const allMembers=[{id:'__me__',nome:myNome,mesEnt:myEnt,mesSai:mySai,saldo:myEnt-mySai,isMe:true},...members];
  const totEnt=allMembers.reduce((s,m2)=>s+m2.mesEnt,0);
  const totSai=allMembers.reduce((s,m2)=>s+m2.mesSai,0);
  const totSaldo=totEnt-totSai;

  const avatarEmojis=['🧑','👩','👨','👦','👧','👴','👵'];
  const avatarColors=['#3ddc84,#22d3ee','#b57bee,#4da6ff','#fb923c,#f59e0b','#f472b6,#b57bee','#60a5fa,#22d3ee','#4ade80,#22c55e','#fbbf24,#fb923c'];

  let html='';

  // Consolidated
  html+=`<div class="fam-consolidated">
    <div class="fam-cons-title">📊 Consolidado — ${MESES[m-1]} ${y}</div>
    <div class="fam-cons-row"><span class="fam-cons-lbl">Total entradas</span><span class="fam-cons-val" style="color:var(--green)">${DB.fmt(totEnt)}</span></div>
    <div class="fam-cons-row"><span class="fam-cons-lbl">Total saídas</span><span class="fam-cons-val" style="color:var(--red)">${DB.fmt(totSai)}</span></div>
    <div class="fam-cons-row"><span class="fam-cons-lbl" style="font-weight:800;font-size:15px">Saldo familiar</span><span class="fam-cons-val" style="color:${totSaldo>=0?'var(--green)':'var(--red)'};font-size:20px">${DB.fmt(totSaldo)}</span></div>
  </div>`;

  // Members
  html+='<div style="margin:0 14px 80px">';
  allMembers.forEach((mem,i)=>{
    const grad=avatarColors[i%avatarColors.length];
    html+=`<div class="fam-member-card-v2 ${mem.isMe?'me':'other'}">
      <div class="fam-mv2-head">
        <div class="fam-mv2-avatar" style="background:linear-gradient(135deg,${grad})">${avatarEmojis[i%avatarEmojis.length]}</div>
        <div class="fam-mv2-info">
          <div class="fam-mv2-name">${mem.nome}<span class="fam-mv2-badge ${mem.isMe?'me':'other'}">${mem.isMe?'Você':'Importado'}</span></div>
          <div class="fam-mv2-sub">${mem.isMe?'Dados em tempo real':'Importado em '+new Date(mem.importedAt||Date.now()).toLocaleDateString('pt-BR')}</div>
        </div>
        ${!mem.isMe?`<button class="fam-del-btn" onclick="removerMembro('${mem.id}')">🗑</button>`:''}
      </div>
      <div class="fam-mv2-grid">
        <div class="fam-mv2-box"><label>Entradas</label><span style="color:var(--green)">${DB.fmtShort(mem.mesEnt)}</span></div>
        <div class="fam-mv2-box"><label>Saídas</label><span style="color:var(--red)">${DB.fmtShort(mem.mesSai)}</span></div>
        <div class="fam-mv2-box"><label>Saldo</label><span style="color:${mem.saldo>=0?'var(--green)':'var(--red)'}">${DB.fmtShort(mem.saldo)}</span></div>
      </div>
    </div>`;
  });
  html+='</div>';
  document.getElementById('famPainel').innerHTML=html;
}

function removerMembro(id){
  if(!confirm('Remover este membro?')) return;
  DB.removeFamMember(id); showToast('🗑 Removido'); renderFamilia();
}
function importarMembro(){
  const code=document.getElementById('importCode').value.trim(); if(!code){ showToast('Cole o código'); return; }
  const data=DB.importFamData(code); if(!data){ showToast('❌ Código inválido'); return; }
  document.getElementById('importCode').value=''; showToast(`✅ ${data.nome} importado!`); renderFamilia();
}

// ===== QR GERAR =====
function abrirQRGerar(){
  const cfg=DB.getConfig(), nome=cfg.nome||document.getElementById('meuNome').value.trim()||'Membro';
  if(!cfg.nome&&!nome){ showToast('Salve seu nome primeiro'); return; }
  const code=DB.exportMyData(nome);
  exportedCode=code;
  document.getElementById('qrCodeDiv').innerHTML='';
  try{
    new QRCode(document.getElementById('qrCodeDiv'),{text:code,width:200,height:200,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
  }catch(e){
    document.getElementById('qrCodeDiv').innerHTML=`<div style="background:white;padding:12px;border-radius:10px;font-size:10px;word-break:break-all;max-width:200px;color:#000">${code}</div>`;
  }
  document.getElementById('qrGerarModal').classList.remove('hidden');
}
function fecharQRGerar(){ document.getElementById('qrGerarModal').classList.add('hidden'); }
function compartilharQR(){
  const cfg=DB.getConfig(), nome=cfg.nome||'Membro';
  const msg=`💰 FinançasFácil — ${nome}\n\nCole no app:\n${exportedCode}`;
  if(navigator.share){ navigator.share({title:'FinançasFácil',text:msg}).catch(()=>{}); }
  else{ navigator.clipboard?.writeText(msg).then(()=>showToast('📋 Copiado!')); }
}

// ===== QR LER (câmera) =====
async function abrirQRLer(){
  document.getElementById('qrLerModal').classList.remove('hidden');
  document.getElementById('qrScanStatus').textContent='Iniciando câmera...';
  try{
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    const video=document.getElementById('qrVideo');
    video.srcObject=qrStream;
    await video.play();
    document.getElementById('qrScanStatus').textContent='📷 Aponte para o QR Code do familiar';
    iniciarScanQR(video);
  }catch(e){
    document.getElementById('qrScanStatus').textContent='❌ Câmera não disponível. Use o código manual abaixo.';
  }
}
function iniciarScanQR(video){
  // Use BarcodeDetector if available, otherwise show manual fallback
  if('BarcodeDetector' in window){
    const detector=new BarcodeDetector({formats:['qr_code']});
    qrScanInterval=setInterval(async()=>{
      try{
        const barcodes=await detector.detect(video);
        if(barcodes.length>0){
          const raw=barcodes[0].rawValue;
          clearInterval(qrScanInterval);
          fecharQRLer();
          processarQRCode(raw);
        }
      }catch(e){}
    },500);
  }else{
    // Fallback: use canvas to capture and try to decode
    document.getElementById('qrScanStatus').innerHTML='📷 Câmera ativa!<br><small>Se não detectar automaticamente, use o botão:</small><br><button onclick="capturarQRManual()" style="margin-top:8px;background:var(--green2);color:#000;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-family:var(--font)">📸 Capturar agora</button>';
  }
}
function capturarQRManual(){
  const video=document.getElementById('qrVideo');
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  showToast('Use o código manual no campo de texto'); fecharQRLer();
}
function fecharQRLer(){
  if(qrScanInterval){ clearInterval(qrScanInterval); qrScanInterval=null; }
  if(qrStream){ qrStream.getTracks().forEach(t=>t.stop()); qrStream=null; }
  document.getElementById('qrLerModal').classList.add('hidden');
}
function processarQRCode(raw){
  const data=DB.importFamData(raw);
  if(!data){ showToast('❌ QR Code inválido'); return; }
  showToast(`✅ ${data.nome} importado!`); renderFamilia(); goPage('familia');
}

// ===== HISTÓRICO =====
function populateMonths(){
  const sel=document.getElementById('fMes'), now=new Date();
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const opt=document.createElement('option');
    opt.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opt.textContent=`${MESES[d.getMonth()]} ${d.getFullYear()}`;
    sel.appendChild(opt);
  }
}
function renderHist(){
  const tipo=document.getElementById('fTipo').value,mes=document.getElementById('fMes').value,busca=document.getElementById('fBusca').value.toLowerCase();
  let all=[];
  if(tipo!=='parcela') all=[...DB.getTx().filter(t=>!t._parId)];
  if(tipo==='parcela'||tipo==='todos'){
    DB.getPar().forEach(p=>{
      const ini=new Date(p.data+'T00:00:00');
      for(let i=0;i<p.nParcelas;i++){
        const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
        all.push({id:p.id+'_'+i,tipo:'parcela',descricao:`${p.descricao} (${i+1}/${p.nParcelas})`,valor:p.valorParcela,data:ds,categoria:p.categoria,_status:p.pagamentos[i]});
      }
    });
  }
  if(tipo!=='todos') all=all.filter(t=>t.tipo===tipo);
  if(mes!=='todos') all=all.filter(t=>t.data&&t.data.startsWith(mes));
  if(busca) all=all.filter(t=>t.descricao.toLowerCase().includes(busca)||(t.categoria||'').toLowerCase().includes(busca));
  all.sort((a,b)=>new Date(b.data)-new Date(a.data));
  const el=document.getElementById('histList');
  if(!all.length){ el.innerHTML='<div class="empty"><div class="eic">🔍</div><p>Nenhum resultado</p></div>'; return; }
  el.innerHTML=all.map(t=>{
    const sc=t._status?` · <span style="color:${t._status==='pago'?'var(--green)':t._status==='atrasado'?'var(--red)':'var(--text3)'}">● ${t._status}</span>`:'';
    return `<div class="txi"><div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div><div class="txi-inf"><div class="txi-desc">${t.descricao}</div><div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${sc}</div></div><div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>${t.tipo!=='parcela'?`<button class="del-btn" onclick="delTx('${t.id}')">🗑</button>`:''}</div>`;
  }).join('');
}

// ===== MODAL TRANSAÇÃO =====
function openModal(tipo){
  modalType=tipo;
  ['txId','txDesc','txObs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('txTipo').value=tipo;
  document.getElementById('txVal').value=''; document.getElementById('txData').value=DB.nowDate();
  document.getElementById('txCat').value='Geral'; document.getElementById('txParc').value='1';
  document.getElementById('txRec').value='nenhuma';
  if(document.getElementById('vTotal')) document.getElementById('vTotal').value='';
  if(document.getElementById('vParc')) document.getElementById('vParc').value='';
  document.getElementById('modalTitle').textContent={entrada:'💰 Nova Entrada',saida:'💸 Nova Saída',parcela:'🔄 Novo Parcelamento'}[tipo]||'Nova Transação';
  document.getElementById('parcelGrp').style.display=(tipo==='saida'||tipo==='parcela')?'block':'none';
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
  document.getElementById('txRec').value=t.recorrencia||'nenhuma'; document.getElementById('txObs').value=t.obs||'';
  ['parcelGrp','valDual','typeGrp'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('valSingle').style.display='block'; document.getElementById('recGrp').style.display='block';
  document.getElementById('modalTitle').textContent=t.tipo==='entrada'?'✏️ Editar Entrada':'✏️ Editar Saída';
  document.getElementById('modal').classList.remove('hidden');
}

function salvar(){
  const id=document.getElementById('txId').value, tipo=document.getElementById('txTipo').value;
  const desc=document.getElementById('txDesc').value.trim(), data=document.getElementById('txData').value;
  const cat=document.getElementById('txCat').value, rec=document.getElementById('txRec').value;
  if(!desc||!data){ showToast('⚠️ Preencha todos os campos'); return; }
  if(tipo==='parcela'){
    const vT=parseFloat(document.getElementById('vTotal').value), vP=parseFloat(document.getElementById('vParc').value);
    const nP=parseInt(document.getElementById('txParc').value)||1;
    const parType=document.querySelector('.type-opt[class*="sel-"]')?.dataset.type||'credcard';
    if(!vT&&!vP){ showToast('Informe o valor total ou da parcela'); return; }
    DB.addPar({descricao:desc,valorTotal:vT||(vP*nP),valorParcela:vP||(vT/nP),nParcelas:nP,data,categoria:cat,tipo:parType});
    showToast(`✅ ${nP}x ${DB.fmt((vP||(vT/nP)))} cadastrado!`);
  } else {
    const val=parseFloat(document.getElementById('txVal').value);
    if(!val||val<=0){ showToast('⚠️ Valor inválido'); return; }
    const nP=parseInt(document.getElementById('txParc').value)||1;
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

function delTx(id){
  if(!confirm('Remover?')) return;
  DB.removeTx(id); showToast('🗑 Removido'); renderAll();
  if(curPage==='entradas') renderEntradas();
  if(curPage==='saidas') renderSaidas();
  if(curPage==='historico') renderHist();
}
function selectType(el,type){ document.querySelectorAll('.type-opt').forEach(x=>x.className='type-opt'); el.classList.add('sel-'+type); el.dataset.type=type; }
function calcDual(src){
  const n=parseInt(document.getElementById('txParc').value)||1;
  if(src==='total'){ const v=parseFloat(document.getElementById('vTotal').value); if(v&&n) document.getElementById('vParc').value=(v/n).toFixed(2); }
  else if(src==='parc'){ const v=parseFloat(document.getElementById('vParc').value); if(v&&n) document.getElementById('vTotal').value=(v*n).toFixed(2); }
  else{ const vT=parseFloat(document.getElementById('vTotal')?.value),vP=parseFloat(document.getElementById('vParc')?.value); if(vT) document.getElementById('vParc').value=(vT/n).toFixed(2); else if(vP) document.getElementById('vTotal').value=(vP*n).toFixed(2); }
}

function showToast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3000); }

function setupInstall(){
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBanner').classList.remove('hidden'); });
  document.getElementById('installBtn').addEventListener('click',async()=>{
    if(!deferredPrompt) return; deferredPrompt.prompt();
    const{outcome}=await deferredPrompt.userChoice;
    if(outcome==='accepted') showToast('✅ App instalado!');
    deferredPrompt=null; document.getElementById('installBanner').classList.add('hidden');
  });
  document.getElementById('installClose').addEventListener('click',()=>document.getElementById('installBanner').classList.add('hidden'));
}
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
function drawFlow(){ Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)); }

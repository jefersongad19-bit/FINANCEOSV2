// ===== APP.JS v4 =====
let curPage='dashboard', curPeriod='mes', modalType='', deferredPrompt=null;
let parFilter='todos';
let prevMonthOffset=1; // 1 = próximo mês, 0 = mês atual, 2 = daqui 2 meses...
let exportedCode='';

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ===== INIT =====
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
  renderAll();
  setupInstall();
  document.getElementById('themeBtn').onclick=toggleTheme;
  document.getElementById('notifBtn').onclick=toggleAlerts;
  window.addEventListener('resize',()=>{ if(curPage==='dashboard') renderDash(); });
  // Load saved name
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
  const el=document.getElementById('page-'+page); if(el) el.classList.add('active');
  const btn=document.querySelector(`.ni[data-page="${page}"]`); if(btn) btn.classList.add('active');
  curPage=page;
  if(page==='dashboard') renderDash();
  if(page==='entradas') renderEntradas();
  if(page==='saidas') renderSaidas();
  if(page==='parcelas') renderParcelas();
  if(page==='previsao') renderPrevisao();
  if(page==='familia') renderFamilia();
  if(page==='historico') renderHist();
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
  const saidasTx=filtered.filter(t=>t.tipo==='saida').reduce((s,t)=>s+t.valor,0);
  const parPagas=DB.parPagasPeriod(curPeriod);
  const totalSai=saidasTx+parPagas;
  const saldo=entradas-totalSai;

  const saldoEl=document.getElementById('saldoDisplay');
  saldoEl.textContent=DB.fmt(saldo);
  saldoEl.classList.toggle('negative',saldo<0);
  document.getElementById('dispEntradas').textContent=DB.fmt(entradas);
  document.getElementById('dispSaidas').textContent=DB.fmt(totalSai);
  document.getElementById('qEnt').textContent=DB.fmtShort(entradas);
  document.getElementById('qSai').textContent=DB.fmtShort(totalSai);
  document.getElementById('qPar').textContent=DB.fmtShort(DB.parMensalAtiva());

  // Previsão quick preview
  const prevKey=prevMonthKey(1);
  const prevData=DB.getPrev(prevKey);
  const prevEnt=prevData.entradas.reduce((s,i)=>s+i.valor,0);
  const prevSai=prevData.saidas.reduce((s,i)=>s+i.valor,0);
  const prevSaldo=prevEnt-prevSai;
  document.getElementById('qPrev').textContent=prevEnt||prevSai?DB.fmtShort(prevSaldo):'Próx. mês';

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
  const cats={}; filtered.filter(t=>t.tipo==='saida').forEach(t=>{ cats[t.categoria]=(cats[t.categoria]||0)+t.valor; });
  const total=Object.values(cats).reduce((s,v)=>s+v,0)||1;
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=document.getElementById('catList');
  if(!sorted.length){ el.innerHTML='<div class="empty"><div class="eic">📊</div><p>Sem dados</p></div>'; return; }
  el.innerHTML=sorted.map(([c,v])=>`<div class="cat-item"><div class="cat-em">${DB.catEmoji(c)}</div><div class="cat-inf"><div class="cat-nm">${c}</div><div class="cat-bw"><div class="cat-b" style="width:${(v/total*100).toFixed(1)}%;background:${DB.catColor(c)}"></div></div></div><div class="cat-pc">${(v/total*100).toFixed(0)}%</div></div>`).join('');
}

function renderRecentTx(tx){
  const recent=[...tx].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,5);
  const el=document.getElementById('recentTx');
  if(!recent.length){ el.innerHTML='<div class="empty"><div class="eic">💸</div><p>Nenhuma transação</p></div>'; return; }
  el.innerHTML=recent.map(t=>txHTML(t,false)).join('');
}

function genSugestoes(ent,sai,saldo){
  const suggs=[],alerts=[];
  const taxa=ent>0?sai/ent:0;
  if(ent===0){ suggs.push({t:'warn',m:'💡 Adicione suas entradas para ver a análise completa.'}); }
  else{
    if(taxa>1){ suggs.push({t:'danger',m:`🚨 Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!`}); alerts.push({t:'danger',m:`Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!`}); }
    else if(taxa>0.8){ suggs.push({t:'warn',m:`⚠️ ${(taxa*100).toFixed(0)}% da renda comprometida.`}); alerts.push({t:'warn',m:`${(taxa*100).toFixed(0)}% da renda comprometida`}); }
    else if(taxa<=0.5) suggs.push({t:'good',m:`✅ Economizando ${((1-taxa)*100).toFixed(0)}% da renda!`});
    else suggs.push({t:'info',m:`📊 ${(taxa*100).toFixed(0)}% comprometida. Meta: abaixo de 70%.`});
  }
  const atrasadas=DB.getPar().reduce((n,p)=>n+p.pagamentos.filter(s=>s==='atrasado').length,0);
  if(atrasadas>0){ suggs.push({t:'danger',m:`⚠️ ${atrasadas} parcela(s) em atraso!`}); alerts.push({t:'danger',m:`${atrasadas} parcela(s) em atraso`}); }
  if(saldo>0&&ent>0){ const r=(saldo/ent*100).toFixed(0); suggs.push({t:r>=20?'good':'info',m:r>=20?`💰 ${r}% de sobra — invista na sua reserva!`:`🏦 Tente poupar 20% da renda mensalmente.`}); }
  if(!suggs.length) suggs.push({t:'info',m:'💡 Adicione transações para receber análises.'});
  document.getElementById('suggList').innerHTML=suggs.map(s=>`<div class="sugg-item ${s.t}">${s.m}</div>`).join('');
  const badge=document.getElementById('alertBadge'),aList=document.getElementById('alertList');
  if(!alerts.length){ badge.classList.add('hidden'); aList.innerHTML='<div class="alert-item ok"><span>✅</span><span>Tudo sob controle!</span></div>'; }
  else{ badge.textContent=alerts.length; badge.classList.remove('hidden'); aList.innerHTML=alerts.map(a=>`<div class="alert-item ${a.t}"><span>${a.t==='danger'?'🚨':'⚠️'}</span><span>${a.m}</span></div>`).join(''); }
}

function toggleAlerts(){ document.getElementById('alertPanel').classList.toggle('hidden'); }
function closeAlerts(){ document.getElementById('alertPanel').classList.add('hidden'); }

// ===== TX HTML =====
function txHTML(t,showDel=false){
  return `<div class="txi" onclick="${showDel?`editTx('${t.id}')`:''}" >
    <div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div>
    <div class="txi-inf">
      <div class="txi-desc">${t.descricao}</div>
      <div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${t.recorrencia&&t.recorrencia!=='nenhuma'?' · 🔄 '+t.recorrencia:''}</div>
    </div>
    <div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>
    ${showDel?`<button class="del-btn" onclick="event.stopPropagation();delTx('${t.id}')">🗑</button>`:''}
  </div>`;
}

// ===== ENTRADAS / SAÍDAS =====
function renderEntradas(){
  const all=DB.getTx().filter(t=>t.tipo==='entrada');
  document.getElementById('entTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const el=document.getElementById('entList');
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  el.innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💰</div><p>Nenhuma entrada</p></div>';
}
function renderSaidas(){
  const all=DB.getTx().filter(t=>t.tipo==='saida');
  document.getElementById('saiTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const el=document.getElementById('saiList');
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  el.innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💸</div><p>Nenhuma saída</p></div>';
}

// ===== PARCELAS =====
function renderParcelas(){
  const tabsHTML=`<div class="par-tabs"><button class="par-tab ${parFilter==='todos'?'active':''}" onclick="setParFilter('todos')">Todos</button><button class="par-tab ${parFilter==='credcard'?'active':''}" onclick="setParFilter('credcard')">💳 Crediário</button><button class="par-tab ${parFilter==='financing'?'active':''}" onclick="setParFilter('financing')">🏦 Financ.</button><button class="par-tab ${parFilter==='credit'?'active':''}" onclick="setParFilter('credit')">🔄 Cartão</button></div>`;
  const now=new Date(),all=DB.getPar(),filtered=parFilter==='todos'?all:all.filter(p=>p.tipo===parFilter);
  let totalMensal=0;
  all.forEach(p=>{ for(let i=0;i<p.nParcelas;i++){ const ini=new Date(p.data+'T00:00:00'),d=new Date(ini.getFullYear(),ini.getMonth()+i,1); if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&p.pagamentos[i]!=='pago') totalMensal+=p.valorParcela; } });
  document.getElementById('parTotal').textContent=DB.fmt(totalMensal)+' / mês';
  const el=document.getElementById('parList');
  let html=tabsHTML+'<div style="padding:0 14px"><button class="fab" style="margin:12px 0" onclick="openModal(\'parcela\')">+ Novo Parcelamento</button>';
  if(!filtered.length) html+='<div class="empty"><div class="eic">🔄</div><p>Nenhum parcelamento</p></div>';
  else filtered.sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm)).forEach(p=>{ html+=parCardHTML(p,now); });
  html+='</div>'; el.innerHTML=html;
}
function parCardHTML(p,now){
  const ini=new Date(p.data+'T00:00:00'),pagas=p.pagamentos.filter(s=>s==='pago').length,atrasadas=p.pagamentos.filter(s=>s==='atrasado').length;
  const pct=Math.round(pagas/p.nParcelas*100),saldoDevedor=DB.fmt(p.valorTotal-(pagas*p.valorParcela));
  const tc=DB.typeClass(p.tipo),tl=DB.typeLabel(p.tipo);
  let pills='';
  for(let i=0;i<p.nParcelas;i++){
    const st=p.pagamentos[i],d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
    const isFuture=d>now&&st==='pendente',cls=isFuture?'futuro':st;
    const icon={pago:'✓',atrasado:'!',pendente:''+(i+1),futuro:''+(i+1)}[cls]||i+1;
    pills+=`<div class="inst-pill ${cls}" title="Parcela ${i+1}: ${st}" onclick="toggleParcela('${p.id}',${i})">${icon}</div>`;
  }
  const gradMap={credcard:'#f59e0b,#fb923c',financing:'#4da6ff,#22d3ee',credit:'#b57bee,#4da6ff'};
  return `<div class="par-card ${tc}"><div class="par-head"><div><div class="par-title">${p.descricao}</div><div class="par-cat">${DB.catEmoji(p.categoria)} ${p.categoria}</div></div><div style="text-align:right"><div class="par-type-badge ${tc}">${tl}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${DB.fmtDate(p.data)}</div></div></div><div class="par-values"><div class="par-vbox"><label>Parcela mensal</label><span>${DB.fmt(p.valorParcela)}</span></div><div class="par-vbox"><label>Saldo devedor</label><span style="color:var(--red)">${saldoDevedor}</span></div></div><div class="par-prog-wrap"><div class="par-prog" style="width:${pct}%;background:linear-gradient(90deg,${gradMap[tc]||'#4da6ff,#22d3ee'})"></div></div><div class="inst-legend"><div class="legend-item"><div class="legend-dot pago"></div>Pago</div><div class="legend-item"><div class="legend-dot atrasado"></div>Atrasado</div><div class="legend-item"><div class="legend-dot pendente"></div>Pendente</div></div><div class="par-installments">${pills}</div><div class="par-footer"><div class="par-info-txt">${pagas}/${p.nParcelas} pagas${atrasadas>0?` · <span style="color:var(--red)">${atrasadas} em atraso</span>`:''}</div><button class="par-del" onclick="delPar('${p.id}')">🗑 Remover</button></div></div>`;
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
    const exists=DB.getTx().some(t=>t._parId==parId&&t._parIdx==idx);
    if(!exists) DB.addTx({tipo:'saida',descricao:`${par.descricao} (${idx+1}/${par.nParcelas})`,valor:par.valorParcela,data:ds,categoria:par.categoria,recorrencia:'nenhuma',_parId:parId,_parIdx:idx,obs:'Parcela paga'});
    showToast(`✅ Parcela ${idx+1} paga!`);
  } else if(next==='atrasado'){
    const tx=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx); if(tx) DB.removeTx(tx.id);
    showToast(`⚠️ Parcela ${idx+1} marcada como atrasada`);
  } else {
    const tx=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx); if(tx) DB.removeTx(tx.id);
    showToast(`Parcela ${idx+1} pendente`);
  }
  renderParcelas(); renderDash();
}
function delPar(id){
  if(!confirm('Remover este parcelamento?')) return;
  DB.getTx().filter(t=>t._parId==id).forEach(t=>DB.removeTx(t.id));
  DB.removePar(id); showToast('🗑 Removido'); renderParcelas(); renderDash();
}

// ===== PREVISÃO =====
function prevMonthKey(offset){
  const now=new Date();
  const d=new Date(now.getFullYear(),now.getMonth()+offset,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function prevMonthLabel(offset){
  const now=new Date();
  const d=new Date(now.getFullYear(),now.getMonth()+offset,1);
  const rel=offset===0?'(mês atual)':offset===1?'(próximo mês)':offset===-1?'(mês passado)':``;
  return `${MESES[d.getMonth()]} ${d.getFullYear()} ${rel}`;
}
function prevChangeMonth(delta){
  prevMonthOffset+=delta; renderPrevisao();
}

function renderPrevisao(){
  const key=prevMonthKey(prevMonthOffset);
  const data=DB.getPrev(key);
  document.getElementById('prevMonthLabel').textContent=prevMonthLabel(prevMonthOffset);

  // Auto-load recurring transactions into preview if empty
  if(!data._loaded){
    const now=new Date();
    const target=new Date(now.getFullYear(),now.getMonth()+prevMonthOffset,1);
    DB.getTx().filter(t=>t.recorrencia&&t.recorrencia!=='nenhuma').forEach(t=>{
      const exists=data.entradas.some(i=>i._srcId===t.id)||data.saidas.some(i=>i._srcId===t.id);
      if(!exists){
        const item={id:Date.now()+Math.random(),desc:t.descricao+'  🔄',valor:t.valor,_srcId:t.id,_recorrente:true};
        if(t.tipo==='entrada') data.entradas.push(item);
        else data.saidas.push(item);
      }
    });
    // Auto-load installments due in that month
    DB.getPar().forEach(p=>{
      const ini=new Date(p.data+'T00:00:00');
      for(let i=0;i<p.nParcelas;i++){
        const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
        if(d.getFullYear()===target.getFullYear()&&d.getMonth()===target.getMonth()&&p.pagamentos[i]!=='pago'){
          const exists=data.saidas.some(x=>x._parId===p.id&&x._parIdx===i);
          if(!exists) data.saidas.push({id:Date.now()+Math.random(),desc:`${p.descricao} (${i+1}/${p.nParcelas}) 🔄`,valor:p.valorParcela,_parId:p.id,_parIdx:i,_recorrente:true});
        }
      }
    });
    data._loaded=true;
    DB.savePrev(key,data);
  }

  const totEnt=data.entradas.reduce((s,i)=>s+i.valor,0);
  const totSai=data.saidas.reduce((s,i)=>s+i.valor,0);
  const saldo=totEnt-totSai;

  // Hero
  const saldoEl=document.getElementById('prevSaldo');
  saldoEl.textContent=DB.fmt(saldo);
  saldoEl.className='prev-saldo '+(saldo>0?'pos':saldo<0?'neg':'neu');
  document.getElementById('prevEntTotal').textContent=DB.fmt(totEnt);
  document.getElementById('prevSaiTotal').textContent=DB.fmt(totSai);

  // Lists
  const entEl=document.getElementById('prevEntList');
  entEl.innerHTML=data.entradas.length?data.entradas.map(i=>prevItemHTML(i,'entrada',key)).join(''):'<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhuma entrada prevista</div>';
  const saiEl=document.getElementById('prevSaiList');
  saiEl.innerHTML=data.saidas.length?data.saidas.map(i=>prevItemHTML(i,'saida',key)).join(''):'<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhuma saída prevista</div>';

  // Summary
  document.getElementById('sumEnt').textContent=DB.fmt(totEnt);
  document.getElementById('sumSai').textContent=DB.fmt(totSai);
  const sumSaldoEl=document.getElementById('sumSaldo');
  sumSaldoEl.textContent=DB.fmt(saldo);
  sumSaldoEl.style.color=saldo>=0?'var(--green)':'var(--red)';

  // Análise
  const an=document.getElementById('prevAnalise');
  const msgs=[];
  if(totEnt===0) msgs.push({t:'warn',m:'💡 Adicione suas entradas previstas para ver a análise completa.'});
  else{
    const taxa=totSai/totEnt;
    if(taxa>1) msgs.push({t:'danger',m:`🚨 Previsão negativa! Saídas ${((taxa-1)*100).toFixed(0)}% maiores que as entradas. Revise seus gastos.`});
    else if(taxa>0.8) msgs.push({t:'warn',m:`⚠️ ${(taxa*100).toFixed(0)}% da renda prevista comprometida. Considere cortar gastos.`});
    else msgs.push({t:'good',m:`✅ Boa previsão! Sobra prevista: ${DB.fmt(saldo)} (${((saldo/totEnt)*100).toFixed(0)}% da renda).`});
  }
  if(data.saidas.some(i=>i._recorrente)) msgs.push({t:'info',m:`🔄 Algumas saídas foram carregadas automaticamente dos seus parcelamentos e transações recorrentes.`});
  an.innerHTML=msgs.map(m=>`<div class="sugg-item ${m.t}">${m.m}</div>`).join('');
}

function prevItemHTML(item,tipo,key){
  return `<div class="prev-list-item">
    <div class="prev-li-desc">${item.desc}${item._recorrente?'<span class="prev-recurring-badge">auto</span>':''}</div>
    <div class="prev-li-val ${tipo}">${tipo==='entrada'?'+':'-'}${DB.fmt(item.valor)}</div>
    ${!item._recorrente?`<button class="prev-li-del" onclick="delPrevItem('${tipo}','${item.id}','${key}')">✕</button>`:`<button class="prev-li-del" onclick="delPrevItem('${tipo}','${item.id}','${key}')" title="Remover do mês">✕</button>`}
  </div>`;
}

function addPrevItem(tipo){
  const descId=tipo==='entrada'?'prevEntDesc':'prevSaiDesc';
  const valId=tipo==='entrada'?'prevEntVal':'prevSaiVal';
  const desc=document.getElementById(descId).value.trim();
  const val=parseFloat(document.getElementById(valId).value);
  if(!desc||!val||val<=0){ showToast('Preencha descrição e valor'); return; }
  const key=prevMonthKey(prevMonthOffset);
  const data=DB.getPrev(key);
  const item={id:Date.now()+Math.random(),desc,valor:val};
  if(tipo==='entrada') data.entradas.push(item); else data.saidas.push(item);
  DB.savePrev(key,data);
  document.getElementById(descId).value=''; document.getElementById(valId).value='';
  renderPrevisao(); showToast(tipo==='entrada'?'💰 Entrada prevista adicionada':'💸 Saída prevista adicionada');
}

function delPrevItem(tipo,id,key){
  const data=DB.getPrev(key);
  if(tipo==='entrada') data.entradas=data.entradas.filter(i=>i.id!=id);
  else data.saidas=data.saidas.filter(i=>i.id!=id);
  DB.savePrev(key,data); renderPrevisao();
}

// ===== FAMÍLIA =====
function salvarNome(){
  const nome=document.getElementById('meuNome').value.trim();
  if(!nome){ showToast('Digite seu nome'); return; }
  const cfg=DB.getConfig(); cfg.nome=nome; DB.saveConfig(cfg);
  showToast('✅ Nome salvo!');
}

function gerarCodigo(){
  const cfg=DB.getConfig();
  const nome=cfg.nome||document.getElementById('meuNome').value.trim()||'Membro';
  exportedCode=DB.exportMyData(nome);
  const box=document.getElementById('exportBox');
  box.textContent=exportedCode; box.classList.remove('hidden');
  document.getElementById('exportActions').style.display='flex';
  showToast('✅ Código gerado!');
}

function copiarCodigo(){
  if(!exportedCode){ showToast('Gere o código primeiro'); return; }
  navigator.clipboard.writeText(exportedCode).then(()=>showToast('📋 Código copiado!')).catch(()=>{
    // fallback
    const ta=document.createElement('textarea'); ta.value=exportedCode;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 Copiado!');
  });
}

function enviarWhats(){
  if(!exportedCode){ showToast('Gere o código primeiro'); return; }
  const cfg=DB.getConfig(), nome=cfg.nome||'Membro';
  const msg=encodeURIComponent(`💰 *FinançasFácil* — Dados de ${nome}\n\nCole este código no app:\n\n${exportedCode}`);
  window.open('https://wa.me/?text='+msg,'_blank');
}

function nativeShare(){
  if(!exportedCode){ showToast('Gere o código primeiro'); return; }
  const cfg=DB.getConfig(), nome=cfg.nome||'Membro';
  if(navigator.share){
    navigator.share({ title:'FinançasFácil — '+nome, text:'Cole este código no app:\n\n'+exportedCode }).catch(()=>{});
  } else { copiarCodigo(); }
}

function importarMembro(){
  const code=document.getElementById('importCode').value.trim();
  if(!code){ showToast('Cole o código primeiro'); return; }
  const data=DB.importFamData(code);
  if(!data){ showToast('❌ Código inválido'); return; }
  document.getElementById('importCode').value='';
  showToast(`✅ ${data.nome} importado!`); renderFamilia();
}

function renderFamilia(){
  const members=DB.getFamMembers();
  const cfg=DB.getConfig();
  // My data
  const myTx=DB.getTx(), now=new Date(), y=now.getFullYear(), mo=now.getMonth();
  const myEnt=myTx.filter(t=>{ const d=new Date(t.data+'T00:00:00'); return t.tipo==='entrada'&&d.getFullYear()===y&&d.getMonth()===mo; }).reduce((s,t)=>s+t.valor,0);
  const mySai=myTx.filter(t=>{ const d=new Date(t.data+'T00:00:00'); return t.tipo==='saida'&&d.getFullYear()===y&&d.getMonth()===mo; }).reduce((s,t)=>s+t.valor,0)+DB.parMensalAtiva();
  const myNome=cfg.nome||'Eu';

  const allMembers=[{id:'__me__',nome:myNome,mesEnt:myEnt,mesSai:mySai,saldo:myEnt-mySai},...members];
  const totEnt=allMembers.reduce((s,m)=>s+m.mesEnt,0);
  const totSai=allMembers.reduce((s,m)=>s+m.mesSai,0);
  const totSaldo=totEnt-totSai;

  const avatarEmojis=['👨','👩','👦','👧','🧑','👴','👵'];

  let html='';

  // Consolidated total
  html+=`<div class="fam-total-card">
    <h3>📊 Consolidado Familiar — ${MESES[mo]} ${y}</h3>
    <div class="fam-total-row"><span>Total de entradas</span><span style="color:var(--green)">${DB.fmt(totEnt)}</span></div>
    <div class="fam-total-row"><span>Total de saídas</span><span style="color:var(--red)">${DB.fmt(totSai)}</span></div>
    <div class="fam-total-row"><span style="font-weight:800;color:var(--text)">Saldo familiar</span><span style="color:${totSaldo>=0?'var(--green)':'var(--red)'}; font-size:18px">${DB.fmt(totSaldo)}</span></div>
  </div>`;

  // Members
  html+=`<div style="margin:0 14px 14px">`;
  allMembers.forEach((m,i)=>{
    const isMe=m.id==='__me__';
    html+=`<div class="fam-member-card">
      <div class="fam-member-head">
        <div class="fam-avatar a${i%4}">${avatarEmojis[i%avatarEmojis.length]}</div>
        <div class="fam-member-info">
          <div class="fam-member-name">${m.nome}${isMe?' <span style="font-size:10px;color:var(--cyan);font-weight:700">(Você)</span>':''}</div>
          <div class="fam-member-sub">${isMe?'Dados em tempo real':'Importado em '+new Date(m.importedAt||Date.now()).toLocaleDateString('pt-BR')}</div>
        </div>
        ${!isMe?`<button class="fam-del-btn" onclick="removerMembro('${m.id}')">🗑</button>`:''}
      </div>
      <div class="fam-member-vals">
        <div class="fam-val-box"><label>Entradas</label><span style="color:var(--green)">${DB.fmtShort(m.mesEnt)}</span></div>
        <div class="fam-val-box"><label>Saídas</label><span style="color:var(--red)">${DB.fmtShort(m.mesSai)}</span></div>
        <div class="fam-val-box"><label>Saldo</label><span style="color:${m.saldo>=0?'var(--green)':'var(--red)'}">${DB.fmtShort(m.saldo)}</span></div>
      </div>
    </div>`;
  });
  html+='</div>';

  if(members.length===0){
    html+=`<div class="fam-section" style="margin-top:0"><div class="fam-empty"><div class="eic">👨‍👩‍👧</div><p>Nenhum membro importado ainda.<br>Compartilhe seu código com a família!</p></div></div>`;
  }

  document.getElementById('famPainel').innerHTML=html;
}

function removerMembro(id){
  if(!confirm('Remover este membro?')) return;
  DB.removeFamMember(id); showToast('🗑 Membro removido'); renderFamilia();
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
  const tipo=document.getElementById('fTipo').value, mes=document.getElementById('fMes').value, busca=document.getElementById('fBusca').value.toLowerCase();
  let all=[];
  if(tipo!=='parcela') all=[...DB.getTx()];
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
    const statusTag=t._status?` · <span style="color:${t._status==='pago'?'var(--green)':t._status==='atrasado'?'var(--red)':'var(--text3)'}">● ${t._status}</span>`:'';
    return `<div class="txi"><div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div><div class="txi-inf"><div class="txi-desc">${t.descricao}</div><div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${statusTag}</div></div><div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>${!t._parId&&t.tipo!=='parcela'?`<button class="del-btn" onclick="delTx('${t.id}')">🗑</button>`:''}</div>`;
  }).join('');
}

// ===== MODAL =====
function openModal(tipo){
  modalType=tipo;
  document.getElementById('txId').value=''; document.getElementById('txTipo').value=tipo;
  document.getElementById('txDesc').value=''; document.getElementById('txVal').value='';
  document.getElementById('txData').value=DB.nowDate(); document.getElementById('txCat').value='Geral';
  document.getElementById('txParc').value='1'; document.getElementById('txRec').value='nenhuma';
  document.getElementById('txObs').value='';
  if(document.getElementById('vTotal')) document.getElementById('vTotal').value='';
  if(document.getElementById('vParc')) document.getElementById('vParc').value='';
  const titles={entrada:'💰 Nova Entrada',saida:'💸 Nova Saída',parcela:'🔄 Novo Parcelamento'};
  document.getElementById('modalTitle').textContent=titles[tipo]||'Nova Transação';
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
  const t=DB.getTx().find(x=>x.id==id); if(!t) return;
  modalType=t.tipo;
  document.getElementById('txId').value=t.id; document.getElementById('txTipo').value=t.tipo;
  document.getElementById('txDesc').value=t.descricao; document.getElementById('txVal').value=t.valor;
  document.getElementById('txData').value=t.data; document.getElementById('txCat').value=t.categoria||'Geral';
  document.getElementById('txRec').value=t.recorrencia||'nenhuma'; document.getElementById('txObs').value=t.obs||'';
  document.getElementById('parcelGrp').style.display='none'; document.getElementById('valDual').style.display='none';
  document.getElementById('valSingle').style.display='block'; document.getElementById('recGrp').style.display='block';
  document.getElementById('typeGrp').style.display='none';
  document.getElementById('modalTitle').textContent=t.tipo==='entrada'?'✏️ Editar Entrada':'✏️ Editar Saída';
  document.getElementById('modal').classList.remove('hidden');
}

function salvar(){
  const id=document.getElementById('txId').value, tipo=document.getElementById('txTipo').value;
  const desc=document.getElementById('txDesc').value.trim(), data=document.getElementById('txData').value;
  const cat=document.getElementById('txCat').value, rec=document.getElementById('txRec').value;
  const obs=document.getElementById('txObs').value.trim();
  if(!desc||!data){ showToast('⚠️ Preencha todos os campos'); return; }
  if(tipo==='parcela'){
    const vTotal=parseFloat(document.getElementById('vTotal').value);
    const vParc=parseFloat(document.getElementById('vParc').value);
    const nParc=parseInt(document.getElementById('txParc').value)||1;
    const parType=document.querySelector('.type-opt.sel-credit,.type-opt.sel-financing,.type-opt.sel-credcard')?.dataset.type||'credcard';
    if(!vTotal&&!vParc){ showToast('Informe o valor total ou da parcela'); return; }
    const valorTotal=vTotal||(vParc*nParc), valorParcela=vParc||(vTotal/nParc);
    DB.addPar({descricao:desc,valorTotal,valorParcela,nParcelas:nParc,data,categoria:cat,tipo:parType,obs});
    showToast(`✅ ${nParc}x ${DB.fmt(valorParcela)} cadastrado!`);
  } else {
    const val=parseFloat(document.getElementById('txVal').value);
    if(!val||val<=0){ showToast('⚠️ Informe um valor válido'); return; }
    const nParc=parseInt(document.getElementById('txParc').value)||1;
    if(tipo==='saida'&&nParc>1){
      DB.addPar({descricao:desc,valorTotal:val,valorParcela:val/nParc,nParcelas:nParc,data,categoria:cat,tipo:'credit',obs});
      showToast(`✅ ${nParc}x ${DB.fmt(val/nParc)} cadastrado!`);
    } else {
      if(id){ DB.updateTx(id,{descricao:desc,valor:val,data,categoria:cat,recorrencia:rec,obs}); showToast('✅ Atualizado!'); }
      else { DB.addTx({tipo,descricao:desc,valor:val,data,categoria:cat,recorrencia:rec,obs}); showToast(tipo==='entrada'?'✅ Entrada salva!':'✅ Saída salva!'); }
    }
  }
  closeModal(); renderAll();
  if(curPage==='entradas') renderEntradas();
  if(curPage==='saidas') renderSaidas();
  if(curPage==='parcelas') renderParcelas();
  if(curPage==='historico') renderHist();
}

function delTx(id){
  if(!confirm('Remover esta transação?')) return;
  DB.removeTx(id); showToast('🗑 Removido'); renderAll();
  if(curPage==='entradas') renderEntradas();
  if(curPage==='saidas') renderSaidas();
  if(curPage==='historico') renderHist();
}

function selectType(el,type){
  document.querySelectorAll('.type-opt').forEach(x=>x.className='type-opt');
  el.classList.add('sel-'+type); el.dataset.type=type;
}
function calcDual(source){
  const n=parseInt(document.getElementById('txParc').value)||1;
  if(source==='total'){ const v=parseFloat(document.getElementById('vTotal').value); if(v&&n) document.getElementById('vParc').value=(v/n).toFixed(2); }
  else if(source==='parc'){ const v=parseFloat(document.getElementById('vParc').value); if(v&&n) document.getElementById('vTotal').value=(v*n).toFixed(2); }
  else { const vT=parseFloat(document.getElementById('vTotal').value),vP=parseFloat(document.getElementById('vParc').value); if(vT&&n) document.getElementById('vParc').value=(vT/n).toFixed(2); else if(vP&&n) document.getElementById('vTotal').value=(vP*n).toFixed(2); }
}

function showToast(msg){
  const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),3000);
}

function setupInstall(){
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBanner').classList.remove('hidden'); });
  document.getElementById('installBtn').addEventListener('click',async()=>{
    if(!deferredPrompt) return; deferredPrompt.prompt();
    const{outcome}=await deferredPrompt.userChoice;
    if(outcome==='accepted') showToast('✅ App instalado!');
    deferredPrompt=null; document.getElementById('installBanner').classList.add('hidden');
  });
  document.getElementById('installClose').addEventListener('click',()=>{ document.getElementById('installBanner').classList.add('hidden'); });
  window.addEventListener('appinstalled',()=>{ showToast('✅ Instalado!'); document.getElementById('installBanner').classList.add('hidden'); });
}

if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }); }

function drawFlow(){ Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)); }

// ===== APP.JS =====
let curPage='dashboard', curPeriod='mes', modalType='', deferredPrompt=null;
let parFilter='todos'; // filter for parcelas tab

// ===== INIT =====
window.addEventListener('load',()=>{
  const prog=document.querySelector('.splash-prog');
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
  const el=document.getElementById('page-'+page);
  if(el) el.classList.add('active');
  const btn=document.querySelector(`.ni[data-page="${page}"]`);
  if(btn) btn.classList.add('active');
  curPage=page;
  if(page==='dashboard') renderDash();
  if(page==='entradas') renderEntradas();
  if(page==='saidas') renderSaidas();
  if(page==='parcelas') renderParcelas();
  if(page==='simulacao') renderSim();
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

// ===== RENDER ALL =====
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

  calcScore(entradas,totalSai,saldo);
  setTimeout(()=>Charts.drawFlow(parseInt(document.getElementById('chartMonths').value||6)),50);
  renderCats(filtered);
  renderRecentTx(tx);
  genSugestoes(entradas,totalSai,saldo);
}

function calcScore(ent,sai,saldo){
  const sv=document.getElementById('scoreVal'), ss=document.getElementById('scoreStatus');
  if(ent===0&&sai===0){ sv.textContent='--'; ss.textContent='Sem dados'; ss.style.color='var(--text3)'; Charts.drawGauge(0); return; }
  let s=0;
  const taxa=ent>0?sai/ent:1;
  if(taxa<=0.5)s+=40; else if(taxa<=0.7)s+=28; else if(taxa<=0.9)s+=12;
  if(saldo>0)s+=30; else if(saldo===0)s+=10;
  if(ent>0)s+=15;
  if(ent>0&&saldo/ent>=0.2)s+=15;
  s=Math.min(100,s);
  sv.textContent=s;
  if(s>=70){ sv.style.color='var(--green)'; ss.textContent='✨ Excelente!'; ss.style.color='var(--green)'; }
  else if(s>=50){ sv.style.color='var(--yellow)'; ss.textContent='⚠️ Atenção'; ss.style.color='var(--yellow)'; }
  else{ sv.style.color='var(--red)'; ss.textContent='🚨 Crítico'; ss.style.color='var(--red)'; }
  Charts.drawGauge(s);
}

function renderCats(filtered){
  const sai=filtered.filter(t=>t.tipo==='saida');
  const cats={};
  sai.forEach(t=>{ cats[t.categoria]=(cats[t.categoria]||0)+t.valor; });
  const total=Object.values(cats).reduce((s,v)=>s+v,0)||1;
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=document.getElementById('catList');
  if(!sorted.length){ el.innerHTML='<div class="empty"><div class="eic">📊</div><p>Sem dados</p></div>'; return; }
  el.innerHTML=sorted.map(([c,v])=>`
    <div class="cat-item">
      <div class="cat-em">${DB.catEmoji(c)}</div>
      <div class="cat-inf">
        <div class="cat-nm">${c}</div>
        <div class="cat-bw"><div class="cat-b" style="width:${(v/total*100).toFixed(1)}%;background:${DB.catColor(c)}"></div></div>
      </div>
      <div class="cat-pc">${(v/total*100).toFixed(0)}%</div>
    </div>`).join('');
}

function renderRecentTx(tx){
  const recent=[...tx].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,5);
  const el=document.getElementById('recentTx');
  if(!recent.length){ el.innerHTML='<div class="empty"><div class="eic">💸</div><p>Nenhuma transação</p></div>'; return; }
  el.innerHTML=recent.map(t=>txHTML(t,false)).join('');
}

function genSugestoes(ent,sai,saldo){
  const suggs=[], alerts=[];
  const taxa=ent>0?sai/ent:0;
  if(ent===0){
    suggs.push({t:'warn',m:'💡 Adicione suas entradas para ver a análise completa.'});
  } else {
    if(taxa>1){ suggs.push({t:'danger',m:`🚨 Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda! Revise urgentemente.`}); alerts.push({t:'danger',m:`Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!`}); }
    else if(taxa>0.8){ suggs.push({t:'warn',m:`⚠️ ${(taxa*100).toFixed(0)}% da renda comprometida. Ideal: até 70%.`}); alerts.push({t:'warn',m:`${(taxa*100).toFixed(0)}% da renda comprometida`}); }
    else if(taxa<=0.5) suggs.push({t:'good',m:`✅ Economizando ${((1-taxa)*100).toFixed(0)}% da renda. Excelente!`});
    else suggs.push({t:'info',m:`📊 ${(taxa*100).toFixed(0)}% da renda comprometida. Meta: abaixo de 70%.`});
  }
  // Parcelas atrasadas
  const atrasadas=DB.getPar().reduce((n,p)=>n+p.pagamentos.filter(s=>s==='atrasado').length,0);
  if(atrasadas>0){ suggs.push({t:'danger',m:`⚠️ Você tem ${atrasadas} parcela(s) em atraso! Regularize o quanto antes.`}); alerts.push({t:'danger',m:`${atrasadas} parcela(s) em atraso`}); }
  if(saldo>0&&ent>0){ const r=(saldo/ent*100).toFixed(0); suggs.push({t: r>=20?'good':'info',m:r>=20?`💰 Sobra de ${r}% da renda — invista em reserva de emergência!`:`🏦 Tente poupar 20% da renda mensalmente.`}); }
  if(!suggs.length) suggs.push({t:'info',m:'💡 Adicione transações para receber análises.'});
  document.getElementById('suggList').innerHTML=suggs.map(s=>`<div class="sugg-item ${s.t}">${s.m}</div>`).join('');
  const badge=document.getElementById('alertBadge'), aList=document.getElementById('alertList');
  if(!alerts.length){ badge.classList.add('hidden'); aList.innerHTML='<div class="alert-item ok"><span>✅</span><span>Tudo sob controle! Nenhum alerta.</span></div>'; }
  else{ badge.textContent=alerts.length; badge.classList.remove('hidden'); aList.innerHTML=alerts.map(a=>`<div class="alert-item ${a.t}"><span>${a.t==='danger'?'🚨':'⚠️'}</span><span>${a.m}</span></div>`).join(''); }
}

function toggleAlerts(){ document.getElementById('alertPanel').classList.toggle('hidden'); }
function closeAlerts(){ document.getElementById('alertPanel').classList.add('hidden'); }

// ===== TX HTML =====
function txHTML(t,showDel=false){
  return `<div class="txi" onclick="${showDel?`editTx('${t.id}')`:''}">
    <div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div>
    <div class="txi-inf">
      <div class="txi-desc">${t.descricao}</div>
      <div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${t.recorrencia&&t.recorrencia!=='nenhuma'?' · 🔄 '+t.recorrencia:''}</div>
    </div>
    <div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>
    ${showDel?`<button class="del-btn" onclick="event.stopPropagation();delTx('${t.id}')">🗑</button>`:''}
  </div>`;
}

// ===== ENTRADAS =====
function renderEntradas(){
  const all=DB.getTx().filter(t=>t.tipo==='entrada');
  document.getElementById('entTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const el=document.getElementById('entList');
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  el.innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💰</div><p>Nenhuma entrada</p></div>';
}

// ===== SAÍDAS =====
function renderSaidas(){
  const all=DB.getTx().filter(t=>t.tipo==='saida');
  document.getElementById('saiTotal').textContent=DB.fmt(all.reduce((s,t)=>s+t.valor,0));
  const el=document.getElementById('saiList');
  const sorted=[...all].sort((a,b)=>new Date(b.data)-new Date(a.data));
  el.innerHTML=sorted.length?sorted.map(t=>txHTML(t,true)).join(''):'<div class="empty"><div class="eic">💸</div><p>Nenhuma saída</p></div>';
}

// ===== PARCELAS =====
function renderParcelas(){
  // Tabs
  const tabsHTML=`
    <div class="par-tabs">
      <button class="par-tab ${parFilter==='todos'?'active':''}" onclick="setParFilter('todos')">Todos</button>
      <button class="par-tab ${parFilter==='credcard'?'active':''}" onclick="setParFilter('credcard')">💳 Crediário</button>
      <button class="par-tab ${parFilter==='financing'?'active':''}" onclick="setParFilter('financing')">🏦 Financ.</button>
      <button class="par-tab ${parFilter==='credit'?'active':''}" onclick="setParFilter('credit')">🔄 Cartão</button>
    </div>`;

  const now=new Date();
  const all=DB.getPar();
  const filtered=parFilter==='todos'?all:all.filter(p=>p.tipo===parFilter);
  let totalMensal=0;
  all.forEach(p=>{
    for(let i=0;i<p.nParcelas;i++){
      const ini=new Date(p.data+'T00:00:00');
      const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
      if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&p.pagamentos[i]!=='pago')
        totalMensal+=p.valorParcela;
    }
  });
  document.getElementById('parTotal').textContent=DB.fmt(totalMensal)+' / mês';

  const el=document.getElementById('parList');
  let html=tabsHTML;
  html+=`<div style="padding:0 14px">`;
  html+=`<button class="fab" style="margin:12px 0" onclick="openModal('parcela')">+ Novo Parcelamento</button>`;

  if(!filtered.length){
    html+='<div class="empty"><div class="eic">🔄</div><p>Nenhum parcelamento</p></div>';
  } else {
    filtered.sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm)).forEach(p=>{
      html+=parCardHTML(p,now);
    });
  }
  html+='</div>';
  el.innerHTML=html;
}

function parCardHTML(p,now){
  const ini=new Date(p.data+'T00:00:00');
  const pagas=p.pagamentos.filter(s=>s==='pago').length;
  const atrasadas=p.pagamentos.filter(s=>s==='atrasado').length;
  const pct=Math.round(pagas/p.nParcelas*100);
  const saldoDevedor=DB.fmt(p.valorTotal-(pagas*p.valorParcela));
  const tc=DB.typeClass(p.tipo), tl=DB.typeLabel(p.tipo);

  // Installment pills
  let pills='';
  for(let i=0;i<p.nParcelas;i++){
    const st=p.pagamentos[i];
    const label=i+1;
    const icons={pago:'✓',atrasado:'!',pendente:''+label,futuro:''+label};
    const d=new Date(ini.getFullYear(),ini.getMonth()+i,1);
    // Is this month in the future?
    const isFuture=d>now&&st==='pendente';
    const cls=isFuture?'futuro':st;
    pills+=`<div class="inst-pill ${cls}" title="Parcela ${label}: ${st}" onclick="toggleParcela('${p.id}',${i})">${icons[cls]||label}</div>`;
  }

  return `<div class="par-card ${tc}">
    <div class="par-head">
      <div>
        <div class="par-title">${p.descricao}</div>
        <div class="par-cat">${DB.catEmoji(p.categoria)} ${p.categoria}</div>
      </div>
      <div style="text-align:right">
        <div class="par-type-badge ${tc}">${tl}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${DB.fmtDate(p.data)}</div>
      </div>
    </div>
    <div class="par-values">
      <div class="par-vbox">
        <label>Parcela mensal</label>
        <span>${DB.fmt(p.valorParcela)}</span>
      </div>
      <div class="par-vbox">
        <label>Saldo devedor</label>
        <span style="color:var(--red)">${saldoDevedor}</span>
      </div>
    </div>
    <div class="par-prog-wrap">
      <div class="par-prog" style="width:${pct}%;background:linear-gradient(90deg,${tc==='credcard'?'#f59e0b,#fb923c':tc==='financing'?'#4da6ff,#22d3ee':'#b57bee,#4da6ff'})"></div>
    </div>
    <div class="inst-legend">
      <div class="legend-item"><div class="legend-dot pago"></div>Pago</div>
      <div class="legend-item"><div class="legend-dot atrasado"></div>Atrasado</div>
      <div class="legend-item"><div class="legend-dot pendente"></div>Pendente</div>
    </div>
    <div class="par-installments">${pills}</div>
    <div class="par-footer">
      <div class="par-info-txt">${pagas}/${p.nParcelas} pagas${atrasadas>0?` · <span style="color:var(--red)">${atrasadas} em atraso</span>`:''}</div>
      <button class="par-del" onclick="delPar('${p.id}')">🗑 Remover</button>
    </div>
  </div>`;
}

function setParFilter(f){ parFilter=f; renderParcelas(); }

function toggleParcela(parId,idx){
  const pars=DB.getPar(), par=pars.find(p=>p.id==parId);
  if(!par) return;
  const cur=par.pagamentos[idx];
  // Cycle: pendente → pago → atrasado → pendente
  const next={pendente:'pago',pago:'atrasado',atrasado:'pendente',futuro:'pago'}[cur]||'pago';
  par.pagamentos[idx]=next;
  DB.updatePar(parId,{pagamentos:par.pagamentos});

  // Se marcou como pago: registra no histórico como saída
  if(next==='pago'){
    const ini=new Date(par.data+'T00:00:00');
    const d=new Date(ini.getFullYear(),ini.getMonth()+idx,1);
    const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    // Check se já existe registro desta parcela paga
    const exists=DB.getTx().some(t=>t._parId==parId&&t._parIdx==idx);
    if(!exists){
      DB.addTx({tipo:'saida',descricao:`${par.descricao} (${idx+1}/${par.nParcelas})`,valor:par.valorParcela,data:dateStr,categoria:par.categoria,recorrencia:'nenhuma',_parId:parId,_parIdx:idx,obs:'Parcela paga'});
    }
    showToast(`✅ Parcela ${idx+1} marcada como paga!`);
  } else if(next==='atrasado'){
    // Remove registro de tx caso exista
    const tx=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx);
    if(tx) DB.removeTx(tx.id);
    showToast(`⚠️ Parcela ${idx+1} marcada como atrasada`);
  } else {
    const tx=DB.getTx().find(t=>t._parId==parId&&t._parIdx==idx);
    if(tx) DB.removeTx(tx.id);
    showToast(`Parcela ${idx+1} pendente`);
  }
  renderParcelas();
  renderDash();
}

function delPar(id){
  if(!confirm('Remover este parcelamento?')) return;
  // Remove tx associadas
  DB.getTx().filter(t=>t._parId==id).forEach(t=>DB.removeTx(t.id));
  DB.removePar(id); showToast('🗑 Parcelamento removido'); renderParcelas(); renderDash();
}

// ===== SIMULAÇÃO =====
function renderSim(){ renderMetas(); }

function calcEco(){
  const meta=parseFloat(document.getElementById('simMeta').value);
  const poup=parseFloat(document.getElementById('simPoup').value);
  const taxa=parseFloat(document.getElementById('simTaxa').value)/100;
  const el=document.getElementById('ecoRes');
  if(!meta||!poup){ showToast('Preencha os campos'); return; }
  let meses=taxa===0?Math.ceil(meta/poup):Math.ceil(Math.log(1+(meta*taxa)/poup)/Math.log(1+taxa));
  const anos=Math.floor(meses/12), mr=meses%12;
  const inv=poup*meses, rend=Math.max(0,meta-inv);
  el.classList.remove('hidden');
  el.innerHTML=`<b style="color:var(--cyan)">📊 Resultado</b><br>Prazo: <strong>${anos>0?anos+' ano(s) e ':''} ${mr} meses</strong><br>Total investido: <strong>${DB.fmt(inv)}</strong><br>Rendimento estimado: <strong>+${DB.fmt(rend)}</strong><br>Meta atingida: <strong>${DB.fmt(meta)}</strong>${meses>120?'<br><br>⚠️ Meta muito longa. Aumente o valor mensal.':''}`;
}

function calcCred(){
  const val=parseFloat(document.getElementById('credVal').value);
  const n=parseInt(document.getElementById('credN').value);
  const taxa=parseFloat(document.getElementById('credTax').value)/100;
  const el=document.getElementById('credRes');
  if(!val||!n){ showToast('Preencha os campos'); return; }
  const parc=taxa===0?val/n:val*(taxa*Math.pow(1+taxa,n))/(Math.pow(1+taxa,n)-1);
  const total=parc*n, juros=total-val, custo=(juros/val*100).toFixed(1);
  el.classList.remove('hidden');
  el.innerHTML=`<b style="color:var(--cyan)">💳 Resultado</b><br>Parcela: <strong>${DB.fmt(parc)}</strong><br>Total pago: <strong>${DB.fmt(total)}</strong><br>Total de juros: <strong>${DB.fmt(juros)}</strong><br>Custo total: <strong>${custo}%</strong>${custo>50?'<br><br>🚨 Custo muito alto! Pesquise outras opções.':custo>20?'<br><br>⚠️ Avalie se vale o custo.':''}`;
}

function addMeta(){
  const nome=document.getElementById('metaNome').value.trim();
  const val=parseFloat(document.getElementById('metaVal').value);
  const data=document.getElementById('metaData').value;
  if(!nome||!val||!data){ showToast('Preencha todos os campos'); return; }
  DB.addMeta({nome,valor:val,data,valorAtual:0});
  document.getElementById('metaNome').value=''; document.getElementById('metaVal').value=''; document.getElementById('metaData').value='';
  renderMetas(); showToast('🎯 Meta adicionada!');
}

function renderMetas(){
  const metas=DB.getMetas(), el=document.getElementById('metasList');
  if(!metas.length){ el.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Nenhuma meta cadastrada</div>'; return; }
  el.innerHTML=metas.map(m=>{
    const hoje=new Date(), alvo=new Date(m.data+'T00:00:00');
    const meses=Math.max(1,Math.round((alvo-hoje)/(1000*60*60*24*30)));
    const porMes=m.valor/meses, pct=Math.min(100,(m.valorAtual/m.valor*100)).toFixed(0);
    return `<div class="meta-card" style="margin-top:12px">
      <div class="meta-nm">🎯 ${m.nome}</div>
      <div class="meta-inf">${DB.fmt(m.valorAtual)} / ${DB.fmt(m.valor)} · Prazo: ${DB.fmtDate(m.data)}<br><span style="color:var(--cyan)">Poupar ${DB.fmt(porMes)}/mês por ${meses} meses</span></div>
      <div class="meta-pw"><div class="meta-pb" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text3)">${pct}% concluída</span>
        <button class="meta-del" onclick="DB.removeMeta('${m.id}');renderMetas()">🗑 Remover</button>
      </div>
    </div>`;
  }).join('');
}

// ===== HISTÓRICO =====
function populateMonths(){
  const sel=document.getElementById('fMes');
  const now=new Date();
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const opt=document.createElement('option');
    opt.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opt.textContent=`${meses[d.getMonth()]} ${d.getFullYear()}`;
    sel.appendChild(opt);
  }
}

function renderHist(){
  const tipo=document.getElementById('fTipo').value;
  const mes=document.getElementById('fMes').value;
  const busca=document.getElementById('fBusca').value.toLowerCase();
  let all=[];
  if(tipo!=='parcela') all=[...DB.getTx().filter(t=>!t._parId||tipo==='saida')]; // show parcela-payments as saida
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
    const statusTag=t._status?` · <span style="color:${t._status==='pago'?'var(--green)':t._status==='atrasado'?'var(--red)':'var(--text3)'}">●${t._status}</span>`:'';
    return `<div class="txi">
      <div class="txi-ic ${t.tipo}">${DB.catEmoji(t.categoria)}</div>
      <div class="txi-inf">
        <div class="txi-desc">${t.descricao}</div>
        <div class="txi-meta">${DB.fmtDate(t.data)} · ${t.categoria}${statusTag}</div>
      </div>
      <div class="txi-amt ${t.tipo}">${t.tipo==='entrada'?'+':'-'}${DB.fmt(t.valor)}</div>
      ${!t._parId&&t.tipo!=='parcela'?`<button class="del-btn" onclick="delTx('${t.id}')">🗑</button>`:''}
    </div>`;
  }).join('');
}

// ===== MODAL =====
function openModal(tipo){
  modalType=tipo;
  document.getElementById('txId').value='';
  document.getElementById('txTipo').value=tipo;
  document.getElementById('txDesc').value='';
  document.getElementById('txVal').value='';
  document.getElementById('txData').value=DB.nowDate();
  document.getElementById('txCat').value='Geral';
  document.getElementById('txParc').value='1';
  document.getElementById('txRec').value='nenhuma';
  document.getElementById('txObs').value='';

  const titles={entrada:'💰 Nova Entrada',saida:'💸 Nova Saída',parcela:'🔄 Novo Parcelamento'};
  document.getElementById('modalTitle').textContent=titles[tipo]||'Nova Transação';

  // Show/hide fields
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
  document.getElementById('txId').value=t.id;
  document.getElementById('txTipo').value=t.tipo;
  document.getElementById('txDesc').value=t.descricao;
  document.getElementById('txVal').value=t.valor;
  document.getElementById('txData').value=t.data;
  document.getElementById('txCat').value=t.categoria||'Geral';
  document.getElementById('txRec').value=t.recorrencia||'nenhuma';
  document.getElementById('txObs').value=t.obs||'';
  document.getElementById('parcelGrp').style.display='none';
  document.getElementById('valDual').style.display='none';
  document.getElementById('valSingle').style.display='block';
  document.getElementById('recGrp').style.display='block';
  document.getElementById('typeGrp').style.display='none';
  document.getElementById('modalTitle').textContent=t.tipo==='entrada'?'✏️ Editar Entrada':'✏️ Editar Saída';
  document.getElementById('modal').classList.remove('hidden');
}

function salvar(){
  const id=document.getElementById('txId').value;
  const tipo=document.getElementById('txTipo').value;
  const desc=document.getElementById('txDesc').value.trim();
  const data=document.getElementById('txData').value;
  const cat=document.getElementById('txCat').value;
  const rec=document.getElementById('txRec').value;
  const obs=document.getElementById('txObs').value.trim();

  if(!desc||!data){ showToast('⚠️ Preencha todos os campos'); return; }

  if(tipo==='parcela'){
    const vTotal=parseFloat(document.getElementById('vTotal').value);
    const vParc=parseFloat(document.getElementById('vParc').value);
    const nParc=parseInt(document.getElementById('txParc').value)||1;
    const parType=document.querySelector('.type-opt.sel-credit,.type-opt.sel-financing,.type-opt.sel-credcard')?.dataset.type||'credcard';
    if(!vTotal&&!vParc){ showToast('Informe o valor total ou da parcela'); return; }
    const valorTotal=vTotal||(vParc*nParc);
    const valorParcela=vParc||(vTotal/nParc);
    DB.addPar({descricao:desc,valorTotal,valorParcela,nParcelas:nParc,data,categoria:cat,tipo:parType,obs});
    showToast(`✅ Parcelamento salvo! ${nParc}x ${DB.fmt(valorParcela)}`);
  } else {
    const val=parseFloat(document.getElementById('txVal').value);
    if(!val||val<=0){ showToast('⚠️ Informe um valor válido'); return; }
    const nParc=parseInt(document.getElementById('txParc').value)||1;
    if((tipo==='saida'||tipo==='parcela')&&nParc>1){
      DB.addPar({descricao:desc,valorTotal:val,valorParcela:val/nParc,nParcelas:nParc,data,categoria:cat,tipo:'credit',obs});
      showToast(`✅ ${nParc}x ${DB.fmt(val/nParc)} cadastrado!`);
    } else {
      if(id){
        DB.updateTx(id,{descricao:desc,valor:val,data,categoria:cat,recorrencia:rec,obs});
        showToast('✅ Atualizado!');
      } else {
        DB.addTx({tipo,descricao:desc,valor:val,data,categoria:cat,recorrencia:rec,obs});
        showToast(tipo==='entrada'?'✅ Entrada salva!':'✅ Saída salva!');
      }
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

// Type selector
function selectType(el,type){
  document.querySelectorAll('.type-opt').forEach(x=>x.className='type-opt');
  el.classList.add('sel-'+type); el.dataset.type=type;
}

// Dual value calc
function calcDual(source){
  const n=parseInt(document.getElementById('txParc').value)||1;
  if(source==='total'){
    const v=parseFloat(document.getElementById('vTotal').value);
    if(v&&n) document.getElementById('vParc').value=(v/n).toFixed(2);
  } else {
    const v=parseFloat(document.getElementById('vParc').value);
    if(v&&n) document.getElementById('vTotal').value=(v*n).toFixed(2);
  }
}

// ===== TOAST =====
function showToast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),3000);
}

// ===== PWA INSTALL =====
function setupInstall(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredPrompt=e;
    document.getElementById('installBanner').classList.remove('hidden');
  });
  document.getElementById('installBtn').addEventListener('click',async()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    const{outcome}=await deferredPrompt.userChoice;
    if(outcome==='accepted') showToast('✅ App instalado!');
    deferredPrompt=null;
    document.getElementById('installBanner').classList.add('hidden');
  });
  document.getElementById('installClose').addEventListener('click',()=>{
    document.getElementById('installBanner').classList.add('hidden');
  });
  window.addEventListener('appinstalled',()=>{ showToast('✅ FinançasFácil instalado!'); document.getElementById('installBanner').classList.add('hidden'); });
}

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}

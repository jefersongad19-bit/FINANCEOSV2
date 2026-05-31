// ===== APP.JS — Main application logic =====

// ===== STATE =====
let currentPage = 'dashboard';
let currentPeriod = 'mes';
let deferredPrompt = null;
let modalType = '';

// ===== INIT =====
window.addEventListener('load', () => {
  // Splash animation
  setTimeout(() => {
    document.getElementById('splash').classList.add('out');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  }, 2000);
});

function initApp() {
  applyTheme();
  setupNavigation();
  setupPeriodButtons();
  populateFilterMonths();
  renderAll();
  checkInstallPrompt();

  // Re-render on resize (for charts)
  window.addEventListener('resize', () => { if (currentPage === 'dashboard') renderDashboard(); });

  // Theme button
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);

  // Alert button
  document.getElementById('notifBtn').addEventListener('click', toggleAlerts);

  // Set today's date as default for txData
  document.getElementById('txData').value = new Date().toISOString().split('T')[0];
}

// ===== THEME =====
function applyTheme() {
  const cfg = DB.getConfig();
  document.documentElement.setAttribute('data-theme', cfg.theme || 'dark');
  document.getElementById('themeBtn').textContent = cfg.theme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const cfg = DB.getConfig();
  cfg.theme = cfg.theme === 'light' ? 'dark' : 'light';
  DB.saveConfig(cfg);
  applyTheme();
  setTimeout(() => Charts.drawFlowChart(parseInt(document.getElementById('chartMonths').value || 6)), 50);
}

// ===== NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => goPage(btn.dataset.page));
  });
}

function goPage(page) {
  // Hide all
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  // Show target
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  const btn = document.querySelector(`[data-page="${page}"]`);
  if (btn) btn.classList.add('active');

  currentPage = page;

  // Render page
  if (page === 'dashboard') renderDashboard();
  if (page === 'entradas') renderEntradas();
  if (page === 'saidas') renderSaidas();
  if (page === 'parcelas') renderParcelas();
  if (page === 'simulacao') renderSimulacao();
  if (page === 'historico') renderHistorico();
}

// ===== PERIOD BUTTONS =====
function setupPeriodButtons() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      renderDashboard();
    });
  });

  document.getElementById('chartMonths').addEventListener('change', e => {
    Charts.drawFlowChart(parseInt(e.target.value));
  });
}

// ===== RENDER ALL =====
function renderAll() {
  renderDashboard();
}

// ===== DASHBOARD =====
function renderDashboard() {
  const transacoes = DB.getTransacoes();
  const filtered = DB.filtrarPorPeriodo(transacoes, currentPeriod);

  const entradas = filtered.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
  const saidas = filtered.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
  const parcelas = DB.parcelasMensaisAtivas(currentPeriod);
  const totalSaidas = saidas + parcelas;
  const saldo = entradas - totalSaidas;

  // Header values
  document.getElementById('saldoDisplay').textContent = DB.formatMoeda(saldo);
  document.getElementById('totalEntradasDisplay').textContent = DB.formatMoeda(entradas);
  document.getElementById('totalSaidasDisplay').textContent = DB.formatMoeda(totalSaidas);

  // Color saldo
  const saldoEl = document.getElementById('saldoDisplay');
  saldoEl.style.background = saldo >= 0
    ? 'linear-gradient(135deg, #4ade80, #22d3ee)'
    : 'linear-gradient(135deg, #f87171, #fb923c)';
  saldoEl.style.webkitBackgroundClip = 'text';
  saldoEl.style.webkitTextFillColor = 'transparent';

  // Quick cards
  document.getElementById('qcEntradas').textContent = DB.formatMoedaShort(entradas);
  document.getElementById('qcSaidas').textContent = DB.formatMoedaShort(totalSaidas);
  document.getElementById('qcParcelas').textContent = DB.formatMoedaShort(parcelas);

  // Score
  calcScore(entradas, totalSaidas, saldo);

  // Chart
  setTimeout(() => Charts.drawFlowChart(parseInt(document.getElementById('chartMonths').value || 6)), 50);

  // Categories
  renderCategorias(filtered);

  // Recent transactions
  renderRecentTx(transacoes);

  // Suggestions & Alerts
  gerarSugestoes(entradas, totalSaidas, saldo, parcelas);
}

function calcScore(entradas, saidas, saldo) {
  let score = 0;
  if (entradas === 0 && saidas === 0) {
    document.getElementById('scoreValue').textContent = '--';
    document.getElementById('scoreStatus').textContent = 'Sem dados';
    document.getElementById('scoreStatus').style.color = 'var(--text3)';
    Charts.drawScoreGauge(0);
    return;
  }

  // Taxa de comprometimento da renda
  const taxa = entradas > 0 ? saidas / entradas : 1;
  if (taxa <= 0.5) score += 40;
  else if (taxa <= 0.7) score += 25;
  else if (taxa <= 0.9) score += 10;
  else score += 0;

  // Saldo positivo
  if (saldo > 0) score += 30;
  else if (saldo === 0) score += 10;

  // Tem entradas registradas
  if (entradas > 0) score += 15;

  // Saldo é >= 20% da renda (boa reserva)
  if (entradas > 0 && saldo / entradas >= 0.2) score += 15;

  score = Math.min(100, score);

  const el = document.getElementById('scoreValue');
  const status = document.getElementById('scoreStatus');
  el.textContent = score;

  if (score >= 70) {
    el.style.color = 'var(--green)';
    status.textContent = '✨ Excelente!';
    status.style.color = 'var(--green)';
  } else if (score >= 50) {
    el.style.color = 'var(--yellow)';
    status.textContent = '⚠️ Atenção';
    status.style.color = 'var(--yellow)';
  } else {
    el.style.color = 'var(--red)';
    status.textContent = '🚨 Crítico';
    status.style.color = 'var(--red)';
  }

  Charts.drawScoreGauge(score);
}

function renderCategorias(filtered) {
  const saidas = filtered.filter(t => t.tipo === 'saida');
  const cats = {};
  saidas.forEach(t => { cats[t.categoria] = (cats[t.categoria] || 0) + t.valor; });

  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const el = document.getElementById('catList');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">📊</div><p>Sem dados de categorias</p></div>';
    return;
  }

  el.innerHTML = sorted.map(([cat, val]) => `
    <div class="cat-item">
      <div class="cat-emoji">${DB.getCatEmoji(cat)}</div>
      <div class="cat-info">
        <div class="cat-name">${cat}</div>
        <div class="cat-bar-wrap">
          <div class="cat-bar" style="width:${(val/total*100).toFixed(1)}%;background:${DB.getCatColor(cat)}"></div>
        </div>
      </div>
      <div class="cat-pct">${(val/total*100).toFixed(0)}%</div>
    </div>
  `).join('');
}

function renderRecentTx(transacoes) {
  const recent = [...transacoes].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
  const el = document.getElementById('recentTx');
  if (recent.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">💸</div><p>Nenhuma transação ainda</p></div>';
    return;
  }
  el.innerHTML = recent.map(t => txHTML(t)).join('');
}

function txHTML(t, showDel = false) {
  return `
    <div class="tx-item" onclick="editTx('${t.id}')">
      <div class="tx-icon ${t.tipo}">${DB.getCatEmoji(t.categoria)}</div>
      <div class="tx-info">
        <div class="tx-desc">${t.descricao}</div>
        <div class="tx-meta">${DB.formatData(t.data)} · ${t.categoria}${t.recorrencia && t.recorrencia !== 'nenhuma' ? ' · 🔄 ' + t.recorrencia : ''}</div>
      </div>
      <div class="tx-amount ${t.tipo}">${t.tipo === 'entrada' ? '+' : '-'}${DB.formatMoeda(t.valor)}</div>
      ${showDel ? `<div class="tx-actions"><button class="tx-del-btn" onclick="event.stopPropagation();deleteTx('${t.id}')">🗑</button></div>` : ''}
    </div>
  `;
}

// ===== SUGGESTIONS & ALERTS =====
function gerarSugestoes(entradas, saidas, saldo, parcelas) {
  const sugestoes = [];
  const alertas = [];
  const taxa = entradas > 0 ? saidas / entradas : 0;

  // Análise de comprometimento
  if (entradas === 0) {
    sugestoes.push({ tipo: 'warn', txt: '💡 Adicione suas fontes de renda para começar a análise completa.' });
  } else {
    if (taxa > 1) {
      sugestoes.push({ tipo: 'danger', txt: `🚨 Atenção! Você está gastando ${((taxa-1)*100).toFixed(0)}% a mais do que ganha. Revise seus gastos urgentemente.` });
      alertas.push({ tipo: 'danger', txt: `Gastos ${((taxa-1)*100).toFixed(0)}% acima da renda!` });
    } else if (taxa > 0.8) {
      sugestoes.push({ tipo: 'warn', txt: `⚠️ Você está comprometendo ${(taxa*100).toFixed(0)}% da renda com despesas. O ideal é até 70%.` });
      alertas.push({ tipo: 'warn', txt: `${(taxa*100).toFixed(0)}% da renda comprometida` });
    } else if (taxa <= 0.5) {
      sugestoes.push({ tipo: 'good', txt: `✅ Excelente! Você está economizando ${((1-taxa)*100).toFixed(0)}% da renda. Continue assim!` });
    } else {
      sugestoes.push({ tipo: 'info', txt: `📊 Você compromete ${(taxa*100).toFixed(0)}% da renda. Tente chegar a 70% para ter mais reserva.` });
    }
  }

  // Parcelas
  if (parcelas > 0 && entradas > 0) {
    const pct = (parcelas / entradas * 100).toFixed(0);
    if (pct > 30) {
      sugestoes.push({ tipo: 'warn', txt: `💳 Parcelas representam ${pct}% da sua renda. Evite novos parcelamentos até quitar os atuais.` });
      alertas.push({ tipo: 'warn', txt: `Parcelas: ${pct}% da renda` });
    } else {
      sugestoes.push({ tipo: 'info', txt: `💳 Parcelas representam ${pct}% da sua renda — dentro de limites saudáveis.` });
    }
  }

  // Saldo positivo
  if (saldo > 0 && entradas > 0) {
    const reserva = (saldo / entradas * 100).toFixed(0);
    if (reserva >= 20) {
      sugestoes.push({ tipo: 'good', txt: `💰 Sobram ${reserva}% da renda este período. Considere investir em CDB ou Tesouro Direto!` });
    } else {
      sugestoes.push({ tipo: 'info', txt: `🏦 Tente poupar pelo menos 20% da renda por mês para construir uma reserva de emergência.` });
    }
  }

  if (sugestoes.length === 0) {
    sugestoes.push({ tipo: 'info', txt: '💡 Adicione transações para receber análises personalizadas das suas finanças.' });
  }

  // Render suggestions
  document.getElementById('suggestionList').innerHTML = sugestoes.map(s =>
    `<div class="sugg-item ${s.tipo}">${s.txt}</div>`
  ).join('');

  // Render alerts
  const badge = document.getElementById('alertBadge');
  const alertList = document.getElementById('alertList');

  if (alertas.length === 0) {
    badge.classList.add('hidden');
    alertList.innerHTML = '<div class="alert-item ok"><span>✅</span><span>Finanças sob controle! Nenhum alerta no momento.</span></div>';
  } else {
    badge.textContent = alertas.length;
    badge.classList.remove('hidden');
    alertList.innerHTML = alertas.map(a =>
      `<div class="alert-item ${a.tipo}"><span>${a.tipo === 'danger' ? '🚨' : '⚠️'}</span><span>${a.txt}</span></div>`
    ).join('');
  }
}

function toggleAlerts() {
  const panel = document.getElementById('alertPanel');
  panel.classList.toggle('hidden');
}

function closeAlerts() {
  document.getElementById('alertPanel').classList.add('hidden');
}

// ===== ENTRADAS =====
function renderEntradas() {
  const all = DB.getTransacoes().filter(t => t.tipo === 'entrada');
  const total = all.reduce((s, t) => s + t.valor, 0);
  document.getElementById('entHeroTotal').textContent = DB.formatMoeda(total);

  const sorted = [...all].sort((a, b) => new Date(b.data) - new Date(a.data));
  const el = document.getElementById('entradasList');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">💰</div><p>Nenhuma entrada cadastrada</p></div>';
    return;
  }
  el.innerHTML = sorted.map(t => txHTML(t, true)).join('');
}

// ===== SAIDAS =====
function renderSaidas() {
  const all = DB.getTransacoes().filter(t => t.tipo === 'saida');
  const total = all.reduce((s, t) => s + t.valor, 0);
  document.getElementById('saiHeroTotal').textContent = DB.formatMoeda(total);

  const sorted = [...all].sort((a, b) => new Date(b.data) - new Date(a.data));
  const el = document.getElementById('saidasList');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">💸</div><p>Nenhuma saída cadastrada</p></div>';
    return;
  }
  el.innerHTML = sorted.map(t => txHTML(t, true)).join('');
}

// ===== PARCELAS =====
function renderParcelas() {
  const all = DB.getParcelas();
  const agora = new Date();
  let totalMensal = 0;

  all.forEach(p => {
    const inicio = new Date(p.data + 'T00:00:00');
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + parseInt(p.parcelas) - 1);
    if (inicio <= agora && agora <= fim) totalMensal += p.valorParcela;
  });

  document.getElementById('parHeroTotal').textContent = DB.formatMoeda(totalMensal) + ' / mês';

  const el = document.getElementById('parcelasList');
  if (all.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">🔄</div><p>Nenhum parcelamento cadastrado</p></div>';
    return;
  }

  el.innerHTML = all.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)).map(p => {
    const inicio = new Date(p.data + 'T00:00:00');
    const total = p.parcelas;
    const agora = new Date();

    let pagas = 0;
    for (let i = 0; i < total; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      if (d <= agora) pagas++;
    }
    pagas = Math.min(pagas, total);
    const pct = (pagas / total * 100).toFixed(0);
    const restantes = total - pagas;

    return `
      <div class="parcela-card">
        <div class="parcela-header">
          <div>
            <div class="parcela-title">${p.descricao}</div>
            <div class="parcela-cat">${DB.getCatEmoji(p.categoria)} ${p.categoria}</div>
          </div>
          <div>
            <div class="parcela-valor">${DB.formatMoeda(p.valorParcela)}/mês</div>
            <div class="parcela-sub">${DB.formatMoeda(p.valorTotal)} total</div>
          </div>
        </div>
        <div class="parcela-progress">
          <div class="parcela-bar" style="width:${pct}%"></div>
        </div>
        <div class="parcela-info">
          <span>${pagas} de ${total} pagas</span>
          <span>${restantes} restantes</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:11px;color:var(--text3)">Início: ${DB.formatData(p.data)}</span>
          <button class="parcela-del" onclick="deleteParcela('${p.id}')">🗑 Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SIMULAÇÃO =====
function renderSimulacao() {
  renderMetas();
}

function calcularSimulacao() {
  const meta = parseFloat(document.getElementById('simMeta').value);
  const poupanca = parseFloat(document.getElementById('simPoupanca').value);
  const taxa = parseFloat(document.getElementById('simTaxa').value) / 100;
  const el = document.getElementById('simResultado');

  if (!meta || !poupanca) { showToast('Preencha os campos'); return; }

  // FV com juros compostos: meses = log(1 + meta*taxa/poupanca) / log(1+taxa)
  let meses;
  if (taxa === 0) {
    meses = Math.ceil(meta / poupanca);
  } else {
    meses = Math.ceil(Math.log(1 + (meta * taxa) / poupanca) / Math.log(1 + taxa));
  }

  const anos = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  const totalInvestido = poupanca * meses;
  const rendimento = meta - totalInvestido;

  el.classList.remove('hidden');
  el.innerHTML = `
    <div style="margin-bottom:8px;font-weight:700;color:var(--cyan)">📊 Resultado da Simulação</div>
    Prazo: <strong>${anos > 0 ? anos + ' ano(s) e ' : ''}${mesesRest} meses</strong><br>
    Total poupado: <strong>${DB.formatMoeda(totalInvestido)}</strong><br>
    Rendimento estimado: <strong>+${DB.formatMoeda(Math.max(0, rendimento))}</strong><br>
    Meta alcançada: <strong>${DB.formatMoeda(meta)}</strong>
    ${meses > 120 ? '<br><br>⚠️ Meta muito longa. Considere aumentar o valor mensal.' : ''}
  `;
}

function calcularCredito() {
  const valor = parseFloat(document.getElementById('credValor').value);
  const parcelas = parseInt(document.getElementById('credParcelas').value);
  const taxa = parseFloat(document.getElementById('credTaxa').value) / 100;
  const el = document.getElementById('credResultado');

  if (!valor || !parcelas) { showToast('Preencha os campos'); return; }

  let parcela;
  if (taxa === 0) {
    parcela = valor / parcelas;
  } else {
    // Price table
    parcela = valor * (taxa * Math.pow(1 + taxa, parcelas)) / (Math.pow(1 + taxa, parcelas) - 1);
  }

  const totalPago = parcela * parcelas;
  const juros = totalPago - valor;
  const custo = (juros / valor * 100).toFixed(1);

  el.classList.remove('hidden');
  el.innerHTML = `
    <div style="margin-bottom:8px;font-weight:700;color:var(--cyan)">💳 Resultado do Crédito</div>
    Parcela mensal: <strong>${DB.formatMoeda(parcela)}</strong><br>
    Total a pagar: <strong>${DB.formatMoeda(totalPago)}</strong><br>
    Total de juros: <strong>${DB.formatMoeda(juros)}</strong><br>
    Custo efetivo: <strong>${custo}%</strong>
    ${custo > 50 ? '<br><br>🚨 Custo muito alto! Pesquise melhores taxas antes de contratar.' : ''}
    ${custo > 20 && custo <= 50 ? '<br><br>⚠️ Avalie se o crédito vale o custo total.' : ''}
  `;
}

function adicionarMeta() {
  const nome = document.getElementById('metaNome').value.trim();
  const valor = parseFloat(document.getElementById('metaValor').value);
  const data = document.getElementById('metaData').value;

  if (!nome || !valor || !data) { showToast('Preencha todos os campos'); return; }

  DB.addMeta({ nome, valor, data, valorAtual: 0 });
  document.getElementById('metaNome').value = '';
  document.getElementById('metaValor').value = '';
  document.getElementById('metaData').value = '';
  renderMetas();
  showToast('Meta adicionada! 🎯');
}

function renderMetas() {
  const metas = DB.getMetas();
  const el = document.getElementById('metasList');
  if (metas.length === 0) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Nenhuma meta cadastrada</div>';
    return;
  }

  const saldo = calcSaldoGlobal();

  el.innerHTML = metas.map(m => {
    // Sugere quanto guardar por mês
    const hoje = new Date();
    const alvo = new Date(m.data + 'T00:00:00');
    const mesesRestantes = Math.max(1, Math.round((alvo - hoje) / (1000 * 60 * 60 * 24 * 30)));
    const porMes = m.valor / mesesRestantes;
    const pct = Math.min(100, (m.valorAtual / m.valor * 100)).toFixed(0);

    return `
      <div class="meta-card">
        <div class="meta-name">🎯 ${m.nome}</div>
        <div class="meta-info">
          ${DB.formatMoeda(m.valorAtual)} / ${DB.formatMoeda(m.valor)} · Prazo: ${DB.formatData(m.data)}<br>
          <span style="color:var(--cyan)">Poupar: ${DB.formatMoeda(porMes)}/mês por ${mesesRestantes} meses</span>
        </div>
        <div class="meta-prog-wrap">
          <div class="meta-prog" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:var(--text3)">${pct}% concluída</span>
          <button class="meta-del" onclick="deleteMeta('${m.id}')">🗑 Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

function calcSaldoGlobal() {
  const t = DB.getTransacoes();
  const ent = t.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0);
  const sai = t.filter(x => x.tipo === 'saida').reduce((s, x) => s + x.valor, 0);
  return ent - sai;
}

// ===== HISTÓRICO =====
function populateFilterMonths() {
  const sel = document.getElementById('filterMes');
  const now = new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    sel.appendChild(opt);
  }
}

function renderHistorico() {
  const tipo = document.getElementById('filterTipo').value;
  const mes = document.getElementById('filterMes').value;
  const busca = document.getElementById('filterBusca').value.toLowerCase();

  let all = [];

  if (tipo !== 'parcela') {
    all = [...DB.getTransacoes()];
  }
  if (tipo === 'parcela' || tipo === 'todos') {
    // Expand parcelas to individual installments visible in history
    DB.getParcelas().forEach(p => {
      const inicio = new Date(p.data + 'T00:00:00');
      for (let i = 0; i < p.parcelas; i++) {
        const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        all.push({
          id: p.id + '_' + i,
          tipo: 'parcela',
          descricao: `${p.descricao} (${i+1}/${p.parcelas})`,
          valor: p.valorParcela,
          data: dateStr,
          categoria: p.categoria
        });
      }
    });
  }

  // Filter tipo
  if (tipo !== 'todos') all = all.filter(t => t.tipo === tipo);

  // Filter mes
  if (mes !== 'todos') all = all.filter(t => t.data && t.data.startsWith(mes));

  // Filter busca
  if (busca) all = all.filter(t => t.descricao.toLowerCase().includes(busca) || (t.categoria||'').toLowerCase().includes(busca));

  // Sort
  all.sort((a, b) => new Date(b.data) - new Date(a.data));

  const el = document.getElementById('historicoList');
  if (all.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">🔍</div><p>Nenhum resultado encontrado</p></div>';
    return;
  }
  el.innerHTML = all.map(t => txHTML(t, t.tipo !== 'parcela')).join('');
}

// ===== MODAL =====
function openModal(tipo) {
  modalType = tipo;
  document.getElementById('txId').value = '';
  document.getElementById('txTipo').value = tipo;
  document.getElementById('txDesc').value = '';
  document.getElementById('txValor').value = '';
  document.getElementById('txData').value = new Date().toISOString().split('T')[0];
  document.getElementById('txCategoria').value = 'Geral';
  document.getElementById('txParcelas').value = '1';
  document.getElementById('txRecorrencia').value = 'nenhuma';
  document.getElementById('txObs').value = '';

  const titles = { entrada: '💰 Nova Entrada', saida: '💸 Nova Saída', parcela: '🔄 Novo Parcelamento' };
  document.getElementById('modalTitle').textContent = titles[tipo] || 'Nova Transação';

  // Show/hide parcel group
  const pg = document.getElementById('parcelGroup');
  pg.classList.toggle('hidden', tipo !== 'parcela' && tipo !== 'saida');
  if (tipo === 'parcela') {
    document.getElementById('parcelGroup').querySelector('label').textContent = 'Número de parcelas';
  } else if (tipo === 'saida') {
    document.getElementById('parcelGroup').querySelector('label').textContent = 'Número de parcelas (1 = à vista)';
  }

  document.getElementById('txModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('txModal').classList.add('hidden');
}

// Close on backdrop click
document.getElementById('txModal').addEventListener('click', e => {
  if (e.target === document.getElementById('txModal')) closeModal();
});

function editTx(id) {
  const t = DB.getTransacoes().find(x => x.id == id);
  if (!t) return;
  modalType = t.tipo;
  document.getElementById('txId').value = t.id;
  document.getElementById('txTipo').value = t.tipo;
  document.getElementById('txDesc').value = t.descricao;
  document.getElementById('txValor').value = t.valor;
  document.getElementById('txData').value = t.data;
  document.getElementById('txCategoria').value = t.categoria || 'Geral';
  document.getElementById('txParcelas').value = t.parcelas || 1;
  document.getElementById('txRecorrencia').value = t.recorrencia || 'nenhuma';
  document.getElementById('txObs').value = t.obs || '';

  const titles = { entrada: '✏️ Editar Entrada', saida: '✏️ Editar Saída', parcela: '✏️ Editar Parcelamento' };
  document.getElementById('modalTitle').textContent = titles[t.tipo] || 'Editar';

  const pg = document.getElementById('parcelGroup');
  pg.classList.toggle('hidden', t.tipo !== 'parcela' && t.tipo !== 'saida');

  document.getElementById('txModal').classList.remove('hidden');
}

function salvarTransacao() {
  const id = document.getElementById('txId').value;
  const tipo = document.getElementById('txTipo').value;
  const desc = document.getElementById('txDesc').value.trim();
  const valor = parseFloat(document.getElementById('txValor').value);
  const data = document.getElementById('txData').value;
  const categoria = document.getElementById('txCategoria').value;
  const numParcelas = parseInt(document.getElementById('txParcelas').value) || 1;
  const recorrencia = document.getElementById('txRecorrencia').value;
  const obs = document.getElementById('txObs').value.trim();

  if (!desc || !valor || !data) { showToast('⚠️ Preencha todos os campos obrigatórios'); return; }
  if (valor <= 0) { showToast('⚠️ Valor deve ser maior que zero'); return; }

  if (tipo === 'parcela' || (tipo === 'saida' && numParcelas > 1)) {
    // Save as parcela
    if (id) DB.removeParcela(id);
    DB.addParcela({
      id: id || undefined,
      descricao: desc,
      valorTotal: valor,
      valorParcela: valor / numParcelas,
      parcelas: numParcelas,
      data,
      categoria,
      obs,
      tipo: 'parcela'
    });
    showToast(`✅ Parcelamento salvo! ${numParcelas}x ${DB.formatMoeda(valor/numParcelas)}`);
  } else {
    // Save as regular transaction
    const arr = DB.getTransacoes();
    if (id) {
      const idx = arr.findIndex(t => t.id == id);
      if (idx >= 0) arr[idx] = { ...arr[idx], descricao: desc, valor, data, categoria, recorrencia, obs };
      DB.saveTransacoes(arr);
    } else {
      DB.addTransacao({ tipo, descricao: desc, valor, data, categoria, recorrencia, obs });
    }
    showToast(tipo === 'entrada' ? '✅ Entrada salva!' : '✅ Saída salva!');
  }

  closeModal();
  renderAll();

  // Re-render current page
  if (currentPage === 'entradas') renderEntradas();
  if (currentPage === 'saidas') renderSaidas();
  if (currentPage === 'parcelas') renderParcelas();
  if (currentPage === 'historico') renderHistorico();
}

function deleteTx(id) {
  if (!confirm('Remover esta transação?')) return;
  DB.removeTransacao(id);
  showToast('🗑 Transação removida');
  renderAll();
  if (currentPage === 'entradas') renderEntradas();
  if (currentPage === 'saidas') renderSaidas();
  if (currentPage === 'historico') renderHistorico();
}

function deleteParcela(id) {
  if (!confirm('Remover este parcelamento?')) return;
  DB.removeParcela(id);
  showToast('🗑 Parcelamento removido');
  renderAll();
  renderParcelas();
}

function deleteMeta(id) {
  DB.removeMeta(id);
  showToast('🗑 Meta removida');
  renderMetas();
}

// ===== TOAST =====
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ===== PWA INSTALL =====
function checkInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').classList.remove('hidden');
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('✅ App instalado com sucesso!');
    }
    deferredPrompt = null;
    document.getElementById('installBanner').classList.add('hidden');
  });

  document.getElementById('installClose').addEventListener('click', () => {
    document.getElementById('installBanner').classList.add('hidden');
  });
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

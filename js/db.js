// ===== DB.JS — LocalStorage database layer =====
const DB = {
  PREFIX: 'ff_',

  get(key) {
    try { return JSON.parse(localStorage.getItem(this.PREFIX + key)) || []; }
    catch { return []; }
  },

  set(key, val) {
    try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); }
    catch(e) { console.error('Storage error:', e); }
  },

  getObj(key, def = {}) {
    try { return JSON.parse(localStorage.getItem(this.PREFIX + key)) || def; }
    catch { return def; }
  },

  setObj(key, val) {
    try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); }
    catch(e) { console.error('Storage error:', e); }
  },

  // Transações (entradas + saídas normais)
  getTransacoes() { return this.get('transacoes'); },
  saveTransacoes(arr) { this.set('transacoes', arr); },

  addTransacao(t) {
    const arr = this.getTransacoes();
    t.id = t.id || Date.now() + Math.random();
    t.criadoEm = new Date().toISOString();
    arr.push(t);
    this.saveTransacoes(arr);
    return t;
  },

  removeTransacao(id) {
    const arr = this.getTransacoes().filter(t => t.id != id);
    this.saveTransacoes(arr);
  },

  // Parcelamentos
  getParcelas() { return this.get('parcelas'); },
  saveParcelas(arr) { this.set('parcelas', arr); },

  addParcela(p) {
    const arr = this.getParcelas();
    p.id = p.id || Date.now() + Math.random();
    p.criadoEm = new Date().toISOString();
    arr.push(p);
    this.saveParcelas(arr);
    return p;
  },

  removeParcela(id) {
    const arr = this.getParcelas().filter(p => p.id != id);
    this.saveParcelas(arr);
  },

  // Metas
  getMetas() { return this.get('metas'); },
  saveMetas(arr) { this.set('metas', arr); },

  addMeta(m) {
    const arr = this.getMetas();
    m.id = m.id || Date.now() + Math.random();
    arr.push(m);
    this.saveMetas(arr);
    return m;
  },

  removeMeta(id) {
    const arr = this.getMetas().filter(m => m.id != id);
    this.saveMetas(arr);
  },

  // Configurações
  getConfig() { return this.getObj('config', { theme: 'dark', nome: 'Família' }); },
  saveConfig(c) { this.setObj('config', c); },

  // ===== HELPERS =====
  formatMoeda(val) {
    return 'R$ ' + Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatMoedaShort(val) {
    const v = Number(val || 0);
    if (v >= 1000) return 'R$ ' + (v/1000).toFixed(1).replace('.', ',') + 'k';
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  formatData(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  },

  mesAtual() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  },

  // Filtra transações por período
  filtrarPorPeriodo(arr, periodo) {
    const now = new Date();
    return arr.filter(t => {
      const d = new Date(t.data + 'T00:00:00');
      if (periodo === 'mes') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (periodo === 'trimestre') {
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        return diff >= 0 && diff < 3;
      }
      if (periodo === 'ano') {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  },

  // Pega parcela mensal ativa no período
  parcelasMensaisAtivas(periodo) {
    const parcelas = this.getParcelas();
    const now = new Date();
    let total = 0;
    parcelas.forEach(p => {
      const inicio = new Date(p.data + 'T00:00:00');
      const fim = new Date(inicio);
      fim.setMonth(fim.getMonth() + parseInt(p.parcelas) - 1);
      // está ativa?
      if (inicio <= now && now <= fim) {
        if (periodo === 'mes') total += p.valorParcela;
        if (periodo === 'trimestre') total += p.valorParcela * 3;
        if (periodo === 'ano') total += p.valorParcela * Math.min(12, p.parcelas);
      }
    });
    return total;
  },

  getCatEmoji(cat) {
    const map = {
      'Alimentação': '🍔', 'Moradia': '🏠', 'Transporte': '🚗',
      'Saúde': '💊', 'Educação': '📚', 'Lazer': '🎮',
      'Vestuário': '👕', 'Salário': '💼', 'Freelance': '💻',
      'Investimentos': '📈', 'Geral': '🔖', 'Outros': '🔖'
    };
    return map[cat] || '💲';
  },

  getCatColor(cat) {
    const map = {
      'Alimentação': '#f87171', 'Moradia': '#60a5fa', 'Transporte': '#fb923c',
      'Saúde': '#4ade80', 'Educação': '#a78bfa', 'Lazer': '#fbbf24',
      'Vestuário': '#f472b6', 'Salário': '#22d3ee', 'Freelance': '#86efac',
      'Investimentos': '#6ee7b7', 'Geral': '#94a3b8', 'Outros': '#94a3b8'
    };
    return map[cat] || '#94a3b8';
  }
};

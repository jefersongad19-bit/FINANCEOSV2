// ===== DB.JS — LocalStorage =====
const DB = {
  P: 'ff2_',
  get(k){ try{return JSON.parse(localStorage.getItem(this.P+k))||[]}catch{return[]} },
  set(k,v){ try{localStorage.setItem(this.P+k,JSON.stringify(v))}catch(e){console.error(e)} },
  getObj(k,d={}){ try{return JSON.parse(localStorage.getItem(this.P+k))||d}catch{return d} },
  setObj(k,v){ try{localStorage.setItem(this.P+k,JSON.stringify(v))}catch(e){console.error(e)} },

  // Transações
  getTx(){ return this.get('tx') },
  saveTx(a){ this.set('tx',a) },
  addTx(t){
    const a=this.getTx();
    t.id=t.id||(Date.now()+Math.random());
    t.criadoEm=new Date().toISOString();
    a.push(t); this.saveTx(a); return t;
  },
  removeTx(id){ this.saveTx(this.getTx().filter(t=>t.id!=id)) },
  updateTx(id,fields){
    const a=this.getTx(); const i=a.findIndex(t=>t.id==id);
    if(i>=0){ a[i]={...a[i],...fields}; this.saveTx(a); }
  },

  // Parcelamentos
  getPar(){ return this.get('par') },
  savePar(a){ this.set('par',a) },
  addPar(p){
    const a=this.getPar();
    p.id=p.id||(Date.now()+Math.random());
    p.criadoEm=new Date().toISOString();
    // pagamentos: array de status por parcela: 'pendente'|'pago'|'atrasado'
    if(!p.pagamentos) p.pagamentos=Array(p.nParcelas).fill('pendente');
    a.push(p); this.savePar(a); return p;
  },
  removePar(id){ this.savePar(this.getPar().filter(p=>p.id!=id)) },
  updatePar(id,fields){
    const a=this.getPar(); const i=a.findIndex(p=>p.id==id);
    if(i>=0){ a[i]={...a[i],...fields}; this.savePar(a); }
  },

  // Metas
  getMetas(){ return this.get('metas') },
  saveMetas(a){ this.set('metas',a) },
  addMeta(m){ const a=this.getMetas(); m.id=Date.now()+Math.random(); a.push(m); this.saveMetas(a); return m },
  removeMeta(id){ this.saveMetas(this.getMetas().filter(m=>m.id!=id)) },

  // Config
  getConfig(){ return this.getObj('cfg',{theme:'dark'}) },
  saveConfig(c){ this.setObj('cfg',c) },

  // ===== HELPERS =====
  fmt(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) },
  fmtShort(v){
    const n=Number(v||0);
    if(n>=1000) return 'R$ '+(n/1000).toFixed(1).replace('.',',')+' k';
    return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  },
  fmtDate(s){ if(!s)return''; const[y,m,d]=s.split('-'); return`${d}/${m}/${y}` },
  nowDate(){ return new Date().toISOString().split('T')[0] },

  filterPeriod(arr,period){
    const now=new Date();
    return arr.filter(t=>{
      const d=new Date(t.data+'T00:00:00');
      if(period==='mes') return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      if(period==='trimestre'){
        const diff=(now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth());
        return diff>=0&&diff<3;
      }
      if(period==='ano') return d.getFullYear()===now.getFullYear();
      return true;
    });
  },

  // Soma parcelas PAGAS no período (diminui saldo)
  parPagasPeriod(period){
    const pars=this.getPar(), now=new Date();
    let total=0;
    pars.forEach(p=>{
      const inicio=new Date(p.data+'T00:00:00');
      for(let i=0;i<p.nParcelas;i++){
        if(p.pagamentos[i]==='pago'){
          const d=new Date(inicio.getFullYear(),inicio.getMonth()+i,1);
          const dd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
          const dummy={data:dd};
          if(this.filterPeriod([dummy],period).length>0) total+=p.valorParcela;
        }
      }
    });
    return total;
  },

  // Parcelas em aberto (pendente+atrasado) no mês atual
  parMensalAtiva(){
    const pars=this.getPar(), now=new Date();
    let total=0;
    pars.forEach(p=>{
      const inicio=new Date(p.data+'T00:00:00');
      for(let i=0;i<p.nParcelas;i++){
        const d=new Date(inicio.getFullYear(),inicio.getMonth()+i,1);
        if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()){
          if(p.pagamentos[i]!=='pago') total+=p.valorParcela;
        }
      }
    });
    return total;
  },

  catEmoji(c){
    return {Alimentação:'🍔',Moradia:'🏠',Transporte:'🚗',Saúde:'💊',Educação:'📚',
      Lazer:'🎮',Vestuário:'👕',Salário:'💼',Freelance:'💻',Investimentos:'📈',Geral:'🔖',Outros:'🔖'}[c]||'💲';
  },
  catColor(c){
    return {Alimentação:'#ff6b6b',Moradia:'#4da6ff',Transporte:'#fb923c',Saúde:'#3ddc84',
      Educação:'#b57bee',Lazer:'#fbbf24',Vestuário:'#f472b6',Salário:'#22d3ee',
      Freelance:'#86efac',Investimentos:'#6ee7b7',Geral:'#7a9bbf',Outros:'#7a9bbf'}[c]||'#7a9bbf';
  },
  typeLabel(t){ return {credcard:'💳 Crediário',financing:'🏦 Financiamento',credit:'🔄 Cartão'}[t]||t },
  typeClass(t){ return {credcard:'credcard',financing:'financing',credit:'credit'}[t]||'' },
};

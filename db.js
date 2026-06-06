// ===== DB.JS v7 =====
const DB = {
  P:'ff2_',
  get(k){ try{return JSON.parse(localStorage.getItem(this.P+k))||[]}catch{return[]} },
  set(k,v){ try{localStorage.setItem(this.P+k,JSON.stringify(v))}catch(e){} },
  getObj(k,d={}){ try{return JSON.parse(localStorage.getItem(this.P+k))||d}catch{return d} },
  setObj(k,v){ try{localStorage.setItem(this.P+k,JSON.stringify(v))}catch(e){} },

  getTx(){ return this.get('tx') },
  saveTx(a){ this.set('tx',a) },
  addTx(t){ const a=this.getTx(); t.id=t.id||(Date.now()+Math.random()); t.criadoEm=new Date().toISOString(); a.push(t); this.saveTx(a); return t; },
  removeTx(id){ this.saveTx(this.getTx().filter(t=>t.id!=id)) },
  updateTx(id,f){ const a=this.getTx(),i=a.findIndex(t=>t.id==id); if(i>=0){a[i]={...a[i],...f};this.saveTx(a);} },

  getPar(){ return this.get('par') },
  savePar(a){ this.set('par',a) },
  addPar(p){
    const a=this.getPar();
    p.id=p.id||(Date.now()+Math.random());
    p.criadoEm=new Date().toISOString();
    if(!p.pagamentos) p.pagamentos=Array(p.nParcelas).fill(null).map(()=>({status:'pendente',dataPagamento:null,valorPago:null}));
    a.push(p); this.savePar(a); return p;
  },
  removePar(id){ this.savePar(this.getPar().filter(p=>p.id!=id)) },
  updatePar(id,f){ const a=this.getPar(),i=a.findIndex(p=>p.id==id); if(i>=0){a[i]={...a[i],...f};this.savePar(a);} },

  getMetas(){ return this.get('metas') },
  saveMetas(a){ this.set('metas',a) },
  addMeta(m){ const a=this.getMetas(); m.id=Date.now()+Math.random(); m.criadoEm=new Date().toISOString(); a.push(m); this.saveMetas(a); return m; },
  removeMeta(id){ this.saveMetas(this.getMetas().filter(m=>m.id!=id)) },
  updateMeta(id,f){ const a=this.getMetas(),i=a.findIndex(m=>m.id==id); if(i>=0){a[i]={...a[i],...f};this.saveMetas(a);} },

  getSonhos(){ return this.get('sonhos') },
  saveSonhos(a){ this.set('sonhos',a) },
  addSonho(s){ const a=this.getSonhos(); s.id=Date.now()+Math.random(); a.push(s); this.saveSonhos(a); return s; },
  removeSonho(id){ this.saveSonhos(this.getSonhos().filter(s=>s.id!=id)) },

  getConfig(){ return this.getObj('cfg',{theme:'dark'}) },
  saveConfig(c){ this.setObj('cfg',c) },

  getFamMembers(){ return this.get('fam_members') },
  saveFamMembers(a){ this.set('fam_members',a) },
  addFamMember(m){ const a=this.getFamMembers(); m.id=Date.now()+Math.random(); m.importedAt=new Date().toISOString(); a.push(m); this.saveFamMembers(a); return m; },
  removeFamMember(id){ this.saveFamMembers(this.getFamMembers().filter(m=>m.id!=id)) },

  // Data de vencimento da parcela i
  parcelaDueDate(par,idx){
    const ini=new Date(par.data+'T00:00:00');
    // Se tem diaVencimento, usa esse dia no mês
    const dia=par.diaVencimento||ini.getDate();
    const d=new Date(ini.getFullYear(),ini.getMonth()+idx,dia);
    return d;
  },

  // Parcelas com vencimento no mês
  parcelasDoMes(ano,mes){
    const result=[];
    this.getPar().forEach(p=>{
      for(let i=0;i<p.nParcelas;i++){
        const due=this.parcelaDueDate(p,i);
        if(due.getFullYear()===ano&&due.getMonth()===mes){
          const pg=p.pagamentos[i]||{status:'pendente'};
          result.push({par:p,idx:i,due,status:pg.status||'pendente',dataPagamento:pg.dataPagamento,valorPago:pg.valorPago});
        }
      }
    });
    return result;
  },

  txDoMes(ano,mes){
    return this.getTx().filter(t=>{
      if(t._parId) return false;
      const d=new Date(t.data+'T00:00:00');
      return d.getFullYear()===ano&&d.getMonth()===mes;
    });
  },

  resumoMes(ano,mes){
    const txMes=this.txDoMes(ano,mes);
    const entradas=txMes.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
    const saidasAvulsas=txMes.filter(t=>t.tipo==='saida').reduce((s,t)=>s+t.valor,0);
    const parMes=this.parcelasDoMes(ano,mes);
    const totalParcelasVenc=parMes.reduce((s,x)=>s+x.par.valorParcela,0);
    const parcelasPagas=parMes.filter(x=>x.status==='pago').reduce((s,x)=>s+(x.valorPago||x.par.valorParcela),0);
    const parcelasAtrasadas=parMes.filter(x=>x.status==='atrasado').reduce((s,x)=>s+x.par.valorParcela,0);
    const parcelasPendentes=parMes.filter(x=>x.status==='pendente').reduce((s,x)=>s+x.par.valorParcela,0);
    const totalSaidasPagas=saidasAvulsas+parcelasPagas;
    const saldoReal=entradas-totalSaidasPagas;
    return {entradas,saidasAvulsas,totalParcelasVenc,parcelasPagas,parcelasAtrasadas,parcelasPendentes,totalSaidasPagas,saldoReal,txEntradas:txMes.filter(t=>t.tipo==='entrada'),txSaidas:txMes.filter(t=>t.tipo==='saida'),parMes};
  },

  resumoPeriodo(periodo){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    let meses=[];
    if(periodo==='mes') meses=[[y,m]];
    else if(periodo==='trimestre'){ for(let i=0;i<3;i++){ const d=new Date(y,m-i,1); meses.push([d.getFullYear(),d.getMonth()]); } }
    else{ for(let i=0;i<12;i++) meses.push([y,i]); }
    const s={entradas:0,totalSaidasPagas:0,parcelasPagas:0,parcelasAtrasadas:0,parcelasPendentes:0,totalParcelasVenc:0,saidasAvulsas:0};
    meses.forEach(([a,mo])=>{ const r=this.resumoMes(a,mo); Object.keys(s).forEach(k=>{ if(k in r) s[k]+=r[k]; }); });
    s.saldoReal=s.entradas-s.totalSaidasPagas;
    return s;
  },

  getPrev(k){ return this.getObj('prev_'+k,{entradas:[],saidas:[]}) },
  savePrev(k,d){ this.setObj('prev_'+k,d) },

  exportMyData(nome){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    const r=this.resumoMes(y,m);
    // Calculate accumulated balance
    const allTx=this.getTx();
    const entHist=allTx.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
    const saiHist=allTx.filter(t=>t.tipo==='saida'&&!t._parId).reduce((s,t)=>s+t.valor,0);
    const parPagasHist=this.getPar().reduce((s,p)=>{
      return s+p.pagamentos.filter(x=>x?.status==='pago').reduce((ps,x)=>ps+(x.valorPago||p.valorParcela),0);
    },0);
    const saldoGeral=entHist-saiHist-parPagasHist;
    const payload={v:4,nome:nome||'Membro',mesEnt:r.entradas,mesSai:r.totalSaidasPagas,parVenc:r.totalParcelasVenc,saldo:r.saldoReal,saldoGeral,exportedAt:new Date().toISOString()};
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  },
  importFamData(code){
    try{ const d=JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if(!d.nome) throw 0; return this.addFamMember(d); }catch{ return null; }
  },

  fmt(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) },
  fmtShort(v){ const n=Number(v||0); if(Math.abs(n)>=1000) return 'R$ '+(n/1000).toFixed(1).replace('.',',')+'k'; return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) },
  fmtDate(s){ if(!s)return''; const[y,m,d]=s.split('-'); return`${d}/${m}/${y}` },
  nowDate(){ return new Date().toISOString().split('T')[0] },
  catEmoji(c){ return{Alimentação:'🍔',Moradia:'🏠',Transporte:'🚗',Saúde:'💊',Educação:'📚',Lazer:'🎮',Vestuário:'👕',Salário:'💼',Freelance:'💻',Investimentos:'📈',Geral:'🔖',Outros:'🔖',Sonhos:'✨',Reserva:'🏦'}[c]||'💲' },
  catColor(c){ return{Alimentação:'#ff6b6b',Moradia:'#4da6ff',Transporte:'#fb923c',Saúde:'#3ddc84',Educação:'#b57bee',Lazer:'#fbbf24',Vestuário:'#f472b6',Salário:'#22d3ee',Freelance:'#86efac',Investimentos:'#6ee7b7',Geral:'#7a9bbf',Outros:'#7a9bbf',Sonhos:'#f59e0b',Reserva:'#3ddc84'}[c]||'#7a9bbf' },
  typeLabel(t){ return{credcard:'💳 Crediário',financing:'🏦 Financiamento',credit:'🔄 Cartão'}[t]||t },
  typeClass(t){ return{credcard:'credcard',financing:'financing',credit:'credit'}[t]||'' },
};

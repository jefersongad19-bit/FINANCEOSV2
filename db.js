// ===== DB.JS v6 — lógica correta de datas e saldos =====
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
    // pagamentos: array com {status, dataPagamento} por parcela
    if(!p.pagamentos) p.pagamentos=Array(p.nParcelas).fill(null).map(()=>({status:'pendente',dataPagamento:null}));
    a.push(p); this.savePar(a); return p;
  },
  removePar(id){ this.savePar(this.getPar().filter(p=>p.id!=id)) },
  updatePar(id,f){ const a=this.getPar(),i=a.findIndex(p=>p.id==id); if(i>=0){a[i]={...a[i],...f};this.savePar(a);} },

  getMetas(){ return this.get('metas') },
  saveMetas(a){ this.set('metas',a) },
  addMeta(m){ const a=this.getMetas(); m.id=Date.now()+Math.random(); a.push(m); this.saveMetas(a); return m; },
  removeMeta(id){ this.saveMetas(this.getMetas().filter(m=>m.id!=id)) },

  getConfig(){ return this.getObj('cfg',{theme:'dark'}) },
  saveConfig(c){ this.setObj('cfg',c) },

  getFamMembers(){ return this.get('fam_members') },
  saveFamMembers(a){ this.set('fam_members',a) },
  addFamMember(m){ const a=this.getFamMembers(); m.id=Date.now()+Math.random(); m.importedAt=new Date().toISOString(); a.push(m); this.saveFamMembers(a); return m; },
  removeFamMember(id){ this.saveFamMembers(this.getFamMembers().filter(m=>m.id!=id)) },

  // ===== CHAVE: data de vencimento de cada parcela =====
  // A parcela i vence em: dataInicio + i meses
  parcelaDueDate(par, idx){
    const ini=new Date(par.data+'T00:00:00');
    return new Date(ini.getFullYear(), ini.getMonth()+idx, ini.getDate());
  },

  // Data efetiva de uma parcela paga = dataPagamento registrada, ou data de vencimento
  parcelaEfectiveDate(par, idx){
    const pg=par.pagamentos[idx];
    if(pg && pg.dataPagamento) return new Date(pg.dataPagamento+'T00:00:00');
    return this.parcelaDueDate(par, idx);
  },

  // Filtra transações normais por ano/mês
  txDoMes(ano, mes){
    return this.getTx().filter(t=>{
      if(t._parId) return false; // parcelas pagas são tratadas separado
      const d=new Date(t.data+'T00:00:00');
      return d.getFullYear()===ano && d.getMonth()===mes;
    });
  },

  // Parcelas com vencimento no mês (independente de pagas ou não)
  parcelasDoMes(ano, mes){
    const result=[];
    this.getPar().forEach(p=>{
      for(let i=0;i<p.nParcelas;i++){
        const due=this.parcelaDueDate(p,i);
        if(due.getFullYear()===ano && due.getMonth()===mes){
          result.push({par:p, idx:i, due, status:p.pagamentos[i]?.status||'pendente', dataPagamento:p.pagamentos[i]?.dataPagamento});
        }
      }
    });
    return result;
  },

  // Parcelas PAGAS no mês (pela data de pagamento efetiva)
  parcelasPagasNoMes(ano, mes){
    const result=[];
    this.getPar().forEach(p=>{
      for(let i=0;i<p.nParcelas;i++){
        const pg=p.pagamentos[i];
        if(pg?.status==='pago' && pg.dataPagamento){
          const d=new Date(pg.dataPagamento+'T00:00:00');
          if(d.getFullYear()===ano && d.getMonth()===mes){
            result.push({par:p, idx:i, valor:p.valorParcela, dataPagamento:pg.dataPagamento});
          }
        }
      }
    });
    return result;
  },

  // Resumo completo de um mês — o que o usuário precisa ver
  resumoMes(ano, mes){
    const txMes=this.txDoMes(ano, mes);
    const entradas=txMes.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+t.valor,0);
    const saidasAvulsas=txMes.filter(t=>t.tipo==='saida').reduce((s,t)=>s+t.valor,0);

    const parMes=this.parcelasDoMes(ano, mes);
    const totalParcelasVenc=parMes.reduce((s,x)=>s+x.par.valorParcela,0);
    const parcelasPagas=parMes.filter(x=>x.status==='pago').reduce((s,x)=>s+x.par.valorParcela,0);
    const parcelasAtrasadas=parMes.filter(x=>x.status==='atrasado').reduce((s,x)=>s+x.par.valorParcela,0);
    const parcelasPendentes=parMes.filter(x=>x.status==='pendente').reduce((s,x)=>s+x.par.valorParcela,0);

    // Saídas pagas = avulsas + parcelas pagas com vencimento neste mês
    const totalSaidasPagas=saidasAvulsas+parcelasPagas;
    const saldoReal=entradas-totalSaidasPagas;
    const compromissoTotal=entradas-(saidasAvulsas+totalParcelasVenc);

    return {
      entradas, saidasAvulsas, totalParcelasVenc,
      parcelasPagas, parcelasAtrasadas, parcelasPendentes,
      totalSaidasPagas, saldoReal, compromissoTotal,
      txEntradas:txMes.filter(t=>t.tipo==='entrada'),
      txSaidas:txMes.filter(t=>t.tipo==='saida'),
      parMes
    };
  },

  // Para período (trimestre/ano) — soma meses
  resumoPeriodo(periodo){
    const now=new Date(), y=now.getFullYear(), m=now.getMonth();
    let meses=[];
    if(periodo==='mes') meses=[[y,m]];
    else if(periodo==='trimestre') meses=[[y,m],[y,m-1<0?11:m-1],[y,m-2<0?m+10:m-2]].map(([a,mo])=>[mo<0?a-1:a,mo<0?mo+12:mo]);
    else if(periodo==='ano'){ for(let i=0;i<12;i++) meses.push([y,i]); }
    const sums={entradas:0,totalSaidasPagas:0,parcelasPagas:0,parcelasAtrasadas:0,parcelasPendentes:0,totalParcelasVenc:0};
    meses.forEach(([a,mo])=>{ const r=this.resumoMes(a,mo); Object.keys(sums).forEach(k=>sums[k]+=r[k]); });
    sums.saldoReal=sums.entradas-sums.totalSaidasPagas;
    return sums;
  },

  getPrev(k){ return this.getObj('prev_'+k,{entradas:[],saidas:[],_loaded:false}) },
  savePrev(k,d){ this.setObj('prev_'+k,d) },

  exportMyData(nome){
    const now=new Date(), y=now.getFullYear(), m=now.getMonth();
    const r=this.resumoMes(y,m);
    const payload={v:3,nome:nome||'Membro',mesEnt:r.entradas,mesSai:r.totalSaidasPagas,parVenc:r.totalParcelasVenc,saldo:r.saldoReal,exportedAt:new Date().toISOString()};
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  },
  importFamData(code){
    try{ const d=JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if(!d.nome) throw 0; return this.addFamMember(d); }
    catch{ return null; }
  },

  // Utils
  fmt(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) },
  fmtShort(v){ const n=Number(v||0); if(Math.abs(n)>=1000) return 'R$ '+(n/1000).toFixed(1).replace('.',',')+'k'; return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) },
  fmtDate(s){ if(!s)return''; const[y,m,d]=s.split('-'); return`${d}/${m}/${y}` },
  nowDate(){ return new Date().toISOString().split('T')[0] },
  catEmoji(c){ return{Alimentação:'🍔',Moradia:'🏠',Transporte:'🚗',Saúde:'💊',Educação:'📚',Lazer:'🎮',Vestuário:'👕',Salário:'💼',Freelance:'💻',Investimentos:'📈',Geral:'🔖',Outros:'🔖'}[c]||'💲' },
  catColor(c){ return{Alimentação:'#ff6b6b',Moradia:'#4da6ff',Transporte:'#fb923c',Saúde:'#3ddc84',Educação:'#b57bee',Lazer:'#fbbf24',Vestuário:'#f472b6',Salário:'#22d3ee',Freelance:'#86efac',Investimentos:'#6ee7b7',Geral:'#7a9bbf',Outros:'#7a9bbf'}[c]||'#7a9bbf' },
  typeLabel(t){ return{credcard:'💳 Crediário',financing:'🏦 Financiamento',credit:'🔄 Cartão'}[t]||t },
  typeClass(t){ return{credcard:'credcard',financing:'financing',credit:'credit'}[t]||'' },
};

DB.getPrev = function(k){ return this.getObj('prev_'+k,{entradas:[],saidas:[]}) };
DB.savePrev = function(k,d){ this.setObj('prev_'+k,d) };

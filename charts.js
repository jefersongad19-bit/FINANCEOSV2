// ===== CHARTS.JS =====
const Charts = {
  drawFlow(months=6){
    const canvas=document.getElementById('flowChart');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const W=canvas.parentElement.clientWidth-36;
    canvas.width=W; canvas.height=140;
    ctx.clearRect(0,0,W,140);

    const isDark=document.documentElement.getAttribute('data-theme')!=='light';
    const gridC=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)';
    const txtC=isDark?'#3d5a7a':'#94a3b8';
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const now=new Date();
    const labels=[],entData=[],saiData=[];

    for(let i=months-1;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const y=d.getFullYear(), m=d.getMonth();
      labels.push(meses[m]);
      let ent=0,sai=0;
      DB.getTx().forEach(t=>{
        const td=new Date(t.data+'T00:00:00');
        if(td.getFullYear()===y&&td.getMonth()===m){
          if(t.tipo==='entrada') ent+=t.valor; else sai+=t.valor;
        }
      });
      // Add parcelas pagas
      DB.getPar().forEach(p=>{
        const ini=new Date(p.data+'T00:00:00');
        for(let j=0;j<p.nParcelas;j++){
          if(p.pagamentos[j]==='pago'){
            const pd=new Date(ini.getFullYear(),ini.getMonth()+j,1);
            if(pd.getFullYear()===y&&pd.getMonth()===m) sai+=p.valorParcela;
          }
        }
      });
      entData.push(ent); saiData.push(sai);
    }

    const all=[...entData,...saiData], maxV=Math.max(...all,1);
    const pad={t:16,b:30,l:8,r:8};
    const ch=140-pad.t-pad.b, cw=W-pad.l-pad.r;
    const bw=cw/labels.length, bi=bw*0.32;

    // Grid
    for(let g=0;g<=4;g++){
      const y=pad.t+(ch/4)*g;
      ctx.beginPath(); ctx.strokeStyle=gridC; ctx.lineWidth=1;
      ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    }

    labels.forEach((lbl,i)=>{
      const x=pad.l+i*bw, cx=x+bw/2;
      // Entrada
      const eH=(entData[i]/maxV)*ch, eY=pad.t+ch-eH;
      const g1=ctx.createLinearGradient(0,eY,0,eY+eH);
      g1.addColorStop(0,'rgba(61,220,132,0.9)'); g1.addColorStop(1,'rgba(61,220,132,0.15)');
      ctx.fillStyle=g1;
      ctx.beginPath(); ctx.roundRect(cx-bi-2,eY,bi,eH,[3,3,0,0]); ctx.fill();
      // Saída
      const sH=(saiData[i]/maxV)*ch, sY=pad.t+ch-sH;
      const g2=ctx.createLinearGradient(0,sY,0,sY+sH);
      g2.addColorStop(0,'rgba(255,107,107,0.9)'); g2.addColorStop(1,'rgba(255,107,107,0.15)');
      ctx.fillStyle=g2;
      ctx.beginPath(); ctx.roundRect(cx+2,sY,bi,sH,[3,3,0,0]); ctx.fill();
      // Label
      ctx.fillStyle=txtC; ctx.font='10px Sora,sans-serif'; ctx.textAlign='center';
      ctx.fillText(lbl,cx,140-8);
    });
  },

  drawGauge(score){
    const c=document.getElementById('scoreGauge');
    if(!c) return;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,90,90);
    const cx=45,cy=50,r=34;
    const sa=Math.PI*.75, ea=Math.PI*2.25;
    // BG
    ctx.beginPath(); ctx.arc(cx,cy,r,sa,ea);
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=9; ctx.lineCap='round'; ctx.stroke();
    if(score>0){
      const sc=sa+(score/100)*(ea-sa);
      const g=ctx.createLinearGradient(10,10,80,80);
      if(score>=70){g.addColorStop(0,'#3ddc84');g.addColorStop(1,'#22d3ee')}
      else if(score>=40){g.addColorStop(0,'#fbbf24');g.addColorStop(1,'#fb923c')}
      else{g.addColorStop(0,'#ff6b6b');g.addColorStop(1,'#e05555')}
      ctx.beginPath(); ctx.arc(cx,cy,r,sa,sc);
      ctx.strokeStyle=g; ctx.lineWidth=9; ctx.lineCap='round'; ctx.stroke();
    }
  }
};

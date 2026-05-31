// ===== CHARTS.JS — Canvas charts =====
const Charts = {
  flowChart: null,

  drawFlowChart(months = 6) {
    const canvas = document.getElementById('flowChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 32;
    canvas.width = W;
    canvas.height = 140;
    ctx.clearRect(0, 0, W, 140);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#5a7a96' : '#94a3b8';

    // Build monthly data
    const now = new Date();
    const labels = [];
    const entradas = [];
    const saidas = [];
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    const transacoes = DB.getTransacoes();
    const parcelas = DB.getParcelas();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      labels.push(meses[m]);

      let ent = 0, sai = 0;
      transacoes.forEach(t => {
        const td = new Date(t.data + 'T00:00:00');
        if (td.getFullYear() === y && td.getMonth() === m) {
          if (t.tipo === 'entrada') ent += t.valor;
          else sai += t.valor;
        }
      });
      // Add parcela installments
      parcelas.forEach(p => {
        const inicio = new Date(p.data + 'T00:00:00');
        for (let j = 0; j < p.parcelas; j++) {
          const pd = new Date(inicio.getFullYear(), inicio.getMonth() + j, 1);
          if (pd.getFullYear() === y && pd.getMonth() === m) {
            sai += p.valorParcela;
          }
        }
      });
      entradas.push(ent);
      saidas.push(sai);
    }

    const allVals = [...entradas, ...saidas];
    const maxVal = Math.max(...allVals, 1);
    const pad = { top: 16, bottom: 30, left: 10, right: 10 };
    const chartH = 140 - pad.top - pad.bottom;
    const chartW = W - pad.left - pad.right;
    const barW = chartW / labels.length;
    const barInner = barW * 0.35;

    // Grid lines
    for (let g = 0; g <= 4; g++) {
      const y = pad.top + (chartH / 4) * g;
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Draw bars
    labels.forEach((label, i) => {
      const x = pad.left + i * barW;
      const centerX = x + barW / 2;

      // Entrada bar
      const eH = (entradas[i] / maxVal) * chartH;
      const eY = pad.top + chartH - eH;
      const grad1 = ctx.createLinearGradient(0, eY, 0, eY + eH);
      grad1.addColorStop(0, 'rgba(74,222,128,0.9)');
      grad1.addColorStop(1, 'rgba(74,222,128,0.2)');
      ctx.fillStyle = grad1;
      this.roundRect(ctx, centerX - barInner - 2, eY, barInner, eH, [3, 3, 0, 0]);

      // Saída bar
      const sH = (saidas[i] / maxVal) * chartH;
      const sY = pad.top + chartH - sH;
      const grad2 = ctx.createLinearGradient(0, sY, 0, sY + sH);
      grad2.addColorStop(0, 'rgba(248,113,113,0.9)');
      grad2.addColorStop(1, 'rgba(248,113,113,0.2)');
      ctx.fillStyle = grad2;
      this.roundRect(ctx, centerX + 2, sY, barInner, sH, [3, 3, 0, 0]);

      // Label
      ctx.fillStyle = textColor;
      ctx.font = '10px Sora, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, centerX, 140 - 8);
    });
  },

  roundRect(ctx, x, y, w, h, radii) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radii);
    ctx.fill();
  },

  drawScoreGauge(score) {
    const canvas = document.getElementById('scoreGauge');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 90, 90);

    const cx = 45, cy = 50, r = 35;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;
    const scoreAngle = startAngle + (score / 100) * totalAngle;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score arc
    if (score > 0) {
      const grad = ctx.createLinearGradient(10, 10, 80, 80);
      if (score >= 70) { grad.addColorStop(0, '#4ade80'); grad.addColorStop(1, '#22d3ee'); }
      else if (score >= 40) { grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, '#f87171'); }
      else { grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#ef4444'); }

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, scoreAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
};

# FinançasFácil – Orçamento Familiar 💰

App PWA completo de gestão de orçamento familiar. Funciona **100% offline** após instalação.

## 🚀 Como hospedar no GitHub Pages

1. Crie um repositório no GitHub (ex: `financasfacil`)
2. Faça upload de **todos os arquivos** desta pasta
3. Vá em **Settings → Pages → Source → main branch → / (root)**
4. Acesse: `https://seu-usuario.github.io/financasfacil`
5. No celular, abra o link e clique em **"Instalar"** para adicionar como app nativo!

## 📱 Funcionalidades

- **Dashboard** com saldo, score financeiro e gráfico de fluxo de caixa
- **Entradas** – Salário, freelance, outras receitas com recorrência
- **Saídas** – Despesas com categorias e parcelamento integrado
- **Parcelas** – Controle completo de parcelamentos com barra de progresso
- **Simulador** – Metas de economia e simulador de crédito (tabela Price)
- **Histórico** – Filtro por tipo, mês e busca por texto
- **Score Financeiro** – Análise automática da saúde financeira
- **Alertas Inteligentes** – Avisos quando gastos ultrapassam limites saudáveis
- **Modo claro/escuro** – Alternância com um toque
- **100% offline** – Service Worker + LocalStorage

## 🛠 Tecnologias

- HTML5 + CSS3 + JavaScript puro (sem frameworks)
- PWA (Progressive Web App) com Service Worker
- LocalStorage para persistência de dados offline
- Canvas API para gráficos nativos
- Web App Manifest para instalação nativa

## 📂 Estrutura

```
/
├── index.html          # App principal
├── manifest.json       # Configuração PWA
├── sw.js               # Service Worker (offline)
├── css/
│   └── app.css         # Estilos completos
├── js/
│   ├── db.js           # Banco de dados local
│   ├── charts.js       # Gráficos em Canvas
│   └── app.js          # Lógica principal
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---
Feito com 💚 para controle financeiro familiar inteligente.

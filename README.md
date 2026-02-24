# Check-in Diário

App para registrar atividades ao longo do dia e gerar o texto formatado pra colar no Slack.

## Deploy na Vercel (mais rápido)

1. Crie um repositório no GitHub e suba esses arquivos:
```bash
git init
git add .
git commit -m "checkin app"
git branch -M main
git remote add origin https://github.com/SEU_USER/checkin-diario.git
git push -u origin main
```

2. Acesse [vercel.com](https://vercel.com), faça login com GitHub
3. Clique **"Add New Project"** → selecione o repositório `checkin-diario`
4. A Vercel detecta o Vite automaticamente → clique **Deploy**
5. Pronto! Você recebe um link tipo `checkin-diario.vercel.app`

## Rodar local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`

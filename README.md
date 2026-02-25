# Check-in Diário

App para registrar atividades ao longo do dia e gerar o texto formatado para colar diretamente no Slack.

## 📋 Sobre

**Check-in Diário** é uma ferramenta prática para organizar e documentar suas atividades do dia de trabalho. Agrupe suas tarefas por categoria, visualize um preview formatado e copie tudo pronto para compartilhar no Slack com um único clique.

### Características principais

- ✅ **Categorias organizadas** - Organize tarefas por seções (Meta, Sustentação, Gestão, Listbuilding, etc.)
- 📝 **Entrada rápida** - Adicione tarefas com um simples Enter
- ⚡ **Quick tasks** - Template de tarefas comuns para ganhar tempo
- 🎯 **Edição inline** - Edite ou remova tarefas rapidamente
- 📋 **Preview em tempo real** - Veja como ficará no Slack antes de copiar
- 💾 **Persistência local** - Dados salvos no navegador (LocalStorage)
- 🎨 **Interface dark mode** - Design minimalista e agradável aos olhos
- ⚙️ **Categorias personalizadas** - Crie suas próprias categorias de trabalho
- 🔄 **Reset diário** - Limite a organização ao dia atual, limpe tudo quando necessário

## 🚀 Como usar

### Instalação

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

A aplicação abrirá em `http://localhost:5173`

### Uso básico

1. **Adicionar tarefas**: Digite a tarefa no campo de entrada e pressione `Enter` ou clique no `+`
2. **Usar templates**: Clique em um "quick task" sugerido para adicionar rápido
3. **Editar**: Clique no ícone ✎ para editar uma tarefa existente
4. **Remover**: Clique no ✕ para remover uma tarefa
5. **Visualizar**: Clique em "Preview" para ver como ficará no Slack
6. **Copiar**: Clique em "⎘ Copiar check-in" para copiar para a área de transferência
7. **Gerenciar categorias**: Clique em "⚙ categorias" para adicionar ou remover seções

## 💻 Stack Tecnológico

- **React** - Interface de usuário
- **Vite** - Build tool rápido e moderno
- **JavaScript** - Lógica da aplicação
- **CSS-in-JS** - Estilização inline
- **LocalStorage** - Persistência de dados

### Dependências principais

```json
{
  "react": "latest",
  "react-dom": "latest"
}
```

## 📁 Estrutura do projeto

```
checkin-app/
├── src/
│   ├── App.jsx          # Componente principal
│   ├── main.jsx         # Entrada da aplicação
│   └── App.css          # Estilos (opcional)
├── index.html           # HTML raiz
├── vite.config.js       # Configuração do Vite
├── package.json         # Dependências
└── README.md            # Este arquivo
```

## 🎯 Funcionalidades em detalhe

### Categorias padrão

O app vem com categorias pré-configuradas, mas você pode personalizá-las:

- **◈ Integração Meta** - Tarefas relacionadas à Meta
- **⚙ Sustentação** - Atividades de manutenção
- **◧ Sistema de Gestão V2** - Tarefas do sistema
- **◫ Listbuilding** - Atividades de geração de leads
- **◰ Max Onboarding** - Onboarding de novos usuários
- **◇ Outros** - Diversas

### Organização de dados

- As tarefas são resetadas **diariamente**
- Os dados são salvos localmente no navegador
- As categorias personalizadas são mantidas entre sessões

## 🔧 Scripts disponíveis

```bash
# Iniciar desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build de produção
npm run preview
```

## 🌙 Design

O app usa um design **dark mode** minimalista com tipografia monospace (JetBrains Mono) para uma estética limpa e moderna. A paleta de cores:

- Background: `#0a0a0b` (preto profundo)
- Text: `#d4d4d8` (cinza claro)
- Accent: `#f59e0b` (âmbar)
- Borders: `#27272a` (cinza escuro)

## 💡 Dicas de uso

- Use "Quick tasks" para padronizar textos repetitivos
- O formato de saída segue um padrão pronto para o Slack
- As atividades são agrupadas por categoria automaticamente
- Não se preocupe em salvar - tudo é salvo automaticamente

## 📝 Licença

Este projeto é de uso pessoal. Sinta-se livre para modificar e adaptar conforme necessário.

## 👤 Autor

Desenvolvido por Henrike Pajares Braga + Claude
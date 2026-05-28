# Kyly Picking (PWA) — Simulador de Coletor Industrial

Sistema WEB responsivo (mobile-first) para rodar no navegador do coletor Datalogic Memor 11 (Android), simulando um app nativo de picking (WMS).

## Stack

- Frontend: React + TypeScript + TailwindCSS
- Backend: Node.js + Express (em `/api`)
- Banco: SQLite em WASM (sql.js) para demo local e deploy na Vercel
- PWA: vite-plugin-pwa (instalável no Android)

## Como executar (local)

1) Instale dependências:

```bash
npm install
```

2) Suba frontend + API:

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/health

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd`:

```bash
"C:\Program Files\nodejs\npm.cmd" run dev
```

## Como usar (barcodes de demonstração)

### Login (Tela 1)

- Supervisor:
  - `SUP-0001` (Bruno Almeida)
  - `SUP-0002` (Patrícia Souza)
  - `ADM-0001` (Lucas Ferreira — Admin)
- Colaborador (Operador):
  - `OP-010` (Ana Martins)
  - `OP-011` (Diego Santos)
  - `OP-012` (Mariana Lima)

### Abrir caixa (Tela 3)

- Papeletas mockadas:
  - `CX-2026-000189`
  - `CX-2026-000190`

### Picking (Tela 4)

O backend identifica a SKU a partir de um bloco numérico com 7 dígitos dentro do código lido.

Exemplos de bipagem de peças:

- `1000079-0001`
- `1000081-0002`
- `1000123-0003`
- `1000201-0004`

## Deploy na Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- API: `api/[...path].ts` (catch-all) atende `/api/*`

Observação: por ser `sql.js` (in-memory), dados podem resetar em cold start no serverless (suficiente para demo).

## Como publicar na Vercel

1) Subir no GitHub

- Crie um repositório no GitHub
- Faça commit do projeto (incluindo `api/`, `src/`, `vercel.json`)
- Faça push para o GitHub

2) Conectar na Vercel

- Acesse https://vercel.com/new
- Importe o repositório do GitHub
- A Vercel deve detectar automaticamente como Vite

3) Configurações de build (sem ajustes manuais)

- Build Command: `npm run build`
- Output Directory: `dist`

4) Deploy

- Clique em Deploy
- A URL pública já vai servir:
  - SPA (React Router) com fallback
  - API em `/api/*`
  - PWA (manifest + service worker)

5) Teste pós-deploy (recomendado)

- Acesse a URL pública em:
  - Android (Samsung Internet/Chrome): “Adicionar à tela inicial”
  - iPhone: abrir no Safari (instalação PWA no iOS pode ter limitações)
  - Desktop: abrir normalmente no navegador

## Documentação solicitada

- MER: [docs/MER.md](docs/MER.md)
- UML básica: [docs/UML.md](docs/UML.md)
- Wireframes: [docs/WIREFRAMES.md](docs/WIREFRAMES.md)
- Manual do usuário: [docs/MANUAL.md](docs/MANUAL.md)

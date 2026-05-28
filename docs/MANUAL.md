# Manual do Usuário — Kyly Picking (Coletor)

## 1) Conceito

O sistema simula um aplicativo nativo de picking industrial no coletor (PWA). A leitura do scanner acontece via “keyboard wedge”: o coletor digita o código e envia ENTER.

Regras importantes do fluxo:

- O “laser” (bipagem) só fica habilitado quando você pressiona “Bipar”.
- Após cada leitura, o sistema desabilita a bipagem automaticamente. Para ler novamente, pressione “Bipar” de novo.
- Feedback obrigatório:
  - Verde: sucesso
  - Vermelho: erro (com modal)
  - Azul: informação
  - Laranja: atenção/alerta
  - Sons industriais e vibração (podem ser desligados em Configurações)

## 2) Tela 1 — Login do Coletor

1. Pressione **Bipar**
2. Leia o **código do supervisor**
3. Pressione **Bipar**
4. Leia o **crachá do colaborador**
5. Com status “Identificação concluída”, pressione **Entrar**

Se ocorrer erro:
- O sistema exibirá modal e feedback vermelho
- Refaça a bipagem (ou use **Limpar**)

## 3) Tela 2 — Menu Principal

Opções:

- **Iniciar Picking**: abrir uma nova caixa pela papeleta
- **Reabrir Caixa Aberta**: retomar um picking em andamento
- **Histórico**: caixas abertas/parciais/finalizadas
- **Configurações**: ligar/desligar sons e vibração
- **Sair**: encerra a sessão no coletor

Perfis:
- Supervisor: vê a tela de produtividade (demo)
- Admin: vê cadastros (demo)

## 4) Tela 3 — Abrir Caixa

1. Pressione **Bipar**
2. Leia a **papeleta** (ex.: `CX-2026-000189`)
3. Após o carregamento, pressione **Iniciar Coleta**

O sistema mostra:
- número da caixa
- pedido
- peças totais
- progresso atual

## 5) Tela 4 — Picking (principal)

O sistema mostra sempre o item atual em destaque:
- ENDEREÇO
- REFERÊNCIA (SKU)
- COR
- TAMANHO
- QUANTIDADE (coletado / requerido)

### 5.1 Bipagem de peça

1. Pressione **Bipar**
2. Leia a etiqueta da peça

O sistema reage automaticamente:

- **Peça correta (quantidade parcial)**:
  - pisca verde
  - 1 bip curto
  - vibração curta
  - atualiza contador parcial

- **SKU concluída**:
  - pisca verde forte
  - 2 bipes
  - vibração curta (dupla)
  - carrega automaticamente o próximo endereço

- **Erros** (modal obrigatório):
  - “SKU não pertence à caixa”
  - “Peça sem saldo”
  - “Peça já utilizada”
  - feedback vermelho, som contínuo ~2s e vibração longa
  - pressione **Continuar** para retomar

### 5.2 Item em falta

Use o botão **Retirar Item em Falta** quando não encontrar a peça no endereço.

O sistema pergunta:

- “Deseja visualizar outros endereços?”
  - **SIM**: mostra tabela de localizações alternativas (endereço + saldo)
  - **NÃO**: marca como “em falta” e segue o fluxo

## 6) Tela 5 — Finalização

Cenários:

- **CAIXA FINALIZADA** (100% coletado):
  - som de finalização
  - feedback verde
  - pressione **Confirmar**

- **CAIXA COM PICKING PARCIAL**:
  - feedback laranja
  - opções:
    - **Salvar Parcial**: encerra a caixa como parcial
    - **Continuar depois**: sai sem encerrar (você poderá reabrir pelo menu)

## 7) Tela 6 — Reabrir Caixa

1. Pressione **Bipar**
2. Leia a papeleta
3. Se status estiver ABERTA, pressione **Retomar Coleta**

## 8) Configurações

- Sons: liga/desliga beeps
- Vibração: liga/desliga vibração


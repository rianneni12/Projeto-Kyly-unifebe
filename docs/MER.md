# MER (Modelo Entidade-Relacionamento) — Kyly Picking

## Entidades (tabelas)

### usuarios
- id (PK)
- nome
- cracha_code (UNIQUE)
- tipo: OPERADOR | SUPERVISOR | ADMIN
- ativo (0/1)

### supervisores
- id (PK)
- user_id (FK -> usuarios.id, UNIQUE)
- setor

### caixas
- id (PK)
- papeleta_code (UNIQUE)
- status: ABERTA | FINALIZADA | PARCIAL
- operador_user_id (FK -> usuarios.id)
- criada_em
- fechada_em
- pecas_total
- pecas_picked

### pedidos
- id (PK)
- caixa_id (FK -> caixas.id, UNIQUE)
- numero_pedido
- cliente
- prioridade

### skus
- id (PK)
- ref (UNIQUE)
- cor
- tamanho
- descricao
- saldo

### enderecos
- id (PK)
- sku_ref (UNIQUE composto com endereco)
- endereco
- qtd_disponivel

### itens_pedido
- id (PK)
- caixa_id (FK -> caixas.id)
- sku_ref (ref da SKU)
- endereco
- qtd_requerida
- qtd_picked
- status: PENDENTE | EM_FALTA | CONCLUIDO
- ordem

### historico_bipagens
- id (PK)
- caixa_id (FK -> caixas.id)
- operador_user_id (FK -> usuarios.id)
- tipo (ex.: PECA_OK, ITEM_EM_FALTA, CAIXA_ENCERRADA)
- codigo (conteúdo bipada)
- criado_em

### historico_erros
- id (PK)
- caixa_id (FK -> caixas.id)
- operador_user_id (FK -> usuarios.id)
- erro (mensagem)
- codigo (conteúdo bipada)
- criado_em

### caixas_parciais
- id (PK)
- caixa_id (FK -> caixas.id, UNIQUE)
- snapshot_json
- atualizado_em

### produtividade
- id (PK)
- operador_user_id (FK -> usuarios.id, UNIQUE)
- caixas_finalizadas
- pecas_coletadas
- erros
- tempo_total_seg
- tempo_medio_seg

## Relacionamentos (cardinalidade)

- usuarios (1) — (0..1) supervisores
- usuarios (1) — (N) caixas (como operador_user_id)
- caixas (1) — (1) pedidos
- caixas (1) — (N) itens_pedido
- caixas (1) — (N) historico_bipagens
- caixas (1) — (N) historico_erros
- caixas (1) — (0..1) caixas_parciais
- usuarios (1) — (1) produtividade

## Observação de domínio (picking)

- A “papeleta” identifica a caixa no fluxo (abrir/reabrir).
- A bipagem de peças registra no histórico e impede reutilização do mesmo código na mesma caixa.
- O endereço principal do item está em itens_pedido.endereco; enderecos guarda localizações alternativas por SKU.


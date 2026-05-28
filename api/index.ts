import cors from 'cors'
import express from 'express'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'
import { z } from 'zod'

type Db = import('sql.js').Database

type Session = {
  token: string
  supervisorUserId: number
  operatorUserId: number
  role: 'OPERADOR' | 'SUPERVISOR' | 'ADMIN'
  createdAtIso: string
}

type ApiErrorCode =
  | 'INVALID_SESSION'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'SKU_NOT_IN_BOX'
  | 'NO_STOCK'
  | 'ALREADY_USED'
  | 'BOX_ALREADY_CLOSED'

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; details?: unknown } }

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

const sessions = new Map<string, Session>()

let dbPromise: Promise<Db> | null = null

function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', async (_req, res) => {
    res.json({ ok: true, data: { status: 'ok' } } satisfies ApiResult<{ status: 'ok' }>)
  })

  app.post('/api/auth/login', async (req, res) => {
    const schema = z.object({
      supervisorCode: z.string().min(1),
      operatorCode: z.string().min(1),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json(
          apiErr('VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten()),
        )
      return
    }

    const db = await getDb()

    const supervisor = findUserByBadge(db, parsed.data.supervisorCode)
    const operator = findUserByBadge(db, parsed.data.operatorCode)

    if (!supervisor || (supervisor.tipo !== 'SUPERVISOR' && supervisor.tipo !== 'ADMIN')) {
      res.status(401).json(apiErr('NOT_FOUND', 'Supervisor não encontrado.'))
      return
    }

    if (!operator || operator.tipo !== 'OPERADOR') {
      res.status(401).json(apiErr('NOT_FOUND', 'Colaborador não encontrado.'))
      return
    }

    const token = createToken()
    const session: Session = {
      token,
      supervisorUserId: supervisor.id,
      operatorUserId: operator.id,
      role: supervisor.tipo,
      createdAtIso: new Date().toISOString(),
    }
    sessions.set(token, session)

    res.json(
      apiOk({
        token,
        supervisor: { id: supervisor.id, nome: supervisor.nome, tipo: supervisor.tipo },
        operador: { id: operator.id, nome: operator.nome, tipo: operator.tipo },
      }),
    )
  })

  app.get('/api/session/me', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const db = await getDb()
    const supervisor = findUserById(db, session.supervisorUserId)
    const operador = findUserById(db, session.operatorUserId)
    if (!supervisor || !operador) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    res.json(
      apiOk({
        token: session.token,
        role: session.role,
        supervisor: { id: supervisor.id, nome: supervisor.nome, tipo: supervisor.tipo },
        operador: { id: operador.id, nome: operador.nome, tipo: operador.tipo },
      }),
    )
  })

  app.post('/api/boxes/open', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const schema = z.object({ papeletaCode: z.string().min(1) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json(apiErr('VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten()))
      return
    }

    const db = await getDb()

    const box = ensureBoxForPapeleta(db, parsed.data.papeletaCode, session.operatorUserId)
    const view = getBoxView(db, box.id)

    res.json(apiOk(view))
  })

  app.post('/api/picking/scan', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const schema = z.object({
      boxId: z.number().int().positive(),
      code: z.string().min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json(apiErr('VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten()))
      return
    }

    const db = await getDb()
    const box = getBoxById(db, parsed.data.boxId)
    if (!box) {
      res.status(404).json(apiErr('NOT_FOUND', 'Caixa não encontrada.'))
      return
    }

    if (box.status !== 'ABERTA') {
      res.status(409).json(apiErr('BOX_ALREADY_CLOSED', 'Caixa já está encerrada.'))
      return
    }

    const pieceCode = parsed.data.code.trim()
    if (hasPieceBeenUsed(db, box.id, pieceCode)) {
      insertError(db, box.id, session.operatorUserId, 'Peça já utilizada', pieceCode)
      res.status(409).json(apiErr('ALREADY_USED', 'Peça já utilizada.'))
      return
    }

    const skuRef = parseSkuReference(pieceCode)
    if (!skuRef) {
      insertError(db, box.id, session.operatorUserId, 'SKU não pertence à caixa', pieceCode)
      res.status(409).json(apiErr('SKU_NOT_IN_BOX', 'SKU não pertence à caixa.'))
      return
    }

    const item = findItemInBoxByRef(db, box.id, skuRef)
    if (!item) {
      insertError(db, box.id, session.operatorUserId, 'SKU não pertence à caixa', pieceCode)
      res.status(409).json(apiErr('SKU_NOT_IN_BOX', 'SKU não pertence à caixa.'))
      return
    }

    const sku = findSkuByRef(db, skuRef)
    if (!sku || sku.saldo <= 0) {
      insertError(db, box.id, session.operatorUserId, 'Peça sem saldo', pieceCode)
      res.status(409).json(apiErr('NO_STOCK', 'Peça sem saldo.'))
      return
    }

    if (item.qtd_picked >= item.qtd_requerida) {
      insertError(db, box.id, session.operatorUserId, 'Peça já utilizada', pieceCode)
      res.status(409).json(apiErr('ALREADY_USED', 'Peça já utilizada.'))
      return
    }

    incrementPicked(db, item.id)
    decrementSaldo(db, sku.id)
    insertBipagem(db, box.id, session.operatorUserId, 'PECA_OK', pieceCode)

    const view = getBoxView(db, box.id)
    const updatedItem = view.itens.find((i) => i.id === item.id) ?? null
    const done = updatedItem ? updatedItem.qtd_picked >= updatedItem.qtd_requerida : false

    res.json(
      apiOk({
        result: done ? 'SKU_CONCLUIDA' : 'PARCIAL_OK',
        box: view,
        item: updatedItem,
        nextItem: view.itemAtual,
      }),
    )
  })

  app.post('/api/picking/missing', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const schema = z.object({
      boxId: z.number().int().positive(),
      itemId: z.number().int().positive(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json(apiErr('VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten()))
      return
    }

    const db = await getDb()
    const item = findItemById(db, parsed.data.itemId)
    if (!item || item.caixa_id !== parsed.data.boxId) {
      res.status(404).json(apiErr('NOT_FOUND', 'Item não encontrado.'))
      return
    }

    markItemMissing(db, item.id)
    insertBipagem(db, item.caixa_id, session.operatorUserId, 'ITEM_EM_FALTA', item.sku_ref)

    const alternatives = getAlternativeLocations(db, item.sku_ref, item.endereco)
    const view = getBoxView(db, item.caixa_id)

    res.json(
      apiOk({
        box: view,
        alternatives,
      }),
    )
  })

  app.post('/api/boxes/finalize', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const schema = z.object({
      boxId: z.number().int().positive(),
      mode: z.enum(['FINAL', 'PARCIAL']),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json(apiErr('VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten()))
      return
    }

    const db = await getDb()
    const box = getBoxById(db, parsed.data.boxId)
    if (!box) {
      res.status(404).json(apiErr('NOT_FOUND', 'Caixa não encontrada.'))
      return
    }

    if (box.status !== 'ABERTA') {
      res.status(409).json(apiErr('BOX_ALREADY_CLOSED', 'Caixa já está encerrada.'))
      return
    }

    const view = getBoxView(db, box.id)
    const missing = view.itens.filter((i) => i.status === 'EM_FALTA').length
    const pending = view.itens.filter((i) => i.qtd_picked < i.qtd_requerida && i.status !== 'EM_FALTA')
      .length

    const isFullyDone = pending === 0 && missing === 0
    const finalMode = parsed.data.mode

    if (finalMode === 'FINAL' && !isFullyDone) {
      res.status(409).json(apiErr('VALIDATION_ERROR', 'Caixa não está 100% concluída.'))
      return
    }

    if (finalMode === 'FINAL') {
      closeBox(db, box.id, 'FINALIZADA')
      upsertProdutividade(db, session.operatorUserId, box.id, view.tempoSegundos, view.pecasColetadas, view.erros)
    } else {
      closeBox(db, box.id, 'PARCIAL')
      savePartialSnapshot(db, box.id, JSON.stringify(view))
    }

    insertBipagem(db, box.id, session.operatorUserId, 'CAIXA_ENCERRADA', finalMode)
    res.json(apiOk({ boxId: box.id, status: finalMode }))
  })

  app.get('/api/history', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    const db = await getDb()
    const rows = db.exec(
      `select c.id, c.papeleta_code as papeleta, c.status, c.criada_em as criadaEm, c.fechada_em as fechadaEm,
              u.nome as operador, c.pecas_total as pecasTotal, c.pecas_picked as pecasPicked
         from caixas c
         left join usuarios u on u.id = c.operador_user_id
        order by c.id desc
        limit 100`,
    )

    const data = mapRows(rows)[0] ?? []
    res.json(apiOk(data))
  })

  app.get('/api/metrics/supervisor', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }

    if (session.role === 'OPERADOR') {
      res.status(403).json(apiErr('NOT_FOUND', 'Acesso negado.'))
      return
    }

    const db = await getDb()
    const rows = db.exec(
      `select u.nome as operador, p.caixas_finalizadas as caixas, p.pecas_coletadas as pecas,
              p.erros as erros, p.tempo_medio_seg as tempoMedioSeg
         from produtividade p
         join usuarios u on u.id = p.operador_user_id
        order by p.pecas_coletadas desc
        limit 50`,
    )

    res.json(apiOk(mapRows(rows)[0] ?? []))
  })

  app.get('/api/admin/users', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }
    if (session.role !== 'ADMIN') {
      res.status(403).json(apiErr('NOT_FOUND', 'Acesso negado.'))
      return
    }
    const db = await getDb()
    const rows = db.exec(
      `select id, nome, cracha_code, tipo, ativo
         from usuarios
        order by tipo asc, nome asc`,
    )
    res.json(apiOk(mapRows(rows)[0] ?? []))
  })

  app.get('/api/admin/skus', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }
    if (session.role !== 'ADMIN') {
      res.status(403).json(apiErr('NOT_FOUND', 'Acesso negado.'))
      return
    }
    const db = await getDb()
    const rows = db.exec(
      `select id, ref, cor, tamanho, descricao, saldo
         from skus
        order by ref asc`,
    )
    res.json(apiOk(mapRows(rows)[0] ?? []))
  })

  app.get('/api/admin/addresses', async (req, res) => {
    const session = getSessionFromReq(req)
    if (!session) {
      res.status(401).json(apiErr('INVALID_SESSION', 'Sessão inválida.'))
      return
    }
    if (session.role !== 'ADMIN') {
      res.status(403).json(apiErr('NOT_FOUND', 'Acesso negado.'))
      return
    }
    const db = await getDb()
    const rows = db.exec(
      `select id, sku_ref, endereco, qtd_disponivel
         from enderecos
        order by sku_ref asc, endereco asc`,
    )
    res.json(apiOk(mapRows(rows)[0] ?? []))
  })

  return app
}

export const app = createApp()

export default function handler(req: express.Request, res: express.Response) {
  return app(req, res)
}

function apiOk<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function apiErr(code: ApiErrorCode, message: string, details?: unknown): ApiResult<never> {
  return { ok: false, error: { code, message, details } }
}

async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmPath })
      const db = new SQL.Database()
      setupSchema(db)
      seedIfNeeded(db)
      ensureDemoData(db)
      return db
    })()
  }
  return dbPromise
}

function setupSchema(db: Db) {
  db.exec(`
    create table if not exists usuarios (
      id integer primary key,
      nome text not null,
      cracha_code text not null unique,
      tipo text not null check (tipo in ('OPERADOR','SUPERVISOR','ADMIN')),
      ativo integer not null default 1
    );

    create table if not exists supervisores (
      id integer primary key,
      user_id integer not null unique,
      setor text,
      foreign key (user_id) references usuarios(id)
    );

    create table if not exists caixas (
      id integer primary key,
      papeleta_code text not null unique,
      status text not null check (status in ('ABERTA','FINALIZADA','PARCIAL')),
      operador_user_id integer not null,
      criada_em text not null,
      fechada_em text,
      pecas_total integer not null default 0,
      pecas_picked integer not null default 0,
      foreign key (operador_user_id) references usuarios(id)
    );

    create table if not exists pedidos (
      id integer primary key,
      caixa_id integer not null unique,
      numero_pedido text not null,
      cliente text not null,
      prioridade integer not null default 1,
      foreign key (caixa_id) references caixas(id)
    );

    create table if not exists skus (
      id integer primary key,
      ref text not null unique,
      cor text not null,
      tamanho text not null,
      descricao text not null,
      saldo integer not null default 0
    );

    create table if not exists enderecos (
      id integer primary key,
      sku_ref text not null,
      endereco text not null,
      qtd_disponivel integer not null default 0,
      unique (sku_ref, endereco)
    );

    create table if not exists itens_pedido (
      id integer primary key,
      caixa_id integer not null,
      sku_ref text not null,
      endereco text not null,
      qtd_requerida integer not null,
      qtd_picked integer not null default 0,
      status text not null default 'PENDENTE' check (status in ('PENDENTE','EM_FALTA','CONCLUIDO')),
      ordem integer not null default 0,
      foreign key (caixa_id) references caixas(id)
    );

    create table if not exists historico_bipagens (
      id integer primary key,
      caixa_id integer not null,
      operador_user_id integer not null,
      tipo text not null,
      codigo text not null,
      criado_em text not null
    );

    create table if not exists historico_erros (
      id integer primary key,
      caixa_id integer not null,
      operador_user_id integer not null,
      erro text not null,
      codigo text not null,
      criado_em text not null
    );

    create table if not exists caixas_parciais (
      id integer primary key,
      caixa_id integer not null unique,
      snapshot_json text not null,
      atualizado_em text not null
    );

    create table if not exists produtividade (
      id integer primary key,
      operador_user_id integer not null unique,
      caixas_finalizadas integer not null default 0,
      pecas_coletadas integer not null default 0,
      erros integer not null default 0,
      tempo_total_seg integer not null default 0,
      tempo_medio_seg integer not null default 0
    );
  `)
}

function seedIfNeeded(db: Db) {
  const count = db.exec(`select count(*) as c from usuarios`)
  const rows = mapRows(count)[0] ?? []
  const c = rows.length ? Number(rows[0].c) : 0
  if (c > 0) return

  const now = new Date().toISOString()

  db.exec(
    `
    insert into usuarios (id, nome, cracha_code, tipo, ativo) values
      (1, 'Bruno Almeida', 'SUP-0001', 'SUPERVISOR', 1),
      (2, 'Patrícia Souza', 'SUP-0002', 'SUPERVISOR', 1),
      (3, 'Lucas Ferreira', 'ADM-0001', 'ADMIN', 1),
      (4, 'Supervisor Demo', 'SUP001', 'SUPERVISOR', 1),
      (10, 'Ana Martins', 'OP-010', 'OPERADOR', 1),
      (11, 'Diego Santos', 'OP-011', 'OPERADOR', 1),
      (12, 'Mariana Lima', 'OP-012', 'OPERADOR', 1),
      (13, 'Operador Demo', 'USER001', 'OPERADOR', 1);

    insert into supervisores (id, user_id, setor) values
      (1, 1, 'Expedição'),
      (2, 2, 'Almoxarifado'),
      (3, 4, 'Demonstração');

    insert into skus (id, ref, cor, tamanho, descricao, saldo) values
      (1, '1000079', 'ÚNICO', '18', 'Suporte metálico 18mm', 120),
      (5, '1000080', 'CINZA', 'U', 'Peça demo 1000080', 90),
      (2, '1000081', 'PRETO', 'P', 'Abraçadeira nylon P', 80),
      (3, '1000123', 'AZUL', 'M', 'Etiqueta técnica M', 60),
      (4, '1000201', 'VERDE', 'G', 'Conjunto fixação G', 40);

    insert into enderecos (sku_ref, endereco, qtd_disponivel) values
      ('1000079', 'A02.01.4A', 45),
      ('1000079', 'A02.01.4B', 30),
      ('1000079', 'B01.03.1C', 45),
      ('1000080', 'A03.01.1A', 40),
      ('1000080', 'A03.01.1B', 50),
      ('1000081', 'A03.02.2A', 30),
      ('1000081', 'A03.02.2B', 50),
      ('1000123', 'C01.01.1A', 20),
      ('1000123', 'C01.01.1B', 40),
      ('1000201', 'D05.04.3A', 20),
      ('1000201', 'D05.04.3B', 20);

    insert into caixas (id, papeleta_code, status, operador_user_id, criada_em, pecas_total, pecas_picked) values
      (100, 'CX-2026-000189', 'ABERTA', 10, '${now}', 6, 0),
      (101, 'CX-2026-000190', 'ABERTA', 11, '${now}', 5, 0),
      (102, 'CX123456', 'ABERTA', 13, '${now}', 3, 0);

    insert into pedidos (id, caixa_id, numero_pedido, cliente, prioridade) values
      (500, 100, 'PED-784512', 'Kyly Confecções', 1),
      (501, 101, 'PED-784513', 'Kyly Confecções', 2),
      (502, 102, 'PED-DEMO-0001', 'Demonstração', 1);

    insert into itens_pedido (id, caixa_id, sku_ref, endereco, qtd_requerida, qtd_picked, status, ordem) values
      (1000, 100, '1000079', 'A02.01.4A', 2, 0, 'PENDENTE', 1),
      (1001, 100, '1000081', 'A03.02.2B', 2, 0, 'PENDENTE', 2),
      (1002, 100, '1000123', 'C01.01.1B', 2, 0, 'PENDENTE', 3),
      (1010, 101, '1000079', 'B01.03.1C', 1, 0, 'PENDENTE', 1),
      (1011, 101, '1000201', 'D05.04.3A', 2, 0, 'PENDENTE', 2),
      (1012, 101, '1000081', 'A03.02.2A', 2, 0, 'PENDENTE', 3),
      (1020, 102, '1000079', 'A02.01.4A', 1, 0, 'PENDENTE', 1),
      (1021, 102, '1000080', 'A03.01.1A', 1, 0, 'PENDENTE', 2),
      (1022, 102, '1000081', 'A03.02.2A', 1, 0, 'PENDENTE', 3);
    `,
  )
}

function ensureDemoData(db: Db) {
  const supervisorCode = 'SUP001'
  const operatorCode = 'USER001'
  const demoBoxCode = 'CX123456'

  if (!findUserByBadge(db, supervisorCode)) {
    db.exec(
      `insert into usuarios (nome, cracha_code, tipo, ativo) values ($n, $c, 'SUPERVISOR', 1)`,
      { $n: 'Supervisor Demo', $c: supervisorCode },
    )
    const supId = getUserIdByBadge(db, supervisorCode)
    if (supId) {
      db.exec(`insert into supervisores (user_id, setor) values ($id, 'Demonstração')`, {
        $id: supId,
      })
    }
  }

  if (!findUserByBadge(db, operatorCode)) {
    db.exec(
      `insert into usuarios (nome, cracha_code, tipo, ativo) values ($n, $c, 'OPERADOR', 1)`,
      { $n: 'Operador Demo', $c: operatorCode },
    )
  }

  ensureSku(db, {
    ref: '1000080',
    cor: 'CINZA',
    tamanho: 'U',
    descricao: 'Peça demo 1000080',
    saldo: 90,
  })

  ensureEndereco(db, { sku_ref: '1000080', endereco: 'A03.01.1A', qtd_disponivel: 40 })
  ensureEndereco(db, { sku_ref: '1000080', endereco: 'A03.01.1B', qtd_disponivel: 50 })

  const opId = getUserIdByBadge(db, operatorCode) ?? 10
  const boxId = getBoxIdByPapeleta(db, demoBoxCode)
  if (!boxId) {
    const now = new Date().toISOString()
    db.exec(
      `insert into caixas (papeleta_code, status, operador_user_id, criada_em, pecas_total, pecas_picked)
       values ($p, 'ABERTA', $op, $now, 3, 0)`,
      { $p: demoBoxCode, $op: opId, $now: now },
    )
    const createdId = getBoxIdByPapeleta(db, demoBoxCode)
    if (createdId) {
      db.exec(
        `insert into pedidos (caixa_id, numero_pedido, cliente, prioridade)
         values ($cid, 'PED-DEMO-0001', 'Demonstração', 1)`,
        { $cid: createdId },
      )
      ensureDemoItems(db, createdId)
    }
  } else {
    ensureDemoItems(db, boxId)
  }
}

function ensureSku(
  db: Db,
  sku: { ref: string; cor: string; tamanho: string; descricao: string; saldo: number },
) {
  const r = db.exec(`select id from skus where ref = $ref limit 1`, { $ref: sku.ref })
  const rows = mapRows(r)[0] ?? []
  if (rows.length) return
  db.exec(
    `insert into skus (ref, cor, tamanho, descricao, saldo) values ($ref, $cor, $tam, $desc, $saldo)`,
    { $ref: sku.ref, $cor: sku.cor, $tam: sku.tamanho, $desc: sku.descricao, $saldo: sku.saldo },
  )
}

function ensureEndereco(
  db: Db,
  e: { sku_ref: string; endereco: string; qtd_disponivel: number },
) {
  const r = db.exec(
    `select id from enderecos where sku_ref = $ref and endereco = $end limit 1`,
    { $ref: e.sku_ref, $end: e.endereco },
  )
  const rows = mapRows(r)[0] ?? []
  if (rows.length) return
  db.exec(
    `insert into enderecos (sku_ref, endereco, qtd_disponivel) values ($ref, $end, $q)`,
    { $ref: e.sku_ref, $end: e.endereco, $q: e.qtd_disponivel },
  )
}

function ensureDemoItems(db: Db, boxId: number) {
  const existing = mapRows(
    db.exec(`select sku_ref as ref from itens_pedido where caixa_id = $id`, { $id: boxId }),
  )[0] as Array<{ ref?: unknown }>
  const refs = new Set((existing ?? []).map((x) => String(x.ref ?? '')))

  const items = [
    { sku_ref: '1000079', endereco: 'A02.01.4A', qtd: 1, ordem: 1 },
    { sku_ref: '1000080', endereco: 'A03.01.1A', qtd: 1, ordem: 2 },
    { sku_ref: '1000081', endereco: 'A03.02.2A', qtd: 1, ordem: 3 },
  ]

  for (const it of items) {
    if (refs.has(it.sku_ref)) continue
    db.exec(
      `insert into itens_pedido (caixa_id, sku_ref, endereco, qtd_requerida, qtd_picked, status, ordem)
       values ($cid, $ref, $end, $q, 0, 'PENDENTE', $ord)`,
      { $cid: boxId, $ref: it.sku_ref, $end: it.endereco, $q: it.qtd, $ord: it.ordem },
    )
  }

  const total = mapRows(
    db.exec(`select sum(qtd_requerida) as t from itens_pedido where caixa_id = $id`, { $id: boxId }),
  )[0]?.[0] as any
  db.exec(`update caixas set pecas_total = $t where id = $id`, { $t: Number(total?.t ?? 0), $id: boxId })
}

function getUserIdByBadge(db: Db, badge: string): number | null {
  const r = db.exec(`select id from usuarios where cracha_code = $c limit 1`, { $c: badge })
  const rows = mapRows(r)[0] ?? []
  if (!rows.length) return null
  return Number((rows[0] as any).id)
}

function getBoxIdByPapeleta(db: Db, papeleta: string): number | null {
  const r = db.exec(`select id from caixas where papeleta_code = $p limit 1`, { $p: papeleta })
  const rows = mapRows(r)[0] ?? []
  if (!rows.length) return null
  return Number((rows[0] as any).id)
}

function createToken() {
  const rnd = Math.random().toString(36).slice(2)
  const ts = Date.now().toString(36)
  return `sess_${ts}_${rnd}`
}

function getSessionFromReq(req: express.Request): Session | null {
  const token = String(req.header('x-session-token') ?? '')
  if (!token) return null
  return sessions.get(token) ?? null
}

function mapRows(result: ReturnType<Db['exec']>) {
  return result.map((r: any) => {
    const out: Array<Record<string, unknown>> = []
    for (const row of r.values) {
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < r.columns.length; i++) obj[r.columns[i]] = row[i]
      out.push(obj)
    }
    return out
  })
}

function findUserByBadge(db: Db, code: string) {
  const r = db.exec(`select id, nome, cracha_code, tipo, ativo from usuarios where cracha_code = $code and ativo = 1`, {
    $code: code.trim(),
  })
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any as { id: number; nome: string; tipo: any }) : null
}

function findUserById(db: Db, id: number) {
  const r = db.exec(`select id, nome, cracha_code, tipo, ativo from usuarios where id = $id and ativo = 1`, {
    $id: id,
  })
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any as { id: number; nome: string; tipo: any }) : null
}

function ensureBoxForPapeleta(db: Db, papeleta: string, operadorUserId: number) {
  const papeletaCode = papeleta.trim()
  const isDemo = papeletaCode === 'CX123456'
  const existing = db.exec(`select id, papeleta_code, status from caixas where papeleta_code = $p`, {
    $p: papeletaCode,
  })
  const rows = mapRows(existing)[0] ?? []
  if (rows.length) return rows[0] as any as { id: number; papeleta_code: string; status: string }

  const now = new Date().toISOString()
  db.exec(
    `insert into caixas (papeleta_code, status, operador_user_id, criada_em, pecas_total, pecas_picked)
     values ($p, 'ABERTA', $op, $now, 0, 0)`,
    { $p: papeletaCode, $op: operadorUserId, $now: now },
  )

  const created = db.exec(`select id, papeleta_code, status from caixas where papeleta_code = $p`, {
    $p: papeletaCode,
  })
  const createdRows = mapRows(created)[0] ?? []
  const box = createdRows[0] as any as { id: number; papeleta_code: string; status: string }

  const pedidoNumero = isDemo ? 'PED-DEMO-0001' : `PED-${String(700000 + box.id).slice(-6)}`
  const cliente = isDemo ? 'Demonstração' : 'Kyly Confecções'
  db.exec(
    `insert into pedidos (caixa_id, numero_pedido, cliente, prioridade) values ($cid, $num, $cli, 1)`,
    { $cid: box.id, $num: pedidoNumero, $cli: cliente },
  )

  const baseItems = isDemo
    ? [
        { sku_ref: '1000079', endereco: 'A02.01.4A', qtd: 1, ordem: 1 },
        { sku_ref: '1000080', endereco: 'A03.01.1A', qtd: 1, ordem: 2 },
        { sku_ref: '1000081', endereco: 'A03.02.2A', qtd: 1, ordem: 3 },
      ]
    : [
        { sku_ref: '1000079', endereco: 'A02.01.4A', qtd: 2, ordem: 1 },
        { sku_ref: '1000081', endereco: 'A03.02.2B', qtd: 2, ordem: 2 },
        { sku_ref: '1000123', endereco: 'C01.01.1B', qtd: 1, ordem: 3 },
      ]

  let total = 0
  for (const it of baseItems) {
    total += it.qtd
    db.exec(
      `insert into itens_pedido (caixa_id, sku_ref, endereco, qtd_requerida, qtd_picked, status, ordem)
       values ($cid, $ref, $end, $q, 0, 'PENDENTE', $ord)`,
      { $cid: box.id, $ref: it.sku_ref, $end: it.endereco, $q: it.qtd, $ord: it.ordem },
    )
  }

  db.exec(`update caixas set pecas_total = $t where id = $id`, { $t: total, $id: box.id })
  return box
}

function getBoxById(db: Db, id: number) {
  const r = db.exec(`select id, papeleta_code as papeleta, status, criada_em as criadaEm, fechada_em as fechadaEm, operador_user_id as operadorUserId from caixas where id = $id`, {
    $id: id,
  })
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any) : null
}

function getBoxView(db: Db, boxId: number) {
  const boxRow = getBoxById(db, boxId)
  const pedido = mapRows(
    db.exec(
      `select id, numero_pedido as numeroPedido, cliente, prioridade from pedidos where caixa_id = $id`,
      { $id: boxId },
    ),
  )[0]?.[0] as any

  const itemsRows = mapRows(
    db.exec(
      `select i.id, i.caixa_id as caixaId, i.sku_ref as skuRef, i.endereco, i.qtd_requerida as qtd_requerida,
              i.qtd_picked as qtd_picked, i.status, i.ordem,
              s.cor, s.tamanho, s.descricao
         from itens_pedido i
         join skus s on s.ref = i.sku_ref
        where i.caixa_id = $id
        order by i.ordem asc`,
      { $id: boxId },
    ),
  )[0] as any[]

  const itens = itemsRows.map((r) => ({
    id: Number(r.id),
    skuRef: String(r.skuRef),
    endereco: String(r.endereco),
    cor: String(r.cor),
    tamanho: String(r.tamanho),
    descricao: String(r.descricao),
    qtd_requerida: Number(r.qtd_requerida),
    qtd_picked: Number(r.qtd_picked),
    status: String(r.status),
    ordem: Number(r.ordem),
  }))

  const total = itens.reduce((acc, i) => acc + i.qtd_requerida, 0)
  const picked = itens.reduce((acc, i) => acc + Math.min(i.qtd_picked, i.qtd_requerida), 0)

  db.exec(`update caixas set pecas_total = $t, pecas_picked = $p where id = $id`, {
    $t: total,
    $p: picked,
    $id: boxId,
  })

  const createdAt = boxRow?.criadaEm ? String(boxRow.criadaEm) : new Date().toISOString()
  const tempoSegundos = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000),
  )

  const errorsCount = mapRows(
    db.exec(`select count(*) as c from historico_erros where caixa_id = $id`, { $id: boxId }),
  )[0]?.[0] as any

  const itemAtual =
    itens.find((i) => i.status === 'PENDENTE' && i.qtd_picked < i.qtd_requerida) ??
    itens.find((i) => i.status === 'EM_FALTA' && i.qtd_picked < i.qtd_requerida) ??
    null

  return {
    id: boxId,
    papeleta: String(boxRow?.papeleta ?? ''),
    status: String(boxRow?.status ?? ''),
    pedido,
    pecasTotal: total,
    pecasColetadas: picked,
    progresso: total ? Math.round((picked / total) * 100) : 0,
    tempoSegundos,
    erros: Number(errorsCount?.c ?? 0),
    itens,
    itemAtual,
  }
}

function parseSkuReference(code: string): string | null {
  const m = code.match(/(\d{7,10})/)
  if (!m) return null
  const ref = m[1].slice(0, 7)
  return ref.length === 7 ? ref : null
}

function findItemInBoxByRef(db: Db, boxId: number, skuRef: string) {
  const r = db.exec(
    `select id, caixa_id as caixa_id, sku_ref as sku_ref, endereco, qtd_requerida as qtd_requerida, qtd_picked as qtd_picked
       from itens_pedido
      where caixa_id = $id and sku_ref = $ref
      order by ordem asc
      limit 1`,
    { $id: boxId, $ref: skuRef },
  )
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any as { id: number; caixa_id: number; sku_ref: string; endereco: string; qtd_requerida: number; qtd_picked: number }) : null
}

function findItemById(db: Db, itemId: number) {
  const r = db.exec(
    `select id, caixa_id as caixa_id, sku_ref as sku_ref, endereco, qtd_requerida as qtd_requerida, qtd_picked as qtd_picked, status
       from itens_pedido
      where id = $id`,
    { $id: itemId },
  )
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any as { id: number; caixa_id: number; sku_ref: string; endereco: string; status: string }) : null
}

function findSkuByRef(db: Db, ref: string) {
  const r = db.exec(`select id, ref, saldo from skus where ref = $ref`, { $ref: ref })
  const rows = mapRows(r)[0] ?? []
  return rows.length ? (rows[0] as any as { id: number; ref: string; saldo: number }) : null
}

function incrementPicked(db: Db, itemId: number) {
  db.exec(`update itens_pedido set qtd_picked = qtd_picked + 1 where id = $id`, { $id: itemId })
  const r = db.exec(`select qtd_picked, qtd_requerida from itens_pedido where id = $id`, { $id: itemId })
  const rows = mapRows(r)[0] ?? []
  if (!rows.length) return
  const picked = Number((rows[0] as any).qtd_picked)
  const required = Number((rows[0] as any).qtd_requerida)
  if (picked >= required) {
    db.exec(`update itens_pedido set status = 'CONCLUIDO' where id = $id`, { $id: itemId })
  }
}

function markItemMissing(db: Db, itemId: number) {
  db.exec(`update itens_pedido set status = 'EM_FALTA' where id = $id`, { $id: itemId })
}

function decrementSaldo(db: Db, skuId: number) {
  db.exec(`update skus set saldo = max(saldo - 1, 0) where id = $id`, { $id: skuId })
}

function hasPieceBeenUsed(db: Db, boxId: number, pieceCode: string) {
  const r = db.exec(
    `select id from historico_bipagens where caixa_id = $id and tipo = 'PECA_OK' and codigo = $c limit 1`,
    { $id: boxId, $c: pieceCode },
  )
  const rows = mapRows(r)[0] ?? []
  return rows.length > 0
}

function insertBipagem(db: Db, boxId: number, operadorUserId: number, tipo: string, codigo: string) {
  db.exec(
    `insert into historico_bipagens (caixa_id, operador_user_id, tipo, codigo, criado_em)
     values ($cid, $op, $t, $c, $now)`,
    { $cid: boxId, $op: operadorUserId, $t: tipo, $c: codigo, $now: new Date().toISOString() },
  )
}

function insertError(db: Db, boxId: number, operadorUserId: number, erro: string, codigo: string) {
  db.exec(
    `insert into historico_erros (caixa_id, operador_user_id, erro, codigo, criado_em)
     values ($cid, $op, $e, $c, $now)`,
    { $cid: boxId, $op: operadorUserId, $e: erro, $c: codigo, $now: new Date().toISOString() },
  )
}

function closeBox(db: Db, boxId: number, status: 'FINALIZADA' | 'PARCIAL') {
  db.exec(`update caixas set status = $s, fechada_em = $now where id = $id`, {
    $s: status,
    $now: new Date().toISOString(),
    $id: boxId,
  })
}

function savePartialSnapshot(db: Db, boxId: number, snapshotJson: string) {
  db.exec(
    `insert into caixas_parciais (caixa_id, snapshot_json, atualizado_em)
     values ($id, $json, $now)
     on conflict(caixa_id) do update set snapshot_json = excluded.snapshot_json, atualizado_em = excluded.atualizado_em`,
    { $id: boxId, $json: snapshotJson, $now: new Date().toISOString() },
  )
}

function upsertProdutividade(
  db: Db,
  operadorUserId: number,
  boxId: number,
  tempoSegundos: number,
  pecasColetadas: number,
  erros: number,
) {
  const existing = mapRows(
    db.exec(`select id, caixas_finalizadas as caixas, pecas_coletadas as pecas, erros, tempo_total_seg as tempoTotal from produtividade where operador_user_id = $id`, {
      $id: operadorUserId,
    }),
  )[0]?.[0] as any

  const caixas = Number(existing?.caixas ?? 0) + 1
  const pecas = Number(existing?.pecas ?? 0) + pecasColetadas
  const totalSeg = Number(existing?.tempoTotal ?? 0) + tempoSegundos
  const totalErros = Number(existing?.erros ?? 0) + erros
  const tempoMedio = caixas ? Math.round(totalSeg / caixas) : 0

  db.exec(
    `insert into produtividade (operador_user_id, caixas_finalizadas, pecas_coletadas, erros, tempo_total_seg, tempo_medio_seg)
     values ($id, $c, $p, $e, $t, $m)
     on conflict(operador_user_id) do update set
       caixas_finalizadas = excluded.caixas_finalizadas,
       pecas_coletadas = excluded.pecas_coletadas,
       erros = excluded.erros,
       tempo_total_seg = excluded.tempo_total_seg,
       tempo_medio_seg = excluded.tempo_medio_seg`,
    { $id: operadorUserId, $c: caixas, $p: pecas, $e: totalErros, $t: totalSeg, $m: tempoMedio },
  )

  void boxId
}

function getAlternativeLocations(db: Db, skuRef: string, currentAddress: string) {
  const r = db.exec(
    `select endereco, qtd_disponivel as qtdDisponivel
       from enderecos
      where sku_ref = $ref and endereco <> $cur and qtd_disponivel > 0
      order by qtd_disponivel desc
      limit 10`,
    { $ref: skuRef, $cur: currentAddress },
  )
  return mapRows(r)[0] ?? []
}

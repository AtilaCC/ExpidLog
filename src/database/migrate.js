// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Database Migration v2 (Fase 12)
// ══════════════════════════════════════════════════════
// Usage:
//   node src/database/migrate.js          → run migrations
//   node src/database/migrate.js --fresh  → drop all + recreate

require('dotenv').config();
const { pool } = require('./connection');
const logger   = require('../utils/logger');

const FRESH = process.argv.includes('--fresh');

// ─────────────────────────────────────────────────────
// DROP ALL (fresh mode)
// ─────────────────────────────────────────────────────
const DROP_ALL = `
  DROP TABLE IF EXISTS
    operacao_logs,
    fotos,
    checklist_itens,
    checklists,
    operacoes,
    docas,
    centros_distribuicao,
    refresh_tokens,
    users,
    planos,
    empresas
  CASCADE;
`;

// ─────────────────────────────────────────────────────
// SCHEMA BASE (já existente — idempotente)
// ─────────────────────────────────────────────────────
const SCHEMA_BASE = `

-- ── EXTENSIONS ───────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── EMPRESAS (multi-tenant root) ─────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        VARCHAR(255) NOT NULL,
  cnpj        VARCHAR(18)  UNIQUE,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  plano       VARCHAR(20)  NOT NULL DEFAULT 'basic'
                           CHECK (plano IN ('basic', 'pro', 'enterprise')),
  ativo       BOOLEAN      NOT NULL DEFAULT true,
  config      JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── USERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'conferente'
                             CHECK (role IN ('superadmin', 'admin', 'supervisor', 'conferente', 'visualizacao')),
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  avatar_url    TEXT,
  ultimo_login  TIMESTAMPTZ,
  config        JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, email)
);

-- ── REFRESH TOKENS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── DOCAS (sem cd_id ainda — adicionado abaixo via ALTER) ──
CREATE TABLE IF NOT EXISTS docas (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero        VARCHAR(20)  NOT NULL,
  descricao     TEXT,
  tipo          VARCHAR(20)  NOT NULL DEFAULT 'carga'
                             CHECK (tipo IN ('carga', 'descarga', 'misto')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'livre'
                             CHECK (status IN ('livre', 'em_operacao', 'bloqueada', 'manutencao')),
  capacidade_kg NUMERIC(12,2),
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  config        JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, numero)
);

-- ── OPERACOES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operacoes (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  doca_id         UUID        NOT NULL REFERENCES docas(id),
  conferente_id   UUID        REFERENCES users(id),
  supervisor_id   UUID        REFERENCES users(id),

  numero_oc       VARCHAR(50)  NOT NULL,
  placa_veiculo   VARCHAR(20),
  transportadora  VARCHAR(255),
  motorista       VARCHAR(255),
  tipo_operacao   VARCHAR(20)  NOT NULL DEFAULT 'descarga'
                               CHECK (tipo_operacao IN ('carga', 'descarga', 'transferencia')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'aguardando'
                               CHECK (status IN ('aguardando', 'em_andamento', 'pausada', 'finalizada', 'cancelada')),

  inicio_previsto TIMESTAMPTZ,
  inicio_real     TIMESTAMPTZ,
  fim_previsto    TIMESTAMPTZ,
  fim_real        TIMESTAMPTZ,

  volumes_previstos  INTEGER,
  volumes_conferidos INTEGER DEFAULT 0,
  peso_kg            NUMERIC(12,2),

  observacoes     TEXT,
  motivo_pausa    TEXT,
  motivo_cancelamento TEXT,

  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── CHECKLISTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklists (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  operacao_id   UUID        NOT NULL REFERENCES operacoes(id) ON DELETE CASCADE,
  conferente_id UUID        REFERENCES users(id),
  tipo          VARCHAR(30)  NOT NULL DEFAULT 'geral'
                             CHECK (tipo IN ('geral', 'entrada', 'saida', 'seguranca', 'qualidade')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  observacoes   TEXT,
  assinatura    TEXT,
  concluido_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── CHECKLIST ITENS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_itens (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id  UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  ordem         INTEGER      NOT NULL DEFAULT 0,
  descricao     TEXT         NOT NULL,
  obrigatorio   BOOLEAN      NOT NULL DEFAULT true,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'ok', 'nao_ok', 'na')),
  observacao    TEXT,
  respondido_em TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── FOTOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fotos (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  operacao_id   UUID        REFERENCES operacoes(id) ON DELETE SET NULL,
  checklist_id  UUID        REFERENCES checklists(id) ON DELETE SET NULL,
  uploader_id   UUID        REFERENCES users(id),
  tipo          VARCHAR(30)  NOT NULL DEFAULT 'evidencia'
                             CHECK (tipo IN ('evidencia', 'avaria', 'documento', 'veiculo', 'carga', 'outro')),
  url           TEXT         NOT NULL,
  url_thumb     TEXT,
  public_id     TEXT,
  nome_arquivo  VARCHAR(255),
  tamanho_bytes INTEGER,
  mime_type     VARCHAR(100),
  descricao     TEXT,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── OPERACAO LOGS (audit trail) ───────────────────────
CREATE TABLE IF NOT EXISTS operacao_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  operacao_id   UUID        REFERENCES operacoes(id) ON DELETE SET NULL,
  user_id       UUID        REFERENCES users(id),
  acao          VARCHAR(100) NOT NULL,
  descricao     TEXT,
  dados_antes   JSONB,
  dados_depois  JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`;

// ─────────────────────────────────────────────────────
// SCHEMA FASE 12 — Multi-CD + Multiempresa Enterprise
// ─────────────────────────────────────────────────────
const SCHEMA_FASE12 = `

-- ── PLANOS SaaS ──────────────────────────────────────
-- Tabela de planos com limites e features configuráveis
CREATE TABLE IF NOT EXISTS planos (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome             VARCHAR(50)  NOT NULL UNIQUE,
  slug             VARCHAR(30)  NOT NULL UNIQUE,
  preco_mensal     NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_usuarios     INTEGER      NOT NULL DEFAULT 5,
  max_docas        INTEGER      NOT NULL DEFAULT 10,
  max_cds          INTEGER      NOT NULL DEFAULT 1,
  max_operacoes_mes INTEGER     NOT NULL DEFAULT 500,
  features         JSONB        NOT NULL DEFAULT '{}',
  ativo            BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Inserir planos padrão (idempotente)
INSERT INTO planos (nome, slug, preco_mensal, max_usuarios, max_docas, max_cds, max_operacoes_mes, features)
VALUES
  ('Basic',      'basic',      0,      5,   10,  1,    500,  '{"ocr":false,"ia":false,"bi":false,"multicd":false}'),
  ('Pro',        'pro',        299,    20,  30,  3,    5000, '{"ocr":true,"ia":false,"bi":true,"multicd":true}'),
  ('Enterprise', 'enterprise', 999,    -1,  -1,  -1,  -1,   '{"ocr":true,"ia":true,"bi":true,"multicd":true,"auditoria":true,"api":true}')
ON CONFLICT (slug) DO UPDATE SET
  preco_mensal     = EXCLUDED.preco_mensal,
  max_usuarios     = EXCLUDED.max_usuarios,
  max_docas        = EXCLUDED.max_docas,
  max_cds          = EXCLUDED.max_cds,
  max_operacoes_mes= EXCLUDED.max_operacoes_mes,
  features         = EXCLUDED.features;

-- ── CENTROS DE DISTRIBUIÇÃO ───────────────────────────
CREATE TABLE IF NOT EXISTS centros_distribuicao (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          VARCHAR(255) NOT NULL,
  codigo        VARCHAR(20)  NOT NULL,
  cidade        VARCHAR(100),
  estado        VARCHAR(2),
  pais          VARCHAR(3)   NOT NULL DEFAULT 'BRA',
  endereco      TEXT,
  cep           VARCHAR(10),
  responsavel   VARCHAR(255),
  telefone      VARCHAR(20),
  timezone      VARCHAR(50)  NOT NULL DEFAULT 'America/Sao_Paulo',
  capacidade_docas INTEGER   NOT NULL DEFAULT 10,
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  config        JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

-- ── ADICIONAR cd_id NA TABELA docas (se não existir) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'docas' AND column_name = 'cd_id'
  ) THEN
    ALTER TABLE docas
      ADD COLUMN cd_id UUID REFERENCES centros_distribuicao(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── ADICIONAR plano_id NA TABELA empresas (se não existir) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empresas' AND column_name = 'plano_id'
  ) THEN
    ALTER TABLE empresas
      ADD COLUMN plano_id UUID REFERENCES planos(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── ADICIONAR campos billing na tabela empresas ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empresas' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE empresas
      ADD COLUMN trial_ends_at  TIMESTAMPTZ,
      ADD COLUMN assinatura_ativa BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN billing_email  VARCHAR(255),
      ADD COLUMN max_usuarios   INTEGER,
      ADD COLUMN max_cds        INTEGER,
      ADD COLUMN max_docas      INTEGER;
  END IF;
END;
$$;

-- ── ADICIONAR cd_id NA TABELA operacoes (se não existir) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operacoes' AND column_name = 'cd_id'
  ) THEN
    ALTER TABLE operacoes
      ADD COLUMN cd_id UUID REFERENCES centros_distribuicao(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── SUPERADMIN EMPRESA SYSTEM ─────────────────────────
-- Empresa especial para superadmins (isolada)
INSERT INTO empresas (nome, cnpj, slug, plano, config)
VALUES ('DockCheck System', NULL, 'dockcheck-system', 'enterprise', '{"system":true}')
ON CONFLICT (slug) DO NOTHING;

-- ── AUDIT LOG GLOBAL (superadmin) ────────────────────
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  superadmin_id UUID        REFERENCES users(id),
  empresa_id    UUID        REFERENCES empresas(id),
  acao          VARCHAR(100) NOT NULL,
  entidade      VARCHAR(50),
  entidade_id   UUID,
  descricao     TEXT,
  dados         JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── INDEXES FASE 12 ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cds_empresa         ON centros_distribuicao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cds_ativo           ON centros_distribuicao(ativo);
CREATE INDEX IF NOT EXISTS idx_docas_cd            ON docas(cd_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_cd        ON operacoes(cd_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_created ON system_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_empresa ON system_audit_logs(empresa_id);

-- ── INDEXES BASE (idempotente) ────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_empresa     ON users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_docas_empresa     ON docas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_docas_status      ON docas(status);
CREATE INDEX IF NOT EXISTS idx_operacoes_empresa ON operacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_doca    ON operacoes(doca_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_status  ON operacoes(status);
CREATE INDEX IF NOT EXISTS idx_operacoes_numero  ON operacoes(numero_oc);
CREATE INDEX IF NOT EXISTS idx_operacoes_created ON operacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_operacao     ON operacao_logs(operacao_id);
CREATE INDEX IF NOT EXISTS idx_logs_empresa      ON operacao_logs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_created      ON operacao_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fotos_operacao    ON fotos(operacao_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens    ON refresh_tokens(token_hash);

-- ── UPDATED_AT TRIGGER ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'empresas','users','docas','operacoes','checklists',
    'centros_distribuicao','planos'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
      CREATE TRIGGER trg_updated_at_%1$s
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', tbl);
  END LOOP;
END;
$$;
`;

// ─────────────────────────────────────────────────────
const SCHEMA_FASE13 = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_user    ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_empresa ON push_subscriptions(empresa_id);
`;

const SCHEMA_FASE14 = `
CREATE TABLE IF NOT EXISTS automacao_regras (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  gatilho    TEXT NOT NULL,
  condicao   JSONB NOT NULL DEFAULT '{}',
  acao       TEXT NOT NULL,
  params     JSONB NOT NULL DEFAULT '{}',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auto_regras_empresa ON automacao_regras(empresa_id);

CREATE TABLE IF NOT EXISTS automacao_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  regra_id   UUID REFERENCES automacao_regras(id) ON DELETE SET NULL,
  regra_nome TEXT,
  acao       TEXT,
  params     JSONB,
  resultado  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auto_log_empresa ON automacao_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auto_log_created ON automacao_log(created_at DESC);
`;

async function migrate() {
  logger.info('🔄 Starting migration v4 (Fase 14)...');
  const client = await pool.connect();
  try {
    if (FRESH) {
      logger.warn('⚠️  FRESH mode: dropping all tables...');
      await client.query(DROP_ALL);
    }
    logger.info('  → Applying base schema...');
    await client.query(SCHEMA_BASE);
    logger.info('  → Applying Fase 12 schema...');
    await client.query(SCHEMA_FASE12);
    logger.info('  → Applying Fase 13 schema (Push Notifications)...');
    await client.query(SCHEMA_FASE13);
    logger.info('  → Applying Fase 14 schema (Automação)...');
    await client.query(SCHEMA_FASE14);
    logger.info('✅ Migration v4 completed successfully');
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));

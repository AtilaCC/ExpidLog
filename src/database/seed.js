// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Database Seed
// ══════════════════════════════════════════════════════

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./connection');
const logger   = require('../utils/logger');

async function seed() {
  const client = await pool.connect();
  logger.info('🌱 Seeding database...');

  try {
    await client.query('BEGIN');

    // ── Empresa Demo ──────────────────────────────────
    const { rows: [empresa] } = await client.query(`
      INSERT INTO empresas (nome, cnpj, slug, plano)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id
    `, ['Logística Demo LTDA', '12.345.678/0001-90', 'logistica-demo', 'enterprise']);

    logger.info(`  ✅ Empresa: ${empresa.id}`);

    // ── Usuários ──────────────────────────────────────
    const senha = await bcrypt.hash('demo123', 12);

    const usuarios = [
      { nome: 'Admin Master',       email: 'admin@dockcheck.io',      role: 'admin'        },
      { nome: 'Supervisor Silva',   email: 'supervisor@dockcheck.io', role: 'supervisor'   },
      { nome: 'Conferente João',    email: 'joao@dockcheck.io',       role: 'conferente'   },
      { nome: 'Conferente Maria',   email: 'maria@dockcheck.io',      role: 'conferente'   },
      { nome: 'Visualização ONLY',  email: 'view@dockcheck.io',       role: 'visualizacao' },
    ];

    const userIds = [];
    for (const u of usuarios) {
      const { rows: [user] } = await client.query(`
        INSERT INTO users (empresa_id, nome, email, senha_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (empresa_id, email) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id, role
      `, [empresa.id, u.nome, u.email, senha, u.role]);
      userIds.push(user);
      logger.info(`  ✅ User [${user.role}]: ${u.email}`);
    }

    // ── Docas ─────────────────────────────────────────
    const docasData = [
      { numero: 'D-01', descricao: 'Doca Recebimento Norte', tipo: 'descarga', status: 'em_operacao' },
      { numero: 'D-02', descricao: 'Doca Expedição Sul',     tipo: 'carga',    status: 'livre'       },
      { numero: 'D-03', descricao: 'Doca Mista Central',     tipo: 'misto',    status: 'em_operacao' },
      { numero: 'D-04', descricao: 'Doca Recebimento Leste', tipo: 'descarga', status: 'livre'       },
      { numero: 'D-05', descricao: 'Doca Expedição Oeste',   tipo: 'carga',    status: 'bloqueada'   },
      { numero: 'D-06', descricao: 'Doca Reserva',           tipo: 'misto',    status: 'manutencao'  },
    ];

    const docaIds = [];
    for (const d of docasData) {
      const { rows: [doca] } = await client.query(`
        INSERT INTO docas (empresa_id, numero, descricao, tipo, status, capacidade_kg)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (empresa_id, numero) DO UPDATE SET status = EXCLUDED.status
        RETURNING id
      `, [empresa.id, d.numero, d.descricao, d.tipo, d.status, 15000]);
      docaIds.push(doca.id);
    }
    logger.info(`  ✅ ${docaIds.length} Docas criadas`);

    // ── Operações ─────────────────────────────────────
    const conferenteId  = userIds.find(u => u.role === 'conferente').id;
    const supervisorId  = userIds.find(u => u.role === 'supervisor').id;

    const ops = [
      {
        doca_id: docaIds[0], numero_oc: 'OC-2024-001', placa: 'ABC-1234',
        transportadora: 'Transportes Rápidos SA', tipo: 'descarga',
        status: 'em_andamento', inicio_real: new Date(Date.now() - 45 * 60000),
        volumes_previstos: 120, volumes_conferidos: 87
      },
      {
        doca_id: docaIds[2], numero_oc: 'OC-2024-002', placa: 'XYZ-5678',
        transportadora: 'Logex Transportes', tipo: 'carga',
        status: 'em_andamento', inicio_real: new Date(Date.now() - 90 * 60000),
        volumes_previstos: 200, volumes_conferidos: 200
      },
      {
        doca_id: docaIds[3], numero_oc: 'OC-2024-003', placa: 'DEF-9012',
        transportadora: 'Velox Cargo', tipo: 'descarga',
        status: 'aguardando', inicio_real: null,
        volumes_previstos: 80, volumes_conferidos: 0
      },
    ];

    for (const op of ops) {
      await client.query(`
        INSERT INTO operacoes (
          empresa_id, doca_id, conferente_id, supervisor_id,
          numero_oc, placa_veiculo, transportadora,
          tipo_operacao, status, inicio_real,
          volumes_previstos, volumes_conferidos
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT DO NOTHING
      `, [
        empresa.id, op.doca_id, conferenteId, supervisorId,
        op.numero_oc, op.placa, op.transportadora,
        op.tipo, op.status, op.inicio_real,
        op.volumes_previstos, op.volumes_conferidos
      ]);
    }
    logger.info(`  ✅ ${ops.length} Operações criadas`);

    await client.query('COMMIT');
    logger.info('✅ Seed completed!');
    logger.info('');
    logger.info('── Credenciais de acesso ────────────────────');
    logger.info('  admin@dockcheck.io       → senha: demo123  [ADMIN]');
    logger.info('  supervisor@dockcheck.io  → senha: demo123  [SUPERVISOR]');
    logger.info('  joao@dockcheck.io        → senha: demo123  [CONFERENTE]');
    logger.info('─────────────────────────────────────────────');

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));

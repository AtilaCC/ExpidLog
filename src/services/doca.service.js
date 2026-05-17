// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Doca Service
// ══════════════════════════════════════════════════════

const { query, withTransaction } = require('../database/connection');
const { emitToEmpresa } = require('../socket');

async function listar(empresaId, filters = {}) {
  const { status, tipo } = filters;
  const conditions = ['d.empresa_id = $1'];
  const params = [empresaId];

  if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
  if (tipo)   { params.push(tipo);   conditions.push(`d.tipo = $${params.length}`);   }

  const { rows } = await query(`
    SELECT
      d.*,
      COUNT(o.id) FILTER (WHERE o.status = 'em_andamento') AS operacoes_ativas,
      json_build_object(
        'id',    u.id,
        'nome',  u.nome,
        'email', u.email
      ) AS conferente_atual
    FROM docas d
    LEFT JOIN operacoes o ON o.doca_id = d.id AND o.status = 'em_andamento'
    LEFT JOIN users u     ON u.id = o.conferente_id
    WHERE ${conditions.join(' AND ')} AND d.ativo = true
    GROUP BY d.id, u.id, u.nome, u.email
    ORDER BY d.numero
  `, params);

  return rows;
}

async function obter(empresaId, docaId) {
  const { rows } = await query(`
    SELECT d.*,
      (SELECT json_agg(o ORDER BY o.created_at DESC)
       FROM operacoes o
       WHERE o.doca_id = d.id AND o.empresa_id = $1
       LIMIT 10
      ) AS ultimas_operacoes
    FROM docas d
    WHERE d.id = $2 AND d.empresa_id = $1
  `, [empresaId, docaId]);

  if (!rows.length) throw Object.assign(new Error('Doca not found'), { status: 404 });
  return rows[0];
}

async function criar(empresaId, data, userId) {
  return withTransaction(async (client) => {
    const { rows: [doca] } = await client.query(`
      INSERT INTO docas (empresa_id, numero, descricao, tipo, status, capacidade_kg, config)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [empresaId, data.numero, data.descricao, data.tipo || 'misto',
        data.status || 'livre', data.capacidade_kg || null, data.config || {}]);

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, user_id, acao, descricao, dados_depois)
      VALUES ($1, $2, 'doca.criada', $3, $4)
    `, [empresaId, userId, `Doca ${doca.numero} criada`, JSON.stringify(doca)]);

    emitToEmpresa(empresaId, 'doca:created', doca);
    return doca;
  });
}

async function atualizar(empresaId, docaId, data, userId) {
  return withTransaction(async (client) => {
    const { rows: [antes] } = await client.query(
      'SELECT * FROM docas WHERE id = $1 AND empresa_id = $2',
      [docaId, empresaId]
    );
    if (!antes) throw Object.assign(new Error('Doca not found'), { status: 404 });

    const fields  = [];
    const params  = [];
    const allowed = ['descricao', 'tipo', 'status', 'capacidade_kg', 'config'];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (!fields.length) throw Object.assign(new Error('No fields to update'), { status: 400 });

    params.push(docaId, empresaId);
    const { rows: [doca] } = await client.query(
      `UPDATE docas SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND empresa_id = $${params.length} RETURNING *`,
      params
    );

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, user_id, acao, descricao, dados_antes, dados_depois)
      VALUES ($1, $2, 'doca.atualizada', $3, $4, $5)
    `, [empresaId, userId, `Doca ${doca.numero} atualizada`, JSON.stringify(antes), JSON.stringify(doca)]);

    emitToEmpresa(empresaId, 'doca:updated', doca);
    return doca;
  });
}

async function atualizarStatus(empresaId, docaId, status, userId) {
  return atualizar(empresaId, docaId, { status }, userId);
}

module.exports = { listar, obter, criar, atualizar, atualizarStatus };

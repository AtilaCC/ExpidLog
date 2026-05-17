// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Operação Service
// ══════════════════════════════════════════════════════

const { query, withTransaction } = require('../database/connection');
const { emitToEmpresa } = require('../socket');

async function listar(empresaId, filters = {}) {
  const { status, doca_id, conferente_id, data_inicio, data_fim, limit = 50, offset = 0 } = filters;
  const conditions = ['o.empresa_id = $1'];
  const params = [empresaId];

  if (status)        { params.push(status);        conditions.push(`o.status = $${params.length}`); }
  if (doca_id)       { params.push(doca_id);       conditions.push(`o.doca_id = $${params.length}`); }
  if (conferente_id) { params.push(conferente_id); conditions.push(`o.conferente_id = $${params.length}`); }
  if (data_inicio)   { params.push(data_inicio);   conditions.push(`o.created_at >= $${params.length}`); }
  if (data_fim)      { params.push(data_fim);       conditions.push(`o.created_at <= $${params.length}`); }

  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await query(`
    SELECT
      o.*,
      d.numero     AS doca_numero,
      d.descricao  AS doca_descricao,
      json_build_object('id', c.id, 'nome', c.nome) AS conferente,
      json_build_object('id', s.id, 'nome', s.nome) AS supervisor,
      EXTRACT(EPOCH FROM (COALESCE(o.fim_real, NOW()) - o.inicio_real)) / 60 AS duracao_minutos,
      COUNT(f.id) AS total_fotos,
      COUNT(ch.id) AS total_checklists
    FROM operacoes o
    JOIN  docas d ON d.id = o.doca_id
    LEFT JOIN users c ON c.id = o.conferente_id
    LEFT JOIN users s ON s.id = o.supervisor_id
    LEFT JOIN fotos f ON f.operacao_id = o.id
    LEFT JOIN checklists ch ON ch.operacao_id = o.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY o.id, d.numero, d.descricao, c.id, c.nome, s.id, s.nome
    ORDER BY o.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  // Total count
  const countParams = params.slice(0, -2);
  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM operacoes o WHERE ${conditions.join(' AND ')}`,
    countParams
  );

  return { data: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset) };
}

async function obter(empresaId, operacaoId) {
  const { rows } = await query(`
    SELECT
      o.*,
      d.numero AS doca_numero, d.descricao AS doca_descricao,
      json_build_object('id', c.id, 'nome', c.nome, 'email', c.email) AS conferente,
      json_build_object('id', s.id, 'nome', s.nome, 'email', s.email) AS supervisor,
      EXTRACT(EPOCH FROM (COALESCE(o.fim_real, NOW()) - o.inicio_real)) / 60 AS duracao_minutos,
      CASE WHEN o.volumes_previstos > 0
           THEN ROUND(o.volumes_conferidos::numeric / o.volumes_previstos * 100, 1)
           ELSE 0 END AS progresso_percent
    FROM operacoes o
    JOIN  docas d ON d.id = o.doca_id
    LEFT JOIN users c ON c.id = o.conferente_id
    LEFT JOIN users s ON s.id = o.supervisor_id
    WHERE o.id = $1 AND o.empresa_id = $2
  `, [operacaoId, empresaId]);

  if (!rows.length) throw Object.assign(new Error('Operação not found'), { status: 404 });
  return rows[0];
}

async function iniciar(empresaId, data, userId) {
  return withTransaction(async (client) => {
    // Validate doca
    const { rows: [doca] } = await client.query(
      'SELECT id, status, numero FROM docas WHERE id = $1 AND empresa_id = $2',
      [data.doca_id, empresaId]
    );
    if (!doca) throw Object.assign(new Error('Doca not found'), { status: 404 });
    if (doca.status === 'bloqueada' || doca.status === 'manutencao') {
      throw Object.assign(new Error(`Doca está ${doca.status}`), { status: 400 });
    }

    const { rows: [op] } = await client.query(`
      INSERT INTO operacoes (
        empresa_id, doca_id, conferente_id, supervisor_id,
        numero_oc, placa_veiculo, transportadora, motorista,
        tipo_operacao, status, inicio_real, inicio_previsto, fim_previsto,
        volumes_previstos, observacoes, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'em_andamento', NOW(), $10,$11,$12,$13,$14)
      RETURNING *
    `, [
      empresaId, data.doca_id, userId, data.supervisor_id || null,
      data.numero_oc, data.placa_veiculo || null, data.transportadora || null, data.motorista || null,
      data.tipo_operacao || 'descarga',
      data.inicio_previsto || null, data.fim_previsto || null,
      data.volumes_previstos || null, data.observacoes || null,
      data.metadata || {}
    ]);

    // Update doca status
    await client.query(
      "UPDATE docas SET status = 'em_operacao' WHERE id = $1",
      [data.doca_id]
    );

    // Auto-create default checklist
    const { rows: [checklist] } = await client.query(`
      INSERT INTO checklists (operacao_id, conferente_id, tipo)
      VALUES ($1, $2, 'geral') RETURNING id
    `, [op.id, userId]);

    const itensDefault = [
      'Documento do veículo verificado',
      'Nota fiscal conferida',
      'Volumes contados na entrada',
      'Embalagens íntegras',
      'EPI utilizado',
      'Área desobstruída',
    ];
    for (let i = 0; i < itensDefault.length; i++) {
      await client.query(
        'INSERT INTO checklist_itens (checklist_id, ordem, descricao) VALUES ($1,$2,$3)',
        [checklist.id, i, itensDefault[i]]
      );
    }

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, operacao_id, user_id, acao, descricao, dados_depois)
      VALUES ($1,$2,$3,'operacao.iniciada',$4,$5)
    `, [empresaId, op.id, userId, `OC ${op.numero_oc} iniciada na doca ${doca.numero}`, JSON.stringify(op)]);

    emitToEmpresa(empresaId, 'operacao:started', { ...op, doca_numero: doca.numero });
    emitToEmpresa(empresaId, 'doca:updated',     { id: doca.id, status: 'em_operacao' });

    return op;
  });
}

async function atualizar(empresaId, operacaoId, data, userId) {
  return withTransaction(async (client) => {
    const { rows: [antes] } = await client.query(
      'SELECT * FROM operacoes WHERE id = $1 AND empresa_id = $2',
      [operacaoId, empresaId]
    );
    if (!antes) throw Object.assign(new Error('Operação not found'), { status: 404 });

    const allowed = ['volumes_conferidos', 'observacoes', 'placa_veiculo', 'transportadora', 'motorista', 'metadata'];
    const fields = []; const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (!fields.length) throw Object.assign(new Error('No fields to update'), { status: 400 });

    params.push(operacaoId, empresaId);
    const { rows: [op] } = await client.query(
      `UPDATE operacoes SET ${fields.join(', ')} WHERE id = $${params.length-1} AND empresa_id = $${params.length} RETURNING *`,
      params
    );

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, operacao_id, user_id, acao, dados_antes, dados_depois)
      VALUES ($1,$2,$3,'operacao.atualizada',$4,$5)
    `, [empresaId, operacaoId, userId, JSON.stringify(antes), JSON.stringify(op)]);

    emitToEmpresa(empresaId, 'operacao:updated', op);
    return op;
  });
}

async function finalizar(empresaId, operacaoId, data, userId) {
  return withTransaction(async (client) => {
    const { rows: [op] } = await client.query(
      "SELECT * FROM operacoes WHERE id = $1 AND empresa_id = $2 AND status NOT IN ('finalizada','cancelada')",
      [operacaoId, empresaId]
    );
    if (!op) throw Object.assign(new Error('Operação not found or already closed'), { status: 404 });

    const { rows: [updated] } = await client.query(`
      UPDATE operacoes SET status = 'finalizada', fim_real = NOW(), observacoes = COALESCE($1, observacoes)
      WHERE id = $2 RETURNING *
    `, [data?.observacoes, operacaoId]);

    // Free the doca if no other active operations
    const { rows: [{ count }] } = await client.query(
      "SELECT COUNT(*) FROM operacoes WHERE doca_id = $1 AND status = 'em_andamento' AND id != $2",
      [op.doca_id, operacaoId]
    );
    if (parseInt(count) === 0) {
      await client.query("UPDATE docas SET status = 'livre' WHERE id = $1", [op.doca_id]);
      emitToEmpresa(empresaId, 'doca:updated', { id: op.doca_id, status: 'livre' });
    }

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, operacao_id, user_id, acao, descricao)
      VALUES ($1,$2,$3,'operacao.finalizada',$4)
    `, [empresaId, operacaoId, userId, `OC ${op.numero_oc} finalizada`]);

    emitToEmpresa(empresaId, 'operacao:finished', updated);
    return updated;
  });
}

async function cancelar(empresaId, operacaoId, motivo, userId) {
  return withTransaction(async (client) => {
    const { rows: [op] } = await client.query(
      "SELECT * FROM operacoes WHERE id = $1 AND empresa_id = $2 AND status NOT IN ('finalizada','cancelada')",
      [operacaoId, empresaId]
    );
    if (!op) throw Object.assign(new Error('Operação not found or already closed'), { status: 404 });

    const { rows: [updated] } = await client.query(`
      UPDATE operacoes SET status = 'cancelada', fim_real = NOW(), motivo_cancelamento = $1
      WHERE id = $2 RETURNING *
    `, [motivo, operacaoId]);

    await client.query("UPDATE docas SET status = 'livre' WHERE id = $1", [op.doca_id]);

    await client.query(`
      INSERT INTO operacao_logs (empresa_id, operacao_id, user_id, acao, descricao)
      VALUES ($1,$2,$3,'operacao.cancelada',$4)
    `, [empresaId, operacaoId, userId, `OC ${op.numero_oc} cancelada: ${motivo}`]);

    emitToEmpresa(empresaId, 'operacao:cancelled', updated);
    emitToEmpresa(empresaId, 'doca:updated', { id: op.doca_id, status: 'livre' });
    return updated;
  });
}

module.exports = { listar, obter, iniciar, atualizar, finalizar, cancelar };

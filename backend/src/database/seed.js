const { conectar, executar, buscarUm } = require('./esquema');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function seed() {
  await conectar();

  // ── Seed de Produtos ──
  const contagem = buscarUm('SELECT COUNT(*) as total FROM produtos');
  if (!contagem || contagem.total === 0) {
    const produtos = [
      { nome: 'Arroz Integral 1kg', codigo_barras: '7891000100101', preco: 8.99, estoque: 150, categoria: 'Alimentos' },
      { nome: 'Feijão Preto 1kg', codigo_barras: '7891000100202', preco: 7.49, estoque: 120, categoria: 'Alimentos' },
      { nome: 'Macarrão Espaguete 500g', codigo_barras: '7891000100303', preco: 4.29, estoque: 200, categoria: 'Alimentos' },
      { nome: 'Óleo de Soja 900ml', codigo_barras: '7891000100404', preco: 6.99, estoque: 80, categoria: 'Alimentos' },
      { nome: 'Açúcar Refinado 1kg', codigo_barras: '7891000100505', preco: 5.49, estoque: 100, categoria: 'Alimentos' },
      { nome: 'Sal Refinado 1kg', codigo_barras: '7891000100606', preco: 2.99, estoque: 90, categoria: 'Alimentos' },
      { nome: 'Leite Integral 1L', codigo_barras: '7891000100707', preco: 5.99, estoque: 60, categoria: 'Laticínios' },
      { nome: 'Manteiga 200g', codigo_barras: '7891000100808', preco: 9.49, estoque: 45, categoria: 'Laticínios' },
      { nome: 'Queijo Mussarela 500g', codigo_barras: '7891000100909', preco: 24.90, estoque: 30, categoria: 'Laticínios' },
      { nome: 'Presunto Fatiado 200g', codigo_barras: '7891000101010', preco: 12.90, estoque: 40, categoria: 'Frios' },
      { nome: 'Coca-Cola 2L', codigo_barras: '7891000101111', preco: 9.99, estoque: 70, categoria: 'Bebidas' },
      { nome: 'Água Mineral 500ml', codigo_barras: '7891000101212', preco: 2.50, estoque: 200, categoria: 'Bebidas' },
      { nome: 'Suco de Laranja 1L', codigo_barras: '7891000101313', preco: 7.99, estoque: 50, categoria: 'Bebidas' },
      { nome: 'Cerveja Lata 350ml', codigo_barras: '7891000101414', preco: 4.99, estoque: 100, categoria: 'Bebidas' },
      { nome: 'Biscoito Cream Cracker', codigo_barras: '7891000101515', preco: 4.49, estoque: 80, categoria: 'Mercearia' },
      { nome: 'Café Torrado 500g', codigo_barras: '7891000101616', preco: 18.90, estoque: 60, categoria: 'Mercearia' },
      { nome: 'Sabonete 90g', codigo_barras: '7891000101717', preco: 2.99, estoque: 150, categoria: 'Higiene' },
      { nome: 'Papel Higiênico 12un', codigo_barras: '7891000101818', preco: 19.90, estoque: 40, categoria: 'Higiene' },
      { nome: 'Detergente 500ml', codigo_barras: '7891000101919', preco: 3.49, estoque: 100, categoria: 'Limpeza' },
      { nome: 'Sabão em Pó 1kg', codigo_barras: '7891000102020', preco: 12.49, estoque: 55, categoria: 'Limpeza' },
      { nome: 'Pão de Forma 500g', codigo_barras: '7891000102121', preco: 8.99, estoque: 35, categoria: 'Padaria' },
      { nome: 'Chocolate ao Leite 100g', codigo_barras: '7891000102222', preco: 6.90, estoque: 70, categoria: 'Doces' },
      { nome: 'Batata Frita Chips 100g', codigo_barras: '7891000102323', preco: 8.49, estoque: 90, categoria: 'Snacks' },
      { nome: 'Iogurte Natural 170g', codigo_barras: '7891000102424', preco: 3.99, estoque: 50, categoria: 'Laticínios' },
      { nome: 'Molho de Tomate 340g', codigo_barras: '7891000102525', preco: 3.29, estoque: 110, categoria: 'Alimentos' },
    ];

    for (const p of produtos) {
      executar(
        'INSERT INTO produtos (id, codigo_barras, nome, preco, estoque, categoria) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), p.codigo_barras, p.nome, p.preco, p.estoque, p.categoria]
      );
    }
    console.log(`✅ ${produtos.length} produtos inseridos com sucesso!`);
  } else {
    console.log('Banco já possui produtos. Seed de produtos ignorado.');
  }

  // ── Seed de Usuários ──
  const contagemUsuarios = buscarUm('SELECT COUNT(*) as total FROM usuarios');
  if (!contagemUsuarios || contagemUsuarios.total === 0) {
    const senhaAdmin = bcrypt.hashSync('admin123', 10);
    const senhaOperador = bcrypt.hashSync('op123', 10);

    executar(
      'INSERT INTO usuarios (id, nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'Administrador', 'admin', senhaAdmin, 'gerente']
    );

    executar(
      'INSERT INTO usuarios (id, nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'Operador Padrão', 'operador', senhaOperador, 'operador']
    );

    console.log('✅ Usuários padrão criados:');
    console.log('   👤 admin / admin123 (gerente)');
    console.log('   👤 operador / op123 (operador)');
  } else {
    console.log('Banco já possui usuários. Seed de usuários ignorado.');
  }
}

seed().catch(console.error);

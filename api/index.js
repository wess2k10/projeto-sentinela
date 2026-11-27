const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

// Banco persistido dentro do projeto para os ambientes local e publicado.
// Use o banco do backend como fonte única, copiando-o para a API na ausência dele.
const BACKEND_DB_FILE = path.join(__dirname, "../backend/db.json");
const API_DB_FILE = path.join(__dirname, "db.json");
const DB_FILE = fs.existsSync(BACKEND_DB_FILE) ? BACKEND_DB_FILE : API_DB_FILE;

function defaultDB() {
  return {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    estoque: []
  };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return defaultDB();
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.pacientes = Array.isArray(db.pacientes) ? db.pacientes : [];
  db.triagens = Array.isArray(db.triagens) ? db.triagens : [];
  db.consultas = Array.isArray(db.consultas) ? db.consultas : [];
  db.estoque = Array.isArray(db.estoque) ? db.estoque : [];
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post("/login", (req, res) => {
  const db = readDB();
  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario && u.senha === req.body.senha
  );

  if (!user) return res.status(401).json({ erro: "Login inválido" });
  res.json(user);
});

app.get("/usuarios", (req, res) => {
  res.json(readDB().usuarios.map(({ senha, ...usuario }) => usuario));
});

app.post("/usuarios", (req, res) => {
  const { usuario, senha, tipo } = req.body || {};
  if (!usuario || !senha || !tipo) {
    return res.status(400).json({ erro: "Informe usuário, senha e setor." });
  }

  const db = readDB();
  const novoUsuario = { id: Date.now(), usuario, senha, tipo };
  db.usuarios.push(novoUsuario);
  writeDB(db);

  const { senha: _senha, ...usuarioSemSenha } = novoUsuario;
  res.status(201).json(usuarioSemSenha);
});

app.get("/estoque", (req, res) => res.json(readDB().estoque));

app.post("/estoque", (req, res) => {
  const { nome, quantidade, unidade, categoria } = req.body || {};
  const qtd = Number(quantidade);

  if (!String(nome || "").trim() || !Number.isInteger(qtd) || qtd <= 0 || !unidade || !categoria) {
    return res.status(400).json({ erro: "Informe nome, quantidade inteira positiva, unidade e categoria." });
  }

  const db = readDB();
  const existente = db.estoque.find(m =>
    String(m.nome).trim().toLowerCase() === String(nome).trim().toLowerCase()
  );

  if (existente) {
    existente.quantidade = Number(existente.quantidade || 0) + qtd;
    existente.unidade = unidade;
    existente.categoria = categoria;
    writeDB(db);
    return res.status(200).json({ medicamento: existente, mensagem: "Quantidade adicionada ao medicamento existente." });
  }

  const medicamento = { id: Date.now(), nome: String(nome).trim(), quantidade: qtd, unidade, categoria };
  db.estoque.push(medicamento);
  writeDB(db);
  res.status(201).json({ medicamento, mensagem: "Medicamento cadastrado com sucesso!" });
});

app.patch("/estoque/:id", (req, res) => {
  const db = readDB();
  const medicamento = db.estoque.find(m => String(m.id) === String(req.params.id));
  if (!medicamento) return res.status(404).json({ erro: "Medicamento não encontrado no estoque." });

  const quantidade = Number(req.body?.quantidade);
  if (!Number.isInteger(quantidade) || quantidade === 0) {
    return res.status(400).json({ erro: "Informe uma quantidade inteira diferente de zero." });
  }

  const novoTotal = Number(medicamento.quantidade || 0) + quantidade;
  if (novoTotal < 0) return res.status(400).json({ erro: "A quantidade em estoque não pode ficar negativa." });

  medicamento.quantidade = novoTotal;
  writeDB(db);
  res.json({ medicamento });
});

app.delete("/estoque/:id", (req, res) => {
  const db = readDB();
  const index = db.estoque.findIndex(m => String(m.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ erro: "Medicamento não encontrado no estoque." });

  const [removido] = db.estoque.splice(index, 1);
  writeDB(db);
  res.json({ medicamento: removido, mensagem: "Medicamento removido do estoque." });
});

app.post("/atendimento", (req, res) => {
  const db = readDB();
  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);
  res.status(201).json(paciente);
});

app.get("/pacientes", (req, res) => res.json(readDB().pacientes || []));

app.post("/triagem", (req, res) => {
  const db = readDB();
  let risco = req.body.risco;

  if (Number(req.body.temperatura) >= 39) risco = "vermelho";
  else if (Number(req.body.temperatura) >= 38) risco = "amarelo";
  else if (!risco) risco = "verde";

  const triagem = {
    id: Date.now(),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);
  writeDB(db);
  res.status(201).json(triagem);
});

app.get("/triagens", (req, res) => res.json(readDB().triagens));

app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona", "Paracetamol", "Ibuprofeno", "Amoxicilina", "Azitromicina",
    "Loratadina", "Omeprazol", "Buscopan", "Dramin", "Soro fisiológico"
  ]);
});

app.post("/consulta", (req, res) => {
  const db = readDB();
  const nomeMedicacao = String(req.body.medicacao || "").trim();
  if (!nomeMedicacao) return res.status(400).json({ erro: "Selecione uma medicação." });

  const medicamento = db.estoque.find(m =>
    String(m.nome).trim().toLowerCase() === nomeMedicacao.toLowerCase()
  );

  if (!medicamento) {
    return res.status(404).json({ erro: `Medicamento "${nomeMedicacao}" não encontrado no estoque.` });
  }

  const quantidadeAtual = Number(medicamento.quantidade || 0);
  if (quantidadeAtual < 1) {
    return res.status(409).json({ erro: `Não há unidades de "${nomeMedicacao}" disponíveis no estoque.` });
  }

  const consulta = {
    id: Date.now(),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: nomeMedicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  medicamento.quantidade = quantidadeAtual - 1;
  db.consultas.push(consulta);
  writeDB(db);
  res.status(201).json({ consulta, estoqueAtualizado: medicamento });
});

app.get("/medicacoes", (req, res) => res.json(readDB().consultas));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => console.log(`Hospital Aura rodando na porta ${PORT}`));
}

module.exports = app;

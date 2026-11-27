const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(__dirname));
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/img", express.static(path.join(__dirname, "img")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      estoque: []
    };
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

app.get("/usuarios", (req, res) => res.json(readDB().usuarios));

app.post("/usuarios", (req, res) => {
  const db = readDB();
  const novoUsuario = {
    id: Date.now(),
    usuario: req.body.usuario,
    senha: req.body.senha,
    tipo: req.body.tipo
  };

  db.usuarios.push(novoUsuario);
  writeDB(db);
  res.json(novoUsuario);
});

app.get("/estoque", (req, res) => res.json(readDB().estoque));

app.post("/estoque", (req, res) => {
  const { nome, quantidade, unidade, categoria } = req.body || {};
  const qtd = Number(quantidade);

  if (!String(nome || "").trim() || !Number.isInteger(qtd) || qtd <= 0 || !unidade || !categoria) {
    return res.status(400).json({ erro: "Informe nome, quantidade inteira positiva, unidade e categoria." });
  }

  const db = readDB();
  const medicamentoExistente = db.estoque.find(m =>
    String(m.nome).trim().toLowerCase() === String(nome).trim().toLowerCase()
  );

  if (medicamentoExistente) {
    medicamentoExistente.quantidade = Number(medicamentoExistente.quantidade || 0) + qtd;
    medicamentoExistente.unidade = unidade;
    medicamentoExistente.categoria = categoria;
    writeDB(db);
    return res.json({ medicamento: medicamentoExistente, mensagem: "Quantidade adicionada ao medicamento existente." });
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
  res.json(paciente);
});

app.get("/pacientes", (req, res) => res.json(readDB().pacientes || []));

let chamadaAtual = null;
let historicoChamadas = [];

app.get("/tv/chamada", (req, res) => res.json({ chamada: chamadaAtual, historico: historicoChamadas }));

app.post("/tv/chamada", (req, res) => {
  const novaChamada = {
    id: Date.now(),
    paciente: req.body.paciente,
    localTipo: req.body.localTipo || "GUICHÊ",
    localNumero: req.body.localNumero || "01"
  };

  if (chamadaAtual) historicoChamadas.unshift(chamadaAtual);
  chamadaAtual = novaChamada;
  res.json({ chamada: chamadaAtual, historico: historicoChamadas });
});

app.post("/triagem", (req, res) => {
  const db = readDB();
  let risco = req.body.risco;

  if (req.body.temperatura >= 39) risco = "vermelho";
  else if (req.body.temperatura >= 38) risco = "amarelo";
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
  res.json(triagem);
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

app.listen(3000, () => {
  console.log("🏥 Hospital Aura rodando em http://localhost:3000");
});

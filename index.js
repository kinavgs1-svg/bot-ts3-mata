const { TeamSpeak } = require("ts3-nodejs-library");
const fs = require('fs');
const http = require('http');

// ========= CONFIGURAÇÃO =========
const CONFIG = {
  host: "battleauroria", // ex: 192.168.0.1 ou battleauroria.ts3.host
  queryport: 10011,
  serverport: 9987,
  username: "serveradmin",
  password: "SUA_SENHA_AQUI", // <--- COLOCA SUA SENHA DO QUERY AQUI
  nickname: "Bot-Mata",
  TEMPO_CHAMADA: 90000 // 90 segundos
};

// ========= RANKING =========
let ranking = {};
try {
  if (fs.existsSync('ranking.json')) {
    ranking = JSON.parse(fs.readFileSync('ranking.json', 'utf8'));
  }
} catch (e) {
  console.log("Criando ranking novo...");
}

let chamadaAtiva = null;

const ts = new TeamSpeak(CONFIG);

ts.on("ready", async () => {
  console.log(`[BOT ONLINE] Conectado em ${CONFIG.host}`);
  await ts.registerEvent({ event: "server" });
  await ts.clientUpdate({ client_nickname: CONFIG.nickname });
});

ts.on("error", (err) => {
  console.log("[ERRO]", err.message);
});

// ========= DETECTA POKE =========
ts.on("clientpoked", async (ev) => {
  try {
    const texto = (ev.text || "").toLowerCase();
    const gatilhos = ["war channel", "deixa open", "mimar", "neutro"];
    if (!gatilhos.some(g => texto.includes(g))) return;

    const invoker = ev.invoker;
    const invokerCache = invoker.getCache();
    const canalId = invokerCache.cid;
    
    // Pega nome do canal
    const canalInfo = await ts.getChannelById(canalId).catch(() => null);
    const nomeCanal = canalInfo ? canalInfo.getCache().channel_name : `Canal ${canalId}`;

    if (!chamadaAtiva) {
      console.log(`\n[NOVA CHAMADA] ${nomeCanal}`);
      
      // Inicia chamada já contando quem já tá dentro
      chamadaAtiva = {
        canalId: canalId,
        canalNome: nomeCanal,
        lista: new Map(),
        timer: setTimeout(() => finalizarChamada(), CONFIG.TEMPO_CHAMADA),
        inicio: Date.now()
      };

      // Conta quem já está no canal na hora do poke
      const clientesNoCanal = await ts.clientList({ cid: canalId }).catch(() => []);
      for (const cliente of clientesNoCanal) {
        const cache = cliente.getCache();
        if (cache.client_nickname === CONFIG.nickname) continue;
        const dbId = cache.client_database_id;
        if (!dbId) continue;
        
        if (!ranking[dbId]) ranking[dbId] = { nome: cache.client_nickname, entrou: 0, naoEntrou: 0 };
        
        chamadaAtiva.lista.set(dbId, { 
          nome: cache.client_nickname, 
          veio: true, 
          jaEstava: true 
        });
        console.log(` -> Já estava: ${cache.client_nickname}`);
      }
    }

    // Adiciona quem deu o poke na lista se ainda não estiver
    const clientePoke = ev.client;
    if (clientePoke) {
      const dbId = clientePoke.getCache().client_database_id;
      const nome = clientePoke.getCache().client_nickname;
      if (dbId) {
        if (!ranking[dbId]) ranking[dbId] = { nome: nome, entrou: 0, naoEntrou: 0 };
        if (!chamadaAtiva.lista.has(dbId)) {
          chamadaAtiva.lista.set(dbId, { nome: nome, veio: false, jaEstava: false });
          console.log(` -> Aguardando: ${nome}`);
        }
      }
    }

  } catch (err) {
    console.log("[ERRO POKE]", err.message);
  }
});

// ========= DETECTA QUEM ENTROU =========
ts.on("clientmoved", async (ev) => {
  try {
    if (!chamadaAtiva) return;
    if (ev.channel.getCache().cid != chamadaAtiva.canalId) return;

    const dbId = ev.client.getCache().client_database_id;
    const nome = ev.client.getCache().client_nickname;

    if (chamadaAtiva.lista.has(dbId)) {
      const info = chamadaAtiva.lista.get(dbId);
      if (!info.veio) {
        info.veio = true;
        console.log(`[ENTROU] ${nome}`);
      }
    } else {
      // Entrou no canal mas não estava na lista, adiciona como que entrou
      if (!ranking[dbId]) ranking[dbId] = { nome: nome, entrou: 0, naoEntrou: 0 };
      chamadaAtiva.lista.set(dbId, { nome: nome, veio: true, jaEstava: false });
      console.log(`[ENTROU EXTRA] ${nome}`);
    }
  } catch (e) {}
});

// ========= FINALIZA =========
function finalizarChamada() {
  if (!chamadaAtiva) return;

  console.log(`\n--- FINALIZANDO ${chamadaAtiva.canalNome} ---`);
  let entrou = 0, naoEntrou = 0;

  chamadaAtiva.lista.forEach((info, dbId) => {
    ranking[dbId].nome = info.nome; // atualiza nome
    if (info.veio) {
      ranking[dbId].entrou++;
      entrou++;
    } else {
      ranking[dbId].naoEntrou++;
      naoEntrou++;
    }
  });

  // Salva arquivos
  fs.writeFileSync('ranking.json', JSON.stringify(ranking, null, 2));
  
  let txt = `RANKING - ${chamadaAtiva.canalNome} - ${new Date().toLocaleString('pt-BR')}\n`;
  txt += `Total: ${chamadaAtiva.lista.size} | Entrou: ${entrou} | Não entrou: ${naoEntrou}\n`;
  txt += `------------------------------------------------\n`;
  Object.values(ranking)
    .sort((a,b) => b.entrou - a.entrou)
    .forEach(p => {
      txt += `${p.nome} - Entrou: ${p.entrou}x | Não entrou: ${p.naoEntrou}x\n`;
    });
  
  fs.writeFileSync('ranking.txt', txt);
  console.log(txt);
  console.log("Ranking salvo em ranking.json e ranking.txt");

  chamadaAtiva = null;
}

// ========= SERVIDOR WEB PRA RENDER NÃO DORMIR =========
http.createServer((req, res) => {
  if (req.url === '/ranking') {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    try {
      res.end(fs.readFileSync('ranking.txt','utf8'));
    } catch(e) { res.end("Sem ranking ainda"); }
  } else {
    res.end("Bot TS3 Mata - ONLINE");
  }
}).listen(process.env.PORT || 3000, () => {
  console.log("Web server na porta " + (process.env.PORT || 3000));
});

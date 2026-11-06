# Encomendas – Corpo da Guarda APMG

App web (PWA, instalável no celular) que substitui o livro físico de encomendas
do Corpo da Guarda da APMG. Piloto: **EsFO**.

- Avisa o destinatário assim que a encomenda é registrada.
- Registra cada etapa até a entrega em mãos (livro digital, sem rasura).
- Monta o lote noturno da EsFO para a sala de TV do Bloco III.
- Custo zero: Firebase (plano gratuito Spark) + GitHub.

Documento completo do projeto: veja o arquivo do projeto no claude.ai
("Projeto – Aplicativo de Gestão de Encomendas do Corpo da Guarda (APMG)").

---

## 1. Os três modos

| Modo | Quem usa | Telas |
|---|---|---|
| **Guarda** | Aparelho exclusivo do posto, logado na Conta da Guarda | Início (“No posto agora”), Receber, Delivery, Entregar, Saída de lote, Contingência |
| **Cadete** | Celular de cada um | Minhas encomendas, QR de retirada, Estou esperando, Autorizar terceiro, Missões, Escolher função |
| **Gestão** | Quem escolheu uma função, Oficial de Dia, administrador | Painel, Lote EsFO, Relatórios, Cadastros (só admin) |

O modo é escolhido automaticamente pelo login: a Conta da Guarda abre o Modo Guarda;
os demais abrem o Modo Cadete, com a aba **Gestão** quando há função ou perfil fixo.

## 2. Estrutura das pastas

```
src/
  main.jsx, App.jsx        entrada e rotas
  firebase.js              conexão com o Firebase (cache offline ligado)
  sessao.jsx               quem está logado, perfil e função
  componentes.jsx          peças de tela (topo, botões, busca, leitor de código, QR)
  estilos.css              visual das telas desenhadas
  sw.js                    service worker (offline e notificações)
  lib/constantes.js        setores, turmas, pelotões, funções, situações, tempos
  lib/texto.js             busca tolerante a erro, máscara de documento, chave de NF
  dados/                   tudo o que lê e grava no banco
    encomendas.js          receber, entregar, retirada na sala de TV, identificar
    pedidos.js             "Estou esperando" e delivery com código
    lotes.js               lote EsFO (gerar, assumir, separar, saída, sala de TV, bloco)
    pessoas.js             autocadastro, cadastros, passagem de ano
    posto.js               "No posto agora" e contingência
    funcoes.js             funções escolhidas pelo cadete
    autorizacoes.js        retirada por terceiro
    notificacoes.js        ativar avisos no celular
    relatorios.js          livro digital em planilha
  telas/guarda|cadete|gestao/   uma tela por arquivo
firestore.rules            regras de acesso (quem vê e grava o quê)
firestore.indexes.json     índices das consultas
scripts/enviar-avisos.mjs  rotina agendada (avisos, delivery parado, pedidos vencidos)
.github/workflows/         avisos.yml (rotina) e publicar.yml (publicação automática)
```

## 3. Rodar no computador

Precisa do [Node.js 22](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # preencha com a configuração do app Web (passo 4.1)
npm run dev                  # abre em http://localhost:5173
```

`npm run build` gera a versão final na pasta `dist/`.

## 4. Configuração única no Firebase (projeto `encomendas-apmg`)

Já feito: projeto criado no plano Spark, Firestore em `southamerica-east1`,
login por e-mail/senha ativado.

### 4.1 Registrar o app Web
Console do Firebase › Configurações do projeto › **Seus apps** › ícone `</>` (Web) ›
apelido “encomendas-web” › marque **Firebase Hosting** › Registrar.
Copie os valores de `firebaseConfig` para o `.env.local` (e para os segredos do GitHub, passo 5).

### 4.2 Chave das notificações
Configurações do projeto › **Cloud Messaging** › Certificados push da Web ›
**Gerar par de chaves**. Copie a chave para `VITE_FIREBASE_VAPID_KEY`.

### 4.3 Publicar as regras e os índices
- **Regras:** Firestore › **Regras** › apague o conteúdo, cole o arquivo `firestore.rules` e clique em **Publicar**.
- **Índices:** Firestore › **Índices** › crie os índices do arquivo `firestore.indexes.json`
  (ou rode `npx firebase-tools deploy --only firestore`). Se faltar algum, o app mostra no
  console do navegador um link que cria o índice com um clique.

### 4.4 Primeiro administrador
1. Faça o cadastro normal no app (como cadete).
2. Firestore › Dados › coleção `pessoas` › seu documento › mude `perfil` de `cadete` para `admin`.
3. Daí em diante, o perfil dos outros (Oficial de Dia, Conta da Guarda) é trocado no próprio app, em **Gestão › Cadastros**.

### 4.5 Conta da Guarda
1. Authentication › Usuários › **Adicionar usuário** (ex.: `guarda.encomendas.apmg@gmail.com` e uma senha guardada pelo setor responsável).
2. Copie o **UID** criado.
3. Firestore › Dados › coleção `pessoas` › **Adicionar documento** com o ID = UID e os campos:
   `nomeCompleto` = "Conta da Guarda", `nomeGuerra` = "Guarda", `numeroCadete` = "0",
   `setor` = "Guarda", `perfil` = "guarda", `ativo` = true (booleano), `funcao` = null.
4. Entre com essa conta no celular do posto e adicione o app à tela inicial.

## 5. GitHub (rotina de avisos e publicação automática)

Repositório › **Settings › Secrets and variables › Actions**.

**Secrets:**

| Nome | Onde pegar |
|---|---|
| `FIREBASE_ADMIN_KEY` | Firebase › Configurações do projeto › Contas de serviço › **Gerar nova chave privada** (cole o conteúdo do arquivo JSON inteiro). Nunca coloque esse arquivo no repositório. |
| `FIREBASE_SERVICE_ACCOUNT` | Mesma chave acima, ou uma conta de serviço só para publicação com o papel “Administrador do Firebase Hosting”. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY` | Passos 4.1 e 4.2 |

**Variables:**

| Nome | Valor |
|---|---|
| `AVISOS_ATIVO` | `sim` (liga a rotina de avisos) |
| `PUBLICAR_ATIVO` | `sim` (liga a publicação automática) |
| `URL_APP` | `https://encomendas-apmg.web.app` |

**Frequência da rotina:** a cada **5 minutos** (o mínimo do GitHub; na prática pode
atrasar alguns minutos em horários de pico). O repositório é **público**, por isso o
GitHub Actions é gratuito e sem limite de minutos. O código não contém senhas: as chaves
ficam só nos *Secrets*. Em repositório público, o GitHub desliga rotinas agendadas após
60 dias sem alteração no repositório; se acontecer, reative em **Actions › Avisos ›
Enable workflow**.

## 6. Banco de dados (coleções)

| Coleção | Conteúdo |
|---|---|
| `pessoas` | Perfil público: nome, nome de guerra, nº do cadete, setor, turma, pelotão, perfil, função, ativo |
| `contatos` | E-mail e celular (só o próprio, a guarda e a gestão leem) |
| `numerosCadete` | Reserva do nº do cadete (garante que é único) |
| `encomendas` | Nº interno, destinatário, identificação, entregador, local, situação |
| `movimentacoes` | **Livro digital**: cada mudança de situação. Só recebe inclusões |
| `pedidosEsperados` (+ `segredo/codigo`) | Rastreio ou delivery esperado; o código fica separado e é apagado após o uso |
| `lotes` | Lote EsFO: itens, separados, executor, saída, sala de TV, recebimento no bloco |
| `funcoes`, `assuncoes` | Quem está em cada função e o histórico de assunções |
| `posto`, `postoHistorico`, `postoNomes` | “No posto agora” e quem esteve no posto |
| `contingencias`, `config/contingencia` | Início e fim do uso do livro físico |
| `entregadores` / `entregadoresDocs` | Entregadores frequentes; documento completo só para o admin |
| `autorizacoes` | Terceiros autorizados a retirar |
| `avisos`, `tokensPush` | Avisos ao celular e endereço de notificação de cada aparelho |
| `config/contador` | Último número interno usado |
| `alertas`, `relatoriosGerados` | Tentativa de nº repetido; registro de quem gerou relatório |

Situações: **Na guarda → Retirada**, ou **Na guarda → Em lote → Na sala de TV → Retirada**.
Situação paralela: **Setor a identificar**.

## 7. O que já está pronto e o que falta

**Pronto nesta primeira versão (estrutura funcional):** login e autocadastro; Conta da
Guarda com “No posto agora” e confirmação após inatividade; receber encomenda com
leitura de código pela câmera (rastreio e chave de NF), busca tolerante a erro, alerta de
duplicidade e pedido esperado; delivery com código; entrega por QR ou nome, próprio ou
terceiro; lote EsFO completo; escolha de função; painel; livro digital em planilha;
cadastros e passagem de ano; contingência; regras de acesso; rotina de avisos.

**Próximos passos:**
- Testar as regras de acesso no emulador do Firebase antes do piloto.
- Relatórios restantes (trilha, por serviço, por pessoa, lotes, pendências, correções).
- Correção de registro com justificativa (RF19) e exportação em PDF.
- Pergunta aos homônimos (“Esta encomenda é sua?”) para setor a identificar.
- Cartaz de passo a passo para o posto.

**Limitações conhecidas:**
- Sem internet, o registro fica salvo no aparelho; o nº interno é calculado no próprio
  aparelho. Se dois aparelhos registrarem sem internet ao mesmo tempo, pode haver número
  repetido (o painel mostra os dois volumes; basta conferir pelo nome).
- No iPhone, a notificação só funciona com o app adicionado à tela inicial.

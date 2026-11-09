# Encomendas – Corpo da Guarda APMG

App web (PWA, instalável no celular) que substitui o livro físico de encomendas
do Corpo da Guarda da APMG. Piloto: **EsFO**.

- Avisa o destinatário assim que a encomenda é registrada.
- Registra cada etapa até a entrega em mãos (livro digital, sem rasura).
- Monta o lote noturno da EsFO para a sala de TV do Bloco III.
- Custo zero: Firebase (plano gratuito Spark) + GitHub Pages.
- Endereço: https://encomendasapmg-maker.github.io/encomendas-apmg/

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
scripts/enviar-avisos.mjs  rotina de notificações (desligada, ver seção 5)
.github/workflows/         publicar.yml (publicação automática) e avisos.yml (desligado)
```

## 3. Endereço do app

**https://encomendasapmg-maker.github.io/encomendas-apmg/**

O app é publicado automaticamente no GitHub Pages a cada alteração na branch `main`
(arquivo `.github/workflows/publicar.yml`). Não usa nenhuma chave secreta: a
configuração do Firebase que está em `src/firebase.js` é pública por natureza, e a
proteção dos dados fica nas regras do Firestore.

Para rodar no computador (precisa do [Node.js 22](https://nodejs.org)):

```bash
npm install
npm run dev      # abre em http://localhost:5173/encomendas-apmg/
```

## 4. Configuração do Firebase (projeto `encomendas-apmg`) — já feita

- Projeto no plano Spark, Firestore em `southamerica-east1`, login por e-mail/senha.
- App Web "encomendas-web" registrado.
- Regras (`firestore.rules`) publicadas e índices (`firestore.indexes.json`) criados.
  Ao alterar as regras no código, publique de novo em Firestore › **Regras**.
- Domínio `encomendasapmg-maker.github.io` liberado em Authentication › Configurações ›
  Domínios autorizados.

### 4.1 Primeiro administrador
1. Faça o cadastro normal no app (como cadete).
2. Firestore › Dados › coleção `pessoas` › seu documento › mude `perfil` de `cadete` para `admin`.
3. Daí em diante, o perfil dos outros (Oficial de Dia, Conta da Guarda) é trocado no próprio app, em **Gestão › Cadastros**.

### 4.2 Conta da Guarda
A Conta da Guarda é criada pelo próprio cadastro do app — não é preciso mexer no Firebase.
1. No app, **Fazer meu cadastro** com: nome completo "Conta da Guarda", nome de guerra "Guarda",
   número `0000`, qualquer turma e pelotão, e-mail `encomendas.apmg+guarda@gmail.com`
   (apelido do Gmail do projeto: as mensagens chegam na caixa de `encomendas.apmg@gmail.com`)
   e uma senha forte, diferente da senha do Gmail, guardada pelo setor responsável.
2. Confirme o e-mail pelo link que chega no Gmail do projeto.
3. O administrador, em **Gestão › Cadastros**, troca o perfil dessa pessoa para **Conta da Guarda**.
4. Entre com essa conta no celular do posto e adicione o app à tela inicial.
   A Conta da Guarda abre sempre no Modo Guarda e não aparece na busca de destinatários.
5. Se a senha for esquecida, use **Esqueci a senha** na tela de entrar: o link chega no Gmail do projeto.

## 5. Notificações com o app fechado (desligadas)

Nesta versão o app **não envia notificação com o app fechado**. Com o app aberto, a
encomenda aparece na hora; no delivery, a sentinela usa o botão **Avisar pelo WhatsApp**.

O código para ligar as notificações já existe e fica parado:
`scripts/enviar-avisos.mjs`, `.github/workflows/avisos.yml` e `src/dados/notificacoes.js`.
Para ligar no futuro:
1. Firebase › Configurações do projeto › Cloud Messaging › copiar a chave dos
   "Certificados push da Web" para `VITE_FIREBASE_VAPID_KEY` (variável do GitHub e `.env.local`).
2. Firebase › Configurações do projeto › Contas de serviço › **Gerar nova chave privada**
   e guardar o conteúdo no segredo do GitHub `FIREBASE_ADMIN_KEY`
   (Settings › Secrets and variables › Actions). Essa chave é secreta: nunca no código.
3. Criar a variável `AVISOS_ATIVO` = `sim` e incluir a chave VAPID no passo de build do
   `publicar.yml`.

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
cadastros e passagem de ano; contingência; regras de acesso; publicação automática.

**Próximos passos:**
- Ligar as notificações com o app fechado, se o Comando quiser (seção 5).
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

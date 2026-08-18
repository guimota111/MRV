# Consolidação de Briefings de Instalações — MRV

Ferramenta interna que lê as atas das reuniões de briefing de instalações
(água fria, esgoto, drenagem, elétrico, comunicações, aterramento, incêndio),
extrai os temas discutidos em formato estruturado usando a API do Claude, e
acumula tudo num banco para que o histórico cresça entre reuniões — inclusive
apontando quando o **mesmo assunto reaparece em outra obra**.

Substitui o trabalho manual de ler as atas e montar a planilha à mão. A planilha
continua disponível: há exportação `.xlsx` no mesmo formato de antes.

> **Protótipo para demonstração interna.** Sem autenticação nesta fase — veja
> [Segurança](#segurança) antes de colocar dados reais de obra.

## O que ela faz

1. **Recebe a ata** — PDF (inclusive as geradas pelo Autodesk Forma), DOCX ou
   texto colado.
2. **Extrai os temas** com o Claude, via *tool use* com JSON Schema: disciplina,
   tema, contexto, solução, responsável, prazo e status. Nada de parsear texto
   livre.
3. **Salva no Firestore**, organizados por empreendimento e reunião.
4. **Detecta recorrência** — compara os temas novos com **tudo que já está no
   banco** da mesma disciplina, de qualquer empreendimento, e liga os que
   tratam do mesmo assunto mesmo com redação diferente.
5. **Mostra num dashboard** com filtros, busca e gráficos.
6. **Gera relatório** para impressão/PDF e **exporta Excel** em múltiplas abas.

## Arquitetura

```
Navegador (Next.js / App Router)
   │  upload direto do arquivo
   ├──────────────────────────────────►  Firebase Storage   (ata original)
   │  httpsCallable
   ├──────────────────────────────────►  Cloud Functions
   │                                        ├─ processarAta ──────► API Claude
   │                                        ├─ detectarRecorrencia ► API Claude
   │                                        └─ exportarExcel (HTTP)
   │  onSnapshot (tempo real)
   └──────────────────────────────────►  Firestore
```

**A chave da Anthropic vive apenas nas Cloud Functions**, no Secret Manager.
Ela nunca chega ao navegador.

O upload do arquivo vai direto do navegador para o Storage, e não em base64
dentro da chamada da function: as atas manuais em DOCX passam facilmente do
limite de payload das callable functions por causa dos screenshots embutidos.

O dashboard usa `onSnapshot` porque a detecção de recorrência roda depois da
extração — a tela se atualiza sozinha quando os vínculos chegam.

### Estrutura

```
src/                      Next.js (App Router)
  app/                    páginas: /, /dashboard, /empreendimentos/[id],
                          /empreendimentos/[id]/nova-reuniao, /relatorio/[id]
  components/             UI, tabela, filtros, gráficos, recorrentes
  hooks/useDados.ts       assinaturas do Firestore em tempo real
  lib/                    domínio, filtros, agrupamento, cliente das functions
functions/                Cloud Functions (pacote npm separado)
  src/handlers/           processarAta, detectarRecorrencia, exportarExcel
  src/lib/                extração, recorrência, Excel, DOCX, agrupamento
firestore.rules           ⚠️ regras abertas — ver Segurança
storage.rules             ⚠️ regras abertas — ver Segurança
```

`src/lib/domain.ts` e `functions/src/domain.ts` são cópias sincronizadas
manualmente (o `functions/` é um pacote npm separado, com build próprio). O
mesmo vale para `grupos.ts`. Alterou em um, altere no outro.

## Modelo de dados (Firestore)

```
empreendimentos/{id}                nome, localizacao, createdAt
empreendimentos/{id}/reunioes/{id}  data, tipoFonte, arquivoOriginalUrl,
                                    nomeArquivoOriginal, status, totalTemas,
                                    processadoEm, erro
temas/{id}                          empreendimentoId, empreendimentoNome,
                                    reuniaoId, dataReuniao, disciplina, tema,
                                    contexto, solucao, responsavel, prazo,
                                    status, temaRecorrenteDe[], createdAt
```

`temas` é coleção **raiz**, e não subcoleção de reunião, justamente para
permitir as consultas entre empreendimentos que a detecção de recorrência faz.

`temaRecorrenteDe` guarda vínculos par a par. A transitividade (se A↔B e B↔C,
os três são o mesmo assunto) é fechada na leitura, por union-find, em
`lib/grupos.ts`.

## Como rodar

Pré-requisitos: Node 22, um projeto Firebase no plano Blaze (Cloud Functions
exige), e uma chave da API da Anthropic.

```bash
# 1. Dependências
npm install
npm --prefix functions install

# 2. Firebase CLI e projeto
npm install -g firebase-tools
firebase login
firebase use --add            # escolha o projeto e dê o alias "default"

# 3. Configuração do frontend
cp .env.example .env.local    # preencha com os dados do Console → Seus apps

# 4. Chave da Anthropic (fica só no Secret Manager)
firebase functions:secrets:set ANTHROPIC_API_KEY

# 5. Publicar regras e functions
firebase deploy --only firestore:rules,storage,functions

# 6. Rodar o frontend localmente
npm run dev                   # http://localhost:3000
```

### Deploy do frontend (App Hosting)

`apphosting.yaml` já está no repositório com as variáveis a preencher.

```bash
firebase apphosting:backends:create --project <seu-projeto>
```

Depois é só apontar o backend para este repositório/branch — o App Hosting
builda e serve o Next.js com SSR nativo a cada push.

### Verificações

```bash
npm run typecheck && npm run lint && npm test    # frontend
npm --prefix functions run typecheck             # backend
npm --prefix functions test                      # backend (34 testes)
```

## Decisões que valem registro

**`strict: true` está desligado no tool de extração.** Os enums de disciplina
têm valores acentuados e de várias palavras ("Água Fria", "Entrada de
Energia"). Com `strict` ligado, a gramática restrita que a API compila a partir
desses enums faz a geração degenerar quando a ata é um PDF: o modelo devolve um
único tema preenchido com `"placeholder"` em vez da extração real,
reprodutivelmente. Sem `strict`, o mesmo prompt e o mesmo PDF devolvem a
extração completa. Os enums continuam no schema porque orientam a grafia; a
validação fica em `normalizarTemas`, que também tolera acento e caixa
divergentes e traduz os rótulos crus do Forma ("Fechado" → "Resolvido").

**PDF vai inteiro para a API, sem extração local de texto.** A API lê PDF
nativamente, inclusive o que está escrito dentro de croquis e imagens — que é
onde costuma estar parte da informação nas atas do Forma.

**DOCX passa pelo `mammoth`, que descarta as imagens.** As atas manuais são
enormes por causa dos screenshots incorporados, e a informação relevante está
no texto e nas legendas. A conversão preserva a estrutura de seções, que ajuda
o modelo a separar as disciplinas, e transforma células de tabela em `|`.

**A detecção de recorrência é uma segunda chamada, disparada pelo cliente
depois da extração.** Não bloqueia a UI: os temas já estão salvos e visíveis
quando ela começa, e o dashboard se atualiza sozinho quando os vínculos chegam.
Ela é deliberadamente conservadora — um falso positivo polui o painel e custa
mais caro que um falso negativo.

**O painel de um empreendimento assina a base inteira de temas.** Parece
desperdício, mas é o que permite mostrar os grupos recorrentes que cruzam
obras: agrupar só os temas de uma obra esconderia justamente o achado mais
interessante da ferramenta.

## Segurança

As regras em `firestore.rules` e `storage.rules` estão **abertas** — qualquer
pessoa com a URL lê e escreve. Isso vale para a demonstração interna com dados
de exemplo, e **não** para dados reais de obra.

Cada arquivo de regras tem um ponto único de troca (`permitirProtótipo()`) para
quando o Firebase Auth entrar. Restrito ao domínio da MRV, vira:

```
function autorizado() {
  return request.auth != null
         && request.auth.token.email.matches('.*@mrv[.]com[.]br');
}
```

Escritas em `temas/` e `reunioes/` já estão bloqueadas para o navegador: só as
Cloud Functions gravam nelas, via Admin SDK.

Antes de uso em produção, vale também alinhar com o time de segurança da MRV se
dados de obra podem trafegar pela API da Anthropic, e avaliar Zero Data
Retention se necessário.

### Aviso de dependência

`npm audit` reporta um alerta *moderate* em `uuid`, transitivo via `exceljs` e
`firebase-admin`. O `fix --force` rebaixaria o `exceljs` para a v3, que quebra a
geração da planilha. O caminho vulnerável (`uuid` v3/v5/v6 com buffer fornecido)
não é usado por nenhuma das duas bibliotecas aqui. Reavaliar quando o `exceljs`
publicar uma versão com o `uuid` atualizado.

## Fora de escopo nesta fase

- Autenticação (Firebase Auth com Google restrito a `@mrv.com.br`).
- Integração direta com a API do Autodesk Forma para puxar as atas sem upload.

# Asa · Assistente de Tour: contexto do projeto

Este documento passa adiante o projeto Asa para quem for continuar o trabalho (pessoa ou Claude). Ele cobre:

- o que o Asa é e como foi montado;
- o que já está pronto e o que falta;
- as decisões tomadas;
- as preferências do dono.

Tudo foi escrito em 26/11/2026, ao fim da versão 0.2.0, e atualizado na 0.2.1 (mesmo dia). Tudo tem commit e push em `main`.

---

## 1. Como as mudanças chegam ao Asa (decidido em 26/11/2026)

- O Asa roda **só no PC do usuário, direto da pasta do repositório**, `E:\Projetos\pessoal\asa`. O Claude trabalha nessa mesma pasta.
- Por isso **não se usa release nem atualização pelo GitHub**. A mudança vale assim que é feita:
  - mudou só `app\`: o usuário fecha e abre o Asa;
  - mudou `src\Asa.cs`: suba a versão (`Versao` em `src\Asa.cs` e `versao.json`) e recompile com `Compilar.cmd` no Windows. Com o Asa aberto, renomeie antes o exe (`Asa.exe` para `Asa.old.exe`, que o git ignora) e avise o usuário para reabrir.
- Sempre diga ao usuário se basta reabrir ou se o exe foi recompilado.
- O GitHub (`github.com/leof98/asa`, branch `main`) serve só de backup do código: faça commit e push ao fim de cada mudança.
- **Não crie release** nem fale de release, zip ou repositório público. A atualização pelo GitHub foi **retirada na 0.2.1** (o comando `atualizar` do host e a checagem na tela inicial). Se um dia o Asa rodar em outro PC, será preciso refazer um atualizador; o `Empacotar.ps1` ainda gera o zip.
- Ao falar com o usuário sobre atualizar, seja direto: diga só se ele precisa reabrir o Asa. Ele não precisa saber de release.

---

## 2. O que é o Asa

É um programa de Windows (.exe) para o trabalho diário do Leonardo, na Criando Valor, que faz tours virtuais imobiliários com drone. Ele junta duas ferramentas que antes eram páginas HTML soltas no navegador.

**Planos de voo** (antes "Gerador de Plano de Voo"):
- pontos de foto 360° e alturas, num mapa 3D (Cesium + Google Photorealistic 3D Tiles);
- takes de vídeo, simulador e gravação de vídeo (WebCodecs + mp4-muxer);
- previsão do tempo para o dia da captação (Google Weather API);
- PDF e Word (docx) para a equipe.

**Locais próximos** (antes "Locais Próximos"):
- busca mercados, escolas, praias etc. perto do terreno (Google Places API New, searchNearby);
- calcula o tempo a pé ou de carro (Google Routes, computeRouteMatrix);
- tem pré-seleção por nota e por "padrão do empreendimento" (econômico, médio, alto), lugares fixos e redes por padrão;
- gera o documento "Pontos de localização" em PDF e Word, com o papel timbrado da Criando Valor.

O nome é **Asa** e o subtítulo é **Assistente de Tour**. É uma ferramenta de um usuário só, num PC só (o `desk-render` do usuário).

---

## 3. Arquitetura

### Host em C# (`src\Asa.cs`, um arquivo só)
- C# 5, WinForms, .NET Framework 4. Compila com o `csc.exe` que já vem no Windows, pelo `Compilar.cmd`, sem NuGet e sem SDK.
- Usa o WebView2 (`Microsoft.Web.WebView2` 1.0.4191.47). As DLLs ficam na raiz do repositório e vieram de `C:\RenderFarm\WebView2`.
- O host virtual `https://asa.local/` aponta para `<pasta do exe>\app`.
- O perfil do WebView2 fica em `%LOCALAPPDATA%\Asa\WebView2`, então localStorage e IndexedDB persistem entre aberturas.
- A comunicação entre a página e o host é uma RPC:
  - a página chama `chrome.webview.postMessage({id,cmd,a})`;
  - o host responde com `PostWebMessageAsJson`.

  No JS, o caminho é `ASA.chamar(cmd, args)`, que fica em `app\comum.js`.
- Usa também:
  - `ProtectedData` (DPAPI) para a chave do Google, em `chave.bin`;
  - `JavaScriptSerializer` para o JSON;
  - `Microsoft.VisualBasic.FileIO` para mandar arquivos para a Lixeira;
  - `NotifyIcon` para os avisos do Windows;
  - um mutex de instância única;
  - um atalho no Menu Iniciar, criado por `WScript.Shell` via reflection.
- Ao fechar, o host chama `GRAV.agora()` na página e espera cerca de 1,2 s, para a última mudança ser gravada.

**Comandos da RPC:**

| Comando | O que faz |
|---|---|
| `info` | versão e pastas (`pastaProjetos`, `pastaLocais`, `pastaAsa`...) |
| `config.ler` / `config.gravar` | `%LOCALAPPDATA%\Asa\config.json`; a chave vai à parte, protegida por DPAPI |
| `proj.listar` / `ler` / `gravar` / `excluir` / `duplicar` | arquivos `.asa`; com `pasta:"locais"` usa `Documentos\Asa\Locais`, senão `Documentos\Asa\Projetos`. Gravar com outro nome renomeia o arquivo, a pasta de fotos e a miniatura |
| `foto.lista` / `gravar` / `ler` | fotos dos takes de vídeo em `<nome>.fotos\<id>.jpg` |
| `mini.gravar` | miniatura do card em `Projetos\.miniaturas\<nome>.jpg` |
| `modelo.listar` / `gravar` / `renomear` / `excluir` | modelos em `Documentos\Asa\Modelos`. `renomear` grava com o nome novo e apaga o arquivo antigo (sem Lixeira) |
| `contexto` | define o empreendimento atual (`nome`), que decide para onde vão os downloads. Com `arquivo`, define o nome do próximo download (veja a nota abaixo) |
| `pdf` | `PrintToPdfAsync` em A4 (`papel:"a4"`, plano de fotos) ou Carta (plano de vídeo), margem 0, com fundos, gravado em `Documentos\Asa\<nome>\<titulo>.pdf` |
| `pasta.projeto` / `abrir` / `mostrar` | abre pastas e arquivos no Explorer |
| `notificar` | balão do Windows |
| evento `baixado` | a página recebe `asa:baixado` com `{caminho}` ou `{erro}` |

**Downloads:** o `DownloadStarting` manda tudo (Word, vídeo) para `Documentos\Asa\<nome do empreendimento>\` sem perguntar nada.

O WebView2 não aceita acentos no atributo `download`: o arquivo sai como "download", sem extensão. Por isso a página chama `contexto` com `arquivo:"Nome com acentos.docx"` antes do clique e manda o nome sem acentos no `download`. O host troca o nome se a extensão bater.

### Páginas (`app\`)
| Arquivo | Papel |
|---|---|
| `index.html` + `inicio.js` | tela inicial: abas Planos de voo e Locais próximos; engrenagem no canto (Configurações, com os Modelos dentro); cards; busca; ⋯ com "Abrir pasta"; diálogo de novo; previsão a cada 3 h com aviso no Windows. Status no topo só aparece com problema (falta a chave, chuva prevista). Sem filtros e sem importação desde 27/11/2026 |
| `abertura.js` | animação de abertura (veja a seção 5), uma vez por sessão |
| `asa.css`, `comum.js` | identidade visual e funções comuns: `ASA.chamar`, `aviso`, `avisoArquivo`, `escH`, `previsaoDia` |
| `gerador.html` | o gerador de plano de voo (HTML grande, autocontido) com pequenos ajustes para o Asa |
| `ponte.js` + `ponte.css` | ligação do gerador com o Asa (detalhes abaixo) |
| `locais.html` | o Locais Próximos, com ajustes para o Asa e botão Word |
| `ponte-locais.js` | a ponte dos Locais (detalhes abaixo) |
| `asa.svg`, `icone.svg` | a marca (o V do logo da Criando Valor, usado como asa) |

**O que a `ponte.js` faz no gerador:**
- monta a lista de projetos do gerador só com o projeto aberto, a partir de `localStorage['asa.abrir']`;
- intercepta `Storage.prototype.setItem` na chave `planovoo.projetos` e grava em arquivo, com 600 ms de espera;
- mantém o desfazer e refazer;
- sincroniza as fotos com o IndexedDB;
- gera o PDF direto (`ASA_PDF`);
- monta a barra do Asa e os atalhos;
- faz "Salvar como modelo".

**O que a `ponte-locais.js` faz nos Locais:**
- monta a lista só com a lista de locais aberta, a partir de `localStorage['asa.locais']`;
- intercepta `locais.projetos` e grava em `Documentos\Asa\Locais`, deixando de fora os campos que começam com `_`;
- intercepta `locais.v1`, que guarda raio, redes e lugares fixos, e grava em `config.json` (chave `locais`), sem a chave do Google;
- mantém desfazer e refazer, PDF direto e a barra com a etiqueta "LOCAIS PRÓXIMOS".

**Detalhes importantes dos HTML grandes:**
- `gerador.html` e `locais.html` foram gerados por scripts de patch, que não estão no repositório. A partir de agora, edite os arquivos direto.
- No gerador, `loadProject(id)` chama `writeLib()` antes. Para carregar dados novos, a ponte usa um id novo e apaga o velho (função `carregarDados`).
- Nos dois, as variáveis do script da página (`P`, `LIB`, `G`, `save`, `loadProject`, `$`...) são `let`/`const`/`function` de nível superior. As pontes usam essas variáveis direto, então **não declare nas pontes um nome que a página já declara**: dá erro de redeclaração.
- O `docx@9.5.1` (iife) é carregado na hora pelo jsdelivr, e o `mp4-muxer@5.2.2` idem. Precisa de internet.
- O CesiumJS 1.139.0 fica local em `app\cesium\` (sem `index.js`/`index.cjs` e sem as texturas `maki`, `SkyBox` e `NaturalEarthII`). O 3D do Google usa `maximumScreenSpaceError` 8 na edição e 4 no PDF, 18 conexões para `tile.googleapis.com` e `requestRenderMode`.
- Os mapas do PDF ficam guardados em `<projeto>.fotos\mapa-<vista>.jpg`, com a assinatura da vista no localStorage (`asa.mapas`); o PDF seguinte reaproveita o que não mudou (`ASA_MAPA_LER`/`ASA_MAPA_GRAVAR` na `ponte.js`).
- A barra das telas internas tem o ⋯ (`menuAsa` em `comum.js`) com "Salvar como modelo" e "Pasta do empreendimento".
- A barra de título do Windows é pintada na cor da barra do Asa (#1d093a) por `DwmSetWindowAttribute` (atributos 20, 35 e 36), igual à Central.
- `ponte.css` esconde `.top`, `#proj` e `.pbar` das páginas originais, que tinham a chave e a lista de projetos do navegador.

### Pastas do usuário
```
Documentos\Asa\Projetos\<nome>.asa          planos de voo (+ <nome>.fotos\, .miniaturas\)
Documentos\Asa\Locais\<nome>.asa            listas de locais próximos
Documentos\Asa\Modelos\<nome>.asa           modelos de plano
Documentos\Asa\<nome>\                      PDF, Word e vídeos do empreendimento (dos dois)
%LOCALAPPDATA%\Asa\                         config.json, chave.bin (DPAPI), janela.json, WebView2\
```
Formatos dos arquivos `.asa`:
- plano: `{"app":"asa","versao":1,"projeto":{...}}`
- locais: `{"app":"asa","tipo":"locais","versao":1,"locais":{...}}`

### Chaves de localStorage (dentro do perfil do Asa)
- `planovoo.v1`: configuração do gerador, incluindo `key`. A tela inicial grava ali a chave das Configurações.
- `planovoo.projetos`: biblioteca do gerador, com só o projeto aberto.
- `asa.abrir`: projeto que a tela inicial mandou abrir.
- `locais.v1`, `locais.projetos`, `asa.locais`, `asa.locais.ajustes`: o equivalente nos Locais.

---

## 4. Compilar

- **Windows:** `Compilar.cmd`, que usa `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` com `/platform:x64 /target:winexe /win32icon:asa.ico` e as referências do WebView2.
- **Linux com mono**, que foi como as versões 0.1.0 e 0.2.0 foram geradas:
  ```
  R=/usr/lib/mono/4.8-api && mcs -nologo -target:winexe -platform:x64 -optimize+ -langversion:5 -win32icon:asa.ico -out:Asa.exe -r:$R/System.Windows.Forms.dll -r:$R/System.Drawing.dll -r:$R/System.Web.Extensions.dll -r:$R/System.Security.dll -r:$R/System.Net.Http.dll -r:$R/System.IO.Compression.dll -r:$R/System.IO.Compression.FileSystem.dll -r:$R/Microsoft.VisualBasic.dll -r:Microsoft.Web.WebView2.Core.dll -r:Microsoft.Web.WebView2.WinForms.dll src/Asa.cs
  ```
- **Cuidado ao compilar com mono:** as referências `4.8-api` do mono têm sobrecargas que o .NET Framework do Windows não tem, como `string.TrimEnd(char)`. O programa compila, mas no Windows dá "Método não encontrado" na hora de rodar. Isso já aconteceu na 0.2.0 e foi corrigido com `TrimEnd(new char[] { '.' })`. Prefira compilar com o `Compilar.cmd` no Windows. Se usar mono, use as formas com `char[]`.
- Mudanças só em `app\` não precisam compilar: basta reabrir o Asa.
- O `Asa.exe` não pode ser sobrescrito com o programa aberto. O Windows deixa *renomear* o exe em uso: antes de compilar, `ren Asa.exe Asa.old.exe` (o git ignora o `Asa.old.exe`) e depois rode o `Compilar.cmd`. O usuário só precisa reabrir o Asa.

---

## 5. Identidade visual

- Segue a "Central", outro app interno do usuário (`C:\RenderFarm\Central`).
- Tokens de cor:

  | Token | Cor |
  |---|---|
  | palco | `#0b0710` |
  | barra | `#1d093a` |
  | destaque | `#b518d6` |
  | destaque claro | `#ee84d6` |
  | texto | `#f3eef8` |
  | apagado | `#9d91ae` |

- Fonte: Segoe UI.
- **Abertura (aprovada, "v2"):**
  1. toca a animação da Criando Valor;
  2. a "asa" (o V do logo CV) passa varrendo, apaga "CRIANDO VALOR" e deixa "ASA";
  3. aparece "ASSISTENTE DE TOUR".

  Tem cerca de 4 s, toca uma vez por sessão, um clique ou tecla acelera, e é pulada com "reduzir movimento".
- O texto da interface é todo em português do Brasil, simples e direto.

---

## 6. Preferências e decisões do usuário (respeitar)

- **A chave do Google nunca vai no chat.** Ele cola direto no programa (Configurações), que guarda com DPAPI. Nunca pedir, mostrar nem registrar a chave.
- **Não quer cobranças do Google.** Evite chamadas novas ou pagas às APIs. Os Locais já usam Places (searchNearby com rating) e Routes; não aumente o volume.
- **Nome:** "Asa". Ele achou horríveis as primeiras sugestões de nome. "Assistente de Tour" é o subtítulo.
- **Locais próximos:** entrou como **ferramenta separada**, com aba própria na tela inicial e lista própria. Não deve virar uma aba dentro do projeto. A única ligação é que, ao criar uma lista, dá para puxar o terreno (endereço, lat e lon) de um plano de voo. Antes ele tinha dito que não queria os dois integrados; depois pediu para incluir sem ficar confuso, e foi isso que ficou.
- **Escopo da v1** (tudo feito):
  - projetos como arquivos, com gravação automática;
  - tela inicial com recentes, miniatura, busca e filtros;
  - PDF direto, sem a janela de impressão;
  - Word e vídeo salvos direto na pasta;
  - configurações e chave guardadas no programa;
  - atalhos Ctrl+S, Ctrl+P, Ctrl+Z e Ctrl+Y;
  - importação do backup JSON do gerador antigo;
  - previsão com aviso no Windows se o dia da captação virar chuva;
  - modelos reutilizáveis;
  - desfazer e refazer;
  - atualização automática pelo GitHub (retirada na 0.2.1: o Asa roda da pasta do repositório).
- **Atualização:** o Asa roda direto da pasta do repositório, e as mudanças valem ao reabrir (veja a seção 1).

---

## 7. Pendências e pontos de atenção

1. **Atualização pelo GitHub fora de uso** (seção 1). Se um dia voltar a ser usada com o repositório privado, o atualizador precisará de um token guardado por DPAPI.
3. **Sem assinatura digital:** o SmartScreen avisa na primeira abertura. O usuário clica em "Mais informações > Executar assim mesmo".
4. **Testes:** foram feitos com Playwright, com um host simulado (mock da RPC e do sistema de arquivos em localStorage) e o Google simulado. Esses scripts **não estão no repositório**. Nunca rodou num Windows de verdade além de o usuário abrir a 0.1.0, que abriu normalmente.
5. **Versão do Locais Próximos:** a que está no Asa é uma versão anterior. Uma versão mais nova, que gerava Word, se perdeu. O Word foi refeito no Asa.
6. **Word dos Locais:** não inclui as fotos de "Exemplo:" do modelo `Pontos_de_localizacao.docx` do usuário. Inclua se ele pedir.
7. **Miniatura dos cards de plano:** decisão do usuário (26/11/2026): os cartões dos planos mostram **sempre o logo da asa**, sem miniatura do mapa. A geração de miniatura saiu da `ponte.js`, e a tela inicial ignora as que já existem. O comando `mini.gravar` continua no host, sem uso.
8. **Ideia futura,** que ele mencionou, sem compromisso: mais ferramentas no mesmo programa.

---

## 8. Como recuperar a chave do Google (se ele perguntar de novo)

Há dois caminhos.

**No Google Cloud** (o mais simples):
- Abra `console.cloud.google.com/apis/credentials`.
- Em "Chaves de API", clique em "Mostrar chave".

**Pelo gerador antigo no navegador:**
- Abra o gerador antigo, aperte F12 e vá na aba Console.
- Rode:
  ```
  copy(Object.values(localStorage).join(' ').match(/AIza[\w-]{35}/)[0])
  ```
- A chave vai para a área de transferência sem aparecer na tela. Cole direto no Asa.

# Asa · Assistente de Tour

Programa de Windows para montar o plano de voo de tours virtuais com drone: pontos 360°, alturas, takes de vídeo, previsão do tempo, PDF e Word para a equipe.

## Como abrir

Dê dois cliques em `Asa.exe`. Na primeira vez ele cria um atalho no Menu Iniciar.

Se o Windows mostrar o aviso azul do SmartScreen, clique em **Mais informações > Executar assim mesmo**. O aviso aparece porque o programa não tem assinatura digital.

O Asa usa o Microsoft Edge WebView2, que já vem no Windows 10 e 11.

## Primeiro uso

1. Vá em **Configurações > Chave do Google**, cole a chave e clique em **Salvar**. A chave fica guardada protegida pelo Windows, só para o seu usuário. Ela não vai para o GitHub.
2. Para trazer os projetos do gerador antigo (no navegador), faça assim:
   - No gerador antigo, abra cada projeto e use **Exportar cópia de segurança**.
   - No Asa, clique em **Importar** e escolha os arquivos `.json`.

## Onde ficam as coisas

| O quê | Onde |
|---|---|
| Projetos (um arquivo `.asa` por plano, com as fotos ao lado) | `Documentos\Asa\Projetos` |
| Modelos | `Documentos\Asa\Modelos` |
| PDF, Word e vídeos de cada plano | `Documentos\Asa\<nome do plano>` |
| Configurações, chave, posição da janela | `%LOCALAPPDATA%\Asa` |

O projeto grava sozinho a cada mudança. Os atalhos de teclado são:

- **Ctrl+S**: salvar agora
- **Ctrl+P**: gerar PDF
- **Ctrl+Z / Ctrl+Y**: desfazer / refazer

## Estrutura do repositório

```
Asa.exe                          programa pronto
asa.ico                          ícone
Microsoft.Web.WebView2.*.dll     WebView2 (motor da janela)
WebView2Loader.dll
versao.json                      versão atual
app\                             telas (HTML/JS/CSS)
  index.html, inicio.js          tela inicial: projetos, modelos, configurações
  gerador.html                   o gerador de plano de voo
  ponte.js, ponte.css            liga o gerador ao Asa (arquivos, desfazer, PDF)
  comum.js, asa.css, abertura.js identidade visual e animação de abertura
src\Asa.cs                       código do programa (janela, arquivos, PDF, atualização)
Compilar.cmd                     gera o Asa.exe de novo
Empacotar.ps1                    monta o .zip de uma versão
```

Mudanças só nas telas (`app\`) não exigem compilar: basta fechar e abrir o Asa.

## Compilar

Rode `Compilar.cmd`. Ele usa o compilador C# que já vem no Windows (`.NET Framework 4`), sem instalar nada.

## Publicar uma versão (atualização automática)

Ao abrir, o Asa confere a última versão em `github.com/leof98/asa/releases`. Para isso, o repositório precisa ser **público** e cada versão precisa ter um `.zip` anexado.

1. Troque o número da versão em dois lugares:
   - `src\Asa.cs`, na linha `Versao = "..."`
   - `versao.json`
2. Rode `Compilar.cmd`.
3. Rode `Empacotar.ps1`. Ele gera `Asa-<versão>.zip`.
4. No GitHub, vá em **Releases > Draft a new release**:
   - tag `v<versão>`, por exemplo `v0.2.0`
   - anexe o `.zip`
   - clique em **Publish**

Quem estiver com o Asa aberto vê o aviso "versão nova" e atualiza com um clique. Os projetos não são tocados.

# Sitrus Launcher

Launcher do pack **Sitrus Cobblemon** (Minecraft 1.21.1 + Fabric). Instala o pack do Modrinth, conecta em `sitruscobblemon.com` e deixa o jogador escolher extras só de client (mods, texturas e shaders).

- Servidor: `sitruscobblemon.com`
- Wiki: https://wiki-sitruscobblemon.com.br/
- Loja: https://sitruscobblemon.craftingstore.net/
- Discord: https://discord.gg/wbavFswmkr
- Pack: https://modrinth.com/modpack/sitrus-cobblemon

## Como ligar

Precisa do [Node.js LTS](https://nodejs.org).

```bash
npm install
npm start
```

## Como gerar o .exe dos jogadores

```bash
npm run pack
```

Os arquivos saem em `dist/`:

- `Sitrus-Launcher-Setup-*.exe` — instalador. **Use este** para o launcher atualizar sozinho.
- `Sitrus-Launcher-*.exe` — portátil. Cada versão nova precisa baixar de novo.

Quem instalou o Setup não precisa baixar outra vez: ao abrir, o launcher olha as [Releases do GitHub](https://github.com/cmpaixao/sitrus-launcher/releases), baixa a atualização e pede para reiniciar.

Push no `master` dispara o build e publica a release. A primeira vez, quem ainda está na cópia antiga precisa instalar o Setup uma vez.

## O que o jogador faz

1. Abre o `.exe`
2. Entra com Microsoft ou nick offline
3. Clica em **Jogar**

Na primeira vez o launcher baixa Java 21 (se faltar), Minecraft, Fabric e o pack. Com a caixinha **Buscar atualização do modpack** marcada, ele confere versão nova no Modrinth.

A aba **Extras** lista só o que funciona no client, sem precisar estar no servidor.

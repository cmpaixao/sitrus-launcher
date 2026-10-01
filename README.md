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

O arquivo sai em `dist/Sitrus Launcher 1.0.0.exe`. É portátil: o player só baixa e clica. Não precisa de Node, Java, CurseForge ou Modrinth App.

## O que o jogador faz

1. Abre o `.exe`
2. Entra com Microsoft ou nick offline
3. Clica em **Jogar**

Na primeira vez o launcher baixa Java 21 (se faltar), Minecraft, Fabric e o pack. Com a caixinha **Buscar atualização do modpack** marcada, ele confere versão nova no Modrinth.

A aba **Extras** lista só o que funciona no client, sem precisar estar no servidor.

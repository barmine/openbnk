<p align="center">
  <a href="https://openbnk.local">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenBnk logo">
    </picture>
  </a>
</p>
<p align="center">OpenBnk je open source AI agent za programiranje.</p>
<p align="center">
  <a href="https://openbnk.local/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@openbnk/cli"><img alt="npm" src="https://img.shields.io/npm/v/@openbnk/cli?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/openbnk/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/openbnk/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenBnk Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://openbnk.local)

---

### Instalacija

```bash
# YOLO
curl -fsSL https://openbnk.local/v2/install | bash

# Package manageri
npm i -g @openbnk/cli@latest      # ili bun/pnpm/yarn
brew install anomalyco/tap/openbnk-v2 # macOS i Linux (preporučeno, uvijek ažurno)
brew install openbnk              # macOS i Linux (zvanična brew formula, rjeđe se ažurira)
sudo pacman -S openbnk            # Arch Linux (Stable)
paru -S openbnk-beta              # Arch Linux (Latest from AUR)
mise use -g openbnk               # Bilo koji OS
nix run github:anomalyco/openbnk  # Nix
```

> [!TIP]
> Ukloni verzije starije od 0.1.x prije instalacije.

### Desktop aplikacija (BETA)

OpenBnk je dostupan i kao desktop aplikacija. Preuzmi je sa [openbnk.local/download](https://openbnk.local/download).

| Platforma             | Preuzimanje                        |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `openbnk-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `openbnk-desktop-mac-x64.dmg`     |
| Windows               | `openbnk-desktop-win-x64.exe`     |
| Linux                 | `.deb`, `.rpm`, ili AppImage       |

```bash
# macOS (Homebrew)
brew install --cask openbnk-desktop
```

#### Instalacijski direktorij

Instalacijska skripta koristi sljedeći redoslijed prioriteta za putanju instalacije:

1. `$OPENBNK_INSTALL_DIR` - Prilagođeni instalacijski direktorij
2. `$XDG_BIN_DIR` - Putanja usklađena sa XDG Base Directory specifikacijom
3. `$HOME/bin` - Standardni korisnički bin direktorij (ako postoji ili se može kreirati)
4. `$HOME/.openbnk/bin` - Podrazumijevana rezervna lokacija

```bash
# Primjeri
OPENBNK_INSTALL_DIR=/usr/local/bin curl -fsSL https://openbnk.local/v2/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://openbnk.local/v2/install | bash
```

### Agenti

OpenBnk uključuje dva ugrađena agenta između kojih možeš prebacivati tasterom `Tab`.

- **build** - Podrazumijevani agent sa punim pristupom za razvoj
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Podrazumijevano zabranjuje izmjene datoteka
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za istraživanje nepoznatih codebase-ova ili planiranje izmjena

Uključen je i **general** pod-agent za složene pretrage i višekoračne zadatke.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

Saznaj više o [agentima](https://openbnk.local/docs/agents).

### Dokumentacija

Za više informacija o konfiguraciji OpenBnk-a, [**pogledaj dokumentaciju**](https://openbnk.local/docs).

### Doprinosi

Ako želiš doprinositi OpenBnk-u, pročitaj [upute za doprinošenje](./CONTRIBUTING.md) prije slanja pull requesta.

### Gradnja na OpenBnk-u

Ako radiš na projektu koji je povezan s OpenBnk-om i koristi "openbnk" kao dio naziva, npr. "openbnk-dashboard" ili "openbnk-mobile", dodaj napomenu u svoj README da projekat nije napravio OpenBnk tim i da nije povezan s nama.

---

**Pridruži se našoj zajednici** [Discord](https://discord.gg/openbnk) | [X.com](https://x.com/openbnk)

# Échiquier

Une application web pour jouer aux échecs contre Stockfish et résoudre des puzzles tactiques. Tout tourne dans le navigateur : aucun serveur, aucun backend, un seul fichier `index.html` plus un dossier de données.

## Ce qu'il y a dedans

- **Règles complètes écrites à la main** (roque, prise en passant, promotion, pat, nulle par répétition / 50 coups / matériel insuffisant). Zéro dépendance JS externe — validé par des tests perft jusqu'à la profondeur 4 sur quatre positions de référence.
- **Stockfish 18 en WebAssembly** comme adversaire, avec 6 niveaux (`Skill Level` + `UCI_Elo`).
- **Barre d'évaluation** et **sortie UCI brute** en direct (profondeur, nœuds, variante principale).
- Glisser-déposer ou clic-clic, pivot du plateau, annulation, indice, export PGN.
- **Moteur de repli intégré** (négamax alpha-bêta) : si Stockfish ne charge pas, la partie reste jouable.
- **Mode puzzles** : 132 000 puzzles Lichess, elo adaptatif, filtrage par thème, puzzle du jour, progression sauvegardée en local.

## Mode puzzles

L'onglet **Puzzles** rejoue des positions tirées de la [base Lichess](https://database.lichess.org/#puzzles) (CC0).

- **Elo adaptatif** : chaque puzzle est noté ; réussite ou échec font bouger ton propre elo (formule Elo classique, K = 24), et les puzzles proposés suivent ton niveau. Un puzzle ne compte comme réussi que s'il est trouvé sans erreur, sans indice et sans solution.
- **Thèmes** : mats en 1/2/3, fourchette, clouage, enfilade, sacrifice, finales… le filtre restreint le tirage.
- **Puzzle du jour** : tiré de façon déterministe à partir de la date, donc identique pour tout le monde.
- **Indices** en deux temps : d'abord la pièce à jouer, puis la case d'arrivée.
- **Progression** (elo, résolus, série, record) stockée dans `localStorage` — rien ne quitte le navigateur.

Convention du format Lichess : le FEN est la position *avant* le coup de l'adversaire. L'app joue donc automatiquement le premier coup de la séquence pour amener la position, et le joueur enchaîne à partir du deuxième.

### Les données

`puzzles/` contient `index.json` (liste des thèmes et inventaire des tranches) et un fichier par tranche de rating (`band-400.json` … `band-2600.json`), soit **14 Mo au total**. Une tranche n'est téléchargée que lorsqu'elle sert : une session ne coûte en général qu'un fichier d'environ 1,3 Mo, bien moins une fois gzippé par l'hébergeur.

Le dump complet de Lichess fait 6 millions de puzzles pour 1,1 Go décompressé — trop lourd à embarquer, et au-delà du quota gratuit d'une base hébergée. Le script `build-puzzles.mjs` en extrait un échantillon équilibré : 12 000 puzzles par tranche de 200 points d'elo, filtrés sur la popularité et le nombre de parties jouées. Pour régénérer les données :

```bash
# 1. récupérer et décompresser le dump
curl -LO https://database.lichess.org/lichess_db_puzzle.csv.zst
zstd -d lichess_db_puzzle.csv.zst

# 2. ajuster SRC et OUT en tête du script, puis
node build-puzzles.mjs
```

Le tirage est déterministe : même CSV en entrée, mêmes puzzles en sortie.

## Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "Échiquier"
git branch -M main
git remote add origin git@github.com:<ton-user>/<ton-repo>.git
git push -u origin main
```

Puis dans le repo : **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.

Le site est en ligne sur `https://<ton-user>.github.io/<ton-repo>/` après une minute ou deux.

## Installer le moteur en local (recommandé)

L'app cherche Stockfish dans cet ordre :

1. `engine/stockfish-18-lite-single.js` (même origine) ← **le plus fiable**
2. `engine/stockfish.js`
3. jsDelivr (CDN) — dépannage, peut échouer selon le navigateur
4. moteur de repli intégré

Le chargement depuis un CDN passe par un `Worker` blob + `importScripts`, ce qui marche la plupart du temps mais dépend de la façon dont Emscripten résout le chemin du `.wasm`. Héberger les fichiers toi-même supprime le problème :

```bash
mkdir -p engine && cd engine
BASE=https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0
curl -LO $BASE/stockfish-18-lite-single.js
curl -LO $BASE/stockfish-18-lite-single.wasm
```

Les deux fichiers doivent rester **côte à côte** dans `engine/` (le `.js` va chercher le `.wasm` à côté de lui). La version *lite single-threaded* fait environ 7 Mo — sous la limite de 100 Mo par fichier de GitHub, et elle n'exige aucun en-tête HTTP particulier.

### Pourquoi pas la version multi-thread ?

La version complète est plus forte, mais elle a besoin de `SharedArrayBuffer`, donc des en-têtes `Cross-Origin-Opener-Policy: same-origin` et `Cross-Origin-Embedder-Policy: require-corp`. GitHub Pages ne permet pas d'ajouter des en-têtes. Deux options si tu y tiens :

- ajouter [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) (un service worker qui simule l'isolation cross-origin) ;
- passer sur Cloudflare Pages ou Netlify, qui acceptent un fichier `_headers`.

Pour jouer, la version *lite* est déjà largement au-dessus du niveau humain.

## Développer en local

Ouvrir `index.html` avec `file://` ne fonctionne pas : les Web Workers exigent une vraie origine. Sers le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Licence

Le code de l'application est à toi. **Stockfish est sous GPLv3** : si tu redistribues les fichiers du moteur, garde la mention de licence et publie les sources. Voir [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).

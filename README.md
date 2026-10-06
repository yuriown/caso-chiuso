# Caso Chiuso!

*Caso chiuso* é italiano para "caso encerrado". Jogo de navegador para 1 ou 2 pessoas. A advogada **Mahayana** (loira, olhos verdes) arremessa livros do alto da sacada; o **bandido** tenta atravessar o labirinto e fugir pela saída verde.

**Jogue agora:** https://yuriown.github.io/caso-chiuso/

## Como jogar

| Papel | Controle | Objetivo |
|---|---|---|
| Mahayana | mouse: mirar e clicar | acertar 3 livros no bandido, ou segurar até o tempo acabar |
| Bandido | WASD ou setas | chegar à **SAÍDA** antes de 60 s |

- O círculo vermelho mostra onde o livro vai cair: o bandido pode desviar.
- Mahayana tem 5 livros, que voltam sozinhos com o tempo.
- Após levar um livro, o bandido fica tonto por um instante e depois pisca invulnerável.
- **M** liga/desliga o som · **P**, **Esc** ou o botão **II** pausa · **Q** (na pausa) volta ao menu.

### No celular

- Jogue com o celular na horizontal; em pé aparece um aviso para girar. No menu há um botão de **tela cheia** (Android).
- **Mahayana:** toque no labirinto para arremessar.
- **Bandido:** analógico virtual. Ele nasce onde o dedo toca e vira uma das 8 direções, como o teclado.
- **2P no mesmo celular:** o analógico do bandido fica na metade esquerda da sacada; a Mahayana toca no labirinto.

Modos: `1P Ser a Mahayana` (CPU é o bandido), `1P Ser o Bandido` (CPU é a Mahayana) e `2P` no mesmo computador. A dificuldade vale para a CPU.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # testes do labirinto e da IA
npm run build      # gera dist/ estático
```

O `dist/` é estático. A cada push na `main`, o GitHub Actions roda os testes, gera o build e publica a demo no GitHub Pages (`.github/workflows/deploy.yml`).

## Tecnologia

- **Phaser 4** (motor 2D, WebGL) + **TypeScript** + **Vite**; testes com **Vitest**.
- **Nenhum arquivo de asset**: os sprites são pixel art escrita como texto em `src/game/textures.ts`, os tiles são pintados em canvas, e música e efeitos são sintetizados com Web Audio em `src/game/audio.ts`.
- Labirinto novo a cada rodada (backtracking + algumas paredes removidas para criar rotas alternativas) em `src/game/maze.ts`.
- IA em `src/game/ai.ts`: o bandido segue o menor caminho e desvia dos livros que vê chegando; a Mahayana prevê onde o bandido vai estar quando o livro cair. O equilíbrio é medido em `ai.test.ts`, com 200 partidas CPU x CPU por dificuldade.

## Trocar a arte depois

Para usar sprites desenhados à mão no lugar da pixel art gerada, basta carregar imagens com as mesmas chaves (`mahayana-idle`, `mahayana-throw`, `bandit-0`, `bandit-1`, `book`, `wall`…) num `preload()` da `BootScene`; `createTextures` não sobrescreve chaves que já existem. Boas fontes gratuitas: [Kenney](https://kenney.nl/assets), [itch.io (assets gratuitos)](https://itch.io/game-assets/free) e [OpenGameArt](https://opengameart.org).

import { Chess } from "chess.js";

export class ChessEngine {
  static createGame() {
    return new Chess();
  }

  static getFen(game: Chess) {
    return game.fen();
  }

  static getPgn(game: Chess) {
    return game.pgn();
  }

  static getTurn(game: Chess) {
    return game.turn();
  }

  static getLegalMoves(game: Chess) {
    return game.moves();
  }

  static makeMove(game: Chess, from: string, to: string, promotion = "q") {
    return game.move({
      from,
      to,
      promotion,
    });
  }

  static isGameOver(game: Chess) {
    return game.isGameOver();
  }

  static isCheckmate(game: Chess) {
    return game.isCheckmate();
  }

  static isDraw(game: Chess) {
    return game.isDraw();
  }

  static getWinner(game: Chess) {
    if (!game.isCheckmate()) {
      return null;
    }

    return game.turn() === "w" ? "black" : "white";
  }
}

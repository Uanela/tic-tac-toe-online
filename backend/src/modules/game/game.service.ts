import { BaseService } from "arkos/services";

class GameService extends BaseService<"game"> {
  async createGame(playerOneId: string, playerTwoId: string) {
    return this.createOne({ playerOneId, playerTwoId, type: "TicTacToe" });
  }

  async finishGame(
    gameId: string,
    result: "PlayerOneWin" | "PlayerTwoWin" | "Draw"
  ) {
    return this.updateOne({ id: gameId }, { result });
  }
}

const gameService = new GameService("game");

export default gameService;

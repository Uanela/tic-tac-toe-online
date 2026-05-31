import { ArkosGateway } from "arkos/websockets";
import ticTacToeController from "../controllers/tic-tac-toe.controller";

const tictactoeGateway = ArkosGateway({
  name: "/tic-tac-toe",
  authentication: true,
  dedup: false,
});

tictactoeGateway.hook("connection", () => {
  console.log("trying connect");
});

tictactoeGateway.pipe((_, data) => {
  console.log(data, "the pipe");
});

tictactoeGateway.on({ event: "join_game", ack: true }, (socket, data, ack) => {
  ticTacToeController.joinGame(socket, data, ack, tictactoeGateway);
});

tictactoeGateway.on({ event: "make_move", ack: true }, (socket, data, ack) => {
  ticTacToeController.makeMove(socket, data, ack, tictactoeGateway);
});

tictactoeGateway.hook("disconnect", (socket) => {
  ticTacToeController.onDisconnect(socket, tictactoeGateway);
});

export default tictactoeGateway;

import { ArkosGateway } from "arkos/websockets";
import ticTacToeController from "../controllers/tic-tac-toe.controller";

const tictactoeGateway = ArkosGateway({
  name: "/tic-tac-toe",
  authentication: true,
  dedup: false,
});

tictactoeGateway.on(
  { event: "join_game", ack: true },
  ticTacToeController.joinGame
);
tictactoeGateway.on(
  { event: "send_invite", ack: true },
  ticTacToeController.sendInvite
);
tictactoeGateway.on(
  { event: "accept_invite", ack: true },
  ticTacToeController.acceptInvite
);
tictactoeGateway.on(
  { event: "decline_invite", ack: true },
  ticTacToeController.declineInvite
);
tictactoeGateway.on(
  { event: "cancel_invite", ack: true },
  ticTacToeController.cancelInvite
);
tictactoeGateway.on(
  { event: "leave_queue", ack: true },
  ticTacToeController.leaveQueue
);
tictactoeGateway.on(
  { event: "leave_game", ack: true },
  ticTacToeController.leaveGame
);
tictactoeGateway.on(
  { event: "make_move", ack: true },
  ticTacToeController.makeMove
);

tictactoeGateway.hook("connection", ticTacToeController.onConnect);
tictactoeGateway.hook("disconnect", ticTacToeController.onDisconnect);

export default tictactoeGateway;

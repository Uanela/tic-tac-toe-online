import { ArkosGateway } from "arkos/websockets";
import tictactoeGateway from "./modules/game/gateways/tic-tac-toe.gateway";

const gateway = ArkosGateway({ name: "/" });

gateway.use(tictactoeGateway);

export default gateway;

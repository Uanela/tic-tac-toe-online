import { Player } from "@prisma/client";
import { BaseService } from "arkos/services";
import userService from "../user/user.service";
import ticTacToeService from "../game/services/tic-tac-toe.service";
import botIdentity from "./bot-identity";

class PlayerBotService extends BaseService<"player"> {
  async isBotUser(userId: string): Promise<boolean> {
    return !!(await this.findOne({ userId, type: "Bot" }));
  }

  findAvailable() {
    return this.findMany(
      { type: "Bot", userId: { notIn: ticTacToeService.seatedBotUserIds() } },
      { omit: { type: true } }
    );
  }

  async findOrCreateBot() {
    const available = await this.findAvailable();
    if (available.length > 0)
      return available[Math.floor(Math.random() * available.length)];

    return this.createBot();
  }

  private async createBot(): Promise<Player> {
    const identity = await botIdentity.nextUnused(async ({ email, nickname }) => {
      const [nicknameTaken, emailTaken] = await Promise.all([
        this.findOne({ nickname }),
        userService.findOne({ email }),
      ]);
      return !!nicknameTaken || !!emailTaken;
    });

    const { player } = await userService.createOne(
      {
        email: identity.email,
        password: identity.password,
        role: "Player",
        player: {
          create: {
            nickname: identity.nickname,
            type: "Bot",
          },
        },
      },
      { include: { player: true } }
    );

    return player as Player;
  }
}

const playerBotService = new PlayerBotService("player");

export default playerBotService;

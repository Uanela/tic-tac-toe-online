import { authService } from "arkos/services";
import prisma from "../../src/utils/prisma";
import botIdentity from "../../src/modules/player/bot-identity";

const BOT_COUNT = 100;

const takenNicknames = new Set(
  (await prisma.player.findMany({ select: { nickname: true } })).map(
    (player) => player.nickname
  )
);
const takenEmails = new Set(
  (await prisma.user.findMany({ select: { email: true } })).map((user) => user.email)
);

const existingBots = await prisma.player.count({ where: { type: "Bot" } });
const missingBots = Math.max(0, BOT_COUNT - existingBots);

for (let i = 0; i < missingBots; i++) {
  const identity = await botIdentity.nextUnused(
    async ({ nickname, email }) =>
      takenNicknames.has(nickname) || takenEmails.has(email)
  );

  await prisma.user.create({
    data: {
      email: identity.email,
      password: await authService.hashPassword(identity.password),
      role: "Player",
      player: { create: { nickname: identity.nickname, type: "Bot" } },
    },
  });

  takenNicknames.add(identity.nickname);
  takenEmails.add(identity.email);
}

console.log(
  `Bot players ready: ${existingBots + missingBots} (created ${missingBots}).`
);

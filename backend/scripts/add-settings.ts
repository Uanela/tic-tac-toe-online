import prisma from "../src/utils/prisma";

for (const player of await prisma.player.findMany()) {
  await prisma.player.update({
    where: {
      id: player.id,
    },
    data: {
      settings: {
        create: {},
      },
    },
  });
}

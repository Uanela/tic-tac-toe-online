import prisma from "../src/utils/prisma";

// PlayerSettings.playerId is unique, so re-running this over every player would
// throw on the ones that already have a row.
const players = await prisma.player.findMany({
  where: { settings: { is: null } },
  select: { id: true },
});

for (const player of players) {
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

console.log(`Created settings for ${players.length} player(s).`);

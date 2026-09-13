import { PrismaQueryOptions } from "arkos/prisma";
import { Prisma } from "@prisma/client";

const playerQueryOptions: PrismaQueryOptions<Prisma.PlayerDelegate> = {
  global: {
    omit: {
      type: true,
    },
  },
  find: {},
  findOne: {},
  findMany: {},
  update: {},
  updateMany: {},
  updateOne: {},
  create: {},
  createMany: {},
  createOne: {},
  save: {},
  saveMany: {},
  saveOne: {},
  delete: {},
  deleteMany: {},
  deleteOne: {},
};

export default playerQueryOptions;

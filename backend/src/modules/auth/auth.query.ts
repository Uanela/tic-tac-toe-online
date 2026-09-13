import { Prisma } from "@prisma/client";
import { AuthPrismaQueryOptions } from "arkos/prisma";

const authQueryOptions: AuthPrismaQueryOptions<Prisma.UserDelegate> = {
  getMe: {
    omit: {
      password: true,
    },
    include: {
      player: {
        omit: {
          type: true,
        },
        include: {
          settings: {
            include: {
              notificationPreferences: true,
            },
          },
        },
      },
    },
  },
  updateMe: {
    omit: {
      password: true,
    },
  },
  deleteMe: {},
  login: {},
  signup: {
    omit: {
      password: true,
    },
  },
  updatePassword: {},
};

export default authQueryOptions;

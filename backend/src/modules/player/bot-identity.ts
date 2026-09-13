import { faker } from "@faker-js/faker";

const BOT_SEED = 20260101;

export interface BotIdentity {
  email: string;
  nickname: string;
  password: string;
}

class BotIdentityFactory {
  constructor() {
    faker.seed(BOT_SEED);
  }

  next(): BotIdentity {
    return {
      email: faker.internet.email().toLowerCase(),
      nickname: faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toLowerCase(),
      password: faker.internet.password({ length: 32 }),
    };
  }

  async nextUnused(
    isTaken: (identity: BotIdentity) => Promise<boolean>
  ): Promise<BotIdentity> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const identity = this.next();
      if (!(await isTaken(identity))) return identity;
    }
    throw new Error("Could not generate an unused bot identity.");
  }
}

const botIdentity = new BotIdentityFactory();

export default botIdentity;

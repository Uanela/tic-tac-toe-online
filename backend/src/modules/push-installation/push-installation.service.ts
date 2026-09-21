import { BaseService } from "arkos/services";

class PushInstallationService extends BaseService<"push-installation"> {
  /** Only browsers that said yes: a refusal is a record, not a destination. */
  async installationsFor(userId: string) {
    const rows = await this.prisma.pushInstallation.findMany({
      where: { userId, status: "Granted" },
      select: { installationId: true },
    });

    return rows.map((row) => row.installationId);
  }

  /** Granting anywhere retires the refusals: this player wants to be reached. */
  async register(userId: string, installationId: string) {
    await this.prisma.pushInstallation.deleteMany({
      where: { userId, status: "Denied" },
    });

    return this.prisma.pushInstallation.upsert({
      where: { installationId },
      create: { userId, installationId },
      update: { userId, status: "Granted" },
    });
  }

  /** A refusal also settles email: it is the one channel left, and they said no. */
  async deny(userId: string, installationId: string) {
    return this.prisma.pushInstallation.upsert({
      where: { installationId },
      create: { userId, installationId, status: "Denied" },
      update: { userId, status: "Denied" },
    });
  }

  /** False when this player has refused push, which leaves challenges as their only mail. */
  async emailAllowed(userId: string) {
    const refusal = await this.prisma.pushInstallation.findFirst({
      where: { userId, status: "Denied" },
      select: { id: true },
    });

    return !refusal;
  }

  async remove(userId: string, installationId: string) {
    await this.prisma.pushInstallation.deleteMany({
      where: { userId, installationId },
    });
  }

  /** Only for installations FCM has told us are dead, so a transient failure keeps them. */
  async forget(installationIds: string[]) {
    if (!installationIds.length) return;

    await this.prisma.pushInstallation.deleteMany({
      where: { installationId: { in: installationIds } },
    });
  }
}

const pushInstallationService = new PushInstallationService(
  "push-installation",
);

export default pushInstallationService;

import { BaseService } from "arkos/services";
import type { PushPermissionStatus } from "@prisma/client";

class PushInstallationService extends BaseService<"push-installation"> {
  async installationsFor(userId: string) {
    const rows = await this.findMany(
      { userId, status: "Granted" },
      { select: { installationId: true } }
    );

    return rows.map((row) => row.installationId);
  }

  async register(userId: string, installationId: string) {
    await this.deleteMany({ userId, status: "Denied" });

    return this.put(userId, installationId, "Granted");
  }

  async deny(userId: string, installationId: string) {
    return this.put(userId, installationId, "Denied");
  }

  async emailAllowed(userId: string) {
    const refusal = await this.findOne(
      { userId, status: "Denied" },
      { select: { id: true } }
    );

    return !refusal;
  }

  async remove(userId: string, installationId: string) {
    await this.deleteMany({ userId, installationId });
  }

  async forget(installationIds: string[]) {
    if (!installationIds.length) return;

    await this.deleteMany({ installationId: { in: installationIds } });
  }

  private async put(
    userId: string,
    installationId: string,
    status: PushPermissionStatus
  ) {
    const existing = await this.findOne(
      { installationId },
      { select: { id: true } }
    );

    if (existing) return this.updateById(existing.id, { userId, status });

    return this.createOne({ userId, installationId, status });
  }
}

const pushInstallationService = new PushInstallationService(
  "push-installation",
);

export default pushInstallationService;

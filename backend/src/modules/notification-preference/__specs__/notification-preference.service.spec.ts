import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  NotificationPreferenceStatus,
  NotificationPreferenceCategory,
} from "@prisma/client";
import notificationPreferenceService from "../notification-preference.service";

const onDay = async (weekDay: number, run: () => Promise<boolean>) => {
  const OriginalDate = global.Date;

  (global as any).Date = class extends OriginalDate {
    getDay() {
      return weekDay;
    }
  };

  try {
    return await run();
  } finally {
    (global as any).Date = OriginalDate;
  }
};

describe("NotificationPreferenceService", () => {
  it("should return true if no preference exists for the category", async () => {
    const result = await notificationPreferenceService.canNotify(
      [],
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, true);
  });

  it('should return false for "Never" status', async () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Never,
      },
    ];
    const result = await notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, false);
  });

  it("should only apply a preference to the category it names", async () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Never,
      },
    ];
    const result = await notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.Annoucements
    );
    assert.strictEqual(result, true);
  });

  it('should return true for "Always" status regardless of day', async () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Always,
      },
    ];
    const result = await notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, true);
  });

  it('should handle "Once" (Wednesday/3) correctly', async () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Once,
      },
    ];

    const result = await onDay(3, () =>
      notificationPreferenceService.canNotify(
        prefs,
        NotificationPreferenceCategory.MorningDailyRemainder
      )
    );

    assert.strictEqual(result, true);
  });

  it("should return false when day does not match status schedule", async () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Twice,
      },
    ]; // Days 2, 5

    const result = await onDay(1, () =>
      notificationPreferenceService.canNotify(
        prefs,
        NotificationPreferenceCategory.MorningDailyRemainder
      )
    );

    assert.strictEqual(result, false);
  });
});

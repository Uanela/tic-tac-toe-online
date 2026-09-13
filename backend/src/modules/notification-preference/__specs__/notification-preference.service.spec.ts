import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  NotificationPreferenceStatus,
  NotificationPreferenceCategory,
} from "@prisma/client";
import notificationPreferenceService from "../notification-preference.service";

describe("NotificationPreferenceService", () => {
  it("should return true if no preference exists for the category", () => {
    const result = notificationPreferenceService.canNotify(
      [],
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, true);
  });

  it('should return false for "Never" status', () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Never,
      },
    ];
    const result = notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, false);
  });

  it('should return true for "Always" status regardless of day', () => {
    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Always,
      },
    ];
    const result = notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );
    assert.strictEqual(result, true);
  });

  it('should handle "Once" (Wednesday/3) correctly', () => {
    const originalDate = global.Date;
    (global as any).Date = class extends Date {
      getDay() {
        return 3;
      }
    };

    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Once,
      },
    ];
    const result = notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );

    assert.strictEqual(result, true);
    (global as any).Date = originalDate;
  });

  it("should return false when day does not match status schedule", () => {
    const originalDate = global.Date;
    (global as any).Date = class extends Date {
      getDay() {
        return 1;
      }
    };

    const prefs = [
      {
        category: NotificationPreferenceCategory.MorningDailyRemainder,
        status: NotificationPreferenceStatus.Twice,
      },
    ]; // Days 2, 5
    const result = notificationPreferenceService.canNotify(
      prefs,
      NotificationPreferenceCategory.MorningDailyRemainder
    );

    assert.strictEqual(result, false);
    (global as any).Date = originalDate;
  });
});

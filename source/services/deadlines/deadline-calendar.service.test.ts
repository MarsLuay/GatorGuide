import assert from "node:assert/strict";
import test from "node:test";
import { deadlineCalendarService, type DeadlineCalendarEntry } from "./deadline-calendar.service";

test("deadlineCalendarService", async (t) => {
  await t.test("filterUpcomingEntries", async (t) => {
    await t.test("filters out completed entries", () => {
      const entries: DeadlineCalendarEntry[] = [
        {
          id: "1",
          dateKey: "2099-01-01",
          dueAt: "2099-01-01T00:00:00Z",
          title: "Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: true,
          target: { type: "personal", personalId: "1" },
        },
      ];

      const filtered = deadlineCalendarService.filterUpcomingEntries(entries);
      assert.strictEqual(filtered.length, 0);
    });

    await t.test("filters out entries outside the window", () => {
      const now = new Date();
      now.setDate(now.getDate() + 200); // 200 days in the future (default window is 180)

      const entries: DeadlineCalendarEntry[] = [
        {
          id: "1",
          dateKey: now.toISOString().split("T")[0],
          dueAt: now.toISOString(),
          title: "Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
      ];

      const filtered = deadlineCalendarService.filterUpcomingEntries(entries);
      assert.strictEqual(filtered.length, 0);
    });

    await t.test("filters out past entries", () => {
      const now = new Date();
      now.setDate(now.getDate() - 1); // Yesterday

      const entries: DeadlineCalendarEntry[] = [
        {
          id: "1",
          dateKey: now.toISOString().split("T")[0],
          dueAt: now.toISOString(),
          title: "Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
      ];

      const filtered = deadlineCalendarService.filterUpcomingEntries(entries);
      assert.strictEqual(filtered.length, 0);
    });

    await t.test("keeps valid upcoming entries", () => {
      const now = new Date();
      now.setDate(now.getDate() + 10); // 10 days in the future

      const entries: DeadlineCalendarEntry[] = [
        {
          id: "1",
          dateKey: now.toISOString().split("T")[0],
          dueAt: now.toISOString(),
          title: "Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
      ];

      const filtered = deadlineCalendarService.filterUpcomingEntries(entries);
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, "1");
    });

    await t.test("sorts entries correctly", () => {
      const now = new Date();

      const day1 = new Date(now);
      day1.setDate(now.getDate() + 1);

      const day2 = new Date(now);
      day2.setDate(now.getDate() + 2);

      const entries: DeadlineCalendarEntry[] = [
        {
          id: "2",
          dateKey: day2.toISOString().split("T")[0],
          dueAt: day2.toISOString(),
          title: "B Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "2" },
        },
        {
          id: "1",
          dateKey: day1.toISOString().split("T")[0],
          dueAt: day1.toISOString(),
          title: "A Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
        {
          id: "3",
          dateKey: day1.toISOString().split("T")[0],
          dueAt: day1.toISOString(),
          title: "C Test",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "3" },
        },
      ];

      const filtered = deadlineCalendarService.filterUpcomingEntries(entries);
      assert.strictEqual(filtered.length, 3);
      assert.strictEqual(filtered[0].id, "1"); // Earlier date, earlier title
      assert.strictEqual(filtered[1].id, "3"); // Earlier date, later title
      assert.strictEqual(filtered[2].id, "2"); // Later date
    });
  });

  await t.test("groupEntries", async (t) => {
    await t.test("groups entries by dateKey", () => {
      const entries: DeadlineCalendarEntry[] = [
        {
          id: "1",
          dateKey: "2099-01-01",
          dueAt: "2099-01-01T10:00:00Z",
          title: "Test 1",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
        {
          id: "2",
          dateKey: "2099-01-02",
          dueAt: "2099-01-02T10:00:00Z",
          title: "Test 2",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "2" },
        },
        {
          id: "3",
          dateKey: "2099-01-01",
          dueAt: "2099-01-01T12:00:00Z",
          title: "Test 3",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "3" },
        },
      ];

      const groups = deadlineCalendarService.groupEntries(entries);

      assert.strictEqual(groups.length, 2);

      assert.strictEqual(groups[0].dateKey, "2099-01-01");
      assert.strictEqual(groups[0].items.length, 2);
      assert.strictEqual(groups[0].items[0].id, "1"); // 10:00 is before 12:00
      assert.strictEqual(groups[0].items[1].id, "3");

      assert.strictEqual(groups[1].dateKey, "2099-01-02");
      assert.strictEqual(groups[1].items.length, 1);
      assert.strictEqual(groups[1].items[0].id, "2");
    });

    await t.test("sorts groups by first dueAt", () => {
      const entries: DeadlineCalendarEntry[] = [
        {
          id: "2",
          dateKey: "2099-01-02",
          dueAt: "2099-01-02T10:00:00Z",
          title: "Test 2",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "2" },
        },
        {
          id: "1",
          dateKey: "2099-01-01",
          dueAt: "2099-01-01T10:00:00Z",
          title: "Test 1",
          subtitle: "",
          description: "",
          kind: "general_deadline",
          sourceLabel: "",
          isDone: false,
          target: { type: "personal", personalId: "1" },
        },
      ];

      const groups = deadlineCalendarService.groupEntries(entries);

      assert.strictEqual(groups.length, 2);

      assert.strictEqual(groups[0].dateKey, "2099-01-01");
      assert.strictEqual(groups[1].dateKey, "2099-01-02");
    });
  });
});

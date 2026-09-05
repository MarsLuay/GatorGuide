import { opportunityStatusService } from "./services/opportunities/opportunity-status.service";
import { UserOpportunityStatus } from "./constants/opportunities";
import { db } from "./services/firebase/firebase";
import { setDoc, writeBatch } from "firebase/firestore";

async function runBenchmark() {
  const mockUid = "test-user-" + Date.now();
  const statuses: UserOpportunityStatus[] = [];

  for (let i = 0; i < 50; i++) {
    statuses.push({
      opportunityId: "opp-" + i,
      progress: "saved",
      progressUpdatedAt: new Date().toISOString(),
      isDone: false,
      doneAt: null,
      doneCycleKey: "cycle",
      clientUpdatedAt: new Date().toISOString(),
      schemaVersion: 1,
    } as any); // using as any for missing fields if there are some
  }

  // Baseline approach (simulating what the existing code does in syncStatuses)
  const startBaseline = performance.now();
  const results = await Promise.allSettled(
    statuses.map(async (status) => {
      await opportunityStatusService.saveRemoteStatus(mockUid, status);
      return status.opportunityId;
    })
  );
  const endBaseline = performance.now();
  console.log(`Baseline (Promise.allSettled + setDoc for ${statuses.length} items): ${(endBaseline - startBaseline).toFixed(2)}ms`);

  // Now simulate the new batch approach
  // We'll write this manually here to see the difference before patching the main file
}

runBenchmark().catch(console.error);

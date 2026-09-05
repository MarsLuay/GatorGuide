import { savedCollegesService } from "./services/colleges/saved-colleges.service";
import { performance } from "perf_hooks";

const mockSetDoc = () => new Promise(resolve => setTimeout(resolve, 5));
const mockDeleteDoc = () => new Promise(resolve => setTimeout(resolve, 5));
const mockWriteBatch = () => ({
  set: () => {},
  delete: () => {},
  commit: () => new Promise(resolve => setTimeout(resolve, 15))
});

savedCollegesService.saveCollege = async () => {
    await mockSetDoc();
};
savedCollegesService.removeCollege = async () => {
    await mockDeleteDoc();
};
savedCollegesService.readPendingMutations = async () => [];
savedCollegesService.writePendingMutations = async () => {};

async function runBenchmark() {
    const start = performance.now();

    const colleges = Array.from({length: 100}, (_, i) => ({
        id: `college_${i}`,
        name: `College ${i}`,
        location: { city: "City", state: "ST" },
        tuition: 10000,
        size: "large",
        setting: "urban",
        admissionRate: 0.5,
        programs: ["CS"]
    }));

    await savedCollegesService.syncSavedColleges("user123", colleges as any);

    const end = performance.now();
    console.log(`Time taken: ${end - start}ms`);
}

runBenchmark().catch(console.error);

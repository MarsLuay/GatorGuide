import { TRANSFER_PLANNER_SOURCE_SUMMARY, TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY } from "../constants/transfer-planner-source/registry";
console.log(JSON.stringify(TRANSFER_PLANNER_SOURCE_SUMMARY, null, 2));
const missingGrc = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter((entry) => entry.schoolId === "grc" && !entry.title);
console.log("GRC missing titles:", missingGrc.length);
console.log(missingGrc.slice(0, 160).map((entry) => entry.code).join("\n"));
const missingUws = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter((entry) => entry.schoolId === "uw-seattle" && !entry.title);
console.log("UWS missing titles:", missingUws.length);
console.log(missingUws.slice(0, 120).map((entry) => entry.code).join("\n"));

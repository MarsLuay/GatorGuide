// Legacy compatibility entry point for running the broad transfer planner domain suite.
// This is an opt-in diagnostic surface, not the planner accuracy gate. The trusted
// pass/fail accuracy signal is the source-backed-runtime-coverage audit.
import "./transfer-planner.scheduler.test";
import "./transfer-planner.requirements.test";
import "./transfer-planner.source-backed.test";
import "./transfer-planner.runtime-options.test";
import "./transfer-planner.refresh-contract.test";
import "./tacoma-owner-diagnostics.test";
import "./transfer-planner.uw-seattle-science-diagnostics.test";

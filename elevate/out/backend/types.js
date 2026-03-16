"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["QUEUED"] = "queued";
    JobStatus["RUNNING"] = "running";
    JobStatus["SUCCEEDED"] = "succeeded";
    JobStatus["FAILED"] = "failed";
    JobStatus["CANCEL_REQUESTED"] = "cancel_requested";
    JobStatus["CANCELED"] = "canceled";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
//# sourceMappingURL=types.js.map
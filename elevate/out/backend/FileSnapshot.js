"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshot = snapshot;
function snapshot(doc) {
    return {
        uri: doc.uri.toString(),
        language: doc.languageId,
        version: doc.version,
        text: doc.getText()
    };
}
//# sourceMappingURL=FileSnapshot.js.map
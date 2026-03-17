"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noSavedCredentialFoundResult = exports.cancelledResult = void 0;
exports.cancelledResult = Object.freeze({
    type: 'cancelled',
    data: null,
});
exports.noSavedCredentialFoundResult = Object.freeze({
    type: 'noSavedCredentialFound',
    data: null,
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateCancellationError = void 0;
const functions_1 = require("./functions");
const constants_1 = require("./constants");
const errorCodes_1 = require("./errors/errorCodes");
/**
 * Since the introduction of a new JS api, the native rejections need to be processed in JS layer.
 *
 * This is easier than reworking 2 native modules
 **/
function translateCancellationError(e) {
    if ((0, functions_1.isErrorWithCode)(e) && e.code === errorCodes_1.SIGN_IN_CANCELLED_CODE) {
        return constants_1.cancelledResult;
    }
    else {
        throw e;
    }
}
exports.translateCancellationError = translateCancellationError;

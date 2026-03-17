"use strict";

import { isErrorWithCode } from "./functions.js";
import { cancelledResult } from "./constants.js";
import { SIGN_IN_CANCELLED_CODE } from './errors/errorCodes';

/**
 * Since the introduction of a new JS api, the native rejections need to be processed in JS layer.
 *
 * This is easier than reworking 2 native modules
 **/
export function translateCancellationError(e) {
  if (isErrorWithCode(e) && e.code === SIGN_IN_CANCELLED_CODE) {
    return cancelledResult;
  } else {
    throw e;
  }
}
//# sourceMappingURL=translateNativeRejection.js.map
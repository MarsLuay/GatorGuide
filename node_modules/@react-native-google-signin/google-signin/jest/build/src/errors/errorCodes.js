"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusCodes = exports.ios_only_SCOPES_ALREADY_GRANTED = exports.SIGN_IN_CANCELLED_CODE = exports.SIGN_IN_REQUIRED_CODE = void 0;
const NativeGoogleSignin_1 = require("../spec/NativeGoogleSignin");
const { SIGN_IN_CANCELLED, IN_PROGRESS, PLAY_SERVICES_NOT_AVAILABLE, SIGN_IN_REQUIRED, SCOPES_ALREADY_GRANTED, } = NativeGoogleSignin_1.NativeModule.getConstants();
exports.SIGN_IN_REQUIRED_CODE = SIGN_IN_REQUIRED;
exports.SIGN_IN_CANCELLED_CODE = SIGN_IN_CANCELLED;
exports.ios_only_SCOPES_ALREADY_GRANTED = SCOPES_ALREADY_GRANTED;
/**
 * @group Constants
 * */
exports.statusCodes = Object.freeze({
    SIGN_IN_CANCELLED,
    IN_PROGRESS,
    PLAY_SERVICES_NOT_AVAILABLE,
    SIGN_IN_REQUIRED,
    NULL_PRESENTER: 'NULL_PRESENTER',
});

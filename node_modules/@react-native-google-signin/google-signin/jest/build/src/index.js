"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSigninButton = exports.statusCodes = exports.GoogleSignin = void 0;
var GoogleSignin_1 = require("./signIn/GoogleSignin");
Object.defineProperty(exports, "GoogleSignin", { enumerable: true, get: function () { return GoogleSignin_1.GoogleSignin; } });
var errorCodes_1 = require("./errors/errorCodes");
Object.defineProperty(exports, "statusCodes", { enumerable: true, get: function () { return errorCodes_1.statusCodes; } });
var GoogleSigninButton_1 = require("./buttons/GoogleSigninButton");
Object.defineProperty(exports, "GoogleSigninButton", { enumerable: true, get: function () { return GoogleSigninButton_1.GoogleSigninButton; } });
__exportStar(require("./types"), exports);
__exportStar(require("./functions"), exports);

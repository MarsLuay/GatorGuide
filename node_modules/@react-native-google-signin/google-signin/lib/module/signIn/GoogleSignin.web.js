"use strict";

import { statusCodes } from "../errors/errorCodes.web.js";
const errorMessage = 'RNGoogleSignIn: you are calling a not-implemented method on web platform. Web support is only available to sponsors. \n' + 'If you are a sponsor, please follow the installation instructions carefully to obtain the implementation.';
const logNotImplementedError = () => {
  console.warn(errorMessage);
};
function throwNotImplementedError() {
  const e = new Error(errorMessage);
  // the docs say that the errors produced by the module should have a code property
  Object.assign(e, {
    code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE
  });
  throw e;
}
async function signIn(_options = {}) {
  throwNotImplementedError();
}
async function hasPlayServices(_options = {
  showPlayServicesUpdateDialog: true
}) {
  logNotImplementedError();
  return false;
}
function configure(_options) {
  logNotImplementedError();
}
async function addScopes(_options) {
  logNotImplementedError();
  return null;
}
async function signInSilently() {
  throwNotImplementedError();
}
async function signOut() {
  logNotImplementedError();
  return null;
}
async function revokeAccess() {
  logNotImplementedError();
  return null;
}
function hasPreviousSignIn() {
  logNotImplementedError();
  return false;
}
function getCurrentUser() {
  logNotImplementedError();
  return null;
}
async function clearCachedAccessToken(_tokenString) {
  logNotImplementedError();
  return null;
}
async function getTokens() {
  throwNotImplementedError();
}
export const GoogleSignin = {
  hasPlayServices,
  configure,
  signIn,
  addScopes,
  signInSilently,
  signOut,
  revokeAccess,
  hasPreviousSignIn,
  getCurrentUser,
  clearCachedAccessToken,
  getTokens
};
//# sourceMappingURL=GoogleSignin.web.js.map
//****************************************************************************
// Copyright (c) 2019 BlackBerry.  All Rights Reserved.
//
// You must obtain a license from and pay any applicable license fees to
// BlackBerry before you may reproduce, modify or distribute this
// software, or any work that includes all or part of this software.
//
// This file may contain contributions from others. Please review this entire
// file for other proprietary rights or license notices.
//

'use strict';


(function(KeyProviderError) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = KeyProviderError();
    }
    exports.KeyProviderError = KeyProviderError();
  }
  else {
    global.KeyProviderError = KeyProviderError();
  }
}).call(this, function() {
  /**
   * @class KeyProviderError
   * @classdesc
   *   The error type that can be used when KeyProvider fails.
   * @memberof Support
   *
   * @param {string} message
   *   The message to associate with the error.
   *
   * @param {boolean} keysNotFound
   *   If the keys were not found for the local user. This will be set if the
   *   key provider server responds with an HTTP 404 Not Found status error code
   *   which will happen if it fails to find the keys for the specified user ID.
   *
   * @param {boolean} failedToUnprotect
   *   Using the user supplied password failed to unprotect the keys. Either the
   *   password was wrong or the keys are corrupted.
   *
   * @param {boolean} userCancelled
   *   If the user cancelled the key recovery process.
   *
   * @param {boolean} userRequestedGenerateNewKeys
   *   If the user requested to generated new keys.
   *
   * @augments Error
   */
  function KeyProviderError(message, keysNotFound, failedToUnprotect,
    userCancelled, userRequestedGenerateNewKeys) {
    this.name = "KeyProviderError";
    this.message = message;
    this.keysNotFound = keysNotFound;
    this.failedToUnprotect = failedToUnprotect;
    this.userCancelled = userCancelled;
    this.userRequestedGenerateNewKeys = userRequestedGenerateNewKeys;

    /**
     * The non-standard stack property of Error objects offer a trace of which
     * functions were called, in what order, from which line and file, and with
     * what arguments. The stack string proceeds from the most recent calls to
     * earlier ones, leading back to the original global scope call.
     *
     * See the following reference for more details:
     * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack}
     *
     * @member {string}
     */
    this.stack = (new Error()).stack;
  }
  
  KeyProviderError.prototype = Object.create(Error.prototype);
  KeyProviderError.prototype.constructor = KeyProviderError;

  return KeyProviderError;
});


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

"use strict";

/**
 * A class to encapsulate user related information.
 */
(function(GenericUserInfo) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = GenericUserInfo();
    }
    exports.GenericUserInfo = GenericUserInfo();
  }
  else {
    global.GenericUserInfo = GenericUserInfo();
  }
}).call(this, function() {
  /**
   * A class to encapsulate user related information.
   *
   * @param {string} userId
   *   The authenticated user ID.
   *
   * @param {string} [regId]
   *   The BBM Enterprise SDK registration ID.
   *
   * @param {string} [displayName]
   *   The display name.
   *
   * @param {string} [email]
   *   The user's email.
   *
   * @param {string} [avatarUrl]
   *   The URL to the user's avatar image.
   *
   * @memberof Support.Identity
   * @class GenericUserInfo
   */
  function GenericUserInfo(userId, regId, displayName, email, avatarUrl) {
    /**
     * The authenticated user ID.
     * @member {string} userId
     */
    if (userId) {
      this.userId = userId;
    }

    /**
     * The BBM Enterprise SDK registration ID.
     * @member {string} [regId]
     */
    if (regId) {
      this.regId = regId;
    }

    /**
     * The display name.
     * @member {string} [displayName]
     */
    if (displayName) {
      this.displayName = displayName;
    }

    /**
     * The user's email.
     * @member {string} [email]
     */
    if (email) {
      this.email = email;
    }

    /**
     * The URL to the user's avatar image.
     * @member {string} [avatarUrl]
     */
    if (avatarUrl) {
      this.avatarUrl = avatarUrl;
    }
  }

  return GenericUserInfo;
});

//****************************************************************************

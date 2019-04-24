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

/**
 * Manages authentication without an identity provider. It generates an access
 * token which is used by the Spark Communications SDK for authentication. This
 * access token is not signed and is not validated against any identity
 * provider.
 * 
 * This requires an application to override getUserId() function to return a
 * Promise of the user ID.
 * 
 * @memberof Support.Auth
 * @class MockAuthManager
 */
function MockAuthManager() {

  let m_localUserInfo;
  //#region Private methods

  // Create non signed JWT.
  const createToken = () => {
    const jti = BBMEnterprise.Util.base64urlEncode(
      window.crypto.getRandomValues(new Uint8Array(20))).substring(0, 18);

    // Create the JWT header.
    const tokenHeader = BBMEnterprise.Util.base64urlEncode(JSON.stringify({
      alg: 'none'
    }));

    // The current time, in seconds.
    const now = (Date.now() / 1000) | 0;

    // Create the JWT body.
    const tokenBody = BBMEnterprise.Util.base64urlEncode(JSON.stringify({
      jti: jti,
      sub: m_localUserInfo.userId,
      // Valid since 60 seconds ago to avoid clock skew issues.
      iat: now - 60,
      // Expires in one day.
      exp: now + 86400
    }));

    return `${tokenHeader}.${tokenBody}.`;
  };

  //#endregion Private methods

  //#region Public methods

  /**
   * This function must be overridden by client application to return a promise
   * of userId.
   * @returns {Promise<string>} Promise of user ID.
   */
  this.getUserId = () => {
    throw new Error('getUserId must return a promise of userId');
  };

  /**
   * Performs the client authentication.
   * @returns {Promise<Support.Identity.MockUserManager.UserInfo>} Returns
   * promise of user information.
   */
  this.authenticate = async function() {
    const userId = await this.getUserId();
    m_localUserInfo = {
      displayName: userId,
      emailAddress: userId,
      userId: userId,
    };
    return m_localUserInfo;
  };

  /**
   * Get local user information that was retrieved from the authentication user
   * info service.
   * @returns {Support.Identity.MockUserManager.UserInfo} The information for
   * the local user.
   */
  this.getLocalUserInfo = function() {
    return m_localUserInfo;
  };

  /**
   * @returns {Promise<string>} The promise of an access token that can be sent
   * to the BBM Enterprise server.
   */
  this.getBbmSdkToken = function() {
    const token = createToken();
    return Promise.resolve(token);
  };

  /**
   * @returns {Promise<string>} The promise of an access token for the user
   * manager.
   */
  this.getUserManagerToken = function() {
    const token = createToken();
    return Promise.resolve(token);
  };

  /**
   * @returns {boolean} Returns true if application is authenticated. Returns
   * false otherwise.
   */
  this.isAuthenticated = function() {
    return !!m_localUserInfo;
  };

  //#endregion Public methods
}

const AuthenticationManager = MockAuthManager;

//****************************************************************************

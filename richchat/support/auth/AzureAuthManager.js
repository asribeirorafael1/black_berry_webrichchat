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
 * @typedef {Object} AuthConfig
 * @memberof Support.Auth.AzureAuthManager
 * @property {string} authService oAuth service endpoint.
 * @property {string} clientId Application ID configured on oAuth server.
 * @property {string} scope Scope of the access token being requested.
 * @property {string} [resource] The resource the token is required to access.
 * This is optional unless the authentication service requires it.
 */

/**
 * Manages authentication using Azure Auth.
 * This will handle both authenticating to get an access token to use with the
 * BBM Enterprise server and another access token for calling the Microsoft
 * Graph API's.
 * 
 * This uses Open ID Connect (OAuth 2.0).
 * 
 * This checks if 'openid' and 'profile' scopes are defined in appAuthConfig. If
 * scopes are missing, this will automatically add it to these objects. This
 * will cache both access tokens and handle requesting new ones when the cached
 * ones have expired and are requested.
 *
 * {@link https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/azureIdentityManagement.html}
 *
 * @param {Support.Auth.AzureAuthManager.AuthConfig} appAuthConfig
 * The configuration required to authenticate with the Azure auth service with a
 * scope for the BBM Enterprise server.
 * {@link https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/identityManagement.html}
 *
 * @memberof Support.Auth
 * @class AzureAuthManager
 */
function AzureAuthManager(appAuthConfig) {

  //#region Initialization

  const m_nonceHashKey = 'azure_authentication_nonce_hash';
  const m_authConfig = appAuthConfig;
  const m_localUserInfo = {};
  let m_idTokenInfo;
  let m_loginHint;
  let m_tenantId;
  let m_appAccessTokenInfo;
  let m_graphAccessTokenInfo;

  //#endregion Initialization

  //#region Private methods

  // Adds 'openid' and 'profile' scopes to the provided configurations. Does
  // nothing if scopes are already specified in the provided configurations.
  const enforceAuthScopes = authConfig => {
    if (!authConfig.scope) {
      throw new Error('Configuration scope is not defined');
    }
    const scopes = authConfig.scope.split(' ');
    const scopesLen = scopes.length;
    if (!scopes.find(scope => scope.toLowerCase() === 'profile')) {
      // Add the 'profile' scope.
      console.log('Automatically adding "profile" to scope to get id token');
      scopes.push('profile');
    }
    if (!scopes.find(scope => scope.toLowerCase() === 'email')) {
      // Add the 'email' scope.
      console.log('Automatically adding "email" to scope to get id token');
      scopes.push('email');
    }
    if (!scopes.find(scope => scope.toLowerCase() === 'openid')) {
      // Add the 'openid' scope.
      console.log('Automatically adding "openid" to scope to get id token');
      scopes.push('openid');
    }

    if (scopesLen !== scopes.length) {
      // New scopes were added. Updated the scope.
      authConfig.scope = scopes.join(' ');
    }
  };

  // Requests tokens for the specified configuration. Returns valid tokens
  // associated with the provided configuration if any. Redirects application
  // to the authentication page (specified in the provided config) if associated
  // tokens do not exist.
  const requestIdTokenInfo = async () => {
    if (m_idTokenInfo) {
      return m_idTokenInfo;
    }

    enforceAuthScopes(m_authConfig);

    // There are no cached tokens associated with the provided config. Redirect
    // current page to the authentication page.
    const redirectUrl = window.location.hash
      ? window.location.href.split('#')[0]
      : window.location.href;

    const params = {
      client_id: m_authConfig.clientId,
      redirect_uri: redirectUrl
    };

    if (m_authConfig.resource) {
      params.resource = m_authConfig.resource;
    }

    params.scope = m_authConfig.scope;
    params.prompt = 'consent';
    params.response_type = 'id_token';
    params.nonce = btoa(window.crypto.getRandomValues(new Uint8Array(20)));

    const utf8Nonce = BBMEnterprise.Utf8.encode(params.nonce);
    const nonceHash =
      await window.crypto.subtle.digest({ name: 'SHA-512' }, utf8Nonce);
    sessionStorage.setItem(m_nonceHashKey, btoa(nonceHash));

    const searchParams = Object.keys(params).map(key =>
     `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
    const authUrl = `${m_authConfig.authService}?${searchParams}`;

    // Stop loading scripts.
    window.stop();
    document.execCommand('Stop');
    // Perform redirect.
    window.location.href = authUrl;
    return undefined;
  };

  // Requests new access token information in the hidden iframe. The default
  // request timeout is 10 seconds.
  const requestAccessToken = scope => {
    return new Promise((resolve, reject) => {
      const config = Object.assign({}, m_authConfig);

      const redirectUrl = window.location.hash
        ? window.location.href.split('#')[0]
        : window.location.href;

      const params = {
        client_id: config.clientId,
        redirect_uri: redirectUrl
      };

      if (m_authConfig.resource) {
        params.resource = config.resource;
      }

      params.domain_hint = m_tenantId;
      params.login_hint = m_loginHint;
      params.scope = scope;
      params.prompt = 'none';
      params.state = btoa(window.crypto.getRandomValues(new Uint8Array(20)));
      params.response_type = 'token';
      params.nonce = btoa(window.crypto.getRandomValues(new Uint8Array(20)));

      const searchParams = Object.keys(params).map(key =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      const authUrl = `${m_authConfig.authService}?${searchParams}`;
      // Create and add hidden iframe to the document.
      const iframe = document.createElement('iframe');
      iframe.src = 'about:blank';
      iframe.style.display = 'none';
      // Redirect iframe to the constructed url.
      iframe.src = authUrl;

      // Enable timeout.
      const timeOut = setTimeout(() => {
        const errorMessage = 'Request token timeout';
        console.error(errorMessage);
        iframe.contentWindow.stop();
        document.body.removeChild(iframe);
        iframe.remove();
        reject(errorMessage);
      }, 10000);

      iframe.onload = () => {
        // This event is fired when iframe is redirected back from auth page.
        if (iframe.contentDocument.URL.includes('#')) {
          // iframe received response in hash. Clear timeout.
          clearTimeout(timeOut);
          const hash = iframe.contentDocument.URL.split('#')[1];
          const accessTokenInfo = formatToken(hash);
          if (accessTokenInfo) {
            if (accessTokenInfo.state !== params.state) {
              reject('Token state does not match');
            }
            // Calculate when token expires.
            const expiresIn = accessTokenInfo.expires_in;
            accessTokenInfo.expires_at = Date.now() + expiresIn * 1000;
            iframe.contentDocument.location.hash = '';
            resolve(accessTokenInfo);
          }
          else {
            reject('Failed to extract token');
          }
        }
        // Stop any code execution in the iframe.
        iframe.contentWindow.stop();
        // Destroy iframe.
        document.body.removeChild(iframe);
        iframe.remove();
      };
      document.body.appendChild(iframe);
    });
  };

  // Parses provided JWT into object.
  const parseJWT = token => {
    if (!token) {
      throw new Error('token not specified');
    }
    // Decode the data, it will be in the format header.payload.signature.
    const decodedToken = decodeURIComponent(token);
    if (!decodedToken) {
      throw new Error(`Failed to decode token from token len=${token.length}`);
    }
    // We only need the payload.
    const payload = decodedToken.split('.')[1];
    if (!payload) {
      throw new Error(
        `Failed to find payload in decoded token len=${decodedToken.length}`);
    }
    // Convert from base64 to readable text into an object.
    return JSON.parse(window.atob(payload));
  };

  // Formats server response string into object.
  const formatToken = hash => {
    try {
      const params = {};
      const regex = /([^&=]+)=([^&]*)/g;
      let m;

      while ((m = regex.exec(hash))) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
      }

      if (params.error) {
        console.error(`oAuth service returned error: ${params.error}`);
        if (params.error_description) {
          console.error('oAuth service returned error_description: ' +
            decodeURIComponent(params.error_description).replace(/\+/g, ' '));
        }
        return undefined;
      }
      return params;
    }
    catch (error) {
      console.error(`Failed to format token | Error : ${error}`);
      return undefined;
    }
  };

  //#endregion Private methods

  //#region Public methods

  /**
   * Performs the client authentication. Retrieves the access tokens and user
   * information for the authentication scopes provided in the constructor.
   *
   * @returns {Promise<Support.Identity.GenericUserInfo>} Returns promise of
   * user information in when authentication is performed successfully. Returns
   * an empty promise when the authentication manager redirects the application
   * to the authentication page. Returns a rejected promise in case of failure.
   */
  this.authenticate = function() {
    return new Promise(async (resolve, reject) => {
      try {
        const idTokenInfo = await requestIdTokenInfo();
        if (!idTokenInfo) {
          // Application will be redirected to the Auth page of the identity
          // provider.
          resolve();
          return;
        }

        const parsedToken = parseJWT(idTokenInfo.id_token);
        if (parsedToken) {
          if (!parsedToken.oid) {
            throw new Error('Missing oid field in JWT token');
          }
          const storedHash = sessionStorage.getItem(m_nonceHashKey);
          sessionStorage.removeItem(m_nonceHashKey);
          if (!storedHash) {
            throw new Error('Failed to get stored nonce hash');
          }
          const utf8Nonce = BBMEnterprise.Utf8.encode(parsedToken.nonce);
          const receivedHash = await window.crypto.subtle.digest(
            { name: 'SHA-512' }, utf8Nonce);
          if (storedHash !== btoa(receivedHash)) {
            throw new Error('Invalid JWT nonce');
          }
          m_loginHint = parsedToken.preferred_username;
          m_tenantId = parsedToken.tid;
          m_localUserInfo.displayName =
            parsedToken.name || parsedToken.preferred_username;
          m_localUserInfo.userId = parsedToken.oid;
          m_localUserInfo.email = parsedToken.email;
          resolve(m_localUserInfo);
        }
        else {
          throw new Error('Failed to parse id token');
        }
      }
      catch(error) {
        reject(error);
      }
    });
  };

  /**
   * Get information for the local user that was retrieved from the
   * authentication user info service.
   * @returns {Support.Identity.GenericUserInfo} The information for the local
   * user.
   */
  this.getLocalUserInfo = function() {
    return m_localUserInfo;
  };

  /**
   * Get the access token from the Azure auth service that can be used when
   * creating the {BBMEnterprise}.
   * This will return a cached token if it is still valid or it will request a
   * new one if the cached one has expired.
   * Invoke this function only after the page is loaded.
   * @param {boolean} [isForce] Optional, False by default. Set it to True to
   * avoid cached token.
   * @returns {Promise<string>} The promise of an access token that can be sent
   * to the BBM Enterprise server.
   */
  this.getBbmSdkToken = function(isForce = false) {
    if (!isForce && m_appAccessTokenInfo 
      && m_graphAccessTokenInfo.expires_at > Date.now()) {
      return Promise.resolve(m_appAccessTokenInfo.access_token);
    }
    else {
      return requestAccessToken('profile openid '
      + `api://${m_authConfig.clientId}/Messaging.All`)
      .then(accessToken => {
        m_appAccessTokenInfo = accessToken;
        return m_appAccessTokenInfo.access_token;
      })
      .catch(error => {
        console.error(`Failed to get App access token. Error: ${error}`);
        // At this point we are unable to get access token anymore. Request new
        // id token. User will be redirected to the authentication page.
        m_idTokenInfo = undefined;
        return requestIdTokenInfo();
      });
    }
  };

  /**
   * Get the access token from the Azure auth service that can be used by
   * the {Support.AzureUserManager}.
   * This will return a cached token if it is still valid or it will request a
   * new one if the cached one has expired.
   * Invoke this function only after the page is loaded.
   * @param {boolean} [isForce] Optional, False by default. Set it to True to
   * avoid cached token.
   * @returns {Promise<string>} The promise of an access token for the user
   * manager.
   */
  this.getUserManagerToken = function(isForce = false) {
    if (!isForce && m_graphAccessTokenInfo
      && m_graphAccessTokenInfo.expires_at > Date.now()) {
      return Promise.resolve(m_graphAccessTokenInfo.access_token);
    }
    else {
      const scopes = m_authConfig.scope;
      if (!scopes.includes('https://graph.microsoft.com/User.ReadWrite')) {
        return Promise.reject(
          'https://graph.microsoft.com/User.ReadWrite scope is missing');
      }

      if (!scopes.includes('https://graph.microsoft.com/User.ReadBasic.All')) {
        return Promise.reject(
          'https://graph.microsoft.com/User.ReadBasic.All scope is missing');
      }

      return requestAccessToken('profile openid '
      + 'https://graph.microsoft.com/User.ReadWrite '
      + 'https://graph.microsoft.com/User.ReadBasic.All')
      .then(accessTokenInfo => {
        m_graphAccessTokenInfo = accessTokenInfo;
        return m_graphAccessTokenInfo.access_token;
      })
      .catch(error => {
        console.error(`Failed to get MS Graph access token. Error: ${error}`);
        // At this point we are unable to get access token anymore. Request new
        // id token. User will be redirected to the authentication page.
        m_idTokenInfo = undefined;
        return requestIdTokenInfo();
      });
    }
  };

  /**
   * @returns {boolean} Returns true if application is authenticated against all
   * authentication configurations. Returns false otherwise.
   */
  this.isAuthenticated = function() {
    return !!m_idTokenInfo;
  };

  //#endregion Public methods

  if (window.location.hash) {
    const hash = window.location.hash.split('#')[1];
    const tokenInfo = formatToken(hash);
    if (tokenInfo && tokenInfo.id_token) {
      window.location.replace('#');
      if (typeof window.history.replaceState === 'function') {
        history.replaceState({ }, '', window.location.href.slice(0, -1));
      }
      m_idTokenInfo = tokenInfo;
    }
  }
}

const AuthenticationManager = AzureAuthManager;

//****************************************************************************

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
 * Contains functions for storing keys in, and retrieving keys from the Key
 * Provider Server.
 *
 * @memberof Support
 * @class CosmosDbKeyProvider
 */

(function(CosmosDbKeyProvider) {

  var global = this;

  if (typeof exports !== 'undefined') {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = CosmosDbKeyProvider();
    }
    exports.CosmosDbKeyProvider = CosmosDbKeyProvider();
  }
  else {
    global.CosmosDbKeyProvider = CosmosDbKeyProvider();
  }
}).call(this, function() {

  /**
   * This callback is invoked when CosmosDbKeyProvider failed to import keys.
   * @callback ImportFailedCallback
   * @param {Error} error Reason why fail happened.
   * @returns {Promise<KeyProviderInterface.FailureChoice>} Return Promise of
   * one of the following values:
   * a. KeyProviderInterface.FailureChoice.GenerateNewKeys
   *    The SDK will generate new profile keys.
   * b. KeyProviderInterface.FailureChoice.GetProfileKeys
   *    The SDK will request profile keys with another call to getProfileKeys().
   * c. KeyProviderInterface.FailureChoice.AbandonSetup
   *    The SDK will abandon its attempt to setup for the local user.
   */

  /**
   * Create a new CosmosDB key provider object that will handle the calls to
   * the Key Provider Server to store and retrieve keys.
   * 
   * @param {String} uid User ID issued by the identity manager.
   * @param {String} serverURL The URL of the Cosmos DB Key Provider Server.
   * @param {String} accessToken Access token issued by Azure.
   * @param {function} getToken Function to get Access Token from Azure.
   * @param {ImportFailedCallback} importFailedCallback Defines the behavior of
   * the SDK when key import fails.
   * @param {support.protect.encryption.KeyProtectInterface} [keyProtector]
   * The protection module which will be used to protect keys prior to upload.
   * @param {function} getIdentitiesFromRegId Gets the identity information for
   * the given regId {@link BBMEnterprise.getIdentitiesFromRegId}
   */

  // Create a new object that will be our CosmosDB key provider.
  var CosmosDbKeyProvider = 
  function(uid, serverURL, accessToken, getToken,
    importFailedCallback, keyProtector, getIdentitiesFromRegId) {
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new Error('uid must be a non-empty string');
    }

    if (typeof serverURL !== 'string') {
      throw new Error('serverURL must be a non-empty string');
    }

    if (typeof getToken !== 'function') {
      throw new Error('getToken must be a function');
    }

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('accessToken must be a non-empty string');
    }

    if (typeof importFailedCallback !== 'function') {
      throw new Error('importFailedCallback must be a function');
    }

    if (typeof getIdentitiesFromRegId !== 'function') {
      throw new Error('getIdentitiesFromRegId must be a function');
    }

    m_uid = uid;
    m_keyProviderServerURL = serverURL;
    m_accessToken = accessToken;
    m_importFailedCallback = importFailedCallback;
    m_identitiesCache = new Map();

    /** 
     * Resolves the user's identity by user RegId.
     * @private
     * @param {string} regId User's RegId.
     * @returns {Promise<string>} User Id.
     * @throws {Error} Throws when fails to resolve the user's identity.
     */
    m_getUidByRegId = regId => {
      if (m_identitiesCache.has(regId)) {
        return Promise.resolve(this._identitiesCache.get(regId));
      }
      else {
        return getIdentitiesFromRegId(regId).then(identity => {
          const userId = identity.appUserId;
          m_identitiesCache.set(regId, userId);
          return userId;
        });
      }
    };

    // Set up a mapping for transforming keys, based on whether or not
    // we use a keyProtector.
    if(keyProtector) {
      m_protectKey = key => keyProtector.protect(key);
      m_unprotectKey = key => keyProtector.unprotect(key);

      m_protectProfileKeys = keys =>
        keyProtector.generateManagementKeys()
        .then(() =>
          Promise.all([
            keyProtector.protect(keys.privateEncryptionKey),
            keyProtector.protect(keys.privateSigningKey),
            keyProtector.getManagementKeys()
          ])
        )
        .then(protectedKeys => {
          return {
            "private": {
              profile: {
                encrypt: protectedKeys[0],
                sign: protectedKeys[1]
              },
              manage: protectedKeys[2]
            },
            "public": {
              encrypt: {
                key: BBMEnterprise.Util.array2b(keys.publicEncryptionKey)
              },
              sign: {
                key: BBMEnterprise.Util.array2b(keys.publicSigningKey)
              }
            }
          };
        });
      m_unprotectProfileKeys = keys =>
        Promise.all([
          keyProtector.unprotect(keys.private.profile.encrypt),
          keyProtector.unprotect(keys.private.profile.sign)
        ])
        .then(unprotectedKeys => {
          return {
            privateEncryptionKey: unprotectedKeys[0],
            privateSigningKey: unprotectedKeys[1],
            publicEncryptionKey: BBMEnterprise.Util.b2array(keys.public.encrypt.key),
            publicSigningKey: BBMEnterprise.Util.b2array(keys.public.sign.key)
          };
        });

      m_setManagementKeys = keys => keyProtector.setManagementKeys(keys);
    }
  };

  CosmosDbKeyProvider.prototype = Object.create(Object.prototype);
  CosmosDbKeyProvider.prototype.constructor = CosmosDbKeyProvider;

  /**
   * Get the promise of the local user's encryption and signing key pairs.
   *
   * @returns {Promise}
   *  The promise will be resolved with an object with the following
   *  structure:
   *  {
   *    privateKeys: pair of protected private keys (encrypting and signing
   *                 keys)
   *    managementKeys: set of protected management keys. Used to encrypt
   *                    and sign private keys.
   *    publicKeys: pair of Base64 encoded public keys (encrypting and signing)
   *  }
   *
   *  If no keys are available or if decoding the stored keys fails the
   *  promise will be rejected and the profile keys will be (re)generated by
   *  the SDK.
   *
   *  If new keys are generated because of a failure, a call will be made to
   *  saveProfileKeys() so that the newly generated keys can be stored.
   */
  CosmosDbKeyProvider.prototype.getProfileKeys = function() {
    return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
      'GET', null)
    .then(response => {
      // Pass the management keys to the key protector.
      return m_setManagementKeys(response.private.manage)
      // Then unprotect what is left.
      .then(() => { 
        return m_unprotectProfileKeys(response)
        .then(unprotectedKeys => {
          const utf8decode = BBMEnterprise.Utf8.decode;
          const base64decode = BBMEnterprise.Util.b2array;
          unprotectedKeys.privateEncryptionKey =
            base64decode(utf8decode(unprotectedKeys.privateEncryptionKey));
          unprotectedKeys.privateSigningKey =
            base64decode(utf8decode(unprotectedKeys.privateSigningKey));
          return unprotectedKeys;
        });
      });
    })
    .catch(error => {
      logWarn(`Failed to get profile keys due to error: ${error}`);
      if (error instanceof KeyProviderError
      && error.keysNotFound && error.httpResponseCode === 404) {
        // The key server did not find the keys, this is probably a new user
        // so return empty object to generate new keys for them.
        return {};
      }
      // Some other error, let key manager handle it, our
      // profileKeysImportFailed function will be called with it to let the app
      // decide how to handle it.
      throw error;
    });
  };

  /**
   * Save the local user's encryption and signing key pairs.
   *
   * It is the app's responsibility to ensure that these keys are safely
   * stored and can be retrieved during the next session.
   *
   * Failure to successfully save the keys will have the following impacts on
   * behavior:
   *  1. Other users cannot invite the local user to chats because the chat
   *     key will not be encrypted with current public encryption key.
   *  2. Other users will not be able to verify any new message sent to a chat
   *     during this session because the user's current public signing key
   *     will not be available for others to use.
   *  3. Messages sent during this session will not be verifiable as being
   *     sent by the local user during the next session because the keys used
   *     for the current session will have been lost.
   *
   * @returns {Promise} Resolves with no parameters in case of success.
   * Rejects with an error in case of failure.
   */
  CosmosDbKeyProvider.prototype.saveProfileKeys = function(keys) {
    const exportKeys = Object.assign({}, keys);
    const utf8encode = BBMEnterprise.Utf8.encode;
    const base64encode = BBMEnterprise.Util.array2b;
    exportKeys.privateEncryptionKey =
      utf8encode(base64encode(exportKeys.privateEncryptionKey));
    exportKeys.privateSigningKey =
      utf8encode(base64encode(exportKeys.privateSigningKey));
    return m_protectProfileKeys(exportKeys)
    .then(protectedKeys => {
      const body = {
        replace: true,
        keys: protectedKeys
      };

      return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
        'PUT', JSON.stringify(body));
    });
  };

  /**
   * Get the key data associated with all of the chats known to the user.
   *
   * @returns {Promise}
   *   The promise of the known chat key data object.  The object members are
   *   the chatIds and the member values are Uint8Array objects containing the
   *   key data associated with the chatId.
   *   {
   *     <chatId 1>: {Uint8Array},
   *     <chatId 2>: {Uint8Array},
   *     ...
   *   }
   *
   *   When no chat keys are known an empty object is used to resolve the
   *   promise.
   *
   *   Any rejection of this promise will be treated as a temporary failure
   *   and the chat keys will be recovered later on demand with a call to
   *   getChatKey().
   */
  CosmosDbKeyProvider.prototype.getChatKeys = function() {
    return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
      'GET', null)
    .then(response => {
      let ret = {};
      let promises = [];
      if (response.private.mailboxes) {
        Object.keys(response.private.mailboxes).forEach(id => {
          const chatId = BBMEnterprise.Util.base64urlDecode(id);
          promises.push(
              m_unprotectKey(response.private.mailboxes[id])
              .then(unprotectedKey => ret[chatId] = unprotectedKey));
        });
      }
      return Promise.all(promises).then(() => ret);
    })
    .catch(error => {
      logWarn(`Failed to get chat keys: ${error}`);
      throw error;
    });
  };

  /**
   * Get the chat key data associated with the given chatId.
   *
   * @returns {Promise}
   *   The promise of the chat key data given as a Uint8Array.
   *
   *   When the promise is rejected with BBMEnterprise.Error.NotFoundError,
   *   the chat key is known not to exist.  When a chat key is known not to
   *   exist, the chat will be automatically cleaned up as recovery of chat
   *   contents will not be possible.
   *
   *   Any other rejection error will be treated as a temporary error and
   *   another call to getChatKey() will be made the next time the key is
   *   needed.  This will result in sub-optimal behavior patterns and any
   *   encrypted information in the chat details and all messages will not be
   *   recoverable until getChatKeys() resolves with a valid key.
   */
  CosmosDbKeyProvider.prototype.getChatKey = function(chatId) {
    return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
      'GET', null)
    .then(response => {
      if (response.private.mailboxes) {
        let encodedChatId = BBMEnterprise.Util.base64urlEncode(chatId);
        for (const id of Object.keys(response.private.mailboxes)) {
          if (encodedChatId === id) {
            return m_unprotectKey(response.private.mailboxes[id]);
          }
        }
      }
      throw new BBMEnterprise.Error.NotFoundError();
    })
    .catch(error => {
      var errorMessage = `Failed to get chat key. Error: ${error}`;
      if (error.code === 404) {
        throw new BBMEnterprise.Error.NotFoundError(errorMessage);
      }
      throw error;
    });
  };

  /**
   * Save the chat key data associated with the given chatId.
   *
   * It is the app's responsibility to ensure that the chat key data is safely
   * stored and can be retrieved during the next session.
   *
   * Failure to successfully save the chat key data will result in the chat
   * identified by chatId being inaccessible during the next session. The user
   * will have to leave the chat and get re-invited to recover the chat key.
   *
   * @returns {Promise}
   * Resolves with no parameters if operation was successful. In case of error
   * rejects with an error provided by the Key Provider Server.
   */
  CosmosDbKeyProvider.prototype.saveChatKey = function(chatId, key) {
    return m_protectKey(key)
    .then(protectedKey => {
      chatId = BBMEnterprise.Util.base64urlEncode(chatId);
      var privateSection = { mailboxes : {} };
      privateSection.mailboxes[chatId] = protectedKey;

      var body = JSON.stringify({
        replace: false,
        keys: { private : privateSection }
      });

      return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
        'PUT', body);
    });
  };

  /**
   * Remove the chat key data associated with the given chatId.
   *
   * It is the app's responsibility to ensure that the chat key data is removed
   * from storage.
   *
   * Failure to successfully remove the chat key data will result in a leakage
   * of chat keys in external storage.
   *
   * @returns {Promise}
   * Resolves with no parameters if operation was successful. In case of error
   * rejects with an error provided by the Key Provider Server.
   */
  CosmosDbKeyProvider.prototype.removeChatKey = function(chatId) {
    chatId = BBMEnterprise.Util.base64urlEncode(chatId);
    var privateSection = { mailboxes : {} };
    privateSection.mailboxes[chatId] = 'null';

    var body = JSON.stringify ({
      replace: false,
      keys: { private: privateSection }
    });

    return httpRequest(m_keyProviderServerURL + encodeURIComponent(m_uid),
      'PUT', body);
  };

  /**
   * Get the public key data for the user identified by their BBM registration
   * ID.
   *
   * @returns {Promise}
   * The promise of the user's public encryption and signing keys given as
   * an object with the following structure:
   * {
   *   encrypt : Base64 string represents public encryption key
   *   sign: Bas64 string represents public signing key
   * }
   *
   * The promise may be rejected with any error because the keys were not
   * found or they failed to decode.  When this occurs, the user cannot be
   * invited to join chats and any messages from the user in a chat will not
   * be verifiable.
   */
  CosmosDbKeyProvider.prototype.getPublicKeys = function(regId) {
    return m_getUidByRegId(regId).then(uid =>
      httpRequest(m_keyProviderServerURL + encodeURIComponent(uid),
        'GET', null)
      .then(response => {
        return {
          encryptionKey: BBMEnterprise.Util.b2array(response.public.encrypt.key),
          signingKey: BBMEnterprise.Util.b2array(response.public.sign.key)
        };
      }));
  };

  /**
   * Called when the keys returned via
   * {@link BBMEnterprise.KeyProviderInterface#getProfileKeys} have failed to
   * import.  The application should return an indication of how it would like
   * the SDK to handle the failure.
   *
   * @param {any} [error]
   *   Any error thrown synchronously or used to reject a promise while
   *   interacting with the application supplied KeyProviderInterface
   *   implementation object to get the profile keys will be captured and
   *   returned to the application code via this parameter.  This will be
   *   undefined when the failure occurs outside of application provided code.
   *
   * @returns {Promise<BBMEnterprise.KeyProviderInterface.FailureChoice>}
   *   The way the application would like the SDK to handle the failure to
   *   import the profile keys.
   *
   *   This returns a promise to enable the application to delay the next call
   *   to {@link BBMEnterprise.KeyProviderInterface#getProfileKeys} until the
   *   application is ready.
   *
   *   When the promise is rejected for any reason, setup of the SDK will be
   *   aborted.
   */
  CosmosDbKeyProvider.prototype.profileKeysImportFailed = function(error) {
    // Allow the app provided function to decide how to handle.
    return m_importFailedCallback(error);
  };

  /**
   * Static Factory class used to generate new instance of CosmosDbKeyProvider
   */
  CosmosDbKeyProvider.factory = {
    /**
     * Creates new instance for CosmosDbKeyProvider
     * @returns {Promise<CosmosDbKeyProvider>}
     * The promise of new instance of CosmosDbKeyProvider
     */
    createInstance: (uid, serverURL, accessToken, getToken,
      importFailedCallback, keyProtect, getIdentitiesFromRegId) => {
      return new Promise((resolve, reject) => {
        try {
          const keyProvider = new CosmosDbKeyProvider(uid, serverURL,
            accessToken, getToken, importFailedCallback,
            keyProtect, getIdentitiesFromRegId);
          resolve(keyProvider);
        }
        catch(error) {
          logWarn(`createInstance: ${error}`);
          reject(error);
        }
      });
    }
  };

  /**
   * Utility function that performs asynchronous http get request
   * @param url - URL to be requested
   * @param successCallback - callback invoked when request status is Success
   * @param errorCallback - callback invoked when request status is not Success
   */
  var httpRequest = (url, method, body) => new Promise((resolve, reject) => {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = () => {
      if (httpRequest.readyState == 4) {
        if (httpRequest.status == 200
          && typeof httpRequest.response === 'object'
          && !httpRequest.response.error ) {
          resolve(httpRequest.response);
        }
        else {
          logWarn('Http Request respond.'
            + ` | Status: ${httpRequest.status}`
            + ` | ResponseType: ${typeof httpRequest.response}`);
          // The key manager will pass this error to the app to decide how
          // it wants to handle it.
          var error = new KeyProviderError(
            "HTTP Request to Key Provider Server Failed",
            // If the key server does not find the users keys it will return
            // with a HTTP 404 Not found status. If that happens set the
            // keysNotFound property to true.
            httpRequest.status === 404);
          error.httpResponseCode = httpRequest.status;
          error.httpResponseText = httpRequest.statusText;

          reject(error);
        }
      }
    };
    httpRequest.responseType = 'json';
    httpRequest.open(method, url, true);
    httpRequest.setRequestHeader('Content-Type', 'application/json');
    httpRequest.setRequestHeader('Authorization', `Bearer ${m_accessToken}`);
    httpRequest.send(body);
  });

  function logWarn(message) {
    console.warn(`CosmosDbKeyProvider: ${message}`);
  }

  // :: ----------------------------------------------------------------------
  // :: Data Members

  var m_uid = undefined;
  var m_accessToken = undefined;
  var m_keyProviderServerURL = '';
  var m_importFailedCallback = undefined;
  var m_protectKey = undefined;
  var m_unprotectKey = undefined;
  var m_protectProfileKeys = undefined;
  var m_unprotectProfileKeys = undefined;
  var m_setManagementKeys = undefined;
  var m_identitiesCache = undefined;
  var m_getUidByRegId = undefined;

  return CosmosDbKeyProvider;
});

//****************************************************************************

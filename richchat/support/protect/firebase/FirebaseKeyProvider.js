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
 * Contains functions for storing keys in, and retrieving keys from, a firebase
 * database.
 *
 * @memberof Support
 * @class FirebaseKeyProvider
 */
(function(FirebaseKeyProvider) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = FirebaseKeyProvider();
    }
    exports.FirebaseKeyProvider = FirebaseKeyProvider();
  }
  else {
    global.FirebaseKeyProvider = FirebaseKeyProvider();
  }
}).call(this, function() {

  // :: ----------------------------------------------------------------------
  // :: Construction

  /**
   * This callback is invoked when FirebaseKeyProvider failed to import keys.
   * @callback ImportFailedCallback
   * @param {Error} error Reason why fail happened.
   * @returns {Promise<KeyProviderInterface.FailureChoice>} Return Promise of 
   * one of the following values:
   * * a. KeyProviderInterface.FailureChoice.GenerateNewKeys
   *    The SDK will generate new profile keys.
   * b. KeyProviderInterface.FailureChoice.GetProfileKeys
   *    The SDK will request profile keys with another call to getProfileKeys().
   * c. KeyProviderInterface.FailureChoice.AbandonSetup
   *    The SDK will abandon its attempt to setup for the local user.
   */

  /**
   * Create a new Firebase key provider object that will handle the calls to
   * get and set the keys in the Firebase Database as needed for the BBM
   * Enterprise SDK.
   *
   * This class expects that the firebase APIs have already been imported and
   * configured for the given appName.
   * 
   * @param {string} userId
   * The id of the user to use as the current identity.
   * 
   * @param {ImportFailedCallback} importFailedCallback
   * Function defines behavior of the BBM Enterprise SDK when import keys fails.
   *
   * @param {firebase.app.App} app
   * The firebase app to get access to the database.
   *
   * @param {support.protect.encryption.KeyProtectInterface} [keyProtector]
   * The protection module which will be used to protect keys prior to upload.
   * 
   * @param {function} getIdentitiesFromRegId Gets the identity information for
   * the given regId {@link BBMEnterprise.getIdentitiesFromRegId}
   */
  // Create a new object that will be our Firebase key provider.
  var FirebaseKeyProvider =
    function(userId, importFailedCallback, app, keyProtector,
             getIdentitiesFromRegId) {
    if (typeof importFailedCallback !== 'function') {
      throw new Error('FirebaseKeyProvider:'
        + ' importFailedCallback must be a function');
    }

    if (typeof getIdentitiesFromRegId !== 'function') {
      throw new Error(
        'FirebaseKeyProvider: getIdentitiesFromRegId must be a function');
    }

    // Get and remember the firebase database and the currently logged in user
    // associated with the appName we were given.
    this._db = firebase.database(app);

    // Remember user uid.
    this._uid = userId;

    // Store a function which defines the behavior of the Spark Communications
    // SDK when it fails to import keys.
    this._importFailedCallback = importFailedCallback;

    this._identitiesCache = new Map();

    /** 
     * Resolves the user's identity by user registration ID.
     * @private
     * @param {string} regId User's registration ID.
     * @returns {Promise<string>} User Id.
     * @throws {Error} Throws when fails to resolve the user's identity.
     */
    this._getUidByRegId = regId => {
      if (this._identitiesCache.has(regId)) {
        return Promise.resolve(this._identitiesCache.get(regId));
      }
      else {
        return getIdentitiesFromRegId(regId).then(identity => {
          const userId = identity.appUserId;
          this._identitiesCache.set(regId, userId);
          return userId;
        });
      }
    };

    // Set up a mapping for transforming keys, based on whether or not
    // we use a keyProtector.
    if(keyProtector) {
      this._protectKey = key => keyProtector.protect(key);
      this._unprotectKey = key => keyProtector.unprotect(key);

      this._protectProfileKeys = keys =>
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
      this._unprotectProfileKeys = keys =>
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

      this._setManagementKeys = keys => keyProtector.setManagementKeys(keys);
    } else {
      this._protectKey = key => Promise.resolve(BBMEnterprise.Util.array2b(key));
      this._unprotectKey = key => Promise.resolve(BBMEnterprise.Util.b2array(key));

      this._protectProfileKeys = keys => {
        return {
          "private": {
            profile: {
              encrypt: BBMEnterprise.Util.array2b(keys.privateEncryptionKey),
              sign: BBMEnterprise.Util.array2b(keys.privateSigningKey)
            },
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
      };
      this._unprotectProfileKeys = keys => {
        return {
          privateEncryptionKey: BBMEnterprise.Util.b2array(keys.private.profile.encrypt),
          privateSigningKey: BBMEnterprise.Util.b2array(keys.private.profile.sign),
          publicEncryptionKey: BBMEnterprise.Util.b2array(keys.public.encrypt.key),
          publicSigningKey: BBMEnterprise.Util.b2array(keys.public.sign.key)
        };
      };

      this._setManagementKeys = () => Promise.resolve();
    }
  };

  FirebaseKeyProvider.prototype = Object.create(Object.prototype);
  FirebaseKeyProvider.prototype.constructor = FirebaseKeyProvider;

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
  FirebaseKeyProvider.prototype.profileKeysImportFailed = function(error) {
    // Allow the app provided function to decide how to handle.
    return this._importFailedCallback(error);
  };

  // :: ----------------------------------------------------------------------
  // :: Interface

  /**
   * Get the promise of the local user's encryption and signing key pairs.
   *
   * @returns {Promise}
   *  The promise will be resolved with an object with the following
   *  structure:
   *  {
   *    privateKeys: Pair of user keys
   *    managementKeys: Set of management keys used to protect private keys
   *    publicKeys: Pair of user public keys
   *  }
   *
   *  If no keys are available or if decoding the stored keys fails the
   *  promise will be rejected and the profile keys will be (re)generated by
   *  the SDK.
   *
   *  If new keys are generated because of a failure, a call will be made to
   *  saveProfileKeys() so that the newly generated keys can be stored.
   */
  FirebaseKeyProvider.prototype.getProfileKeys = function() {
    // Retrieve and decode private keys.
    return userKeyStore(this._db, this._uid).once('value').then(data => {
      let keys = data.val();
      if (!keys) {
        log(`No keys for: ${this._uid} found.`);
        return Promise.reject(new Error('No keys found'));
      }

      // Pass the management keys to the key protector.
      return this._setManagementKeys(keys.private.manage)
      // Then unprotect what is left.
      .then(() => {
        return this._unprotectProfileKeys(keys)
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
    });
  };

  /**
   * Saves the local user's encryption and signing key pairs.
   *
   * It is the app's responsibility to ensure that these keys are safely stored
   * and can be retrieved during the next session.
   *
   * Failure to successfully save the keys will have the following impacts on
   * behavior:
   *  1. Other users cannot invite the local user to chats because the chat key
   *     will not be encrypted with current public encryption key.
   *  2. Other users will not be able to verify any new message sent to a chat
   *     during this session because the user's current public signing key will
   *     not be available for others to use.
   *  3. Messages sent during this session will not be verifiable as being sent
   *     by the local user during the next session because the keys used for the
   *     current session will have been lost.
   * @returns {Promise}
   */
  FirebaseKeyProvider.prototype.saveProfileKeys = function(keys) {
    const exportKeys = Object.assign({}, keys);
    const utf8encode = BBMEnterprise.Utf8.encode;
    const base64encode = BBMEnterprise.Util.array2b;
    exportKeys.privateEncryptionKey =
      utf8encode(base64encode(exportKeys.privateEncryptionKey));
    exportKeys.privateSigningKey =
      utf8encode(base64encode(exportKeys.privateSigningKey));
    this._protectProfileKeys(exportKeys)
    .then(protectedKeys =>
      transaction(userKeyStore(this._db, this._uid), data => {
        return Object.assign(data && typeof data === 'object' ? data
                                                              : {},
                             protectedKeys);
      }).then(transactionStatus => {
        if (! transactionStatus.committed) {
          return Promise.reject('Failed to save keys. Transaction aborted.');
        }
        return undefined;
      }).catch(error => { log(`Error saving profile keys. ${error}`); }));
  };

  /**
   * Get the key data associated with all of the chats known to the user.
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
  FirebaseKeyProvider.prototype.getChatKeys = function() {
    return privateKeys(this._db, this._uid, 'mailboxes').once('value')
    .then(chatKeys => {
      var result = {};
      if (!chatKeys.val()) {
        return result;
      }
      // Decode the chat ID and the key to be returned in the result.
      let promises = [];
      Object.keys(chatKeys.val()).forEach(id => {
        try { 
          const chatId = BBMEnterprise.Util.base64urlDecode(id);
          promises.push(
              this._unprotectKey(chatKeys.val()[id])
              .then(unprotectedKey => result[chatId] = unprotectedKey));
        }
        catch(error) {
          log(`Ignoring key for chatId: ${id}; `
            + `Failed to decode value. Error: ${error}`);
        }
      });
      // We have all the keys we know about. Return them.
      return Promise.all(promises).then(() => result);
    });
  };

  /**
   * Get the chat key data associated with the given chatId.
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
  FirebaseKeyProvider.prototype.getChatKey = function(chatId) {
    return privateKeys(this._db, this._uid,
      `mailboxes/${BBMEnterprise.Util.base64urlEncode(chatId)}`).once('value')
      .then(chatKey => {
        if (!chatKey.val()) {
          // We know there is no such key.  Throw a not found error to reject
          // the promise.
          throw new BBMEnterprise.Error.NotFoundError(
            `FirebaseKeyProvider no chatKey for chatId:${chatId}`);
      }
      // Decode the chat key and resolve the promise.
      return this._unprotectKey(chatKey.val());
    });
  };

  /**
   * Save the chat key data associated with the given chatId.
   *
   * It is the app's responsibility to ensure that the chat key data is safely
   * stored and can be retrieved during the next session.
   *
   * Failure to successfully save the chat key data will result in the chat
   * identified by chatId being inaccessible during the next session.  The
   * user will have to leave the chat and get re-invited to recover the chat
   * key.
   *
   * @returns {Promise}
   */
  FirebaseKeyProvider.prototype.saveChatKey = function(chatId, key) {
    // First we need to encode the chatId so that we can set the key
    // associated with it safely.
    var id;
    try { id = BBMEnterprise.Util.base64urlEncode(chatId); }
    catch(error) {
      log(`Failed to encode chatId: ${chatId}; Error: ${error}`);
      throw error;
    }

    // Save the key in the database.
    return this._protectKey(key)
    .then(protectedKey =>
      transaction(privateKeys(this._db, this._uid, `mailboxes/${id}`),
        () => protectedKey)
      .catch(error => {
        log(`Cannot save chat key for chatId: ${chatId}; Error: ${error}`);
      })
    );
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
   */
  FirebaseKeyProvider.prototype.removeChatKey = function(chatId) {
    // First we need to encode the chatId so that we can remove it.
    var id;
    try { id = BBMEnterprise.Util.base64urlEncode(chatId); }
    catch(error) {
      log(`Failed to encode chatId: ${chatId}; Error: ${error}`);
      throw error;
    }
    // Save the key in the database.
    return privateKeys(this._db, this._uid, `mailboxes/${id}`).remove()
    .catch(error => {
      log(`Cannot remove chat key for chatId: ${chatId}; Error: ${error}`);
    });
  };

  /**
   * Get the public key data for the user identified by their BBM registration
   * ID.
   *
   * @returns {Promise}
   *   The promise of the user's public encryption and signing keys given as
   *   an object with the following structure:
   *   {
   *     encrypt : Base64 string represents public encryption key
   *     sign: Bas64 string represents public signing key
   *   }
   *
   *   The promise may be rejected with any error because the keys were not
   *   found or they failed to decode.  When this occurs, the user cannot be
   *   invited to join chats and any messages from the user in a chat will not
   *   be verifiable.
   */
  FirebaseKeyProvider.prototype.getPublicKeys = function(regId) {
    return this._getUidByRegId(regId).then(uid =>
      publicKeys(this._db, uid).once('value').then(publicKeys => {
        const publicKeysVal = publicKeys.val();
        if (!publicKeysVal) {
          return Promise.reject(
            `FirebaseKeyProvider no public keys for regId: ${regId}`);
        }
        return {
          encryptionKey: BBMEnterprise.Util.b2array(publicKeysVal.encrypt.key),
          signingKey: BBMEnterprise.Util.b2array(publicKeysVal.sign.key)
        };
      }));
  };

  /**
   * Static Factory class used to generate new instance of FirebaseKeyProvider
   */
  FirebaseKeyProvider.factory = {
    /**
     * Creates new instance for FirebaseKeyProvider
     * @returns {Promise<FirebaseKeyProvider>} The promise of new instance of
     * FirebaseKeyProvider
     */
    createInstance: (uid, firebaseConfig, accessToken,
                     importFailedCallback, keyProtect,
                     getIdentitiesFromRegId, appName) => {
      // Use the default firebase name to check if the application exists.
      if (!appName) appName = '[DEFAULT]';

      const existingApp = firebase.apps.find(app => app.name === appName);
      if (!existingApp) {
        const app = firebase.initializeApp(firebaseConfig, appName);
        const credential =
          firebase.auth.GoogleAuthProvider.credential(null, accessToken);
        // Sign-in to our Firebase project using the already logged in google
        // user's credentials.
        return firebase.auth(app).signInWithCredential(credential)
        .then(() => {
          // We have an authenticated firebase user, we can now initialize and
          // setup the firebase key provider.
          return new FirebaseKeyProvider(uid,
            importFailedCallback,
            app,
            keyProtect,
            getIdentitiesFromRegId);
        });
      }
      else {
        // Firebase was already initialized. Instantiate and setup the Firebase
        // key provider.
        return Promise.resolve(
          new FirebaseKeyProvider(uid,
            importFailedCallback,
            existingApp,
            keyProtect,
            getIdentitiesFromRegId));
      }
    }
  };

  // :: ----------------------------------------------------------------------
  // :: Helpers

  /**
   * Returns a firebase.database. Reference instance for the given path under
   * the user's private key storage area.
   * @param {String} [path]
   * @returns {firebase.database.Reference} The reference to the data contained
   * in the path under the user's private key store.
   */
  var privateKeys = (db, uid, path) =>
    db.ref(`keyStore/${uid}/private` + (path ? `/${path}` : ``));


  /**
   * Returns a firebase.database.Reference instance for the given path under
   * the user's private key storage area.
   * @param {String} uid
   * @param {String} [path]
   * @returns {firebase.database.Reference} The reference to the data contained
   * in the path under the user's public key store.
   */
  var publicKeys = (db, uid, path) =>
    db.ref(`keyStore/${uid}/public` + (path ? `/${path}` : ``));

  /**
   * Returns a firebase.database.Reference instance for the given path under
   * the user's key storage area (public and private)
   * @param {String} [path]
   * @returns {firebase.database.Reference} The reference to the data contained
   * in the path under the user's keys.
   */
  var userKeyStore = (db, uid, path) =>
    db.ref(`keyStore/${uid}` + (path ? `/${path}` : ``));

  /**
   * A local helper to emit a log message
   * @param {String} message
   */
  var log = message => console.log(`FirebaseKeyProvider: ${message}`);

  /**
   * A helper to run the given update function as a transaction against the
   * given reference point in the database.  The transaction will be run such
   * with 'applyLocally' set to false to ensure the transaction does not
   * complete until it has been applied remotely.
   * @param {DatabaseReference} ref The reference point in the database to be
   * modified by the update function.
   * @param {Function} update A developer-supplied function which will be passed
   * the current data stored at this location (as a JavaScript object). The
   * function should return the new value it would like written (as a JavaScript
   * object). If undefined is returned (i.e. you return with no arguments) the
   * transaction will be aborted and the data at this location will not be
   * modified.
   * @returns {Promise} The promise of the transaction status. The status of the
   * transaction is returned as an object with the following structure:
   * {
   *   // A flag indicating whether or not the transaction completed with
   *   // the data begin committed to the database.  When set to false,
   *   // the transaction was aborted and the data was not committed.
   *   committed: {Boolean},
   *   // The data snapshot of the reference location after update has
   *   // completed.
   *   snapshot: {DataSnapshot}
   * }
   * If an unexpected error occurs, the returned promise will be rejected
   * with an error.
   */
  var transaction = (ref, update) => ref.transaction(update, () => {}, false);

  // Return the FirebaseKeyProvider object as the public interface.
  return FirebaseKeyProvider;
});

//****************************************************************************

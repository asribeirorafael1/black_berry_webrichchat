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
 * Contains functions for storing and retrieving users from a firebase database.
 *
 * @memberof Support
 * @class FirebaseUserManager
 */
(function(FirebaseUserManager) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = FirebaseUserManager();
    }
    exports.FirebaseUserManager = FirebaseUserManager();
  }
  else {
    global.FirebaseUserManager = FirebaseUserManager();
  }
}).call(this, function() {
  // To be thrown when user failed to register in database.
  function RegistrationFailedError(message) {
    this.name = 'RegistrationFailedError';
    this.message = message || '';
  }
  RegistrationFailedError.prototype = Error.prototype;

  // To be thrown if FirebaseUserManager has invalid parameter.
  function InvalidArgumentError(message) {
    this.name = 'InvalidArgumentError';
    this.message = message || '';
  }
  InvalidArgumentError.prototype = Error.prototype;

  /**
   * Tracks user contact list changes and triggers following events:
   *  - user_added: when a new user is added
   *  - user_changed: when existing user is changed
   *  - user_removed: when existing user is removed
   * Provides functions to get user user information:
   *  - getUserAvatar: gets user avatar image URL
   *  - getUserName: gets user name
   *  - getUser: gets user information (regId, name, avatar)
   *
   * @param {object} userRegId regId of the user.
   *
   * @param {object} authManager An authentication manager, which will be used
   * to retrieve authentication tokens to get access to the user information
   * from cloud storage and user information to identify which information in
   * the cloud storage is for the local user.
   *
   * @param {function} userInfo A constructor for the GenericUserInfo class.
   * This class is provided by the support library. Once ES6 imports are
   * available in all browsers, this should be replaced by an ES6 import.
   *
   * @param {firebase.app.App} app The firebase app to get access to the
   * database.
   *
   * @param {firebase.User} user The firebase user to use as the current
   * identity.
   *
   * @param {function} getIdentitiesFromAppUserId Gets the identity information
   * for the given app userId {@link BBMEnterprise.getIdentitiesFromAppUserId}
   * 
   * @param {function} getIdentitiesFromAppUserIds Gets the identity information
   * for the given app userIds {@link BBMEnterprise.getIdentitiesFromAppUserIds}
   * 
   * @throws {RegistrationFailedError} Thrown when user failed to register.
   *
   * @throws {InvalidArgumentError} Thrown when userInfo parameter is invalid.
   */ 
  var FirebaseUserManager = function(userRegId, authManager, userInfo, app,
    user, getIdentitiesFromAppUserId, getIdentitiesFromAppUserIds) {

    /**
     * @typedef {object} UserInfo User information
     * @property {string} userRegId Registration id of the user.
     * @property {string} userName Name of the user.
     * @property {string} avatarUrl Avatar image URL of the user.
     * @memberof Support.FirebaseUserManager
     */

    if (typeof userRegId !== 'string') {
      throw new InvalidArgumentError('userRegId must be a string.');
    }

    const MAX_IDENTITIES_PER_REQUEST = 50;
    let initialized = false;
    const m_userMap = {};
    const m_localUser = authManager.getLocalUserInfo();
    m_localUser.regId = userRegId;
    const m_eventListeners = {
      user_added : [],
      user_changed : [],
      user_removed : []
    };

    const m_getIdentitiesFromAppUserId = getIdentitiesFromAppUserId;
    const m_getIdentitiesFromAppUserIds = getIdentitiesFromAppUserIds;
    const m_createUserInfo = userInfo;
    const m_identitiesCache = new Map();
    const m_outstandingRequests = new Map();

    // Get a reference to the database service for "user" node.
    const database = firebase.database(app);

    // If the local user isn't already registered in firebase, add them now.
    database.ref('bbmsdk/identity/users/' + m_localUser.userId).set({
      email: m_localUser.email,
      avatarUrl: m_localUser.avatarUrl,
      name: m_localUser.displayName
    }).catch(error => {
      throw new RegistrationFailedError(error);
    });

    //#region private methods

    // Resolves user identity by user Id.
    const getRegIdByUid = userId => {
      if (m_identitiesCache.has(userId)) {
        return Promise.resolve(m_identitiesCache.get(userId));
      }
      if (m_outstandingRequests.has(userId)) {
        return m_outstandingRequests.get(userId);
      }

      const requestPromise = m_getIdentitiesFromAppUserId(userId)
      .then(identity => {
        m_outstandingRequests.delete(userId);
        const regId = identity.regId;
        m_identitiesCache.set(userId, regId);
        return regId;
      })
      .catch(error => {
        m_outstandingRequests.delete(userId);
        throw error;
      });
      m_outstandingRequests.set(userId, requestPromise);
      return requestPromise;
    };

    /**
     * This is private utility function serves to invoke client defined event
     * handler wrapped with try / catch.
     * @private
     * @param {function} eventHandler Event handler defined by the customer.
     * @param {UserInfo} userInfo Event data to be passed to eventHandler.
     */
    const safeHandlerCall = function(eventHandler, userInfo) {
      try {
        eventHandler(userInfo);
      }
      catch (error) {
        console.warn(`Error while executing event listener: ${error}`);
      }
    };

    /**
     * Traverses firebase database snapshot. Resolves identities for all users
     * in the snapshot and notifies the client application about new users if
     * the user identities are resolved successfully.
     * @private
     * @param {function} eventHandler Event handler defined by the customer.
     * @param {UserInfo} userInfo Event data to be passed to eventHandler.
     */
    const processSnapshot = function(snapshot) {
      const records = snapshot.val();
      const userIds = [];
      const promises = [];
      // Get collection of user ids.
      Object.keys(records).forEach(key => { userIds.push(key); });

      // Split collection into blocks of promises to resolve identity by user
      // Ids. Each promise resolves number of identities not larger than
      // MAX_IDENTITIES_PER_REQUEST.
      while (userIds.length > 0) {
        promises.push(m_getIdentitiesFromAppUserIds(userIds.splice(0,
          MAX_IDENTITIES_PER_REQUEST)));
      }

      if (promises.length === 0) {
        return Promise.resolve();
      }

      return Promise.all(promises).then(results => {
        // Promises are resolved. Combine all results into single collection of
        // identities.
        Object.keys(results).forEach(key => {
          const identities = results[key];
          // For each resolved identity generate user info and invoke
          // 'user_added' event handlers to notify client about new user added.
          for (let i = 0; i < identities.length; ++i) {
            try {
              const identity = identities[i];
              // Store identity into identity cache.
              m_identitiesCache.set(identity.appUserId, identity.regId.toString());
              const userInfo = records[identity.appUserId];
              const regId = identity.regId.toString();
              if (userInfo && !m_userMap[regId]) {
                // Identity resolved successfully. Create user info based on the
                // retrieved information.
                const userId = identity.appUserId;
                const genericUserInfo = new m_createUserInfo(
                  userId, regId, userInfo.name,
                  userInfo.email, userInfo.avatarUrl);
                // Store generated user info into user info cache.
                m_userMap[regId] = genericUserInfo;
                // Notify client about new users added.
                m_eventListeners.user_added.forEach(eventHandler => {
                  safeHandlerCall(eventHandler, genericUserInfo);
                });
              }
            }
            catch (error) {
              console.warn(`Error happened while parsing snapshot ${error}`);
            }
          }
        });
      });
    };

    /**
     * Handles 'child_added' event (invoked by user management service provider)
     * Triggers all listeners of 'user_added' event.
     * @param {object} userInfo
     * User information object defined by user management service provider
     */
    const onChildAddedHandler = function(firebaseUserInfo) {
      return getRegIdByUid(firebaseUserInfo.key)
      .then(regId => {
        if (!m_userMap[regId]) {
          // The Google user avatar URL normally contains a sz (size) parameter
          // that specifies the dimensions to download the image.  When this is
          // passed the image is automatically resized on the server to the
          // specified dimensions. If an app has a specific size that it
          // normally displays the avatar it might want to replace the specified
          // size with its own requirements.  Otherwise the app might want to
          // simply remove the size parameter to download the full resolution.
          // The current default is a size of 50x50 pixels specified by ?sz=50
          // at the end of the URL.
          const userInfo = new m_createUserInfo(firebaseUserInfo.key, regId,
            firebaseUserInfo.val().name, firebaseUserInfo.val().email,
            firebaseUserInfo.val().avatarUrl);
          m_userMap[regId] = userInfo;
          m_eventListeners.user_added.forEach(eventHandler => {
            safeHandlerCall(eventHandler, userInfo);
          });
        }
      })
      .catch(error => {
        console.log(`Can not resolve BBM registration ID for the user`
          + ` ${firebaseUserInfo.val().name} (key: ${firebaseUserInfo.key})`
          + ` - ${error}`);
      });
    };

    /**
     * Handles 'child_changed' event (invoked by user management service
     * provider). Triggers all listeners of 'user_changed' event.
     * @param {object} userInfo User information object defined by user
     * management service provider.
     */
    const onChildChangedHandler = function(firebaseUserInfo) {
      return getRegIdByUid(firebaseUserInfo.key)
      .then(regId => {
        // Check if user is already in user map.
        if (m_userMap[regId]) {
          // Replace the existing user information in the map with the new
          // user information.
          const userInfo = new m_createUserInfo(firebaseUserInfo.key, regId,
            firebaseUserInfo.val().name, firebaseUserInfo.val().email,
            firebaseUserInfo.val().avatarUrl);
          m_userMap[regId] = userInfo;
          // Notify client the user has new information.
          m_eventListeners.user_changed.forEach(eventHandler => {
            safeHandlerCall(eventHandler, userInfo);
          });
        }
        else {
          console.log(`Firebase user ${regId} has never been added`
            + ' to map before.');
        }
      })
      .catch(error => {
        console.log(`Can not resolve BBM registration ID for the user`
          + ` ${firebaseUserInfo.val().name} (key: ${firebaseUserInfo.key})`
          + ` - ${error}`);
      });
    };

    /**
     * Handles 'child_removed' event (invoked by user management service
     * provider). Triggers all listeners of 'user_removed' event.
     * @param {object} userInfo
     * User information object defined by user management service provider.
     */
    const onChildRemovedHandler = function(firebaseUserInfo) {
      return getRegIdByUid(firebaseUserInfo.key)
      .then(regId => {
        // Check if the user map contains a user that has the same regId.
        const userInfo = m_userMap[regId];
        if (userInfo) {
          // Remove the user from the user map.
          delete m_userMap[regId];
          // Notify client the user got removed.
          m_eventListeners.user_removed.forEach(eventHandler => {
            safeHandlerCall(eventHandler, userInfo);
          });
        } else {
          console.log(`Firebase user ${regId} has never`
            + ' been added to map before.');
        }
      })
      .catch(error => {
        console.log(`Can not resolve BBM registration ID for the user`
          + ` ${firebaseUserInfo.val().name} (key: ${firebaseUserInfo.key})`
          + ` - ${error}`);
      });
    };

    //#endregion private methods

    //#region public methods

    /**
     * Adds event listener.
     * @param {string} event Event to subscribe to. FirebaseUserManager fires
     * following events:
     *  - user_added: triggered when a new user is added
     *  - user_changed: triggered when existing user is changed
     *  - user_removed: triggered when existing user is removed
     * @param {function} eventListener Event handler function. When invoked, it
     * contains {@link UserInfo} object as parameter.
     * @throws {InvalidArgumentError} Thrown if the eventListener is not a
     * function.
     */
    this.addEventListener = function (event, eventListener) {
      if (typeof eventListener !== 'function') {
        throw new InvalidArgumentError('Event handler must be a function');
      }
      const eventListeners = m_eventListeners[event];
      if (eventListeners) {
        // Do not add event listener if it was already added previously
        const index = eventListeners.indexOf(eventListener);
        if (index === -1) {
          eventListeners.push(eventListener);
        }
      }
      else {
        console.warn(`Trying to subscribe to the unknown event: ${event}`);
      }
    };

    /**
     * Removes previously added event listener.
     * @param {string} event
     *  Event to unsubscribe from. FirebaseUserManager fires following events:
     *  - user_added: triggered when a new user is added
     *  - user_changed: triggered when existing user is changed
     *  - user_removed: triggered when existing user is removed
     * @param {function} eventListener
     *  Previously added event handler function.
     * @throws {InvalidArgumentError}
     *  Thrown if the eventListener is not a function.
     */
    this.removeEventListener = function (event, eventListener) {
      if (typeof eventListener !== 'function') {
        throw new InvalidArgumentError('Event handler must be a function');
      }

      const eventListeners = m_eventListeners[event];
      if (eventListeners) { 
        const index = eventListeners.indexOf(eventListener);
        if (index !== -1) {
          eventListeners.splice(index, 1);
        }
      }
      else {
        console.warn(`Trying to unsubscribe from the unknown event: ${event}`);
      }
    };

    /**
     * Get the user avatar image URL by regId.
     * @param {string} regId The regId of the user.
     * @returns {string} In case of success returns image URL of the user.
     * Returns null if failed.
     */
    this.getUserAvatar = function(regId) {
      const userInfo = m_userMap[regId];
      if (userInfo) {
        return userInfo.avatarUrl || null;
      }
      return null;
    };

    /**
     * Gets the user name by regId.
     * @param {string} regId The regId of the user.
     * @returns {string} User name in case of success. Returns null if failed.
     */
    this.getDisplayName = function(regId) {
      const userInfo = m_userMap[regId];
      // If the user is in the user map, return their name.
      if (userInfo) {
        return userInfo.displayName || null;
      }
      return null;
    };

    /**
     * Gets user information by regId.
     * @param {string} regId The regId of the user.
     * @returns {UserInfo} In case of success returns user information.
     * Returns null if failed.
     */
    this.getUser = function(regId) {
      return m_userMap[regId];
    };

    /**
     * Gets information about the local user.
     * @returns {UserInfo} In case of success returns user information.
     */
    this.getLocalUser = function() {
      const userInfo = m_userMap[m_localUser.regId];
      return userInfo || m_localUser;
    };

    this.initialize = () => new Promise(resolve => {
      if (initialized) {
        throw new Error('FirebaseUserManager is already initialized');
      }
      else {
        initialized = true;
      }
      // Initiate contacts download.
      // Get snapshot of all contacts from the Firebase database to make bulk
      // requests to map user identities.
      const ref = database.ref('bbmsdk/identity/users/');
      const onSnapshotReceived = snapshot => {
        ref.off('value', onSnapshotReceived);
        return processSnapshot(snapshot)
        .then(() => {
          // Child added will be triggered for each existing record in the
          // database. There is no solid way to prevent it from doing this.
          ref.on('child_added', onChildAddedHandler);
          ref.on('child_changed', onChildChangedHandler);
          ref.on('child_removed', onChildRemovedHandler);
          resolve();
        });
      };
      ref.on('value', onSnapshotReceived);
    });
    //#endregion public methods
  };

  FirebaseUserManager.prototype = Object.create(Object.prototype);

  FirebaseUserManager.prototype.constructor = FirebaseUserManager;

  FirebaseUserManager.factory = {
   /**
    * Creates instance of FirebaseUserManager.
    * @param {Object} firebaseConfig A configuration object for the firebase
    * project. This should be copy/pasted from the firebase web console.
    * @returns {Promise<FirebaseUserManager>} Promise resolves with new instance
    * of FirebaseUserManager.
    */
    createInstance : (firebaseConfig, userRegId, authManager, userInfo,
                      getIdentitiesFromAppUserId, getIdentitiesFromAppUserIds,
                      appName) => {
      // Use the default firebase name to check if the application exists.
      if(!appName) appName = '[DEFAULT]';

      const existingApp = firebase.apps.find(app => app.name === appName);
      // Check if Firebase application was already initialized.
      if (!existingApp) {
        // Get access token from the auth manager.
        return authManager.getUserManagerToken().then(accessToken => {
          const app = firebase.initializeApp(firebaseConfig, appName);
          const credential =
            firebase.auth.GoogleAuthProvider.credential(null, accessToken);
          // Sign-in to our Firebase project using the already logged
          // in google user's credentials.
          return firebase.auth(app).signInWithCredential(credential)
          .then(user => {
            return new FirebaseUserManager(userRegId, authManager, userInfo,
              app, user, getIdentitiesFromAppUserId,
              getIdentitiesFromAppUserIds);
          });
        });
      }
      else {
        // Firebase application is initialized.
        // Just return Promise of new user manager instance.
        return Promise.resolve(new FirebaseUserManager(userRegId, authManager,
          userInfo, existingApp,
          firebase.auth(existingApp).currentUser, getIdentitiesFromAppUserId,
          getIdentitiesFromAppUserIds));
      }
    }
  };

  return FirebaseUserManager;

});

//****************************************************************************

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
 * @typedef {object} UserInfo
 *   This object encapsulates the user information that is used by this
 *   authentication manager.
 *
 * @property {string} userId
 *   The application user ID of the user.
 *
 * @property {string} [regId]
 *   The regId of the user.  This will be undefined when the user is not known
 *   to the BlackBerry Infrastructure.
 *
 * @property {string} [displayName]
 *   The display name of the user.  This will be undefined if the user has not
 *   had a display name set.
 *
 * @memberof Support.MockUserManager
 */

/**
 * Tracks user contact list changes and triggers following events:
 *  - user_added: when a new user is added
 *  - user_changed: when existing user is changed
 *  - user_removed: when existing user is removed
 * Provides functions to manage user information:
 *  - getLocalUser: gets local user information (regId, name, avatar)
 *  - addUser: adds new user to user manager
 *  - deleteUser: deletes user from user manager
 *  - getUser: gets user information.
 *  - syncUsers: resolve user identities.
 * This uses local storage to store user information.
 * @param {string} userRegId regId of the user.
 * @param {Support.auth.MockAuthManager} authManager An instance of
 * MockAuthManager manager, which will be used to retrieve local user
 * information.
 * @param {function} getIdentitiesFromAppUserIds Gets the identity information
 * for the given appUserIds {@link BBMEnterprise.getIdentitiesFromAppUserIds}
 * @param {string} domain sandbox domain
 * @memberof Support
 * @class MockUserManager
 */
class MockUserManager {
  /**
   * Instantiates MockUserManager.
   */
  constructor (userRegId, authManager, getIdentitiesFromAppUserIds, domain) {
    this._getIdentitiesByAppIds = getIdentitiesFromAppUserIds;
    this._domain = domain;
    this._userMap = new Map();
    this._userMapByRegId = new Map();
    this._eventListeners = {
      user_added: [],
      user_changed: [],
      user_removed: []
    };
    this._localUser = Object.assign({}, authManager.getLocalUserInfo());
    this._localUser.regId = userRegId;
  }

  //#region private methods

  /**
   * Utility function serves to invoke client defined event handler wrapped
   * with try / catch.
   * @private
   * @param {function} eventHandler Event handler defined by the customer.
   * @param {UserInfo} userInfo Event data to be passed to eventHandler.
   */
  _safeHandlerCall(eventHandler, userInfo) {
    try {
      eventHandler(userInfo);
    }
    catch (error) {
      console.warn(`Error while executing event listener: ${error}`);
    }
  }

  /**
   * Stores user information in the local storage.
   * @param {UserInfo} userInfo User information.
   */
  _storageStoreUser(userInfo) {
    if (localStorage) {
      const userInfoJson = JSON.stringify(userInfo);
      const key = encodeURIComponent(this._localUser.userId) + '+' +
        this._domain + '+' +
        encodeURIComponent(userInfo.userId);
      localStorage.setItem(key, userInfoJson);
    }
  }

  /**
   * Deletes user information from the local storage.
   * @param {UserInfo} userInfo User information.
   */
  _storageDeleteUser(userInfo) {
    if (localStorage) {
      const key = encodeURIComponent(this._localUser.userId) + '+' +
        this._domain + '+' +
        encodeURIComponent(userInfo.userId);
      localStorage.removeItem(key);
    }
  }

  /**
   * Retrieves the list of the previously stored users.
   * @private
   * @returns {Map<string, UserInfo>} UserInfo map by user ID.
   */
  _storageGetUsers() {
    if (!localStorage) {
      console.warn('localStorage is not defined in this environment');
      return new Map();
    }
    const storedUserMap = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      try {
        const key = localStorage.key(i);
        if (key.startsWith(encodeURIComponent(this._localUser.userId))) {
          const keySplit = key.split('+');
          if (keySplit.length < 3) {
            continue;
          }
          const storedDomain = keySplit[1];
          if (storedDomain === this._domain) {
            const userInfoJson = localStorage.getItem(key);
            const userInfo = JSON.parse(userInfoJson);
            storedUserMap.set(userInfo.userId, userInfo);
          }
        }
      }
      catch(error) {
        console.warn(`Failed to get user from localStorage | ${error}`);
      }
    }
    return storedUserMap;
  }

  /**
   * Creates new user.
   * @private
   * @param {UserInfo} userInfo 
   */
  _create(userInfo) {
    if (this._userMap.has(userInfo.userId)) {
      throw new Error('User already exists');
    }
    this._userMap.set(userInfo.userId, userInfo);
    if (userInfo.regId) {
      this._userMapByRegId.set(userInfo.regId, userInfo);
    }
    this._storageStoreUser(userInfo);
    this._eventListeners.user_added.forEach(eventHandler => {
      this._safeHandlerCall(eventHandler, userInfo);
    });
  }

  /**
   * Updates user information.
   * @param {UserInfo} userInfo 
   */
  _update(userInfo) {
    this._userMap.set(userInfo.userId, userInfo);
    if (userInfo.regId) {
      this._userMapByRegId.set(userInfo.regId, userInfo);
    }
    this._storageStoreUser(userInfo);
    this._eventListeners.user_changed.forEach(eventHandler => {
      this._safeHandlerCall(eventHandler, userInfo);
    });
  }

  /**
   * Deletes existing user.
   * @private
   * @param {string} userId User ID
   */
  _delete(userId) {
    const userInfo = this._userMap.get(userId);
    if (userInfo) {
      this._userMap.delete(userId);
      if (userInfo.regId) {
        this._userMapByRegId.delete(userInfo.regId);
      }
      this._storageDeleteUser(userInfo);
      this._eventListeners.user_removed.forEach(eventHandler => {
        this._safeHandlerCall(eventHandler, userInfo);
      });
    }
  }

  //#endregion private methods

  //#region public methods

  /**
   * Retrieves all previously stored contacts from the local storage.
   * @returns {Promise} Promise resolves with no data in case of success.
   * Rejects with error if case of failure.
   */
  initialize() {
    try {
      const storedUsersMap = this._storageGetUsers();
      storedUsersMap.forEach(userInfo => {
        this._create(userInfo);
      });
      return Promise.resolve();
    }
    catch(error) {
      return Promise.reject(error);
    }
  }

  /**
   * Adds event listener.
   * @param {string} event Event to subscribe to. MockUserManager fires
   * following events:
   *  - user_added: triggered when a new user is added
   *  - user_changed: triggered when existing user is changed
   *  - user_removed: triggered when existing user is removed
   * @param {function} eventListener Event handler function. When invoked, it
   * contains {@link UserInfo} object as parameter.
   * @throws {Error} Thrown if the eventListener is not a
   * function.
   */
  addEventListener(event, eventListener) {
    if (typeof eventListener !== 'function') {
      throw new Error('Event handler must be a function');
    }
    const eventListeners = this._eventListeners[event];
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
  }

  /**
   * Removes previously added event listener.
   * @param {string} event
   *  Event to unsubscribe from. MockUserManager fires following events:
   *  - user_added: triggered when a new user is added
   *  - user_changed: triggered when existing user is changed
   *  - user_removed: triggered when existing user is removed
   * @param {function} eventListener
   *  Previously added event handler function.
   * @throws {Error}
   *  Thrown if the eventListener is not a function.
   */
  removeEventListener(event, eventListener) {
    if (typeof eventListener !== 'function') {
      throw new Error('Event handler must be a function');
    }

    const eventListeners = this._eventListeners[event];
    if (eventListeners) { 
      const index = eventListeners.indexOf(eventListener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
    else {
      console.warn(`Trying to unsubscribe from the unknown event: ${event}`);
    }
  }

  /**
   * Gets the user avatar image URL by regId
   * @returns {string} Returns null (Mock user manager does not return avatar
   * URL)
   */
  getUserAvatar() {
    // Mock user manager does not return avatar URL.
    return null;
  }

  /**
   * Gets the display name by regId.
   * @param {string} regId The regId of the user.
   * @returns {string}
   *   The returned string will be the first truthy value of the following:
   *   - The display name of the user associated with the given regId
   *   - The application user ID of the user associated with the given regId
   *   - The regId when no user info for the regId is available
   */
  getDisplayName(regId) {
    const user = (
      this._localUser.regId === regId
        // We are looking up the local user.
        ? this._localUser
        // Otherwise, we look to see if we know of user for this regId.
        : this._userMapByRegId.get(regId)
    );

    // If we don't have a user, we know nothing about this user, so just
    // return the regId.
    if (! user) {
      return regId;
    }

    // Otherwise, we will use the first truthy value we find from the
    // user's information.
    return (user.displayName || user.userId || user.regId);
  }

  /**
   * Gets information about the local user.
   * @returns {UserInfo} In case of success returns user information.
   */
  getLocalUser() {
    return this._localUser;
  }

  /**
   * Adds new user.
   * @param {string} userId User ID.
   * @param {string} [name] User name.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  addUser(userId, name) {
    if (!userId) {
      return Promise.reject(new Error('Missing userId'));
    }
    const userInfo = {
      displayName: name,
      userId: userId,
    };
    this._create(userInfo);

    return this._getIdentitiesByAppIds([ userInfo.userId ])
    .then(identities => {
      if (identities.length > 0) {
        const identity = identities[0];
        userInfo.regId = identity.regId;
        this._update(userInfo);
      }
    });
  }

  /**
   * Deletes user.
   * @param {string} userId User ID.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  deleteUser(userId) {
    this._delete(userId);
  }

  /**
   * Gets user information by regId.
   * @param {string} regId The regId of the user.
   * @returns {UserInfo} User info if found, undefined otherwise.
   */
  getUser(regId) {
    return this._userMapByRegId.get(regId);
  } 

  /**
   * Resolves users identities for existing contacts.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  syncUsers() {
    const userInfos = [... this._userMap.values()]
      .filter(x => x.regId === undefined);
    if (userInfos.length === 0) {
      return Promise.resolve();
    }
    const userIds = userInfos.map(x => x.userId);
    const promises = [];
    while (userIds.length > 0) {
      promises.push(this._getIdentitiesByAppIds(userIds.splice(0, 50)));
    }
    return Promise.all(promises)
    .then(results => {
      Object.keys(results).forEach(key => {
        const identities = results[key];
        for (const identity of identities.values()) {
          const userInfo = this._userMap.get(identity.appUserId);
          userInfo.regId = identity.regId;
          this._update(userInfo);
        }
      });
    });
  }

  //#endregion public methods
}

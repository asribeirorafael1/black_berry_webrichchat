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
 * Contains functions for storing and retrieving users from google contacts.
 * This requires https://apis.google.com/js/api.js be included to your
 * application.
 * 
 * Supports maximum 2000 contacts.
 * 
 * Only users with unique userIds are supported. I.e. if there are multiple
 * users with the same userId, only one contact will be selected. This is
 * implemented this way to keep this sample code simple.
 * 
 * @memberof Support
 * @class GooglePeopleUserManager
 */
class GooglePeopleUserManager {

  /**
   * @typedef {object} UserInfo
   * @property {string} userRegId regId of the user.
   * @property {string} userName Name of the user.
   * @property {string} avatarUrl Avatar image URL of the user.
   * @property {string} userId Application user ID.
   * @property {string} resourceName Opaque data for internal use.
   * @memberof Support.GooglePeopleUserManager
   */

   /**
    * @typedef {object} Person
    * {@link https://developers.google.com/people/api/rest/v1/people#Person}
    */

  /**
   * @typedef {object} Identity
   * @property {string} appUserId Application user ID.
   * @property {string} regId regId of the user.
   * @property {Person} person Instance of Google Person associated with the
   * user.
   */

  /**
   * Instantiates GooglePeopleUserManager.
   * @param {string} userRegId The regId of the logged in user.
   * This can be obtained from the BBMEnterprise.getRegistrationInfo() API once
   * the SDK has completed setup.
   * @param {object} authManager An instance of GoogleAuthManager manager, which
   * will be used to retrieve authentication tokens to get access to the user's
   * contacts.
   * @param {function} getIdentitiesFromAppUserIds Gets the identity information
   * for the given app userIds {@link BBMEnterprise.getIdentitiesFromAppUserIds}
   * @param {object} authConfig Application authentication configuration.
   * @throws {Error} Throws error when provided parameters are invalid.
   */
  constructor (userRegId, authManager, getIdentitiesFromAppUserIds, authConfig) {
    if (typeof userRegId !== 'string') {
      throw new Error('User userRegId is not specified');
    }
    if (!authManager) {
      throw new Error('Authentication manager is not specified');
    }
    if (typeof getIdentitiesFromAppUserIds !== 'function') {
      throw new Error('getIdentitiesFromAppUserIds is not a function');
    }
    if (!authConfig) {
      throw new Error('Authentication configuration is not specified');
    }
    if (!authConfig.scope.includes('https://www.googleapis.com/auth/contacts')) {
      throw new Error('Authentication configuration scope must include ' +
        'https://www.googleapis.com/auth/contacts');
    }
    if (!gapi) {
      throw new Error('gapi is not defined');
    }

    this._getIdentitiesByAppIds = getIdentitiesFromAppUserIds;
    this._authManager = authManager;
    this._authConfig = authConfig;
    this._contactMap = new Map();
    this._userIdentities = new Map();
    this._eventListeners = {
      user_added : [],
      user_changed : [],
      user_removed : []
    };
    this._localUser = Object.assign({}, authManager.getLocalUserInfo());
    this._localUser.regId = userRegId;
  }

  //#region private methods

  /**
   * Logs the provided text with this class name as prefix.
   * @private
   * @param {string} text Text to be logged.
   */
  _log(text) {
    console.log(`GooglePeopleUserManager: ${text}`);
  }

  /**
   * Logs the provided text as warning with this class name as prefix.
   * @private
   * @param {string} text Text to be logged as warning.
   */
  _warn(text) {
    console.warn(`GooglePeopleUserManager: ${text}`);
  }

  /**
   * Initializes Google API client.
   * @private
   * @returns {Promise} Resolved promise after initialization is complete.
   */
  _initializeGapiClient() {
    const loadGapi = () => new Promise((resolve, reject) => {
      gapi.load('client', { callback : resolve, onerror: reject });
    });

    return loadGapi()
    .then(() => {
      // Set of API to be loaded by gapi client.
      const DISCOVERY_DOCS =
        [ 'https://www.googleapis.com/discovery/v1/apis/people/v1/rest' ];
      // Retrieve access token from the auth manager.
      return this._authManager.getUserManagerToken()
      .then(accessToken => 
        // Set access token to gapi client.
        gapi.client.init({
          apiKey: this._authConfig.apiKey,
          clientId: this._authConfig.clientId,
          scope: this._authConfig.scope,
          discoveryDocs: DISCOVERY_DOCS
        })
        .then(() => {
          gapi.client.setToken({ access_token : accessToken });
        }));
    })
    .catch(error => {
      this._warn(`Failed to initialize gapi client | Error: ${error}`);
      throw(error);
    });
  }

  /**
   * Creates new instance of {@link UserInfo} based on the provided parameters.
   * @private
   * @param {string} regId The regId of the user.
   * @param {Person} person Instance of Person object returned by PeopleAPI
   * @returns {UserInfo} User information.
   */
  _createUserInfo(regId, person) {
    // Get email addresses. User first email associated with the profile.
    const email = person.emailAddresses && person.emailAddresses.length > 0
      ? person.emailAddresses[0].value
      : undefined;

    // Get display name. If name is undefined, then use email instead.
    const name = person.names && person.names.length > 0
      ? person.names[0].displayName
      : email;

    // Get avatar URL.
    const avatarUrl = person.photos && person.photos.length > 0
      ? person.photos[0].url
      : undefined;

    const userId = this._getUserId(person);

    const resourceName = person.resourceName;

    // Build user info object using retrieved properties.
    return {
      displayName: name,
      regId: regId,
      avatarUrl: avatarUrl,
      email: email,
      userId: userId,
      resourceName: resourceName
    };
  }

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
      this._warn(`Error while executing event listener: ${error}`);
    }
  }

  /**
   * This will fetch all of the logged in user's contacts.
   * @private
   * @returns {Promise<Person[]>} Array of persons
   * Function returns an empty array if gapi had failed to return contacts.
   */
  _getContacts() {
    return gapi.client.people.people.connections.list({
      'resourceName': 'people/me',
      'pageSize': 2000,
      'personFields': 'names,photos,emailAddresses,metadata'
    })
    .then(response => {
      return response.result.connections || [];
    })
    .catch(error => {
      this._warn(`Failed to get list of contacts | Error: ${error}`);
      return [];
    });
  }

  /**
   * Checks if specified contact has a google profile.
   * @private
   * @param {Person} person Person object
   * @returns {boolean} True if specified contact has google profile. False 
   * otherwise.
   */
  _isGoogleContact(person) {
    const source =
      person.metadata.sources.find(source => source.type === 'PROFILE');
    return source !== undefined;
  }

  /**
   * Returns user for the provided person.
   * @private
   * @param {Person} person Person object
   * @returns {string} User ID of the specified person. Returns undefined if
   * person does not have user ID.
   */
  _getUserId(person) {
    try {
      const ret = this._isGoogleContact(person)
        ? person.metadata.sources.find(source => source.type === 'PROFILE').id
        : person.metadata.sources.find(source => source.type === 'CONTACT').id;
      return ret;
    }
    catch(error) {
      this._warn('Failed to get user ID for the person: '
        + JSON.stringify(person));
      return undefined;
    }
  }

  /**
   * Returns the promise of array of identities by user ids.
   * @private
   * @param {Person[]} persons Array of Person objects
   * @returns {Promise<Identity[]>} Promise of identities associated with
   * the provided persons.
   */
  _getIdentities(persons) {
    if (persons.length === 0) {
      return Promise.resolve([]);
    }
    const googleContacts = new Map();
    for (const person of persons.values()) {
      if (this._isGoogleContact(person)) {
        const userId = person.metadata.sources.find(source =>
          source.type === 'PROFILE').id;
        googleContacts.set(userId, person);
      }
    }
    // Split collection into blocks of promises to resolve identity by user
    // IDs. Each promise resolves number of identities not larger than 50.
    const promises = [];
    let userIds = [...googleContacts.keys()];
    while (userIds.length > 0) {
      promises.push(this._getIdentitiesByAppIds(userIds.splice(0, 50)));
    }
    return Promise.all(promises)
    .then(results => {
      const ret = [];
      Object.keys(results).forEach(key => {
        const identities = results[key];
        for (const identity of identities.values()) {
          if (identity.appUserId) {
            identity.person = googleContacts.get(identity.appUserId);
            ret.push(identity);
          }
        }
      });
      return ret;
    });
  }

  /**
   * Compares two {@link UserInfo} objects.
   * @private
   * @param {UserInfo} userInfo1 Object to compare.
   * @param {UserInfo} userInfo2 Object to compare.
   * @returns {boolean} Returns true if objects are equal. Returns false
   * otherwise.
   */
  _isEqualUserInfo(userInfo1, userInfo2) {
    const jsonUserInfo1 = JSON.stringify(userInfo1,
      Object.keys(userInfo1).sort());
    const jsonUserInfo2 = JSON.stringify(userInfo2,
      Object.keys(userInfo2).sort());
    return jsonUserInfo1.localeCompare(jsonUserInfo2) === 0;
  }

  /**
   * Caches specified user information.
   * @private
   * @param {UserInfo} userInfo User information to be stored.
   */
  _storeUserInfo(userInfo) {
    this._contactMap.set(userInfo.userId, userInfo);
    if (userInfo.regId) {
      this._userIdentities.set(userInfo.regId, userInfo.userId);
    }
  }

  //#endregion private methods


  //#region public methods

  /**
   * Initializes GooglePeopleUserManager, and gets user's contacts.
   * Application will receive 'user_added' event for each contact discovered for
   * the current local user.
   * This does not support multiple contacts with same userId. Only unique
   * userIds are supported.
   * @returns {Promise} Resolved promise in case of success.
   */
  initialize() {
    return this._initializeGapiClient()
    .then(() => {
      return this._getContacts()
      .then(contacts => {
        // Notify clients about all new contacts.
        for (const contact of contacts.values()) {
          const userInfo = this._createUserInfo(undefined, contact);
          this._storeUserInfo(userInfo);
          this._eventListeners.user_added.forEach(eventHandler => {
            this._safeHandlerCall(eventHandler, userInfo);
          });
        }
        // Resolve known identities and notify clients about changed contacts.
        if (contacts.length > 0) {
          return this._getIdentities(contacts)
          .then(identities => {
            for(const identity of identities.values()) {
              const userInfo =
                this._createUserInfo(identity.regId, identity.person);
              this._storeUserInfo(userInfo);
              this._eventListeners.user_changed.forEach(eventHandler => {
                this._safeHandlerCall(eventHandler, userInfo);
              });
            }
          });
        }
        return undefined;
      });
    });
  }

  /**
   * Adds event listener.
   * @param {string} event Event to subscribe to. GooglePeopleUserManager fires
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
      this._warn(`Trying to subscribe to the unknown event: ${event}`);
    }
  }

  /**
   * Removes previously added event listener.
   * @param {string} event
   *  Event to unsubscribe from. GooglePeopleUserManager fires following events:
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
      this._warn(`Trying to unsubscribe from the unknown event: ${event}`);
    }
  }

  /**
   * Get the user avatar image URL by regId.
   * @param {string} regId The regId of the user.
   * @returns {string} In case of success returns image URL of the user.
   * Returns null if failed.
   */
  getUserAvatar(regId) {
    if (this._localUser.regId === regId) {
      return this._localUser.avatarUrl;
    }
    let ret = null;
    const userId = this._userIdentities.get(regId);
    if (userId) {
      const userInfo = this._contactMap.get(userId);
      if (userInfo) {
        ret = userInfo.avatarUrl || null;
      }
    }
    return ret;
  }
  
  /**
   * Gets the user name by regId.
   * @param {string} regId The regId of the user.
   * @returns {string} User name in case of success. Returns null if failed.
   */
  getDisplayName(regId) {
    if (this._localUser.regId === regId) {
      return this._localUser.displayName;
    }
    let ret = null;
    const userId = this._userIdentities.get(regId);
    if (userId) {
      const userInfo = this._contactMap.get(userId);
      if (userInfo) {
        ret = userInfo.displayName || null;
      }
    }
    return ret;
  }

  /**
   * Gets information about the local user.
   * @returns {UserInfo} In case of success returns user information.
   */
  getLocalUser() {
    return this._localUser;
  }

  /**
   * Adds new user to the google contacts. Does not allow to add existing
   * Google profile contacts multiple times. Allows to add non Google profile
   * contacts with the same email multiple times.
   * @param {string} emailAddress User's email address.
   * @param {string} [name] User's name.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  addUser(emailAddress, name) {
    if (!emailAddress) {
      return Promise.reject(new Error('Email address is not specified'));
    }
    const emailAddresses = [ { value: emailAddress, displayName: name } ];
    const names = [ { givenName: name || '' } ];
    return gapi.client.people.people.createContact({
      emailAddresses: emailAddresses,
      names: names
    })
    .then(response => {
      const person = response.result;
      const userId = this._getUserId(person);
      // Check if contact is already in the contactsMap.
      if (this._contactMap.has(userId)) {
        throw new Error(`User ${emailAddress} is already in the ` +
          'contact list.');
      }
      // Add person to the contactsMap and notify clients.
      const userInfo = this._createUserInfo(undefined, person);
      this._storeUserInfo(userInfo);
      this._eventListeners.user_added.forEach(eventHandler => {
        this._safeHandlerCall(eventHandler, userInfo);
      });

      if (this._isGoogleContact(person)) {
        // Contact is a google user. Resolve contact identity, and notify
        // clients.
        return this._getIdentitiesByAppIds([ userId ])
        .then(identities => {
          if (identities.length > 0) {
            const identity = identities[0];
            userInfo.regId = identity.regId;
            this._storeUserInfo(userInfo);
            this._eventListeners.user_changed.forEach(eventHandler => {
              this._safeHandlerCall(eventHandler, userInfo);
            });
          }
        });
      }
      return undefined;
    });
  }

  /**
   * Deletes user from the google contacts.
   * GOTCHA: If there are multiple contacts with the same userId, user with
   * the same userId will appear after syncUsers() is called.
   * @param {string} userId User's Google ID.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  deleteUser(userId) {
    const userInfo = this._contactMap.get(userId);
    if (!userInfo) {
      const errMessage = `Failed to delete user with user id: ${userId}. ` +
        `User is not in _contactMap`;
      this._warn(errMessage);
      return Promise.reject(errMessage);
    }
    return gapi.client.people.people.deleteContact({
      'resourceName': userInfo.resourceName
    })
    .then(() => {
      if (this._contactMap.has(userId)) {
        this._contactMap.delete(userId);
        // Notify clients that user was deleted.
        this._eventListeners.user_removed.forEach(eventHandler => {
          this._safeHandlerCall(eventHandler, userInfo);
        });
      }
    });
  }

  /**
   * Updates all contacts. Notifies application if new contacts we added, or
   * existing contacts were changed or deleted.
   * Application will receive: 'user_added' if new contacts were added.
   * 'user_changed' if existing contact got changed. 'user_delete' if contact
   * was deleted.
   * This does not support multiple contacts with same userId. Only unique
   * userIds are supported.
   * @returns {Promise} Returns resolved promise in case of success. Returns
   * rejected promise otherwise.
   */
  syncUsers() {
    return this._getContacts()
    .then(contacts => {
      const unresolvedContacts = [];
      // Find deleted contacts, remove them and notify clients.
      const newUserIds = contacts.map(contact => this._getUserId(contact));
      this._contactMap.forEach((userInfo, userId) => {
        if (!newUserIds.includes(userId)) {
          // User was removed from contacts.
          this._contactMap.delete(userId);
          this._eventListeners.user_removed.forEach(eventHandler => {
            this._safeHandlerCall(eventHandler, userInfo);
          });
        }
      });
      // Check if contacts were added or changed.
      for (const contact of contacts.values()) {
        const userId = this._getUserId(contact);
        const oldUserInfo = this._contactMap.get(userId);
        if (oldUserInfo) {
          // At this point the contact's identity is not resolved, we do not
          // know the regId of the current contact. However, since current
          // contact's identity was resolved before, we can use regId of the
          // contact (if any) previously stored in _contactMap. This is based on
          // the predicate: the regId does not change for the single user ID.
          const newUserInfo = this._createUserInfo(oldUserInfo.regId, contact);
          // Check if new user information is different from the stored one.
          if (!this._isEqualUserInfo(oldUserInfo, newUserInfo)) {
            // User information has changed for the current user. Store new user
            // information and notify clients.
            this._storeUserInfo(newUserInfo);
            this._eventListeners.user_changed.forEach(eventHandler => {
              this._safeHandlerCall(eventHandler, newUserInfo);
            });
          }
          // Add this contact to the list of unresolved contacts.
          if (!oldUserInfo.regId) {
            unresolvedContacts.push(contact);
          }
        }
        else {
          // Contact's user information is not in _contactMap. Add new user
          // information and notify clients.
          const newUserInfo = this._createUserInfo(undefined, contact);
          this._storeUserInfo(newUserInfo);
          this._eventListeners.user_added.forEach(eventHandler => {
            this._safeHandlerCall(eventHandler, newUserInfo);
          });
          unresolvedContacts.push(contact);
        }
      }
      // Resolve known identities and notify clients about changed contacts.
      if (unresolvedContacts.length > 0) {
        return this._getIdentities(unresolvedContacts)
        .then(identities => {
          for (const identity of identities.values()) {
            const userInfo =
              this._createUserInfo(identity.regId, identity.person);
            this._storeUserInfo(userInfo);
            this._eventListeners.user_changed.forEach(eventHandler => {
              this._safeHandlerCall(eventHandler, userInfo);
            });
          }
        });
      }
      return undefined;
    });
  }

  //#endregion public methods
}

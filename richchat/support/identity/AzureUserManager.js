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

// Url to get data for all users.
const MS_GRAPH_API_USERS_URL = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName';

const MS_GRAPH_API_USER_AVATAR_URL_PREFIX = 'https://graph.microsoft.com/beta/users/';

const MS_GRAPH_API_USER_AVATAR_URL_POSTFIX = '/Photo/$value';

// Time interval for user manager to retry to download avatar.
const AVATAR_RETRY_DOWNLOAD_INTERVAL = 1000 * 60 * 5; // 5 minutes

// Number of identities to be resolve per each request.
const MAX_IDENTITIES_PER_REQUEST = 50;

/**
 * Contains functions for storing and retrieving users from a Azure database.
 *
 * @memberof Support
 * @class AzureUserManager
 */
(function(AzureUserManager) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = AzureUserManager();
    }
    exports.AzureUserManager = AzureUserManager();
  }
  else {
    global.AzureUserManager = AzureUserManager();
  }

}).call(this, function() {

  // To be thrown when user failed to register in database
  function RegistrationFailedError(message) {
    this.name = 'RegistrationFailedError';
    this.message = message || '';
  }
  RegistrationFailedError.prototype = Error.prototype;

  // To be thrown if AzureUserManager has invalid parameter
  function InvalidArgumentError(message) {
    this.name = 'InvalidArgumentError';
    this.message = message || '';
  }
  InvalidArgumentError.prototype = Error.prototype;

  const log = text => console.log(`AzureUserManager - ${text}`);

  /**
   * Tracks user contact list changes and triggers following events:
   *  - user_added: when a new user is added
   *  - user_changed: when existing user is changed
   * Provides functions to get user user information:
   *  - getUserAvatar: gets user avatar image URL
   *  - getUserName: gets user name
   *  - getUser: gets user information (regId, name, avatar)
   * @param {object} userRegId
   *   RegId of the user.
   * @param {object} authManager
   *   An authentication manager, which will be used to retrieve authentication
   *   tokens and the local user information.
   * @param {function} getIdentitiesFromAppUserIds
   *   Gets the identity information for the given appUserIds
   *   {@link BBMEnterprise.getIdentitiesFromAppUserIds}
   * @throws {RegistrationFailedError}
   *  Thrown when user failed to register
   * @throws {InvalidArgumentError}
   *  Thrown when userInfo parameter is invalid
   */ 
  var AzureUserManager = function(userRegId, authManager,
                                  getIdentitiesFromAppUserIds) {
    if (typeof userRegId !== 'string') {
      throw new InvalidArgumentError('userRegId must be a string, it is: '
        + typeof userRegId);
    }
    if (typeof getIdentitiesFromAppUserIds !== 'function') {
      throw new InvalidArgumentError(
        'getIdentitiesFromAppUserIds must be a function.');
    }
    if (typeof authManager.getUserManagerToken !== 'function') {
      throw new InvalidArgumentError(
        'authManager does not have getUserManagerToken method defined');
    }

    const getTokenFunction = authManager.getUserManagerToken;
    const m_localUserInfo = authManager.getLocalUserInfo();
    m_localUserInfo.regId = userRegId;
    const m_userMap = new Map();
    const m_eventListeners = {
      user_added : [],
      user_changed : []
    };

    // Get all users in the AD and call event listeners with any users of the
    // app.
    const downloadAllUsersInfo = () => httpReq(MS_GRAPH_API_USERS_URL)
    .then(users => {
      const userMapById = new Map();
      const userIds = users.value.map(user => {
        userMapById.set(user.id, user);
        return user.id;
      });
      const promises = [];
      while (userIds.length > 0) {
        promises.push(getIdentitiesFromAppUserIds(userIds.splice(0,
          MAX_IDENTITIES_PER_REQUEST)));
      }

      return Promise.all(promises).then(results => {
        // Promises are resolved. Combine all results into single collection of
        // identities.
        Object.keys(results).forEach(key => {
          const identities = results[key];
          for (let i = 0; i < identities.length; ++i) {
            try {
              if (identities[i].regId) {
                const regId = identities[i].regId;
                const user = userMapById.get(identities[i].appUserId);
                const genericUserInfo = new GenericUserInfo(
                  user.id, regId, user.displayName
                );
                // Store generated user info into user info cache.
                if (!m_userMap.has(regId)) {
                  m_userMap.set(regId, genericUserInfo);
                  m_eventListeners.user_added.forEach(eventHandler => {
                    safeHandlerCall(eventHandler, genericUserInfo);
                  });
                }
                else {
                  // User information is already in m_userMap, ignore it.
                  log(`User ${regId} is already present.`);
                }
              }
              else {
                log(`Can not resolve BBM registration ID for the user` +
                ` ${users.value[i].displayName} (id: ${users.value[i].id})`);
              }
            }
            catch (error) {
              log(`Failed to get user info at index ${i}. Error ${error}`);
            }
          }
        });
        return;
      });
    });

    /**
     * This private utility function serves to invoke client defined event
     * handler wrapped with try / catch.
     * @param {function} eventHandler Event handler defined by the customer.
     * @param {object} userInfo Event data to be passed to eventHandler.
     */
    const safeHandlerCall = (eventHandler, userInfo) => {
      try {
        eventHandler(userInfo);
      }
      catch (error) {
        console.warn(`Error while executing event listener: ${error.stack}`);
      }
    };

    // Make HTTP request to Azure server. This will automatically set the
    // Authorization header for Azure authentication.
    const httpReq = (url, beforeSend, method, postBody) =>
      // First get the access token, this should be cached, but if it is expired
      // then it will get a new one.
      getTokenFunction().then(accessToken => {
        const httpRequest = new XMLHttpRequest();
        return new Promise((resolve, reject) => {
          httpRequest.onreadystatechange = () => {
            if (httpRequest.readyState === 4) {
              if (httpRequest.status >= 200 && httpRequest.status < 300
                && typeof httpRequest.response === 'object') {
                resolve(httpRequest.response);
              }
              else {
                log(`XMLHttpRequest Response.`
                  + ` Status: ${httpRequest.status}`
                  + ` | Response Type: ${typeof httpRequest.response}`
                  + ` | Status Text: ${httpRequest.statusText}`
                  + ` | Url: ${url}`);
                if (typeof httpRequest.response === 'object') {
                  // Azure will normally have detailed error information in
                  // response object
                  log('XMLHttpRequest Response: '
                    + JSON.stringify(httpRequest.response));
                }
                reject(httpRequest.statusText);
              }
            }
          };
          httpRequest.responseType = 'json';
          httpRequest.open(method || 'GET', url, true);
          httpRequest.setRequestHeader('Authorization', `Bearer ${accessToken}`);
          if (beforeSend) {
            // Allow caller to add/change headers or other values on request.
            beforeSend(httpRequest);
          }
          httpRequest.send(postBody);
        });
      });

    /**
     * Adds event listener.
     * @param {string} event Event to subscribe to. AzureUserManager fires
     * following events:
     *  - user_added: triggered when a new user is added
     *  - user_changed: triggered when existing user is changed
     * @param {function} eventListener
     *  Event handler function. When invoked, it contains userInfo object as
     *  parameter. UserInfo object contains following properties:
     *  - userRegId: The regId of the user
     *  - userName: Name of the user
     *  - avatarUrl: user avatar image URL
     * @throws {InvalidArgumentError} Thrown if the eventListener is not a
     * function.
     */
    this.addEventListener = function(event, eventListener) {
      if (typeof eventListener !== 'function') {
        throw new InvalidArgumentError('Event handler must be a function');
      }
      const eventListeners = m_eventListeners[event];
      if (eventListeners) {
        // Do not add event listener if it was already added previously.
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
     * @param {string} event Event to unsubscribe from. AzureUserManager fires
     * following events:
     *  - user_added: triggered when a new user is added
     *  - user_changed: triggered when existing user is changed
     * @param {function} eventListener Previously added event handler function.
     * @throws {InvalidArgumentError} Thrown if the eventListener is not a
     * function.
     */
    this.removeEventListener = function(event, eventListener) {
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
     * Get the user avatar image URL by regId if it is already cached or null
     * otherwise.
     * If there is no avatar cached, this function will initiate avatar
     * downloading. After downloading is finished, user information will be
     * updated with the new avatar URL.
     * @param {string} regId The regId of the user.
     * @returns {string} In case of success returns image URL of the cached user
     * avatar image. Returns null if failed.
     */
    this.getUserAvatar = function(regId) {
      const userInfo = m_userMap.get(regId);
      if (userInfo !== undefined) {
        if (userInfo.avatarUrl !== undefined) {
          return userInfo.avatarUrl;
        }
        // There is no avatar URL available for the user. Check if we can start
        // downloading an avatar image.
        const now = new Date().getTime();
        if (!userInfo.retryAvatarDownloadTime
          || now >= userInfo.retryAvatarDownloadTime) {
            // Store the time when user manager would able to retry avatar image
            // download.
            userInfo.retryAvatarDownloadTime = now
              + AVATAR_RETRY_DOWNLOAD_INTERVAL;
          // Start downloading an avatar image asynchronously.
          downloadAvatar(userInfo);
        }
      }
      // Return null synchronously. Once avatar is downloaded, the
      // 'user_changed' event handlers will be invoked to update avatar URL.
      return null;
    };

    /**
     * Load the user avatar image by regId if it is not already cached.
     * @private
     * @param {object} userInfo The user info.
     * @throws {Error} When fails to download user avatar.
     */
    const downloadAvatar = userInfo => {
      const avatarUrl = MS_GRAPH_API_USER_AVATAR_URL_PREFIX
        + userInfo.userId + MS_GRAPH_API_USER_AVATAR_URL_POSTFIX;
      return httpReq(avatarUrl, httpRequest => httpRequest.responseType = 'blob')
      .then(data => {
        if (data instanceof Blob) {
          // Return URL to the downloaded blob.
          const url = URL.createObjectURL(data);
          userInfo.avatarUrl = url;
          m_userMap.set(userInfo.regId, userInfo);
          // Avatar URL is downloaded. Invoke 'user_changed' event handlers.
          m_eventListeners.user_changed.forEach(eventHandler => {
            safeHandlerCall(eventHandler, userInfo);
          });
        } else {
          throw new Error(`Failed to download avatar for the user: ${userInfo.regId}`);
        }
      })
      .catch(error => {
        const errorString = (typeof error !== 'string')
          ? JSON.stringify(error)
          : error;
        log(`Failed to download avatar for the user: ${userInfo.regId}. `
          + `Error: ${errorString}`);
        m_userMap.set(userInfo.regId, userInfo);
      });
    };

    /**
     * Gets the user name by regId.
     * @param {string} regId The regId of the user.
     * @returns {string} User name in case of success. Returns null if failed.
     */
    this.getDisplayName = regId => {
      const userInfo = m_userMap.get(regId);
      // If the user is in the user map, return their name.
      if (userInfo !== undefined) {
        return userInfo.displayName || null;
      }
      return null;
    };

    /**
     * Gets user information by regId.
     * @param {string} regId The regId of the user.
     * @returns {GenericUserInfo} User info if found, undefined otherwise.
     */
    this.getUser = regId => m_userMap.get(regId);

    /**
     * Gets information about the local user.
     * @returns {GenericUserInfo} Local user information.
     */
    this.getLocalUser = () => {
      // Try to find local user information in m_userMap first because it
      // contains up-to-date user information.
      return this.getUser(m_localUserInfo.regId) || m_localUserInfo;
    };

    /**
     * Retrieves all contacts from Azure AD.
     * @returns {Promise} Promise resolves with no data in case of success.
     * Rejects with error if case of failure.
     */
    this.initialize = downloadAllUsersInfo;
  };

  AzureUserManager.prototype = Object.create(Object.prototype);

  AzureUserManager.prototype.constructor = AzureUserManager;

  return AzureUserManager;
});

//****************************************************************************

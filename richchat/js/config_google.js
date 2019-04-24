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

// This configuration will configure the RichChat example application to run
// against a domain configured to use Google for authentication and user
// management.
//
// Refer to the Developer Guide for more details on how to setup your
// application to use Google:
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/googleSignInIdentityManagement.html
//
// This configuration uses the BlackBerry Key Management Service (KMS), which
// BlackBerry recommends for most applications. See
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/security.html

// The ID of the domain assigned to this application.  Refer to the Developer
// Guide for more information on setting up your domain:
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/gettingStarted.html#domain
const DOMAIN_ID = 'your_domain_id';

// The client ID of the Google OAuth 2.0 service.
const CLIENT_ID = 'your_google_oauth_client_id';

// The key storage solution your application will be using.  Valid options
// are:
//   * KMS : BlackBerry Key Management Service
//   * CKS : Cloud Key Storage
//
// See: https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/security.html
const KEY_STORAGE = 'KMS';

// This is needed only when KEY_STORAGE is 'CKS'.  This field must be
// configured with the Firebase configuration, which can be obtained from the
// Firebase console.
let FIREBASE_CONFIG;
if (KEY_STORAGE === 'CKS') {
  FIREBASE_CONFIG = {
    apiKey: 'your_firebase_api_key',
    authDomain: 'your_firebase_auth_domain',
    databaseURL: 'your_firebase_database_url',
    projectId: 'your_firebase_project_identifier',
    storageBucket: 'your_firebase_storage_bucked',
    messagingSenderId: 'your_firebase_messaging_sender_identifier'
  };
}

// ===========================================================================
// The default values provided below configure RichChat to work as described
// in the Developer Guide.

// The environment in which your domain was created.  This must be either
// 'Sandbox' or 'Production'.
const ENVIRONMENT = 'Sandbox';

// The OAuth 2.0 configuration for authenticating users and managing contacts.
const AUTH_CONFIGURATION = {
  // The Google OAuth 2.0 service endpoint.
  authService : 'https://accounts.google.com/o/oauth2/v2/auth',

  // Scopes of OAuth 2.0 access token (which resources it can access)
  scope : 'https://www.googleapis.com/auth/contacts',

   // The client ID of the Google OAuth 2.0 service.
  clientId: CLIENT_ID
};

// The URL or relative path of the Argon2 WASM file.
const KMS_ARGON_WASM_URL = '../../sdk/argon2.wasm';

// The function RichChat will use to create its user manager.  This
// configuration uses the GooglePeopleUserManager.
const createUserManager = (userRegId, authManager, getIdentities) =>
  Promise.resolve(
    new GooglePeopleUserManager(userRegId, authManager, getIdentities,
                                AUTH_CONFIGURATION)
  );

// This is only needed when KEY_STORAGE is 'CKS'.  The function RichChat will
// use to create the key provider.  This configuration uses the
// FirebaseKeyProvider.
let createKeyProvider;
if (KEY_STORAGE === 'CKS') {
  createKeyProvider = (
    uid, accessToken, authManager, importFailedCallback, keyProtect,
    getIdentitiesFromRegId
  ) => FirebaseKeyProvider.factory.createInstance(
    uid,
    FIREBASE_CONFIG,
    accessToken,
    importFailedCallback,
    keyProtect,
    getIdentitiesFromRegId
  );
}

// This is only needed when KEY_STORAGE is 'CKS'.  The function RichChat will
// use to create the key protection object.
let createKeyProtect;
if (KEY_STORAGE === 'CKS') {
  createKeyProtect = (regId, getSecretCallback) =>
    KeyProtect.factory.createInstance(
      getSecretCallback, regId, 'BBME SDK Pre-KMS DRK', DOMAIN_ID
    );
}

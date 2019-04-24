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
// against a domain configured to use Microsoft Azure for authentication and
// user management.
//
// Refer to the Developer Guide for more details on how to setup your
// application to use Microsoft Azure:
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/azureIdentityManagement.html
//
// This configuration uses the BlackBerry Key Management Service (KMS), which
// BlackBerry recommends for most applications. See
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/security.html

// The ID of the domain assigned to this application.  Refer to the Developer
// Guide for more information on setting up your domain:
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/gettingStarted.html
const DOMAIN_ID = 'your_domain_id';

// The client ID of the Microsoft Azure OAuth 2.0 service.
const CLIENT_ID = 'your_client_id';

// The tenant ID of your organization.
const TENANT_ID = 'your_tenant_id';

// The key storage solution your application will be using.  Valid options
// are:
//   * KMS : BlackBerry Key Management Service
//   * CKS : Cloud Key Storage
//
// See: https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/security.html
const KEY_STORAGE = 'KMS';

// This is needed only when KEY_STORAGE is 'CKS'.  This field must be
// configured with the URL, including the trailing slash,  of the
// KeyProviderServer API to be used for Cloud Key Storage.
let KEY_PROVIDER_SERVER_URL;
if (KEY_STORAGE === 'CKS') {
  KEY_PROVIDER_SERVER_URL = 'your_key_provider_server_url/';
}

// ===========================================================================
// The default values provided below configure RichChat to work as described
// in the Developer Guide.

// The environment in which your domain was created.  This must be either
// 'Sandbox' or 'Production'.
const ENVIRONMENT = 'Sandbox';

// The OAuth 2.0 configuration for authenticating users and managing contacts.
const AUTH_CONFIGURATION = {
  // The Microsoft Azure OAuth 2.0 service endpoint.
  authService: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,

  // Scopes of OAuth 2.0 access token (which resources it can access)
  scope: [
    // The messaging scope for your tenant.
    `api://${CLIENT_ID}/Messaging.All`,

    // The Microsoft Graph scopes for user management.
    'https://graph.microsoft.com/User.ReadWrite',
    'https://graph.microsoft.com/User.ReadBasic.All'
  ].join(' '),

  // The client ID of the Microsoft Azure OAuth 2.0 service.
  clientId: CLIENT_ID
};

// The URL or relative path of the Argon2 WASM file.
const KMS_ARGON_WASM_URL = '../../sdk/argon2.wasm';

// The function RichChat will use to create its user manager.  This
// configuration uses the AzureUserManager.
const createUserManager = (userRegId, authManager, getIdentities) =>
  Promise.resolve(
    new AzureUserManager(userRegId, authManager, getIdentities)
  );

// This is only needed when KEY_STORAGE is 'CKS'.  The function RichChat will
// use to create the key provider.  This configuration uses the
// CosmosDbKeyProvider.
let createKeyProvider;
if (KEY_STORAGE === 'CKS') {
  createKeyProvider = (
    uid, accessToken, authManager, importFailedCallback, keyProtect,
    getIdentitiesFromRegId
  ) => CosmosDbKeyProvider.factory.createInstance(
    uid,
    KEY_PROVIDER_SERVER_URL,
    accessToken,
    () => authManager.getKeyProviderToken(),
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


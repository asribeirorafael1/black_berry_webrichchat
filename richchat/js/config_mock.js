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

// This configuration will setup the RichChat example application to run in
// the sandbox environment against a domain with disabled user authentication.
//
// This configuration uses the BlackBerry Key Management Service (KMS), which
// BlackBerry recommends for most applications. See
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/security.html

// The ID of the domain assigned to this application.  Refer to the Developer
// Guide for more information on setting up your domain:
// https://developer.blackberry.com/files/bbm-enterprise/documents/guide/html/gettingStarted.html#domain
const DOMAIN_ID = 'fbff12c8-d02b-45b3-9d81-b243f6778f0d';

// ===========================================================================
// The default values provided below configure RichChat to work as described
// in the Developer Guide.

// This configuration will only work with KMS.
const KEY_STORAGE = 'KMS';

// This configuration will only work in the sandbox environment.
const ENVIRONMENT = 'Sandbox';

// Authentication is disabled for this configuration.
const AUTH_CONFIGURATION = {};

// The URL or relative path of the Argon2 WASM file.
const KMS_ARGON_WASM_URL = '../../sdk/argon2.wasm';

// The function RichChat will use to create its user manager.  This
// configuration uses the MockUserManager.
const createUserManager = (userRegId, authManager, getIdentities) =>
  Promise.resolve(
    new MockUserManager(userRegId, authManager, getIdentities, DOMAIN_ID)
  );

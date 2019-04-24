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
 * @memberof Support
 * @class KeyProtect
 */

/**
 * @typedef {Object} KeyPair
 * Contains key pair for encrypting and signing data.
 * @property {Unit8Array} encryptionKey 32 bytes encryption key.
 * @property {Unit8Array} signingKey 32 bytes signing key.
 */

/**
 * @typedef {Object} ProtectedKey
 * Contains ciphertext, initialization vector used to generate ciphertext,
 * and signature of the ciphertext.
 * @property {Unit8Array} payload Ciphertext (encrypted data).
 * @property {Unit8Array} nonce The per-encryption 16-byte nonce.
 * @property {Unit8Array} mac The HMAC-SHA256 signature of the encrypted
 * payload.
 */

/**
 * @typedef {Object} ManagementKeyPair
 * Contains protected management key and management HMAC key as returned by
 * getManagementKey().
 * @property {ProtectedKey} encrypt Protected management key.
 * @property {ProtectedKey} sign Protected management HMAC key.
 */

/**
 * @class
 * @description This class manages the protection of the BBM Enterprise SDK
 * keys that are exported and imported to and from cloud storage.
 *
 * This class works in both runtime environments: web browser and Node.js. When
 * running in a browser environment this class utilizes WebCrypto as
 * cryptographic engine.
 *
 * When running in a Node.js environment, this class uses the CryptoNode.js
 * module. It uses Node.js 'crypto' cryptographic engine. CryptoNode.js mimics
 * the behavior of WebCrypto by partially implementing the same interface.
 *
 * @param {function} secretCallback A function invoked by setManagementKeys()
 * or getManagementKeys() to obtain the Promise of user secret as String or
 * password that is used to protect the Management Keys. Receives boolean as
 * parameter. Invoked with true when user is expected to enter new password for
 * newly generated keys. Invoked with false when user user is expected to enter
 * password for existing keys.
 * @param {String} regId RegId of the client.
 * @param {String} diversifier String to be used to derive root key.
 * @param {String} domain BBM domain local user belongs to.
 * @throws {Error} InvalidParamError in if parameters are invalid.
 */
function KeyProtect(secretCallback, regId, diversifier, domain) {

  if (typeof secretCallback !== 'function') {
    const error = new Error('secretCallback must be a function');
    error.name = 'InvalidParamError';
    throw error;
  }

  if (typeof regId !== 'string') {
    const error = new Error('regId must be a String');
    error.name = 'InvalidParamError';
    throw error;
  }

  if (typeof diversifier !== 'string') {
    const error = new Error('diversifier must be a String');
    error.name = 'InvalidParamError';
    throw error;
  }

  if (typeof domain !== 'string') {
    var error = new Error('domain must be a String');
    error.name = 'InvalidParamError';
    throw error;
  }

  const NONCE_LENGTH = 16;
  const MANAGEMENT_KEY_LENGTH = 32;
  const MANAGEMENT_KEY_HMAC_LENGTH = 32;

  this._regId = BBMEnterprise.Utf8.encode(regId);
  this._secretCallback = secretCallback;
  this._diversifier = BBMEnterprise.Utf8.encode(diversifier);
  this._domain = BBMEnterprise.Utf8.encode(domain);

  // Function defines which crypto module to use. Uses CryptoNode.js when
  // operates in the Node.js environment. Uses WebCrypto when operates in the
  // browser environment.
  var getCrypto = () => {
    if (typeof window !== 'undefined' && window.crypto !== undefined) {
      // Running in a browser environment.
      // Use WebCrypto to perform cryptographic operations.
      return window.crypto;
    } else if (typeof self !== 'undefined' && self.crypto !== undefined) {
      // Running in a web worker in a browser environment.
      // Use WebCrypto to perform cryptographic operations.
      return self.crypto;
    } else {
      // Running in the Node.js environment.
      // Use CryptoNode.js module to perform cryptographic operations.
      const CryptoNode = require('./CryptoNode.js');
      return new CryptoNode();
    }
  };

  const crypto = getCrypto();
  const subtle = crypto.subtle;

  // In browser environment the KeyProviderError.js must be included in the html
  // file the same as this file but in node we need to use require.
  const keyProviderError =
    (typeof KeyProviderError === "undefined" && typeof require === 'function') ?
      require('../KeyProviderError.js')
      : KeyProviderError;

  /**
   * Encrypts the provided plain text with the AES-256-CTR.
   * @private
   * @param {Unit8Array} plaintext Plain text to encrypt.
   * @param {Unit8Array} nonce Nonce to encrypt with.
   * @param {Object} cryptoKey Encryption crypto key.
   * @returns {Promise<Unit8Array>} Promise of the ciphertext.
   */
  this._encrypt = function(plaintext, nonce, cryptoKey) {
    if (!(plaintext instanceof Uint8Array)) {
      const error = new Error('Invalid plaintext type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (!(nonce instanceof Uint8Array)) {
      const error = new Error('Invalid nonce type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (!cryptoKey) {
      const error = new Error('Invalid cryptoKey type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    return subtle.encrypt({
      name: 'AES-CTR',
      counter: nonce,
      length: 128
    }, cryptoKey, plaintext)
      .then(cipherText => new Uint8Array(cipherText));
  };

  /**
   * Decrypts the provided cipher text with the AES-256-CTR algorithm.
   * @private
   * @param {Unit8Array} ciphertext Encrypted text to decrypt.
   * @param {Unit8Array} nonce Nonce to decrypt with.
   * @param {Object} cryptoKey Decryption crypto key.
   * @returns {Promise<Unit8Array>} Promise of the plaintext.
   */
  this._decrypt = function(ciphertext, nonce, cryptoKey) {
    if (nonce.length !== NONCE_LENGTH) {
      const error = new Error('Invalid nonce size');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (!(nonce instanceof Uint8Array)) {
      const error = new Error('Invalid nonce type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (!cryptoKey) {
      const error = new Error('Invalid cryptoKey type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    return subtle.decrypt({
      name: 'AES-CTR',
      counter: nonce,
      length: 128
    }, cryptoKey, ciphertext)
      .then(plaintext => new Uint8Array(plaintext));
  };

  /**
   * Generates signature using HMAC-SHA-256 algorithm.
   * @private
   * @param {Unit8Array} payload Byte array to sign.
   * @param {Object} signingCryptoKey Signing crypto key.
   * @returns {Promise<Unit8Array>} Promise of the signature corresponding to
   * the payload and signing CryptoKey passed as parameters.
   */
  this._sign = function(payload, signingCryptoKey) {
    return subtle.sign({ name : 'HMAC' }, signingCryptoKey, payload)
           .then(hmac => new Uint8Array(hmac));
  };

  /**
   * Validates signature using HMAC-SHA-256 algorithm.
   * @private
   * @param {Uint8Array} payload Byte array used to generate signature.
   * @param {Uint8Array} signature Signature of the payload.
   * @param {Object} signingCryptoKey Signing crypto key.
   * @returns {Promise<Boolean>} Promise of the result of verification. Resolves
   * with true if signature is valid. Resolves with false otherwise.
   */
  this._verify = function(payload, signature, signingCryptoKey) {
    return subtle.verify({ name: 'HMAC' }, signingCryptoKey, signature,
                         payload);
  };

  /**
   * Generates Unit8Array of specified size with cryptographically strong random
   * values.
   * @private
   * @param {Number} size Size of a random key to be generated.
   * @returns {Uint8Array} Returns Uint8Array of provided size filled with
   * random values.
   */
  this._generateRandomBytes = function(size) {
    var array = new Uint8Array(size);
    crypto.getRandomValues(array);
    return array;
  };

  /**
   * Generates SHA512 hash of the text given as parameter.
   * @private
   * @param {Unit8Array} data Plain text to generate hash from.
   * @returns {Promise<Unit8Array>} Returns promise of 64 bytes Uint8Array.
   */
  this._digest = function(data) {
    return subtle.digest({ name: 'SHA-512' }, data);
  };

  /**
   * Generates pair of crypto keys.
   * @private
   * @param {Uint8Array} encryptionKey Plain text encryption key.
   * @param {Uint8Array} signingKey Plain text signing key.
   * @returns {Promise<Object>} Promise of object which holds crypto
   * encryptionKey and crypto signingKey which can be used for encoding and
   * signing.
   */
  this._importKeys = function(encryptionKey, signingKey) {
    if (!(encryptionKey instanceof Uint8Array)) {
      const error = new Error('Invalid encryptionKey type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (!(signingKey instanceof Uint8Array)) {
      const error = new Error('Invalid signingKey type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (encryptionKey.length !== MANAGEMENT_KEY_LENGTH) {
      const error = new Error('Invalid encryptionKey size');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    if (signingKey.length !== MANAGEMENT_KEY_HMAC_LENGTH) {
      const error = new Error('Invalid signingKey size');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    return Promise.all([
      subtle.importKey('raw', encryptionKey,
        { name: 'AES-CTR' }, true, ['encrypt', 'decrypt']),
      subtle.importKey('raw', signingKey,
        { name: 'HMAC', hash: { name: 'SHA-256' } }, true, ['sign', 'verify'])
    ]).then(keys => {
      return {
        encryptionKey: keys[0],
        signingKey: keys[1]
      };
    });
  };

  /**
   * Calls WebCrypto exportKey(). Returns Promise of a key in raw format.
   * @private
   * @param {Object} cryptoKey CryptoKey to export.
   * @returns {Promise<Uint8Array>} Plaintext key.
   */
  this._exportKey = function(cryptoKey) {
    return subtle.exportKey('raw', cryptoKey)
    .then(unprotectedKey => new Uint8Array(unprotectedKey));
  };

  /**
   * Derives the Derived Root Key and Derived HMAC Key from a private secret.
   * @param {String} secret Secret to derive key from.
   * @returns {Promise<KeyPair>} Key pair of management keys.
   */
  this._deriveKey = function(secret) {
    if (typeof secret !== 'string') {
      const error = new Error('Invalid secret type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }
    const uf8Secret = BBMEnterprise.Utf8.encode(secret);
    const dataLength = this._regId.length
                     + this._domain.length
                     + uf8Secret.length
                     + 4
                     + this._diversifier.length;
    var data = new Uint8Array(dataLength);
    var offset = 0;
    data.set(this._regId, offset); offset += this._regId.length;
    data.set(this._domain, offset); offset += this._domain.length;
    data.set(uf8Secret, offset); offset += uf8Secret.length;
    data.set([0x00, 0x00, 0x00, 0x01], offset); offset += 4;
    data.set(this._diversifier, offset);
    return this._digest(data).then(hash => {
      return {
        encryptionKey: new Uint8Array(hash.slice(0, 32)),
        signingKey: new Uint8Array(hash.slice(32, 64))
      };
    });
  };

  /**
   * Protects (encrypts and signs) unprotected key with encryptionCryptoKey and
   * signingCryptoKey. Returns the promise of ProtectedKey.
   * @private
   * @param {Uint8Array} unprotectedKey Unprotected key to protect.
   * @param {Object} encryptionCryptoKey Encryption key.
   * @param {Object} signingCryptoKey Signing key.
   * @returns {Promise<ProtectedKey>} Promise of protected key.
   */
  this._protect = function(unprotectedKey, encryptionCryptoKey,
                           signingCryptoKey) {
    if (!(unprotectedKey instanceof Uint8Array)) {
      var error = new Error('Invalid plaintext parameter type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    let protectedKey = {};
    let nonce = this._generateRandomBytes(16);
    protectedKey.nonce = BBMEnterprise.Util.array2b(nonce);
    return this._encrypt(unprotectedKey, nonce, encryptionCryptoKey)
    .then(ciphertext => {
      protectedKey.payload = BBMEnterprise.Util.array2b(ciphertext);
      return this._sign(ciphertext, signingCryptoKey).then(hmac => {
        protectedKey.mac = BBMEnterprise.Util.array2b(hmac);
        return protectedKey;
      });
    });
  };

  /**
   * Unprotects (verifies signature and decrypts) protected key. Returns
   * Promise of unprotected key (Uint8Array).
   * @private
   * @param {ProtectedKey} protectedKey Protected key to unprotect.
   * @param {Object} decryptionCryptoKey Decryption key.
   * @param {Object} signingCryptoKey Signing key.
   * @returns {Promise<Uint8Array>} Promise of unprotected key.
   */
  this._unprotect = function(protectedKey, decryptionCryptoKey,
                             signingCryptoKey) {
    if ( typeof protectedKey !== 'object'
      || typeof protectedKey.payload === 'undefined'
      || typeof protectedKey.nonce === 'undefined'
      || typeof protectedKey.mac === 'undefined') {
      let error = new Error('Invalid encryptedKey parameter type');
      error.name = 'InvalidParamError';
      return Promise.reject(error);
    }

    const payload = BBMEnterprise.Util.b2array(protectedKey.payload);
    const mac = BBMEnterprise.Util.b2array(protectedKey.mac);
    const nonce = BBMEnterprise.Util.b2array(protectedKey.nonce);

    return this._verify(payload, mac, signingCryptoKey).then(result => {
      if (!result) {
        var error = new keyProviderError('Failed to validate key signature.',
          undefined,
          true); // Set the failedToUnprotect property.
        error.details = 'HmacError';
        throw error;
      }
      return this._decrypt(payload, nonce, decryptionCryptoKey);
    });
  };

}

/**
 * Protects key. Encrypts key using AES-256-CTR algorithm and signs it using
 * HMAC-SHA-256 algorithm.
 * @param {Uint8Array} unprotectedKey Key to be protected.
 * @returns {Promise<ProtectedKey>} Returns promise of the protected key.
 * Rejects if there is no management key or parameter is invalid.
 */
KeyProtect.prototype.protect = function(unprotectedKey) {
  if (typeof this._managementKey === 'undefined'
    || typeof this._managementHmacKey === 'undefined') {
    var error = new Error('Management keys are undefined');
    error.name = 'NoKeysError';
    return Promise.reject(error);
  }
  return this._protect(unprotectedKey, this._managementKey,
    this._managementHmacKey);
};

/**
 * Validates signature of the {@link ProtectedKey} with HMAC-SHA-256 algorithm
 * and decrypts it with AES-256-CTR algorithm.
 * @param {ProtectedKey} protectedKey Key to be validated and decrypted.
 * @returns {Promise<Uint8Array>} Returns promise of the unprotected key.
 */
KeyProtect.prototype.unprotect = function(protectedKey) {
  if (this._managementKey === undefined
    || this._managementHmacKey === undefined) {
    var error = new Error('Management keys are undefined');
    error.name = 'NoKeysError';
    return Promise.reject(error);
  }
  return this._unprotect(protectedKey, this._managementKey,
    this._managementHmacKey);
};

/**
 * Method invoked when new private keys are to be generated for the user.
 * Generates and stores a new pair of 256-bit Management Keys, overwriting
 * any existing ones.
 *
 * @returns {Promise} Resolves with no parameters in case of success.
 */
KeyProtect.prototype.generateManagementKeys = function() {
  const managementKey = this._generateRandomBytes(32);
  const managementHmacKey = this._generateRandomBytes(32);
  return this._importKeys(managementKey, managementHmacKey).then(cryptoKeys =>
  {
    this._managementKey = cryptoKeys.encryptionKey;
    this._managementHmacKey = cryptoKeys.signingKey;
  });
};

/**
 * Method invoked when existing protected management keys are retrieved from
 * key storage. Verifies, decrypts, and imports a pair of protected Management
 * Keys. The keys are expected to be in the format produced by
 * getManagementKeys().
 *
 * @param {ManagementKeyPair} keys Protected management keys.
 * @returns {Promise} Resolves with no parameters in case of success.
 */
KeyProtect.prototype.setManagementKeys = function(keys) {
  return this._secretCallback(false).then(secret =>
  {
    return this._deriveKey(secret).then(derivedKey =>
    {
      return this._importKeys(derivedKey.encryptionKey, derivedKey.signingKey)
      .then(derivedCryptoKeys =>
      {
        return Promise.all([
          this._unprotect(keys.encrypt,
                          derivedCryptoKeys.encryptionKey,
                          derivedCryptoKeys.signingKey),
          this._unprotect(keys.sign,
                          derivedCryptoKeys.encryptionKey,
                          derivedCryptoKeys.signingKey)
        ])
        .then(unprotectedKeys =>
        {
          return this._importKeys(unprotectedKeys[0], unprotectedKeys[1])
          .then(cryptoKeys =>
          {
            this._managementKey = cryptoKeys.encryptionKey;
            this._managementHmacKey = cryptoKeys.signingKey;
          });
        });
      });
    });
  });
};

/**
 * Method invoked when protected user's private keys are to be exported to key
 * storage. Encrypts, signs, and exports a pair of Management Keys. The returned
 * keys are in a format that can be passed to setManagementKeys().
 *
 * @returns {Promise<ManagementKeyPair>} Protected management keys. Rejects
 * if there are no management keys exist.
 */
KeyProtect.prototype.getManagementKeys = function() {
  if (this._managementKey === undefined
    || this._managementHmacKey === undefined) {
    var error = new Error('Management keys are undefined');
    error.name = 'NoKeysError';
    return Promise.reject(error);
  }

  return this._secretCallback(true)
  .then(secret =>
    this._deriveKey(secret).then(derivedKey =>
      this._importKeys(derivedKey.encryptionKey, derivedKey.signingKey)
      .then(derivedCryptoKeys => {
        var promises = [];

        promises.push(this._exportKey(this._managementKey)
        .then(managementKey => this._protect(managementKey,
          derivedCryptoKeys.encryptionKey, derivedCryptoKeys.signingKey)));

        promises.push(this._exportKey(this._managementHmacKey)
        .then(managementHmacKey => this._protect(managementHmacKey,
          derivedCryptoKeys.encryptionKey, derivedCryptoKeys.signingKey)));

        return Promise.all(promises).then(protectedKeys => {
          return {
            encrypt: protectedKeys[0],
            sign: protectedKeys[1]
          };
        });
      })));
};

/**
 * Factory class contains 'createInstance' method which returns a Promise of
 * new instance of KeyProtect.
 */
KeyProtect.factory = {
 /**
  * Creates new instance of KeyProtect
  * @param {function} secretCallback A function invoked by setManagementKeys()
  * or getManagementKeys() to obtain the Promise of user secret as String or
  * password that is used to protect the Management Keys. Receives boolean as
  * parameter. Invoked with true when user is expected to enter new password for
  * newly generated keys. Invoked with false when user user is expected to enter
  * password for existing keys.
  * @param {String} regId RegId of the client.
  * @param {String} diversifier String to be used to derive root key.
  * @param {String} domain BBM domain local user belongs to.
  * @returns {Promise<KeyProtect>} Resolved with new instance of KeyProtect in
  * case of success. Rejects in case invalid parameters.
  */
  createInstance: (secretCallback, regId, diversifier, domain) =>
    new Promise((resolve, reject) => {
      try {
        var keyProtect = new KeyProtect(secretCallback, regId, diversifier,
          domain);
        resolve (keyProtect);
      }
      catch(error) {
        console.warn('Failed to create instance of KeyProtect: '
          + error.message);
        reject(error);
      }
    })
};

if (typeof module !== 'undefined' && module.exports) {
  // Module exports KeyProtect when running under Node.js environment.
  module.exports = KeyProtect;
}
else if (typeof window === 'undefined') {
  // Define global KeyProtect when running under web browser environment.
  global.KeyProtect = KeyProtect;
}

//****************************************************************************

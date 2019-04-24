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
 * @class
 * @description This Node.js module partially mimics SubtleCrypto interface 
 * of WebCrypto. For more details see {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto SubtleCrypto}
 * 
 * This module is required by KeyProtect.js to run in Node.js environment.
 * 
 * The module exports class CryptoNode which utilizes Node.js
 *  'crypto'
 * cryptographic engine.
 */
module.exports = class CryptoNode {
  constructor() {
    const crypto = require('crypto');
    this.getRandomValues = typedArray => {
      let randomBytes = crypto.randomBytes(typedArray.byteLength);
      typedArray.set(randomBytes);
      return typedArray;
    };
    this.subtle = new Subtle(crypto);
  }
};

/**
 * Mimics SubtleCrypto CryptoKey interface.
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey CryptoKey}
 * The CryptoKey interface represents a cryptographic key derived from a
 * specific key algorithm.
 * @property {Object} algorithm Representing a particular cipher the key has to 
 * be used with.
 * @property {Boolean} extractable Indicates if the raw information may be
 * exported to the application or not.
 * @property {Array} usages An array of enumerated values indicating what the 
 * key can be used for.
 * @property {String} type Enumerated value representing the type of the key,
 * a secret key (for symmetric algorithm), a public or a private key.
 * @property {Uint8Array} data Unprotected cryptographic key.
 */
class CryptoKey {
  constructor(algorithm, extractable, usages, type, data) {
    this.algorithm = algorithm;
    this.extractable = extractable;
    this.usages = usages;
    this.type = type;
    this.data = data;
  }
}

/**
 * @class 
 * @description Partial implementation of SubtleCrypto
 */
class Subtle {
  constructor(crypto) {
    this.crypto = crypto;
  }
  
  /**
   * Mimics SubtleCrypto importKey method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey importKey}
   * The SubtleCrypto.importKey() method returns a Promise of the CryptoKey
   * generated from the data given in parameters.
   */
  importKey(format, keyData, algo, extractable, usages){
    return new Promise((resolve) => {
      if (format !== 'raw') {
        const error = new Error(`Unsupported format: ${format}`);
        error.name = 'TypeError';
        throw error;
      }

      switch(algo.name) {
        case 'AES-CTR':
          if (keyData.length != 32) {
            const error = new Error ('Expected key size is 32 bytes');
            error.name = 'DataError';
            throw error;
          }
          resolve(new CryptoKey(algo, extractable, usages, 'secret', keyData));
        break;
        
        case 'HMAC':
          resolve(new CryptoKey(algo, extractable, usages, 'secret', keyData));
        break;

        default:
        throw new Error(`Unsupported algorithm: ${algo.name}`);
      }
    });
  }

  /**
   * Mimics SubtleCrypto exportKey method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey exportKey}
   * The SubtleCrypto.exportKey() method returns a Promise of the key encrypted
   * in the requested format.
   */
  exportKey(format, key) {
    return new Promise((resolve) => {
      if (format !== 'raw') {
        const error = new Error(`Unsupported format: ${format}`);
        error.name = 'NotSupported';
        throw error;
      }
      resolve(key.data);
    });
  }

  /**
   * Mimics SubtleCrypto digest method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest digest}
   * The SubtleCrypto.digest() method returns a Promise of a digest generated
   * from the hash function and text given as parameters.
   */
  digest(algorithm, buffer) {
    return new Promise(resolve => {
      const webToNodeAlgs = {'SHA-256' : 'sha256', 'SHA-512' : 'sha512' };
      const nodeAlgorithm = webToNodeAlgs[algorithm.name];
      const hash = this.crypto.createHash(nodeAlgorithm);
      hash.update(buffer);
      resolve(hash.digest());
    });
  }

  /**
   * Mimics SubtleCrypto encrypt method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt encrypt}
   * The SubtleCrypto.encrypt() method returns a Promise of the encrypted data
   * corresponding to the plaintext data, algorithm and key given as parameters.
   */
  encrypt(algorithm, key, data) {
    return new Promise(resolve => {
      var cipherName = `aes-${(key.data.byteLength * 8)}-ctr`;
      var cipher = this.crypto.createCipheriv(cipherName, key.data,
        algorithm.counter).setAutoPadding(false);
      var result = cipher.update(data);
      resolve(result);
    });
  }

  /**
   * Mimics SubtleCrypto decrypt method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt decrypt}
   * The SubtleCrypto.decrypt() method returns a Promise of the plaintext
   * corresponding to the ciphertext data, algorithm and key given as parameters.
   */
  decrypt(algorithm, key, data) {
    return new Promise(resolve => {
      var cipherName = `aes-${(key.data.byteLength * 8)}-ctr`;
      // If the key length isn't 32 bytes, then createDecipheriv() will throw.
      var decipher = this.crypto.createDecipheriv(cipherName,
        key.data, algorithm.counter);
      var result = decipher.update(data);
      resolve(result);
    });
  }

  /**
   * Mimics SubtleCrypto sign method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign sign}
   * The SubtleCrypto.sign() method returns a Promise containing the signature
   * corresponding to the text, algorithm and key given as parameters.
   */
  sign(algorithm, key, data) {
    return new Promise(resolve => {
      if (algorithm.name !== 'HMAC') {
        throw new Error('Not supported algorithm');
      }
      const hmac = this.crypto.createHmac('sha256', key.data);
      hmac.update(data);
      resolve(new Uint8Array(hmac.digest()));
    });
  }
  
  /** 
   * Mimics SubtleCrypto verify method.
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify}
   * The SubtleCrypto.verify() method returns a Promise of a Boolean value
   * indicating if the signature given as parameter matches the text, algorithm
   * and key also given as parameters. */
  verify(algo, key, signature, text2verify) {
    return new Promise(resolve => {
      if (algo.name !== 'HMAC') {
        throw new Error('Not supported algorithm');
      }
      const hmac = this.crypto.createHmac('sha256', key.data);
      hmac.update(text2verify);
      const generatedSignature = new Uint8Array(hmac.digest());
      var result = generatedSignature.length === signature.length;
      if (result) {
        for (var i = 0; i < signature.length; ++i) {
          if (generatedSignature[i] !== signature[i]) {
            result = false;
            break;
          }
        }
      }
      resolve(result);
    });
  }
}

//****************************************************************************

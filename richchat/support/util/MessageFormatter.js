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
 * A message formatter which formats the content message used in the user
 * interface.
 *
 * @memberof Support.Util
 * @class MessageFormatter
 */

(function (MessageFormatter) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = MessageFormatter();
    }
    exports.MessageFormatter = MessageFormatter();
  }
  else {
    global.MessageFormatter = MessageFormatter();
  }
}).call(this, function() {
  const IMG_DELIVERED_PARTIAL = "img/delivered_partial.png";
  const IMG_DELIVERED = "img/delivered.png";
  const IMG_READ_PARTIAL = "img/read_partial.png";
  const IMG_READ = "img/read.png";
  const IMG_GREY_PELLET = "img/grey_pellet.png";
  const IMG_YELLOW_PELLET = "img/yellow_pellet.png";
  const IMG_FAILED = "img/failed.png";
  const IMG_RETRACT = "img/msg_retract.png";
  const IMG_SENT = "img/sent.png";
  const IMG_LOCKER_CHAT_BUBBLE = "img/locker_chat_bubble.png";
  const IMG_DEFAULT_AVATAR = "img/defaultAvatar.png";

  const widgetURI = (document._currentScript || document.currentScript).src;
  const m_basePath = widgetURI.substring(0, widgetURI.lastIndexOf("/") + 1);

  /**
   * Construct a MessageFormatter. This is used to produce formatted content for
   * a message.
   * @param {object} contactManager The contact manager used to display
   * information about contacts in bubbles.
   */
  var MessageFormatter = function(contactManager) {
    this.contactManager = contactManager;
  };

  MessageFormatter.prototype = Object.create(Object.prototype);
  MessageFormatter.prototype.constructor = MessageFormatter;

  /**
   * Get the username for a registration ID. If there is a name registered
   * for the user, it will be used. Otherwise, the registration ID in string
   * form will be used.
   *
   * @param {object} message A message object to get the user name for.
   * @returns {string} User display name.
   */
  MessageFormatter.prototype.getUserName = function(message) {
    const contactName = this.contactManager.getDisplayName(message.sender);
    return contactName || message.sender.toString();
  };

  /**
   * Get the avatar for a message. If there is an avatar registered for the
   * contact, it will be used. Otherwise, the default avatar will be used.
   * @param {object} message A message object to get the user avatar URL for.
   * @returns {string} User avatar URL.
   */
  MessageFormatter.prototype.getMessageAvatar = function(message) {
    const avatar = this.contactManager.getUserAvatar(message.sender);
    return avatar || m_basePath + IMG_DEFAULT_AVATAR;
  };

  /**
   * Get an image to represent the state of chat message
   * @param {BBMEnterprise.Messenger.ChatMessage} chatMessage
   *   The chatMessage that message state belongs to
   * @returns {string} The URL of the message state image
   */
  MessageFormatter.prototype.getMessageStateImage = function(chatMessage) {
    var isIncoming = chatMessage.isIncoming;
    if (isIncoming && chatMessage.isUnverified) {
      // Check if the message is unverified.
      return m_basePath + IMG_LOCKER_CHAT_BUBBLE;
    }

    var state = chatMessage.state.value;
    var isPartial = chatMessage.state.isPartial;
    var isRecalled = chatMessage.isRecalled;
    var isOneToOneChat = chatMessage.isOneToOne;

    if (isRecalled) {
      // Check if the message state is recalled
      return m_basePath + IMG_RETRACT;
    } else if (state ===
                BBMEnterprise.Messenger.ChatMessage.StateValue.Sent) {
      // Check if the message state is sent
      return m_basePath + IMG_SENT;
    } else if (state ===
                BBMEnterprise.Messenger.ChatMessage.StateValue.Delivered) {
      // Check if the message state is delivered
      if (isIncoming) {
        return m_basePath + IMG_YELLOW_PELLET;
      } else if (!isOneToOneChat) {
        return m_basePath +
          (isPartial ? IMG_DELIVERED_PARTIAL : IMG_DELIVERED);
      } else {
        return m_basePath + IMG_DELIVERED;
      }
    } else if (state ===
                BBMEnterprise.Messenger.ChatMessage.StateValue.Read) {
      // Check if the message state is read
      if (isIncoming) {
        return m_basePath + IMG_GREY_PELLET;
      } else if (!isOneToOneChat) {
        return m_basePath + (isPartial ? IMG_READ_PARTIAL : IMG_READ);
      } else {
        return m_basePath + IMG_READ;
      }
    } else if (state == "Failed" && isOneToOneChat) {
      // don't show failed messages for multichats
      return m_basePath + IMG_FAILED;
    }

    // Default image URL should be empty.
    return '';
  };


  /**
   * Retrieve a textual description of the content of a message.
   *
   * @param {BBMEnterprise.Messenger.ChatMessage} message
   *   The message containing data to retrieve.
   *
   * @returns {string} A content string for the message.
   */
  MessageFormatter.prototype.getMessageText = function(message) {
    if (message.isRecalled) {
      return 'Message retracted.';
    } else {
      switch (message.tag) {
        case MessageFormatter.Tag.File:
        case MessageFormatter.Tag.Picture:
        case MessageFormatter.Tag.Text:
          return message.content;
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Join:
          return this.contactManager.getDisplayName(message.sender) 
            + ' joined the chat.';
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Leave:
          return this.contactManager.getDisplayName(message.sender)
            + ' left the chat.';
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Remove:
          return this.contactManager.getDisplayName(message.sender)
            + ' removed '
            + this.contactManager.getDisplayName(message.data.regId)
            + ' from the chat.';
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Admin:
          if (message.data && message.data.regId) {
            return this.contactManager.getDisplayName(message.data.regId) +
              (message.data.promotion === true
                ? ' is now an admin.' 
                : ' is no longer an admin.');
          } else {
            console.warn("MessageFormatter: missing expected data in admin"
              + " message.");
            return '';
          }
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Shred:
          return this.contactManager.getDisplayName(message.sender)
            + ' retracted the chat.';
        case BBMEnterprise.Messenger.ChatMessage.ReservedTag.Subject:
          return this.contactManager.getDisplayName(message.sender)
            + ' changed the chat subject.';
        default:
          return this.contactManager.getDisplayName(message.sender)
            + `sent an item (Tag: ${message.tag}) that is not supported.`;
      }
    }
  };

  /**
   * Return whether a message is a status message.
   *
   * @param {BBMEnterprise.Messenger.ChatMessage} message
   *   The message to check.
   *
   * @returns {boolean} True if and only if the message is a status message.
   */
  MessageFormatter.prototype.getIsStatusMessage = function(message) {
    return message.tag !== MessageFormatter.Tag.Text &&
           message.tag !== MessageFormatter.Tag.File &&
           message.tag !== MessageFormatter.Tag.Picture;
  };

  /**
   * Return whether a message is a picture.
   *
   * @param {BBMEnterprise.Messenger.ChatMessage} message
   *   The message to check.
   *
   * @returns {boolean} True if and only if the message is a picture.
   */
  MessageFormatter.prototype.getIsPictureMessage = function(message) {
    return message.tag === MessageFormatter.Tag.Picture;
  };

  /**
   * Return whether a message is a file transfer.
   *
   * @param {BBMEnterprise.Messenger.ChatMessage} message
   *   The message to check.
   *
   * @returns {boolean} True if and only if the message is a file transfer.
   */
  MessageFormatter.prototype.getIsFileMessage = function(message) {
    return message.tag === MessageFormatter.Tag.File;
  };

  // :: ----------------------------------------------------------------------
  // :: Data Members
  MessageFormatter.Tag = {
    Text: 'Text',
    Picture: 'Picture',
    File: 'File'
  };

  return MessageFormatter;
});

//****************************************************************************

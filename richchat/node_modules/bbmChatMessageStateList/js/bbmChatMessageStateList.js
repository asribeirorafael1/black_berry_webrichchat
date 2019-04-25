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

(function(window, document) {
  var widgetURI = (document._currentScript || document.currentScript).src;
  var m_basePath = widgetURI.substring(0, widgetURI.lastIndexOf("/js") + 1);

  const IMG_DELIVERED = "img/delivered.png";
  const IMG_READ = "img/read.png";
  const IMG_SENT = "img/sent.png";
  const IMG_DEFAULT_AVATAR = "img/defaultAvatar.png";

  /**
   * bbm-chat-message-state-list element class implementation
   * 
   * bbm-chat-message-state-list is a custom element that allows user to perform following
   * action:
   * - display the states of an outgoing chat message with all chat participants
   * 
   * @memberof Support.Widgets
   */
  class BbmChatMessageStateList extends Polymer.Element {

    // Returns the name of the custom element
    static get is() {return "bbm-chat-message-state-list";}

    static get properties() {
      return {
        /**
         * The identifier of the chat for which to display messages.
         */
        chatId: {
          type: String,
          readOnly: false,
          notify: true
        },

        /**
         * The identifier of the message for which to display message states.
         */
        messageId: {
          type: String,
          readOnly: false,
          notify: true
        },

        messageStates: {
          type: Array,
          readOnly: false,
          notify: true
        }
      };
    }

    static get observers() {
      return [
        // When the chatId, messageId and bbmMessenger are all set, populate the list.
        'populateChatMessageStateList(chatId, messageId)'
      ];
    }

    /**
     * Sets instance of BBMEnterprise.Messenger
     * @param {BBMEnterprise.Messenger} value
     * Instance of BBMEnterprise.Messenger
     * @throws {Error} When parameter is not an instance of
     * BBMEnterprise.Messenger
     */
    setBbmMessenger(value) {
      if (value && !(value instanceof BBMEnterprise.Messenger)) {
        throw new Error("bbm-chat-message-state-list: value must be instance of BBMEnterprise.Messenger");
      }

      this.bbmMessenger = value;

      this.populateChatMessageStateList();
    }

    /**
     * Populates the list of ChatMessageStates
     */
    populateChatMessageStateList() {
      if (!this.chatId || !this.messageId || !this.bbmMessenger ) {
        console.log("bbm-chat-message-state-list: Unable to populate the message state list");
        return;
      }

      var states = [];

      //get the message states from all participants
      this.bbmMessenger.getChatMessageState(this.chatId, this.messageId).then(chatMessageStates => {
        for(var chatMessageState of chatMessageStates) {
          try {
            states.push(chatMessageState);
          } catch(error) {
            console.log('Error adding chat message state element: ' + error);
          }
        }

        this.messageStates = states;
      });
    }

    /**
     * Sets instance of contactManager
     *
     * @param {object} value
     *   The contact manager used to display information about participants in
     *   the list of message states.
     */
    setContactManager(value) {
      if(this.contactManager) {
        this.contactManager.removeEventListener("user_changed", onUserChanged);
      }

      this.contactManager = value;

      if (value) {
        this.contactManager.addEventListener("user_changed", onUserChanged);
      }
    }

    // Get the contact avatar. If there is an avatar registered for the
    // contact, it will be used. Otherwise, the default avatar will be used.
    getUserAvatar(chatMessageState) {
      var avatar = this.contactManager.getUserAvatar(chatMessageState.regId);
      return avatar ? avatar : IMG_DEFAULT_AVATAR;
    }


    // Get the username for a registration ID. If there is a name registered
    // for the user, it will be used. Otherwise, the registration ID in string
    // form will be used.
    getUserName(chatMessageState) {
      var contactName = this.contactManager.getDisplayName(chatMessageState.regId);
      return contactName ? contactName : chatMessageState.regId.toString();
    }

    // Get an image to represent the state of chat message
    // @param {object} chatMessageState -  The message state for the participant
    // @returns {string} The URL of the message state image
    getMessageStateImage(chatMessageState) {
        var state = chatMessageState.state;

        if (state === "Delivered") {
          //check if the message state is delivered
          return m_basePath + IMG_DELIVERED;
        } else if (state === "Read") {
          //check if the message state is read
          return m_basePath + IMG_READ;
        } else {
          return m_basePath + IMG_SENT;
        }
    }

    /**
     * Sets current chat id
     * @param {String} chatId - Current chat id
     */
    setChatId(chatId) {
      this.chatId = chatId;
    }

    /**
     * Sets current chat id
     * @param {String} chatId - Current chat id
     */
    setMessageId(messageId) {
      this.messageId = messageId;
    }
  }

  // Updates existing messageState bindings whenever messageState's information
  // (user name / avatar) is changed
  function onUserChanged(userInfo) {
    // If changed user is in the list of messageStates, then update
      // bindings with the new changed username / avatar
      if (this.messageStates && this.messageStates.some(messageState =>
        messageState.regId === userInfo.userRegId)) {
          this.populateChatMessageStateList();
        }
  }

  window.customElements.define(BbmChatMessageStateList.is, BbmChatMessageStateList);
})(window, document);

//****************************************************************************

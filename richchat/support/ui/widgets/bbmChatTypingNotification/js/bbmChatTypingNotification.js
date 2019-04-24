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

  /**
   * bbm-chat-typing-notification element class implementation.
   *
   * bbm-chat-typing-notification is a custom element which displays the name of
   * the chat participant which is currently typing. Shows a number of the 
   * multiple chat participants which are currently typing.
   * 
   * 
   *  number
   * of chat participants which are currently typing.
   *  
   * @memberof Support.Widgets
   */
  class BbmChatTypingNotification extends Polymer.Element {
    constructor() {
      super();

      // Handles chat typing notification. Shows custom element when there are
      // any chat participants typing. If no participants are typing hides
      // custom element.
      this.handleChatTyping = chatTyping => {
        if (this.chatId !== chatTyping.chatId) {
          return;
        }
        this.participants = this.bbmMessenger.getTypingUsers(this.chatId);
        this.container.style.display = (this.participants.length == 0) 
          ? "none"
          : "flex";
      };

      // Updates user name in typing bar whenever user information is changed
      this.onUserChanged = userInfo => {
        if (this.participants.length > 0) {
          if (this.participants.some(participant =>
            participant.regId === userInfo.userRegId)) {
              this.participants = this.bbmMessenger.getTypingUsers(this.chatId);
          }
        }
      };

      /**
       * Sets instance of BBMEnterprise.Messenger
       * @param {BBMEnterprise.Messenger} value
       * Instance of BBMEnterprise.Messenger
       * @throws {Error} When parameter is not an instance of
       * BBMEnterprise.Messenger
       */
      this.setBbmMessenger = value => {
        if (value && !(value instanceof BBMEnterprise.Messenger)) {
          throw new Error("Value must be an instance of BBMEnterprise.Messenger");
        }

        // Unregister old callbacks.
        if (this.bbmMessenger) {
          this.bbmMessenger.removeListener("chatTyping", this.handleChatTyping);
        }

        this.bbmMessenger = value;

        if(value) {
          this.bbmMessenger.on("chatTyping", this.handleChatTyping);
        }
      };

      /**
       * Sets current chat id
       * @param {String} value
       * Current chat id
       */
      this.setChatId = value => {
        if (this.chatId != value) {
          this.chatId = value;
          if (this.bbmMessenger) {
            this.participants = this.bbmMessenger.getTypingUsers(this.chatId);
          }
          else {
            console.warn("bbm-chat-typing-notification: bbmMessenger is not set");
            this.participants = [];
          }
        }
      };

      /**
       * Sets instance of user manager
       * @param {object} value
       * Instance of user manager
       */
      this.setContactManager = value => {
        if(this.contactManager) {
          this.contactManager.removeEventListener("user_changed", this.onUserChanged);
        }

        this.contactManager = value;

        if(value) {
          this.contactManager.addEventListener("user_changed", this.onUserChanged);
        }
      };
    }

    // Returns the name of the custom element
    static get is() { return "bbm-chat-typing-notification"; }

    // Called after property values are set and local DOM is initialized
    ready() {
      super.ready();
      this.participants = [];
      this.container = this.shadowRoot.querySelector(".bbmTypingNotification");
      var bbmTypingImage = this.shadowRoot.querySelector(".bbmTypingImage");
      bbmTypingImage.setAttribute("src", m_basePath + "img/chatTyping.png");
      this.container.style.display = "none";
    }

    // Defined list of properties of custom control
    static get properties() {
      return {
        // Holds list of currently typing chat participants
        participants: {
          type: Array,
          readOnly: false,
          notify: true
        }
      };
    }

    // Binding computing function. Converts array of participants into readable
    // string.
    getNotificationString(participants) {
      if (this.contactManager === undefined) {
        return "";
      }

      if (participants.length === 0) {
        return "";
      }
      else if (participants.length === 1) {
        const ret = this.contactManager.getDisplayName(participants[0].regId)
          + " is writing a message ...";
        return ret;
      }
      else {
        const userName = this.contactManager.getDisplayName(participants[0].regId);
        const remainingUsers = participants.length - 1;
        const ret = userName + ((remainingUsers === 1)
          ? " and one other are writing a message ..."
          : " and " + remainingUsers + " others are writing a message ...");
        return ret;
      }
    }
  }
  customElements.define(BbmChatTypingNotification.is, BbmChatTypingNotification);
})(window, document);

//****************************************************************************

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

(function(window) {

  /**
   * bbm-chat implementation.
   * 
   * bbm-chat is a custom element that displays complete chat window which
   * consists of:
   * - [Header]{@link Support.Widgets.BbmChatHeader}
   * - [Message list]{@link Support.Widgets.BbmChatMessageList}
   * - [Typing notification area]{@link Support.Widgets.BbmChatTypingNotification}
   * - [Input]{@link Support.Widgets.BbmChatInput}
   * 
   * bbm-chat fires "chatDefunct" event when current chat is defunct.
   *
   * @memberof Support.Widgets
   */
  class BbmChat extends Polymer.Element {
    // Called after property values are set and local DOM is initialized
    ready() {
      super.ready();
      this._header = this.shadowRoot.querySelector("#header");
      this._messageList = this.shadowRoot.querySelector("#message-list");
      this._typingNotification = this.shadowRoot.querySelector("#typing-notification");
      this._input = this.shadowRoot.querySelector("#input");

      /**
       * A callback which is run when the chat is updated, and emits a
       * chatDefunct event if the current chat becomes defunct.
       *
       * @param {BBMEnterprise.Messenger#chatUpdate} updateMessage
       *   An event indicating that a chat has been updated.
       */
      this._chatUpdated = updateMessage => {
        if (updateMessage.chat.chatId === this.chatId &&
            updateMessage.chat.state
              === BBMEnterprise.Messenger.Chat.State.Defunct) {
            this.dispatchEvent(new Event("chatDefunct"));
        }
      };
    }

    /**
     * Sets instance of BBMEnterprise
     * @param {BBMEnterprise} value
     * Instance of BBMEnterprise
     * @throws {Error} When parameter is not an instance of
     * BBMEnterprise
     */
    setBbmSdk(value) {
      if (value && !(value instanceof BBMEnterprise)) {
        throw new Error("bbm-chat: value must be an instance of BBMEnterprise");
      }

      // If a messenger was previously set, clean it up.
      if(this.bbmMessenger) {
        this.bbmMessenger.removeListener('chatUpdated', this._chatUpdated);
      }

      const bbmMessenger = value ? value.messenger : undefined;
      this.bbmMessenger = bbmMessenger;
      this._header.setBbmSdk(value);
      this._messageList.setBbmMessenger(bbmMessenger);
      this._typingNotification.setBbmMessenger(bbmMessenger);
      this._input.setBbmMessenger(bbmMessenger);

      if(this.bbmMessenger) {
        this.bbmMessenger.on("chatUpdated", this._chatUpdated);

        this._input.addEventListener('messageSent', () => {
          // Scroll the message list to the bottom after a message is sent.
          this._messageList.scrollToBottom();
        });

        // Show the information field for message reference.
        this._messageList.addEventListener('messageReference', (event) => {
          this._input.showRefField(event);
        });
      }
    }

    /**
     * Sets instance of user manager
     * @param {object} value
     * Instance of user manager
     */
    setContactManager(value) {
      this._header.setContactManager(value);
      this._typingNotification.setContactManager(value);
      this._messageList.setContactManager(value);
    }

    /**
     * Sets instance of time range formatter
     * @param {object} value
     * Instance of time range formatter
     */
    setTimeRangeFormatter(value) {
      this._messageList.setTimeRangeFormatter(value);
    }

    /**
     * Sets the message formatter. The message formatter is used to format
     * the content of messages for display.
     *
     * @param {object} value
     *   The message formatter used to display information about the message.
     */
    setMessageFormatter(value) {
      this._messageList.setMessageFormatter(value);
    }

    /**
     * Sets current chat id
     * @param {String} chatId - Current chat id
     * @throws {Error} - When chat id is null or undefined
     */
    setChatId(chatId) {
      if (chatId) {
        if (this.chatId !== chatId) {
          this.chatId = chatId;
          this._header.setChatId(this.chatId);
          this._messageList.setChatId(this.chatId);
          this._typingNotification.setChatId(this.chatId);
          this._input.setChatId(this.chatId);
        }
      }
      else {
        throw new Error ("bbm-chat: chat id is invalid");
      }
    }

    /**
     * Gets the instance of the BbmChatHeader component
     * @returns {BbmChatHeader} - The instance of the BbmChatInput component
     */
    getChatHeader() {
      return this._header;
    }

    /**
     * Gets the instance of the BbmChatInput component
     * @returns {BbmChatInput} - The instance of the BbmChatInput component
     */
    getChatInput() {
      return this._input;
    }

    static get is() { return "bbm-chat"; }
  }
  window.customElements.define(BbmChat.is, BbmChat);
})(window);

//****************************************************************************

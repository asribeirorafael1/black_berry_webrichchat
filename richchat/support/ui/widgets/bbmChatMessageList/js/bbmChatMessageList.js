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

(function (window, document) {
  // Wait until the component is ready to define the class.
  HTMLImports.whenReady(function () {
    /**
     * The implementation for the message list component. Note: this function
     * takes an html template as a child, which will be used to display each
     * message. The template has some important properties:
     * - A string enclosed in [[]] may be used to insert JavaScript code into
     *   the block, either as text or attributes.
     * - The types of JavaScript allowed include:
     *   - message.XXX where XXX is a property of a ChatMessage (and will be
     *   resolved to the value of that property for the ChatMessage being
     *   displayed).
     *   - The name of a function where the function is in the object passed to
     *     `context'.
     *   - ! to negate a value.
     *
     * @memberof Support.Widgets
     */
    class BbmChatMessageList extends Polymer.mixinBehaviors([Polymer.IronResizableBehavior], Polymer.Element) {
      constructor() {
        super();

        // Set up a default mapper which does nothing.
        this.mapper = (x) => x;

        // Bind a scrollhandler to this. It handles the scroll of the iron-list,
        // so by default it would be bound to it. But we want it bound to this
        // instead.
        this.scrollHandler = scrollHandler.bind(this);
      }

      static get is() {
        return 'bbm-chat-message-list';
      }

      static get properties() {
        return {
          /**
           * The identifier of the chat for which to display messages.
           */
          chatId: String,

          /**
           * Whether the component is ready. This is true if the component has
           * everything it needs to display some messages (a messenger, a chat
           * and a splicewatcher).
           */
          isReady: {
            type: Boolean,
            value: false
          },

          /**
           * True if and only if the component has made a request for more
           * messages and for which the response has not yet arrived.
           */
          gettingMessages: {
            type: Boolean,
            value: false
          }
        };
      }

      static get observers() {
        return [
          // When the chatId changes, reload all cached data.
          'switchChat(chatId)'
        ];
      }

      // A handler for the case where we need to change which set of messages to
      // display. This is invoked by an observer whenever any of the parameters
      // controlling the message list to display change.
      switchChat() {
        // Can't proceed if either messenger or chat is unset.
        if (!this.messenger || !this.chatId) {
          uninitialize(this);
          return;
        }

        // If we were watching a chat, then stop.
        if (this.watching) {
          this.spliceWatcher.removeListener(this.watching.chatId,
            this.watching.callback);
        }

        // We're okay, start watching a new chat.
        initialize(this);
      }

      /**
       * Sets instance of bbmMessenger
       * @param {BBMEnterprise.Messenger} value
       *   The messenger to use to retrieve a chat's message list.
       */
      setBbmMessenger(value) {
        this.messenger = value;

        // Make sure we have a valid kind of message storage factory.
        if (value) {
          var messageStorageFactory = value.getMessageStorageFactory();
          if (messageStorageFactory instanceof
              BBMEnterprise.StorageFactory.SpliceWatcher) {
            console.log('bbm-chat-message-list: Message list detects ' +
              'changes with splice watcher');
            this.spliceWatcher = messageStorageFactory;
          } else {
            var message = 'bbm-chat-message-list: Unknown message storage ' +
              'factory. bbm-chat-message-list requires SpliceWatcher message ' +
              'storage.';
            console.error(message);
            throw new BBMEnterprise.Error.Error(message);
          }
        }

        // A new chat will always be displayed with a new messenger. It's
        // possible that this is the same chat as before, but the display is
        // still different when displaying from a different messenger's
        // perspective, and it's possible that the chat is invalid for the new
        // messenger, which will cause this module to be uninitialized.
        this.switchChat();
      }

      /**
       * Sets current chat id
       * @param {String} chatId - Current chat id
       */
      setChatId(chatId) {
        this.chatId = chatId;
      }

      /**
       * Scrolls the list to the bottom
       */
      scrollToBottom() {
        //"this.$.list.scrollTop = this.$.list.scrollHeight" won't necessarily
        //go to the bottom, it will sometimes go close to the bottom but not all
        //the way. Set this.atBottom to True before setting scrollTop to fix it
        //in scrollHandler().
        this.atBottom = true;

        Polymer.RenderStatus.afterNextRender(this, () => {
          this.$.list.scrollTop = this.$.list.scrollHeight;
        });
      }

      ready() {
        super.ready();

        // Record the child template for later.
        this.bubbleTemplate = this.$.list.queryEffectiveChildren('template');

        // Note if the template changes and update accordingly.
        this.$.bubbleSlot.addEventListener('slotchange', () => {
          this.bubbleTemplate = this.$.list.queryEffectiveChildren('template');
          if (this.bubbleTemplate === this.$.bubbleTemplate) {
            this.bubbleTemplate = undefined;
          }
        });

        const windowFocusHandler = () => {
          // The browser becomes active and the list is at the bottom.
          if(this.atBottom) {
            // Mark the last message as read.
            readLatestMessage(this);
          } 
        };
        window.addEventListener('focus', windowFocusHandler);

        const onUserInput = () => {
          // Mark the last message as read.
          if (this.atBottom) {
            const len = this.$.list.items.length;
            if (len > 0) {
              const lastMessage = this.$.list.items[len - 1].message;
              if (lastMessage.isIncoming && lastMessage.state.value !==
                  BBMEnterprise.Messenger.ChatMessage.StateValue.Read) {
                readLatestMessage(this);
              }
            }
          }
        };

        const elements = document.getElementsByTagName('bbm-chat');
        if (elements.length > 0) {
          const bbmChat = elements[0];
          bbmChat.$.input.addEventListener('keydown', onUserInput);
          bbmChat.addEventListener('mousedown', onUserInput);
        }

      }


      /**
       * Sets the context, which will be used to resolve references in
       * the message bubble template.
       *
       * @param {object} value
       *   This can contain functions which may be called from the message
       *   bubble template.
       */
      setContext(value) {
        // GOTCHA: This is using the polymer internal value __dataHost. Polymer
        // sets this value in the property-effects mixin for polymer components,
        // but we want to allow this to be set from a non-polymer component, and
        // unfortunately, polymer doesn't provide any mechanism for this.
        if (!this.bubbleTemplate) {
          throw new BBMEnterprise.Error.Error(
            'Cannot set context without a template');
        }
        this.bubbleTemplate.__dataHost = value;
      }

      /**
       * Sets a mapping function which will map messages to another object prior
       * to their being inserted in the message list. This allows for certain
       * simplifications where it is easier to calculate several values in
       * JavaScript at once possibly reusing a calculation to produce multiple
       * values, and bind to the values in html, rather than bind to JavaScript
       * functions in html which would be called multiple times per message.
       *
       * Optionally takes a clearer as well, which will be called to clear the
       * data from a message when the message is removed. This is optional for
       * the case where some cleanup is needed for the data which mapper
       * creates.
       *
       * @param {function} mapper
       *   This function takes a ChatMessage and produces any output desired.
       *   The output it produces needs to match what the specified template
       *   wants to consume.
       *
       * @param {function} [clearer]
       *   This function takes a ChatMessage which is about to be deleted, and
       *   performs any cleanup for the message which may be needed.
       */
      setMappingFunction(mapper, clearer) {
        this.mapper = mapper;
        this.clearer = clearer;
      }
    }

    /**
     * Called when something which the component needs to work properly is
     * unset.
     *
     * @param {BbmChatMessageList} self
     *   The component to uninitialize
     */
    function uninitialize(self) {
      // If we weren't ready to begin with, nothing needs to be done.
      if (self.isReady) {

        // Clear all of the messages, if the watcher is interested.
        if(self.clearer) {
          for(let message of self.$.list.items) {
            self.clearer(message);
          }
        }

        // We're no longer ready, and unset the list.
        self.isReady = false;
        self.$.list.items = [];

        // Stop listening to the 'scroll' event from the list.
        self.$.list.removeEventListener('scroll', self.scrollHandler);

        // If we were watching a chat, stop watching.
        if (self.watching) {
          self.spliceWatcher.removeListener(self.watching.chatId,
            self.watching.callback);
          self.watching = undefined;
        }
        self.chatId = undefined;
      }
    }

    /**
     * Called when everything which the component needs to work properly is
     * set.
     * @param {BbmChatMessageList} self
     * The component to initialize
     */
    function initialize(self) {
      if (!self.isReady) {
        self.isReady = true;
      }

      // Create a function to track changes to the chat.
      const watchChat = spliceInfo => {
        // In response to a change, notify the iron-list about the change in the
        // way that polymer does list bindings.

        // Splice in the new data.
        var args = ['items', spliceInfo.index, spliceInfo.removed.length];
        args.push.apply(args, spliceInfo.storage.slice(
            spliceInfo.index, spliceInfo.index + spliceInfo.added)
          .map(self.mapper));
        var deleted = self.$.list.splice.apply(self.$.list, args);

        if (self.clearer) {
          for(let message of deleted) {
            self.clearer(message);
          }
        }

        // If list is scrolled down to the bottom and new message arrived,
        // scroll the list down again.
        if (self.atBottom) {
          Polymer.RenderStatus.afterNextRender(self, () => {
            self.$.list.scrollTop = self.$.list.scrollHeight;
          });
        }
      };

      // Record the fact that we are watching the chat, in order to stop when
      // switching chats.
      self.watching = {
        chatId: self.chatId,
        callback: watchChat
      };

      // When entering a chat, we start at the bottom.
      self.atBottom = true;
      self.lastScrollTop = 0;

      // Set up to watch the message list.
      self.spliceWatcher.on(self.chatId, watchChat);

      // Clear all of the messages, if the watcher is interested.
      if(self.clearer) {
        for(let message of self.$.list.items) {
          self.clearer(message);
        }
      }

      // Populate the initial list.
      self.$.list.items = self.messenger.getChatMessages(self.chatId)
        .map(self.mapper);

      // iron-list will disable its scroll listener if there is a resize while
      // is is not visible. At this point it should be visible, so activate
      // the scroll listener.
      self.$.list.toggleScrollListener(true);

      // Listen to the 'scroll' event from the list.
      //
      // GOTCHA: It is critical that this listener is registered after toggling
      // the list's scroll listener because when we scroll to the bottom, this
      // generates a scroll event which the iron-list scroll listener will
      // process, and in response, may recalculate the size of some list items,
      // resulting in us no longer being at the bottom. This handler must run
      // after that in order to confirm that we did reach the bottom, and if
      // not, to reset the position to the new bottom.
      self.$.list.addEventListener('scroll', self.scrollHandler);

      // Scroll to the bottom to start.
      Polymer.RenderStatus.afterNextRender(self, () => {
        self.$.list.scrollTop = self.$.list.scrollHeight - self.$.list.clientHeight;
      });

      // And we have read the latest message.
      readLatestMessage(self);

      // Load the rest of the messages.
      self.gettingMessages = true;
      self.messenger.fetchChatMessages(self.chatId)
        .catch(error => console.error('bbm-chat-message-list: ' +
          'Cannot get chats from ' + self.chatId + ': ' + error))
        .then(() => {
          // The fetch has completed.
          self.gettingMessages = false;
        });
    }

    /**
      * An event handler to handle when a scroll occurs. If the user is already
      * at the bottom and a scroll occurs, we want to keep them at the bottom,
      * in case the bottom has moved.
      * 
      * @private
      */
    function scrollHandler() {
      // Check if the list is being scrolled to the bottom and the browser
      // is active.
      if(this.$.list.scrollTop < this.lastScrollTop) {
        this.atBottom = false;
      } else if(!this.atBottom &&
                this.$.list.scrollHeight - this.$.list.scrollTop ===
                  this.$.list.clientHeight && document.hasFocus()) {

        this.atBottom = true;

        // If we were not at the bottom, but now are, then we have gone to
        // the bottom, so mark the last message as read.
        readLatestMessage(this);
      }
      this.lastScrollTop = this.$.list.scrollTop;

      if(this.atBottom) {
        // If we are at the bottom, then track the bottom in case the bottom
        // has moved.
        this.$.list.scrollTop = this.$.list.scrollHeight;
      }
    }

    /**
     * Mark the latest message in the active conversation as read.
     * @param {BbmChatMessageList} self
     */
    function readLatestMessage(self) {
      if(self.chatId && self.messenger) {
        var messages = self.messenger.getChatMessages(self.chatId);
        if(messages.length > 0) {
          var lastMessage = messages[messages.length - 1];
          self.messenger.chatMessageRead(self.chatId, lastMessage.messageId)
          .catch(error => console.error(
            'bbm-chat-message-list: Cannot send message read notification for '
            + 'messageId=' + lastMessage.messageId + ' in chat=' + self.chatId
            + ': ' + error
          ));
        }
      }
    }

    window.customElements.define(BbmChatMessageList.is, BbmChatMessageList);
  });
})(window, document);

//****************************************************************************

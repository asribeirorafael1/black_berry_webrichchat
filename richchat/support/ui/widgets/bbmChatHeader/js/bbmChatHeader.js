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
   * bbm-chat-header element class implementation.
   * 
   * bbm-chat-header is a custom element that displays the following information
   * about a Spark Communications SDK chat:
   * - Chat banner image
   * - Chat subject
   * - Chat participants
   * 
   * Allows the following actions:
   * - Add / remove chat participants
   * - Perform admin operations on chat participants (promote, demote, remove)
   * - Initiate voice / video call
   * - Leave chat
   * 
   * Has the following properties:
   * - adminKeyImage {string}
   *   path to an image to use for a participant who is an admin in the chat.
   * - pendingParticipantImage {string}
   *   path to an image to use for a participant who has not yet joined a chat.
   * - videoCallImage {string}
   *   path to an image to use for the button which allows making a video call.
   * - voiceCallImage {string}
   *   path to an image to use for the button which allows making a voice call.
   * - optionsMenuImage {string}
   *   path to an image to use for the button which gives a menu of additional
   *   options.
   * - isMediaEnabled {boolean}
   *   controls whether to display voice/video call buttons.
   * - noSubjectPlaceHolder {string}
   *   controls what is displayed for the subject if no subject is available.
   *
   * bbm-chat-header fires following events:
   * - "makeCall" custom event to indicate outgoing call has to be established.
   *    Client application must handle this event and instantiate outgoing call.
   * - "inviteOthers" custom event to indicate more users are to be invited to
   *    the current chat. Client application must handle this event and display
   *    the list of contacts available to be invited to the current chat.
   *
   * @memberof Support.Widgets
   */
  class BbmChatHeader extends Polymer.Element {
    constructor() {
      super();

      // Updates existing chat related bindings according to specified 
      // chat element
      var updateChat = chat => {
        if (this.contactManager) {
          var selfInfo = this.contactManager.getLocalUser();
        }
        else {
          console.warn("bbm-chat-header: contact manager is not specified");
          return;
        }

        this.isSelfAdmin =
          this.bbmMessenger.isAdmin(chat.chatId, selfInfo.regId);

        this.isOneToOne = chat.isOneToOne;

        this.participants = chat.participants;

        if (chat.isOneToOne) {
          this.bbmParticipantsPane.style.display = 'none';
          // For a one-to-one chat show other party information in the chat
          // subject
          chat.participants.forEach(participant => {
            if (participant.regId !== selfInfo.regId) {
              this.subject =
                this.contactManager.getDisplayName(participant.regId);
              this.subject = this.subject || participant.regId;
              this.chatImage =
                this.contactManager.getUserAvatar(participant.regId)
                || m_basePath + "img/defaultAvatar.png";
            }
          });
        } else {
          this.bbmParticipantsPane.style.display = "block";
          // If subject was white spaces, then show user defined subject 
          // placeholder as the chat subject
          var chatSubject = chat.subject.trim();
          if (chatSubject.length === 0) {
            chatSubject = this.noSubjectPlaceHolder;
          }
          this.subject = chatSubject;
          this.chatImage = m_basePath + "img/mpc_participants.png";
        }
      };

      /**
       * A callback which is run when the chat currently being displayed is
       * updated.
       *
       * @param {BBMEnterprise.Messenger#chatUpdate} updateMessage
       *   An event indicating that a chat has been updated.
       *
       * @private
       */
      const chatUpdatedCallback = updateMessage => {
        if (updateMessage.chat.chatId === this.chatId) {
          updateChat(updateMessage.chat);
        }
      };

      // Updates existing chat bindings whenever participant's information
      // (user name / avatar) is changed
      const onUserChanged = userInfo => {
        if (this.participants && this.participants.length > 0) {
          // If changed user is in the list of participants, then update
          // bindings with the new changed username / avatar
          if (this.participants.some(participant =>
            participant.regId === userInfo.regId)) {
              if (this.bbmMessenger) {
                var chat = this.bbmMessenger.getChat(this.chatId);
                this.participants = chat.participants;
              }
              // For one to one chat, update chat image and chat subject with
              // changed user contact information
              if (this.isOneToOne) {
                const selfInfo = this.contactManager.getLocalUser();
                if (userInfo.regId !== selfInfo.regId) {
                  this.subject = userInfo.displayName || userInfo.regId;
                  this.chatImage = userInfo.avatarUrl
                    || "img/defaultAvatar.png";
                }
              }
            }
        }
      };

      /**
       * Sets instance of BBMEnterprise
       * @param {BBMEnterprise} value
       * Instance of BBMEnterprise
       * @throws {Error} When parameter is not an instance of
       * BBMEnterprise
       */
      this.setBbmSdk = value => {
        if (value && !(value instanceof BBMEnterprise)) {
          throw new Error("bbm-chat-header: value must be an instance of BBMEnterprise.");
        }

        if (this.bbmMessenger) {
          this.bbmMessenger.removeListener('chatUpdated', chatUpdatedCallback);
        }

        // Checks whether the client has audio and/or video capabilities.
        this.media = value ? value.media : undefined;
        if (this.media) {
          this.media.hasAudioDevice().then(hasAudio => {
            this.isHasAudio = hasAudio;
          });
          this.media.hasVideoDevice().then(hasVideo => {
            this.isHasVideo = hasVideo;
          });
        }

        this.bbmMessenger = value ? value.messenger : undefined;
        if(this.bbmMessenger) {
          this.bbmMessenger.on("chatUpdated", chatUpdatedCallback);
        }
      };

      /**
       * Sets current chat id.
       * @param {String} value
       * Current chat id
       * @throws {Error} When bbmMessenger is not set.
       */
      this.setChatId = value => {
        if (this.chatId !== value) {
          this.chatId = value;
          if (this.bbmMessenger) {
            try {
              updateChat(this.bbmMessenger.getChat(this.chatId));
            }
            catch(error) {
              console.warn("bbm-chat-header: failed to setChatId(" 
                + value + "), error: " + error);
            }
          }
          else {
            throw new Error ("bbmMessenger is not set.");
          }
        }
      };

      /**
       * Sets instance of user manager
       * @param {object} value
       * Instance of user manager
       */
      this.setContactManager = value => {
        if (this.contactManager) {
          this.contactManager.removeEventListener("user_changed", onUserChanged);
        }

        this.contactManager = value;

        if (value) {
          this.contactManager.addEventListener("user_changed", onUserChanged);
        }
      };

      // Closes all open drop-downs inside custom element
      this.closeDropdowns = () => {
        var dropdowns =
          this.shadowRoot.querySelectorAll(".bbmChatHeaderDropdown");
        dropdowns.forEach(item => {
          if (item.style.display !== "none") {
            item.style.display = "none";
          }
        });
      };
    }

    // Called after property values are set and local DOM is initialized
    ready() {
      super.ready();
      this.bbmShowParticipants =
        this.shadowRoot.querySelector(".bbmShowParticipants");
      this.bbmParticipantsPane =
        this.shadowRoot.querySelector(".bbmParticipantsPane");
      this.bbmShowParticipants.onclick = () => {
        this.bbmParticipantsPane.style.display =
          (this.bbmParticipantsPane.style.display === "none")
            ? "block"
            : "none";
      };
    }

    // List of properties of the custom control
    static get properties() {
      return {
        isSelfAdmin: {
          type: Boolean,
          readOnly: false,
          notify: true
        },
        participants: {
          type: Array,
          readOnly: false,
          notify: true
        },
        subject: {
          type: String,
          readOnly: false,
          notify: true
        },
        chatImage: {
          type: String,
          readOnly: false,
          notify: true
        },
        adminKeyImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: m_basePath + "img/admin_key.png"
        },
        pendingParticipantImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: m_basePath + "img/pending_participant.png"
        },
        expanderImage: {
          type: String,
          readOnly: false,
          notify: true,
          value : m_basePath + "img/menu_token.png"
        },
        videoCallImage: {
          type: String,
          readOnly: false,
          notify: true,
          value : m_basePath + "img/video_call.png"
        },
        voiceCallImage: {
          type: String,
          readOnly: false,
          notify: true,
          value : m_basePath + "img/voice_call.png"
        },
        optionsMenuImage: {
          type: String,
          readOnly: false,
          notify: true,
          value : m_basePath + "img/options_menu.png"
        },
        isHasAudio: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        isHasVideo: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        isMediaEnabled: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        isOneToOne: {
          type: Boolean,
          readOnly: false,
          notify: true
        },
        noSubjectPlaceHolder: {
          type: String,
          readOnly: false,
          notify: true,
          value : ""
        }
      };
    }

    // Binding computing function. Returns string which represents number of
    // participants in readable format.
    getParticipantsString(participants) {
      var ret = "";
      if (participants.length > 0) {
        var count = participants.length;
        ret = count.toString();
        ret += (count === 1) 
         ? " participant"
         : " participants";
      }
      return ret;
    }

    // Binding computing function. Returns participant name.
    getParticipantName(participant) {
      const selfInfo = this.contactManager.getLocalUser();
      let userName = this.contactManager.getDisplayName(participant.regId);
      if (participant.regId === selfInfo.regId) {
        userName = `${userName} (You)`;
      }
      return userName || participant.regId;
    }

    // Binding computing function. Returns true is participant is admin, false
    // otherwise.
    isAdmin(participant) {
      return participant.isAdmin;
    }

    // Binding computing function. Returns true is participant is a local user,
    // false otherwise.
    isLocalUser(participant) {
      const selfInfo = this.contactManager.getLocalUser();
      return selfInfo.regId === participant.regId;
    }

    // Binding computing function. Returns true if participant is in pending
    // state, false otherwise.
    isPending(participant) {
      return (participant.state === BBMEnterprise.Messenger.Participant.State.Pending);
    }

    // Binding function. Returns the event handler function to show the 
    // drop-down menu within the expander of the event target.
    toggleMenuShow() {
      return event => {
        if (event.target.matches(".bbmChatHeaderMenuExpander")
          || event.target.matches(".bbmOptionsMenuButton")) {

          event.stopPropagation();
          this.closeDropdowns();
          var expander = event.currentTarget;
          var dropdown = expander.querySelector(".bbmChatHeaderDropdown");
          if (dropdown) {
            dropdown.style.display = "grid";
          }

          var windowClickHandler = () => {
            this.closeDropdowns();
            window.removeEventListener("click", windowClickHandler);
          };

          window.addEventListener("click", windowClickHandler);
        }
      };
    }

    // Binding function. Returns event handler which changes the background
    // of the DOM element associated with the event.
    backgroundFlipper() {
      return event => {
        var element = event.currentTarget;
        
        if (element.classList.contains("bbmChatHeaderMenuExpander")) {
          if (event.type === "mouseover") {
            element.style.backgroundImage =
             "url('" + m_basePath + "img/menu_token_hover.png')";
          }
          if (event.type === "mouseout") {
            element.style.backgroundImage =
              "url('" + this.expanderImage + "')";
          }
        } else if (element.classList.contains("bbmVideoCallButton")) {
          if (event.type === "mouseover") {
            element.style.backgroundImage =
              "url('" + m_basePath + "img/video_call_hover.png')";
          }
          if (event.type === "mouseout") {
            element.style.backgroundImage =
              "url('" + this.videoCallImage + "')";
          }
        } else if (element.classList.contains("bbmVoiceCallButton")) {
          if (event.type === "mouseover") {
            element.style.backgroundImage =
              "url('" + m_basePath + "img/voice_call_hover.png')";
          }
          if (event.type === "mouseout") {
            element.style.backgroundImage =
              "url('" + this.voiceCallImage + "')";
          }
        }
        else if (element.classList.contains("bbmOptionsMenuButton")) {
          if (event.type === "mouseover") {
            element.style.backgroundImage =
              "url('" + m_basePath + "img/options_menu_hover.png')";
          }
          if (event.type === "mouseout") {
            element.style.backgroundImage =
              "url('" + this.optionsMenuImage + "')";
          }
        }
      };
    }

    // Binding computing function. Returns event handler which promotes 
    // specified chat participant to admin.
    addAsAdministrator(participant) {
      return () => {
        this.bbmMessenger.participantPromote(this.chatId, participant.regId);
      };
    }

    // Binding computing function. Returns event handler which revokes admin
    // rights from specified participant.
    removeAsAdministrator(participant) {
      return () => {
        this.bbmMessenger.participantDemote(this.chatId, participant.regId);
      };
    }

    // Binding computing function. Returns event handler which removes specified
    // chat participant from the current chat.
    removeChatParticipant(participant) {
      return () => {
        this.bbmMessenger.participantRemove(this.chatId, participant.regId);
      };
    }

    // Binding function. Controls visibility of the video call button based
    // on multiple parameters.
    getVideoCallHidden(isHasVideo, isMediaEnabled, isOneToOne) {
      return !isHasVideo || !isMediaEnabled || !isOneToOne;
    }

    // Binding function. Controls visibility of the audio call button based
    // on multiple parameters.
    getAudioCallHidden(isHasAudio, isMediaEnabled, isOneToOne) {
      return !isHasAudio || !isMediaEnabled || !isOneToOne;
    }

    // Binding computing function. Returns event handler which reinvites 
    // specified participant to the current chat.
    retryAddToChat(participant) {
      return () => {
        this.bbmMessenger.chatInvite(this.chatId, 
          [participant.regId]).then(() => {
            console.log("bbm-chat-header: resent invite to: "
              + participant.regId);
        }).catch(() => {
          console.log("bbm-chat-header: failed to send invite to: "
            + participant.regId);
        });
      };
    }

    // Binding computing function. Returns event handler which dispatches
    // "makeCall" event to notify client application that video call button
    // was pressed. Only supported for 1:1 chats.
    makeVideoCall() {
      return () => {
        const chat = this.bbmMessenger.getChat(this.chatId);
        if (chat.isOneToOne) {
          const selfInfo = this.contactManager.getLocalUser();
          const callee = chat.participants.find(participant =>
            participant.regId !== selfInfo.regId);
            if (callee) {
              this.dispatchEvent(new CustomEvent('makeCall', {
                'detail' : {
                  'regId': callee.regId,
                  'isVideo': true
                }
              }));
            }
        }
        else {
          console.log('bbm-chat-header: Failed to make video call.'
            + ' Chat is not 1:1');
        }
      };
    }

    // Binding computing function. Returns event handler which dispatches
    // "makeCall" event to notify client application that audio call button
    // was pressed. Only supported for 1:1 chats.
    makeAudioCall() {
      return () => {
        const chat = this.bbmMessenger.getChat(this.chatId);
        const selfInfo = this.contactManager.getLocalUser();
        if (chat.isOneToOne) {
          const callee = chat.participants.find(participant =>
            participant.regId !== selfInfo.regId);
            if (callee) {
              this.dispatchEvent(new CustomEvent('makeCall', {
                'detail' : {
                  'regId': callee.regId,
                  'isVideo': false
                }
              }));
            }
        }
        else {
          console.log('bbm-chat-header: Failed to make audio call.'
            + ' Chat is not 1:1');
        }
      };
    }

    // Binding computing function. Returns event handler which dispatches
    // "inviteOthers" event to notify client application that invite others
    // button was pressed.
    inviteOthers() {
      return () => {
        this.dispatchEvent(new CustomEvent('inviteOthers'));
      };
    }

    // Binding computing function. Returns event handler which leaves the
    // current chat.
    leaveChat() {
      return () => {
        this.bbmMessenger.chatLeave(this.chatId).then(() => {
          console.log("bbm-chat-header: left the chat");
        });
      };
    }

    // Returns the name of the custom element
    static get is() {return "bbm-chat-header";}
  }

  customElements.define(BbmChatHeader.is, BbmChatHeader);
})(window, document);

//***************************************************************************

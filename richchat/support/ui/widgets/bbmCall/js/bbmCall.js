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
  const widgetURI = (document._currentScript || document.currentScript).src;
  const m_basePath = widgetURI.substring(0, widgetURI.lastIndexOf('/js') + 1);

  const IMG_EXPAND_URL = `url('${m_basePath}img/expand.png')`;
  const IMG_COLLAPSE_URL = `url('${m_basePath}img/collapse.png')`;
  const IMG_MAXIMIZE_URL = `url('${m_basePath}img/maximize.png')`;
  const IMG_MINIMIZE_URL = `url('${m_basePath}img/minimize.png')`;
  const IMG_VIDEO_ACCEPT = `url('${m_basePath}img/video_acceptcall.png')`;
  const IMG_VIDEO_ACCEPT_PRESSED = `url('${m_basePath}img/video_acceptcall_pressed.png')`;
  const IMG_MUTE = `url('${m_basePath}img/mute.png')`;
  const IMG_MUTE_ON = `url('${m_basePath}img/mute_on.png')`;
  const IMG_VIDEO = `url('${m_basePath}img/video.png')`;
  const IMG_VIDEO_ON = `url('${m_basePath}img/video_on_button.png')`;
  const IMG_VIDEO_OFF = `url('${m_basePath}img/video_off_button.png')`;
  const IMG_VIDEO_PRESSED = `url('${m_basePath}img/video_pressed.png')`;
  const IMG_VOICE_ACCEPT_CALL = `url('${m_basePath}img/voice_acceptcall.png')`;
  const IMG_VOICE_ACCEPT_CALL_PRESSED = `url('${m_basePath}img/voice_acceptcall_pressed.png')`;
  const IMG_VOICE_END_CALL = `url('${m_basePath}img/voice_endcall.png')`;
  const IMG_VOICE_END_CALL_PRESSED = `url('${m_basePath}img/voice_endcall_pressed.png')`;
  const IMG_AVATAR_DEFAULT = `${m_basePath}img/default_contact.png`;

  /**
   * Call Ended event.
   * Fired when current call is disconnected.
   * @event BbmCall#CallEnded
   * @type {object}
   * 
   * @memberof Support.Widgets
   */

  /**
   * bbm-call element class implementation
   * 
   * bbm-call is a custom element that allows user to initiate / receive audio
   * and video calls.
   * 
   * A new instance of the bbm-call widget must be instantiated for each
   * instance of a media call created. The media call is assigned to the
   * bbm-call widget when makeCall() and receiveCall() are invoked by the
   * application. Each new call must be handled by a new instance of the
   * bbm-call widget.
   * 
   * bbm-call fires following event:
   * @fires BbmCall#CallEnded when current call is disconnected.
   * 
   * @memberof Support.Widgets
   */
  class BbmCall extends Polymer.Element {
    constructor() {
      super();
      // Instance of User Manager (for example: FirebaseUserManager)
      this._contactManager = null;
      // Instance of BBMEnterprise.
      this._bbmSdk = null;
      // Timer which updates the connected call duration every second.
      this._durationInterval = null;
      // Flag indicates that the call was initiated.
      this._isInitiated = false;
      // Flag indicates that the initiated call was aborted.
      this._isAborted = false;
      // Logging functions.
      this.logInfo = message => console.log(`bbm-call: ${message}`);
      this.logWarn = message => console.warn(`bbm-call: ${message}`);
      this.logError = message => console.error(`bbm-call: ${message}`);
      // Updates the call party name and avatar when it is changed.
      this.onUserChanged = userInfo => {
        if (this.mediaCall) {
          if (userInfo.regId === this.mediaCall.callParty.regId) {
            if (userInfo.displayName) {
              this.callPartyDisplayName = userInfo.displayName;
            }
            if (userInfo.avatarUrl) {
              this.callPartyAvatar = userInfo.avatarUrl;
            }
          }
        }
      };
      // Converts milliseconds into readable format: HH:MM:SS.
       this.msToTime = duration => {
        var hours = parseInt((duration / (1000 * 60 * 60)));
        var minutes = parseInt((duration / (1000*60)) % 60);
        var seconds = parseInt((duration/1000) % 60);
        hours = (hours < 10) ? `0${hours}` : hours;
        minutes = (minutes < 10) ? `0${minutes}` : minutes;
        seconds = (seconds < 10) ? `0${seconds}` : seconds;
        return `${hours}:${minutes}:${seconds}`;
       };
    }

    // Defined list of properties of custom control.
    static get properties() {
      return {
        fullScreenButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          computed: 'getFullScreenButtonImage(isFullScreen)'
        },
        collapseExpandButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          computed: 'getCollapseExpandButtonImage(isCollapsed)'
        },
        answerCallWithVideoButtonImage: {
          type: String,
          readOnly: true,
          notify: true,
          value: IMG_VIDEO_ACCEPT
        },
        muteButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: IMG_MUTE
        },
        answerCallWithAudioButtonImage: {
          type: String,
          readOnly: true,
          notify: true,
          value: IMG_VOICE_ACCEPT_CALL
        },
        voiceEndCallButtonImage: {
          type: String,
          readOnly: true,
          notify: true,
          value: IMG_VOICE_END_CALL
        },
        toggleVideoButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: ''
        },
        callPartyAvatar: {
          type: String,
          readOnly: false,
          notify: true,
          value: IMG_AVATAR_DEFAULT
        },
        callPartyDisplayName: {
          type: String,
          readOnly: false,
          notify: true,
          value: ''
        },
        mediaCall: {
          type: Object,
          readOnly: false,
          notify: true,
          observer: 'mediaCallChanged'
        },
        mediaCallState: {
          type: String,
          readOnly: false,
          notify: true,
          observer: 'mediaCallStateChanged'
        },
        callStatusString: {
          type: String,
          readOnly: false,
          notify: true,
          value: ''
        },
        isCallMuted: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        isVideoButtonHidden: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        isVoiceButtonHidden: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        isMuteButtonHidden: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        isCallEndButtonHidden: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        isToggleVideoButtonHidden: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        isFullScreen: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false,
          observer: 'isFullScreenChanged'
        },
        isCollapsed: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false,
          observer: 'isCollapsedChanged'
        },
        isResizeAllowed: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        }
      };
    }
    // Voice call button handler. Answers incoming call and offers video.
    answerCallWithVideoClicked() {
      return () => {
        var remoteVideo = this.shadowRoot.querySelector('#remote_video');
        var myVideo = this.shadowRoot.querySelector('#my_video');
        var callOptions =
          new BBMEnterprise.Media.CallOptions(true, remoteVideo, myVideo);
        this.mediaCall.answer(callOptions);
      };
    }

    // Voice call button handler. Answers incoming call and doesn't offer video.
    answerCallWithAudioClicked() {
      return () => {
        var remoteVideo = this.shadowRoot.querySelector('#remote_video');
        var myVideo = this.shadowRoot.querySelector('#my_video');
        var callOptions = 
          new BBMEnterprise.Media.CallOptions(false, remoteVideo, myVideo);
        this.mediaCall.answer(callOptions);
      };
    }

    // Mute button click handler. Toggles the mute for the current video / audio
    // call.
    muteButtonClicked() {
      return () => {
        if (!this.mediaCall) {
          return;
        }
        this.isCallMuted = !this.isCallMuted;
        this.mediaCall.mute(this.isCallMuted);

        if (this.isCallMuted) {
          this.muteButtonImage = IMG_MUTE_ON;
        }
        else {
          this.muteButtonImage = IMG_MUTE;
        }
      };
    }

    // End call button click handler. Ends current video / audio call.
    endCallButtonClicked() {
      return () => {
        if (!this.mediaCall) {
          this._isAborted = true;
          this.setContactManager(null);
          this.dispatchEvent(new Event('CallEnded'));
          return;
        }
        if (this.mediaCallState ===
          BBMEnterprise.Media.CallState.CALL_STATE_RINGING
         || this.mediaCallState ===
          BBMEnterprise.Media.CallState.CALL_STATE_INITIATED) {
          // Reject incoming ringing call.
          if (!this.mediaCall.outgoing()) {
            this.mediaCall.reject(BBMEnterprise.Media.CallEndReason.REJECT_CALL);
            return;
          }
        }
        // End call.
        this.mediaCall.end();
      };
    }

    // Toggle video button click handler. Enables / disables local video stream.
    toggleVideoButtonClicked() {
      return () => {
        if (!this.mediaCall) {
          return;
        }
        let isVideo = this.mediaCall.localMedia().video;
        this.mediaCall.video(!isVideo).then(() => {
          this.toggleVideoButtonImage = this.mediaCall.localMedia().video
            ? IMG_VIDEO_ON
            : IMG_VIDEO_OFF;
        });
      };
    }

    // Full screen button click handler. When toggling the widget into full
    // screen mode, the size of the bbm-call widget will be updated to match the
    // screen. When toggling the widget away from full screen mode, the widget
    // will revert to its original size.
    onFullScreenButtonClicked() {
      return () => {
        this.isFullScreen = !this.isFullScreen;
      };
    }

    // Expand / collapse button click handler. When toggling the widget into
    // collapsed mode, the height of the bbm-call widget will be reduced to
    // 90px. When toggling the widget away from collapsed mode, the widget
    // will revert to its original size.
    onExpandCollapsedButtonClicked() {
      return () => {
        this.isCollapsed = !this.isCollapsed;
      };
    }

    /**
     * Function handles incoming call.
     * @param {object} mediaCall Call to be handled.
     */
    receiveCall(mediaCall) {
      if (this._isInitiated) {
        throw new Error('Failed to receive the call. '
          + 'Another call is in progress.');
      }
      this._isInitiated = true;
      const callerRegId = mediaCall.callParty.regId;
      const contactAvatar = this._contactManager.getUserAvatar(callerRegId);
      const contactName = this._contactManager.getDisplayName(callerRegId);
      this.callPartyAvatar = contactAvatar || IMG_AVATAR_DEFAULT;
      this.callPartyDisplayName = contactName || '';
      this.mediaCall = mediaCall;
      this.mediaCall.accept()
      .catch(error => {
        this.logError(`Failed to receive call: ${error}`);
      });
    }

    /**
     * Function initiates a video / audio call with the specified contact.
     * @param {string} calleeRegId RedId of the contact to call.
     * @param {boolean} isVideo True for a video call. False for a voice call.
     */
    makeCall(calleeRegId, isVideo) {
      if (this._isInitiated) {
        throw new Error('Failed to make the call. '
          + 'Another call is in progress.');
      }
      this._isInitiated = true;
      const contactAvatar = this._contactManager.getUserAvatar(calleeRegId);
      const contactName = this._contactManager.getDisplayName(calleeRegId);
      this.callPartyAvatar = contactAvatar || IMG_AVATAR_DEFAULT;
      this.callPartyDisplayName = contactName || '';
      var remoteVideo = this.shadowRoot.querySelector('#remote_video');
      var myVideo = this.shadowRoot.querySelector('#my_video');
      this._bbmSdk.media.makeCall(
        new BBMEnterprise.Media.Callee(calleeRegId),
        new BBMEnterprise.Media.CallOptions(isVideo, remoteVideo, myVideo))
      .then(mediaCall => {
        if (this._isAborted) {
          mediaCall.end();
          return;
        }
        this.mediaCall = mediaCall;
      })
      .catch(error => {
        this.logError(`Failed to make call: ${error}`);
      });
    }

    /**
     * Sets instance of contactManager. The contactManager is used for
     * rendering contact information.
     * @param {object} value The contact manager instance.
     */
    setContactManager(value) {
      if (this._contactManager) {
        this._contactManager.removeEventListener('user_changed',
          this.onUserChanged);
      }

      this._contactManager = value;

      if (value) {
        this._contactManager.addEventListener('user_changed',
          this.onUserChanged);
      }
    }

    /**
     * Sets instance of BBMEnterprise
     * @param {BBMEnterprise} value
     * Instance of BBMEnterprise
     * @throws {Error} When parameter is not an instance of BBMEnterprise
     */
    setBbmSdk(value) {
      if (value && !(value instanceof BBMEnterprise)) {
        throw new Error('Value must be an instance of BBMEnterprise.');
      }
      if (!value.media) {
        throw new Error('Instance of BBMEnterprise does not have media.');
      }
      this._bbmSdk = value;
    }

    // Observer function. Observes current mediaCall. Subscribes to the new
    // media call events.
    mediaCallChanged (newMediaCall, oldMediaCall) {
      const onCallStateChanged = callSession => {
        this.mediaCallState = callSession.state();
      };

      if (oldMediaCall) {
        oldMediaCall.removeListener('ringing', onCallStateChanged);
        oldMediaCall.removeListener('connecting', onCallStateChanged);
        oldMediaCall.removeListener('connected', onCallStateChanged);
        oldMediaCall.removeListener('disconnected', onCallStateChanged);
        if (this._durationInterval) {
          clearInterval(this._durationInterval);
          this._durationInterval = null;
        }
      }

      if (newMediaCall) {
        newMediaCall.on('ringing', callSession =>
          onCallStateChanged(callSession));
        newMediaCall.on('connecting', callSession =>
          onCallStateChanged(callSession));
        newMediaCall.on('connected', callSession =>
          onCallStateChanged(callSession));
        newMediaCall.on('disconnected', callSession =>
          onCallStateChanged(callSession));
        this.mediaCallState = newMediaCall.state();
      }
    }

    // Observes media call state of the current call. Sets UI elements
    // properties according to media call state.
    mediaCallStateChanged(callState) {
      switch (callState) {
        case BBMEnterprise.Media.CallState.CALL_STATE_INITIATED:
        if (this.mediaCall.outgoing()) {
          this.isCallEndButtonHidden = false;
        }
        break;
        case BBMEnterprise.Media.CallState.CALL_STATE_RINGING:
          if (this.mediaCall.outgoing()) {
            this.callStatusString = `Calling to ${this.callPartyDisplayName}`;
            this.isVideoButtonHidden = true;
            this.isVoiceButtonHidden = true;
            this.isMuteButtonHidden = true;
            this.isToggleVideoButtonHidden = true;
            this.isCallEndButtonHidden = false;
          }
          else {
            this.callStatusString = `Call from ${this.callPartyDisplayName}`;
            this.isVideoButtonHidden = !(this.mediaCall.remoteMedia().video);
            this.isVoiceButtonHidden = false;
            this.isMuteButtonHidden = true;
            this.isToggleVideoButtonHidden = true;
            this.isCallEndButtonHidden = false;
          }
        break;
        case BBMEnterprise.Media.CallState.CALL_STATE_CONNECTING:
          this.callStatusString = `Connecting to ${this.callPartyDisplayName}`;
        break;
        case BBMEnterprise.Media.CallState.CALL_STATE_CONNECTED:
        {
          const duration = this.mediaCall.getDuration();
          this.callStatusString =
            `BBM Enterprise Call: ${this.msToTime(duration)}`;
          this.isVideoButtonHidden = true;
          this.isVoiceButtonHidden = true;
          this.isMuteButtonHidden = false;
          this.isCallEndButtonHidden = false;
          this.isToggleVideoButtonHidden = false;
          this.toggleVideoButtonImage =
            this.mediaCall.localMedia().video ? IMG_VIDEO_ON : IMG_VIDEO_OFF;
          this._durationInterval = setInterval(() => {
            if (this.mediaCall) {
              const duration = this.mediaCall.getDuration();
              this.callStatusString =
                `BBM Enterprise Call: ${this.msToTime(duration)}`;
            }
          }, 1000);
          break;
        }
        case BBMEnterprise.Media.CallState.CALL_STATE_DISCONNECTED:
          this.callStatusString = '';
          if (this._durationInterval) {
            clearInterval(this._durationInterval);
            this._durationInterval = null;
          }
          // Assign mediaCall to unsubscribe from mediaCall events.
          this.mediaCall = null;
          this.setContactManager(null);
          this.dispatchEvent(new Event('CallEnded'));
        break;
        default:
          this.log(`Unknown call state: ${callState}`);
        break;
      }
    }

    // Sets 'full screen' button image according to current bbm-call widget size
    getFullScreenButtonImage(isFullScreen) {
      return isFullScreen ? IMG_MINIMIZE_URL : IMG_MAXIMIZE_URL;
    }

    // Sets 'collapse / expand' button image according to current bbm-call 
    // widget state
    getCollapseExpandButtonImage(isCollapsed) {
      return isCollapsed ? IMG_EXPAND_URL : IMG_COLLAPSE_URL;
    }

    // Monitors if widget is in full screen mode. Changes the size of the widget
    // based on the mode.
    isFullScreenChanged(isFullScreen) {
      if (!isFullScreen) {
        this.style.top = '100px';
        this.style.height = '300px';
        this.style.width = '400px';
        this.style.left = 'calc(100% - 420px)';
        this.style.left = '-webkit-calc(100% - 420px)';
      }
      else {
        this.style.top = '0px';
        this.style.left = '0px';
        this.style.height = '100%';
        this.style.width = 'calc(100% - 20px)';
        this.style.width = '-webkit-calc(100% - 20px)';
      }
    }

    // Monitors if widget is in collapsed mode. Changes the height of the widget
    // based on the mode.
    isCollapsedChanged(isCollapsed) {
      if (!isCollapsed) {
        this.style.height = '300px';
      }
      else {
        this.style.height = '90px';
      }
    }

    // Hides the widget body section if widget is in collapsed mode.
    getCallBodyDisplay(isCollapsed) {
      return isCollapsed ? 'none' : 'flex';
    }

    // Hides the collapse/expand button based on the parameters.
    getCollapseExpandBtnHidden(isFullScreen, isResizeAllowed) {
      return isFullScreen || !isResizeAllowed;
    }

    // Hides the full screen button based on the parameters.
    getFullScreenBtnHidden(isCollapsed, isResizeAllowed) {
      return isCollapsed || !isResizeAllowed;
    }

    // Returns the name of the custom element.
    static get is() { return 'bbm-call'; }
  }
  customElements.define(BbmCall.is, BbmCall);
})(window, document);

//****************************************************************************

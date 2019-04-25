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
  var widgetURI = (document._currentScript || document.currentScript).src;
  var m_basePath = widgetURI.substring(0, widgetURI.lastIndexOf("/js") + 1);

  // The observable object used by Observer class from the SDK to monitor a
  // message.
  var MessageObservable = function Observable(messenger, chatId, messageId) {
    return {
      then: (callback) => {
        this.callback = callback;
        messenger
          .chatMessageWatch(chatId, messageId, callback);
      },
      unwatch: () => {
        messenger
          .chatMessageUnwatch(chatId, messageId, this.callback);
      }
    };
  };

  const IMG_CHEVRON = "img/bubble_menu.png";
  const IMG_HIGHPRIORITY = "img/ic_msg_priority_bubble.png";
  const IMG_EDIT = "img/edit.png";

  const IMG_FILE_TYPE_MUSIC = "filetype_music.png";
  const IMG_FILE_TYPE_VIDEO = "filetype_video.png";
  const IMG_FILE_TYPE_DOC = "filetype_doc.png";
  const IMG_FILE_TYPE_XLS = "filetype_xls.png";
  const IMG_FILE_TYPE_PPT = "filetype_ppt.png";
  const IMG_FILE_TYPE_PDF = "filetype_pdf.png";
  const IMG_FILE_TYPE_CALENDAR = "filetype_cal.png";
  const IMG_FILE_TYPE_VCF = "filetype_vcf.png";
  const IMG_FILE_TYPE_VOICENOTE = "filetype_voicenote.png";
  const IMG_FILE_TYPE_PIC = "filetype_pic.png";
  const IMG_FILE_TYPE_GENERIC = "filetype_generic.png";

  //String that identifies what type of reference it is
  const REFERENCE_TAG_EDIT = "Edit";
  const REFERENCE_TAG_QUOTE = "Quote";

  const REFERENCE_MESSAGE_STRING_WROTE = " wrote: ";

  //String is displayed on the field of message reference
  //when a message is being edited
  const REFERENCE_EDIT_FIELD_TEXT = "Editing: ";

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
    class BbmRichChatMessageList extends Polymer.Element {
      static get is() {
        return 'bbm-rich-chat-message-list';
      }

      ready() {
        super.ready();
        this.$.list.setMappingFunction(this.render.bind(this),
                                       this.clear.bind(this));
      }

      // Defined list of properties of custom control
      static get properties() {
        return {
          // Holds the currently selected message
          selectedMessage: {
            type: Object,
            readOnly: false,
            notify: true
          }
        };
      }

      /**
       * Sets instance of bbmMessenger
       * @param {BBMEnterprise.Messenger} messenger
       *   The messenger to use to retrieve a chat's message list.
       */
      setBbmMessenger(messenger) {
        this.bbmMessenger = messenger;
        this.$.list.setBbmMessenger(messenger);

        var bbmChatMessageStateList 
            = this.shadowRoot.querySelector("#bbmChatMessageStateList");
        bbmChatMessageStateList.setBbmMessenger(messenger);
      }

      /**
       * Sets current chat id
       * @param {String} chatId - Current chat id
       */
      setChatId(chatId) {
        this.chatId = chatId;
        this.$.list.setChatId(chatId);
      }

      /**
       * Sets instance of contactManager. The contactManager is used for
       * rendering contact information in bubbles.
       *
       * @param {object} value
       *   The contact manager used to display information about contacts in
       *   bubbles.
       */
      setContactManager(value) {
        this.contactManager = value;
        const bbmChatMessageStateList
          = this.shadowRoot.querySelector("#bbmChatMessageStateList");
        bbmChatMessageStateList.setContactManager(value);
      }

      /**
       * Sets the time range formatter. The time range formatter is used for
       * displaying time stamps relative to the current time.
       *
       * @param {object} value
       *   The time range formatter used to display relative timestamps in
       *   bubbles.
       */
      setTimeRangeFormatter(value) {
        this.timeRangeFormatter = value;
      }

      /**
       * Sets the message formatter. The message formatter is used to format
       * the content of messages for display.
       *
       * @param {object} value
       *   The message formatter used to display information about the message.
       */
      setMessageFormatter(value) {
        this.messageFormatter = value;
      }

      /**
       * Get the image to display for a message chevron
       *
       * @returns {string} Path to the image.
       */
      getChevronImage() {
        return m_basePath + IMG_CHEVRON;
      }

      /**
       * Scrolls the list to the bottom
       */
      scrollToBottom() {
        this.$.list.scrollToBottom();
      }

      /**
       * Trigger a chevron's dropdown menu to be displayed.
       *
       * @param {Event} event
       *   The mouse press event which triggers the dropdown to be displayed.
       */
      showChevronDropdown(event) {
        var element = this.shadowRoot.querySelector('.chevronDropdown');

        this.selectedMessage =  event.model.message;

        //Sets the position to display the menu button dropdown list just below
        //the chevron button. At this point, we can know the offsetHeight of the
        //dropdown list.
        element.setAttribute(
          "style","display: grid; position: fixed; z-index: 1; top: " 
          + event.y + "px; left: " + event.x + "px;");

        //Adjusts the position of the dropdown list to move it above the chevron
        //button if it is cut by the bottom of the browser.
        if( (window.innerHeight - event.y) < element.offsetHeight) {
          element.setAttribute(
          "style","display: grid; position: fixed; z-index: 1; top: " 
          + (event.y -  element.offsetHeight) + "px; left: " + event.x + "px;");
        }

        event.stopPropagation();

        var windowClickHandler = () => {
          this.closeDropdowns();
          window.removeEventListener('click', windowClickHandler);
        };

        window.addEventListener('click', windowClickHandler);
      }

      /**
       * Close all dropdown menus associated with the message list.
       */
      closeDropdowns() {
        var dropdowns = this.shadowRoot.querySelectorAll('.chevronDropdown');
        dropdowns.forEach(item => {
          if (item.style.display !== 'none') {
            item.style.display = 'none';
          }
        });

        // Now that the dropdown is closed, hide chevrons too, if required.
        var chevrons = this.shadowRoot.querySelectorAll('.chevron');
        chevrons.forEach(item => {
          if (item.needsToHide) {
            item.style.display = 'none';
            item.needsToHide = false;
          }
        });
      }

      /**
       * check if a menu button needs to be displayed for a message
       *
       * @param {BBMEnterprise.Messenger.ChatMessage} selectedMessage 
       *  The selected ChatMessage that the menu button belongs to
       *
       * @returns {string} 'none' to display the button, or 'block' to
       *  hide the button
       */
      isMenuButtonDisplayed(selectedMessage) {
        return selectedMessage && selectedMessage.message.isIncoming
          ? 'none' : 'block';
      }

      /**
       * Retract a message.
       *
       * @param {Event} event
       *   The mouse event which triggers the retraction.
       */
      retractMessage(event) {
        event.stopPropagation();
        if (this.selectedMessage) {
          const messageId = this.selectedMessage.message.messageId;
          this.bbmMessenger.chatMessageDestroy(this.chatId, messageId);
        }
        this.closeDropdowns();
      }

      /**
       * Delete a message.
       *
       * @param {Event} event
       *   The mouse event which triggers the deletion.
       */
      deleteMessage(event) {
        event.stopPropagation();
        if(this.selectedMessage) {
          var messageId = this.selectedMessage.message.messageId;
          this.bbmMessenger.chatMessageDelete(this.chatId, messageId);
        }
        this.closeDropdowns();
      }

      /**
       * Dispatch an event of quoting the selected message.
       */
      quoteMessage() {
        this.dispatchEvent(new CustomEvent('messageReference', 
          {'detail': { targetMessageId:  this.selectedMessage.message.messageId, 
            refTag: REFERENCE_TAG_QUOTE,
        content: '"' + this.selectedMessage.content + '"',
        textMessage: ""}}));
      }

      /**
       * Dispatch an event of editing the selected message.
       */
      editMessage() {
        this.dispatchEvent(new CustomEvent('messageReference', 
             {'detail': { targetMessageId: this.selectedMessage.message.messageId,
              refTag: REFERENCE_TAG_EDIT,
          content: REFERENCE_EDIT_FIELD_TEXT + this.selectedMessage.content,
          textMessage: this.selectedMessage.content}}));
      }

      // Get the username for a registration ID. If there is a name registered
      // for the user, it will be used. Otherwise, the registration ID in string
      // form will be used.
      getUserName(regId) {
        var contactName = this.contactManager.getDisplayName(regId);
        return contactName ? contactName : regId.toString();
      }

      // Get the timestamp for a message in string form, using the time range
      // formatter registered with this widget.
      getTimestamp(message) {
        let ret =
          {
            formattedTime: ''
          };

        if (this.timeRangeFormatter) {
          var now = new Date();
          var formattedMessage = this.timeRangeFormatter.format(
            this.timeRangeFormatter.chatBubbleFormatters,
            message.timestamp,
            now);

          // Construct a return value. It definitely has a time.
          ret.formattedTime = formattedMessage.formattedTime;

          // It may also have a timeout, after which the time should be updated.
          if (formattedMessage.expiresIn) {
            ret.expiryTimer = setTimeout(
              () => this.refresh(message),
              formattedMessage.expiresIn.getTime() - now.getTime()
            );
          }
        }

        return ret;
      }

      /**
       * Check if the message is an edited message
       *
       * @param {ChatMessage} message
       *   The ChatMessage which has the reference tag for "Edit".
       * @return {Boolean} True if the message is an edited message,
       *   otherwise False 
       */
      isEdited(message) {
        //Check the message has an "Edit" reference tag
        if(message.refBy) {
          for(var i=0; i < message.refBy.length; i++) {
            if(message.refBy[i].tag === REFERENCE_TAG_EDIT) {
              return true;
            }
          }
        }

        return false;
      }

      /**
       * Check if the UI elements for a quoted message need to be displayed
       *
       * @param {ChatMessage} message
       *   The ChatMessage which has the reference tag for "Quote".
       * @return {string} 'flex' to display the UI elements for quoted message 
          or 'none' to hide it
       */
      isQuoted(message) {
        return message.ref && message.ref[0] && message.ref[0].tag 
          === REFERENCE_TAG_QUOTE ? 'flex' : 'none';
      }

      // Cause a message to refresh. This should be invoked when something
      // outside of message data causes a bubble to need to be refreshed.
      refresh(message) {
        // Upon timeout, find the message, re-render, and splice it back
        // in. First find the message and make sure it's still in the
        // list.
        const index = this.$.list.$.list.items.findIndex((element) =>
          element.message === message
        );

        if (index >= 0) {
          const formattedMessage = this.$.list.$.list.items[index];

          // Rerender based on the appData, which is assumed to have been
          // updated already by whatever triggered the refresh.
          const reRendered = this.format(message, formattedMessage.appData);

          // And splice it in.
          this.$.list.$.list.splice('items', index, 1, reRendered);
        }
      }

      render(message) {
        // Make a spot for data that belongs to the app, rather than the sdk.
        const appData = {
          // Initialize the download list to be empty.
          fileDownloads: [],
          quotedMessageTracker: undefined,
          editedMessageTracker: undefined
        };

        appData.onUserChanged = userInfo => {
          appData.avatarUrl = userInfo.avatarUrl;
          appData.displayName = userInfo.displayName;
          this.refresh(message);
        };

        appData.avatarUrl = this.messageFormatter.getMessageAvatar(message);
        appData.displayName = this.messageFormatter.getUserName(message);

        this.contactManager.addEventListener('user_changed',
          appData.onUserChanged);

        // Format the original message data for display.
        return this.format(message, appData);
      }

      // Construct the data needed to display a message.
      // @param {ChatMessage} message
      // The message from the BBM Enterprise SDK for JavaScript.
      // @returns {object} The data needed by the template used for this message
      // list, defined in the html file.
      format(message, appData) {
        var isStatus = this.messageFormatter.getIsStatusMessage(message);
        var isFile = false;
        var isPicture = false;
        var isText = false;
        var hasCaption = false;

        if(this.messageFormatter.getIsPictureMessage(message)) {
          isPicture = true;
          hasCaption = message.content && message.content.length > 0;
        } else if(this.messageFormatter.getIsFileMessage(message)) {
          isFile = true;
          hasCaption = message.content && message.content.length > 0;
        } else if(!isStatus) {
          isText = true;
        }

        var ret = {
          // This is the original SDK data.
          message: message,
          // This is the original app data.
          appData: appData,
          // The rest is the formatted data. This is all build out of the first
          // two.
          isStatus: isStatus ? 'block' : 'none',
          isBubble: isStatus ? 'none' : 'flex',
          isPicture: isPicture ? 'block' : 'none',
          isFile: isFile ? 'block' : 'none',
          isText: isText ? 'flex' : 'none',
          hasCaption: hasCaption ? 'block' : 'none',
          isIncoming: message.isIncoming ? 'block' : 'none',
          isOutgoing: message.isIncoming ? 'none' : 'block',
          avatar: appData.avatarUrl,
          username: appData.displayName,
          timestamp: this.getTimestamp(message),
          stateImage: this.messageFormatter.getMessageStateImage(message),
          backgroundColor: message.isIncoming ? '#efefef' : '#cee2eb',
          indent: message.isIncoming ? '15px' : '105px',
          content: this.messageFormatter.getMessageText(message),
          isHighPriority: (message.data && message.data.priority === 'High') 
            ? 'block' : 'none',
          isHighPriorityRed: (message.data && message.data.priority === 'High') 
            ? '20px solid red' : '0px',
          highPriorityImage: m_basePath + IMG_HIGHPRIORITY,
          fileTypeUrl: '',
          isHidden: message.isDeleted 
            || (!message.isIncoming && message.isRecalled)
            || (message.ref && message.ref[0]
              && message.ref[0].tag === REFERENCE_TAG_EDIT)
            ? 'none': 'block',
          editImage: m_basePath + IMG_EDIT,
          isEdited: this.isEdited(message) ? 'flex' : 'none',
          isQuoted: this.isQuoted(message)
        };

        if(this.messageFormatter.getIsPictureMessage(message)) {
          if (message.thumbData) {
            // The thumbnails generated by bbmChatInput are always jpeg, as are
            // the thumbnails generated by the supportare on other platforms. To
            // change this, the change must be done simultaneously here, in
            // bbmChatInput, and in the equivalent code for any other platforms
            // being used.
            var blob = new Blob(
              [message.thumbData], {
                type: 'image/jpeg'
              }
            );
            ret.pictureUrl = URL.createObjectURL(blob);
          } else {
            ret.pictureUrl = m_basePath + 'img/filetypes/' + IMG_FILE_TYPE_PIC;
          }
        } else if(this.messageFormatter.getIsFileMessage(message)) {
          ret.fileTypeUrl = m_basePath + 'img/filetypes/' +
            getImageForFile(message.fileName);
          ret.suggestedFileName = message.fileName;
          if(message.fileSize) {
            ret.fileSize = bytesToSize(message.fileSize);
          } else {
            ret.fileSize = 'Unknown size';
          }
        }

        // Make sure the message state list of the outgoing message for MPC is
        // closed during the rendering because the opened list might have
        // outdated info when the message is updated.
        if(!message.isOneToOne && !message.isIncoming) {
          this.closeMessageStateList();
        }

        // Add in any download progress bars.
        if(appData.fileDownloads.length) {
          ret.downloads = [];
          for(let progress of appData.fileDownloads) {
            ret.downloads.push({
              downloaded: bytesToSize(progress.downloaded),
              downloadedBytes: progress.downloaded,
              totalBytes: progress.total
            });
          }
        }

        //For message references
        if(message.ref || message.refBy) {
          //For quoted message
          if(message.ref && message.ref[0] 
              && message.ref[0].tag === REFERENCE_TAG_QUOTE) {
            this.formatQuotedMessage(message.ref[0].messageId, ret);
          }

          //For edited message
          var latestEditedMessageId = this.getLatestEditedMessageId(message);
          if(latestEditedMessageId) {
            this.formatEditedMessage(latestEditedMessageId, ret, false); 
          }
        }
        
        return ret;
      }

      // Construct the data needed to display a quoted message.
      // @param {Object} messageId 
      //  the MessageId object of the quoted message
      // @param {Object} ret
      //  the wrapper of the data to display the quoted message
      formatQuotedMessage(messageId, ret) {
        var formatter = this.messageFormatter;

        var targetMessage;

        if(ret.appData.quotedMessageTracker) {
          ret.appData.quotedMessageTracker.clear();
        }

        ret.appData.quotedMessageTracker 
          = Observer.getObserverContext((getter) => {
          var observable = new MessageObservable(this.$.list.messenger,
              this.chatId, messageId);
          //observe the message.
          getter.observe(observable, (getter, message) => {
            //Check if the target message has also been edited
            var latestEditedMessageId = this.getLatestEditedMessageId(message);
            if(latestEditedMessageId) {
              //To get the edited content and display it
              this.formatEditedMessage(latestEditedMessageId, ret, true);     
            } else {
              var senderName = formatter.getUserName(message);
              ret.quotedContent = senderName + REFERENCE_MESSAGE_STRING_WROTE
              + '"' + message.content + '"';
            }
          });
        }, () => {
          //Callback will be called after getting the message 
          //asynchronously. Refresh the UI to render the data
          this.refresh(targetMessage);
        });
      }

      // Construct the data needed to display a edited message.
      // @param {Object} messageId 
      //  The MessageId object of the edited message
      // @param {Object} ret
      //  The wrapper of the data to display the quoted message
      // @param {Object} isAlsoQuoted
      //  True if this edited message is also quoted, otherwise False
      formatEditedMessage(messageId, ret, isAlsoQuoted) {
        var formatter = this.messageFormatter;

        if(ret.appData.editedMessageTracker) {
          ret.appData.editedMessageTracker.clear();
        }

        var refMessage;
        ret.appData.editedMessageTracker
          = Observer.getObserverContext((getter) => {
          var messageObservable
            = new MessageObservable(this.$.list.messenger,
              this.chatId, messageId);

          //observe the message.
          getter.observe(messageObservable, (getter, message) => {
            refMessage = message;
            if(isAlsoQuoted) {
              var senderName = formatter.getUserName(refMessage);
              ret.quotedContent = senderName + REFERENCE_MESSAGE_STRING_WROTE
              + '"' + refMessage.content + '"';
            } else {
              ret.content = refMessage.content;
            }
          });
        }, () => {
          //Callback will be called after getting the message 
          //asynchronously. Refresh the UI to render the data
          this.refresh(refMessage);
        }); 
      }

      //Get the Id of the latest message which references to the target message.
      //@param {ChatMessage}
      //  the target message 
      //@return {MessageId}
      //  the id of the latest message which references to the target message.
      getLatestEditedMessageId(message) {
        if(message.refBy) {
          for(var i=0; i < message.refBy.length; i++) {
            if(message.refBy[i].tag === REFERENCE_TAG_EDIT 
              && message.refBy[i].messageIds.length > 0) {
               return message.refBy[i]
                .messageIds[message.refBy[i].messageIds.length - 1];
            }
          }
        }
        return undefined;
      }

      /**
       * Clear the data associated with a message. This should be called when
       * a message is about to be deleted, and cleans up temporary data created
       * by formatting the message.
       */
      clear(message) {
        if (message.timestamp.expiryTimer) {
          clearTimeout(message.timestamp.expiryTimer);
        }
        if (this.contactManager) {
          this.contactManager.removeEventListener('user_changed',
            message.appData.onUserChanged);
        }
      }

      /**
       * Show the chevron when hovering over a message bubble.
       *
       * @param {Event} event
       *   The mouse enter event which triggers the show
       */
      showChevron(event) {
        var element = event.target.querySelector('.chevron');
        element.style.display='block';
      }

      /**
       * Hide the chevron when ending a hover over a message bubble. Don't hide
       * it if the menu is open.
       *
       * @param {Event} event
       *   The mouse leave event which triggers the hide
       */
      hideChevron(event) {
        var chevron = event.target.querySelector('.chevron');
        var dropdown = this.shadowRoot.querySelector('.chevronDropdown');
        if(dropdown.style.display !== 'flex') {
          // Hide the chevron.
          chevron.style.display='none';
          chevron.needsToHide = false;
        } else {
          // We have to mark that the chevron should be hidden, but not actually
          // hide it.
          chevron.needsToHide = true;
        }
      }

      /**
       * Callback function for the selected file transfer message bubble icon
       * in a chat. This will download then attempt to display the selected
       * chat message file transferred in a new window.
       *
       * @param {object} event - The mouse press event.
       */
      fileClick(event) {
        var message = event.model.message.message;

        if (message.download) {
          var progress = {downloaded: 0};

          // Add a progress bar to the message.
          event.model.message.appData.fileDownloads.push(progress);

          // Download the file
          message.download({
            progress: (progressEvent) => {
              progress.downloaded = progressEvent.loaded;
              progress.total = progressEvent.total;
              this.refresh(event.model.message.message);
            }
          })
          .then((fileBytes) => {
            // Remove the progress bar.
            var index = event.model.message.appData.fileDownloads.indexOf(progress);

            if(index !== -1) {
              event.model.message.appData.fileDownloads.splice(index, 1);
              this.refresh(event.model.message.message);
            }

            // Look up the mime type based on the file extension.
            var type = getTypeByExtension(getFileExt(message.fileName));

            // Create a hidden link to the blob from which to download.
            var a = document.createElement("a");
            a.style = "display: none";
            document.body.appendChild(a);

            // Build a blob from the data and mime type.
            var blob = new Blob([fileBytes], {type: type});
            var url = window.URL.createObjectURL(blob);

            // Attach the blob to the link, and download it.
            a.href = url;
            a.download = message.fileName;
            a.click();

            // Remove the link and blob.
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

          })
          .catch(error => {
            console.log(
              'bbm-rich-chat-message-list: Error displaying file: ' + error);
          });
        } else {
          console.warn(
            'bbm-rich-chat-message-list: Missing message download function' +
            ' in chatId:' + event.model.message.message.chatId +
            ' messageId:' + event.model.message.message.messageId);
        }
      }

      /**
       * Callback function for clicking the message state image.
       * This will display a list of message states for an outgoing 
       * message with all chat participants.
       *
       * @param {object} event - The mouse press event.
       */
      messageStateClick(event) {
        var message = event.model.message.message;
        if(!message.isOneToOne && !message.isIncoming) {
          var bbmChatMessageStateList 
            = this.shadowRoot.querySelector("#bbmChatMessageStateList");

          bbmChatMessageStateList.chatId = event.model.message.message.chatId;
          bbmChatMessageStateList.messageId = event.model.message.message.messageId;

          // Sets the position to display the message state list
          bbmChatMessageStateList.setAttribute(
            "style","display: block; position: fixed; z-index: 1; top: " 
            + event.y + "px; left: " + event.x + "px;");

          // Closes the list if the mouse is clicked somewhere else
          var windowClickHandler = () => {
            this.closeMessageStateList();
            window.removeEventListener("click", windowClickHandler);
          };
          window.addEventListener("click", windowClickHandler);

          event.stopPropagation();
        }
      }

      /**
       * Close the list of message states
       */
      closeMessageStateList() {
        var bbmChatMessageStateList 
          = this.shadowRoot.querySelector("#bbmChatMessageStateList");

        bbmChatMessageStateList.style.display = 'none';
        bbmChatMessageStateList.chatId = "";
        bbmChatMessageStateList.messageId = "";
      }
    }

    /**
     * Get the name of an image to represent the specified file.
     * The path to the file is not included.
     * @param {String} fileName The name of the file to pick an image for.
     * @returns {String} The name of the file to display.
     */
    function getImageForFile(fileName) {
      var fileExt = getFileExt(fileName);
      var type = getTypeByExtension(fileExt);
      switch (type) {
        case "Audio": return IMG_FILE_TYPE_MUSIC;
        case "Video": return IMG_FILE_TYPE_VIDEO;
        case "MsWord": return IMG_FILE_TYPE_DOC;
        case "MsExcel": return IMG_FILE_TYPE_XLS;
        case "MsPowerPoint": return IMG_FILE_TYPE_PPT;
        case "AdobeReader": return IMG_FILE_TYPE_PDF;
        case "Calendar": return IMG_FILE_TYPE_CALENDAR;
        case "ContactCard": return IMG_FILE_TYPE_VCF;
        case "VoiceNote": return IMG_FILE_TYPE_VOICENOTE;
        case "Image": return IMG_FILE_TYPE_PIC;
        default: return IMG_FILE_TYPE_GENERIC;
      }
    }

    /**
     * Get the file type for the specified file extension.
     * @param {String} extension The file extension to get the type for
     * @returns {String} The file type or '' if not a known type
     */
    function getTypeByExtension(extension) {
      switch (extension) {
        case "doc":
        case "docx":
        case "dot":
        case "rtf":
          return "MsWord";
        case "xls":
        case "xlsx":
        case "xlb":
        case "xlt":
          return "MsExcel";
        case "ppt":
        case "pps":
        case "pptx":
        case "ppsx":
          return "MsPowerPoint";
        case "pdf":
          return "AdobeReader";
        case "bmp":
        case "gif":
        case "jpeg":
        case "jpg":
        case "png":
        case "svg":
        case "svgz":
          return "Image";
        case "amr":
          return "VoiceNote";
        case "mid":
        case "midi":
        case "m3u":
        case "wma":
        case "wav":
        case "mp3":
        case "ogg":
          return "Audio";
        case "3gp":
        case "3gpp":
        case "3g2":
        case "3gpp2":
        case "mp4":
        case "mpg":
        case "mpeg":
        case "qt":
        case "mov":
        case "wmv":
        case "avi":
          return "Video";
        case "html":
        case "xhtml":
        case "txt":
        case "xml":
          return "Text";
        case "vcf":
          return "ContactCard";
        case "vcs":
          return "Calendar";
        default:
          return "";
      }
    }

    /**
     * Get the file extension if any from the file name.
     * This just returns the part of the string following the last '.' character
     * or '' if none are found.
     * @param {string} fileName - the fileName to find the extension in
     * Returns {string} - the file extension or ''
     */
    function getFileExt(fileName) {
      if (fileName) {
        var dot = fileName.lastIndexOf('.');
        if (dot >= 0) {
          return fileName.substr(dot + 1).toLowerCase();
        }
      }
      return "";
    }

    /**
     * Utility function to convert a given number of bytes to
     * the most convenient human-readable unit (Bytes, KB, MB, GB, TB)
     * for display. The largest whole unit is automatically selected.
     *
     * @param {Number} bytes
     *    The bytes number to be converted to the appropriate
     *    unit for display
     *
     * @return {string}
     *    The text representing the size converted from bytes
     *
     * @private
     */
    function bytesToSize(bytes) {
      if (bytes == 0) return '0 Bytes';
      var kb = 1024,
        decimals = 2,
        units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(kb));
      if (i >= units.length) {
        i = units.length - 1;
      }
      return parseFloat((bytes / Math.pow(kb, i)).toFixed(decimals)) +
        ' ' + units[i];
    }

    window.customElements.define(BbmRichChatMessageList.is,
                                 BbmRichChatMessageList);
  });
})(window, document);

//****************************************************************************

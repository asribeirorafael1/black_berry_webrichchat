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

  // String is bbmInput textarea placeholder displayed when current chat is 
  // defunct or not specified.
  const INPUT_PLACEHOLDER_DISABLED = "Chat is disabled.";
  // String is bbmInput textarea placeholder displayed when current chat is not
  // defunct (active).
  const INPUT_PLACEHOLDER_ACTIVE = "Protected. Enter a message.";
  // Time interval used to send typing notifications. While user is typing
  // every 5000 ms typing notification is sent.
  const SEND_CHAT_TYPING_INTERVAL = 5000;
  // Maximum allowed number of files to be sent at once.
  const MAX_SEND_FILE_NUMBER = 10;
  // The BBM Enterprise SDK's ChatMessageSendOptions specifies the thumb data
  // may contain no more than 56320 bytes (55 KB).
  const THUMB_MAX_SIZE = 55 * 1024;
  // This is just the starting size to scale thumbnails down to when sending.
  // This is not a fixed value, it can be tweaked as needed but with most images
  // at 80% quality it normally results in a jpeg that will fit in thumb data.
  // If needed a smaller dimension will be used to preserve the aspect ratio
  // of the original file and if the compressed image is still too large.
  const THUMB_MAX_DIMENSION_PIXELS = 500;
  // The number of attempts that can be made to reduce the compressed image size
  // when generating thumbnail data. This includes both attempts that just
  // reduced the image quality and reduced image dimensions.
  // This should be a large enough value that allows almost all images to be
  // compressed small enough for thumbnails.
  const THUMB_MAX_REDUCTION_ATTEMPTS = 10;
  // The image quality to start with when when compressing images for thumbnail
  // data.
  const THUMB_START_IMAGE_QUALITY = 0.8;
  // The minimum image quality to be used when compressing images for thumbnail
  // data. A compression of 30% or less normally results in a choppy looking 
  // thumbnail.
  const THUMB_MIN_IMAGE_QUALITY = 0.4;

  const TAG_MESSAGE_TEXT_PRIORITY_HIGH = "High";

  //String is displayed on the field of message reference
  //when a message is being edited
  const REFERENCE_EDIT_FIELD_TEXT = "Editing: ";

  //String that identifies what type of reference it is
  const REFERENCE_TAG_EDIT = "Edit";
  const REFERENCE_TAG_QUOTE = "Quote";

  // Image URLs
  const IMG_ATTACH_FILE_BUTTON_ENABLED = "img/attach_enabled.png";
  const IMG_ATTACH_FILE_BUTTON_HOVER = "img/attach_hover.png";
  const IMG_SEND_BUTTON_ENABLED = "img/send_enabled.png";
  const IMG_SEND_BUTTON_HOVER = "img/send_hover.png";
  const IMG_SEND_BUTTON_PRESSED = "img/send_pressed.png";
  const IMG_ATTACH_CANCEL_BUTTON = "img/attach_cancel_enabled.png";
  const IMG_ATTACH_CANCEL_BUTTON_HOVER = "img/attach_cancel_hover.png";
  const IMG_PRIORITY_BUTTON_ON = "img/ic_msg_priority_on.png";
  const IMG_PRIORITY_BUTTON_OFF = "img/ic_msg_priority_off.png";
  const IMG_PRIORITY_BUTTON_HOVER = "img/ic_msg_priority_hover.png";
  const IMG_PREVIEW_FILE_BUTTON = "img/file_input.png";

  /**
   * bbm-chat-input element class implementation
   * 
   * bbm-chat-input is a custom element that allows user to perform following
   * actions:
   * - Type and send text message
   * - Send single / multiple files
   * - Preview single file before sending (file name and file size)
   * 
   * bbm-chat-input sends typing notifications to current chat every 5 seconds 
   * while user is typing.
   * 
   * bbm-chat-input has the following properties:
   * - attachButtonImage {string}
   *   path to an image to use for a button to attach a file to a message.
   * - sendButtonImage {string}
   *   path to an image to use for a button to send a message.
   * - previewFileImage {string}
   *   path to an image to put next to a file that is to be sent.
   * - previewCancelButton {string}
   *   path to an image to use for a button to cancel sending of a file.
   * - isPriorityEnabled {boolean}
   *   Whether to show a button to mark a message as a priority message.
   *
   * bbm-chat-input fires following event:
   * - "errorMessage" custom event to indicate there was in user input error.
   * Client application must handle this event to display a feedback to a user 
   * in case of error.
   *
   * @memberof Support.Widgets
   */
  class BbmChatInput extends Polymer.Element {

    // Called after property values are set and local DOM is initialized
    ready() {
      super.ready();
      this.maxFileSizeString = bytesToSize(BBMEnterprise.Messenger.MaxFileSize);
      this.bbmInputFile = this.shadowRoot.querySelector("#bbmInputFile");
      this.bbmInput = this.shadowRoot.querySelector(".bbmInput");
      this.bbmFileWrapper = this.shadowRoot.querySelector("#bbmFileWrapper");

      var self = this;

      // The array for button image URLs
      this.buttonImages = {
        'bbmAttachFileButton': {
          "mouseover": "url('" + m_basePath + IMG_ATTACH_FILE_BUTTON_HOVER + "')",
          "mouseout": "url('" + m_basePath + IMG_ATTACH_FILE_BUTTON_ENABLED + "')"
        },
        'bbmSendButton': {
          "mouseover": "url('" + m_basePath + IMG_SEND_BUTTON_HOVER + "')",
          "mouseout": "url('" + m_basePath + IMG_SEND_BUTTON_ENABLED + "')",
          "mousedown": "url('" + m_basePath + IMG_SEND_BUTTON_PRESSED + "')",
          "mouseup": "url('" + m_basePath + IMG_SEND_BUTTON_HOVER + "')"
        },
        'bbmAttachCancelButton': {
          "mouseover": "url('" + m_basePath + IMG_ATTACH_CANCEL_BUTTON_HOVER + "')",
          "mouseout": "url('" + m_basePath + IMG_ATTACH_CANCEL_BUTTON + "')"
        },
        'bbmRefCancelButton': {
          "mouseover": "url('" + m_basePath + IMG_ATTACH_CANCEL_BUTTON_HOVER + "')",
          "mouseout": "url('" + m_basePath + IMG_ATTACH_CANCEL_BUTTON + "')"
        },
        'bbmPriorityButton': {
          get ["mouseover"]() { return "url('" + m_basePath
            + (self.isPriorityMessage
              ? IMG_PRIORITY_BUTTON_ON
              : IMG_PRIORITY_BUTTON_HOVER)
            + "')"; },
          get ["mouseout"]() { return "url('" + m_basePath
            + (self.isPriorityMessage
              ? IMG_PRIORITY_BUTTON_ON
              : IMG_PRIORITY_BUTTON_OFF)
            + "')"; }
        }
      };
    }

    // List of properties of the custom control
    static get properties() {
      return {
        chat: {
          type: Object,
          readOnly: false,
          notify: true
        },
        isPriorityMessage: {
          type: Boolean,
          readonly: false,
          notify: true,
          value: false
        },
        attachButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: m_basePath + IMG_ATTACH_FILE_BUTTON_ENABLED
        },
        sendButtonImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: m_basePath + IMG_SEND_BUTTON_ENABLED
        },
        previewFileImage: {
          type: String,
          readOnly: false,
          notify: true,
          value: m_basePath + IMG_PREVIEW_FILE_BUTTON
        },
        previewCancelButton: {
          type:String,
          readOnly: false,
          notify: true,
          value: m_basePath + IMG_ATTACH_CANCEL_BUTTON
        },
        previewFile: {
          type: Object,
          readOnly: false,
          notify: true,
          value: null
        },
        textMessage: {
          type: String,
          readonly: false,
          notify: true,
          value: ""
        },
        uploads: {
          type: Array,
          readonlye: false,
          notify: true,
          value: []
        },
        isPriorityEnabled: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: true
        },
        refCancelButton: {
          type:String,
          readOnly: false,
          notify: true,
          value: m_basePath + IMG_ATTACH_CANCEL_BUTTON
        },
        refTag: {
          type:String,
          readOnly: false,
          notify: true,
          value: ""
        },
        refContent: {
          type:String,
          readOnly: false,
          notify: true,
          value: ""
        },
        targetMessageId: {
          type:String,
          readOnly: false,
          notify: true,
          value: ""
        }
      };
    }

    // Binding computing function. Returns placeholder text based on the
    // chat state.
    getInputPlaceholder(chat) {
      if (chat) {
        return this.isChatDefunct(chat)
          ? INPUT_PLACEHOLDER_DISABLED
          : INPUT_PLACEHOLDER_ACTIVE;
      }
      return INPUT_PLACEHOLDER_DISABLED;
    }

    // Binding function. Returns event handler which changes the background
    // of the DOM element associated with the event.
    backgroundFlipper() {
      return event => {
        var buttonName = event.currentTarget.classList.item(0);
        var eventType = event.type;
        event.currentTarget.style.backgroundImage 
          = this.buttonImages[buttonName][eventType];
      };
    }

    // Binding function. Returns event handler which sends text message.
    // Removes preview file if any.
    sendButtonClick() {
      return () => {
        this.sendMessage(this.textMessage, this.previewFile);
        this.previewFile = null;
        this.textMessage = "";
        this.lastSendTypingTime = undefined;
        this.isPriorityMessage = false;
        this.refTag = "";
        this.refContent = "";
        this.targetMessageId = "";
      };
    }

    // Binding function. Returns event handler which invokes open file dialog.
    attachButtonClick() {
      return () => {
        this.bbmInputFile.click();
      };
    }

    // Binding function. Returns event handler which set the message as a priority message.
    priorityButtonClick() {
      return () => { 
        this.isPriorityMessage = !this.isPriorityMessage;
      };
    }

    // Binding function. Returns event handler which:
    // Sends file one by one if multiple files were selected.
    // Sets file for the preview if single file was selected.
    // Checks if selected file(s) exceed maximum allowed.
    // Checks if number of selected files exceeds maximum allowed.
    onInputFileChange() {
      return () => {
        //hide the reference field
        this.refTag = "";
        this.refContent = "";
        this.targetMessageId = "";

        // If the number of files exceed maximum allowed file size, then
        // notify user and return.
        if (this.bbmInputFile.files.length > MAX_SEND_FILE_NUMBER) {
          this.bbmInputFile.value = "";
          console.warn("bbm-chat-input: Maximum supported number of files: "
            + MAX_SEND_FILE_NUMBER);
          this.dispatchEvent(new CustomEvent("errorMessage", {
            "detail" : {
              "message" : "Maximum supported number of files is "
                + MAX_SEND_FILE_NUMBER
            }
          }));
          return;
        }

        // Check if any file in collection of the selected file exceeds the
        // maximum allowed size.
        var isSizeExceeded = false;
        [].forEach.call(this.bbmInputFile.files, file => {
          if (file.size > BBMEnterprise.Messenger.MaxFileSize) {
            console.warn("bbm-chat_input: " + file.name
              + " is larger than " + this.maxFileSizeString + " limit");
            isSizeExceeded = true;
          }
        });

        // If there are files that exceed maximum allowed file size, then 
        // notify user.
        if (isSizeExceeded) {
          this.bbmInputFile.value = "";
          this.dispatchEvent(new CustomEvent("errorMessage", {
            "detail" : {
              "message" : "Selected file must not exceed "
                + this.maxFileSizeString
            }
          }));
          return;
        }

        // If there are multiple files selected, then send it one by one.
        // If only one file is selected, then set this file for a preview.
        if (this.bbmInputFile.files.length > 1) {
          [].forEach.call(this.bbmInputFile.files, file => {
            this.sendMessage("", file);
          });
          this.bbmInputFile.value = "";
        }
        else if (this.bbmInputFile.files.length === 1) {
          this.previewFile = this.bbmInputFile.files[0];
          this.bbmInputFile.value = "";
          this.isPriorityMessage = false;
        }
      };
    }

    // Binding function. Returns event handler which removes preview file and
    // update bindings.
    cancelPreview() {
      return () => {
        this.previewFile = null;
      };
    }

    // Binding computing function. Triggers the visibility of the file display
    // area. If a preview file or upload exists returns "flex", otherwise
    // returns "none".
    getFileDisplay(previewFile, uploads) {
      return (previewFile || uploads.length > 0) ? "flex" : "none";
    }

    // Binding computing function. Triggers the visibility of the file preview
    // wrapper. If a preview file exists returns "flex", otherwise returns
    // "none".
    getPreviewDisplay(previewFile) {
      return previewFile ? "flex" : "none";
    }

    // Binding computing function. Returns the file name of a preview file.
    getPreviewFileName(previewFile) {
      return (previewFile) ? previewFile.name : "";
    }

    // Binding computing function. Returns the size of a preview file in 
    // readable format.
    getPreviewFileSize(previewFile) {
      return (previewFile) ? bytesToSize(previewFile.size) : "";
    }

    /**
     * Binding computing function.
     * @return "flex" to show the label field of message reference,
     *  otherwise "none" to hide it.
     */
    getRefDisplay(refTag) {
      return refTag.length > 0 ? "flex" : "none";
    }

    /**
     * The callback function for clicking the cancel button
     * to hide the text field for message reference, such as quote or edit.
     */
    cancelRef() {
      return () => {
        this.refTag = "";
        this.refContent ="";
        this.targetMessageId = "";
        this.textMessage =  "";
      };
    }

    /**
     * Set the refTag property which is used to determine which kind of message
     * reference to display
     * @{String} refTag - the refTag of the ChatMessage.
     */
    setRefTag(refTag) {
      this.refTag = refTag;
    }

    /**
     * Shows a text field for message reference, such as quote or edit.
     * @param {Event} event
     *   The event which triggers to show the text field.
     */
    showRefField(event) {
      this.refTag = event.detail.refTag;
      this.targetMessageId = event.detail.targetMessageId;
      this.refContent = event.detail.content;
      this.textMessage = event.detail.textMessage;
    }

    // Binding computing function. Returns true if chat is in Defunct state.
    isChatDefunct(chat) {
      return chat.state === BBMEnterprise.Messenger.Chat.State.Defunct;
    }

    // Binding computing function. Computes if the send button is disabled or
    // not. Changes the send the button background according to button state.
    // Returns true if disabled, false if enabled.
    computeSendButtonDisabled(chat, previewFile, textMessage) {
      var ret = false;
      if (chat === undefined) {
        ret = true;
      } else if (this.isChatDefunct(chat)) {
        ret = true;
      } else if (previewFile === null && textMessage.length === 0) {
        ret = true;
      }

      this.sendButtonImage = !ret
        ? m_basePath + "img/send_enabled.png"
        : m_basePath + "img/send_disabled.png";

      return ret;
    }

    // Monitor user input to send 'typing' notifications to current chat while
    // user is typing. Send message if user pressed Enter. New line is
    // inserted if user press Shift + Enter.
    inputKeyDown() {
      return event => {
        if (!event.shiftKey && event.key === "Enter") {
          if (this.textMessage || this.previewFile) {
            this.sendMessage(this.textMessage, this.previewFile);
            this.previewFile = null;
            this.textMessage = "";
            this.lastSendTypingTime = undefined;
            this.isPriorityMessage = false;
            this.refTag = "";
            this.refContent = "";
            this.targetMessageId = "";
            return false;
          }
        }
        this._sendTypingNotification();
        return true;
      };
    }

    /**
     * Sends message to the current chat. Message consists of text and/or file.
     * @param {String} [textMessage] Text string to be sent
     * @param {File} [file] File to be sent
     */
    sendMessage(textMessage, file) {
      try {
        textMessage = textMessage
          ? textMessage 
          : "";

        if (file) {
          if (this._isImageFile(file)) {
            this._sendFileMessage(MessageFormatter.Tag.Picture, textMessage,
              file,
              // Thumbnail generation function.
              (message) =>
                this._getImageFileSize(file).then(() => {
                  return this._createThumbnail(file).then(thumbnail => {
                    if (thumbnail) {
                      message.thumbData = thumbnail;
                    }
                  }).catch(error => {
                    console.log("bbm-chat-input: failed to create thumbnail: " +
                                error);
                  });
                })
            );
          }
          else {
            this._sendFileMessage(MessageFormatter.Tag.File, textMessage, file,
                                  // Don't generate a thumbnail for file
                                  // transfers.
                                  () => Promise.resolve());
          }
        }
        else {
          this._sendTextMessage(textMessage);
        }

        this.dispatchEvent(new Event('messageSent'));
      }
      catch(error) {
        console.error('bbm-chat-input : sendMessage failed: ' + error);
      }
    }

    _chatUpdatedCallback(updateMessage) {
      if (this.chat) {
        if (this.chat.chatId === updateMessage.chat.chatId) {
          this.chat = updateMessage.chat;
        }
      }
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
        throw new Error("bbm-chat-input: value must be instance of BBMEnterprise.Messenger");
      }

      if (this.bbmMessenger) {
        this.bbmMessenger.removeListener("chatUpdated", this._chatUpdatedCallback);
      }

      this.bbmMessenger = value;

      if(value) {
        this.bbmMessenger.on("chatUpdated", this._chatUpdatedCallback);
      }
    }

    /**
     * Sets current chat id
     * @param {String} chatId
     * Current chat id
     * @throws {Error} When bbmMessenger is not set.
     */
    setChatId(chatId) {
      if (this.chat && this.chat.chatId === chatId) {
        return;
      }

      if (this.bbmMessenger) {
        this.chat = this.bbmMessenger.getChat(chatId);
        this.textMessage = "";
        this.lastSendTypingTime = undefined;
        this.previewFile = null;
        this.uploads = [];
        this.isPriorityMessage = false;
      } else {
        throw new Error ("bbmMessenger is not set");
      }
    }


    // Sends chatTyping notifications to current chat with 5 seconds interval
    // while user is typing.
    // Timing used is against the local clock and clock changes may result in 
    // a suppression of typing notifications.
    _sendTypingNotification() {
      if (this.lastSendTypingTime) {
        if (new Date().getTime() - this.lastSendTypingTime >
          SEND_CHAT_TYPING_INTERVAL)
        {
          this.lastSendTypingTime = new Date().getTime();
          try {
            this.bbmMessenger.chatTyping(this.chat.chatId).catch((error) => {
              console.log("bbm-chat-input: Failed to send typing notification:"
              + error);
            });
          }
          catch (error) {
            console.log("bbm-chat-input: Failed to send typing notification: "
            + error);
          }
        }
      }
      else {
        this.lastSendTypingTime = new Date().getTime();
      }
    }

    // Generates thumbnail of the attached file image.
    // @param {File} file
    // The file that will be sent with the specified message.
    // This will be inspected and used to modify the specified message.
    // @returns {Promise}
    // Promise of an image thumbnail. Resolves with Blob object which
    // represents image thumbnail.
    _createThumbnail(file) {
      return new Promise((resolve, reject) => {
        if (file.size <= THUMB_MAX_SIZE) {
          // The image is already small enough to set in thumb so set it there
          // without scaling and compressing it further.
          resolve(file);
          return;
        }

        // Create a new image to load the full file into.
        var img = new Image();
        // Keep track of how many attempts have been made to compress the image.
        var compressAttempts = 0;
        // Create a canvas, this won't be displayed, it is just used to
        // scale down then compress the image the same as it would for display.
        var canvas = document.createElement("canvas");
        // The starting image quality, will reduce as needed.
        var imageQuality = THUMB_START_IMAGE_QUALITY;
        // Once the image loads we can start compressing it.
        img.onload = () => {
          // Figure out what size of canvas to start at, keep same aspect ratio.
          // It can be reduced further if lowering image quality doesn't shrink 
          // enough.
          if (img.width > img.height) {
            canvas.width = Math.min(THUMB_MAX_DIMENSION_PIXELS, img.width);
            canvas.height = canvas.width * (img.height / img.width);
          } else {
            canvas.height = Math.min(THUMB_MAX_DIMENSION_PIXELS, img.height);
            canvas.width = canvas.height * (img.width / img.height);
          }

          // Function to draw the image to current canvas scaled down size.
          var drawScaledImage = () => {
            canvas.getContext('2d')
              .drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          // Need to draw the image scaled down before trying to compress it.
          drawScaledImage();

          // Helper to compress the image from the canvas to a blob using the
          // current image quality. Once done it will check the blob size and
          // take further steps if it needs to shrink the blob further.
          // The preference is to reduce image quality a bit when the compressed
          // image is still too large since that is more efficient than reducing
          // the image dimensions. A reduction in image dimensions requires
          // drawing the image then compressing it but a reduction in image
          // quality just requires the compression step.
          var compressImage = () => {
            try {
              // Get a blob for what is drawn to the canvas to get the scaled
              // image.
              canvas.toBlob(function(thumbBlob) {
                ++compressAttempts;
                if (thumbBlob.size <= THUMB_MAX_SIZE) {
                  resolve(thumbBlob);
                  return;
                } else if (compressAttempts > THUMB_MAX_REDUCTION_ATTEMPTS) {
                  // Thats enough, its very unlikely this will get hit, but
                  // avoid taking to long to send, just send photo without
                  // thumbnail.
                  reject(new Error("Failed to create thumbnail. Attempts: "
                    + compressAttempts 
                    + " out of "
                    + THUMB_MAX_REDUCTION_ATTEMPTS));
                  return;
                } else if (imageQuality < THUMB_MIN_IMAGE_QUALITY) {
                  // Reducing the thumb size by half and increasing image
                  // quality from 30% back to 80% normally results in a slightly
                  // smaller compressed size for most images.
                  canvas.width = canvas.width / 2;
                  canvas.height = canvas.height / 2;
                  drawScaledImage();
                  // Reset image quality now that dimensions are reduced.
                  imageQuality = THUMB_START_IMAGE_QUALITY;
                  compressImage();
                } else {
                  // Just decrease quality and try compressing again.
                  imageQuality = imageQuality - 0.1;
                  compressImage();
                }
              },
              "image/jpeg", imageQuality);
            }
            catch (error) {
              reject(error);
              return;
            }
          };
          compressImage();
        };
        img.src = URL.createObjectURL(file);
      });
    }

    // Checks if file is an image file by file type
    _isImageFile(file) {
      return file.type && file.type.toLowerCase().startsWith("image/");
    }

    // Gets image file dimensions
    _getImageFileSize(file) {
      return new Promise(resolve => {
        var img = new Image();
        img.onload = () => {
          resolve({"x" : img.width, "y" : img.height});
        };
        img.src = URL.createObjectURL(file);
      });
    }

    // Sends message which contains an attachment.
    _sendFileMessage(tag, textMessage, file, generateThumbnail) {

      // The model for the data representing a file upload.
      var uploadData = {
        fileName: encodeURIComponent(file.name),
        fileSize: bytesToSize(file.size),
        uploadedBytes: '0',
        totalBytes: file.size.toString()
      };

      var message = {
        tag: tag,
        content: textMessage,
        fileData: {
          data: file,
          name: encodeURIComponent(file.name),
          progress: (progressEvent) => {
            // Update the data members of the upload.
            var newUploadData = {
              fileName: uploadData.fileName,
              fileSize: uploadData.fileSize,
              uploadedBytes: progressEvent.loaded.toString(),
              totalBytes: progressEvent.total.toString()
            };

            // Update the element in the UI.
            var index = this.uploads.findIndex(
              element => element === uploadData);
            if(index >= 0) {
              this.splice('uploads', index, 1, newUploadData);
              uploadData = newUploadData;
            }
          }
        }
      };

      message.data = {
        fileName: encodeURIComponent(file.name)
      };

      this.splice('uploads', this.uploads.length, 0, uploadData);

      generateThumbnail(message)
      .then(() =>
        this.bbmMessenger.
          chatMessageSend(this.chat.chatId, message)
          .catch(error => {
            console.error('bbm-chat-input : sendMessage failed: ' + error);
          })
          .then(() => {
            // Remove the upload from the UI.
            var index = this.uploads.findIndex(
              element => element === uploadData);
            this.splice('uploads', index, 1);

            //Hide the file info field
            this.bbmFileWrapper.style.display = 'none';
          })
      );
    }

    // Sends text message without a file
    _sendTextMessage(textMessage) {
      let message =
        {
          tag: MessageFormatter.Tag.Text,
          content: textMessage
        };
      
      if(this.isPriorityMessage) {
        message.data = {
          priority:  TAG_MESSAGE_TEXT_PRIORITY_HIGH
        };
      }

      if(this.refTag.length > 0 ) {
        message.ref = [
          {
            tag: this.refTag,
            messageId: this.targetMessageId
          }
        ];
      }

      this.bbmMessenger
        .chatMessageSend(this.chat.chatId, message).catch(error => {
          console.error('bbm-chat-input : sendMessage failed: ' + error);
        });
    }

    // Gets the string of display property of the priority button element.
    getPriorityButtonDisplay(previewFile, refTag, isPriorityEnabled) {
      // If a preview file exists or the input field is for
      // quoting/editing a message, or priority is explicitly disabled, returns
      // "none" to hide the button, otherwise returns "flex" to show the button.
      return previewFile || refTag.length > 0 || !isPriorityEnabled
        ? "none"
        : "flex";
    }

    // Gets the background image of the priority button.
    getPriorityButtonBackground() {
      var imagePath = m_basePath + (this.isPriorityMessage
        ? IMG_PRIORITY_BUTTON_ON : IMG_PRIORITY_BUTTON_OFF);
      return imagePath;
    }

    // Get the text color of the input text area
    getInputTextColor(isPriorityMessage) {
      // If the message is a priority message, returns "red",
      // otherwise returns "black".
      return isPriorityMessage ? 'red' : 'black';
    }
    // Gain the focus
    focus() {
      this.bbmInput.focus();
    }

    // Returns the name of the custom element
    static get is() { return "bbm-chat-input"; }
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
    return parseFloat((bytes / Math.pow(kb, i)).toFixed(decimals)) 
      + ' ' + units[i];
  }

  window.customElements.define(BbmChatInput.is, BbmChatInput);
})(window, document);

//****************************************************************************

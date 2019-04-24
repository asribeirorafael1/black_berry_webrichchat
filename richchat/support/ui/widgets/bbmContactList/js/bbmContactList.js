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
  const DisplayModes = {
    StartChat: 'StartChat',
    InviteOthers: 'InviteOthers'
  };

  /**
   * bbm-contact-list element class implementation.
   * 
   * bbm-contact-list is a custom element that displays a list of contacts.
   * 
   * Allows the following actions:
   * - Select contacts to start chat with or contacts to invite to a chat.
   * - Enter chat name for a multi-party chat.
   * - Specify if users are allowed to invite others to the new chat.
   * 
   * Has the following property:
   * - displayMode {string}
   *   Use 'StartChat' when bbm-contact-list is to be displayed to start a new
   *   chat;
   *   Use 'InviteOthers' when bbm-contact-list is to be displayed to invite
   *   new users to the existing chat;
   * 
   * bbm-contact-list fires following events:
   * @fires BbmContactList#Ok when user has selected desired contacts and
   * clicked Ok.
   * @fires BbmContactList#Cancel when user clicked cancel.
   *
   * @memberof Support.Widgets
   */

  class BbmContactList extends Polymer.Element {
    constructor() {
      super();

      // Handles 'user_added' event fired by user manager. Adds a new contact to
      // the contact list.
      const onContactAdded = newUserInfo => {
        if (this.localUser.userId === newUserInfo.userId) {
          return;
        }

        if (!this.contactsMap.has(newUserInfo.userId)) {
          const userInfoCopy = Object.assign({}, newUserInfo);
          userInfoCopy.avatarUrl =
            userInfoCopy.avatarUrl || `${m_basePath}img/default_avatar.png`;
          this._insertContact(userInfoCopy);
          this.contactsMap.set(userInfoCopy.userId, userInfoCopy);
        }
      };

      // Handles 'user_changed' event fired by user manager. Updates an existing
      // contact with the new information.
      const onContactChanged = newUserInfo => {
        const oldUserInfo = this.contactsMap.get(newUserInfo.userId);
        if (oldUserInfo) {
          const userInfoCopy = Object.assign({}, newUserInfo);
          userInfoCopy.avatarUrl =
            userInfoCopy.avatarUrl || `${m_basePath}img/default_avatar.png`;
          this._deleteContact(oldUserInfo);
          this._insertContact(userInfoCopy);
          this.contactsMap.set(userInfoCopy.userId, userInfoCopy);
          if (userInfoCopy.selected) {
            this.$.selector.select(userInfoCopy);
          }
        }
      };

      // Handles 'user_removed' event fired by user manager Removes existing
      // contact from the contact list.
      const onContactRemoved = userInfo => {
        const oldUserInfo = this.contactsMap.get(userInfo.userId);
        if (oldUserInfo) {
          this._deleteContact(oldUserInfo);
          this.contactsMap.delete(userInfo.userId);
        }
      };

      /**
       * Sets instance of user manager.
       * @param {object} value instance of user manager.
       */
      this.setContactManager = value => {
        if (this.contactManager) {
          this._resetToDefault();
          this.splice('contactList', 0, this.contactList.length);
          this.contactsMap = new Map();
          this.contactManager.removeEventListener('user_added',
            onContactAdded);
          this.contactManager.removeEventListener('user_changed',
            onContactChanged);
          this.contactManager.removeEventListener('user_removed',
            onContactRemoved);
        }
        this.contactManager = value;
        if (value) {
          this.contactManager.addEventListener('user_added',
            onContactAdded);
          this.contactManager.addEventListener('user_changed',
            onContactChanged);
          this.contactManager.addEventListener('user_removed',
            onContactRemoved);
          this.localUser = this.contactManager.getLocalUser();
        }
      };

      // Resets the state of the bbm-contact-list to the default.
      this._resetToDefault = () => {
        if (this.selectedContacts.length > 0) {
          for (let i = 0; i < this.contactList.length; i++) {
            this.set(`contactList.${i}.selected`, false);
          }
          this.$.selector.clearSelection();
        }
        this.chatName = '';
        this.isAllowInvites = false;
        this.displayMode = DisplayModes.StartChat;
      };

      // Searches the provided userInfo in the contactList by name and userId.
      // If items is found, the foundCallback is invoked with the index of
      // userInfo as a parameter. If item is not found, the notFoundCallback is
      // invoked with the index where search has stopped.
      // Used to insert, change and delete contacts.
      this._findContact = (userInfo, foundCallback, notFoundCallback) => {
        let min = 0;
        let max = this.contactList.length;
        while (min < max) {
          const mid = (min + max) >>> 1;
          const name1 = userInfo.displayName.toLowerCase();
          const name2 = this.contactList[mid].displayName.toLowerCase();
          let compareResult = name1.localeCompare(name2);
          if (compareResult > 0) {
            min = mid + 1;
          }
          else if (compareResult < 0) {
            max = mid;
          }
          else {
            // Contact with this name if found, compare user ids.
            const id1 = userInfo.userId;
            const id2 = this.contactList[mid].userId;
            compareResult = id1.localeCompare(id2);
            if (compareResult > 0) {
              min = mid + 1;
            }
            else if (compareResult < 0) {
              max = mid;
            }
            else {
              // Contact is found, call foundCallback.
              return foundCallback(mid);
            }
          }
        }
        // Contact was not found, call notFoundCallback.
        return notFoundCallback(min);
      };

      // Inserts provided user info to the contact list in the alphabetical
      // order.
      this._insertContact = userInfo => {
        // If contact already exists, log warning.
        const foundCallback = () => {
          console.warn(`User ${userInfo.displayName} : ` +
            `${userInfo.userId} is already in the contact list`);
        };
        // If contact does not exist, insert the provided userInfo to
        // contactList.
        const notFoundCallback = index => {
          this.splice('contactList', index, 0, userInfo);
        };
        // Invoke _findContact with the specified callbacks.
        this._findContact(userInfo, foundCallback, notFoundCallback);
      };

      // Deletes provided user into from contactList.
      this._deleteContact = userInfo => {
        // If contact exists, delete it.
        const foundCallback = index => {
          this.splice('contactList', index, 1);
        };
        // If contact does not exist, log warning.
        const notFoundCallback = () => {
          console.warn(`User ${userInfo.displayName} : ` +
           `${userInfo.userId} is not the contact list`);
        };
        // Invoke _findContact with the specified callbacks.
        this._findContact(userInfo, foundCallback, notFoundCallback);
      };

      // Returns the index of the specified user information in contactList.
      // Returns -1 if user info is not present in contactList.
      this._indexOfContact = userInfo => {
        // If contact exists, return its index.
        const foundCallback = index => {
          return index;
        };
        // If contact does not exist, return -1;
        const notFoundCallback = () => {
          return -1;
        };
        // Invoke _findContact with the specified callbacks.
        return this._findContact(userInfo, foundCallback, notFoundCallback);
      };
    }

    ready() {
      super.ready();

      window.addEventListener('click', e => {
        if (e.isContactListToggleMenuEvent === undefined) {
          // Hide context menu.
          this.isDisplayMenu = false;
        }
        if (e.isContactListShowAddContactDialog === undefined) {
          // Hide "add contact" dialog.
          this._onAddContactDialogCancel();
        }
      });

      this.$.addContactDialog.addEventListener('click', e => {
        e.isContactListShowAddContactDialog = true;
      });
    }

    // Defined list of properties of custom control.
    static get properties() {
      return {
        contactsMap: {
          value: new Map()
        },
        contactList: {
          value: []
        },
        closeImagePath: {
          value: `${m_basePath}img/close.png`
        },
        selectedContacts: {
          value: []
        },
        headerText: {
          computed: '_getHeaderText(selectedContacts.length)'
        },
        isOkDisabled: {
          computed: '_getIsOkDisabled(selectedContacts.length, isMultiChat, chatName)'
        },
        isMultiChat: {
          computed: '_getIsMultiChat(selectedContacts.length, displayMode)'
        },
        chatName: {
          value: ''
        },
        isAllowInvites: {
          value: false
        },
        noContactsImage: {
          value: `${m_basePath}img/no_avatar.png`
        },
        isEmpty: {
          computed: '_getIsEmpty(selectedContacts.length, contactList.length)'
        },
        displayMode: {
          value: DisplayModes.StartChat
        },
        isDisplayMenu: {
          value: false
        },
        currentMenuItem: {
          value: null
        },
        isDisplayAddContact: {
          value: false
        },
        newContactEmailPlaceholder: {
          value: 'Email'
        },
        newContactEmail: {
          value: ''
        },
        newContactName: {
          value: ''
        },
        isAddContactDisabled: {
          computed: '_getIsAddButtonDisabled(newContactEmail)'
        }
      };
    }

    // Computing function. Returns the value of the header text based on
    // the selected contacts length.
    _getHeaderText(length) {
      return length > 0 ? `Contacts Selected (${length})` : 'Select Contacts';
    }

    // Computing function. Enables / disables Ok button based on the provided
    // parameters.
    _getIsOkDisabled(length, isMultiChat, chatName) {
      return (length === 0 || (isMultiChat && !chatName));
    }

    // Computing function. Computes if chat is multi-chat based on the provided
    // parameters.
    _getIsMultiChat(length, displayMode) {
      return length > 1 && displayMode === DisplayModes.StartChat;
    }

    // Contact click handler. Selects the clicked contact and makes it a
    // chat participant.
    _toggleContactSelection(e) {
      if (e.isContactListToggleMenuEvent !== undefined) {
        return;
      }
      const item = this.$.contactList.itemForElement(e.target);
      if (item && item.regId) {
        const index = this._indexOfContact(item);
        this.$.selector.select(item);
        this.set(`contactList.${index}.selected`, true);
        if (this.isMultiChat) {
          this.$.chatNameInput.focus();
        }
      }
    }

    // Participant click handler. Deselects the clicked contact and removes in
    // from chat participants.
    _toggleParticipantSelection(e) {
      const item = this.$.participantList.itemForElement(e.target);
      const index = this._indexOfContact(item);
      this.$.selector.deselect(item);
      this.set(`contactList.${index}.selected`, false);
      if (this.isMultiChat) {
        this.$.chatNameInput.focus();
      }
    }

    // Toggle menu click handler. Displays contact dropdown menu.
    _toggleMenuDisplay(e) {
      let verticalOffset = 50;
      const item = this.$.contactList.itemForElement(e.target);
      this.currentMenuItem = item;
      this.isDisplayMenu = true;
      this.$.dropdownMenu.style.left = `${e.x}px`;
      this.$.dropdownMenu.style.top = `${e.y - verticalOffset}px`;
      const menuRect = this.$.dropdownMenu.getBoundingClientRect();
      // Do not allow dropdown menu to go outside the main window.
      if (menuRect.bottom > window.innerHeight) {
        verticalOffset += menuRect.bottom - window.innerHeight;
        this.$.dropdownMenu.style.top = `${e.y - verticalOffset}px`;
      }
      e.isContactListToggleMenuEvent = true;
    }

    // Controls DOM Elements visibility. Returns 'none' if value is true.
    // Returns 'flex' otherwise.
    _hideIfTrue(value) {
      return value ? 'none' : 'flex';
    }

    // Controls DOM Elements visibility. Returns 'flex' if value is true.
    // Returns 'none' otherwise.
    _showIfTrue(value) {
      return value ? 'flex' : 'none';
    }

    // Controls DOM Element opacity. Returns 100% if the provided value has
    // regId. Returns 60% if provided value has no regId.
    _getItemOpacity(value) {
      return value.regId !== undefined ? 1 : .6;
    }

    // Controls DOM Element title. Sets title on element if the provided value
    // does not have regId.
    _getItemTooltip(value) {
      return value.regId !== undefined 
        ? '' 
        : 'Contact does not have registration ID';
    }

    // Returns true if the are no items to display in contactList. Returns false
    // otherwise.
    _getIsEmpty(selectedLength, contactsLength) {
      return selectedLength === contactsLength;
    }

    // Handles Cancel button click. Sends 'Cancel' event.
    _onCancelClicked() {
      this._resetToDefault();
      this.dispatchEvent(new Event('Cancel'));
    }

    // Handles Cancel button click. Sends 'Ok' custom event.
    _onOkClicked() {
      const event = new CustomEvent('Ok', {
        detail : {
          selectedContacts: this.selectedContacts.map(elem => elem.regId),
          chatName: this.chatName,
          isMultiChat: this.isMultiChat,
          isAllowInvites: this.isAllowInvites
        }
      });
      this._resetToDefault();
      this.dispatchEvent(event);
    }

    // Delete contact button handler. Deletes selected contact.
    async _onDeleteContact() {
      try {
        const item = this.currentMenuItem;
        await this.contactManager.deleteUser(item.userId);
      }
      catch(error) {
        console.warn(`Failed to delete contact | Error: ${error}`);
        alert(`Failed to delete contact.`);
      }
    }

    // Synchronize contacts button click handler. Synchronizes contacts with
    // identity provider.
    async _onSyncContactsClicked() {
      try {
        this.$.syncContactsButton.style.display = 'none';
        await this.contactManager.syncUsers();
      }
      catch(error) {
        console.warn(`Failed to synchronize contact | Error: ${error}`);
        alert('Failed to synchronize contacts.');
      }
      finally {
        this.$.syncContactsButton.style.display = 'flex';
      }
    }

    // Add contact button click handler. Shows dialog to add a new contact
    _onAddContactClicked(e) {
      let verticalOffset = 50;
      this.isDisplayAddContact = true;
      this.$.addContactDialog.style.left = `${e.x}px`;
      this.$.addContactDialog.style.top = `${e.y - verticalOffset}px`;
      e.isContactListShowAddContactDialog = true;
      this.$.addContactDialogEmail.focus();
    }

    // Add contact dialog 'add' button click hander. Creates new contact.
    async _onAddContactDialogAdd() {
      try {
        const name = this.newContactName || this.newContactEmail;
        const email = this.newContactEmail;
        this._onAddContactDialogCancel();
        await this.contactManager.addUser(email, name);
      }
      catch (error) {
        console.warn(error);
        alert('Failed to add contact.');
      }
    }

    // This function adds new contact when user clicks Enter when entering user
    // name or user email.
    _onAddContactKeyDown() {
      return async event => {
        if (event.keyCode !== 13) {
          return;
        }
  
        if (this.newContactEmail &&
          !this._getIsAddButtonDisabled(this.newContactEmail.trim())) {
          await this._onAddContactDialogAdd();
        }
      };
    }

    // Add contact dialog 'cancel' button click handler. Hides 'add contact'
    // dialog.
    _onAddContactDialogCancel() {
      this.isDisplayAddContact = false;
      this.newContactEmail = '';
      this.newContactName = '';
    }

    // Binding function. Enables / disables 'add' button on the 'add contact'
    // dialog.
    _getIsAddButtonDisabled(email) {
      // Allow any non-whitespace value to be added.
      return (! email.trim());
    }

    // Returns the name of the custom element.
    static get is() { return 'bbm-contact-list'; }
  }

  customElements.define(BbmContactList.is, BbmContactList);
})(window, document);

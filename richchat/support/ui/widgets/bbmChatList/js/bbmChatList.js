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
   * bbm-chat-list element class implementation
   * 
   * bbm-chat-list is a custom element that displays the list of chats in which
   * the local user is a participant.
   *
   * @memberof Support.Widgets
   */
  class BbmChatList extends Polymer.mixinBehaviors([Polymer.IronResizableBehavior], Polymer.Element) {
    /**
     * Sets instance of BBMEnterprise.Messenger
     * @param {BBMEnterprise.Messenger} value
     *   Instance of BBMEnterprise.Messenger
     * @throws {Error} When parameter is not an instance of
     * BBMEnterprise.Messenger
     */
    setBbmMessenger(value) {
      if (!(value instanceof BBMEnterprise.Messenger)) {
        throw new Error("Value must be instance of BBMEnterprise.Messenger");
      }

      if (this.bbmMessenger !== undefined) {
        console.warn("bbm-chat-list: Messenger is already set.");
        return;
      }

      this.messenger = value;

      // Get the initial chat list.
      this.$.list.set('items', this.messenger.getChats());

      // Create an update function.
      this.notifyChatChanges = function() {
        this.$.list.set('items', this.messenger.getChats());
      }.bind(this);

      // Update the displayed list when the chat list changes.
      ['chatAdded', 'chatUpdated', 'chatRemoved'].forEach((update) => {
        this.messenger.on(update, this.notifyChatChanges);
      });
    }

    /**
     * Sets the context, which will be used to resolve references in
     * the chat bubble template.
     *
     * @param {object} value
     *   This can contain functions which may be called from the message bubble
     *   template.
     */
    setContext(value) {
      // GOTCHA: This is using the polymer internal value __dataHost. Polymer
      // sets this value in the property-effects mixin for polymer components,
      // but we want to allow this to be set from a non-polymer component, and
      // unfortunately, polymer doesn't provide any mechanism for this.
      this.$.list.queryEffectiveChildren('template').__dataHost = value;
    }

    // Returns the name of the custom element
    static get is() {return "bbm-chat-list";}
  }

  window.customElements.define(BbmChatList.is, BbmChatList);
})(window);

//****************************************************************************

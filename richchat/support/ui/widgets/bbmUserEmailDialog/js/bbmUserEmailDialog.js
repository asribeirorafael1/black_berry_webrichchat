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

(function() {

  class BbmUserEmailDialog extends Polymer.Element {

    ready() {
      super.ready();
      const nameInput = this.shadowRoot.querySelector("#userEmail");
      nameInput.focus();
    }

    // Defined list of properties of custom control.
    static get properties() {
      return {
        userEmail: {
          value: ''
        },
        isOkDisabled: {
          computed: '_getIsOkDisabled(userEmail)'
        }
      };
    }

    // Only enable the OK button if the provided email value has a
    // non-whitespace value.
    _getIsOkDisabled(userEmail) {
      return (! userEmail.trim());
    }

    _onUserEmailDialogOk() {
      this.dispatchEvent(new CustomEvent('Ok', {
        'detail' : {
          'userEmail' : this.userEmail.trim()
        }
      }));
    }

    _onUserEmailDialogCancel() {
      this.dispatchEvent(new Event('Cancel'));
    }


    // Returns the name of the custom element.
    static get is() { return 'bbm-user-email-dialog'; }
  }
  customElements.define(BbmUserEmailDialog.is, BbmUserEmailDialog);
})();

//****************************************************************************

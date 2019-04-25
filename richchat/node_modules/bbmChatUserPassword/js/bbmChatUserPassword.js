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

  /**
   * bbm-chat-user-password element class implementation.
   * 
   * This element is a dialog which allows the user to enter an existing
   * password or create a new user password.
   * 
   * The element changes its mode based on 'isNewPassword' property. Set this
   * property to:
   * - true : if you want user to create new password.
   * - false : if you want user to enter an existing password.
   *
   *
   * The element changes its mode based on 'isPasswordFailed' property. Set this
   * property to:
   * - true : if you want to display error message that the last password
   *   attempt failed.
   *
   * Dispatches events:
   * - OnOk : Indicates user pressed 'Ok' on the dialog. Event details contain
   *          string with user password.
   * - OnCancel : Indicates user pressed 'Cancel'
   * - OnReset : Indicates user pressed 'Reset Password'
   * It is client's responsibility to close this dialog when events are
   * received.
   * 
   * @memberof Support.Widgets
   */
  class BbmChatUserPassword extends Polymer.Element {
    constructor() {
      super();
    }

    // Called after property values are set and local DOM is initialized.
    ready() {
      super.ready();
      const pwInput = this.shadowRoot.querySelector("#password");
      pwInput.focus();
    }

    // Defined list of properties of custom control.
    static get properties() {
      return {
        isNewPassword: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        isPasswordFailed: {
          type: Boolean,
          readOnly: false,
          notify: true,
          value: false
        },
        dialogHeader: {
          type: String,
          computed: 'getDialogHeader(isNewPassword)'
        },
        displayForNewOnly: {
          type: String,
          computed: 'getDisplayForNewOnly(isNewPassword)'
        },
        displayForExistingOnly: {
          type: String,
          computed: 'getDisplayForExistingOnly(isNewPassword)'
        },
        password: {
          type: String,
          readonly: false,
          notify: true,
          value: ''
        },
        passwordConfirm: {
          type: String,
          readonly: false,
          notify: true,
          value: ''
        },
        displayPasswordMatch: {
          type: String,
          notify: true,
          computed: 'getDisplayPasswordMatch(isNewPassword, password, passwordConfirm)'
        },
        displayPasswordFailed: {
          type: String,
          notify: true,
          computed: 'getDisplayPasswordFailed(isPasswordFailed)'
        },
        okButtonDisabled: {
          type: Boolean,
          notify: true,
          computed: 'getOkButtonDisabled(isNewPassword, password, passwordConfirm)'
        }
      };
    }

    /**
     * Computing function. Returns dialog header depending if dialog is called
     * to create new password or enter existing one.
     * @private
     */
    getDialogHeader(isNewPassword) {
      return isNewPassword
        ? 'Please choose a chat security password. This will be required to'
          + ' restore your chats.'
        : 'Please enter your chat security password.';
    }

    /**
     * Computing function. Manages visibility of elements. Allows elements to be
     * displayed only if user creates new password.
     * @private
     */
    getDisplayForNewOnly(isNewPassword) {
      return isNewPassword ? 'block' : 'none';
    }

    /**
     * Computing function. Manages visibility of elements. Allows elements to be
     * displayed only if user enters existing password.
     * @private
     */
    getDisplayForExistingOnly(isNewPassword) {
      return isNewPassword ? 'none' : 'block';
    }

    /**
     * Computing function. Manages visibility of the 'Passwords don't match'
     * label.
     * @private
     */
    getDisplayPasswordMatch(isNewPassword, password, passwordConfirm) {
      if (isNewPassword
          && ! equalPasswords(password, passwordConfirm)
          && passwordConfirm
          && passwordConfirm.length > 0)
      {
        return 'block';
      }
      return 'none';
    }
    
    /**
     * Computing function. Manages visibility of the 'Passwords Failed'
     * label.
     * @private
     */
    getDisplayPasswordFailed(isPasswordFailed) {
      return isPasswordFailed ? 'block' : 'none';
    }

    /**
     * Computing function. Manages the state of the 'Ok' button. Button is
     * disabled if user didn't enter password or new password doesn't match.
     * @private
     */
    getOkButtonDisabled(isNewPassword, password, passwordConfirm)
    {
      if (// Always check that we were given a non-empty password.
          password && password.length > 0
          // If the password is new, the two password fields must be equal.
          && (!isNewPassword || equalPasswords(password, passwordConfirm)))
      {
        // The password fields look good, so enable the 'Ok' button.
        return false;
      }

      // Something isn't right, so disable the 'Ok' button.
      return true;
    }

    /**
     * Returns the event handler of the 'Forgot Password' button.
     * @private
     */
    onResetPasswordClick() {
      return () => {
        // Send 'OnReset' event to the client.
        this.dispatchEvent(new Event('OnReset'));
        this.password = '';
        this.passwordConfirm = '';
      };
    }

    /**
     * Returns the event handler of the 'Cancel' button.
     * @private
     */
    onCancelClick() {
      return () => {
        // Send 'OnCancel' event to the client.
        this.dispatchEvent(new Event('OnCancel'));
      };
    }

    /**
     * Returns the event handler of the 'Ok' button.
     * @private
     */
    onOkClick() {
      return () => {
        // Send 'OnOk' event with the password back to the client.
        let password = this.password;
        let e = new CustomEvent('OnOk', { detail: password });
        this.dispatchEvent(e);
        this.password = '';
        this.passwordConfirm = '';
      };
    }

    passwordInputOnKeyDown() {
      return event => {
        let onOkEvent = null;
        if (event.keyCode === 13
            && this.password
            && this.password.length > 0
            && (! this.isNewPassword
                || equalPasswords(this.password, this.passwordConfirm))) {
          const password = this.password;
          onOkEvent = new CustomEvent('OnOk', { detail: password });
        }

        if (onOkEvent) {
          this.dispatchEvent(onOkEvent);
          this.password = '';
          this.passwordConfirm = '';
        }
      };
    }

    // Returns the name of the custom element.
    static get is() { return 'bbm-chat-user-password'; }
  }
  customElements.define(BbmChatUserPassword.is, BbmChatUserPassword);

  // Returns true if both passwords match; false otherwise.
  function equalPasswords(password1, password2)
  {
    // Sanity checks.
    if (typeof password1 !== 'string'
        || typeof password2 !== 'string'
        || password1.length !== password2.length)
    {
      return false;
    }

    // Use an XOR loop to keep the comparison time constant for any given
    // length.  This helps avoid timing attacks.
    let diff = 0;

    for (let i = 0; i < password1.length; ++i)
    {
      diff |= (password1.charCodeAt(i) ^ password2.charCodeAt(i));
    }

    return diff === 0;
  }
})();

//****************************************************************************

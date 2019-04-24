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

"use strict";

/**
 * An observer pattern for running a specified callback which receives the new
 * value of some underlying data element whenever that data element changes
 * value.
 *
 * @memberof Support.Util
 * @class Observer
 */

(function (Observer) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = Observer;
    }
    exports.Observer = Observer;
  }
  else {
    global.Observer = Observer;
  }
}).call(this, function() {
//============================================================================
// :: Types

  /**
   * This callback type is invoked whenever the set of values associated with a
   * ObserverContext changes asynchronously.
   *
   * @callback RefreshCallback
   */

  /**
   * This callback runs a body of code in which values may need to be observed.
   *
   * @callback ObserverBody
   *
   * @param {Getter} getter
   *   A getter which may be used to observe values.
   */

  /**
   * A function which will be called whenever the observable takes a new
   * value. The value will be passed to the function.
   *
   * @callback NewValueFunction
   *
   * @param {any} value
   *   The new value of the observable.
   */

  /**
   * A function which retrieves new values, synchronously or asynchronously.
   *
   * @callback ThenFunction
   *
   * @param {NewValueFunction} callback
   *   A callback which should be called whenever a new value is available for
   *   the observable. The function may be called synchronously or
   *   asynchronously, and may be called many times.
   */

  /**
   * A function which stops the observation of a particular value. This is used
   * to clean up any side-effects that result from calling the ThenFunction for
   * an observable.
   *
   * @callback UnwatchFunction
   */

  /**
   * @typedef {Object} Observable
   *   An object which provides a value, and for which a specified callback is
   *   run any time the value changes.
   *
   * @param {ThenFunction} then
   *   A function to be called whenever a new value is available for the
   *   observed value.
   *
   * @param {UnwatchFunction} unwatch
   *   A function which cleans up any side-effects associated with observing a
   *   value.
   */

  /**
   * Create an observer context. This is used to receive updates for any value
   * which may be synchronously or asynchronously retrieved. The observer
   * context will be the root of the data structure which stores all callbacks.
   * Observing a value may have side-effects, so the context allows for these
   * effects to be tracked and reversed when no longer observing the value.
   *
   * @param {RefreshCallback} callback
   *   The callback will execute whenever an observed value changes
   *   asynchronously. It has no parameters, and must get its data through
   *   other means, most likely a closure.
   */
  function ObserverContext(callback)
  {
    this.refreshScheduled = false;
    this.callback = callback;
    this.inCreation = true;

    this.getter = new Getter(this);
  }

  /**
   * An internal function called by observers. It indicates that an observed
   * value has changed, and an update may be necessary.
   */
  ObserverContext.prototype.refresh = function() {
    // Don't allow a refresh when the context is still being created. We want to
    // allow the client to react synchronously if all of the data is available
    // (and the client must do something synchronously to refresh later).
    if(this.inCreation) {
      return;
    }

    // If a refresh is scheduled, then there's no need to schedule another.
    if(this.refreshScheduled) {
      return;
    }

    // Schedule the refresh. We do this on a timer in order to gather values
    // that are updated concurrently. Once an observed value updates, other
    // observed values may update in the same iteration through the event loop
    // and also have their new values ready for the callback.
    this.refreshScheduled = true;
    setTimeout(() => {
      // Do the refresh.
      this.refreshScheduled = false;
      this.callback();
    });
  };

  /**
   * Clear the data inside an ObserverContext. This performs any cleanup needed
   * to stop observing values, in the case that observing the value has side
   * effects. It should be called when the observer is no longer needed.
   */
  ObserverContext.prototype.clear = function() {
    this.getter.clear();
  };

  /**
   * A class which allows observing a list of observable values. A Getter is
   * always a node in a tree structure with the root of the tree being an
   * ObserverContext.
   *
   * @param {ObserverContext|Getter} parent
   *   The parent node in a tree. The root of the tree is always an
   *   ObserverContext. If this node is anywhere other than a child of the root,
   *   then the parent will be a Getter.
   */
  function Getter(parent) {
    this.parent = parent;
    this.unresolvedChildren = new Set();
    this.children = [];
    this.observables = [];
  }

  /**
   * Call to observe an observable value. Whenever the observable updates, this
   * will trigger the callback with a child getter. The child getter may observe
   * further values, if desired. When child getters are used, the value will not
   * be returned until all child getters have provided their values.
   *
   * @param {Observable} observable
   *   The value to retrieve and observe.
   *
   * @param {ObserverContext} callback
   *   The callback to execute when the value of an observable changes.
   */
  Getter.prototype.observe = function(observable, callback) {
    // Add the observable to the set of observables for the getter. We need to
    // track observables for a getter to unwatch them on a refresh.
    this.observables.push(observable);

    // We need a child getter to allow further retrieval of observable values
    // from the callback.
    let childGetter = new Getter(this);

    // Add the getter to the getters which have not yet returned a value. We
    // need to track getters which have not returned a value to know when we
    // should notify our parent that the data is ready.
    this.unresolvedChildren.add(childGetter);

    // We need to track the child getters in order to clear them on refresh.
    this.children.push(childGetter);

    // Get an initial value for the observable.
    observable.then(result => {
      this.unresolvedChildren.delete(childGetter);

      // See if there was anything there before that needs to be cleared.
      childGetter.clear();

      // We have initial values. Execute the callback and see if we get anything
      // else that needs to be tracked.
      callback(childGetter, result);

      // See if the children were all resolved.
      if(childGetter.unresolvedChildren.size === 0) {
        // The child is resolved. See if all of the children are resolved.
        if(this.unresolvedChildren.size === 0) {
          // They are. Notify the parent.
          this.parent.refresh(this);
        }
      }
    });
  };

  /**
   * Called to clear the children of the getter. This would normally be done in
   * the case of a child getter, where the parent needs to rerun its callback
   * and may end up watching something different, or when the root
   * ObserverContext is no longer needed.
   */
  Getter.prototype.clear = function() {
    // Clear the children, which will execute recursively, as the Getters are
    // arranged in a tree.
    for(let child of this.children) {
      child.clear();
    }
    // Unwatch the observables, to clean up any side-effects watching them may
    // have.
    for(let observable of this.observables) {
      observable.unwatch();
    }

    // Reset the internal variables.
    this.children = [];
    this.observables = [];
    this.unresolvedChildren.clear();
  };

  /**
   * Called by a child in order to indicate that that child has a new value, and
   * we may therefore need to update ourself or our parent.
   *
   * @param {Getter} child
   *   The child which has been updated.
   */
  Getter.prototype.refresh = function(child) {
    // A refreshed child always has a value, so it is no longer unresolved.
    this.unresolvedChildren.delete(child);

    // See if that was the last child we were waiting for.
    if(this.unresolvedChildren.size === 0) {
      this.parent.refresh(this);
    }
  };

  /**
   * A factory function to retrieve a new observer context. When watching a
   * value is complete, clear should be called on the returned context to
   * perform any steps to clean up watches that had side effects.
   *
   * @param {ObserverBody} body
   *   A body of code to execute in which observation is performed.
   *
   * @param {RefreshCallback} callback
   *   A callback which will be run any time all observed values have
   *   asynchronously provided a value. Note: all observed objects may
   *   synchronously provide a value, but it is not run in that case.
   */
  function getObserverContext(body, callback) {
    // Create the next context.
    let context = new ObserverContext(callback);

    body(context.getter);
    context.inCreation = false;

    return context;
  }

  return { getObserverContext: getObserverContext };
}());

//****************************************************************************

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
 * A formatter which formats the timestamps used in various places throughout
 * the user interface.
 *
 * @memberof Support.Util
 * @class TimeRangeFormatter
 */

/**
 * @typedef {Object} FormattedTimestamp
 *
 * @property {string} timestamp
 *   The timestamp in an appropriate string form based on how long ago it was.
 *
 * @property {Date} [refreshTime]
 *   The time at which the timestamp needs to be redrawn because the manner in
 *   which it should be formatted has changed.
 */

/**
 * A function which takes the current time and from it, provides a time after
 * which any time is considered to be in range.
 *
 * @callback ApplyDiff
 *
 * @param {Date} now
 *   The current time. This must be updated to be the time such that any
 *   timestamp later than this time is considered to be in the range.
 */

/**
 * A function which determines when a timestamp needs to be refreshed. It may
 * need to be refreshed at that time with the same formatter, or may need to
 * be refreshed with a different formatter.
 *
 * @callback NextRefreshTime
 *
 * @param {Date} timestamp
 *   A timestamp to increment to give the time at which a refresh is needed.
 */

/**
 * A function which implements a rule for how to convert a timestamp to a
 * string.
 *
 * @callback FormatTimestamp
 *
 * @param {Date} timestamp
 *   The timestamp which should be displayed.
 *
 * @param {Date} now
 *   The current time. This is only needed in cases where the timestamp is
 *   formatted in a way relative to the current time.
 *
 * @returns {string} The formatted timestamp.
 */

(function (TimeRangeFormatter) {
  // This function will always be called with the correct global context to
  // which this module may export.
  var global = this;

  // Where do we place the module?  Do we have an exports object to use?
  if (typeof exports !== 'undefined') {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = TimeRangeFormatter;
    }
    exports.TimeRangeFormatter = TimeRangeFormatter;
  }
  else {
    global.TimeRangeFormatter = TimeRangeFormatter;
  }
}).call(this, function() {

  // A utility function to add one minute to a time.
  function addOneMinute(date) {
    date.setMinutes(date.getMinutes() + 1);
  }

  // A utility function to subtract one hour from a time.
  function oneHourAgo(date) {
    date.setHours(date.getHours() - 1);
  }

  // A utility function to add one hour to a time.
  function addOneHour(date) {
    date.setHours(date.getHours() + 1);
  }

  // A utility function to subtract one week from a time.
  function oneWeekAgo(date) {
    date.setDate(date.getDate() - 7);
  }

  // A utility function to add one day to a time.
  function addOneDay(date) {
    date.setDate(date.getDate() + 1);
  }

  // A utility function to give the time at which today began.
  function today(date) {
    date.setHours(0, 0, 0, 0);
  }

  /**
   * A constructor to store the different parts of a range of times.
   *
   * @param {ApplyDiff} applyDiff
   *   A function which applies a time difference to 'now'. Any time later than
   *   this is considered formattable by this formatter.
   *
   * @param {NextRefreshTime} nextRefreshTime
   *   A function which applies a time difference to a target timestamp to
   *   determine when the display of that timestamp needs to be refreshed.
   *
   * @param {FormatTimestamp} formatterFunction
   *   A function which formats a Date for display.
   *
   * @memberof TimeRangeFormatter
   */
  function formatter(applyDiff, nextRefreshTime, formatterFunction)
  {
    this.applyDiff = applyDiff;
    this.nextRefreshTime = nextRefreshTime;
    this.formatterFunction = formatterFunction;
  }

  /**
   * Check if a timestamp forms part of the range at which this formatter
   * applies.
   *
   * @param {Date} timestamp
   *   The time to check.
   *
   * @param {Date} now
   *   The current time. timestamp will be considered relative to this time to
   *   determine whether the range applies.
   *
   * @return {boolean} Whether the timestamp is in this range.
   *
   * @memberof TimeRangeFormatter
   */
  formatter.prototype.checkRange = function(timestamp, now) {
    var relativeToNow = new Date(now.getTime());
    this.applyDiff(relativeToNow);
    return relativeToNow.getTime() < timestamp.getTime();
  };

  /**
   * The default timestamp formatter if it is not in any range.
   *
   * @memberof TimeRangeFormatter
   */
  function nonRelativeFormatter(timestamp) {
    return {formattedTime: timestamp.toLocaleDateString()};
  }

  /**
   * The formatter for timestamps less than one hour before 'now'.
   *
   * @memberof TimeRangeFormatter
   */
  function lessThanAnHourFormatter(timestamp, now) {
    var diff = now.getTime() - timestamp.getTime();

    // 60 seconds.
    if(diff < 60000) {
      return 'Just now';
    } else if(diff < 120000) {
      // Less than 120 seconds.
      return '1 minute ago';
    } else {
      return Math.floor(diff / 60000).toString() + ' minutes ago';
    }
  }

  /**
   * The formatter for timestamps less than one day ago. For these, the time,
   * but not the date, is printed out.
   *
   * @memberof TimeRangeFormatter
   */
  function lessThanDayFormatter(timestamp) {
    return timestamp.toLocaleTimeString();
  }

  /**
   * The formatter for timestamps less than one week ago. For these, the time
   * and date are printed out.
   *
   * @memberof TimeRangeFormatter
   */
  function weekdayNoAtFormatter(timestamp) {
    return timestamp.toLocaleString();
  }

  return {
    /**
     * A set of ranges which give verbose details. This would be useful for
     * timestamps which are frequently very recent.
     *
     * @memberof TimeRangeFormatter
     */
    verboseRangesFormatters:
      [
        new formatter(oneHourAgo, addOneMinute, lessThanAnHourFormatter),
        new formatter(today, addOneHour, lessThanDayFormatter),
        new formatter(oneWeekAgo, addOneDay, weekdayNoAtFormatter)
      ],

    /**
     * A set of ranges which give logging suitable for chat bubbles.
     *
     * @memberof TimeRangeFormatter
     */
    chatBubbleFormatters:
      [
        new formatter(today, addOneHour, lessThanDayFormatter),
        new formatter(oneWeekAgo, addOneDay, weekdayNoAtFormatter)
      ],

    /**
     * Format a timestamp using a set of formatters relative to now.
     *
     * @param {formatter[]} formatters
     *   The set of formatters to use to format the timestamp, depending on its
     *   relationship to now.
     *
     * @param {Date} timestamp
     *   The timestamp to format
     *
     * @param {Date} now
     *   The current time. The timestamp may be printed in a form relative to
     *   now or a non-relative form.
     *
     * @returns {FormattedTimestamp}
     *   The formatted timestamp and the time at which it needs to be
     *   reformatted.
     *
     * @memberof TimeRangeFormatter
     */
    format: function(formatters, timestamp, now) {
      for(const formatter of formatters) {
        // Go through the formatters and find the first one that has this
        // timestamp in its range.
        if(formatter.checkRange(timestamp, now)) {
          var formattedTime = formatter.formatterFunction(timestamp, now);
          var refreshTime = new Date(timestamp.getTime());
          var target = now.getTime();
          while(refreshTime.getTime() < target) {
            formatter.nextRefreshTime(refreshTime);
          }
          return {formattedTime: formattedTime,
                  expiresIn: refreshTime};
        }
      }

      // None of the formatters do, so fall back to the non-relative formatter.
      return nonRelativeFormatter(timestamp);
    }
  };
});

//****************************************************************************

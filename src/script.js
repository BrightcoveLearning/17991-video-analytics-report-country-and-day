var BCLS = (function(window, document, Pikaday) {
  var proxyURL =
      "https://solutions.brightcove.com/bcls/bcls-proxy/analyitcs-by-player-day-proxy.php",
    callNumber = 0,
    callType = "",
    // call limit will be reset once we know how many countries have data for the period
    callLimit = 200,
    useMyAccount = document.getElementById("useMyAccount"),
    basicInfo = document.getElementById("basicInfo"),
    accountID = document.getElementById("accountID"),
    client_id = document.getElementById("client_id"),
    client_secret = document.getElementById("client_secret"),
    dateSelector = document.getElementById("dateSelector"),
    reportTableBody = document.getElementById("reportTableBody"),
    account_id = "1752604059001",
    currentDayIndex = 0,
    currentDay,
    dayMax,
    daysObj = {},
    daysArray = [],
    dateToMS,
    dateFromMS,
    fromPicker,
    toPicker,
    analyticsData = {},
    dayMS,
    fromDate = document.getElementById("fromDatePicker"),
    toDate = document.getElementById("toDatePicker"),
    countrySelector = document.getElementById("countrySelector"),
    getData = document.getElementById("getData"),
    gettingDataDisplay = document.getElementById("gettingDataDisplay"),
    today = new Date(),
    weekAgo = new Date(today.valueOf() - 604800000);
  /**
   * Logging function - safe for IE
   * @param  {string} context description of the data
   * @param  {*} message the data to be logged by the console
   * @return {}
   */
  function bclslog(context, message) {
    if (window["console"] && console["log"]) {
      console.log(context, message);
    }
    return;
  }
  // more robust test for strings 'not defined'
  function isDefined(v) {
    if (v === "" || v === null || v === undefined || v === NaN) {
      return false;
    }
    return true;
  }
  /**
   * function that returns iso date for JS date object
   * @param {date} date the date object
   * @return {string} iso date string
   */
  function dateToISO(date) {
    var y = date.getFullYear(),
      m = date.getMonth(),
      d = date.getDate(),
      isoDate;
    y = y.toString();
    m = m + 1;
    if (m < 10) {
      m = "0" + m.toString();
    } else {
      m = m.toString();
    }
    if (d < 10) {
      d = "0" + d.toString();
    } else {
      d = d.toString();
    }
    isoDate = y + "-" + m + "-" + d;
    return isoDate;
  }
  /**
   * get value for selected item
   * @param {HTMLElement} e the selector element
   * @return {String} the value of the selected option
   */
  function getSelectValue(e) {
    return e.options[e.selectedIndex].value;
  }
  /**
   * Get the English name for a month
   * @param {Number} month 0-based number of the month
   * @return {String} the month name
   */
  function getMonthName(month) {
    var name;
    switch (month) {
      case 1:
        name = "Jan";
        break;
      case 2:
        name = "Feb";
        break;
      case 3:
        name = "Mar";
        break;
      case 4:
        name = "Apr";
        break;
      case 5:
        name = "May";
        break;
      case 6:
        name = "Jun";
        break;
      case 7:
        name = "Jul";
        break;
      case 8:
        name = "Aug";
        break;
      case 9:
        name = "Sep";
        break;
      case 10:
        name = "Oct";
        break;
      case 11:
        name = "Nov";
        break;
      case 12:
        name = "Dec";
        break;
    }
    return name;
  }
  /**
   * populate the display table
   */
  function displayData() {
    var displayStr, day, i, iMax, item, selectedDate, selectedCountry;
    // clear the table body
    reportTableBody.innerHTML = "";
    if (getSelectValue(dateSelector) === "all") {
      if (getSelectValue(countrySelector) === "all") {
        // display all dates and countries
        displayStr = "";
        for (day in analyticsData) {
          displayStr +=
            '<tr><th colspan="2">' + analyticsData[day].date + "</th></tr>";
          iMax = analyticsData[day].items.length;
          for (i = 0; i < iMax; i++) {
            item = analyticsData[day].items[i];
            displayStr +=
              "<tr><td>" +
              item.country_name +
              "</td><td>" +
              item.video_view +
              "</td></tr>";
          }
        }
        reportTableBody.innerHTML = displayStr;
      } else {
        // we have a selected country - display values for all dates
        selectedCountry = getSelectValue(countrySelector);
        displayStr = "";
        for (day in analyticsData) {
          displayStr +=
            '<tr><th colspan="2">' + analyticsData[day].date + "</th></tr>";
          iMax = analyticsData[day].items.length;
          for (i = 0; i < iMax; i++) {
            item = analyticsData[day].items[i];
            if (item.country === selectedCountry) {
              displayStr +=
                "<tr><td>" +
                item.country_name +
                "</td><td>" +
                item.video_view +
                "</td></tr>";
            }
          }
        }
        reportTableBody.innerHTML = displayStr;
      }
    } else if (getSelectValue(countrySelector) === "all") {
      // a specific data is selected - display all countries for that data
      displayStr = "";
      selectedDate = getSelectValue(dateSelector);
      day = analyticsData[selectedDate];
      displayStr += '<tr><th colspan="2">' + day.date + "</th></tr>";
      iMax = day.items.length;
      for (i = 0; i < iMax; i++) {
        item = day.items[i];
        displayStr +=
          "<tr><td>" +
          item.country_name +
          "</td><td>" +
          item.video_view +
          "</td></tr>";
      }
      reportTableBody.innerHTML += displayStr;
    } else {
      // a specific date and country are selected - display country views for that date
      displayStr = "";
      selectedDate = getSelectValue(dateSelector);
      selectedCountry = getSelectValue(countrySelector);
      day = analyticsData[selectedDate];
      displayStr += '<tr><th colspan="2">' + day.date + "</th></tr>";
      iMax = day.items.length;
      for (i = 0; i < iMax; i++) {
        item = day.items[i];
        if (item.country === selectedCountry) {
          displayStr +=
            "<tr><td>" +
            item.country_name +
            "</td><td>" +
            item.video_view +
            "</td></tr>";
        }
      }
      reportTableBody.innerHTML += displayStr;
    }
  }
  /**
   * make API calls
   * @param {String} callURL the full URL for the API request
   */
  function makeAnalyticsCall(callURL) {
    var httpRequest = new XMLHttpRequest(),
      options = {},
      newItem = {},
      data,
      requestParams,
      newEl,
      txt,
      // response handler
      getResponse = function() {
        var i,
          j,
          k,
          player,
          video,
          itemsMax,
          str,
          analytics,
          item,
          newItem = {},
          thisVideo;
        try {
          if (httpRequest.readyState === 4) {
            if (httpRequest.status >= 200 && httpRequest.status < 300) {
              data = JSON.parse(httpRequest.responseText);
              bclslog("data", data);
            } else {
              alert(
                "There was a problem with the request. Request returned " +
                  httpRequest.status
              );
            }
          }
        } catch (e) {
          bclslog("e", e);
        }
        if (isDefined(data)) {
          switch (callType) {
            case "countries":
              // add options to the country selector
              str = "";
              itemsMax = data.items.length;
              for (i = 0; i < itemsMax; i++) {
                item = data.items[i];
                str +=
                  '<option value="' +
                  item.country +
                  '">' +
                  item.country_name +
                  "</option>";
              }
              countrySelector.innerHTML =
                '<option value="all" selected="selected">All</option>' + str;
              gettingDataDisplay.innerHTML = "Country data retrieved!";
              getData.innerHTML = "Get Analytics Data";
              // now get the analytics data
              getAnalyticsData();
              callLimit = itemsMax;
              break;
            case "analytics":
              // add the data values to the value object
              analyticsData[currentDay] = {};
              analyticsData[currentDay].date = currentDay;
              analyticsData[currentDay].items = [];
              itemsMax = data.items.length;
              for (i = 0; i < itemsMax; i++) {
                newItem = {};
                item = data.items[i];
                newItem.video_view = item.video_view;
                newItem.country = item.country;
                newItem.country_name = item.country_name;
                analyticsData[currentDay].items.push(newItem);
              }
              if (currentDayIndex < dayMax - 1) {
                currentDayIndex++;
                getAnalyticsData();
              } else {
                gettingDataDisplay.innerHTML =
                  "Data retrieved - " +
                  callNumber +
                  " API calls made. See and filter your data below.";
                // now display the data
                displayData();
              }
              break;
          }
        }
      };
    // use supplied credentials if any
    if (isDefined(client_id.value)) {
      options.client_id = client_id.value;
    }
    if (isDefined(client_secret.value)) {
      options.client_secret = client_secret.value;
    }
    options.url = callURL;
    options.requestMethod = "GET";
    options.requestData = null;
    // increment the call number
    callNumber++;
    // set up request data
    requestParams =
      "url=" + encodeURIComponent(options.url) + "&requestType=GET";
    if (options.client_id && options.client_secret) {
      requestParams +=
        "&client_id=" +
        options.client_id +
        "&client_secret=" +
        options.client_secret;
    }
    // set response handler
    httpRequest.onreadystatechange = getResponse;
    // open the request
    httpRequest.open("POST", proxyURL);
    // set headers
    httpRequest.setRequestHeader(
      "Content-Type",
      "application/x-www-form-urlencoded"
    );
    // open and send request
    bclslog("requestParams", requestParams);
    httpRequest.send(requestParams);
  }

  /**
   * Set up the API requests for country data
   */
  function getCountryData() {
    var callURL;
    account_id = isDefined(accountID.value) ? accountID.value : account_id;
    gettingDataDisplay.textContent = "Getting country data...";
    callType = "countries";
    callURL =
      "https://analytics.api.brightcove.com/v1/data?accounts=" +
      account_id +
      "&dimensions=country&from=" +
      daysArray[0] +
      "&to=" +
      daysArray[daysArray.length - 1] +
      "&fields=country,country_name&sort=country_name&format=json&limit=" +
      callLimit;
    makeAnalyticsCall(callURL);
  }
  /**
   * Set up the API requests for video data
   */
  function getAnalyticsData() {
    var callURL;
    account_id = isDefined(accountID.value) ? accountID.value : "20318290001";
    gettingDataDisplay.textContent = "Getting analytics data...";
    callType = "analytics";
    // currentVideo = videoData.items[currentVideoIndex].video;
    currentDay = daysArray[currentDayIndex];
    callURL =
      "https://analytics.api.brightcove.com/v1/data?accounts=" +
      account_id +
      "&dimensions=country&from=" +
      currentDay +
      "&to=" +
      currentDay +
      "&fields=video_view,country,country_name&sort=country_name&format=json&limit=" +
      callLimit;
    makeAnalyticsCall(callURL);
  }
  /**
   * Initialize the app
   */
  function initializeData() {
    var totalDays,
      i,
      item,
      str = "";
    dateFromMS = new Date(fromDate.value).valueOf();
    dateToMS = new Date(toDate.value).valueOf();
    /**
     * what follows is just math
     * to create to and from params for API calls
     * 86400000 = 1 day in milliseconds
     */
    totalDays = Math.round((dateToMS - dateFromMS) / 86400000);
    for (i = 0; i < totalDays; i++) {
      var newDate = new Date(dateFromMS + i * 86400000);
      daysArray[i] = dateToISO(newDate);
    }
    dayMax = daysArray.length;
    for (i = 0; i < dayMax; i++) {
      item = daysArray[i];
      str += "<option value='" + item + "'>" + item + "</option>";
    }
    dateSelector.innerHTML =
      "<option value='all' selected='selected'>All</option>" + str;
    currentDayIndex = 0;
    currentDay = daysArray[0];
    getCountryData();
  }

  // add date pickers to the date input fields
  fromPicker = new Pikaday({
    field: fromDate,
    format: "YYYY-MM-DD"
  });
  toPicker = new Pikaday({
    field: toDate,
    format: "YYYY-MM-DD"
  });
  // default date range values
  toDate.value = dateToISO(today);
  fromDate.value = dateToISO(weekAgo);

  getData.addEventListener("click", initializeData);
  countrySelector.addEventListener("change", displayData);
  dateSelector.addEventListener("change", displayData);
  useMyAccount.addEventListener("click", function() {
    if (basicInfo.getAttribute("style") === "display:none;") {
      basicInfo.setAttribute("style", "display:block;");
      useMyAccount.innerHTML = "Use Sample Account";
    } else {
      basicInfo.setAttribute("style", "display:none;");
      useMyAccount.innerHTML = "Use My Account Instead";
    }
  });
})(window, document, Pikaday);

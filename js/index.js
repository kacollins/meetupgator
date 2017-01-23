var MG = {};
MG.groups = [];
MG.groupedEvents = {};
MG.dateRange = "";
MG.holidays = [];

//https://codepen.io/KryptoniteDove/post/load-json-file-locally-using-pure-javascript
function loadJSON(filename, async, callback)
{
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'data/' + filename + '.json', async);
    xobj.onreadystatechange = function ()
    {
        if (xobj.readyState == 4 && xobj.status == "200")
        {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

function getGroups()
{
    loadJSON("usergroups", false, function (response)
    {
        // Parse JSON string into object
        MG.groups = JSON.parse(response);
    });
}

function getHolidays()
{
    loadJSON("holidays", true, function (response)
    {
        var holidays = JSON.parse(response);
        var beginDate = getBeginDate();
        var endDate = getEndDate(beginDate);

        for (var i = 0; i < holidays.length; i++)
        {
            var holidayDate = getHolidayDate(holidays[i], beginDate, endDate);
            MG.holidays.push({
                name: holidays[i].name,
                date: holidayDate
            });
        }
    });
}

function getHolidayDate(holiday, beginDate, endDate)
{
    var holidayDate;
    var month = holiday.month - 1;
    var year = beginDate.getFullYear();

    //if holiday month is >= beginDate's month, use beginDate's year
    //if holiday month is <= endDate's month, use endDate's year
    if (month <= endDate.getMonth())
    {
        year = endDate.getFullYear();
    }

    if (holiday.weekDay)
    {
        holidayDate = getDateByWeekDay(year, month, holiday.week, holiday.weekDay);
    }
    else
    {
        holidayDate = new Date(year, month, holiday.monthDay);
    }

    return holidayDate;
}

function renderEvents()
{
    $('#events-list').empty();
    $('#events-table tbody').empty();

    var allEvents = [];
    $.each(MG.groupedEvents, function (groupId)
    {
        allEvents = allEvents.concat(MG.groupedEvents[groupId]);
    });

    // Sort events by time
    allEvents.sort(function (a, b)
    {
        return a.time - b.time;
    });

    // Add to table

    $.each(allEvents, function (index, event)
    {
        var dateTime = moment(event.time).format('YYYY-MM-DD, ddd, h:mma');
        var eventStr = event.event_url == ""
            ? event.name
            : '<a href="' + event.event_url + '">' + event.name + '</a>';
        var groupLink = getGroupLink(event.group.name, event.group.urlname, event.group.website);

        // add to table
        var $eventRow = $('<tr><td>' + dateTime + '<td>' + eventStr + '<td>' + groupLink);
        $eventRow.addClass('group-' + event.group.urlname);
        $('#events-table tbody').append($eventRow);

        var $eventItem = $('<li></li>');
        $eventItem.append(dateTime + ': ' + eventStr + ' (' + groupLink + ')');
        $('#events-list').append($eventItem);
    });

    $('#events-calendar').fullCalendar('refetchEvents');
}

function getGroupLink(groupName, nameInMeetupURL, website)
{
    var groupLink;
    var url;

    if (nameInMeetupURL != undefined && nameInMeetupURL.length > 0)
    {
        url = "http://meetup.com/" + nameInMeetupURL;
    }
    else if (website != undefined && website.length > 0)
    {
        url = website;
    }

    if (url.length > 0)
    {
        groupLink = '<a href="' + url + '">' + groupName + '</a>';
    }
    else
    {
        groupLink = groupName;
    }

    return groupLink;
}

function renderGroups()
{
    $('#groups-table tbody').empty();

    var allGroups = MG.groups;

    // Sort alphabetically
    allGroups.sort(compare);

    $.each(allGroups, function (index, group)
    {
        var groupLink = getGroupLink(group.name, group.nameInMeetupURL, group.website);
        var $groupRow = $('<tr>').addClass('group-' + group.nameInMeetupURL);
        $groupRow.append('<td style="padding:2px">' + groupLink);

        $('#groups-table tbody').append($groupRow);
    });

    if (allGroups.length > 0)
    {
        $('#groups-table').show();
    }
}

function compare(a, b)
{
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function getBeginDate()
{
    var beginDate = new Date(); //first day of last month
    beginDate.setDate(1);
    beginDate.setMonth(beginDate.getMonth() - 1);
    return beginDate;
}

function getEndDate(beginDate)
{
    var endDate = new Date(beginDate); //a year later
    endDate.setMonth(endDate.getMonth() + 12);
    endDate.setDate(endDate.getDate() - 1);
    return endDate;
}

function getDateRange()
{
    var beginDate = getBeginDate();
    var endDate = getEndDate(beginDate);

    MG.dateRange = beginDate.getTime() + "," + endDate.getTime();
}

function createScheduledEventsForMonth(group, asOfDate)
{
    if (group.regularEvents)
    {
        for (var eventIndex = 0; eventIndex < group.regularEvents.length; eventIndex++)
        {
            var event = createScheduledEvent(group, group.regularEvents[eventIndex],
                asOfDate.getFullYear(), asOfDate.getMonth());
            MG.groupedEvents[group.name].push(event);
        }
    }
}

function createRescheduledEventsForMonth(rescheduledEvents, group)
{
    for (var eventIndex = 0; eventIndex < rescheduledEvents.length; eventIndex++)
    {
        var event = {
            name: group.name,
            time: rescheduledEvents[eventIndex],
            event_url: "",
            group: {
                name: group.name,
                urlname: group.nameInMeetupURL,
                website: group.website
            }
        };

        MG.groupedEvents[group.name].push(event);
    }
}

function createEvents(group)
{
    MG.groupedEvents[group.name] = MG.groupedEvents[group.name] || [];

    //create events for 12 months, starting with last month
    for (var i = -1; i <= 10; i++)
    {
        var asOfDate = new Date();
        asOfDate.setDate(1);
        asOfDate.setMonth(asOfDate.getMonth() + i);

        if (group.rescheduledEvents == undefined)
        {
            createScheduledEventsForMonth(group, asOfDate);
        }
        else
        {
            var rescheduledEvents = group.rescheduledEvents
                .map(function (re)
                {
                    return new Date(re);
                })
                .filter(function (red)
                {
                    return red.getFullYear() == asOfDate.getFullYear()
                        && red.getMonth() == asOfDate.getMonth();
                });

            if (rescheduledEvents.length > 0)
            {
                createRescheduledEventsForMonth(rescheduledEvents, group);
            }
            else
            {
                createScheduledEventsForMonth(group, asOfDate);
            }
        }
    }
}

function getUpcomingMeetupEvents(group)
{
    getMeetupEvents(group, "upcoming");
}

function getPastMeetupEvents(group)
{
    getMeetupEvents(group, "past");
}

function removeScheduledEvents(meetupEvents, group)
{
    var meetupDates = meetupEvents.map(function (event)
    {
        return new Date(event.time).getTime();
    });

    MG.groupedEvents[group.name] = MG.groupedEvents[group.name].filter(function (event)
    {
        return !(meetupDates.includes(new Date(event.time).getTime())
                && event.event_url == "");
    });
}

function getMeetupEvents(group, status)
{
    if (group.nameInMeetupURL != undefined && group.nameInMeetupURL.length > 0)
    {
        var meetupParams = {
            'key': '7c967b5971591a623e7a5e793e476a',
            'group_urlname': group.nameInMeetupURL,
            'status': status,
            'time': MG.dateRange
        };
        var meetupUrl = 'https://api.meetup.com/2/events.json?' + $.param(meetupParams) + '&callback=?';

        $.getJSON(meetupUrl, function (data)
        {
            if (data != undefined && data.results != undefined)
            {
                if (data.results.length > 0)
                {
                    removeScheduledEvents(data.results, group);
                    MG.groupedEvents[group.name].push.apply(MG.groupedEvents[group.name], data.results);
                    renderGroups();
                    renderEvents();
                }
            }
            else
            {
                console.log("error getting meetup data", meetupUrl, data);
            }
        });
    }
}

function createScheduledEvent(group, regularEvent, year, month)
{
    var scheduledTime = getScheduledTime(regularEvent, year, month);

    return {
        name: regularEvent.name.length > 0 ? regularEvent.name : group.name,
        time: scheduledTime,
        event_url: "",
        group: {
            name: group.name,
            urlname: group.nameInMeetupURL,
            website: group.website
        }
    };
}

function getScheduledTime(regularEvent, year, month)
{
    var scheduledTime = getDateByWeekDay(year, month, regularEvent.week, regularEvent.weekDay);
    scheduledTime.setHours(regularEvent.hour);
    scheduledTime.setMinutes(regularEvent.minute);

    //TODO: if date is on a holiday, add a week. if that date is not in the same month, subtract a week from the original date.

    return scheduledTime;
}

function getDateByWeekDay(year, month, week, weekDay)
{
    var firstDayOfMonth = new Date(year, month, 1);

    var daysToAdd = weekDay - firstDayOfMonth.getDay();
    if (daysToAdd < 0)
    {
        daysToAdd += 7;
    }

    daysToAdd += 7 * (week - 1);

    var date = new Date(year, month, 1 + daysToAdd);

    //move to 4th week if there isn't a 5th week
    if (date.getMonth() != month)
    {
        date.setDate(date.getDate() - 7);
    }

    return date;
}

function refreshGroups()
{
    getGroups();
    getHolidays();
    getDateRange();
    MG.groups.forEach(createEvents);
    renderGroups();
    renderEvents();
}

function loadOKCAreaEvents()
{
    MG.groups.filter(function (g) { return g.city == "OKC"; }).forEach(getUpcomingMeetupEvents);
    MG.groups.filter(function (g) { return g.city == "OKC"; }).forEach(getPastMeetupEvents);
}

function loadTulsaAreaEvents()
{
    //HACK: need to add area to json
    MG.groups.filter(function (g) { return g.city != "OKC"; }).forEach(getUpcomingMeetupEvents);
    MG.groups.filter(function (g) { return g.city != "OKC"; }).forEach(getPastMeetupEvents);
}

function getDisplayName(event)
{
    var groupName = "";

    var group = MG.groups
        .filter(function (g)
        {
            return (g.nameInMeetupURL != undefined && event.group.urlname != undefined && event.group.urlname != ""
                && g.nameInMeetupURL.toUpperCase() == event.group.urlname.toUpperCase())
                || g.name == event.group.name;
        })
        [0];

    if (group == undefined)
    {
        console.log("group not found", event, MG.groups);
    }
    else
    {
        groupName = group.name;

        if (group.city == "")
        {
            //group is in OKC and Tulsa
            if (event.name.includes("Tulsa") && !groupName.includes("Tulsa"))
            {
                groupName += " (Tulsa)";
            }
            else if (!groupName.includes("OKC"))
            {
                groupName += " (OKC)";
            }
        }
        else if (!groupName.includes(group.city))
        {
            groupName += " (" + group.city + ")";
        }
    }

    return groupName;
}

function getEventURL(event)
{
    if (event.event_url == "")
    {
        if (event.group.urlname == "")
        {
            if (event.group.website == undefined)
            {
                return "";
            }
            else
            {
                return event.group.website;
            }
        }
        else
        {
            return "http://www.meetup.com/" + event.group.urlname;
        }
    }
    else
    {
        return event.event_url;
    }
}

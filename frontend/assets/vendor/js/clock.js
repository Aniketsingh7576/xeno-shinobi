$(document).ready(function() {
    var monthNames = [ lang.January, lang.February, lang.March, lang.April, lang.May, lang.June, lang.July, lang.August, lang.September, lang.October, lang.November, lang.December ];
    var dayNames= [lang.Sunday, lang.Monday, lang.Tuesday, lang.Wednesday, lang.Thursday, lang.Friday, lang.Saturday]
    var timeMin = document.getElementById("time-min")
    var timeSec = document.getElementById("time-sec")
    var timeHour = document.getElementById("time-hours")
    var timeDate = document.getElementById("time-date")
    var newDate = new Date();
    newDate.setDate(newDate.getDate());
    var updateDate = function(){
        // var clockDateFormat = `$DAYNAME $DAY $MONTHNAME $YEAR`
        timeDate.innerHTML = dayNames[newDate.getDay()] + " " + newDate.getDate() + ' ' + monthNames[newDate.getMonth()] + ' ' + newDate.getFullYear();
    }
    if($user.details.clock_date_format){
        var clockDateFormat = `${$user.details.clock_date_format}`
        updateDate = function(){
            const newTimeString = clockDateFormat
                .replaceAll('$DAYNAME',dayNames[newDate.getDay()])
                .replaceAll('$DAY',newDate.getDate())
                .replaceAll('$MONTHNAME',monthNames[newDate.getMonth()])
                .replaceAll('$YEAR',newDate.getFullYear());
            timeDate.innerHTML = newTimeString;
        }
    }
    var second = function(theDate) {
	   var seconds = theDate.getSeconds();
	   timeSec.innerHTML=( seconds < 10 ? "0" : "" ) + seconds;
	}
    var minute = function(theDate) {
    	var minutes = theDate.getMinutes();
        timeMin.innerHTML=(( minutes < 10 ? "0" : "" ) + minutes);
    }
    var hour = function(theDate) {
        var hours = theDate.getHours();
        hours = ( hours < 10 ? "0" : "" ) + hours;
        if(timeHour.classList.contains('twentyfour') && hours > 12)hours = hours - 12;
        timeHour.innerHTML = hours
    }
    function setAll(){
        var theDate = new Date()
        var currentMinute = theDate.getMinutes()
        var currentHour = theDate.getHours()
        var currentDay = theDate.getHours()
        second(theDate)
        if(lastMinute !== currentMinute){
            minute(theDate)
            lastMinute = currentMinute
        }
        if(lastHour !== currentHour){
            hour(theDate)
            lastHour = currentHour
        }
        if(lastDay !== currentDay){
            updateDate()
            lastDay = currentDay
        }
    }
    setAll()
    var lastHour = newDate.getHours()
    var lastMinute = newDate.getMinutes()
    var lastDay = newDate.getDay()
    setInterval(function(){
        setAll()
    },1000);
    setInterval(function(){
        updateDate()
    },1000 * 60 * 60);
    updateDate()
    document.getElementById("clock").onclick = function(){
        timeHour.classList.toggle('twentyfour')
        lastHour = null
        setAll()
        lastHour = newDate.getHours()
        updateDate()
    }
});

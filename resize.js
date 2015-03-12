//----------------------------------------------------------------------
// Copyright (c) 2012-2015 Raytheon BBN Technologies
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and/or hardware specification (the "Work") to
// deal in the Work without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Work, and to permit persons to whom the Work
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Work.
//
// THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
// IN THE WORK.
//----------------------------------------------------------------------

function stopRecentering() {
    if (window.hasOwnProperty('map_resize')) {
        // console.log("Firing resize timeout");
        clearInterval(window.map_resize.interval);
        delete window.map_resize;
    }
}

function keepMapCentered() {
    if (window.hasOwnProperty('map')) {
        if (window.hasOwnProperty('map_resize')) {
            clearTimeout(window.map_resize.timeout);
            window.map_resize.timeout = setTimeout(stopRecentering, 1000);
        } else {
            var map = window.map;
            window.map_resize = Object();
            window.map_resize.center = map.getCenter();
            window.map_resize.interval = setInterval(function() {
                // console.log("Firing resize interval");
                map.panTo(window.map_resize.center);
            }, 100);
            window.map_resize.timeout = setTimeout(stopRecentering, 1000);
        }
    }
}


function resizeLayout(evt) {
    w = $( window ).width();
    h = $( window ).height();
    //console.log("w: " + w + "; h: " + h);

    w3 = Math.floor(w/3);
    h3 = Math.floor(h/3);

    var chartExists = document.getElementById("chart_div_right1");
    if (chartExists) {
	mapw = w3 * 2;
	maph = h3 * 2;
    } else {
	mapw = w;
	maph = h;
    }
    
    // Set up an interval to keep the map center steady
    keepMapCentered();

    $("#map-canvas").css({"position": "fixed",
                   "top": 0,
                   "left": 0,
                   "width": mapw + "px",
                   "min-width": mapw + "px",
                   "max-width": mapw + "px",
                   "height": maph + "px",
                   "min-height": maph + "px",
                   "max-height": maph + "px"});
    $("#chart_div_right1").css({"position": "fixed",
                                "top": 0,
                                "left": mapw,
                                "width": w3 + "px",
                                "min-width": w3 + "px",
                                "max-width": w3 + "px",
                                "height": h3 + "px",
                                "min-height": h3 + "px",
                                "max-height": h3 + "px"});
    $("#chart_div_right2").css({"position": "fixed",
                                "top": h3,
                                "left": mapw,
                                "width": w3 + "px",
                                "min-width": w3 + "px",
                                "max-width": w3 + "px",
                                "height": h3 + "px",
                                "min-height": h3 + "px",
                                "max-height": h3 + "px"});
    $("#chart_div_bottom3").css({"position": "fixed",
                                 "top": maph,
                                 "left": 0,
                                 "width": w3 + "px",
                                 "min-width": w3 + "px",
                                 "max-width": w3 + "px",
                                 "height": h3 + "px",
                                 "min-height": h3 + "px",
                                 "max-height": h3 + "px"});
    $("#chart_div_bottom4").css({"position": "fixed",
                                 "top": maph,
                                 "left": w3,
                                 "width": w3 + "px",
                                 "min-width": w3 + "px",
                                 "max-width": w3 + "px",
                                 "height": h3 + "px",
                                 "min-height": h3 + "px",
                                 "max-height": h3 + "px"});
    $("#chart_div_bottom5").css({"position": "fixed",
                                 "top": maph,
                                 "left": w3 * 2,
                                 "width": w3 + "px",
                                 "min-width": w3 + "px",
                                 "max-width": w3 + "px",
                                 "height": h3 + "px",
                                 "min-height": h3 + "px",
                                 "max-height": h3 + "px"});
}

$(window).resize(resizeLayout);

$(document).ready(resizeLayout);



function resizeLayout(evt) {
    w = $( window ).width();
    h = $( window ).height();
    //console.log("w: " + w + "; h: " + h);

    w3 = Math.floor(w/3);
    h3 = Math.floor(h/3);

    mapw = w3 * 2;
    maph = h3 * 2;
    
    //console.log("mapw: " + mapw + "; maph: " + maph);

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


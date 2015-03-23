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

// This is a script to load the lively total_time per server data and
// present it in a dynamic column graph with a red horizontal
// threshold line

// Strict mode - error undeclared variables
"use strict";

// Load the google charts and draw the chart when loaded
google.load('visualization', '1.0', {'packages':['corechart']});   
google.setOnLoadCallback(drawVisualization);

// Set up static variables
var chart = null; // Initially this is null. We set it once

// Options for the chart. Title, width, height and y-axis must always start at 0
var options = {
    'title' : 'Response Time (msec)',
    'width' : 400,
    'height' : 300,
    'vAxis' : { 'viewWindow': {'min' : 0, 'max' : 450 },
              },
    'legend' : { 'position' : 'none' },
    'chartArea' : { 'width' : '75%' }
};

// The lively date comes back keyed by server URL. Map these to friendly labels
var label_map = [
    { url: "http://tokyo.gee-project.net",
      name: "U. Tokyo, Japan",
      color: "blue" },
    //    { url: "http://nicta.gee-project.net",
    //      name: "NICTA, Australia",
    //      color: "blue" },
    { url: "http://uvic.gee-project.net",
      name: "UVic, Canada",
      color: "blue" },
    { url: "http://stanford.gee-project.net",
      name: "Stanford, US",
      color: "blue" },
    //    { url: "http://tamu.gee-project.net",
    //      name: "Texas A&M, US",
    //      color: "blue" },
    { url: "http://maxgigapop.gee-project.net",
      name: "MAX, US",
      color: "green" },
    { url: "http://iminds.gee-project.net",
      name: "iMinds, Belgium",
      color: "blue" },
    { url: "http://141.89.225.14",
      name: "HPI, Germany",
      color: "blue" },
];

// The value at which to place the threshold red horizontal line
var threshold_level = 150;

// Add a red threshold line
// This is added once to the chart, doesn't need to be re-added with new data
function addLine() {
    var newLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    newLine.setAttribute('id', 'lineId');
    newLine.setAttribute('style', 'stroke:rgb(0,0,0); stroke-width:3;');
    newLine.setAttribute('x1', 
                         chart.getChartLayoutInterface().getChartAreaBoundingBox().left);
    newLine.setAttribute('y1', 
                         chart.getChartLayoutInterface().getYLocation(threshold_level));
    newLine.setAttribute('x2',
                         chart.getChartLayoutInterface().getChartAreaBoundingBox().left + 
                         chart.getChartLayoutInterface().getChartAreaBoundingBox().width);
    newLine.setAttribute('y2', 
                         chart.getChartLayoutInterface().getYLocation(threshold_level));
    newLine.setAttribute('style', 'stroke:red;stroke-width:2');
    $("svg").append(newLine);
}


// Top-level method, called on initialization and then every 5 seconds
function drawVisualization() {
    // Create the table first time through
    if(chart == null)  {
        var div_elt = document.getElementById('chart_div');
        chart = new google.visualization.ColumnChart(div_elt);
        $(div_elt).draggable();
    }

    // URL for grabbing lively data
    var grab_lively_url = "grab_lively_data.php"
    $.getJSON(grab_lively_url, function(json_data) {
        // In the JSON callback, we have the JSON data from server
        // Create an array data, start with headder line
        // role:style allows per-bar color changes
        var rows = [['Server', 'Total Time', { role: 'style' }]];
        $.each(label_map, function(i, site) {
            var json_idx = '"' + site.url + '"';
            var site_data = json_data[json_idx];
            if (! site_data) return;

            var total_time = site_data['total_time'];


            // These two lines are just to test animation
            //                 var noise = Math.floor(Math.random() * 200) - 100; // Between -100..100
            //                 total_time = Math.max(0, total_time + noise);


            // Create a row per server
            var row = [site.name, total_time, site.color];
            rows.push(row);
        });
        var data = google.visualization.arrayToDataTable(rows);
        // Redraw the same chart with new data
        chart.draw(data, options);
        setTimeout(drawVisualization, 20000);
        
    });

    // Create a one-time listener when the chart is ready, add the line and
    // then turn off the listener (we only need to add the line once.
    var runOnce = google.visualization.events.addListener(chart, 
                                                          'ready', function() {
                                                              addLine();
                                                              google.visualization.events.removeListener(runOnce);
                                                          });

};


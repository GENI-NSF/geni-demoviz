// This is a script to load the lively total_time per server data
// And present it in a dynamic column graph with a red horizontal threshold line

// Load the google charts and draw the chart when loaded
google.load('visualization', '1.0', {'packages':['corechart']});   
google.setOnLoadCallback(drawVisualization);

// Set up static variables
chart = null; // Initially this is null. We set it once
// Options for the chart. Title, width, height and y-axis must always start at 0
options = {'title' : 'GEC22 Pollution Demonstration:\nTotal Time per Server',
           'width' : 400,
           'height' : 300,
           'vAxis' : { 'minValue' : 0}
          };

// The lively date comes back keyed by server URL. Map these to friendly labels
label_map = {
    "http://uvic.gee-project.net" : "Canada",
    "http://nicta.gee-project.net" : "Australia",
    "http://tamu.gee-project.net" : "Texas A&M",
    "http://stanford.gee-project.net" : "Stanford",
    "http://n091-vm01-2.wall2.ilabt.iminds.be" : "Belgium",
    "http://iminds.gee-project.net" : "Belgium"

};

// The value at which to place the threshold red horizontal line
threshold_level = 150;

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
        // Create a new data table and rows
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Server');
        data.addColumn('number', 'Total Time');
        rows = [];
        for(var server in json_data) {
            var total_time = json_data[server]['total_time'];

            // These two lines are just to test animation
            //                 var noise = Math.floor(Math.random() * 200) - 100; // Between -100..100
            //                 total_time = Math.max(0, total_time + noise);

            // The servers come back bounded by quotes: strip on both ends
            server = server.replace(/"/g, '');

            // Use friendly label if we can
            var server_label = server;
            if (server in label_map) server_label = label_map[server];

            // Create a row per server
            row = [server_label, total_time];
            rows.push(row);
        }
        data.addRows(rows);
        // Redraw the same chart with new data
        chart.draw(data, options);
        setTimeout(drawVisualization, 5000);
        
    });

    // Create a one-time listener when the chart is ready, add the line and
    // then turn off the listener (we only need to add the line once.
    var runOnce = google.visualization.events.addListener(chart, 
                                                          'ready', function() {
                                                              addLine();
                                                              google.visualization.events.removeListener(runOnce);
                                                          });

};


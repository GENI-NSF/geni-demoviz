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

// Strict mode - error undeclared variables
"use strict";

function initCase(lowerstring) {
    return lowerstring.charAt(0).toUpperCase() + lowerstring.slice(1);
}

// Is the given metric enabled?
function metric_enabled(metric, selected_metrics) {
    return selected_metrics == "" || selected_metrics.indexOf(metric) >= 0;
}

// This is called once the Google chart stuff is loaded. We then grab the data and
// plot the char
function drawVisualization(data_type, senders, tablename, selected_metrics, chartdiv, showXAxis, seconds, chartTitle, interfaceNames, frequency) {
    if (typeof seconds === 'undefined' || seconds === null) {
	var url_params = getURLParameters();
	seconds = Number(url_params.seconds) || 120;
    }
    if (typeof interfaceNames === 'undefined') {
	interfaceNames = 'eth1';
    }
    var url = 'grab_metrics_data.php?data_type=' + data_type + '&senders=' + senders + '&seconds=' + seconds;
    if (data_type == 'generic') {
        url = 'grab_generic_metrics_data.php?tablename=' + tablename + '&senders=' + senders + '&metrics=' + selected_metrics
    }
    $.getJSON(url, 
              function(data) { 
		  // In the return from the $.getJSON call to grab_metrics_data we plot the data
		  drawChart(data, senders, selected_metrics, chartdiv, data_type, tablename, showXAxis, seconds, chartTitle, interfaceNames, frequency); 
	      });
};

// Add a column for this metric if it is selected
function maybeAddMetricColumn(metric, selected_metrics, num_senders, num_metrics, data, metric_label, unique_sender, interfaceName) {
    if (metric_enabled(metric, selected_metrics)) {
	addMetricColumn(data, num_senders, num_metrics, metric_label, unique_sender, interfaceName);
    }
}

// Add the given metrics column with a proper label
function addMetricColumn(data, num_senders, num_metrics, metric, unique_sender, interfaceName) {
    if (num_senders == 1) {
	data.addColumn('number', metric);
    } else if (num_metrics == 1) {
	if (typeof interfaceName !== 'undefined') {
	    data.addColumn('number', unique_sender + ':' + interfaceName);
	} else {
	    data.addColumn('number', unique_sender);
	}
    } else {
	if (typeof interfaceName !== 'undefined') {
	    data.addColumn('number', metric + ' ' + unique_sender + ':' + interfaceName);
	} else {
	    data.addColumn('number', metric + ' ' + unique_sender);
	}
    }
}

// Add columns to the table based on which metrics are selected
function addColumns(data_type, data, unique_sender, senders, selected_metrics, interfaceName)
{
    var split_senders = senders.split(',');
    var num_senders = split_senders.length;
    var split_metrics = selected_metrics.split(',');
    var num_metrics = split_metrics.length;
    // For column names:
    // If 1 sender: leave unique_sender off the name
    // If 1 metric: include only unique_sender
    if (data_type == 'generic') {
	for(var j = 0; j < num_metrics; j++) {
	    var metric = split_metrics[j];
	    addMetricColumn(data, num_senders, num_metrics, metric, unique_sender);
	}
    } else if (data_type == 'network') {
	if (selected_metrics === '') num_metrics = 1;
	maybeAddMetricColumn('tot_bytes', selected_metrics, num_senders, num_metrics, data, 'Total', unique_sender, interfaceName);
	maybeAddMetricColumn('rx_bytes', selected_metrics, num_senders, num_metrics, data, 'RX', unique_sender, interfaceName);
	maybeAddMetricColumn('tx_bytes', selected_metrics, num_senders, num_metrics, data, 'TX', unique_sender, interfaceName);
    } else if (data_type == 'cpu') {
	maybeAddMetricColumn('user', selected_metrics, num_senders, num_metrics, data, 'User', unique_sender);
	maybeAddMetricColumn('sys', selected_metrics, num_senders, num_metrics, data, 'Sys', unique_sender);
	maybeAddMetricColumn('idle', selected_metrics, num_senders, num_metrics, data, 'Idle', unique_sender);
    } else { // Memory
	maybeAddMetricColumn('used', selected_metrics, num_senders, num_metrics, data, 'Used', unique_sender);
	maybeAddMetricColumn('free', selected_metrics, num_senders, num_metrics, data, 'Free', unique_sender);
	maybeAddMetricColumn('actual_used', selected_metrics, num_senders, num_metrics, data, 'Act. Used', unique_sender);
	maybeAddMetricColumn('actual_free', selected_metrics, num_senders, num_metrics, data, 'Act. Free', unique_sender);
    }
}

// How many columns are there for this data type? Depends on which are enabled
function numDataColumns(data_type, selected_metrics) {
    var num_columns = 0;
    if(data_type == "generic") {
        var split_metrics  = selected_metrics.split(',');
        num_columns = split_metrics.length;
    } else if(data_type == 'network') {
	if (metric_enabled('tot_bytes', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('rx_bytes', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('tx_bytes', selected_metrics)) num_columns = num_columns + 1;
    } else if (data_type  == 'cpu') {
	if (metric_enabled('user', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('sys', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('idle', selected_metrics)) num_columns = num_columns + 1;
    } else {
	// Memory
	if (metric_enabled('used', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('free', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('actual_used', selected_metrics)) num_columns = num_columns + 1;
	if (metric_enabled('actual_free', selected_metrics)) num_columns = num_columns + 1;
    }
    return num_columns;
}

// Fill in row of data for given type based on selected metrics
function fillRow(data_type, row, metric, sender_index, selected_metrics, interfaceName) {
    var num_columns = numDataColumns(data_type, selected_metrics);
    var metric_index = 1;
    var ret = true;
    if (data_type == 'generic' ) {
        var split_metrics  = selected_metrics.split(',');
        var num_metrics = split_metrics.length;
	for(var i = 0; i < num_metrics; i++) {
	    var metric_name = split_metrics[i];
	    var value = parseFloat(metric[metric_name]);
	    row[num_columns*sender_index+metric_index] = value;
	    metric_index = metric_index + 1;
        }
    }
    else if (data_type == 'network') {
	var rx_bytes = parseFloat(metric.rx_bytes);
	var tx_bytes = parseFloat(metric.tx_bytes);
	var tot_bytes = rx_bytes + tx_bytes;
	var ifc = metric.name;
	if (interfaceName == ifc) {
            if (metric_enabled('tot_bytes', selected_metrics)) {
		row[num_columns*sender_index+metric_index] = tot_bytes;
		metric_index = metric_index + 1;
            }
            if (metric_enabled('rx_bytes', selected_metrics)) {
		row[num_columns*sender_index+metric_index] = rx_bytes;
		metric_index = metric_index + 1;
            }
            if (metric_enabled('tx_bytes', selected_metrics)) {
		row[num_columns*sender_index+metric_index] = tx_bytes;
            }
	} else {
	    ret = false;
	}
    } else if (data_type == 'cpu') {
        var user = parseFloat(metric.user);
        var sys = parseFloat(metric.sys);
        var idle = parseFloat(metric.idle);
        if (metric_enabled('user', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = user;
	    metric_index = metric_index + 1;
        }
        if (metric_enabled('sys', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = sys;
	    metric_index = metric_index + 1;
        }
        if (metric_enabled('idle', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = idle;
        }
    } else {
	// Memory
        var used = parseFloat(metric.used);
        var free = parseFloat(metric.free);
        var actual_used = parseFloat(metric.actual_used);
        var actual_free = parseFloat(metric.actual_free);
        if (metric_enabled('used', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = used;
	    metric_index = metric_index + 1;
        }
        if (metric_enabled('free', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = free;
	    metric_index = metric_index + 1;
        }
        if (metric_enabled('actual_used', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = actual_used;
	    metric_index = metric_index + 1;
        }
        if (metric_enabled('actual_free', selected_metrics)) {
	    row[num_columns*sender_index+metric_index] = actual_free;
        }
    }
    return ret;
}

// Fill in null entries by interpolating between adjacent points
function interpolateRows(rows) {
    var num_rows = rows.length;
    if (num_rows == 0) return;
    var num_cols = rows[0].length;
    // Skip the first 'ts' column
    for(var col = 1; col < num_cols; col++) {
	for(var i = 0; i < num_rows; i++) {
            if(rows[i][col] == null) {
		if (i > 0 && rows[i-1][col] != null)
	            rows[i][col] = rows[i-1][col];
		else if (i < num_rows-1 && rows[i+1][col] != null)
	            rows[i][col] = rows[i+1][col];
            }
	    rows[i][0] = i; // Set TS to sequential count, not actual (meaningless) TS
	}
    }
}

// Make the values in slot X = slot(X)-slot(X-1) 
// Where slot(X-1) is the previous entry for that sender
// Put Slot(0) = Slot(1)
function computeDeltas(rows, metric_data, compute_rate) {
    var num_rows = rows.length;

    var current_by_sender = {};
    var predecessors = [];
    predecessors[num_rows-1] = undefined;
    var successors = [];
    successors[num_rows-1] = undefined;

    var indices_by_sender = {};

    for(var i = 0; i < num_rows; i++) {
	var sender = metric_data[i].sender;
	if(!(sender in current_by_sender)) {
	    predecessors[i] = -1;
    	} else {
	    var prev = current_by_sender[sender];
	    predecessors[i] = prev;
	    if (predecessors[prev] == -1)
		successors[prev] = i;
	}
	current_by_sender[sender] = i;
    }
    var num_cols = rows[0].length;
    // Skip the first 'ts' column
    for(var col = 1; col < num_cols; col++) {
	for(var row = num_rows-1; row >= 0; row--) {
	    var pred_index = predecessors[row];
	    if (pred_index > -1) {
		rows[row][col] = rows[row][col] - rows[pred_index][col];
		if (compute_rate){
		    var delta_t = rows[row][0] - rows[pred_index][0];
		    rows[row][col] = rows[row][col]/delta_t;
		}
	    } else {
		var succ_index = successors[row];
		if (succ_index != undefined)
		    rows[row][col] = rows[succ_index][col];
	    }
        }
	rows[0][col] = rows[1][col];
    }
}

// Draw the chart by grabbing the data, creating the table
// adding the columns and then adding the rows
    function drawChart(metric_data, senders, selected_metrics, chartdiv, data_type, tablename, showXAxis, seconds, chartTitle, interfaceNames, frequency)
{
    var unique_senders_assoc = {}
    var num_unique_senders = 0;
    var sender = null;
    for(var i = 0; i < metric_data.length; i++) {
        var metric = metric_data[i];
	var sender = metric.sender;
	if (!(sender in unique_senders_assoc)) {
	    unique_senders_assoc[sender] = num_unique_senders;
	    num_unique_senders = num_unique_senders + 1;
        }
    }

    // In case of data_type = generic
    // Add any senders that don't have any data, so they appear in legend but with no line
    if (data_type == 'generic') {
	var split_senders = senders.split(',');
	for(var i = 0; i < split_senders.length; i++) {
	    var sender = split_senders[i];
	    if(!(sender in unique_senders_assoc)) {
		unique_senders_assoc[sender] = num_unique_senders;
		num_unique_senders = num_unique_senders + 1;
	    }
	}
    }

    var unique_senders = [];
    for(var sender in unique_senders_assoc) unique_senders.push(sender);
    unique_senders.sort(); // We want a list of unique, sorted senders

    var data = new google.visualization.DataTable();
    data.addColumn('number', 'TS');

    var split_ifcs = interfaceNames.split(',');
    var num_ifcs = split_ifcs.length;
    var split_senders = senders.split(',');
    var num_senders = split_senders.length;
    if (data_type == 'network' && num_ifcs != num_senders) {
	console.log("Sender/IFC mismatch: " + senders + ", " + interfaceNames);
    }

    // If no specific metrics are selected,
    // then show 'user' for 'cpu', and 'used' for 'memory'
    if (selected_metrics == '') {
	if (data_type == 'cpu') {
	    selected_metrics = 'user';
	} else if (data_type == 'memory') {
	    selected_metrics = 'used';
	} else if (data_type == 'network') {
	    selected_metrics = 'tot_bytes';
	}
    }

    for(var i = 0; i < unique_senders.length; i++) {
	var unique_sender = unique_senders[i];
	var sender_index = unique_senders_assoc[unique_sender];
	var interfaceName = split_ifcs[sender_index];
        addColumns(data_type, data, unique_sender, senders, selected_metrics, interfaceName);
    }

    var rows = [];
    for(var i = 0; i < metric_data.length; i++) {
        var metric = metric_data[i];
	var ts = parseFloat(metric.ts);
	var sender = metric.sender;
	var sender_index = unique_senders_assoc[sender];
	var row = [ts];
	for(var j = 0; j < num_unique_senders; j++) {
	    for(var k = 0; k < numDataColumns(data_type, selected_metrics); k++)
		row.push(null); // Place holders for entries from the appropriate sender
        }
	var interfaceName = split_ifcs[sender_index];
	if (fillRow(data_type, row, metric, sender_index, selected_metrics, interfaceName)) {
	    rows.push(row);
	}
    }

    if (rows.length > 0) {
	interpolateRows(rows);
	if (data_type ==  'network')
	    computeDeltas(rows, metric_data, true);
	else if (data_type == 'cpu')
	    computeDeltas(rows, metric_data, false);
        data.addRows(rows);
    }

    var split_metrics = selected_metrics.split(',');
    var num_metrics = split_metrics.length;
    if (data_type == 'network') {
	if (selected_metrics === '') num_metrics = 2;
    }
    // Calculate chart title
    // 1 sender & 1 metric: sender metric data_type
    // 1 sender mult metrics: sender data_Type metrics
    // mult senders 1 metric: metric data type
    // mult senders mult metrics: data_type metrics
    var title = initCase(data_type) + ' Metrics';
    if (data_type == 'generic') title = initCase(selected_metrics) + ' Metrics';
    var showLegend = 'right';

    var title_type = initCase(data_type);
    if (data_type == 'cpu') {
	title_type = 'CPU';
    }
    var title_sender = initCase(sender);
    if (data_type == 'network') {
	var sender_index = unique_senders_assoc[sender];
	var interfaceName = split_ifcs[sender_index];
	title_sender = title_sender + ":" + interfaceName;
    }
    var title_metric = initCase(selected_metrics);
    if (num_metrics == 1 && data_type == 'network') {
	if (selected_metrics == 'tot_bytes') {
	    title_metric = 'Total Bytes';
	} else if (selected_metrics == 'rx_bytes') {
	    title_metric = 'RX Bytes';
	} else {
	    title_metric = 'TX Bytes';
	}
    }
    if (num_unique_senders == 1 && num_metrics == 1) {
	title = title_sender + " " + title_metric + " " + title_type;
	if (data_type == 'generic') title = title_sender + " " + title_metric;
	showLegend = 'none';
    } else if (num_unique_senders == 1) {
	title = title_sender + " " + title;
	// Legend lists metric not sender
	showLegend = 'right';
    } else if (num_metrics == 1) {
	title = title_metric + " " + title_type;
	if (data_type == 'generic') title = title_metric;
	// Legend lists sender not metric
	showLegend = 'right';
    }

    if (typeof chartTitle !== 'undefined' && chartTitle != '' && chartTitle != null) {
	title = chartTitle;
    }

    var xAxisDisplay = 'none';
    var height = '75%';
    if (typeof showXAxis !== 'undefined' && showXAxis !== false) {
	xAxisDisplay = 'out';
	height = '65%';
    }

    var width = '60%';
    if (showLegend === 'none') {
	width = '85%';
    }

    // axisTitlesPosition
    // vAxis.textPosition
    var options = {
	titleTextStyle: {
	    fontSize: 16
	},
	vAxis: {
	    textStyle: {
		fontSize: 10
	    },
	    minValue: 0,
	    viewWindow: {
		min: 0
	    }
	},
	title: title,
        chart: {
	    title: title,
	},
	chartArea: {
	    height: height,
	    width: width
	},
	legend: {
	    position: showLegend
	},
	hAxis: {
	    textPosition: xAxisDisplay
	}
    };

    // To force a graph type to extend up to a particular number (rounded up to next tick mark):
    if (data_type == 'cpu' || data_type == 'memory') {
	options.vAxis.maxValue = 100;
    }

    var container = document.getElementById(chartdiv);
    if (rows.length > 0) {
        if (container) {
            var chart = new google.visualization.LineChart(container);
            chart.draw(data, options);
        }
    } else {
        $(container).empty(); // Remove the current map
    }
    

    // Refresh every N (default = 5) seconds
    setTimeout(function() {drawVisualization(data_type, senders, tablename, selected_metrics, chartdiv, 
	       showXAxis, seconds, chartTitle, interfaceNames, frequency);}, 
	       frequency);

}

google.load('visualization', '1');
//google.setOnLoadCallback(drawVisualization);

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

// Establish the geni namespace
var gec;
gec = gec || {};

// Establish the charts sub-namespace
gec.charts = {

    allCharts: {},

    getChart: function(id) {
        return this.allCharts[id];
    },

    addChart: function(chart, id) {
        this.allCharts[id] = chart;
        return chart;
    },

};


function initCase(lowerstring) {
    if (lowerstring) {
	return lowerstring.charAt(0).toUpperCase() + lowerstring.slice(1);
    } else {
	return lowerstring;
    }
}

// Is the given metric enabled?
function metric_enabled(metric, selected_metrics) {
    return selected_metrics == "" || selected_metrics.indexOf(metric) >= 0;
}

// This is called once the Google chart stuff is loaded. We then grab the data and
// plot the char
function drawVisualization(data_type, senders, tablename, selected_metrics, chartdiv, showXAxis, seconds, chartTitle, interfaceNames, refreshSeconds) {
    var url_params = getURLParameters();
    if (typeof seconds === 'undefined' || seconds === null) {
	seconds = Number(url_params.seconds) || 120;
    }
    if (! refreshSeconds) {
        refreshSeconds = Number(url_params.chart_refresh || 5);
    }
    // interfaceNames defaults to 1 eth1 per sender
    if (typeof interfaceNames === 'undefined' && typeof senders !== 'undefined') {
	var split_senders = senders.split(',');
	var num_senders = split_senders.length;
	var ifcs = [];
	for (var i = 0; i < num_senders; i++) {
	    ifcs.push('eth1');
	}
	interfaceNames = ifcs.join();
	interfaceNames = 'eth1';
    }
    var url = 'grab_metrics_data.php?data_type=' + data_type + '&senders=' + senders + '&seconds=' + seconds;
    if (data_type == 'generic') {
        url = 'grab_generic_metrics_data.php?tablename=' + tablename + '&senders=' + senders + '&metrics=' + selected_metrics
    }
    $.getJSON(url, 
              function(data) { 
		  // In the return from the $.getJSON call to grab_metrics_data we plot the data
		  drawChart(data, senders, selected_metrics, chartdiv, data_type, tablename, showXAxis, seconds, chartTitle, interfaceNames, refreshSeconds); 
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
function addColumns(data_type, data, unique_sender, num_senders, selected_metrics, interfaceName)
{
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

// Make timestamps into relative offsets from 1st timestamp in dataset
function standardizeTimestamps(rows) 
{
    var num_rows = rows.length;
    var earliest = rows[0][0];
    for(var i = 0; i < num_rows; i++) {
	rows[i][0] = rows[i][0] - earliest; 
    }
}

function interpolateDeltaColumn(rows, col, doDT) {
    // If doDT then the delta is per unit time
    var num_rows = rows.length;
    // Find the filled in values
    var non_null_indices = [];
    for(var i = 0; i < num_rows; i++) {
	if (rows[i][col] != null) {
	    non_null_indices.push(i);
	}
    }

    // for each no null index, starting with 2nd
    // diff val[nni[i]] - val[nni[i-1]]
    // networ: ts[nni[i]] - ts[nni[i-1]]
    // cpu: straight diff
    // other: no diff (old code

    // FIXME: Handle case where there's only 1 null-null index

    var startIndex = 0;
    if (non_null_indices.length == 1) {
	// If we have only 1 data point, assume the usage started at 0? (So the delta is the full thing)
	// the alternative would be we assume nothing was used before, so the delta should be 0.
	var i = non_null_indices[0];
	var delta = rows[i][col];
	// var delta = 0;
	if (doDT) {
	    var DT = rows[i][0];
	    delta = delta / DT;
	}
	for (var j = startIndex; j < i; j++) {
	    rows[j][col] = delta;
	}
	startIndex = non_null_indices[i];
    } else {    
	for (var i = 1; i < non_null_indices.length; i++) {
	    var delta = rows[non_null_indices[i]][col] - rows[non_null_indices[i-1]][col];
	    if (doDT) {
		var DT = rows[non_null_indices[i]][0] - rows[non_null_indices[i-1]][0];
		delta = delta / DT;
	    }
	    for (var j = startIndex; j < non_null_indices[i]; j++) {
		rows[j][col] = delta;
	    }
	    startIndex = non_null_indices[i];
	}
    }
    if (startIndex > 0) {
	for (var i = startIndex; i < num_rows; i++) {
	    rows[i][col] = rows[(startIndex - 1)][col];
	}
    } else {
	// only non null index was the 1st entry. So how do we project forward?
	// Either assume all values are same as the 1 non-null, or all values are 0
	for (var i = 0; i < num_rows; i++) {
	    rows[i][col] = rows[0][col];
	}
    }
}

// Fill in null entryes by interpolating between nearby points
function interpolateColumn(rows, col, data_type)
{

    // if data_type is network:
    // value in a row is next-this/nextTime-thisTime
    // if data_type is cpu
    // value in row is next-this

    if (data_type == 'network') {
	interpolateDeltaColumn(rows, col, true);
	return;
    } else if (data_type == 'cpu') {
	interpolateDeltaColumn(rows, col, false);
	return;
    }
    
    var num_rows = rows.length;
    // Find the filled in values
    var non_null_indices = [];
    for(var i = 0; i < num_rows; i++) {
	if (rows[i][col] != null) {
	    non_null_indices.push(i);
	}
    }

//    console.log("Col: " + col);
//    var vals = []
//    for (var i = 0; i < rows.length; i++)
//	vals.push(rows[i][col]);
//    console.log(vals);

    for (var i = 0; i < non_null_indices.length; i++) {
	if (i == 0) {
	    // copy this value backwards
	    var firstNonNullIndex = non_null_indices[i];
	    for (var j = 0; j < firstNonNullIndex; j++) {
		rows[j][col] = rows[firstNonNullIndex][col];
	    }
	} else if (i == non_null_indices.length - 1) {
	    // copy this value forwards
	    var lastNonNullIndex = non_null_indices[i];
	    for (var j = lastNonNullIndex+1; j < num_rows; j++) {
		rows[j][col] = rows[lastNonNullIndex][col];
	    }
	}
	// Copy forward
	if (i > 0) {
	    var startRange = non_null_indices[i-1];
	    var endRange = non_null_indices[i];
	    var startValue = rows[startRange][col];
	    var endValue = rows[endRange][col];
	    var toAdd = (endValue-startValue) / (endRange - startRange);
	    var baseValue = startValue;
	    for (var j=startRange+1; j < endRange; j++) {
		rows[j][col] = baseValue + toAdd;
		baseValue = rows[j][col];
	    }
	}
    }
//    console.log("Col: " + col);
//    vals = []
//    for (var i = 0; i < rows.length; i++)
//	vals.push(rows[i][col]);
//    console.log(vals);
}

// Fill in null entries by interpolating between adjacent points
function interpolateColumns(rows, metric_data, data_type) {
    var num_rows = rows.length;
    if (num_rows == 0) return;
    var num_cols = rows[0].length;
    // Skip the first 'ts' column
    for(var col = 1; col < num_cols; col++) {
	interpolateColumn(rows, col, data_type);
    }
}

// Fill in null entries by interpolating between adjacent points
function interpolateColumns_orig(rows, metric_data) {
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
function computeDeltas(rows, metric_data, compute_rate, data_type) {
    return;

    // Old: Now done by interpolate
    
    var num_rows = rows.length;
    if (num_rows < 2) {
	return;
    }
    var num_cols = rows[0].length;
    for (var j = 1; j < num_cols; j++) {
	for (var i = 0; i < num_rows-1; i++) {
	    console.log("before: " + rows[i][j] + "; next: " + rows[i+1][j]);
	    rows[i][j] = rows[i+1][j] - rows[i][j];
	    console.log("after: " + rows[i][j]);
	}
	rows[num_rows-1][j] = rows[num_rows-2][j];
    }
    return;

    // Old
    
    var current_by_sender = {};
    var predecessors = [];
    predecessors[num_rows-1] = undefined;
    var successors = [];
    successors[num_rows-1] = undefined;

    var indices_by_sender = {};

    for(var i = 0; i < num_rows; i++) {
	var sender = metric_data[i].sender;
	var name = metric_data[i].name;
	var senderfull = sender;
	if (data_type == 'network') {
	    senderfull = sender + ':' + name;
	}
	sender = senderfull;
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
    function drawChart(metric_data, senders, selected_metrics, chartdiv, data_type, tablename, showXAxis, seconds, chartTitle, interfaceNames, refreshSeconds)
{
    var unique_senders_assoc = {}; // key by sender name to # of unique senders. Sender name concats real name and ifc for network
    var num_unique_senders = 0; // counting as 2 1 sender with 2 ifcs
    var unique_senders_ids = {}; // key by sender to OML sender ID. This is just the short sender name.
    var unique_senders_idxs = {}; // key by sender to index in senders string. This is just the short sender name.
    var split_senders = senders.split(',');
    var num_senders = split_senders.length;
    var split_ifcs = interfaceNames.split(',');
    var num_ifcs = split_ifcs.length;
    var new_ifcs = split_ifcs;
    if (num_ifcs < num_senders) {
	for (j = num_ifcs; j < num_senders; j++) {
	    new_ifcs.push('eth1');
	}
	split_ifcs = new_ifcs
	interfaceNames = split_ifcs.join();
	num_ifcs = split_ifcs.length;
    }
    
    // sender is a name
    // oml_sender_id should be first thing in metric_data
    for(var i = 0; i < metric_data.length; i++) {
        var metric = metric_data[i];
	var sender = metric.sender;
	var name = metric.name;
	var senderfull = sender;
	if (data_type == 'network') {
	    senderfull = sender + ":" + name;
	}
	if (!(senderfull in unique_senders_assoc)) {
	    var idxs = unique_senders_idxs[sender] || [];
	    var foundIfc = false;
	    for (var j = 0; j < num_senders; j++) {
		if (metric.oml_sender_id == split_senders[j]) {
		    if (data_type != 'network' || name == split_ifcs[j]) {
			foundIfc = true;
			idxs.push(j);
			break;
		    }
		}
	    }
	    if (! foundIfc) {
		// The sender/interface in this row of data is not a combination we asked for
		// Therefore, don't count it as one of the unique senders
		continue;
	    }
	    unique_senders_ids[sender] = metric.oml_sender_id;
	    unique_senders_idxs[sender] = idxs;
	    unique_senders_assoc[senderfull] = num_unique_senders;
	    num_unique_senders = num_unique_senders + 1;
        }
    }

    var split_senders = senders.split(',');

    //console.log("NUS = " + num_unique_senders);
    //console.log("SPLIT_SENDERS = " + split_senders.length);

    // In case of data_type = generic
    // Add any senders that don't have any data, so they appear in legend but with no line
    // for generics, the sender in senders is a name; for non generics it is an ID (#)
    if (data_type == 'generic') {
	for(var i = 0; i < split_senders.length; i++) {
	    var sender = split_senders[i];
	    if(!(sender in unique_senders_assoc)) {
		unique_senders_assoc[sender] = num_unique_senders;
		num_unique_senders = num_unique_senders + 1;
	    }
	}
    }

    var unique_senders = []; // List of sender names
    for(var sender in unique_senders_assoc) unique_senders.push(sender);
    unique_senders.sort(); // We want a list of unique, sorted senders

    unique_senders_assoc = {};
    for(var i in unique_senders) {
	var sender = unique_senders[i];
	unique_senders_assoc[sender] = i;
    }

    var data = new google.visualization.DataTable();
    data.addColumn('number', 'TS');

//    if (num_senders != num_unique_senders) {
//	console.log("Data returned " + num_unique_senders + " unique senders but arg specified " + num_senders);
//    }
    if (data_type == 'network' && num_ifcs != num_senders) {
	console.log("Sender/IFC count mismatch: " + senders + ", " + interfaceNames);
	if (data_type == 'network' && num_ifcs == num_unique_senders) {
	    console.log("... but matched # of unique senders");
	}
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

	// pull out the proper interfaceName
	var interfaceName = null;
	if (data_type == 'network') {
	    var senderps = unique_sender.split(':');
	    unique_sender = senderps[0];
	    interfaceName = senderps[1];
	}
	
        addColumns(data_type, data, unique_sender, num_unique_senders, selected_metrics, interfaceName);
    }

    var rows = [];
    for(var i = 0; i < metric_data.length; i++) {
        var metric = metric_data[i];
	var ts = parseFloat(metric.ts);
	var sender = metric.sender;
	var senderful = sender;
	if (data_type == 'network') {
	    senderful = sender + ':' + metric.name;
	}
	var sender_index = unique_senders_assoc[senderful]; // count in list of unique senders (counting diff ifcs)
	if (typeof sender_index === 'undefined') {
	    // the sender/ifc name isn't in the array - skip this row (didnt ask for this interface)
	    continue;
	}
	var row = [ts];
	// Add 1 null in the row per sender/ifc combo per metric
	for(var j = 0; j < num_unique_senders; j++) {
	    for(var k = 0; k < numDataColumns(data_type, selected_metrics); k++)
		row.push(null); // Place holders for entries from the appropriate sender
        }

	// Fill in the data in the row
	var interfaceName = null;
	if (data_type == 'network') {
	    // For network data, we call fillRow once per interface requested for this sender
	    // but the row is only filled if the data is for the requested interface
	    var idxs = unique_senders_idxs[sender];
	    for (var j = 0; j < idxs.length; j++) {
		interfaceName = split_ifcs[idxs[j]];
		if (fillRow(data_type, row, metric, sender_index, selected_metrics, interfaceName)) {
		    rows.push(row);
		}
	    }
	} else {
	    if (fillRow(data_type, row, metric, sender_index, selected_metrics, interfaceName)) {
		rows.push(row);
	    }
	}
    }

    if (rows.length > 0) {
	interpolateColumns(rows, metric_data, data_type);
	standardizeTimestamps(rows);
	// FIXME: Diffing over network needs to be interface-aware!
	// But by this point, the rows don't have the interface, so how do I diff appropriately?
	if (data_type ==  'network')
	    computeDeltas(rows, metric_data, true, data_type);
	else if (data_type == 'cpu')
	    computeDeltas(rows, metric_data, false, data_type);
        data.addRows(rows);
    } else {
        var container = document.getElementById(chartdiv);
        if (container) {
            $(container).empty(); // Remove the current map
            $(container).append("<i>No data found</i>");
        }
        return;
    }

    var split_metrics = selected_metrics.split(',');
    var num_metrics = split_metrics.length;

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
    var title_sender = '';
    if (unique_senders && unique_senders.length > 0) {
	title_sender = initCase(unique_senders[0]);
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

    if (num_unique_senders > 5) {
	showLegend = 'none';
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

    var basename = getURLParameters().base_name;
    if (basename == 'shakedown') { // Special bounds for Paul Ruth's demo
	if (data_type == 'cpu') {
	    options.vAxis.maxValue = 4000;
            options.vAxis.ticks = [
                {v: 1000, f: '1'},
                {v: 2000, f: '2'},
                {v: 3000, f: '3'},
                {v: 4000, f: '4'}
            ];
	} else if (data_type == 'network') {
	    options.vAxis.maxValue = 10000000000;
            options.vAxis.ticks = [
                {v: 2000000000, f: '2GB'},
                {v: 4000000000, f: '4GB'},
                {v: 6000000000, f: '6GB'},
                {v: 8000000000, f: '8GB'},
                {v: 10000000000, f: '10GB'}
            ];
        }
	else if (data_type == 'memory')
	    options.vAxis.maxValue = 100;
    }

    var container = document.getElementById(chartdiv);
    if (container) {
        var chart = gec.charts.getChart(chartdiv);
        if (! chart) {
            // Avoid a memory leak by caching the chart instance.
            chart = new google.visualization.LineChart(container);
            gec.charts.addChart(chart, chartdiv);
        }
        chart.draw(data, options);
        // Refresh every N (default = 5) seconds
        setTimeout(function() {
            drawVisualization(data_type, senders, tablename,
                              selected_metrics, chartdiv, showXAxis,
                              seconds, chartTitle, interfaceNames,
                              refreshSeconds);
        }, refreshSeconds * 1000);
    }
}

google.load('visualization', '1');
//google.setOnLoadCallback(drawVisualization);

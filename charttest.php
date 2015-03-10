<?php
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

// Test script to show the plotting of measurements as line charts
// Read from a database by an AJAX/PHP script invocation

// Parse the $_GET arguments
// We handle data type, senders, metrics

$data_type = 'generic';
if (array_key_exists('data_type', $_GET))
   $data_type = $_GET['data_type'];
if ($data_type != 'network' && $data_type != 'cpu' && 
    $data_type != 'memory' && $data_type != 'generic') {
   error_log("Unknown data type: $data_type");
   exit;
}

$senders = "1,2";
if (array_key_exists('senders', $_GET)) {
   $senders = $_GET['senders'];
}
// error_log("SENDERS = " . $senders);

$selected_metrics = "";
if (array_key_exists('metrics', $_GET)) {
   $selected_metrics = $_GET['metrics'];
}

$tablename = '';
if (array_key_exists('tablename', $_GET)) {
   $tablename = $_GET['tablename'];
}


?>
<!DOCTYPE HTML>
<html lang="en">
<meta charset="utf-8">
<head>



<!-- <script type="text/javascript" src="https://www.google.com/jsapi></script> -->
<script type="text/javascript"
          src="https://www.google.com/jsapi?autoload={
            'modules':[{
              'name':'visualization',
              'version':'1',
              'packages':['corechart']
            }]
          }"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js"></script>

<script>

    // Copy the PHP variables into JS environment
    var tablename = "<?php echo $tablename; ?>";
    var data_type = "<?php echo $data_type; ?>";
    var senders = "<?php echo $senders; ?>";
    var selected_metrics = "<?php echo $selected_metrics; ?>";

    // Is the given metric enabled?
    function metric_enabled(metric) {
       return selected_metrics == "" || selected_metrics.indexOf(metric) >= 0;
    }

    // This is called once the Google chart stuff is loaded. We then grab the data and
    // plot the char
    function drawVisualization() {
      var url = 'grab_metrics_data.php?data_type=' + data_type + '&senders=' + senders;
      if (data_type == 'generic')
         url = 'grab_generic_metrics_data.php?tablename=' + tablename + '&senders=' + senders + '&metrics=' + selected_metrics
      $.getJSON(url, 
           function(data) { 
	   // In the return from the $.getJSON call to grab_metrics_data we plot the data
          drawChart(data); 
      });
    };

    // Add columns to the table based on which metrics are selected
    function addColumns(data_type, data, unique_sender)
    {
         if (data_type == 'generic') {
	       var split_senders = senders.split(',');
	       var num_senders = split_senders.length;
	       var split_metrics = selected_metrics.split(',');
	       var num_metrics = split_metrics.length;
	       for(var j = 0; j < num_metrics; j++) {
		 var metric = split_metrics[j];
		    data.addColumn('number', metric + "-" + unique_sender);
	        }
         } else if (data_type == 'network') {
	    if (metric_enabled('rx_bytes'))
               data.addColumn('number', 'RX-' + unique_sender);
	    if (metric_enabled('tx_bytes'))
               data.addColumn('number', 'TX-' + unique_sender);
         } else if (data_type == 'cpu') {
	    if (metric_enabled('user'))
               data.addColumn('number', 'USER-' + unique_sender);
	    if (metric_enabled('sys'))
                data.addColumn('number', 'SYS-' + unique_sender);
	    if (metric_enabled('idle'))
                data.addColumn('number', 'IDLE-' + unique_sender);
         } else { // Memory
	    if (metric_enabled('used'))
                data.addColumn('number', 'USED-' + unique_sender);
	    if (metric_enabled('free'))
                data.addColumn('number', 'FREE-' + unique_sender);
	    if (metric_enabled('actual_used'))
                data.addColumn('number', 'ACT_USED-' + unique_sender);
	    if (metric_enabled('actual_free'))
                data.addColumn('number', 'ACT_FREE-' + unique_sender);
         }
   }

   // How many columns are there for this data type? Depends on which are enabled
   function numDataColumns(data_type) {
     var num_columns = 0;
     if(data_type == "generic") {
        var split_metrics  = selected_metrics.split(',');
        num_columns = split_metrics.length;
     } else if(data_type == 'network') {
       if (metric_enabled('rx_bytes')) num_columns = num_columns + 1;
       if (metric_enabled('tx_bytes')) num_columns = num_columns + 1;
     } else if (data_type  == 'cpu') {
       if (metric_enabled('user')) num_columns = num_columns + 1;
       if (metric_enabled('sys')) num_columns = num_columns + 1;
       if (metric_enabled('idle')) num_columns = num_columns + 1;
    } else {
      // Memory
       if (metric_enabled('used')) num_columns = num_columns + 1;
       if (metric_enabled('free')) num_columns = num_columns + 1;
       if (metric_enabled('actual_used')) num_columns = num_columns + 1;
       if (metric_enabled('actual_free')) num_columns = num_columns + 1;
     }
     return num_columns;
   }

   // Fill in row of data for given type based on selected metrics
   function fillRow(data_type, row, metric, sender_index) {
     var num_columns = numDataColumns(data_type);
     var metric_index = 1;
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
         if (metric_enabled('rx_bytes')) {
	    row[num_columns*sender_index+metric_index] = rx_bytes;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('tx_bytes')) {
	    row[num_columns*sender_index+metric_index] = tx_bytes;
         }
      } else if (data_type == 'cpu') {
         var user = parseFloat(metric.user);
         var sys = parseFloat(metric.sys);
         var idle = parseFloat(metric.idle);
         if (metric_enabled('user')) {
	    row[num_columns*sender_index+metric_index] = user;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('sys')) {
	    row[num_columns*sender_index+metric_index] = sys;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('sys')) {
	    row[num_columns*sender_index+metric_index] = idle;
         }
      } else {
       // Memory
         var used = parseFloat(metric.used);
         var free = parseFloat(metric.free);
         var actual_used = parseFloat(metric.actual_used);
         var actual_free = parseFloat(metric.actual_free);
         if (metric_enabled('used')) {
	    row[num_columns*sender_index+metric_index] = used;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('free')) {
	    row[num_columns*sender_index+metric_index] = free;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('actual_used')) {
	    row[num_columns*sender_index+metric_index] = actual_used;
	    metric_index = metric_index + 1;
         }
         if (metric_enabled('actual_free')) {
	    row[num_columns*sender_index+metric_index] = actual_free;
         }
      }
   }

   // Fill in null entries by interpolating between adjacent points
   function interpolateRows(rows) {
     var num_rows = rows.length;
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
       }
     }
   }

   // Draw the chart by grabbing the data, creating the table
   // adding the columns and then adding the rows
    function drawChart(metric_data)
    {
      var unique_senders = {}
      var num_unique_senders = 0;
      for(var i = 0; i < metric_data.length; i++) {
         var metric = metric_data[i];
	 var sender = metric.sender;
	 if (!(sender in unique_senders)) {
	     unique_senders[sender] = num_unique_senders;
	     num_unique_senders = num_unique_senders + 1;
         }
      }
      var data = new google.visualization.DataTable();
      data.addColumn('number', 'TS');

      for(var unique_sender in unique_senders) {
            addColumns(data_type, data, unique_sender);
      }

      rows = [];
      for(var i = 0; i < metric_data.length; i++) {
         var metric = metric_data[i];
	 var ts = parseFloat(metric.ts);
	 var sender = metric.sender;
	 var sender_index = unique_senders[sender];
	 row = [ts];
	 for(var j = 0; j < num_unique_senders; j++) {
	    for(var k = 0; k < numDataColumns(data_type); k++)
	     row.push(null); // Place holders for entries from the appropriate sender
         }
	 fillRow(data_type, row, metric, sender_index);
	 rows.push(row);
      }
      interpolateRows(rows);
      data.addRows(rows);

      var options = {
        chart: {
	 title: 'Network Metrics'
	 },
	 height: 600,
	 width: 600
      };
      var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
      chart.draw(data, options);

      // Refresh every 5 seconds
      setTimeout(drawVisualization, 5000);

    }

    google.load('visualization', '1');
    google.setOnLoadCallback(drawVisualization);


</script>
</head>
<body style="font-family: Arial;border: 0 none;">
  <div id="chart_div" style="width: 800px; height: 600px;"></div>
</body>
</html>



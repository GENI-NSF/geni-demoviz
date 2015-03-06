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

$data_type = 'network';
if (array_key_exists('data_type', $_GET))
   $data_type = $_GET['data_type'];
if ($data_type != 'network' && $data_type != 'cpu' && $data_type != 'memory') {
   error_log("Unknown data type: $data_type");
   exit;
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

    var data_type = "<?php echo $data_type; ?>";

    function drawVisualization() {
      $.getJSON('grab_metrics_data?data_type=' + data_type + '&senders=1,2',
           function(data) { 
          drawChart(data); 
      });
    };

    function addColumns(data_type, data, unique_sender)
    {
         if (data_type == 'network') {
            data.addColumn('number', 'RX-' + unique_sender);
            data.addColumn('number', 'TX-' + unique_sender);
         } else if (data_type == 'cpu') {
            data.addColumn('number', 'USER-' + unique_sender);
            data.addColumn('number', 'SYS-' + unique_sender);
            data.addColumn('number', 'IDLE-' + unique_sender);
         } else { // Memory
            data.addColumn('number', 'USED-' + unique_sender);
            data.addColumn('number', 'FREE-' + unique_sender);
            data.addColumn('number', 'ACT_USED-' + unique_sender);
            data.addColumn('number', 'ACT_FREE-' + unique_sender);
         }
   }

   function numDataColumns(data_type) {
     if(data_type == 'network') return 2;
     else if (data_type  == 'cpu') return 3;
     else return 4; // Memory
   }

   function fillRow(data_type, row, metric, sender_index) {
     if (data_type == 'network') {
	 var rx_bytes = parseFloat(metric.rx_bytes);
	 var tx_bytes = parseFloat(metric.tx_bytes);
	 row[2*sender_index+1] = rx_bytes;
	 row[2*sender_index+2] = rx_bytes;
      } else if (data_type == 'cpu') {
         var user = parseFloat(metric.user);
         var sys = parseFloat(metric.sys);
         var idle = parseFloat(metric.idle);
	 row[3*sender_index+1] = user;
	 row[3*sender_index+2] = sys;
	 row[3*sender_index+3] = idle;
      } else {
       // Memory
         var used = parseFloat(metric.used);
         var free = parseFloat(metric.free);
         var actual_used = parseFloat(metric.actual_used);
         var actual_free = parseFloat(metric.actual_free);
	 row[4*sender_index+1] = used;
	 row[4*sender_index+2] = free;
	 row[4*sender_index+3] = actual_used;
	 row[4*sender_index+4] = actual_free;
      }
   }

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
	 data.addRow(row);
      }

      var options = {
        chart: {
	 title: 'Network Metrics'
	 },
	 height: 600,
	 width: 600
      };
      var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
      chart.draw(data, options);

      setInterval(drawVisualization, 5000);
    }

    google.load('visualization', '1');
    google.setOnLoadCallback(drawVisualization);


</script>
</head>
<body style="font-family: Arial;border: 0 none;">
  <div id="chart_div" style="width: 800px; height: 600px;"></div>
</body>
</html>



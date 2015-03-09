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
// Default lat/long center and zoom, which can be overriden with URL args

$center_lat = 38;
$center_lon = -98;
$zoom = 4;

if(array_key_exists('center', $_GET)) {
   $center = $_GET['center'];
   $center_pieces = split(',', $center);
//   error_log("CENTER = $center");
//   error_log("CENTER = " . print_r($center_pieces, true));
   $center_lat=floatval($center_pieces[0]);
   $center_lon=floatval($center_pieces[1]);
}

if (array_key_exists('zoom', $_GET)) {
   $zoom = intval($_GET['zoom']);
}

// Chart params

$data_type1 = 'cpu';
if (array_key_exists('data_type1', $_GET))
   $data_type1 = $_GET['data_type1'];
if ($data_type1 != 'network' && $data_type1 != 'cpu' && $data_type1 != 'none' &&
    $data_type1 != 'memory' && $data_type1 != 'generic') {
   error_log("Unknown data type1: $data_type1");
   exit;
}

$senders1 = "1,2";
if (array_key_exists('senders1', $_GET)) {
   $senders1 = $_GET['senders1'];
}
// error_log("SENDERS = " . $senders1);

$selected_metrics1 = "";
if (array_key_exists('metrics1', $_GET)) {
   $selected_metrics1 = $_GET['metrics1'];
}

$tablename1 = '';
if (array_key_exists('tablename1', $_GET)) {
   $tablename1 = $_GET['tablename1'];
}

// ---

$data_type2 = 'memory';
if (array_key_exists('data_type2', $_GET))
   $data_type2 = $_GET['data_type2'];
if ($data_type2 != 'network' && $data_type2 != 'cpu' && $data_type2 != 'none' &&
    $data_type2 != 'memory' && $data_type2 != 'generic') {
   error_log("Unknown data type2: $data_type2");
   exit;
}

$senders2 = "1,2";
if (array_key_exists('senders2', $_GET)) {
   $senders2 = $_GET['senders2'];
}
// error_log("SENDERS = " . $senders2);

$selected_metrics2 = "";
if (array_key_exists('metrics2', $_GET)) {
   $selected_metrics2 = $_GET['metrics2'];
}

$tablename2 = '';
if (array_key_exists('tablename2', $_GET)) {
   $tablename2 = $_GET['tablename2'];
}

// ---

$data_type3 = 'network';
if (array_key_exists('data_type3', $_GET))
   $data_type3 = $_GET['data_type3'];
if ($data_type3 != 'network' && $data_type3 != 'cpu' && $data_type3 != 'none' &&
    $data_type3 != 'memory' && $data_type3 != 'generic') {
   error_log("Unknown data type3: $data_type3");
   exit;
}

$senders3 = "1,2";
if (array_key_exists('senders3', $_GET)) {
   $senders3 = $_GET['senders3'];
}
// error_log("SENDERS = " . $senders3);

$selected_metrics3 = "";
if (array_key_exists('metrics3', $_GET)) {
   $selected_metrics3 = $_GET['metrics3'];
}

$tablename3 = '';
if (array_key_exists('tablename3', $_GET)) {
   $tablename3 = $_GET['tablename3'];
}

// ---

$data_type4 = 'none';
if (array_key_exists('data_type4', $_GET))
   $data_type4 = $_GET['data_type4'];
if ($data_type4 != 'network' && $data_type4 != 'cpu' && $data_type4 != 'none' &&
    $data_type4 != 'memory' && $data_type4 != 'generic') {
   error_log("Unknown data type4: $data_type4");
   exit;
}

$senders4 = "1,2";
if (array_key_exists('senders4', $_GET)) {
   $senders4 = $_GET['senders4'];
}
// error_log("SENDERS = " . $senders4);

$selected_metrics4 = "";
if (array_key_exists('metrics4', $_GET)) {
   $selected_metrics4 = $_GET['metrics4'];
}

$tablename4 = '';
if (array_key_exists('tablename4', $_GET)) {
   $tablename4 = $_GET['tablename4'];
}

// ---

$data_type5 = 'none';
if (array_key_exists('data_type5', $_GET))
   $data_type5 = $_GET['data_type5'];
if ($data_type5 != 'network' && $data_type5 != 'cpu' && $data_type5 != 'none' &&
    $data_type5 != 'memory' && $data_type5 != 'generic') {
   error_log("Unknown data type5: $data_type5");
   exit;
}

$senders5 = "1,2";
if (array_key_exists('senders5', $_GET)) {
   $senders5 = $_GET['senders5'];
}
// error_log("SENDERS = " . $senders5);

$selected_metrics5 = "";
if (array_key_exists('metrics5', $_GET)) {
   $selected_metrics5 = $_GET['metrics5'];
}

$tablename5 = '';
if (array_key_exists('tablename5', $_GET)) {
   $tablename5 = $_GET['tablename5'];
}

?>
<!DOCTYPE HTML>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>GEC22 Demo Visualization</title>
    <link href="https://fonts.googleapis.com/css?family=Open+Sans:400,700|PT+Serif:400,400italic|Droid+Sans+Mono"
	  rel="stylesheet" type="text/css">
    <link rel="stylesheet" href="map.css">
    <script src="https://www.google.com/jsapi"></script>
    <script src="https://maps.googleapis.com/maps/api/js?v=3.exp"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js"></script>
    <script src="util.js"></script>
    <script src="map.js"></script>
  <script type="text/javascript"
  src="https://www.google.com/jsapi?autoload={
            'modules':[{
              'name':'visualization',
              'version':'1',
              'packages':['corechart']
            }]
          }"></script>
  <script src="chart.js"></script>
  <style type="text/css">
    body {
      margin: 0;
      padding: 50px;
      background-color: #FFFFFF;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
    }
    table, th, td {
    border: none;
    }
    .table {
      display: table;
    }
    .row {
      display: table-row;
    }

    #map-canvas {
    border-right: 1px solid;
    border-bottom: 1px solid;
    height: 100%;
    min-height: 300px;
    width: 100%;
    }
    #chart_div_right1 {
    border-bottom: 1px solid;
    height: auto;
    width: auto;
    }
    #chart_div_right2 {
    border-bottom: 1px solid;
    height: auto;
    width: auto;
    }
    #chart_div_bottom3 {
    border-right: 1px solid;
    height: auto;
    width: auto;
    }
    #chart_div_bottom4 {
    border-right: 1px solid;
    height: auto;
    width: auto;
    }
    /*
    FOOTER CONTAINER
    */

#footer {
  padding-top: 15px;
  padding-bottom: 15px;
  padding-left:62px;
  padding-right:31px;
    /* center */
    margin-left: auto;
    margin-right: auto;
    width: 807px;
    margin-bottom: 30px;
    margin-top: 20px;
  /* by default, let text be serif */
    font-family: 'Open Sans', sans-serif;
    font-weight: 400;
    box-shadow: 0px 0px 10px #5F584E;
    background-color: #5F584E;
    color: #ffffff;
    overflow: auto;
    }

#footer a {
  text-decoration: none;
  color: #ffffff;
  font-weight: 700;
}

#footer-left {
  float: left;
  text-align: left;
  width: 400px;
  font-size: 0.9em;
}

#footer-right {
  float: right;
  text-align: right;
  width: 400px;
  font-size: 0.8em;
  border-right: 2px solid #ffffff;
  padding-right: 15px;
    }
    </style>
  </head>
  <body>
    <h1><center>Demo Visualization</center></h1>
    <table height="90%">
      <tr height="30%" align="center">
	<td colspan="2" rowspan="2" style="text-alight:center">  <div id="map-canvas"></div>
	</td>
	<td width="30%"  style="text-alight:center"> <div id="chart_div_right1">
	<?php
	error_log("data_type1: $data_type1");
	if ($data_type1 != 'none') {
	  print <<< EOF
	<script>
	google.setOnLoadCallback(function() {
	    drawVisualization("$data_type1", "$senders1", "$tablename1", "$selected_metrics1", 'chart_div_right1');
	  });
	</script>
EOF;
	} else {
	  echo "&nbsp;";
	}
?>
	</div></td>
      <tr height="30%" align="center">
	<td  style="text-alight:center"> <div id="chart_div_right2">
	<?php
	if ($data_type2 != 'none') {
	  print <<< EOF
	<script>
	google.setOnLoadCallback(function() {
	      drawVisualization("$data_type2", "$senders2", "$tablename2", "$selected_metrics2", 'chart_div_right2');
	  });
	</script>
EOF;
	} else {
	  echo "&nbsp;";
	}
?>
	</div></td>
      <tr height="30%">
	<td  style="text-alight:center"> <div id="chart_div_bottom3">
	<?php
	if ($data_type3 != 'none') {
	  print <<< EOF
		<script>
	google.setOnLoadCallback(function() {
	      drawVisualization("$data_type3", "$senders3", "$tablename3", "$selected_metrics3", 'chart_div_bottom3');
	  });
	</script>
EOF;
	} else {
	  echo "&nbsp;";
	}
?>
       </div></td>
	<td  style="text-alight:center"> <div id="chart_div_bottom4">
	<?php
	if ($data_type4 != 'none') {
	  print <<< EOF
		<script>
	google.setOnLoadCallback(function() {
	      drawVisualization("$data_type4", "$senders4", "$tablename4", "$selected_metrics4", 'chart_div_bottom4');
	  });
	</script>
EOF;
	} else {
	  echo "&nbsp;";
	}
?>
</div></td>
	<td  style="text-alight:center"> <div id="chart_div_bottom5">
	<?php
	if ($data_type5 != 'none') {
	  print <<< EOF
		<script>
	google.setOnLoadCallback(function() {
	      drawVisualization("$data_type5", "$senders5", "$tablename5", "$selected_metrics5", 'chart_div_bottom5');
	  });
	</script>
EOF;
	} else {
	  echo "&nbsp;";
	}
?>
</div></td>
      </tr>
    </table> 
    <div id="footer">
      <div id="footer-left">
	<!-- <a href="https://portal.geni.net">GENI Portal Home</a><br>
	     <a href="http://www.geni.net">GENI Home</a><br>
	     <a href="http://groups.geni.net/geni">GENI Wiki</a> -->
      </div>
      <div id="footer-right">
	<a href="http://www.geni.net/">GENI</a> is sponsored by the <a href="http://www.nsf.gov/"><img src="/common/nsf1.gif" alt="NSF Logo" height="16" width="16"/> National Science Foundation</a>
      </div>
    </div>
  </body>
</html>


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

$lively_url = "http://www.lively-web.org/nodejs/GEC22ReportServer/all_reports/";
$data = file_get_contents($lively_url);
// error_log("DATA = " . $data);
$jdata = json_decode($data);
// error_log("JDATA = " . print_r($data, true));

$latest_time_per_server = array();

foreach($jdata as $record)  {
  $total_time = intval($record->totalTime);
  $timestamp = intval($record->timestamp);
  $server = $record->server;

  if (!(array_key_exists($server, $latest_time_per_server))) {
      $latest_time_per_server[$server] = array('timestamp' => -1, 'total_time' => 0);
  }
  $record_server = $latest_time_per_server[$server];
  if($timestamp > $record_server['timestamp']) {
      $new_record_server = array('timestamp' => $timestamp, 'total_time' => $total_time);
      $latest_time_per_server[$server] = $new_record_server;
  }
}

print json_encode($latest_time_per_server);

?>

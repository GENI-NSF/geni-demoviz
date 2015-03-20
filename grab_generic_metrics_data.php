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

include "db_utils.php";

// A script to read metrics data (memory, cpu, network)
// from the nmetrics_<data_type> tables

// *** TO DO: Make the timespan clause a variable ***

// error_log("GET = " . print_r($_GET, true));

// Turn a string of comma-separated values A,B,C
// Into a list of quoted comma-separated values 'A','B','C'
function quoted_string_list($unquoted_string_list)
{
	$result = "";
	$elts = split(',', $unquoted_string_list);
	$first = true;
	foreach($elts as $elt) {
	   if(!$first) $result = $result . ", ";
	   $first = false;
	   $result = $result . "'$elt'";
       }
       return $result;
}

// A sender is a unique identifier of who is sending the data
// Typically it is one per node
// So we can select only data for certain senders optionally
$senders_clause = "";
if(array_key_exists('senders', $_GET)) {
   $senders = $_GET['senders'];
   $senders_quoted = quoted_string_list($senders);
   $senders_clause = "sender in ($senders_quoted)";
}

$metrics = "";
$metrics_clause = "";	 
if (array_key_exists('metrics', $_GET)) {
  $metrics = $_GET['metrics'];
  $metrics_quoted = quoted_string_list($metrics);
}

$tablename = "";
if (array_key_exists('tablename', $_GET)) {
   $tablename = $_GET['tablename'];
}

// Check if this is one of the recognized data types
if($tablename == "") {
      error_log("No tablename specified");
      exit;
}

$seconds = 120;
if(array_key_exists('seconds', $_GET)) {
  $seconds = $_GET['seconds'];
}

// A timespan clause causes us to only get the most recent data (N seconds)
function get_timespan_clause($tablename, $seconds=null)
{
    global $senders_clause;
    $qualifier = "";
    if (is_null($seconds)) {
      $seconds = 120;
    }
    if ($senders_clause != "") $qualifier = " WHERE $senders_clause";
    return "(ts + $seconds) > (select max(ts) from $tablename $qualifier)";
}

// Get all the data for the given query 
// (which data, fields from which table with which timespan)
function get_metrics_data($tablename, $metrics, $senders_clause, $seconds=null)
{
  $timespan_clause = get_timespan_clause($tablename, $seconds);
   $query = "select sender, ts, $metrics from $tablename where $timespan_clause";
   if ($senders_clause != "")
      $query = $query . " AND $senders_clause";
   //   error_log("Q = $query");
   $order_clause = "order by ts";
   $query = $query . " " . $order_clause;
   return get_rows_for_query($query);
}

$data = array();

$data = get_metrics_data($tablename, $metrics, $senders_clause, $seconds);
print json_encode($data);


?>
